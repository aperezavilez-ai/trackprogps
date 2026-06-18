-- ============================================================
-- 014b_miembro_familiar_rls.sql
-- RLS alertas/trips + has_full_vehicle_access con miembro_familiar
-- Ejecutar DESPUÉS de 014_miembro_familiar.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_full_vehicle_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_super_admin() THEN true
    WHEN public.get_user_role() IN ('admin_empresa', 'supervisor') THEN true
    WHEN public.get_user_role() = 'miembro_familiar' THEN false
    WHEN EXISTS (SELECT 1 FROM user_vehicle_group_access WHERE user_id = auth.uid()) THEN false
    ELSE true
  END;
$$;

DROP POLICY IF EXISTS "alerts_tenant_select" ON alerts;
CREATE POLICY "alerts_tenant_select" ON alerts
  FOR SELECT USING (
    public.is_super_admin() OR (
      company_id = public.get_company_id()
      AND public.user_can_access_vehicle(vehicle_id)
    )
  );

DROP POLICY IF EXISTS "trips_tenant_select" ON trips;
CREATE POLICY "trips_tenant_select" ON trips
  FOR SELECT USING (
    public.is_super_admin() OR (
      company_id = public.get_company_id()
      AND public.user_can_access_vehicle(vehicle_id)
    )
  );
