-- ============================================================
-- 013_user_group_access.sql
-- Permisos por grupo: miembros familiares ven solo sus vehículos
-- ============================================================

CREATE TABLE IF NOT EXISTS user_vehicle_group_access (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id    uuid        NOT NULL REFERENCES vehicle_groups(id) ON DELETE CASCADE,
  company_id  uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_uvga_user_id ON user_vehicle_group_access(user_id);
CREATE INDEX IF NOT EXISTS idx_uvga_group_id ON user_vehicle_group_access(group_id);
CREATE INDEX IF NOT EXISTS idx_uvga_company_id ON user_vehicle_group_access(company_id);

ALTER TABLE user_vehicle_group_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uvga_tenant_select" ON user_vehicle_group_access
  FOR SELECT USING (public.is_super_admin() OR company_id = public.get_company_id());

CREATE POLICY "uvga_tenant_insert" ON user_vehicle_group_access
  FOR INSERT WITH CHECK (
    public.is_super_admin() OR (
      company_id = public.get_company_id()
      AND public.get_user_role() IN ('admin_empresa', 'supervisor')
    )
  );

CREATE POLICY "uvga_tenant_delete" ON user_vehicle_group_access
  FOR DELETE USING (
    public.is_super_admin() OR (
      company_id = public.get_company_id()
      AND public.get_user_role() IN ('admin_empresa', 'supervisor')
    )
  );

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_full_vehicle_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin()
    OR public.get_user_role() IN ('admin_empresa', 'supervisor')
    OR NOT EXISTS (
      SELECT 1 FROM user_vehicle_group_access WHERE user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_vehicle(p_vehicle_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_full_vehicle_access()
    OR EXISTS (
      SELECT 1
      FROM vehicles v
      JOIN user_vehicle_group_access uga ON uga.group_id = v.group_id
      WHERE v.id = p_vehicle_id
        AND uga.user_id = auth.uid()
        AND v.deleted_at IS NULL
    );
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_device(p_device_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_full_vehicle_access()
    OR EXISTS (
      SELECT 1
      FROM vehicles v
      JOIN user_vehicle_group_access uga ON uga.group_id = v.group_id
      WHERE v.device_id = p_device_id
        AND uga.user_id = auth.uid()
        AND v.deleted_at IS NULL
    );
$$;

-- ------------------------------------------------------------
-- RLS: restringir lectura por grupo
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "vehicles_tenant_select" ON vehicles;
CREATE POLICY "vehicles_tenant_select" ON vehicles
  FOR SELECT USING (
    public.is_super_admin() OR (
      company_id = public.get_company_id()
      AND public.user_can_access_vehicle(id)
    )
  );

DROP POLICY IF EXISTS "gps_devices_tenant_select" ON gps_devices;
CREATE POLICY "gps_devices_tenant_select" ON gps_devices
  FOR SELECT USING (
    public.is_super_admin() OR (
      company_id = public.get_company_id()
      AND public.user_can_access_device(id)
    )
  );

DROP POLICY IF EXISTS "vehicle_positions_tenant_select" ON vehicle_positions;
CREATE POLICY "vehicle_positions_tenant_select" ON vehicle_positions
  FOR SELECT USING (
    public.is_super_admin() OR (
      company_id = public.get_company_id()
      AND public.user_can_access_vehicle(vehicle_id)
    )
  );

DROP POLICY IF EXISTS "position_history_tenant_select" ON position_history;
CREATE POLICY "position_history_tenant_select" ON position_history
  FOR SELECT USING (
    public.is_super_admin() OR (
      company_id = public.get_company_id()
      AND public.user_can_access_vehicle(vehicle_id)
    )
  );
