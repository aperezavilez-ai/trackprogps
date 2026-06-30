-- ============================================================
-- 028_batch_positions_rpc.sql
-- Ingesta batch: upsert vehicle_positions + insert position_history
-- ============================================================

CREATE OR REPLACE FUNCTION batch_upsert_positions(p_positions jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pos jsonb;
  n int := 0;
BEGIN
  IF p_positions IS NULL OR jsonb_typeof(p_positions) <> 'array' THEN
    RETURN jsonb_build_object('processed', 0);
  END IF;

  FOR pos IN SELECT value FROM jsonb_array_elements(p_positions) AS t(value)
  LOOP
    INSERT INTO vehicle_positions (
      vehicle_id, company_id, device_id,
      lat, lng, speed, heading, altitude,
      ignition, odometer, gsm_signal, battery_lvl, satellites,
      raw_io, recorded_at, server_at
    ) VALUES (
      (pos->>'vehicle_id')::uuid,
      (pos->>'company_id')::uuid,
      (pos->>'device_id')::uuid,
      (pos->>'lat')::float8,
      (pos->>'lng')::float8,
      COALESCE((pos->>'speed')::float4, 0),
      COALESCE((pos->>'heading')::int2, 0),
      (pos->>'altitude')::float4,
      COALESCE((pos->>'ignition')::boolean, false),
      COALESCE((pos->>'odometer')::float8, 0),
      COALESCE((pos->>'gsm_signal')::int2, 0),
      COALESCE((pos->>'battery_lvl')::int2, 0),
      (pos->>'satellites')::int2,
      pos->'raw_io',
      (pos->>'recorded_at')::timestamptz,
      COALESCE((pos->>'server_at')::timestamptz, now())
    )
    ON CONFLICT (vehicle_id) DO UPDATE SET
      company_id   = EXCLUDED.company_id,
      device_id    = EXCLUDED.device_id,
      lat          = EXCLUDED.lat,
      lng          = EXCLUDED.lng,
      speed        = EXCLUDED.speed,
      heading      = EXCLUDED.heading,
      altitude     = EXCLUDED.altitude,
      ignition     = EXCLUDED.ignition,
      odometer     = EXCLUDED.odometer,
      gsm_signal   = EXCLUDED.gsm_signal,
      battery_lvl  = EXCLUDED.battery_lvl,
      satellites   = EXCLUDED.satellites,
      raw_io       = EXCLUDED.raw_io,
      recorded_at  = EXCLUDED.recorded_at,
      server_at    = EXCLUDED.server_at;

    INSERT INTO position_history (
      vehicle_id, company_id, device_id,
      lat, lng, speed, heading, altitude,
      ignition, odometer, gsm_signal, battery_lvl, satellites,
      raw_io, recorded_at, server_at
    ) VALUES (
      (pos->>'vehicle_id')::uuid,
      (pos->>'company_id')::uuid,
      (pos->>'device_id')::uuid,
      (pos->>'lat')::float8,
      (pos->>'lng')::float8,
      COALESCE((pos->>'speed')::float4, 0),
      COALESCE((pos->>'heading')::int2, 0),
      (pos->>'altitude')::float4,
      COALESCE((pos->>'ignition')::boolean, false),
      COALESCE((pos->>'odometer')::float8, 0),
      COALESCE((pos->>'gsm_signal')::int2, 0),
      COALESCE((pos->>'battery_lvl')::int2, 0),
      (pos->>'satellites')::int2,
      pos->'raw_io',
      (pos->>'recorded_at')::timestamptz,
      COALESCE((pos->>'server_at')::timestamptz, now())
    );

    n := n + 1;
  END LOOP;

  RETURN jsonb_build_object('processed', n);
END;
$$;

GRANT EXECUTE ON FUNCTION batch_upsert_positions(jsonb) TO service_role;
