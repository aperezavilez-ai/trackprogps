-- ============================================================
-- 003_fleet_tables.sql
-- Vehículos, choferes y dispositivos GPS
-- ============================================================

-- ------------------------------------------------------------
-- GPS DEVICES
-- ------------------------------------------------------------
CREATE TABLE gps_devices (
  id           uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   uuid         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  imei         varchar(20)  NOT NULL UNIQUE,
  model        varchar(50)  NOT NULL DEFAULT 'FMC920',
  firmware_ver varchar(20),
  sim_iccid    varchar(30),
  phone_num    varchar(20),
  last_seen    timestamptz,
  status       device_status NOT NULL DEFAULT 'unknown',
  created_at   timestamptz  NOT NULL DEFAULT now(),
  updated_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX idx_gps_devices_company_id ON gps_devices(company_id);
CREATE INDEX idx_gps_devices_imei ON gps_devices(imei);
CREATE INDEX idx_gps_devices_status ON gps_devices(status);

-- ------------------------------------------------------------
-- DRIVERS
-- ------------------------------------------------------------
CREATE TABLE drivers (
  id           uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   uuid         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  full_name    varchar(150) NOT NULL,
  phone        varchar(20),
  email        varchar(255),
  license_num  varchar(30)  NOT NULL,
  license_exp  date         NOT NULL,
  photo_url    text,
  is_active    boolean      NOT NULL DEFAULT true,
  notes        text,
  created_at   timestamptz  NOT NULL DEFAULT now(),
  updated_at   timestamptz  NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

CREATE INDEX idx_drivers_company_id ON drivers(company_id);
CREATE INDEX idx_drivers_active ON drivers(company_id, is_active) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- VEHICLES
-- ------------------------------------------------------------
CREATE TABLE vehicles (
  id               uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id       uuid          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_id        uuid          UNIQUE REFERENCES gps_devices(id) ON DELETE SET NULL,
  driver_id        uuid          REFERENCES drivers(id) ON DELETE SET NULL,
  economic_num     varchar(20)   NOT NULL,
  plates           varchar(15)   NOT NULL,
  brand            varchar(60)   NOT NULL,
  model            varchar(60)   NOT NULL,
  year             smallint      NOT NULL CHECK (year >= 1900 AND year <= 2100),
  vin              varchar(17),
  type             vehicle_type  NOT NULL DEFAULT 'other',
  color            varchar(30),
  status           vehicle_status NOT NULL DEFAULT 'active',
  odometer_offset  float8        NOT NULL DEFAULT 0,
  max_speed        int           NOT NULL DEFAULT 120, -- km/h limit for alerts
  notes            text,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  UNIQUE(company_id, economic_num),
  UNIQUE(company_id, plates)
);

CREATE INDEX idx_vehicles_company_id ON vehicles(company_id);
CREATE INDEX idx_vehicles_device_id ON vehicles(device_id);
CREATE INDEX idx_vehicles_driver_id ON vehicles(driver_id);
CREATE INDEX idx_vehicles_active ON vehicles(company_id, status) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- VEHICLE-DRIVER HISTORY
-- ------------------------------------------------------------
CREATE TABLE vehicle_driver_history (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id  uuid        NOT NULL REFERENCES vehicles(id),
  driver_id   uuid        NOT NULL REFERENCES drivers(id),
  company_id  uuid        NOT NULL REFERENCES companies(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  unassigned_at timestamptz,
  assigned_by uuid        REFERENCES users(id)
);

CREATE INDEX idx_vdh_vehicle_id ON vehicle_driver_history(vehicle_id);
CREATE INDEX idx_vdh_driver_id ON vehicle_driver_history(driver_id);
