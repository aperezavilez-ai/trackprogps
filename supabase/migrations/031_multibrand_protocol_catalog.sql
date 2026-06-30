-- ============================================================
-- 031_multibrand_protocol_catalog.sql
-- Catalogo multimarca, autoprovicionamiento y trazabilidad raw
-- ============================================================

DO $$ BEGIN
  CREATE TYPE gps_transport_type AS ENUM ('tcp', 'udp', 'http', 'mobile');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE gps_protocol_parser_type AS ENUM ('binary', 'ascii', 'json');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE gps_provisioning_status AS ENUM (
    'registered',
    'pending_autodetect',
    'detected',
    'unsupported',
    'blocked'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS gps_manufacturers (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug        varchar(40) NOT NULL UNIQUE,
  name        varchar(80) NOT NULL,
  website_url text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gps_protocols (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  manufacturer_id uuid REFERENCES gps_manufacturers(id) ON DELETE SET NULL,
  slug            varchar(60) NOT NULL UNIQUE,
  name            varchar(100) NOT NULL,
  transport       gps_transport_type NOT NULL DEFAULT 'tcp',
  parser_type     gps_protocol_parser_type NOT NULL DEFAULT 'binary',
  adapter_key     varchar(80) NOT NULL UNIQUE,
  default_port    int CHECK (default_port BETWEEN 1 AND 65535),
  handshake_spec  jsonb NOT NULL DEFAULT '{}',
  frame_spec      jsonb NOT NULL DEFAULT '{}',
  ack_spec        jsonb NOT NULL DEFAULT '{}',
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gps_device_models (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  manufacturer_id uuid NOT NULL REFERENCES gps_manufacturers(id) ON DELETE CASCADE,
  protocol_id     uuid NOT NULL REFERENCES gps_protocols(id) ON DELETE RESTRICT,
  model           varchar(80) NOT NULL,
  hardware_family varchar(80),
  imei_prefixes   text[] NOT NULL DEFAULT '{}',
  capabilities    jsonb NOT NULL DEFAULT '{}',
  default_io_map   jsonb NOT NULL DEFAULT '{}',
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manufacturer_id, model)
);

CREATE TABLE IF NOT EXISTS gps_io_mappings (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id    uuid REFERENCES gps_device_models(id) ON DELETE CASCADE,
  protocol_id uuid NOT NULL REFERENCES gps_protocols(id) ON DELETE CASCADE,
  io_key      varchar(80) NOT NULL,
  raw_id      varchar(40) NOT NULL,
  value_type  varchar(24) NOT NULL DEFAULT 'number',
  scale       double precision NOT NULL DEFAULT 1,
  unit        varchar(24),
  semantics   varchar(80) NOT NULL,
  active_high boolean,
  metadata    jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (protocol_id, model_id, raw_id)
);

CREATE TABLE IF NOT EXISTS gps_command_templates (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  protocol_id     uuid NOT NULL REFERENCES gps_protocols(id) ON DELETE CASCADE,
  model_id        uuid REFERENCES gps_device_models(id) ON DELETE CASCADE,
  command_type    varchar(50) NOT NULL,
  command_payload text NOT NULL,
  transport       gps_transport_type NOT NULL DEFAULT 'tcp',
  codec           varchar(40),
  params_schema   jsonb NOT NULL DEFAULT '{}',
  requires_online boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (protocol_id, model_id, command_type)
);

ALTER TABLE gps_devices
  ADD COLUMN IF NOT EXISTS manufacturer_id uuid REFERENCES gps_manufacturers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS model_id uuid REFERENCES gps_device_models(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS protocol_id uuid REFERENCES gps_protocols(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provisioning_status gps_provisioning_status NOT NULL DEFAULT 'registered',
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS protocol_metadata jsonb NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS gps_provisioning_candidates (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  imei            varchar(64) NOT NULL UNIQUE,
  source_type     device_source_type NOT NULL DEFAULT 'hardware',
  manufacturer_id uuid REFERENCES gps_manufacturers(id) ON DELETE SET NULL,
  model_id        uuid REFERENCES gps_device_models(id) ON DELETE SET NULL,
  protocol_id     uuid REFERENCES gps_protocols(id) ON DELETE SET NULL,
  status          gps_provisioning_status NOT NULL DEFAULT 'pending_autodetect',
  confidence      numeric(5,2) NOT NULL DEFAULT 0,
  first_seen_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  sample_payload  jsonb NOT NULL DEFAULT '{}',
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS raw_ingest_packets (
  id              bigserial PRIMARY KEY,
  company_id      uuid REFERENCES companies(id) ON DELETE SET NULL,
  device_id       uuid REFERENCES gps_devices(id) ON DELETE SET NULL,
  imei            varchar(64),
  source_type     device_source_type NOT NULL DEFAULT 'hardware',
  protocol_id     uuid REFERENCES gps_protocols(id) ON DELETE SET NULL,
  transport       gps_transport_type NOT NULL DEFAULT 'tcp',
  remote_address  inet,
  payload_hex     text,
  payload_json    jsonb,
  parse_status    varchar(24) NOT NULL DEFAULT 'pending',
  parse_error     text,
  received_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS device_event_states (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vehicle_id      uuid REFERENCES vehicles(id) ON DELETE CASCADE,
  device_id       uuid REFERENCES gps_devices(id) ON DELETE CASCADE,
  rule_id         uuid REFERENCES alert_rules(id) ON DELETE CASCADE,
  state_key       varchar(80) NOT NULL,
  state_value     jsonb NOT NULL DEFAULT '{}',
  entered_at      timestamptz NOT NULL DEFAULT now(),
  last_changed_at timestamptz NOT NULL DEFAULT now(),
  last_evaluated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, device_id, rule_id, state_key)
);

CREATE INDEX IF NOT EXISTS idx_gps_protocols_adapter
  ON gps_protocols(adapter_key)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_gps_device_models_prefixes
  ON gps_device_models USING GIN(imei_prefixes);

CREATE INDEX IF NOT EXISTS idx_gps_devices_protocol
  ON gps_devices(protocol_id, provisioning_status);

CREATE INDEX IF NOT EXISTS idx_gps_provisioning_candidates_status
  ON gps_provisioning_candidates(status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_raw_ingest_packets_imei_time
  ON raw_ingest_packets(imei, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_raw_ingest_packets_parse_status
  ON raw_ingest_packets(parse_status, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_device_event_states_device
  ON device_event_states(device_id, state_key);

ALTER TABLE gps_manufacturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_device_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_io_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_command_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_provisioning_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_ingest_packets ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_event_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gps_manufacturers_read ON gps_manufacturers;
CREATE POLICY gps_manufacturers_read ON gps_manufacturers FOR SELECT USING (true);

DROP POLICY IF EXISTS gps_protocols_read ON gps_protocols;
CREATE POLICY gps_protocols_read ON gps_protocols FOR SELECT USING (true);

DROP POLICY IF EXISTS gps_device_models_read ON gps_device_models;
CREATE POLICY gps_device_models_read ON gps_device_models FOR SELECT USING (true);

DROP POLICY IF EXISTS gps_io_mappings_read ON gps_io_mappings;
CREATE POLICY gps_io_mappings_read ON gps_io_mappings FOR SELECT USING (true);

DROP POLICY IF EXISTS gps_command_templates_read ON gps_command_templates;
CREATE POLICY gps_command_templates_read ON gps_command_templates FOR SELECT USING (true);

DROP POLICY IF EXISTS gps_provisioning_candidates_admin ON gps_provisioning_candidates;
CREATE POLICY gps_provisioning_candidates_admin ON gps_provisioning_candidates
  FOR ALL USING (public.is_super_admin());

DROP POLICY IF EXISTS raw_ingest_packets_admin ON raw_ingest_packets;
CREATE POLICY raw_ingest_packets_admin ON raw_ingest_packets
  FOR ALL USING (public.is_super_admin());

DROP POLICY IF EXISTS device_event_states_tenant ON device_event_states;
CREATE POLICY device_event_states_tenant ON device_event_states
  FOR ALL USING (public.is_super_admin() OR company_id = public.get_company_id());

INSERT INTO gps_manufacturers (slug, name, website_url) VALUES
  ('teltonika', 'Teltonika', 'https://teltonika-gps.com'),
  ('concox', 'Concox', 'https://www.iconcox.com'),
  ('queclink', 'Queclink', 'https://www.queclink.com'),
  ('tk-star', 'TK-Star', NULL)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO gps_protocols (
  manufacturer_id,
  slug,
  name,
  transport,
  parser_type,
  adapter_key,
  default_port,
  handshake_spec,
  frame_spec,
  ack_spec
)
SELECT m.id,
  'teltonika-codec8',
  'Teltonika Codec 8/8E',
  'tcp',
  'binary',
  'teltonika-codec8',
  5000,
  '{"type":"imei-length-prefixed-ascii","ack":"01"}'::jsonb,
  '{"preamble":"00000000","length_bytes":4,"crc":"crc16-ibm"}'::jsonb,
  '{"type":"record-count-uint32be"}'::jsonb
FROM gps_manufacturers m
WHERE m.slug = 'teltonika'
ON CONFLICT (slug) DO UPDATE SET
  adapter_key = EXCLUDED.adapter_key,
  handshake_spec = EXCLUDED.handshake_spec,
  frame_spec = EXCLUDED.frame_spec,
  ack_spec = EXCLUDED.ack_spec;

INSERT INTO gps_device_models (
  manufacturer_id,
  protocol_id,
  model,
  hardware_family,
  imei_prefixes,
  capabilities,
  default_io_map
)
SELECT m.id,
  p.id,
  'FMC920',
  'FMC',
  ARRAY[]::text[],
  '{"ignition":true,"movement":true,"external_voltage":true,"battery_voltage":true,"commands":["immobilize","enable","get_position","reboot"]}'::jsonb,
  '{"239":"ignition","240":"movement","21":"gsm_signal","66":"external_voltage","67":"battery_voltage","16":"odometer","199":"total_odometer"}'::jsonb
FROM gps_manufacturers m
JOIN gps_protocols p ON p.slug = 'teltonika-codec8'
WHERE m.slug = 'teltonika'
ON CONFLICT (manufacturer_id, model) DO UPDATE SET
  protocol_id = EXCLUDED.protocol_id,
  capabilities = EXCLUDED.capabilities,
  default_io_map = EXCLUDED.default_io_map;

INSERT INTO gps_io_mappings (protocol_id, model_id, io_key, raw_id, value_type, scale, unit, semantics, active_high)
SELECT p.id, dm.id, io.io_key, io.raw_id, io.value_type, io.scale, io.unit, io.semantics, io.active_high
FROM gps_protocols p
JOIN gps_device_models dm ON dm.protocol_id = p.id AND dm.model = 'FMC920'
CROSS JOIN (VALUES
  ('ignition', '239', 'boolean', 1::double precision, NULL, 'ignition', true),
  ('movement', '240', 'boolean', 1::double precision, NULL, 'movement', true),
  ('gsm_signal', '21', 'number', 1::double precision, NULL, 'gsm_signal', NULL),
  ('external_voltage', '66', 'number', 0.001::double precision, 'V', 'external_voltage', NULL),
  ('battery_voltage', '67', 'number', 0.001::double precision, 'V', 'battery_voltage', NULL),
  ('odometer', '16', 'number', 1::double precision, 'm', 'odometer', NULL),
  ('total_odometer', '199', 'number', 1::double precision, 'm', 'odometer', NULL)
) AS io(io_key, raw_id, value_type, scale, unit, semantics, active_high)
WHERE p.slug = 'teltonika-codec8'
ON CONFLICT (protocol_id, model_id, raw_id) DO UPDATE SET
  io_key = EXCLUDED.io_key,
  value_type = EXCLUDED.value_type,
  scale = EXCLUDED.scale,
  unit = EXCLUDED.unit,
  semantics = EXCLUDED.semantics,
  active_high = EXCLUDED.active_high;

INSERT INTO gps_command_templates (protocol_id, model_id, command_type, command_payload, codec)
SELECT p.id, dm.id, cmd.command_type, cmd.command_payload, 'codec12'
FROM gps_protocols p
JOIN gps_device_models dm ON dm.protocol_id = p.id AND dm.model = 'FMC920'
CROSS JOIN (VALUES
  ('immobilize', 'setdigout 1'),
  ('enable', 'setdigout 0'),
  ('get_position', 'getrecord'),
  ('reboot', 'cpureset')
) AS cmd(command_type, command_payload)
WHERE p.slug = 'teltonika-codec8'
ON CONFLICT (protocol_id, model_id, command_type) DO UPDATE SET
  command_payload = EXCLUDED.command_payload,
  codec = EXCLUDED.codec;

UPDATE gps_devices d
SET
  manufacturer_id = m.id,
  protocol_id = p.id,
  model_id = dm.id,
  provisioning_status = 'registered',
  protocol_metadata = COALESCE(d.protocol_metadata, '{}'::jsonb) || jsonb_build_object('adapter_key', p.adapter_key)
FROM gps_manufacturers m
JOIN gps_protocols p ON p.slug = 'teltonika-codec8'
JOIN gps_device_models dm ON dm.protocol_id = p.id AND dm.model = 'FMC920'
WHERE m.slug = 'teltonika'
  AND d.source_type = 'hardware'
  AND (d.protocol_id IS NULL OR d.model = 'FMC920');

COMMENT ON TABLE gps_protocols IS 'Catalogo de protocolos GPS: Teltonika, Concox, Queclink, TK-Star, app movil, etc.';
COMMENT ON TABLE gps_io_mappings IS 'Mapeo normalizado de entradas/salidas fisicas: ignicion, corte de motor, panico, voltajes y sensores.';
COMMENT ON TABLE gps_provisioning_candidates IS 'IMEIs vistos por ingest antes de estar asignados a una empresa.';
COMMENT ON TABLE raw_ingest_packets IS 'Payload crudo Hex/JSON recibido por TCP/UDP/HTTP para auditoria y reprocesamiento.';
COMMENT ON TABLE device_event_states IS 'Estado persistente por regla/dispositivo para alertas con maquina de estados.';
