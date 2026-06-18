-- === 001_extensions.sql ===
-- ============================================================
-- 001_extensions.sql
-- Habilitar extensiones necesarias
-- ============================================================

-- UUID v4 generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PostGIS para geocercas geoespaciales
CREATE EXTENSION IF NOT EXISTS "postgis";

-- pgcrypto para hashes
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Para bÃºsqueda de texto completo
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM (
  'super_admin',
  'admin_empresa',
  'supervisor',
  'operador',
  'cliente_consulta'
);

CREATE TYPE company_status AS ENUM (
  'active',
  'suspended',
  'trial',
  'cancelled'
);

CREATE TYPE plan_type AS ENUM (
  'basico',
  'profesional',
  'empresarial'
);

CREATE TYPE vehicle_status AS ENUM (
  'active',
  'inactive',
  'maintenance'
);

CREATE TYPE vehicle_type AS ENUM (
  'sedan', 'suv', 'pickup', 'van',
  'truck', 'bus', 'motorcycle', 'other'
);

CREATE TYPE device_status AS ENUM (
  'online', 'offline', 'no_signal', 'unknown'
);

CREATE TYPE geofence_type AS ENUM (
  'circular', 'polygon'
);

CREATE TYPE alert_type AS ENUM (
  'speed_excess',
  'gps_disconnect',
  'signal_loss',
  'power_cut',
  'unauthorized_movement',
  'geofence_enter',
  'geofence_exit',
  'geofence_dwell',
  'sos',
  'maintenance_due',
  'ignition_on',
  'ignition_off',
  'battery_low'
);

CREATE TYPE alert_severity AS ENUM (
  'low', 'medium', 'high', 'critical'
);

CREATE TYPE maintenance_type AS ENUM (
  'oil_change', 'tire_rotation', 'brake_service',
  'tune_up', 'insurance', 'verification', 'other'
);

CREATE TYPE subscription_status AS ENUM (
  'active', 'past_due', 'cancelled', 'trialing'
);


-- === 002_core_tables.sql ===
-- ============================================================
-- 002_core_tables.sql
-- Tablas principales: planes, empresas, usuarios
-- ============================================================

-- ------------------------------------------------------------
-- PLANS
-- ------------------------------------------------------------
CREATE TABLE plans (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          varchar(100) NOT NULL,
  type          plan_type    NOT NULL,
  max_vehicles  int          NOT NULL DEFAULT 10,
  max_users     int          NOT NULL DEFAULT 5,
  price_monthly numeric(10,2) NOT NULL DEFAULT 0,
  price_yearly  numeric(10,2) NOT NULL DEFAULT 0,
  features      jsonb        NOT NULL DEFAULT '{}',
  is_active     boolean      NOT NULL DEFAULT true,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now()
);

-- Default plans
INSERT INTO plans (name, type, max_vehicles, max_users, price_monthly, price_yearly, features) VALUES
('BÃ¡sico',       'basico',       10,   3,   299,  2990,  '{"realtime_map":true,"route_history_days":30,"alerts":true,"geofences":true,"reports":false,"maintenance":false,"mobile_app":false,"ai_assistant":false,"api_access":false,"white_label":false}'),
('Profesional',  'profesional',  50,   10,  799,  7990,  '{"realtime_map":true,"route_history_days":90,"alerts":true,"geofences":true,"reports":true,"maintenance":true,"mobile_app":true,"ai_assistant":false,"api_access":false,"white_label":false}'),
('Empresarial',  'empresarial',  999,  999, 2499, 24990, '{"realtime_map":true,"route_history_days":365,"alerts":true,"geofences":true,"reports":true,"maintenance":true,"mobile_app":true,"ai_assistant":true,"api_access":true,"white_label":true}');

