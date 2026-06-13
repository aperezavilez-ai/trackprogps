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
('Básico',       'basico',       10,   3,   299,  2990,  '{"realtime_map":true,"route_history_days":30,"alerts":true,"geofences":true,"reports":false,"maintenance":false,"mobile_app":false,"ai_assistant":false,"api_access":false,"white_label":false}'),
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
