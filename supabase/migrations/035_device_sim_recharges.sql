-- ============================================================
-- 035_device_sim_recharges.sql
-- Control de saldo/recarga mensual para chips SIM de GPS
-- ============================================================

CREATE TABLE IF NOT EXISTS device_sim_recharges (
  id                  uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id          uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_id           uuid        NOT NULL REFERENCES gps_devices(id) ON DELETE CASCADE,
  carrier             varchar(40) NOT NULL,
  phone_num           varchar(20),
  amount              numeric(10,2),
  currency            varchar(3)  NOT NULL DEFAULT 'MXN',
  recharge_date       date        NOT NULL,
  validity_days       int         NOT NULL DEFAULT 30 CHECK (validity_days BETWEEN 1 AND 366),
  next_recharge_date  date        GENERATED ALWAYS AS (recharge_date + validity_days) STORED,
  alert_days_before   int         NOT NULL DEFAULT 3 CHECK (alert_days_before BETWEEN 0 AND 30),
  notes               text,
  created_by          uuid        REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE device_sim_recharges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "device_sim_recharges_tenant_select" ON device_sim_recharges;
DROP POLICY IF EXISTS "device_sim_recharges_tenant_insert" ON device_sim_recharges;
DROP POLICY IF EXISTS "device_sim_recharges_tenant_update" ON device_sim_recharges;
DROP POLICY IF EXISTS "device_sim_recharges_tenant_delete" ON device_sim_recharges;

CREATE POLICY "device_sim_recharges_tenant_select" ON device_sim_recharges
  FOR SELECT USING (public.is_super_admin() OR company_id = public.get_company_id());

CREATE POLICY "device_sim_recharges_tenant_insert" ON device_sim_recharges
  FOR INSERT WITH CHECK (public.is_super_admin() OR company_id = public.get_company_id());

CREATE POLICY "device_sim_recharges_tenant_update" ON device_sim_recharges
  FOR UPDATE USING (public.is_super_admin() OR company_id = public.get_company_id());

CREATE POLICY "device_sim_recharges_tenant_delete" ON device_sim_recharges
  FOR DELETE USING (public.is_super_admin() OR company_id = public.get_company_id());

CREATE INDEX IF NOT EXISTS idx_device_sim_recharges_device_date
  ON device_sim_recharges(device_id, recharge_date DESC);

CREATE INDEX IF NOT EXISTS idx_device_sim_recharges_company_due
  ON device_sim_recharges(company_id, next_recharge_date DESC);

CREATE OR REPLACE FUNCTION set_device_sim_recharges_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_device_sim_recharges_updated_at ON device_sim_recharges;
CREATE TRIGGER trg_device_sim_recharges_updated_at
  BEFORE UPDATE ON device_sim_recharges
  FOR EACH ROW EXECUTE FUNCTION set_device_sim_recharges_updated_at();

CREATE OR REPLACE FUNCTION create_sim_recharge_alerts()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_created int := 0;
  r record;
  v_vehicle_id uuid;
  v_days_left int;
  v_status text;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (dsr.device_id)
      dsr.*,
      gd.imei,
      gd.model,
      gd.sim_iccid
    FROM device_sim_recharges dsr
    JOIN gps_devices gd ON gd.id = dsr.device_id
    WHERE gd.source_type = 'hardware'
    ORDER BY dsr.device_id, dsr.recharge_date DESC, dsr.created_at DESC
  LOOP
    v_days_left := r.next_recharge_date - current_date;

    IF v_days_left > r.alert_days_before THEN
      CONTINUE;
    END IF;

    SELECT id INTO v_vehicle_id
    FROM vehicles
    WHERE device_id = r.device_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_vehicle_id IS NULL THEN
      CONTINUE;
    END IF;

    v_status := CASE WHEN v_days_left < 0 THEN 'overdue' ELSE 'due_soon' END;

    IF EXISTS (
      SELECT 1
      FROM alerts
      WHERE company_id = r.company_id
        AND vehicle_id = v_vehicle_id
        AND type = 'sim_balance_due'
        AND acknowledged_at IS NULL
        AND payload->>'device_id' = r.device_id::text
        AND payload->>'next_recharge_date' = r.next_recharge_date::text
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO alerts (
      company_id,
      vehicle_id,
      type,
      severity,
      title,
      message,
      payload
    ) VALUES (
      r.company_id,
      v_vehicle_id,
      'sim_balance_due',
      CASE WHEN v_days_left < 0 THEN 'high'::alert_severity ELSE 'medium'::alert_severity END,
      CASE WHEN v_days_left < 0 THEN 'Recarga de chip vencida' ELSE 'Recarga de chip proxima' END,
      format(
        'El chip %s del GPS %s vence el %s. %s',
        r.carrier,
        COALESCE(r.imei, r.model),
        r.next_recharge_date,
        CASE
          WHEN v_days_left < 0 THEN format('Tiene %s dia(s) vencido.', abs(v_days_left))
          WHEN v_days_left = 0 THEN 'Vence hoy.'
          ELSE format('Faltan %s dia(s) para recargar.', v_days_left)
        END
      ),
      jsonb_build_object(
        'device_id', r.device_id,
        'recharge_id', r.id,
        'carrier', r.carrier,
        'phone_num', r.phone_num,
        'sim_iccid', r.sim_iccid,
        'recharge_date', r.recharge_date,
        'next_recharge_date', r.next_recharge_date,
        'days_left', v_days_left,
        'status', v_status
      )
    );

    v_created := v_created + 1;
  END LOOP;

  RETURN v_created;
END;
$$;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'create-sim-recharge-alerts';

    PERFORM cron.schedule(
      'create-sim-recharge-alerts',
      '0 8 * * *',
      $job$SELECT create_sim_recharge_alerts()$job$
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'SIM recharge cron skipped: %', SQLERRM;
END;
$cron$;
