-- Bandeja de soporte público (consultas desde login/registro/descargar)

CREATE TYPE support_ticket_status AS ENUM ('nuevo', 'en_proceso', 'respondido', 'cerrado');
CREATE TYPE support_ticket_source AS ENUM ('login', 'register', 'descargar', 'other');

CREATE TABLE support_tickets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  phone         text NOT NULL,
  subject       text NOT NULL,
  status        support_ticket_status NOT NULL DEFAULT 'nuevo',
  source        support_ticket_source NOT NULL DEFAULT 'other',
  assigned_to   uuid REFERENCES users(id) ON DELETE SET NULL,
  client_ip     text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  closed_at     timestamptz
);

CREATE TABLE support_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  body            text NOT NULL,
  is_staff        boolean NOT NULL DEFAULT false,
  author_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_created ON support_tickets(created_at DESC);
CREATE INDEX idx_support_tickets_email ON support_tickets(email);
CREATE INDEX idx_support_messages_ticket ON support_messages(ticket_id, created_at ASC);

CREATE OR REPLACE FUNCTION support_tickets_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_support_tickets_updated
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION support_tickets_set_updated_at();

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Solo super_admin lee tickets (API usa service role para escritura pública)
CREATE POLICY support_tickets_super_admin_select ON support_tickets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
  );

CREATE POLICY support_messages_super_admin_select ON support_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
  );
