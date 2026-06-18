-- ============================================================
-- 005b_rls_fixed.sql
-- RLS + helper functions (versión corregida para Supabase)
-- Las funciones van en public schema (no auth) para evitar
-- el error "permission denied for schema auth"
-- ============================================================

-- Maintenance tables (si no se crearon en 005)
CREATE TABLE IF NOT EXISTS maintenance_records (
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

CREATE TABLE IF NOT EXISTS maintenance_alerts (
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

CREATE INDEX IF NOT EXISTS idx_maintenance_company_id ON maintenance_records(company_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle_id ON maintenance_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_ma_company_id ON maintenance_alerts(company_id);
CREATE INDEX IF NOT EXISTS idx_ma_vehicle_id ON maintenance_alerts(vehicle_id);

-- ============================================================
-- HELPER FUNCTIONS en public schema (no auth)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT company_id FROM users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE((SELECT role = 'super_admin' FROM users WHERE id = auth.uid()), false)
$$;

-- ============================================================
-- ENABLE RLS
-- ============================================================

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

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Companies
CREATE POLICY "companies_select" ON companies
  FOR SELECT USING (public.is_super_admin() OR id = public.get_company_id());

CREATE POLICY "companies_insert" ON companies
  FOR INSERT WITH CHECK (public.is_super_admin());

CREATE POLICY "companies_update" ON companies
  FOR UPDATE USING (
    public.is_super_admin() OR (id = public.get_company_id() AND public.get_user_role() = 'admin_empresa')
  );

-- Users
CREATE POLICY "users_select" ON users
  FOR SELECT USING (
    public.is_super_admin() OR id = auth.uid() OR company_id = public.get_company_id()
  );

CREATE POLICY "users_insert" ON users
  FOR INSERT WITH CHECK (
    public.is_super_admin() OR (
      company_id = public.get_company_id() AND
      public.get_user_role() IN ('admin_empresa', 'supervisor')
    )
  );

CREATE POLICY "users_update" ON users
  FOR UPDATE USING (
    public.is_super_admin() OR id = auth.uid() OR
    (company_id = public.get_company_id() AND public.get_user_role() = 'admin_empresa')
  );

-- Tenant isolation for all other tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gps_devices', 'drivers', 'vehicles', 'vehicle_driver_history',
    'vehicle_positions', 'position_history', 'trips',
    'geofences', 'alert_rules', 'alerts',
    'maintenance_records', 'maintenance_alerts', 'subscriptions'
  ] LOOP
    EXECUTE format('
      CREATE POLICY "%s_tenant_select" ON %s FOR SELECT USING (public.is_super_admin() OR company_id = public.get_company_id());
      CREATE POLICY "%s_tenant_insert" ON %s FOR INSERT WITH CHECK (public.is_super_admin() OR company_id = public.get_company_id());
      CREATE POLICY "%s_tenant_update" ON %s FOR UPDATE USING (public.is_super_admin() OR company_id = public.get_company_id());
      CREATE POLICY "%s_tenant_delete" ON %s FOR DELETE USING (public.is_super_admin() OR company_id = public.get_company_id());
    ', t,t, t,t, t,t, t,t);
  END LOOP;
END $$;

-- Audit logs
CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT USING (public.is_super_admin() OR company_id = public.get_company_id());
CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$
DECLARE t text;
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
