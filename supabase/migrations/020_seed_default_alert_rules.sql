-- Reglas de alerta por defecto para empresas sin ninguna regla
INSERT INTO alert_rules (company_id, type, name, is_active, config, channels)
SELECT
  c.id,
  r.type::alert_type,
  r.name,
  true,
  r.config::jsonb,
  r.channels
FROM companies c
CROSS JOIN (
  VALUES
    ('speed_excess', 'Exceso de velocidad (100 km/h)', '{"speed_limit":100}', ARRAY['platform','email']::text[]),
    ('ignition_on', 'Motor encendido', '{}', ARRAY['platform']::text[]),
    ('ignition_off', 'Motor apagado', '{}', ARRAY['platform']::text[]),
    ('unauthorized_movement', 'Movimiento no autorizado', '{}', ARRAY['platform','email']::text[])
) AS r(type, name, config, channels)
WHERE NOT EXISTS (
  SELECT 1 FROM alert_rules ar WHERE ar.company_id = c.id
);
