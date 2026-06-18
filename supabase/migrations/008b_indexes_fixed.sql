-- 008b_indexes_fixed.sql — sin CONCURRENTLY (no puede correr en transacción)
CREATE INDEX IF NOT EXISTS idx_ph_company_vehicle_time ON position_history(company_id, vehicle_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_company_unack_time ON alerts(company_id, created_at DESC) WHERE acknowledged_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_alert_rules_company_type ON alert_rules(company_id, type, is_active);
CREATE INDEX IF NOT EXISTS idx_vehicles_search ON vehicles USING gin(to_tsvector('spanish', economic_num || ' ' || plates || ' ' || brand || ' ' || model));
CREATE INDEX IF NOT EXISTS idx_drivers_search ON drivers USING gin(to_tsvector('spanish', full_name || ' ' || license_num)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_trips_vehicle_complete ON trips(vehicle_id, started_at DESC) WHERE is_complete = true;
CREATE INDEX IF NOT EXISTS idx_maintenance_next_date ON maintenance_records(company_id, next_service_date ASC NULLS LAST) WHERE next_service_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_geofences_company_active ON geofences(company_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_subs_period_end ON subscriptions(current_period_end ASC) WHERE status IN ('active', 'trialing');
