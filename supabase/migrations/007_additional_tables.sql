-- ============================================================
-- 007_additional_tables.sql
-- Push tokens, trips automáticos y funciones auxiliares
-- ============================================================

-- ------------------------------------------------------------
-- PUSH TOKENS (Firebase FCM)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS push_tokens (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       text        NOT NULL,
  platform    varchar(10) NOT NULL DEFAULT 'fcm', -- 'fcm' | 'apns'
  device_info jsonb,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_tokens_tenant" ON push_tokens
  FOR ALL USING (
    auth.is_super_admin() OR company_id = auth.company_id()
  );

CREATE INDEX idx_push_tokens_company ON push_tokens(company_id, is_active);

-- ------------------------------------------------------------
-- API KEYS (para acceso programático)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_keys (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        varchar(100) NOT NULL,
  key_hash    text        NOT NULL UNIQUE, -- SHA256 of the actual key
  key_prefix  varchar(10) NOT NULL,        -- first 8 chars for display
  permissions text[]      NOT NULL DEFAULT ARRAY['read'],
  last_used   timestamptz,
  expires_at  timestamptz,
  is_active   boolean     NOT NULL DEFAULT true,
  created_by  uuid        REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys_tenant" ON api_keys
  FOR ALL USING (
    auth.is_super_admin() OR company_id = auth.company_id()
  );

CREATE INDEX idx_api_keys_company ON api_keys(company_id, is_active);

-- ------------------------------------------------------------
-- REPORTS (stored reports for async generation)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS generated_reports (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type        varchar(50) NOT NULL,
  name        varchar(200) NOT NULL,
  parameters  jsonb       NOT NULL DEFAULT '{}',
  status      varchar(20) NOT NULL DEFAULT 'pending', -- pending, processing, ready, error
  file_url    text,
  file_size   bigint,
  row_count   int,
  error_msg   text,
  requested_by uuid      REFERENCES users(id),
  started_at  timestamptz,
  completed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_tenant" ON generated_reports
  FOR ALL USING (
    auth.is_super_admin() OR company_id = auth.company_id()
  );

CREATE INDEX idx_reports_company ON generated_reports(company_id, created_at DESC);

-- ------------------------------------------------------------
-- TRIP DETECTION FUNCTION
-- Auto-detect trips based on ignition changes
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION detect_trip_event(
  p_vehicle_id  uuid,
  p_company_id  uuid,
  p_lat         float8,
  p_lng         float8,
  p_ignition    boolean,
  p_odometer    float8,
  p_recorded_at timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_open_trip    record;
  v_prev_pos     record;
BEGIN
  -- Get previous position
  SELECT lat, lng, ignition, odometer, recorded_at
  INTO v_prev_pos
  FROM position_history
  WHERE vehicle_id = p_vehicle_id
  ORDER BY recorded_at DESC
  LIMIT 1;

  -- Check for open trip
  SELECT * INTO v_open_trip
  FROM trips
  WHERE vehicle_id = p_vehicle_id
    AND is_complete = false
  ORDER BY started_at DESC
  LIMIT 1;

  -- Ignition just turned ON → start new trip
  IF p_ignition AND (NOT FOUND OR NOT v_prev_pos.ignition) THEN
    INSERT INTO trips (
      vehicle_id, company_id,
      started_at, start_lat, start_lng,
      distance_km, is_complete
    ) VALUES (
      p_vehicle_id, p_company_id,
      p_recorded_at, p_lat, p_lng,
      0, false
    );

  -- Ignition just turned OFF → close open trip
  ELSIF NOT p_ignition AND FOUND AND NOT v_open_trip.is_complete THEN
    UPDATE trips SET
      ended_at      = p_recorded_at,
      end_lat       = p_lat,
      end_lng       = p_lng,
      distance_km   = GREATEST(0, p_odometer - v_open_trip.start_lat), -- simplified
      is_complete   = true
    WHERE id = v_open_trip.id;

  -- Still driving → update distance
  ELSIF p_ignition AND FOUND AND NOT v_open_trip.is_complete THEN
    UPDATE trips SET
      distance_km = GREATEST(0, p_odometer - COALESCE(
        (SELECT odometer FROM position_history
         WHERE vehicle_id = p_vehicle_id AND recorded_at <= v_open_trip.started_at
         ORDER BY recorded_at DESC LIMIT 1), p_odometer
      ))
    WHERE id = v_open_trip.id;
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- FUNCTION: Get company limits vs current usage
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_company_usage(
  p_company_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_result       jsonb;
  v_plan         record;
  v_vehicle_count int;
  v_user_count    int;
BEGIN
  -- Get plan limits
  SELECT p.max_vehicles, p.max_users, p.features
  INTO v_plan
  FROM subscriptions s
  JOIN plans p ON p.id = s.plan_id
  WHERE s.company_id = p_company_id;

  -- Get current counts
  SELECT COUNT(*) INTO v_vehicle_count FROM vehicles WHERE company_id = p_company_id AND deleted_at IS NULL;
  SELECT COUNT(*) INTO v_user_count    FROM users    WHERE company_id = p_company_id AND is_active = true;

  RETURN jsonb_build_object(
    'vehicles',     jsonb_build_object('current', v_vehicle_count, 'max', COALESCE(v_plan.max_vehicles, 10)),
    'users',        jsonb_build_object('current', v_user_count,    'max', COALESCE(v_plan.max_users, 5)),
    'features',     COALESCE(v_plan.features, '{}'::jsonb),
    'at_vehicle_limit', v_vehicle_count >= COALESCE(v_plan.max_vehicles, 10),
    'at_user_limit',    v_user_count    >= COALESCE(v_plan.max_users, 5)
  );
END;
$$;
