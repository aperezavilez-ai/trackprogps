-- ============================================================
-- 027_mobile_tracking.sql
-- Dispositivos móviles como rastreadores GPS integrados
-- ============================================================

CREATE TYPE device_source_type AS ENUM ('hardware', 'mobile');
CREATE TYPE mobile_platform AS ENUM ('android', 'ios');

ALTER TABLE gps_devices
  ALTER COLUMN imei TYPE varchar(64);

ALTER TABLE gps_devices
  ADD COLUMN IF NOT EXISTS source_type device_source_type NOT NULL DEFAULT 'hardware',
  ADD COLUMN IF NOT EXISTS mobile_platform mobile_platform,
  ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mobile_device_uid varchar(64),
  ADD COLUMN IF NOT EXISTS tracking_interval_sec int NOT NULL DEFAULT 30
    CHECK (tracking_interval_sec BETWEEN 5 AND 3600),
  ADD COLUMN IF NOT EXISTS tracking_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS mobile_metadata jsonb NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX IF NOT EXISTS idx_gps_devices_mobile_uid
  ON gps_devices(mobile_device_uid)
  WHERE mobile_device_uid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gps_devices_source
  ON gps_devices(company_id, source_type, status);

-- Eventos móviles
CREATE TYPE mobile_event_type AS ENUM (
  'sos',
  'battery_low',
  'gps_disabled',
  'no_internet',
  'app_closed',
  'permissions_revoked',
  'mock_location',
  'root_detected',
  'jailbreak_detected',
  'geofence_enter',
  'geofence_exit',
  'movement_start',
  'movement_stop',
  'check_in',
  'check_out'
);

CREATE TABLE IF NOT EXISTS mobile_events (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_id   uuid NOT NULL REFERENCES gps_devices(id) ON DELETE CASCADE,
  vehicle_id  uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type  mobile_event_type NOT NULL,
  lat         double precision,
  lng         double precision,
  payload     jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mobile_events_device_time
  ON mobile_events(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mobile_events_company_time
  ON mobile_events(company_id, created_at DESC);

-- Sesiones móviles (cierre remoto)
CREATE TABLE IF NOT EXISTS mobile_sessions (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id    uuid NOT NULL REFERENCES gps_devices(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  revoked_at   timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mobile_sessions_device
  ON mobile_sessions(device_id, revoked_at);

-- Compartir ubicación temporal
CREATE TABLE IF NOT EXISTS mobile_location_shares (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_id   uuid NOT NULL REFERENCES gps_devices(id) ON DELETE CASCADE,
  vehicle_id  uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  created_by  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  varchar(64) NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mobile_shares_expires
  ON mobile_location_shares(expires_at)
  WHERE revoked_at IS NULL;

-- Evidencias de campo (check-in, foto, QR, etc.)
CREATE TABLE IF NOT EXISTS mobile_field_actions (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_id   uuid NOT NULL REFERENCES gps_devices(id) ON DELETE CASCADE,
  vehicle_id  uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  action_type varchar(32) NOT NULL,
  lat         double precision,
  lng         double precision,
  notes       text,
  media_url   text,
  metadata    jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mobile_field_actions_device
  ON mobile_field_actions(device_id, created_at DESC);

-- RLS
ALTER TABLE mobile_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobile_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobile_location_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobile_field_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY mobile_events_tenant ON mobile_events
  FOR SELECT USING (company_id = get_company_id());

CREATE POLICY mobile_events_insert_service ON mobile_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY mobile_sessions_tenant ON mobile_sessions
  FOR SELECT USING (
    device_id IN (SELECT id FROM gps_devices WHERE company_id = get_company_id())
  );

CREATE POLICY mobile_shares_tenant ON mobile_location_shares
  FOR ALL USING (company_id = get_company_id());

CREATE POLICY mobile_field_actions_tenant ON mobile_field_actions
  FOR SELECT USING (company_id = get_company_id());

COMMENT ON COLUMN gps_devices.source_type IS 'hardware = GPS físico; mobile = teléfono Android/iOS';
