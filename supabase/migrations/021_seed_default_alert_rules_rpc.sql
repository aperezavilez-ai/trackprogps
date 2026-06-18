-- Reglas de alerta por defecto al registrar empresa (idempotente)
CREATE OR REPLACE FUNCTION seed_default_alert_rules(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM alert_rules WHERE company_id = p_company_id LIMIT 1) THEN
    RETURN;
  END IF;

  INSERT INTO alert_rules (company_id, type, name, is_active, config, channels) VALUES
    (p_company_id, 'speed_excess', 'Exceso de velocidad (100 km/h)', true, '{"speed_limit":100}'::jsonb, ARRAY['platform','email']::text[]),
    (p_company_id, 'ignition_on', 'Motor encendido', true, '{}'::jsonb, ARRAY['platform']::text[]),
    (p_company_id, 'ignition_off', 'Motor apagado', true, '{}'::jsonb, ARRAY['platform']::text[]),
    (p_company_id, 'unauthorized_movement', 'Movimiento no autorizado', true, '{}'::jsonb, ARRAY['platform','email']::text[]);
END;
$$;
