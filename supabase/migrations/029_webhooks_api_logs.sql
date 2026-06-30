-- ============================================================
-- 029_webhooks_api_logs.sql
-- Webhooks salientes + logs de requests API v1
-- ============================================================

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            varchar(100) NOT NULL DEFAULT 'Webhook',
  url             text        NOT NULL,
  secret          text        NOT NULL,
  events          text[]      NOT NULL DEFAULT ARRAY['alert.created'],
  is_active       boolean     NOT NULL DEFAULT true,
  failure_count   int         NOT NULL DEFAULT 0,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_by      uuid        REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_company
  ON webhook_endpoints(company_id, is_active);

ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webhook_endpoints_tenant ON webhook_endpoints;
CREATE POLICY webhook_endpoints_tenant ON webhook_endpoints
  FOR ALL USING (
    public.is_super_admin() OR company_id = public.get_company_id()
  );

CREATE TABLE IF NOT EXISTS api_request_logs (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  api_key_id  uuid        REFERENCES api_keys(id) ON DELETE SET NULL,
  method      varchar(10) NOT NULL,
  path        varchar(255) NOT NULL,
  status_code int,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_company
  ON api_request_logs(company_id, created_at DESC);

ALTER TABLE api_request_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS api_request_logs_tenant ON api_request_logs;
CREATE POLICY api_request_logs_tenant ON api_request_logs
  FOR SELECT USING (
    public.is_super_admin() OR company_id = public.get_company_id()
  );

DROP POLICY IF EXISTS api_request_logs_insert_service ON api_request_logs;
CREATE POLICY api_request_logs_insert_service ON api_request_logs
  FOR INSERT WITH CHECK (true);
