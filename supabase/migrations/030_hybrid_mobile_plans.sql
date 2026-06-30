-- ============================================================
-- 030_hybrid_mobile_plans.sql
-- Modelo C: GPS hardware y móvil con límites independientes
-- ============================================================

ALTER TYPE plan_type ADD VALUE IF NOT EXISTS 'personal_mobile';
ALTER TYPE plan_type ADD VALUE IF NOT EXISTS 'familia_mobile';

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS max_mobile_devices int NOT NULL DEFAULT 0;

UPDATE plans SET max_mobile_devices = 0, features = features || '{"hardware_gps":true}'::jsonb
  WHERE type = 'basico';

UPDATE plans SET max_mobile_devices = 5, features = features || '{"hardware_gps":true,"mobile_addon_included":5}'::jsonb
  WHERE type = 'profesional';

UPDATE plans SET max_mobile_devices = 25, features = features || '{"hardware_gps":true,"mobile_addon_included":25}'::jsonb
  WHERE type = 'empresarial';

INSERT INTO plans (name, type, max_vehicles, max_users, max_mobile_devices, price_monthly, price_yearly, features, is_active)
SELECT
  'Personal Mobile',
  'personal_mobile',
  0,
  2,
  1,
  129,
  1290,
  '{"realtime_map":true,"route_history_days":30,"alerts":true,"geofences":true,"reports":false,"maintenance":false,"mobile_app":true,"hardware_gps":false,"ai_assistant":false,"api_access":false,"white_label":false}'::jsonb,
  true
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE type = 'personal_mobile');

INSERT INTO plans (name, type, max_vehicles, max_users, max_mobile_devices, price_monthly, price_yearly, features, is_active)
SELECT
  'Familia Mobile',
  'familia_mobile',
  0,
  5,
  5,
  249,
  2490,
  '{"realtime_map":true,"route_history_days":30,"alerts":true,"geofences":true,"reports":false,"maintenance":false,"mobile_app":true,"hardware_gps":false,"ai_assistant":false,"api_access":false,"white_label":false}'::jsonb,
  true
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE type = 'familia_mobile');

CREATE OR REPLACE FUNCTION get_company_usage(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan record;
  v_hardware_count int;
  v_mobile_count int;
  v_fleet_vehicle_count int;
  v_user_count int;
  v_max_vehicles int;
  v_max_mobile int;
BEGIN
  SELECT p.max_vehicles, p.max_users, p.max_mobile_devices, p.features
  INTO v_plan
  FROM subscriptions s
  JOIN plans p ON p.id = s.plan_id
  WHERE s.company_id = p_company_id
  ORDER BY s.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_plan IS NULL THEN
    SELECT p.max_vehicles, p.max_users, p.max_mobile_devices, p.features
    INTO v_plan
    FROM companies c
    JOIN plans p ON p.id = c.plan_id
    WHERE c.id = p_company_id;
  END IF;

  SELECT COUNT(*) INTO v_hardware_count
  FROM gps_devices
  WHERE company_id = p_company_id AND source_type = 'hardware';

  SELECT COUNT(*) INTO v_mobile_count
  FROM gps_devices
  WHERE company_id = p_company_id AND source_type = 'mobile';

  SELECT COUNT(*) INTO v_fleet_vehicle_count
  FROM vehicles v
  LEFT JOIN gps_devices d ON d.id = v.device_id
  WHERE v.company_id = p_company_id
    AND v.deleted_at IS NULL
    AND (d.id IS NULL OR d.source_type = 'hardware');

  SELECT COUNT(*) INTO v_user_count
  FROM users
  WHERE company_id = p_company_id AND is_active = true;

  v_max_vehicles := COALESCE(v_plan.max_vehicles, 10);
  v_max_mobile := COALESCE(v_plan.max_mobile_devices, 0);

  RETURN jsonb_build_object(
    'vehicles', jsonb_build_object(
      'current', GREATEST(v_hardware_count, v_fleet_vehicle_count),
      'max', v_max_vehicles,
      'hardware_devices', v_hardware_count,
      'fleet_vehicles', v_fleet_vehicle_count
    ),
    'mobile_devices', jsonb_build_object(
      'current', v_mobile_count,
      'max', v_max_mobile
    ),
    'users', jsonb_build_object(
      'current', v_user_count,
      'max', COALESCE(v_plan.max_users, 5)
    ),
    'features', COALESCE(v_plan.features, '{}'::jsonb),
    'at_vehicle_limit', GREATEST(v_hardware_count, v_fleet_vehicle_count) >= v_max_vehicles AND v_max_vehicles > 0
      OR (v_max_vehicles = 0 AND v_hardware_count > 0),
    'at_mobile_limit', v_mobile_count >= v_max_mobile AND v_max_mobile >= 0
      AND COALESCE((v_plan.features->>'mobile_app')::boolean, false),
    'at_user_limit', v_user_count >= COALESCE(v_plan.max_users, 5),
    'mobile_only_plan', v_max_vehicles = 0 AND v_max_mobile > 0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_company_usage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_company_usage(uuid) TO service_role;
