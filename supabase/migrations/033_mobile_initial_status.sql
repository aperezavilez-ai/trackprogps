-- Mobile devices registered before sending their first telemetry packet should
-- appear disconnected instead of unknown.
UPDATE gps_devices
SET
  status = 'offline',
  updated_at = NOW()
WHERE source_type = 'mobile'
  AND status = 'unknown'
  AND last_seen IS NULL;
