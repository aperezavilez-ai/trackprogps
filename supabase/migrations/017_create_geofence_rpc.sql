-- RPC para crear geocerca con geometría PostGIS y asignación de vehículos
CREATE OR REPLACE FUNCTION create_geofence(
  p_company_id    uuid,
  p_name          text,
  p_type          geofence_type,
  p_geometry_json text,
  p_radius_m      float4,
  p_color         varchar,
  p_alert_enter   boolean,
  p_alert_exit    boolean,
  p_alert_dwell   boolean,
  p_created_by    uuid,
  p_vehicle_ids   uuid[] DEFAULT NULL
)
RETURNS geofences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row geofences;
BEGIN
  INSERT INTO geofences (
    company_id, name, type, geometry, radius_m, color,
    alert_on_enter, alert_on_exit, alert_on_dwell,
    vehicle_ids, is_active, created_by
  ) VALUES (
    p_company_id,
    p_name,
    p_type,
    ST_SetSRID(ST_GeomFromGeoJSON(p_geometry_json), 4326),
    p_radius_m,
    p_color,
    p_alert_enter,
    p_alert_exit,
    p_alert_dwell,
    p_vehicle_ids,
    true,
    p_created_by
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
