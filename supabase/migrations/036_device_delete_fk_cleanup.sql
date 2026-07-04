-- Allow deleting GPS devices without losing vehicle position history.
-- Current and historical positions keep their rows and detach from the device.

ALTER TABLE vehicle_positions
  DROP CONSTRAINT IF EXISTS vehicle_positions_device_id_fkey;

ALTER TABLE vehicle_positions
  ADD CONSTRAINT vehicle_positions_device_id_fkey
  FOREIGN KEY (device_id)
  REFERENCES gps_devices(id)
  ON DELETE SET NULL;

ALTER TABLE position_history
  DROP CONSTRAINT IF EXISTS position_history_device_id_fkey;

ALTER TABLE position_history
  ADD CONSTRAINT position_history_device_id_fkey
  FOREIGN KEY (device_id)
  REFERENCES gps_devices(id)
  ON DELETE SET NULL;
