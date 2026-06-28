-- Activa cron mensual para particiones de position_history
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
    WHERE jobname = 'create-next-month-partition';

    PERFORM cron.schedule(
      'create-next-month-partition',
      '0 0 1 * *',
      $job$SELECT create_monthly_partition((CURRENT_DATE + interval '1 month')::date)$job$
    );

    -- Asegura partición del mes actual y el siguiente
    PERFORM create_monthly_partition(CURRENT_DATE);
    PERFORM create_monthly_partition((CURRENT_DATE + interval '1 month')::date);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Partition cron skipped: %', SQLERRM;
END;
$cron$;