-- ------------------------------------------------------------
-- COMPANIES
-- ------------------------------------------------------------
CREATE TABLE companies (
  id              uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            varchar(150) NOT NULL,
  rfc             varchar(15),
  phone           varchar(20),
  email           varchar(255) NOT NULL,
  address         text,
  logo_url        text,
  plan_id         uuid         NOT NULL REFERENCES plans(id),
  status          company_status NOT NULL DEFAULT 'trial',
  trial_ends_at   timestamptz,
  settings        jsonb        NOT NULL DEFAULT '{}',
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX idx_companies_status ON companies(status);
CREATE INDEX idx_companies_plan_id ON companies(plan_id);

-- ------------------------------------------------------------
-- USERS (extends auth.users)
-- ------------------------------------------------------------
CREATE TABLE users (
  id              uuid         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id      uuid         REFERENCES companies(id) ON DELETE CASCADE,
  email           varchar(255) NOT NULL,
  full_name       varchar(150) NOT NULL,
  role            user_role    NOT NULL DEFAULT 'operador',
  phone           varchar(20),
  avatar_url      text,
  is_active       boolean      NOT NULL DEFAULT true,
  last_sign_in_at timestamptz,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now(),
  -- Super admins have company_id = NULL
  CONSTRAINT chk_user_company CHECK (
    role = 'super_admin' OR company_id IS NOT NULL
  )
);

CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Trigger: sync email on auth user update
CREATE OR REPLACE FUNCTION sync_user_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE users SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_email_change
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sync_user_email();

-- Trigger: auto-create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO users (id, email, full_name, role, company_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'operador'),
    (NEW.raw_user_meta_data->>'company_id')::uuid
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ------------------------------------------------------------
-- SUBSCRIPTIONS
-- ------------------------------------------------------------
CREATE TABLE subscriptions (
  id                      uuid             PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id              uuid             NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  plan_id                 uuid             NOT NULL REFERENCES plans(id),
  status                  subscription_status NOT NULL DEFAULT 'trialing',
  current_period_start    timestamptz      NOT NULL DEFAULT now(),
  current_period_end      timestamptz      NOT NULL DEFAULT (now() + interval '30 days'),
  stripe_subscription_id  varchar(100),
  stripe_customer_id      varchar(100),
  conekta_order_id        varchar(100),
  cancel_at_period_end    boolean          NOT NULL DEFAULT false,
  created_at              timestamptz      NOT NULL DEFAULT now(),
  updated_at              timestamptz      NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_company_id ON subscriptions(company_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_period_end ON subscriptions(current_period_end);

-- ------------------------------------------------------------
-- AUDIT LOG
-- ------------------------------------------------------------
CREATE TABLE audit_logs (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  uuid        REFERENCES companies(id),
  user_id     uuid        REFERENCES users(id),
  action      varchar(100) NOT NULL,
  table_name  varchar(100),
  record_id   uuid,
  old_values  jsonb,
  new_values  jsonb,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_company_id ON audit_logs(company_id);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at DESC);


-- === 003_fleet_tables.sql ===
-- ============================================================
-- 003_fleet_tables.sql
-- VehÃ­culos, choferes y dispositivos GPS
-- ============================================================

-- ------------------------------------------------------------
-- GPS DEVICES
-- ------------------------------------------------------------
CREATE TABLE gps_devices (
  id           uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   uuid         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  imei         varchar(20)  NOT NULL UNIQUE,
  model        varchar(50)  NOT NULL DEFAULT 'FMC920',
  firmware_ver varchar(20),
  sim_iccid    varchar(30),
  phone_num    varchar(20),
  last_seen    timestamptz,
  status       device_status NOT NULL DEFAULT 'unknown',
  created_at   timestamptz  NOT NULL DEFAULT now(),
  updated_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX idx_gps_devices_company_id ON gps_devices(company_id);
CREATE INDEX idx_gps_devices_imei ON gps_devices(imei);
CREATE INDEX idx_gps_devices_status ON gps_devices(status);

-- ------------------------------------------------------------
-- DRIVERS
-- ------------------------------------------------------------
CREATE TABLE drivers (
  id           uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   uuid         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  full_name    varchar(150) NOT NULL,
  phone        varchar(20),
  email        varchar(255),
  license_num  varchar(30)  NOT NULL,
  license_exp  date         NOT NULL,
  photo_url    text,
  is_active    boolean      NOT NULL DEFAULT true,
  notes        text,
  created_at   timestamptz  NOT NULL DEFAULT now(),
  updated_at   timestamptz  NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

CREATE INDEX idx_drivers_company_id ON drivers(company_id);
CREATE INDEX idx_drivers_active ON drivers(company_id, is_active) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- VEHICLES
-- ------------------------------------------------------------
CREATE TABLE vehicles (
  id               uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id       uuid          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_id        uuid          UNIQUE REFERENCES gps_devices(id) ON DELETE SET NULL,
  driver_id        uuid          REFERENCES drivers(id) ON DELETE SET NULL,
  economic_num     varchar(20)   NOT NULL,
  plates           varchar(15)   NOT NULL,
  brand            varchar(60)   NOT NULL,
  model            varchar(60)   NOT NULL,
  year             smallint      NOT NULL CHECK (year >= 1900 AND year <= 2100),
  vin              varchar(17),
  type             vehicle_type  NOT NULL DEFAULT 'other',
  color            varchar(30),
  status           vehicle_status NOT NULL DEFAULT 'active',
  odometer_offset  float8        NOT NULL DEFAULT 0,
  max_speed        int           NOT NULL DEFAULT 120, -- km/h limit for alerts
  notes            text,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  UNIQUE(company_id, economic_num),
  UNIQUE(company_id, plates)
);

CREATE INDEX idx_vehicles_company_id ON vehicles(company_id);
CREATE INDEX idx_vehicles_device_id ON vehicles(device_id);
CREATE INDEX idx_vehicles_driver_id ON vehicles(driver_id);
CREATE INDEX idx_vehicles_active ON vehicles(company_id, status) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- VEHICLE-DRIVER HISTORY
-- ------------------------------------------------------------
CREATE TABLE vehicle_driver_history (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id  uuid        NOT NULL REFERENCES vehicles(id),
  driver_id   uuid        NOT NULL REFERENCES drivers(id),
  company_id  uuid        NOT NULL REFERENCES companies(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  unassigned_at timestamptz,
  assigned_by uuid        REFERENCES users(id)
);

CREATE INDEX idx_vdh_vehicle_id ON vehicle_driver_history(vehicle_id);
CREATE INDEX idx_vdh_driver_id ON vehicle_driver_history(driver_id);


-- === 004_tracking_tables.sql ===
-- ============================================================
-- 004_tracking_tables.sql
-- Posiciones GPS, geocercas y alertas
-- ============================================================

-- ------------------------------------------------------------
-- VEHICLE POSITIONS (posiciÃ³n actual - 1 fila por vehÃ­culo)
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
-- TRIPS (viajes detectados automÃ¡ticamente)
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


-- === 005_maintenance_and_rls.sql ===
-- ============================================================
-- 005_maintenance_and_rls.sql
-- Mantenimiento vehicular y Row Level Security
-- ============================================================

-- ------------------------------------------------------------
-- MAINTENANCE RECORDS
-- ------------------------------------------------------------
CREATE TABLE maintenance_records (
  id                uuid              PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id        uuid              NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vehicle_id        uuid              NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  type              maintenance_type  NOT NULL,
  description       text              NOT NULL,
  cost              numeric(10,2),
  currency          varchar(3)        NOT NULL DEFAULT 'MXN',
  odometer_at       float8,
  next_odometer     float8,
  service_date      date              NOT NULL,
  next_service_date date,
  workshop          varchar(150),
  notes             text,
  attachments       text[]            NOT NULL DEFAULT ARRAY[]::text[],
  created_by        uuid              NOT NULL REFERENCES users(id),
  created_at        timestamptz       NOT NULL DEFAULT now()
);

CREATE INDEX idx_maintenance_company_id ON maintenance_records(company_id);
CREATE INDEX idx_maintenance_vehicle_id ON maintenance_records(vehicle_id);

-- ------------------------------------------------------------
-- MAINTENANCE ALERTS (upcoming)
-- ------------------------------------------------------------
CREATE TABLE maintenance_alerts (
  id                uuid             PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id        uuid             NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vehicle_id        uuid             NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  type              maintenance_type NOT NULL,
  description       varchar(200)     NOT NULL,
  due_date          date,
  due_odometer      float8,
  due_hours         float8,
  is_acknowledged   boolean          NOT NULL DEFAULT false,
  acknowledged_by   uuid             REFERENCES users(id),
  acknowledged_at   timestamptz,
  created_at        timestamptz      NOT NULL DEFAULT now()
);

CREATE INDEX idx_ma_company_id ON maintenance_alerts(company_id);
CREATE INDEX idx_ma_vehicle_id ON maintenance_alerts(vehicle_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Strategy: company_id isolation for all tenant data
-- super_admin bypasses all RLS via service_role key
-- ============================================================

-- Helper function to get current user's company_id
CREATE OR REPLACE FUNCTION auth.company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT company_id FROM users WHERE id = auth.uid()
$$;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM users WHERE id = auth.uid()
$$;

-- Helper: check if current user is super_admin
CREATE OR REPLACE FUNCTION auth.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role = 'super_admin' FROM users WHERE id = auth.uid()
$$;

-- Enable RLS on all tables
ALTER TABLE companies             ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_devices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_driver_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_positions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_history      ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofences             ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules           ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records   ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_alerts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------
-- COMPANIES policies
-- -----------------------------------------------
CREATE POLICY "companies_select" ON companies
  FOR SELECT USING (
    auth.is_super_admin() OR id = auth.company_id()
  );

CREATE POLICY "companies_insert" ON companies
  FOR INSERT WITH CHECK (auth.is_super_admin());

CREATE POLICY "companies_update" ON companies
  FOR UPDATE USING (
    auth.is_super_admin() OR (
      id = auth.company_id() AND auth.user_role() = 'admin_empresa'
    )
  );

-- -----------------------------------------------
-- USERS policies
-- -----------------------------------------------
CREATE POLICY "users_select" ON users
  FOR SELECT USING (
    auth.is_super_admin() OR
    id = auth.uid() OR
    company_id = auth.company_id()
  );

CREATE POLICY "users_insert" ON users
  FOR INSERT WITH CHECK (
    auth.is_super_admin() OR (
      company_id = auth.company_id() AND
      auth.user_role() IN ('admin_empresa', 'supervisor')
    )
  );

CREATE POLICY "users_update" ON users
  FOR UPDATE USING (
    auth.is_super_admin() OR
    id = auth.uid() OR
    (company_id = auth.company_id() AND auth.user_role() = 'admin_empresa')
  );

-- -----------------------------------------------
-- Macro: tenant isolation policy factory
-- Applies same pattern to most tenant tables
-- -----------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gps_devices', 'drivers', 'vehicles', 'vehicle_driver_history',
    'vehicle_positions', 'position_history', 'trips',
    'geofences', 'alert_rules', 'alerts',
    'maintenance_records', 'maintenance_alerts',
    'subscriptions'
  ] LOOP
    EXECUTE format('
      CREATE POLICY "%s_tenant_select" ON %s
        FOR SELECT USING (
          auth.is_super_admin() OR company_id = auth.company_id()
        );
      CREATE POLICY "%s_tenant_insert" ON %s
        FOR INSERT WITH CHECK (
          auth.is_super_admin() OR company_id = auth.company_id()
        );
      CREATE POLICY "%s_tenant_update" ON %s
        FOR UPDATE USING (
          auth.is_super_admin() OR company_id = auth.company_id()
        );
      CREATE POLICY "%s_tenant_delete" ON %s
        FOR DELETE USING (
          auth.is_super_admin() OR company_id = auth.company_id()
        );
    ', t, t, t, t, t, t, t, t);
  END LOOP;
END $$;

-- -----------------------------------------------
-- AUDIT LOGS policy
-- -----------------------------------------------
CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT USING (
    auth.is_super_admin() OR company_id = auth.company_id()
  );

CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT WITH CHECK (true); -- triggers insert freely

-- ============================================================
-- UPDATED_AT trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply to all tables with updated_at
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'companies', 'users', 'plans', 'subscriptions',
    'gps_devices', 'drivers', 'vehicles',
    'geofences', 'alert_rules', 'maintenance_records'
  ] LOOP
    EXECUTE format('
      CREATE TRIGGER set_%s_updated_at
        BEFORE UPDATE ON %s
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    ', t, t);
  END LOOP;
END $$;


-- === 006_geofence_functions.sql ===
-- ============================================================
-- 006_geofence_functions.sql
-- PostGIS functions for geofence event detection
-- ============================================================

-- Function: check if a point is inside a geofence
CREATE OR REPLACE FUNCTION is_inside_geofence(
  p_lat      float8,
  p_lng      float8,
  p_fence_id uuid
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_point    geometry;
  v_fence    geometry;
  v_type     geofence_type;
  v_radius   float4;
BEGIN
  v_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326);

  SELECT geometry, type, radius_m
  INTO v_fence, v_type, v_radius
  FROM geofences
  WHERE id = p_fence_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_type = 'circular' THEN
    -- For circular: check distance in meters
    RETURN ST_Distance(
      ST_Transform(v_point, 3857),
      ST_Transform(v_fence, 3857)
    ) <= v_radius;
  ELSE
    -- For polygon: check point in polygon
    RETURN ST_Within(v_point, v_fence);
  END IF;
END;
$$;

-- Function: detect geofence entry/exit events
-- Returns 'enter', 'exit', or 'none'
CREATE OR REPLACE FUNCTION check_geofence_event(
  p_vehicle_id  uuid,
  p_geofence_id uuid,
  p_lat         float8,
  p_lng         float8
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_currently_inside boolean;
  v_was_inside       boolean;
  v_last_position    record;
BEGIN
  -- Check if vehicle is currently inside the geofence
  v_currently_inside := is_inside_geofence(p_lat, p_lng, p_geofence_id);

  -- Get previous position
  SELECT lat, lng
  INTO v_last_position
  FROM position_history
  WHERE vehicle_id = p_vehicle_id
  ORDER BY recorded_at DESC
  OFFSET 1 LIMIT 1;

  IF NOT FOUND THEN
    RETURN 'none';
  END IF;

  -- Check if was previously inside
  v_was_inside := is_inside_geofence(
    v_last_position.lat,
    v_last_position.lng,
    p_geofence_id
  );

  IF v_currently_inside AND NOT v_was_inside THEN
    RETURN 'enter';
  ELSIF NOT v_currently_inside AND v_was_inside THEN
    RETURN 'exit';
  ELSE
    RETURN 'none';
  END IF;
END;
$$;

-- Function: get all geofence events for a position update
CREATE OR REPLACE FUNCTION get_geofence_events(
  p_company_id uuid,
  p_vehicle_id uuid,
  p_lat        float8,
  p_lng        float8
) RETURNS TABLE (
  geofence_id   uuid,
  geofence_name text,
  event_type    text,
  alert_on_enter boolean,
  alert_on_exit  boolean
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.id             AS geofence_id,
    g.name           AS geofence_name,
    check_geofence_event(p_vehicle_id, g.id, p_lat, p_lng) AS event_type,
    g.alert_on_enter,
    g.alert_on_exit
  FROM geofences g
  WHERE g.company_id = p_company_id
    AND g.is_active = true
    AND (g.vehicle_ids IS NULL OR p_vehicle_id = ANY(g.vehicle_ids))
    AND check_geofence_event(p_vehicle_id, g.id, p_lat, p_lng) != 'none';
END;
$$;

-- ============================================================
-- PARTITION MANAGEMENT
-- Auto-create monthly partitions for position_history
-- ============================================================

CREATE OR REPLACE FUNCTION create_monthly_partition(
  target_date date DEFAULT CURRENT_DATE
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  partition_name text;
  start_date     date;
  end_date       date;
BEGIN
  start_date := date_trunc('month', target_date)::date;
  end_date   := (start_date + interval '1 month')::date;
  partition_name := 'position_history_' || to_char(target_date, 'YYYY_MM');

  -- Skip if partition already exists
  IF EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public' AND tablename = partition_name
  ) THEN
    RETURN;
  END IF;

  EXECUTE format(
    'CREATE TABLE %I PARTITION OF position_history
     FOR VALUES FROM (%L) TO (%L)',
    partition_name,
    start_date::text,
    end_date::text
  );

  -- Create optimized indexes on the new partition
  EXECUTE format(
    'CREATE INDEX %I ON %I (vehicle_id, recorded_at DESC)',
    partition_name || '_vehicle_time_idx',
    partition_name
  );

  EXECUTE format(
    'CREATE INDEX %I ON %I (company_id, recorded_at DESC)',
    partition_name || '_company_time_idx',
    partition_name
  );

  RAISE NOTICE 'Created partition: %', partition_name;
END;
$$;

-- Create current and next month partitions
SELECT create_monthly_partition(CURRENT_DATE);
SELECT create_monthly_partition(CURRENT_DATE + interval '1 month');

-- Schedule: run this monthly via pg_cron or Supabase cron jobs
-- SELECT cron.schedule('create-partitions', '0 0 1 * *', 'SELECT create_monthly_partition(CURRENT_DATE + interval ''1 month'')');

-- ============================================================
-- DASHBOARD STATS function (optimized)
-- ============================================================

CREATE OR REPLACE FUNCTION get_dashboard_stats(
  p_company_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_result jsonb;
  v_now    timestamptz := now();
  v_5min   timestamptz := now() - interval '5 minutes';
  v_today  timestamptz := date_trunc('day', now());
BEGIN
  SELECT jsonb_build_object(
    'total_vehicles',     COUNT(*),
    'vehicles_online',    COUNT(*) FILTER (WHERE vp.recorded_at > v_5min AND vp.ignition),
    'vehicles_moving',    COUNT(*) FILTER (WHERE vp.recorded_at > v_5min AND vp.ignition AND vp.speed > 2),
    'vehicles_stopped',   COUNT(*) FILTER (WHERE vp.recorded_at > v_5min AND vp.ignition AND vp.speed <= 2),
    'vehicles_offline',   COUNT(*) FILTER (WHERE vp.recorded_at > v_5min AND NOT vp.ignition),
    'vehicles_no_signal', COUNT(*) FILTER (WHERE vp.recorded_at <= v_5min OR vp.recorded_at IS NULL),
    'active_alerts',      (
      SELECT COUNT(*) FROM alerts a
      WHERE a.company_id = p_company_id AND a.acknowledged_at IS NULL
    ),
    'km_today',           COALESCE((
      SELECT SUM(
        (SELECT ph.odometer FROM position_history ph
         WHERE ph.vehicle_id = v.id AND ph.recorded_at >= v_today
         ORDER BY ph.recorded_at DESC LIMIT 1)
        -
        (SELECT ph.odometer FROM position_history ph
         WHERE ph.vehicle_id = v.id AND ph.recorded_at >= v_today
         ORDER BY ph.recorded_at ASC LIMIT 1)
      )
      FROM vehicles v WHERE v.company_id = p_company_id AND v.deleted_at IS NULL
    ), 0)
  )
  INTO v_result
  FROM vehicles v
  LEFT JOIN vehicle_positions vp ON vp.vehicle_id = v.id
  WHERE v.company_id = p_company_id
    AND v.deleted_at IS NULL;

  RETURN v_result;
END;
$$;


-- === 007_additional_tables.sql ===
-- ============================================================
-- 007_additional_tables.sql
-- Push tokens, trips automÃ¡ticos y funciones auxiliares
-- ============================================================

-- ------------------------------------------------------------
-- PUSH TOKENS (Firebase FCM)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS push_tokens (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       text        NOT NULL,
  platform    varchar(10) NOT NULL DEFAULT 'fcm', -- 'fcm' | 'apns'
  device_info jsonb,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_tokens_tenant" ON push_tokens
  FOR ALL USING (
    auth.is_super_admin() OR company_id = auth.company_id()
  );

CREATE INDEX idx_push_tokens_company ON push_tokens(company_id, is_active);

-- ------------------------------------------------------------
-- API KEYS (para acceso programÃ¡tico)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_keys (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        varchar(100) NOT NULL,
  key_hash    text        NOT NULL UNIQUE, -- SHA256 of the actual key
  key_prefix  varchar(10) NOT NULL,        -- first 8 chars for display
  permissions text[]      NOT NULL DEFAULT ARRAY['read'],
  last_used   timestamptz,
  expires_at  timestamptz,
  is_active   boolean     NOT NULL DEFAULT true,
  created_by  uuid        REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys_tenant" ON api_keys
  FOR ALL USING (
    auth.is_super_admin() OR company_id = auth.company_id()
  );

CREATE INDEX idx_api_keys_company ON api_keys(company_id, is_active);

-- ------------------------------------------------------------
-- REPORTS (stored reports for async generation)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS generated_reports (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type        varchar(50) NOT NULL,
  name        varchar(200) NOT NULL,
  parameters  jsonb       NOT NULL DEFAULT '{}',
  status      varchar(20) NOT NULL DEFAULT 'pending', -- pending, processing, ready, error
  file_url    text,
  file_size   bigint,
  row_count   int,
  error_msg   text,
  requested_by uuid      REFERENCES users(id),
  started_at  timestamptz,
  completed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_tenant" ON generated_reports
  FOR ALL USING (
    auth.is_super_admin() OR company_id = auth.company_id()
  );

CREATE INDEX idx_reports_company ON generated_reports(company_id, created_at DESC);

-- ------------------------------------------------------------
-- TRIP DETECTION FUNCTION
-- Auto-detect trips based on ignition changes
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION detect_trip_event(
  p_vehicle_id  uuid,
  p_company_id  uuid,
  p_lat         float8,
  p_lng         float8,
  p_ignition    boolean,
  p_odometer    float8,
  p_recorded_at timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_open_trip    record;
  v_prev_pos     record;
BEGIN
  -- Get previous position
  SELECT lat, lng, ignition, odometer, recorded_at
  INTO v_prev_pos
  FROM position_history
  WHERE vehicle_id = p_vehicle_id
  ORDER BY recorded_at DESC
  LIMIT 1;

  -- Check for open trip
  SELECT * INTO v_open_trip
  FROM trips
  WHERE vehicle_id = p_vehicle_id
    AND is_complete = false
  ORDER BY started_at DESC
  LIMIT 1;

  -- Ignition just turned ON â†’ start new trip
  IF p_ignition AND (NOT FOUND OR NOT v_prev_pos.ignition) THEN
    INSERT INTO trips (
      vehicle_id, company_id,
      started_at, start_lat, start_lng,
      distance_km, is_complete
    ) VALUES (
      p_vehicle_id, p_company_id,
      p_recorded_at, p_lat, p_lng,
      0, false
    );

  -- Ignition just turned OFF â†’ close open trip
  ELSIF NOT p_ignition AND FOUND AND NOT v_open_trip.is_complete THEN
    UPDATE trips SET
      ended_at      = p_recorded_at,
      end_lat       = p_lat,
      end_lng       = p_lng,
      distance_km   = GREATEST(0, p_odometer - v_open_trip.start_lat), -- simplified
      is_complete   = true
    WHERE id = v_open_trip.id;

  -- Still driving â†’ update distance
  ELSIF p_ignition AND FOUND AND NOT v_open_trip.is_complete THEN
    UPDATE trips SET
      distance_km = GREATEST(0, p_odometer - COALESCE(
        (SELECT odometer FROM position_history
         WHERE vehicle_id = p_vehicle_id AND recorded_at <= v_open_trip.started_at
         ORDER BY recorded_at DESC LIMIT 1), p_odometer
      ))
    WHERE id = v_open_trip.id;
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- FUNCTION: Get company limits vs current usage
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_company_usage(
  p_company_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_result       jsonb;
  v_plan         record;
  v_vehicle_count int;
  v_user_count    int;
BEGIN
  -- Get plan limits
  SELECT p.max_vehicles, p.max_users, p.features
  INTO v_plan
  FROM subscriptions s
  JOIN plans p ON p.id = s.plan_id
  WHERE s.company_id = p_company_id;

  -- Get current counts
  SELECT COUNT(*) INTO v_vehicle_count FROM vehicles WHERE company_id = p_company_id AND deleted_at IS NULL;
  SELECT COUNT(*) INTO v_user_count    FROM users    WHERE company_id = p_company_id AND is_active = true;

  RETURN jsonb_build_object(
    'vehicles',     jsonb_build_object('current', v_vehicle_count, 'max', COALESCE(v_plan.max_vehicles, 10)),
    'users',        jsonb_build_object('current', v_user_count,    'max', COALESCE(v_plan.max_users, 5)),
    'features',     COALESCE(v_plan.features, '{}'::jsonb),
    'at_vehicle_limit', v_vehicle_count >= COALESCE(v_plan.max_vehicles, 10),
    'at_user_limit',    v_user_count    >= COALESCE(v_plan.max_users, 5)
  );
END;
$$;


-- === 008_performance.sql ===
-- ============================================================
-- 008_performance.sql
-- Ãndices adicionales, vistas y optimizaciones de performance
-- ============================================================

-- ------------------------------------------------------------
-- ÃNDICES COMPUESTOS CRÃTICOS
-- ------------------------------------------------------------

-- Para queries de posiciÃ³n por empresa + tiempo (mÃ¡s frecuente)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ph_company_vehicle_time
  ON position_history(company_id, vehicle_id, recorded_at DESC);

-- Para alertas no reconocidas (dashboard + realtime)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_company_unack_time
  ON alerts(company_id, created_at DESC)
  WHERE acknowledged_at IS NULL;

-- Para el motor de alertas (speed_excess es el mÃ¡s comÃºn)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alert_rules_company_type
  ON alert_rules(company_id, type, is_active);

-- Para la bÃºsqueda de vehÃ­culos (full text)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vehicles_search
  ON vehicles USING gin(
    to_tsvector('spanish', economic_num || ' ' || plates || ' ' || brand || ' ' || model)
  );

-- Para bÃºsqueda de choferes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_drivers_search
  ON drivers USING gin(
    to_tsvector('spanish', full_name || ' ' || license_num)
  )
  WHERE deleted_at IS NULL;

-- Para historial de viajes por vehÃ­culo
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trips_vehicle_complete
  ON trips(vehicle_id, started_at DESC)
  WHERE is_complete = true;

-- Para mantenimiento: vehÃ­culos con servicio prÃ³ximo
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maintenance_next_date
  ON maintenance_records(company_id, next_service_date ASC NULLS LAST)
  WHERE next_service_date IS NOT NULL;

-- Para geocercas activas por empresa
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_geofences_company_active
  ON geofences(company_id)
  WHERE is_active = true;

-- Para subscripciones que vencen pronto (billing alerts)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subs_period_end
  ON subscriptions(current_period_end ASC)
  WHERE status IN ('active', 'trialing');

-- ------------------------------------------------------------
-- VISTA: Live fleet status (sin materializar - siempre fresca)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW v_live_fleet AS
SELECT
  v.id           AS vehicle_id,
  v.company_id,
  v.economic_num,
  v.plates,
  v.brand,
  v.model,
  v.type         AS vehicle_type,
  v.status       AS vehicle_status,
  d.full_name    AS driver_name,
  d.phone        AS driver_phone,
  gd.imei,
  gd.model       AS device_model,
  vp.lat,
  vp.lng,
  vp.speed,
  vp.heading,
  vp.altitude,
  vp.ignition,
  vp.odometer,
  vp.gsm_signal,
  vp.battery_lvl,
  vp.recorded_at AS last_position_at,
  -- Status derivado
  CASE
    WHEN vp.recorded_at IS NULL THEN 'no_gps'
    WHEN now() - vp.recorded_at > interval '5 minutes' THEN 'no_signal'
    WHEN NOT vp.ignition THEN 'offline'
    WHEN vp.speed > 2 THEN 'moving'
    ELSE 'stopped'
  END AS computed_status
FROM vehicles v
LEFT JOIN drivers           d  ON d.id  = v.driver_id
LEFT JOIN gps_devices       gd ON gd.id = v.device_id
LEFT JOIN vehicle_positions vp ON vp.vehicle_id = v.id
WHERE v.deleted_at IS NULL;

-- RLS-compatible: acceso filtrado por company_id desde la aplicaciÃ³n

-- ------------------------------------------------------------
-- VISTA: Alertas con contexto de vehÃ­culo
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW v_alerts_with_context AS
SELECT
  a.*,
  v.economic_num,
  v.plates,
  v.brand,
  v.model,
  d.full_name AS driver_name
FROM alerts a
JOIN vehicles v ON v.id = a.vehicle_id
LEFT JOIN drivers d ON d.id = v.driver_id;

-- ------------------------------------------------------------
-- FUNCIÃ“N: EstadÃ­sticas de km por empresa y perÃ­odo
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_km_stats(
  p_company_id uuid,
  p_from       timestamptz DEFAULT now() - interval '30 days',
  p_to         timestamptz DEFAULT now()
) RETURNS TABLE (
  vehicle_id   uuid,
  economic_num text,
  plates       text,
  km_total     float8,
  trips_count  bigint,
  avg_speed    float4,
  max_speed    float4
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.economic_num,
    v.plates,
    GREATEST(0,
      COALESCE(
        (SELECT ph2.odometer FROM position_history ph2
          WHERE ph2.vehicle_id = v.id
            AND ph2.recorded_at BETWEEN p_from AND p_to
          ORDER BY ph2.recorded_at DESC LIMIT 1)
        -
        (SELECT ph1.odometer FROM position_history ph1
          WHERE ph1.vehicle_id = v.id
            AND ph1.recorded_at BETWEEN p_from AND p_to
          ORDER BY ph1.recorded_at ASC LIMIT 1),
        0
      )
    )::float8 AS km_total,
    COUNT(DISTINCT t.id)::bigint AS trips_count,
    AVG(ph.speed) FILTER (WHERE ph.speed > 2)::float4 AS avg_speed,
    MAX(ph.speed)::float4 AS max_speed
  FROM vehicles v
  LEFT JOIN position_history ph ON ph.vehicle_id = v.id
    AND ph.recorded_at BETWEEN p_from AND p_to
  LEFT JOIN trips t ON t.vehicle_id = v.id
    AND t.started_at BETWEEN p_from AND p_to
    AND t.is_complete = true
  WHERE v.company_id = p_company_id
    AND v.deleted_at IS NULL
  GROUP BY v.id, v.economic_num, v.plates
  ORDER BY km_total DESC;
END;
$$;

-- ------------------------------------------------------------
-- FUNCIÃ“N: Resumen de alertas por tipo en un perÃ­odo
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_alert_summary(
  p_company_id uuid,
  p_from       timestamptz DEFAULT now() - interval '7 days',
  p_to         timestamptz DEFAULT now()
) RETURNS TABLE (
  alert_type   text,
  count        bigint,
  critical     bigint,
  high         bigint,
  medium       bigint,
  low          bigint
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    type::text,
    COUNT(*)                                              AS count,
    COUNT(*) FILTER (WHERE severity = 'critical')        AS critical,
    COUNT(*) FILTER (WHERE severity = 'high')            AS high,
    COUNT(*) FILTER (WHERE severity = 'medium')          AS medium,
    COUNT(*) FILTER (WHERE severity = 'low')             AS low
  FROM alerts
  WHERE company_id    = p_company_id
    AND created_at BETWEEN p_from AND p_to
  GROUP BY type
  ORDER BY count DESC;
$$;

-- ------------------------------------------------------------
-- FUNCIÃ“N: Mantenimientos vencidos o prÃ³ximos
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_upcoming_maintenance(
  p_company_id uuid,
  p_days_ahead int DEFAULT 30
) RETURNS TABLE (
  vehicle_id         uuid,
  economic_num       text,
  plates             text,
  maintenance_type   text,
  description        text,
  next_service_date  date,
  next_odometer      float8,
  current_odometer   float8,
  km_remaining       float8,
  days_remaining     int,
  is_overdue         boolean
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    v.id,
    v.economic_num,
    v.plates,
    mr.type::text,
    mr.description,
    mr.next_service_date,
    mr.next_odometer,
    vp.odometer AS current_odometer,
    GREATEST(0, mr.next_odometer - COALESCE(vp.odometer, 0)) AS km_remaining,
    (mr.next_service_date - CURRENT_DATE)::int AS days_remaining,
    (mr.next_service_date < CURRENT_DATE OR
     (mr.next_odometer IS NOT NULL AND
      COALESCE(vp.odometer, 0) >= mr.next_odometer)) AS is_overdue
  FROM maintenance_records mr
  JOIN vehicles v ON v.id = mr.vehicle_id
  LEFT JOIN vehicle_positions vp ON vp.vehicle_id = v.id
  WHERE mr.company_id = p_company_id
    AND (
      (mr.next_service_date IS NOT NULL AND
       mr.next_service_date <= CURRENT_DATE + p_days_ahead)
      OR
      (mr.next_odometer IS NOT NULL AND
       COALESCE(vp.odometer, 0) >= mr.next_odometer - 1000)
    )
  ORDER BY
    is_overdue DESC,
    days_remaining ASC NULLS LAST;
$$;


-- === 009_cron_jobs.sql ===
-- ============================================================
-- 009_cron_jobs.sql
-- Cron jobs via pg_cron (habilitar extensiÃ³n primero en Supabase)
-- Supabase: Dashboard â†’ Database â†’ Extensions â†’ pg_cron
-- ============================================================

-- Habilitar extensiÃ³n (requiere Supabase Pro o superior)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- -----------------------------------------------
-- Job 1: Crear particiÃ³n del mes siguiente (dÃ­a 25 de cada mes)
-- -----------------------------------------------
-- SELECT cron.schedule(
--   'create-next-month-partition',
--   '0 2 25 * *',
--   $$SELECT create_monthly_partition(CURRENT_DATE + interval '1 month')$$
-- );

-- -----------------------------------------------
-- Job 2: Marcar dispositivos offline (cada 5 minutos)
-- -----------------------------------------------
-- SELECT cron.schedule(
--   'mark-devices-offline',
--   '*/5 * * * *',
--   $$
--   UPDATE gps_devices SET status = 'offline'
--   WHERE last_seen < now() - interval '10 minutes'
--     AND status = 'online'
--   $$
-- );

-- -----------------------------------------------
-- Job 3: Limpiar historial de posiciones > 1 aÃ±o (domingo 3am)
-- -----------------------------------------------
-- SELECT cron.schedule(
--   'cleanup-old-positions',
--   '0 3 * * 0',
--   $$
--   DELETE FROM position_history
--   WHERE recorded_at < now() - interval '1 year'
--   $$
-- );

-- -----------------------------------------------
-- Job 4: Alertas de vencimiento de licencias (diario 8am)
-- -----------------------------------------------
-- SELECT cron.schedule(
--   'license-expiry-alerts',
--   '0 8 * * *',
--   $$
--   INSERT INTO alerts (company_id, vehicle_id, type, severity, title, message, payload)
--   SELECT
--     d.company_id,
--     v.id AS vehicle_id,
--     'maintenance_due',
--     CASE WHEN (d.license_exp - CURRENT_DATE) < 0 THEN 'critical'
--          WHEN (d.license_exp - CURRENT_DATE) < 7 THEN 'high'
--          ELSE 'medium' END,
--     'Licencia prÃ³xima a vencer: ' || d.full_name,
--     'La licencia ' || d.license_num || ' vence el ' || d.license_exp::text,
--     jsonb_build_object('driver_id', d.id, 'license_exp', d.license_exp)
--   FROM drivers d
--   JOIN vehicles v ON v.driver_id = d.id
--   WHERE d.license_exp BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
--     AND d.is_active = true
--     AND d.deleted_at IS NULL
--     AND NOT EXISTS (
--       SELECT 1 FROM alerts a
--       WHERE a.company_id = d.company_id
--         AND a.type = 'maintenance_due'
--         AND a.created_at > now() - interval '1 day'
--         AND a.payload->>'driver_id' = d.id::text
--     )
--   $$
-- );

-- -----------------------------------------------
-- Job 5: Alertas de mantenimiento vencido (diario 8:30am)
-- -----------------------------------------------
-- SELECT cron.schedule(
--   'maintenance-due-alerts',
--   '30 8 * * *',
--   $$
--   INSERT INTO alerts (company_id, vehicle_id, type, severity, title, message, payload)
--   SELECT
--     mr.company_id,
--     mr.vehicle_id,
--     'maintenance_due',
--     'high',
--     'Mantenimiento vencido: ' || v.economic_num,
--     mr.description || ' â€” programado para ' || mr.next_service_date::text,
--     jsonb_build_object('maintenance_id', mr.id, 'type', mr.type)
--   FROM maintenance_records mr
--   JOIN vehicles v ON v.id = mr.vehicle_id
--   WHERE mr.next_service_date < CURRENT_DATE
--     AND NOT EXISTS (
--       SELECT 1 FROM alerts a
--       WHERE a.company_id = mr.company_id
--         AND a.type = 'maintenance_due'
--         AND a.created_at > now() - interval '1 day'
--         AND a.payload->>'maintenance_id' = mr.id::text
--     )
--   $$
-- );

-- -----------------------------------------------
-- Verificar jobs registrados
-- -----------------------------------------------
-- SELECT * FROM cron.job;

-- NOTA: Descomenta los bloques de arriba una vez que pg_cron estÃ© habilitado
-- en tu proyecto de Supabase Pro.
SELECT 'Cron jobs script loaded. Uncomment jobs after enabling pg_cron.' AS info;



