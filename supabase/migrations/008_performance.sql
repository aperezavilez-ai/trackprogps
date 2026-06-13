-- ============================================================
-- 008_performance.sql
-- Índices adicionales, vistas y optimizaciones de performance
-- ============================================================

-- ------------------------------------------------------------
-- ÍNDICES COMPUESTOS CRÍTICOS
-- ------------------------------------------------------------

-- Para queries de posición por empresa + tiempo (más frecuente)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ph_company_vehicle_time
  ON position_history(company_id, vehicle_id, recorded_at DESC);

-- Para alertas no reconocidas (dashboard + realtime)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_company_unack_time
  ON alerts(company_id, created_at DESC)
  WHERE acknowledged_at IS NULL;

-- Para el motor de alertas (speed_excess es el más común)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alert_rules_company_type
  ON alert_rules(company_id, type, is_active);

-- Para la búsqueda de vehículos (full text)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vehicles_search
  ON vehicles USING gin(
    to_tsvector('spanish', economic_num || ' ' || plates || ' ' || brand || ' ' || model)
  );

-- Para búsqueda de choferes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_drivers_search
  ON drivers USING gin(
    to_tsvector('spanish', full_name || ' ' || license_num)
  )
  WHERE deleted_at IS NULL;

-- Para historial de viajes por vehículo
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trips_vehicle_complete
  ON trips(vehicle_id, started_at DESC)
  WHERE is_complete = true;

-- Para mantenimiento: vehículos con servicio próximo
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maintenance_next_date
  ON maintenance_records(company_id, next_service_date ASC NULLS LAST)
  WHERE next_service_date IS NOT NULL;

-- Para geocercas activas por empresa
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_geofences_company_active
  ON geofences(company_id)
  WHERE is_active = true;

-- Para subscripciones que vencen pronto (billing alerts)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subs_period_end
  ON subscriptions(current_period_end ASC)
  WHERE status IN ('active', 'trialing');

-- ------------------------------------------------------------
-- VISTA: Live fleet status (sin materializar - siempre fresca)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW v_live_fleet AS
SELECT
  v.id           AS vehicle_id,
  v.company_id,
  v.economic_num,
  v.plates,
  v.brand,
  v.model,
  v.type         AS vehicle_type,
  v.status       AS vehicle_status,
  d.full_name    AS driver_name,
  d.phone        AS driver_phone,
  gd.imei,
  gd.model       AS device_model,
  vp.lat,
  vp.lng,
  vp.speed,
  vp.heading,
  vp.altitude,
  vp.ignition,
  vp.odometer,
  vp.gsm_signal,
  vp.battery_lvl,
  vp.recorded_at AS last_position_at,
  -- Status derivado
  CASE
    WHEN vp.recorded_at IS NULL THEN 'no_gps'
    WHEN now() - vp.recorded_at > interval '5 minutes' THEN 'no_signal'
    WHEN NOT vp.ignition THEN 'offline'
    WHEN vp.speed > 2 THEN 'moving'
    ELSE 'stopped'
  END AS computed_status
FROM vehicles v
LEFT JOIN drivers           d  ON d.id  = v.driver_id
LEFT JOIN gps_devices       gd ON gd.id = v.device_id
LEFT JOIN vehicle_positions vp ON vp.vehicle_id = v.id
WHERE v.deleted_at IS NULL;

-- RLS-compatible: acceso filtrado por company_id desde la aplicación

-- ------------------------------------------------------------
-- VISTA: Alertas con contexto de vehículo
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW v_alerts_with_context AS
SELECT
  a.*,
  v.economic_num,
  v.plates,
  v.brand,
  v.model,
  d.full_name AS driver_name
FROM alerts a
JOIN vehicles v ON v.id = a.vehicle_id
LEFT JOIN drivers d ON d.id = v.driver_id;

