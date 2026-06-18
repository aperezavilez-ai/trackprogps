-- ============================================================
-- 011_scale_500_devices.sql
-- Indexes and optimizations for 500+ GPS devices
-- ============================================================

-- Faster map/dashboard ordering by last position time
CREATE INDEX IF NOT EXISTS idx_vp_company_recorded
  ON vehicle_positions(company_id, recorded_at DESC);

-- Offline detection cron (devices marked online but stale)
CREATE INDEX IF NOT EXISTS idx_gps_devices_stale
  ON gps_devices(last_seen)
  WHERE status = 'online';

-- Alert rule lookups by vehicle_ids array
CREATE INDEX IF NOT EXISTS idx_alert_rules_vehicle_ids
  ON alert_rules USING GIN(vehicle_ids);

-- IMEI lookup from GPS worker (hot path)
CREATE INDEX IF NOT EXISTS idx_gps_devices_imei_status
  ON gps_devices(imei, status);

COMMENT ON INDEX idx_vp_company_recorded IS 'Map/dashboard: order fleet by freshness at scale';
COMMENT ON INDEX idx_gps_devices_stale IS 'Cron: find online devices with stale last_seen';

-- Bulk kilometrage stats for reports (500 vehicles in one query)
CREATE OR REPLACE FUNCTION get_km_stats_for_vehicles(
  p_vehicle_ids uuid[],
  p_from        timestamptz,
  p_to          timestamptz
) RETURNS TABLE (
  vehicle_id uuid,
  km_total   float8,
  max_speed  float4,
  avg_speed  float4
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH ranked AS (
    SELECT
      vehicle_id,
      odometer,
      speed,
      ROW_NUMBER() OVER (PARTITION BY vehicle_id ORDER BY recorded_at ASC)  AS rn_first,
      ROW_NUMBER() OVER (PARTITION BY vehicle_id ORDER BY recorded_at DESC) AS rn_last
    FROM position_history
    WHERE vehicle_id = ANY(p_vehicle_ids)
      AND recorded_at BETWEEN p_from AND p_to
  ),
  bounds AS (
    SELECT
      vehicle_id,
      MAX(odometer) FILTER (WHERE rn_first = 1) AS odometer_start,
      MAX(odometer) FILTER (WHERE rn_last  = 1) AS odometer_end,
      MAX(speed)    AS max_speed,
      AVG(speed) FILTER (WHERE speed > 2) AS avg_speed
    FROM ranked
    GROUP BY vehicle_id
  )
  SELECT
    vehicle_id,
    GREATEST(0, COALESCE(odometer_end, 0) - COALESCE(odometer_start, 0))::float8 AS km_total,
    COALESCE(max_speed, 0)::float4 AS max_speed,
    COALESCE(avg_speed, 0)::float4 AS avg_speed
  FROM bounds;
$$;
