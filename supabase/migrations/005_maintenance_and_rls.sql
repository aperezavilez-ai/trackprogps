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