-- ------------------------------------------------------------
-- FUNCIÓN: Estadísticas de km por empresa y período
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_km_stats(
  p_company_id uuid,
  p_from       timestamptz DEFAULT now() - interval '30 days',
  p_to         timestamptz DEFAULT now()
) RETURNS TABLE (
  vehicle_id   uuid,
  economic_num text,
  plates       text,
  km_total     float8,
  trips_count  bigint,
  avg_speed    float4,
  max_speed    float4
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.economic_num,
    v.plates,
    GREATEST(0,
      COALESCE(
        (SELECT ph2.odometer FROM position_history ph2
          WHERE ph2.vehicle_id = v.id
            AND ph2.recorded_at BETWEEN p_from AND p_to
          ORDER BY ph2.recorded_at DESC LIMIT 1)
        -
        (SELECT ph1.odometer FROM position_history ph1
          WHERE ph1.vehicle_id = v.id
            AND ph1.recorded_at BETWEEN p_from AND p_to
          ORDER BY ph1.recorded_at ASC LIMIT 1),
        0
      )
    )::float8 AS km_total,
    COUNT(DISTINCT t.id)::bigint AS trips_count,
    AVG(ph.speed) FILTER (WHERE ph.speed > 2)::float4 AS avg_speed,
    MAX(ph.speed)::float4 AS max_speed
  FROM vehicles v
  LEFT JOIN position_history ph ON ph.vehicle_id = v.id
    AND ph.recorded_at BETWEEN p_from AND p_to
  LEFT JOIN trips t ON t.vehicle_id = v.id
    AND t.started_at BETWEEN p_from AND p_to
    AND t.is_complete = true
  WHERE v.company_id = p_company_id
    AND v.deleted_at IS NULL
  GROUP BY v.id, v.economic_num, v.plates
  ORDER BY km_total DESC;
END;
$$;

-- ------------------------------------------------------------
-- FUNCIÓN: Resumen de alertas por tipo en un período
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_alert_summary(
  p_company_id uuid,
  p_from       timestamptz DEFAULT now() - interval '7 days',
  p_to         timestamptz DEFAULT now()
) RETURNS TABLE (
  alert_type   text,
  count        bigint,
  critical     bigint,
  high         bigint,
  medium       bigint,
  low          bigint
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    type::text,
    COUNT(*)                                              AS count,
    COUNT(*) FILTER (WHERE severity = 'critical')        AS critical,
    COUNT(*) FILTER (WHERE severity = 'high')            AS high,
    COUNT(*) FILTER (WHERE severity = 'medium')          AS medium,
    COUNT(*) FILTER (WHERE severity = 'low')             AS low
  FROM alerts
  WHERE company_id    = p_company_id
    AND created_at BETWEEN p_from AND p_to
  GROUP BY type
  ORDER BY count DESC;
$$;

-- ------------------------------------------------------------
-- FUNCIÓN: Mantenimientos vencidos o próximos
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_upcoming_maintenance(
  p_company_id uuid,
  p_days_ahead int DEFAULT 30
) RETURNS TABLE (
  vehicle_id         uuid,
  economic_num       text,
  plates             text,
  maintenance_type   text,
  description        text,
  next_service_date  date,
  next_odometer      float8,
  current_odometer   float8,
  km_remaining       float8,
  days_remaining     int,
  is_overdue         boolean
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    v.id,
    v.economic_num,
    v.plates,
    mr.type::text,
    mr.description,
    mr.next_service_date,
    mr.next_odometer,
    vp.odometer AS current_odometer,
    GREATEST(0, mr.next_odometer - COALESCE(vp.odometer, 0)) AS km_remaining,
    (mr.next_service_date - CURRENT_DATE)::int AS days_remaining,
    (mr.next_service_date < CURRENT_DATE OR
     (mr.next_odometer IS NOT NULL AND
      COALESCE(vp.odometer, 0) >= mr.next_odometer)) AS is_overdue
  FROM maintenance_records mr
  JOIN vehicles v ON v.id = mr.vehicle_id
  LEFT JOIN vehicle_positions vp ON vp.vehicle_id = v.id
  WHERE mr.company_id = p_company_id
    AND (
      (mr.next_service_date IS NOT NULL AND
       mr.next_service_date <= CURRENT_DATE + p_days_ahead)
      OR
      (mr.next_odometer IS NOT NULL AND
       COALESCE(vp.odometer, 0) >= mr.next_odometer - 1000)
    )
  ORDER BY
    is_overdue DESC,
    days_remaining ASC NULLS LAST;
$$;
