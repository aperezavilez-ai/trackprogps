-- ============================================================
-- 006_geofence_functions.sql
-- PostGIS functions for geofence event detection
-- ============================================================

-- Function: check if a point is inside a geofence
CREATE OR REPLACE FUNCTION is_inside_geofence(
  p_lat      float8,
  p_lng      float8,
  p_fence_id uuid
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_point    geometry;
  v_fence    geometry;
  v_type     geofence_type;
  v_radius   float4;
BEGIN
  v_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326);

  SELECT geometry, type, radius_m
  INTO v_fence, v_type, v_radius
  FROM geofences
  WHERE id = p_fence_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_type = 'circular' THEN
    -- For circular: check distance in meters
    RETURN ST_Distance(
      ST_Transform(v_point, 3857),
      ST_Transform(v_fence, 3857)
    ) <= v_radius;
  ELSE
    -- For polygon: check point in polygon
    RETURN ST_Within(v_point, v_fence);
  END IF;
END;
$$;

-- Function: detect geofence entry/exit events
-- Returns 'enter', 'exit', or 'none'
CREATE OR REPLACE FUNCTION check_geofence_event(
  p_vehicle_id  uuid,
  p_geofence_id uuid,
  p_lat         float8,
  p_lng         float8
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_currently_inside boolean;
  v_was_inside       boolean;
  v_last_position    record;
BEGIN
  -- Check if vehicle is currently inside the geofence
  v_currently_inside := is_inside_geofence(p_lat, p_lng, p_geofence_id);

  -- Get previous position
  SELECT lat, lng
  INTO v_last_position
  FROM position_history
  WHERE vehicle_id = p_vehicle_id
  ORDER BY recorded_at DESC
  OFFSET 1 LIMIT 1;

  IF NOT FOUND THEN
    RETURN 'none';
  END IF;

  -- Check if was previously inside
  v_was_inside := is_inside_geofence(
    v_last_position.lat,
    v_last_position.lng,
    p_geofence_id
  );

  IF v_currently_inside AND NOT v_was_inside THEN
    RETURN 'enter';
  ELSIF NOT v_currently_inside AND v_was_inside THEN
    RETURN 'exit';
  ELSE
    RETURN 'none';
  END IF;
END;
$$;

-- Function: get all geofence events for a position update
CREATE OR REPLACE FUNCTION get_geofence_events(
  p_company_id uuid,
  p_vehicle_id uuid,
  p_lat        float8,
  p_lng        float8
) RETURNS TABLE (
  geofence_id   uuid,
  geofence_name text,
  event_type    text,
  alert_on_enter boolean,
  alert_on_exit  boolean
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.id             AS geofence_id,
    g.name           AS geofence_name,
    check_geofence_event(p_vehicle_id, g.id, p_lat, p_lng) AS event_type,
    g.alert_on_enter,
    g.alert_on_exit
  FROM geofences g
  WHERE g.company_id = p_company_id
    AND g.is_active = true
    AND (g.vehicle_ids IS NULL OR p_vehicle_id = ANY(g.vehicle_ids))
    AND check_geofence_event(p_vehicle_id, g.id, p_lat, p_lng) != 'none';
END;
$$;

-- ============================================================
-- PARTITION MANAGEMENT
-- Auto-create monthly partitions for position_history
-- ============================================================

CREATE OR REPLACE FUNCTION create_monthly_partition(
  target_date date DEFAULT CURRENT_DATE
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  partition_name text;
  start_date     date;
  end_date       date;
BEGIN
  start_date := date_trunc('month', target_date)::date;
  end_date   := (start_date + interval '1 month')::date;
  partition_name := 'position_history_' || to_char(target_date, 'YYYY_MM');

  -- Skip if partition already exists
  IF EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public' AND tablename = partition_name
  ) THEN
    RETURN;
  END IF;

  EXECUTE format(
    'CREATE TABLE %I PARTITION OF position_history
     FOR VALUES FROM (%L) TO (%L)',
    partition_name,
    start_date::text,
    end_date::text
  );

  -- Create optimized indexes on the new partition
  EXECUTE format(
    'CREATE INDEX %I ON %I (vehicle_id, recorded_at DESC)',
    partition_name || '_vehicle_time_idx',
    partition_name
  );

  EXECUTE format(
    'CREATE INDEX %I ON %I (company_id, recorded_at DESC)',
    partition_name || '_company_time_idx',
    partition_name
  );

  RAISE NOTICE 'Created partition: %', partition_name;
END;
$$;

-- Create current and next month partitions
SELECT create_monthly_partition(CURRENT_DATE);
SELECT create_monthly_partition(CURRENT_DATE + interval '1 month');

-- Schedule: run this monthly via pg_cron or Supabase cron jobs
-- SELECT cron.schedule('create-partitions', '0 0 1 * *', 'SELECT create_monthly_partition(CURRENT_DATE + interval ''1 month'')');

-- ============================================================
-- DASHBOARD STATS function (optimized)
-- ============================================================

CREATE OR REPLACE FUNCTION get_dashboard_stats(
  p_company_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_result jsonb;
  v_now    timestamptz := now();
  v_5min   timestamptz := now() - interval '5 minutes';
  v_today  timestamptz := date_trunc('day', now());
BEGIN
  SELECT jsonb_build_object(
    'total_vehicles',     COUNT(*),
    'vehicles_online',    COUNT(*) FILTER (WHERE vp.recorded_at > v_5min AND vp.ignition),
    'vehicles_moving',    COUNT(*) FILTER (WHERE vp.recorded_at > v_5min AND vp.ignition AND vp.speed > 2),
    'vehicles_stopped',   COUNT(*) FILTER (WHERE vp.recorded_at > v_5min AND vp.ignition AND vp.speed <= 2),
    'vehicles_offline',   COUNT(*) FILTER (WHERE vp.recorded_at > v_5min AND NOT vp.ignition),
    'vehicles_no_signal', COUNT(*) FILTER (WHERE vp.recorded_at <= v_5min OR vp.recorded_at IS NULL),
    'active_alerts',      (
      SELECT COUNT(*) FROM alerts a
      WHERE a.company_id = p_company_id AND a.acknowledged_at IS NULL
    ),
    'km_today',           COALESCE((
      SELECT SUM(
        (SELECT ph.odometer FROM position_history ph
         WHERE ph.vehicle_id = v.id AND ph.recorded_at >= v_today
         ORDER BY ph.recorded_at DESC LIMIT 1)
        -
        (SELECT ph.odometer FROM position_history ph
         WHERE ph.vehicle_id = v.id AND ph.recorded_at >= v_today
         ORDER BY ph.recorded_at ASC LIMIT 1)
      )
      FROM vehicles v WHERE v.company_id = p_company_id AND v.deleted_at IS NULL
    ), 0)
  )
  INTO v_result
  FROM vehicles v
  LEFT JOIN vehicle_positions vp ON vp.vehicle_id = v.id
  WHERE v.company_id = p_company_id
    AND v.deleted_at IS NULL;

  RETURN v_result;
END;
$$;
