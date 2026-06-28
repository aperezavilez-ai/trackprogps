-- Rendimiento de combustible por vehículo (km por litro)
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS fuel_efficiency_km_per_l numeric(6, 2)
  CHECK (fuel_efficiency_km_per_l IS NULL OR (fuel_efficiency_km_per_l >= 3 AND fuel_efficiency_km_per_l <= 50));

COMMENT ON COLUMN vehicles.fuel_efficiency_km_per_l IS
  'Rendimiento declarado km/L. NULL = estimar por tipo y año del vehículo.';
