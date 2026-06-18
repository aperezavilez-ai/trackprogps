-- ============================================================
-- 012_vehicle_groups.sql
-- Tipo de cuenta (personal/familiar/empresa) + grupos/flotillas
-- ============================================================

CREATE TYPE account_type AS ENUM ('personal', 'family', 'business');

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS account_type account_type NOT NULL DEFAULT 'business';

-- ------------------------------------------------------------
-- VEHICLE GROUPS (flotillas / grupos familiares)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehicle_groups (
  id          uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  uuid         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        varchar(80)  NOT NULL,
  color       varchar(7)   NOT NULL DEFAULT '#3B82F6',
  sort_order  int          NOT NULL DEFAULT 0,
  is_default  boolean      NOT NULL DEFAULT false,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now(),
  UNIQUE(company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_groups_company_id ON vehicle_groups(company_id);

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS group_id   uuid REFERENCES vehicle_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_name varchar(150);

CREATE INDEX IF NOT EXISTS idx_vehicles_group_id ON vehicles(group_id);

-- ------------------------------------------------------------
-- Default groups helper
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION seed_default_vehicle_groups(
  p_company_id uuid,
  p_account_type account_type DEFAULT 'business'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_color text := '#3B82F6';
BEGIN
  IF EXISTS (SELECT 1 FROM vehicle_groups WHERE company_id = p_company_id LIMIT 1) THEN
    RETURN;
  END IF;

  v_name := CASE p_account_type
    WHEN 'personal' THEN 'Mis vehículos'
    WHEN 'family'   THEN 'Familia'
    ELSE 'Flotilla principal'
  END;

  INSERT INTO vehicle_groups (company_id, name, color, sort_order, is_default)
  VALUES (p_company_id, v_name, v_color, 0, true);

  IF p_account_type = 'family' THEN
    INSERT INTO vehicle_groups (company_id, name, color, sort_order, is_default) VALUES
      (p_company_id, 'Personal', '#22C55E', 1, false),
      (p_company_id, 'Hijos',    '#F59E0B', 2, false);
  ELSIF p_account_type = 'business' THEN
    INSERT INTO vehicle_groups (company_id, name, color, sort_order, is_default) VALUES
      (p_company_id, 'Operación', '#8B5CF6', 1, false);
  END IF;
END;
$$;

-- Backfill existing companies
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, account_type FROM companies LOOP
    PERFORM seed_default_vehicle_groups(r.id, r.account_type);
  END LOOP;
END $$;

-- Assign orphan vehicles to default group
UPDATE vehicles v
SET group_id = g.id
FROM vehicle_groups g
WHERE v.group_id IS NULL
  AND g.company_id = v.company_id
  AND g.is_default = true;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE vehicle_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicle_groups_tenant_select" ON vehicle_groups
  FOR SELECT USING (public.is_super_admin() OR company_id = public.get_company_id());

CREATE POLICY "vehicle_groups_tenant_insert" ON vehicle_groups
  FOR INSERT WITH CHECK (public.is_super_admin() OR company_id = public.get_company_id());

CREATE POLICY "vehicle_groups_tenant_update" ON vehicle_groups
  FOR UPDATE USING (public.is_super_admin() OR company_id = public.get_company_id());

CREATE POLICY "vehicle_groups_tenant_delete" ON vehicle_groups
  FOR DELETE USING (public.is_super_admin() OR company_id = public.get_company_id());

CREATE TRIGGER set_vehicle_groups_updated_at
  BEFORE UPDATE ON vehicle_groups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
