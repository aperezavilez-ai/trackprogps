-- ============================================================
-- 004_tracking_tables.sql
-- Posiciones GPS, geocercas y alertas
-- ============================================================

-- ------------------------------------------------------------
-- VEHICLE POSITIONS (posición actual - 1 fila por vehículo)
-- ------------------------------------------------------------
CREATE TABLE vehicle_positions (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id  uuid        NOT NULL UNIQUE REFERENCES vehicles(id) ON DELETE CASCADE,
  company_id  uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_id   uuid        REFERENCES gps_devices(id),
  lat         float8      NOT NULL,
  lng         float8      NOT NULL,
  speed       float4      NOT NULL DEFAULT 0,
  heading     int2        NOT NULL DEFAULT 0 CHECK (heading >= 0 AND heading <= 360),
  altitude    float4,
  ignition    boolean     NOT NULL DEFAULT false,
  odometer    float8      NOT NULL DEFAULT 0,
  gsm_signal  int2        NOT NULL DEFAULT 0,
  battery_lvl int2        NOT NULL DEFAULT 0,
  satellites  int2,
  raw_io      jsonb,
  recorded_at timestamptz NOT NULL,
  server_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vehicle_positions_company_id ON vehicle_positions(company_id);
-- For Supabase Realtime filter
CREATE INDEX idx_vehicle_positions_vehicle_id ON vehicle_positions(vehicle_id);

-- Enable Realtime on this table
ALTER PUBLICATION supabase_realtime ADD TABLE vehicle_positions;

-- ------------------------------------------------------------
-- POSITION HISTORY (historial completo)
-- Particionado por mes para escalabilidad
-- ------------------------------------------------------------
CREATE TABLE position_history (
  id          uuid        NOT NULL DEFAULT uuid_generate_v4(),
  vehicle_id  uuid        NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  company_id  uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_id   uuid        REFERENCES gps_devices(id),
  lat         float8      NOT NULL,
  lng         float8      NOT NULL,
  speed       float4      NOT NULL DEFAULT 0,
  heading     int2        NOT NULL DEFAULT 0,
  altitude    float4,
  ignition    boolean     NOT NULL DEFAULT false,
  odometer    float8      NOT NULL DEFAULT 0,
  gsm_signal  int2        NOT NULL DEFAULT 0,
  battery_lvl int2        NOT NULL DEFAULT 0,
  satellites  int2,
  raw_io      jsonb,
  recorded_at timestamptz NOT NULL,
  server_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- Create partitions for current and next months automatically
-- (handled by a cron job in production)
CREATE TABLE position_history_default
  PARTITION OF position_history DEFAULT;

CREATE INDEX idx_ph_vehicle_time ON position_history(vehicle_id, recorded_at DESC);
CREATE INDEX idx_ph_company_time ON position_history(company_id, recorded_at DESC);

-- ------------------------------------------------------------
-- TRIPS (viajes detectados automáticamente)
-- ------------------------------------------------------------
CREATE TABLE trips (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id    uuid        NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  company_id    uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  driver_id     uuid        REFERENCES drivers(id),
  started_at    timestamptz NOT NULL,
  ended_at      timestamptz,
  start_lat     float8      NOT NULL,
  start_lng     float8      NOT NULL,
  end_lat       float8,
  end_lng       float8,
  start_address text,
  end_address   text,
  distance_km   float8      NOT NULL DEFAULT 0,
  duration_min  int         NOT NULL DEFAULT 0,
  avg_speed     float4,
  max_speed     float4,
  is_complete   boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trips_vehicle_id ON trips(vehicle_id, started_at DESC);
CREATE INDEX idx_trips_company_id ON trips(company_id, started_at DESC);

-- ------------------------------------------------------------
-- GEOFENCES
-- ------------------------------------------------------------
CREATE TABLE geofences (
  id              uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      uuid          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            varchar(100)  NOT NULL,
  type            geofence_type NOT NULL,
  geometry        geometry(Geometry, 4326) NOT NULL,
  radius_m        float4,       -- only for circular
  color           varchar(7)    NOT NULL DEFAULT '#3B82F6',
  alert_on_enter  boolean       NOT NULL DEFAULT true,
  alert_on_exit   boolean       NOT NULL DEFAULT true,
  alert_on_dwell  boolean       NOT NULL DEFAULT false,
  dwell_minutes   int,
  schedule        jsonb,
  vehicle_ids     uuid[],       -- NULL = all vehicles
  is_active       boolean       NOT NULL DEFAULT true,
  created_by      uuid          REFERENCES users(id),
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_geofences_company_id ON geofences(company_id);
CREATE INDEX idx_geofences_geometry ON geofences USING GIST(geometry);

-- ------------------------------------------------------------
-- ALERT RULES
-- ------------------------------------------------------------
CREATE TABLE alert_rules (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type        alert_type  NOT NULL,
  name        varchar(100) NOT NULL,
  is_active   boolean     NOT NULL DEFAULT true,
  config      jsonb       NOT NULL DEFAULT '{}',
  vehicle_ids uuid[],     -- NULL = all vehicles
  channels    text[]      NOT NULL DEFAULT ARRAY['platform'],
  created_by  uuid        REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_alert_rules_company_id ON alert_rules(company_id);

-- ------------------------------------------------------------
-- ALERTS
-- ------------------------------------------------------------
CREATE TABLE alerts (
  id               uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id       uuid          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vehicle_id       uuid          NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  rule_id          uuid          REFERENCES alert_rules(id),
  geofence_id      uuid          REFERENCES geofences(id),
  type             alert_type    NOT NULL,
  severity         alert_severity NOT NULL DEFAULT 'medium',
  title            varchar(200)  NOT NULL,
  message          text          NOT NULL,
  lat              float8,
  lng              float8,
  speed            float4,
  payload          jsonb         NOT NULL DEFAULT '{}',
  channels_sent    text[]        NOT NULL DEFAULT ARRAY[]::text[],
  acknowledged_by  uuid          REFERENCES users(id),
  acknowledged_at  timestamptz,
  created_at       timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_company_id ON alerts(company_id, created_at DESC);
CREATE INDEX idx_alerts_vehicle_id ON alerts(vehicle_id);
CREATE INDEX idx_alerts_unack ON alerts(company_id, acknowledged_at) WHERE acknowledged_at IS NULL;

-- Enable Realtime for alerts
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
