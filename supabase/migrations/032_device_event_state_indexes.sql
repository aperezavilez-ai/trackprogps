-- ============================================================
-- 032_device_event_state_indexes.sql
-- Refuerzo de maquina de estados para alertas por vehiculo/regla
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_event_states_vehicle_rule_key_unique
  ON device_event_states(company_id, vehicle_id, rule_id, state_key)
  WHERE vehicle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_device_event_states_active
  ON device_event_states(company_id, state_key, last_evaluated_at DESC)
  WHERE (state_value->>'active') = 'true';
