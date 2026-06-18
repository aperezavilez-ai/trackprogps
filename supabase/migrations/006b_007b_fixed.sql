-- ============================================================
-- 006b_007b_fixed.sql — versiones corregidas de 006 y 007
-- ============================================================

-- ---- 006 fixes ----

-- Geocerca functions (same as 006 but kept for reference)
CREATE OR REPLACE FUNCTION is_inside_geofence(
  p_lat float8, p_lng float8, p_fence_id uuid
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_point geometry; v_fence geometry;
  v_type geofence_type; v_radius float4;
BEGIN
  v_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326);
  SELECT geometry, type, radius_m INTO v_fence, v_type, v_radius
  FROM geofences WHERE id = p_fence_id AND is_active = true;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_type = 'circular' THEN
    RETURN ST_Distance(ST_Transform(v_point, 3857), ST_Transform(v_fence, 3857)) <= v_radius;
  ELSE
    RETURN ST_Within(v_point, v_fence);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION check_geofence_event(
  p_vehicle_id uuid, p_geofence_id uuid, p_lat float8, p_lng float8
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_currently_inside boolean; v_was_inside boolean; v_last record;
BEGIN
  v_currently_inside := is_inside_geofence(p_lat, p_lng, p_geofence_id);
  SELECT lat, lng INTO v_last FROM position_history
  WHERE vehicle_id = p_vehicle_id ORDER BY recorded_at DESC OFFSET 1 LIMIT 1;
  IF NOT FOUND THEN RETURN 'none'; END IF;
  v_was_inside := is_inside_geofence(v_last.lat, v_last.lng, p_geofence_id);
  IF v_currently_inside AND NOT v_was_inside THEN RETURN 'enter';
  ELSIF NOT v_currently_inside AND v_was_inside THEN RETURN 'exit';
  ELSE RETURN 'none'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION get_geofence_events(
  p_company_id uuid, p_vehicle_id uuid, p_lat float8, p_lng float8
) RETURNS TABLE (
  geofence_id uuid, geofence_name text, event_type text,
  alert_on_enter boolean, alert_on_exit boolean
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT g.id, g.name, check_geofence_event(p_vehicle_id, g.id, p_lat, p_lng),
         g.alert_on_enter, g.alert_on_exit
  FROM geofences g
  WHERE g.company_id = p_company_id AND g.is_active = true
    AND (g.vehicle_ids IS NULL OR p_vehicle_id = ANY(g.vehicle_ids))
    AND check_geofence_event(p_vehicle_id, g.id, p_lat, p_lng) != 'none';
END;
$$;

-- Partition function — FIX: correct parameter type
CREATE OR REPLACE FUNCTION create_monthly_partition(
  target_date date DEFAULT CURRENT_DATE
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  partition_name text; start_date date; end_date date;
BEGIN
  start_date := date_trunc('month', target_date)::date;
  end_date   := (start_date + interval '1 month')::date;
  partition_name := 'position_history_' || to_char(target_date, 'YYYY_MM');
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = partition_name) THEN
    RETURN;
  END IF;
  EXECUTE format('CREATE TABLE %I PARTITION OF position_history FOR VALUES FROM (%L) TO (%L)',
    partition_name, start_date::text, end_date::text);
  EXECUTE format('CREATE INDEX %I ON %I (vehicle_id, recorded_at DESC)',
    partition_name || '_vehicle_time_idx', partition_name);
  EXECUTE format('CREATE INDEX %I ON %I (company_id, recorded_at DESC)',
    partition_name || '_company_time_idx', partition_name);
END;
$$;

-- FIX: cast to date to avoid timestamp mismatch
SELECT create_monthly_partition(CURRENT_DATE);
SELECT create_monthly_partition((CURRENT_DATE + interval '1 month')::date);

-- ---- 007 fixes — replace auth.* with public.* ----

CREATE TABLE IF NOT EXISTS push_tokens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL, platform varchar(10) NOT NULL DEFAULT 'fcm',
  device_info jsonb, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_tokens_tenant" ON push_tokens
  FOR ALL USING (public.is_super_admin() OR company_id = public.get_company_id());
CREATE INDEX IF NOT EXISTS idx_push_tokens_company ON push_tokens(company_id, is_active);

CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL, key_hash text NOT NULL UNIQUE,
  key_prefix varchar(10) NOT NULL, permissions text[] NOT NULL DEFAULT ARRAY['read'],
  last_used timestamptz, expires_at timestamptz, is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_keys_tenant" ON api_keys
  FOR ALL USING (public.is_super_admin() OR company_id = public.get_company_id());
CREATE INDEX IF NOT EXISTS idx_api_keys_company ON api_keys(company_id, is_active);

CREATE TABLE IF NOT EXISTS generated_reports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type varchar(50) NOT NULL, name varchar(200) NOT NULL,
  parameters jsonb NOT NULL DEFAULT '{}', status varchar(20) NOT NULL DEFAULT 'pending',
  file_url text, file_size bigint, row_count int, error_msg text,
  requested_by uuid REFERENCES users(id),
  started_at timestamptz, completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_tenant" ON generated_reports
  FOR ALL USING (public.is_super_admin() OR company_id = public.get_company_id());
CREATE INDEX IF NOT EXISTS idx_reports_company ON generated_reports(company_id, created_at DESC);

-- Trip detection function
CREATE OR REPLACE FUNCTION detect_trip_event(
  p_vehicle_id uuid, p_company_id uuid,
  p_lat float8, p_lng float8, p_ignition boolean,
  p_odometer float8, p_recorded_at timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_open_trip record; v_prev_pos record;
BEGIN
  SELECT lat, lng, ignition, odometer, recorded_at INTO v_prev_pos
  FROM position_history WHERE vehicle_id = p_vehicle_id
  ORDER BY recorded_at DESC LIMIT 1;

  SELECT * INTO v_open_trip FROM trips
  WHERE vehicle_id = p_vehicle_id AND is_complete = false
  ORDER BY started_at DESC LIMIT 1;

  IF p_ignition AND (NOT FOUND OR NOT v_prev_pos.ignition) THEN
    INSERT INTO trips (vehicle_id, company_id, started_at, start_lat, start_lng, distance_km, is_complete)
    VALUES (p_vehicle_id, p_company_id, p_recorded_at, p_lat, p_lng, 0, false);
  ELSIF NOT p_ignition AND FOUND AND NOT v_open_trip.is_complete THEN
    UPDATE trips SET ended_at = p_recorded_at, end_lat = p_lat, end_lng = p_lng,
      distance_km = GREATEST(0, p_odometer - v_open_trip.start_lat), is_complete = true
    WHERE id = v_open_trip.id;
  ELSIF p_ignition AND FOUND AND NOT v_open_trip.is_complete THEN
    UPDATE trips SET distance_km = GREATEST(0, p_odometer - COALESCE(
      (SELECT odometer FROM position_history WHERE vehicle_id = p_vehicle_id
       AND recorded_at <= v_open_trip.started_at ORDER BY recorded_at DESC LIMIT 1), p_odometer
    )) WHERE id = v_open_trip.id;
  END IF;
END;
$$;

-- Company usage function
CREATE OR REPLACE FUNCTION get_company_usage(p_company_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE v_plan record; v_vc int; v_uc int;
BEGIN
  SELECT p.max_vehicles, p.max_users, p.features INTO v_plan
  FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.company_id = p_company_id;
  SELECT COUNT(*) INTO v_vc FROM vehicles WHERE company_id = p_company_id AND deleted_at IS NULL;
  SELECT COUNT(*) INTO v_uc FROM users WHERE company_id = p_company_id AND is_active = true;
  RETURN jsonb_build_object(
    'vehicles', jsonb_build_object('current', v_vc, 'max', COALESCE(v_plan.max_vehicles, 10)),
    'users',    jsonb_build_object('current', v_uc, 'max', COALESCE(v_plan.max_users, 5)),
    'features', COALESCE(v_plan.features, '{}'::jsonb),
    'at_vehicle_limit', v_vc >= COALESCE(v_plan.max_vehicles, 10),
    'at_user_limit',    v_uc >= COALESCE(v_plan.max_users, 5)
  );
END;
$$;
