-- Renombrar grupos por defecto: Particular, Grupo, Flotilla
CREATE OR REPLACE FUNCTION seed_default_vehicle_groups(
  p_company_id uuid,
  p_account_type account_type DEFAULT 'business'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM vehicle_groups WHERE company_id = p_company_id LIMIT 1) THEN
    RETURN;
  END IF;

  INSERT INTO vehicle_groups (company_id, name, color, sort_order, is_default) VALUES
    (p_company_id, 'Particular', '#22C55E', 0, true),
    (p_company_id, 'Grupo',      '#3B82F6', 1, false),
    (p_company_id, 'Flotilla',   '#8B5CF6', 2, false);
END;
$$;
