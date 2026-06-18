-- Ralentí: suma gaps entre muestras consecutivas (ignición ON, vel <= 2 km/h)
CREATE OR REPLACE FUNCTION get_idle_stats_for_vehicles(
  p_vehicle_ids uuid[],
  p_from        timestamptz,
  p_to          timestamptz
)
RETURNS TABLE (
  vehicle_id    uuid,
  idle_minutes  numeric,
  idle_samples  bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH ordered AS (
    SELECT
      ph.vehicle_id,
      ph.recorded_at,
      LAG(ph.recorded_at) OVER (
        PARTITION BY ph.vehicle_id ORDER BY ph.recorded_at
      ) AS prev_ts
    FROM position_history ph
    WHERE ph.vehicle_id = ANY(p_vehicle_ids)
      AND ph.recorded_at >= p_from
      AND ph.recorded_at <= p_to
      AND ph.ignition = true
      AND ph.speed <= 2
  ),
  gaps AS (
    SELECT
      vehicle_id,
      CASE
        WHEN prev_ts IS NULL
          OR recorded_at - prev_ts > interval '5 minutes'
        THEN 1.0
        ELSE GREATEST(
          EXTRACT(EPOCH FROM (recorded_at - prev_ts)) / 60.0,
          0.5
        )
      END AS gap_min
    FROM ordered
  )
  SELECT
    vehicle_id,
    ROUND(SUM(gap_min)::numeric, 1) AS idle_minutes,
    COUNT(*)::bigint AS idle_samples
  FROM gaps
  GROUP BY vehicle_id
  HAVING COUNT(*) > 0;
$$;
