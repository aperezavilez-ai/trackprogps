-- ============================================================
-- SEED: Datos de demostración para desarrollo
-- Ejecutar DESPUÉS de todas las migraciones
-- ============================================================

-- -----------------------------------------------
-- 1. Empresa de demo
-- -----------------------------------------------
INSERT INTO companies (id, name, rfc, email, phone, plan_id, status, settings)
SELECT
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'Transportes Demo S.A. de C.V.',
  'TDE210101ABC',
  'admin@transportesdemo.mx',
  '+52 55 5555 5555',
  id,
  'active',
  '{"notification_email":"alertas@transportesdemo.mx","whatsapp_phone":"+525555555555"}'
FROM plans WHERE type = 'profesional' LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------
-- 2. Suscripción activa
-- -----------------------------------------------
INSERT INTO subscriptions (company_id, plan_id, status, current_period_start, current_period_end)
SELECT
  'a0000000-0000-0000-0000-000000000001'::uuid,
  id,
  'active',
  now(),
  now() + interval '1 year'
FROM plans WHERE type = 'profesional' LIMIT 1
ON CONFLICT (company_id) DO NOTHING;

-- -----------------------------------------------
-- 3. Dispositivos GPS de demo
-- -----------------------------------------------
INSERT INTO gps_devices (id, company_id, imei, model, firmware_ver, status)
VALUES
  ('d1000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, '123456789012345', 'FMC920', '03.27.07.Rev.07', 'online'),
  ('d1000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, '123456789012346', 'FMC920', '03.27.07.Rev.07', 'offline'),
  ('d1000000-0000-0000-0000-000000000003'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, '123456789012347', 'FMB140', '03.28.02.Rev.00', 'online'),
  ('d1000000-0000-0000-0000-000000000004'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, '123456789012348', 'FMC920', '03.27.07.Rev.07', 'online'),
  ('d1000000-0000-0000-0000-000000000005'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, '123456789012349', 'FMC003', '02.25.00.Rev.01', 'no_signal')
ON CONFLICT (imei) DO NOTHING;

-- -----------------------------------------------
-- 4. Choferes de demo
-- -----------------------------------------------
INSERT INTO drivers (id, company_id, full_name, phone, email, license_num, license_exp)
VALUES
  ('c1000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'Juan Carlos García López', '+52 55 1111 1111', 'juan.garcia@demo.mx', 'MX-2021-001234', '2026-06-15'),
  ('c1000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'María Fernanda Rodríguez', '+52 55 2222 2222', 'mf.rodriguez@demo.mx', 'MX-2020-005678', '2025-12-31'),
  ('c1000000-0000-0000-0000-000000000003'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'Roberto Mendoza Cruz', '+52 55 3333 3333', null, 'MX-2019-009012', '2027-03-20'),
  ('c1000000-0000-0000-0000-000000000004'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'Ana Lucía Pérez Vega', '+52 55 4444 4444', 'alperez@demo.mx', 'MX-2022-003456', '2028-09-10')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------
-- 5. Vehículos de demo
-- -----------------------------------------------
INSERT INTO vehicles (id, company_id, device_id, driver_id, economic_num, plates, brand, model, year, type, color, max_speed)
VALUES
  ('v1000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'd1000000-0000-0000-0000-000000000001'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'ECO-001', 'ABC-123-X', 'Kenworth', 'T680', 2022, 'truck', 'Blanco', 100),
  ('v1000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'd1000000-0000-0000-0000-000000000002'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, 'ECO-002', 'DEF-456-X', 'Freightliner', 'Cascadia', 2021, 'truck', 'Gris', 100),
  ('v1000000-0000-0000-0000-000000000003'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'd1000000-0000-0000-0000-000000000003'::uuid, 'c1000000-0000-0000-0000-000000000003'::uuid, 'ECO-003', 'GHI-789-X', 'Sprinter', 'Mercedes', 2023, 'van', 'Blanco', 120),
  ('v1000000-0000-0000-0000-000000000004'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'd1000000-0000-0000-0000-000000000004'::uuid, 'c1000000-0000-0000-0000-000000000004'::uuid, 'ECO-004', 'JKL-012-X', 'Toyota', 'Hilux', 2022, 'pickup', 'Negro', 130),
  ('v1000000-0000-0000-0000-000000000005'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'd1000000-0000-0000-0000-000000000005'::uuid, null, 'ECO-005', 'MNO-345-X', 'Volkswagen', 'Crafter', 2020, 'van', 'Blanco', 120)
ON CONFLICT DO NOTHING;

-- -----------------------------------------------
-- 6. Posiciones actuales de demo (CDMX área)
-- -----------------------------------------------
INSERT INTO vehicle_positions (vehicle_id, company_id, device_id, lat, lng, speed, heading, ignition, odometer, gsm_signal, recorded_at)
VALUES
  ('v1000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'd1000000-0000-0000-0000-000000000001'::uuid, 19.4326, -99.1332, 65.5, 90,  true,  245000, 4, now() - interval '30 seconds'),
  ('v1000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'd1000000-0000-0000-0000-000000000002'::uuid, 19.4450, -99.1456, 0,    0,   false, 189500, 0, now() - interval '2 hours'),
  ('v1000000-0000-0000-0000-000000000003'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'd1000000-0000-0000-0000-000000000003'::uuid, 19.4268, -99.1700, 42.0, 270, true,  87300,  3, now() - interval '1 minute'),
  ('v1000000-0000-0000-0000-000000000004'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'd1000000-0000-0000-0000-000000000004'::uuid, 19.3960, -99.0900, 0,    0,   true,  34200,  4, now() - interval '45 seconds'),
  ('v1000000-0000-0000-0000-000000000005'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'd1000000-0000-0000-0000-000000000005'::uuid, 19.4100, -99.1600, 0,    180, false, 62100,  0, now() - interval '15 minutes')
ON CONFLICT (vehicle_id) DO UPDATE SET
  lat = EXCLUDED.lat, lng = EXCLUDED.lng, speed = EXCLUDED.speed,
  heading = EXCLUDED.heading, ignition = EXCLUDED.ignition,
  recorded_at = EXCLUDED.recorded_at;

-- -----------------------------------------------
-- 7. Reglas de alerta por defecto
-- -----------------------------------------------
INSERT INTO alert_rules (company_id, type, name, is_active, config, channels)
VALUES
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'speed_excess', 'Exceso velocidad 100 km/h', true, '{"speed_limit":100}', ARRAY['platform','email']),
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'ignition_on',  'Motor encendido',           true, '{}',                 ARRAY['platform']),
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'ignition_off', 'Motor apagado',             true, '{}',                 ARRAY['platform']),
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'sos',          'Botón de pánico',           true, '{}',                 ARRAY['platform','email','whatsapp'])
ON CONFLICT DO NOTHING;

-- -----------------------------------------------
-- 8. Geocerca de demo
-- -----------------------------------------------
INSERT INTO geofences (company_id, name, type, geometry, radius_m, color, alert_on_enter, alert_on_exit, is_active)
VALUES
  (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'Bodega Central CDMX',
    'circular',
    ST_SetSRID(ST_MakePoint(-99.1332, 19.4326), 4326),
    500,
    '#3B82F6',
    true,
    true,
    true
  )
ON CONFLICT DO NOTHING;

-- -----------------------------------------------
-- 9. Alertas de demo
-- -----------------------------------------------
INSERT INTO alerts (company_id, vehicle_id, type, severity, title, message, speed, lat, lng, payload)
VALUES
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'v1000000-0000-0000-0000-000000000001'::uuid, 'speed_excess', 'high', 'Exceso de velocidad', 'ECO-001 detectado a 115 km/h (límite: 100)', 115, 19.4326, -99.1332, '{"speed_limit":100}'),
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'v1000000-0000-0000-0000-000000000003'::uuid, 'geofence_exit', 'medium', 'Salida de geocerca', 'ECO-003 salió de Bodega Central CDMX', null, 19.4268, -99.1700, '{}'),
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'v1000000-0000-0000-0000-000000000004'::uuid, 'ignition_on', 'low', 'Motor encendido', 'ECO-004 encendido', null, 19.3960, -99.0900, '{}')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------
-- 10. Registros de mantenimiento de demo
-- -----------------------------------------------
INSERT INTO maintenance_records (company_id, vehicle_id, type, description, cost, service_date, next_service_date, next_odometer, workshop, created_by)
SELECT
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'v1000000-0000-0000-0000-000000000001'::uuid,
  'oil_change',
  'Cambio de aceite 15W-40 y filtro',
  1800,
  now() - interval '60 days',
  now() + interval '30 days',
  250000,
  'Servicio Express Monterrey',
  id
FROM users WHERE company_id = 'a0000000-0000-0000-0000-000000000001'::uuid LIMIT 1
ON CONFLICT DO NOTHING;

SELECT 'Seed completado ✓' as result;
