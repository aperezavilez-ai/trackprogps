-- ============================================================
-- 010_device_commands.sql
-- Comandos remotos a dispositivos GPS (idempotente)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE device_command_type AS ENUM (
    'immobilize', 'enable', 'get_position', 'reboot'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE device_command_status AS ENUM (
    'pending', 'sent', 'confirmed', 'failed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS device_commands (
  id           uuid                  PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   uuid                  NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_id    uuid                  NOT NULL REFERENCES gps_devices(id) ON DELETE CASCADE,
  vehicle_id   uuid                  REFERENCES vehicles(id) ON DELETE SET NULL,
  imei         varchar(20)           NOT NULL,
  command_type device_command_type   NOT NULL,
  command_text varchar(100)          NOT NULL,
  status       device_command_status NOT NULL DEFAULT 'pending',
  issued_by    uuid                  NOT NULL REFERENCES users(id),
  error_msg    text,
  sent_at      timestamptz,
  confirmed_at timestamptz,
  created_at   timestamptz           NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_commands_pending ON device_commands(status, created_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_device_commands_device ON device_commands(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_commands_company ON device_commands(company_id);

ALTER TABLE device_commands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "device_commands_tenant_select" ON device_commands;
CREATE POLICY "device_commands_tenant_select" ON device_commands
  FOR SELECT USING (public.is_super_admin() OR company_id = public.get_company_id());

DROP POLICY IF EXISTS "device_commands_tenant_insert" ON device_commands;
CREATE POLICY "device_commands_tenant_insert" ON device_commands
  FOR INSERT WITH CHECK (public.is_super_admin() OR company_id = public.get_company_id());

DROP POLICY IF EXISTS "device_commands_tenant_update" ON device_commands;
CREATE POLICY "device_commands_tenant_update" ON device_commands
  FOR UPDATE USING (public.is_super_admin() OR company_id = public.get_company_id());
