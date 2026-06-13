-- ============================================================
-- 001_extensions.sql
-- Habilitar extensiones necesarias
-- ============================================================

-- UUID v4 generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PostGIS para geocercas geoespaciales
CREATE EXTENSION IF NOT EXISTS "postgis";

-- pgcrypto para hashes
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Para búsqueda de texto completo
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM (
  'super_admin',
  'admin_empresa',
  'supervisor',
  'operador',
  'cliente_consulta'
);

CREATE TYPE company_status AS ENUM (
  'active',
  'suspended',
  'trial',
  'cancelled'
);

CREATE TYPE plan_type AS ENUM (
  'basico',
  'profesional',
  'empresarial'
);

CREATE TYPE vehicle_status AS ENUM (
  'active',
  'inactive',
  'maintenance'
);

CREATE TYPE vehicle_type AS ENUM (
  'sedan', 'suv', 'pickup', 'van',
  'truck', 'bus', 'motorcycle', 'other'
);

CREATE TYPE device_status AS ENUM (
  'online', 'offline', 'no_signal', 'unknown'
);

CREATE TYPE geofence_type AS ENUM (
  'circular', 'polygon'
);

CREATE TYPE alert_type AS ENUM (
  'speed_excess',
  'gps_disconnect',
  'signal_loss',
  'power_cut',
  'unauthorized_movement',
  'geofence_enter',
  'geofence_exit',
  'geofence_dwell',
  'sos',
  'maintenance_due',
  'ignition_on',
  'ignition_off',
  'battery_low'
);

CREATE TYPE alert_severity AS ENUM (
  'low', 'medium', 'high', 'critical'
);

CREATE TYPE maintenance_type AS ENUM (
  'oil_change', 'tire_rotation', 'brake_service',
  'tune_up', 'insurance', 'verification', 'other'
);

CREATE TYPE subscription_status AS ENUM (
  'active', 'past_due', 'cancelled', 'trialing'
);
