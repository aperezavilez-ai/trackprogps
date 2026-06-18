-- Estadísticas de ralentí (ignición ON, velocidad <= 2 km/h)
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
  SELECT
    ph.vehicle_id,
    ROUND(COUNT(*)::numeric / 2, 1) AS idle_minutes,
    COUNT(*)::bigint AS idle_samples
  FROM position_history ph
  WHERE ph.vehicle_id = ANY(p_vehicle_ids)
    AND ph.recorded_at >= p_from
    AND ph.recorded_at <= p_to
    AND ph.ignition = true
    AND ph.speed <= 2
  GROUP BY ph.vehicle_id
  HAVING COUNT(*) > 0;
$$;

-- pg_cron: jobs operativos (requiere extensión habilitada en Supabase)
DO $outer$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron no disponible — habilitar en Database → Extensions';
END;
$outer$;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN ('mark-devices-offline', 'cleanup-old-positions');

    PERFORM cron.schedule(
      'mark-devices-offline',
      '*/5 * * * *',
      $job$
      UPDATE gps_devices SET status = 'offline'
      WHERE last_seen < now() - interval '10 minutes'
        AND status = 'online'
      $job$
    );

    PERFORM cron.schedule(
      'cleanup-old-positions',
      '0 3 * * 0',
      $job$
      DELETE FROM position_history
      WHERE recorded_at < now() - interval '1 year'
      $job$
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Cron schedule skipped: %', SQLERRM;
END;
$cron$;
