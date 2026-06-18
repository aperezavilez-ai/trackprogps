export type UserRole = 'super_admin' | 'admin_empresa' | 'supervisor' | 'operador' | 'cliente_consulta';
export type CompanyStatus = 'active' | 'suspended' | 'trial' | 'cancelled';
export type PlanType = 'basico' | 'profesional' | 'empresarial';
export type VehicleStatus = 'active' | 'inactive' | 'maintenance';
export type VehicleType = 'sedan' | 'suv' | 'pickup' | 'van' | 'truck' | 'bus' | 'motorcycle' | 'other';
export type DeviceStatus = 'online' | 'offline' | 'no_signal' | 'unknown';
export type GeofenceType = 'circular' | 'polygon';
export type AlertType = 'speed_excess' | 'gps_disconnect' | 'signal_loss' | 'power_cut' | 'unauthorized_movement' | 'geofence_enter' | 'geofence_exit' | 'geofence_dwell' | 'sos' | 'maintenance_due' | 'ignition_on' | 'ignition_off' | 'battery_low';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type NotificationChannel = 'platform' | 'email' | 'whatsapp' | 'push';
export type MaintenanceType = 'oil_change' | 'tire_rotation' | 'brake_service' | 'tune_up' | 'insurance' | 'verification' | 'other';
export interface Company {
    id: string;
    name: string;
    rfc: string | null;
    phone: string | null;
    email: string;
    address: string | null;
    logo_url: string | null;
    plan_id: string;
    status: CompanyStatus;
    trial_ends_at: string | null;
    created_at: string;
    updated_at: string;
}
export interface Plan {
    id: string;
    name: string;
    type: PlanType;
    max_vehicles: number;
    max_users: number;
    price_monthly: number;
    price_yearly: number;
    features: PlanFeatures;
    is_active: boolean;
    created_at: string;
}
export interface PlanFeatures {
    realtime_map: boolean;
    route_history_days: number;
    alerts: boolean;
    geofences: boolean;
    reports: boolean;
    maintenance: boolean;
    mobile_app: boolean;
    ai_assistant: boolean;
    api_access: boolean;
    white_label: boolean;
}
export interface User {
    id: string;
    company_id: string;
    email: string;
    full_name: string;
    role: UserRole;
    phone: string | null;
    avatar_url: string | null;
    is_active: boolean;
    last_sign_in_at: string | null;
    created_at: string;
    updated_at: string;
}
export interface Vehicle {
    id: string;
    company_id: string;
    device_id: string | null;
    driver_id: string | null;
    economic_num: string;
    plates: string;
    brand: string;
    model: string;
    year: number;
    vin: string | null;
    type: VehicleType;
    color: string | null;
    status: VehicleStatus;
    odometer_offset: number;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
}
export interface VehicleWithRelations extends Vehicle {
    device: GpsDevice | null;
    driver: Driver | null;
    current_position: VehiclePosition | null;
}
export interface Driver {
    id: string;
    company_id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    license_num: string;
    license_exp: string;
    photo_url: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
}
export interface GpsDevice {
    id: string;
    company_id: string;
    imei: string;
    model: string;
    firmware_ver: string | null;
    sim_iccid: string | null;
    phone_num: string | null;
    last_seen: string | null;
    status: DeviceStatus;
    created_at: string;
    updated_at: string;
}
export interface VehiclePosition {
    id: string;
    vehicle_id: string;
    company_id: string;
    device_id: string;
    lat: number;
    lng: number;
    speed: number;
    heading: number;
    altitude: number | null;
    ignition: boolean;
    odometer: number;
    gsm_signal: number;
    battery_lvl: number;
    satellites: number | null;
    raw_io: Record<string, unknown> | null;
    recorded_at: string;
    server_at: string;
}
export interface PositionHistory extends VehiclePosition {
    trip_id: string | null;
}
export interface LiveVehicle {
    vehicle_id: string;
    company_id: string;
    device_id?: string | null;
    economic_num: string;
    plates: string;
    brand: string;
    model: string;
    driver_name: string | null;
    device_status: DeviceStatus;
    lat: number;
    lng: number;
    speed: number;
    heading: number;
    ignition: boolean;
    odometer: number;
    last_update: string;
}
export interface Geofence {
    id: string;
    company_id: string;
    name: string;
    type: GeofenceType;
    geometry: GeofenceGeometry;
    radius_m: number | null;
    color: string;
    alert_on_enter: boolean;
    alert_on_exit: boolean;
    alert_on_dwell: boolean;
    dwell_minutes: number | null;
    schedule: GeofenceSchedule | null;
    vehicle_ids: string[] | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}
export interface GeofenceGeometry {
    type: 'Point' | 'Polygon';
    coordinates: number[] | number[][][];
}
export interface GeofenceSchedule {
    days: number[];
    start_time: string;
    end_time: string;
    timezone: string;
}
export interface Alert {
    id: string;
    company_id: string;
    vehicle_id: string;
    device_id: string | null;
    geofence_id: string | null;
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    lat: number | null;
    lng: number | null;
    speed: number | null;
    payload: Record<string, unknown>;
    channels_sent: NotificationChannel[];
    acknowledged_by: string | null;
    acknowledged_at: string | null;
    created_at: string;
}
export interface AlertRule {
    id: string;
    company_id: string;
    type: AlertType;
    name: string;
    is_active: boolean;
    config: AlertRuleConfig;
    vehicle_ids: string[] | null;
    channels: NotificationChannel[];
    created_at: string;
    updated_at: string;
}
export interface AlertRuleConfig {
    speed_limit?: number;
    dwell_minutes?: number;
    geofence_id?: string;
    time_schedule?: GeofenceSchedule;
}
export interface MaintenanceRecord {
    id: string;
    company_id: string;
    vehicle_id: string;
    type: MaintenanceType;
    description: string;
    cost: number | null;
    currency: string;
    odometer_at: number | null;
    next_odometer: number | null;
    service_date: string;
    next_service_date: string | null;
    workshop: string | null;
    notes: string | null;
    attachments: string[];
    created_by: string;
    created_at: string;
}
export interface Subscription {
    id: string;
    company_id: string;
    plan_id: string;
    status: 'active' | 'past_due' | 'cancelled' | 'trialing';
    current_period_start: string;
    current_period_end: string;
    stripe_subscription_id: string | null;
    stripe_customer_id: string | null;
    cancel_at_period_end: boolean;
    created_at: string;
    updated_at: string;
}
export interface ApiResponse<T> {
    data: T | null;
    error: string | null;
    message?: string;
}
export interface PaginatedResponse<T> {
    data: T[];
    count: number;
    page: number;
    per_page: number;
    total_pages: number;
}
export interface PaginationParams {
    page?: number;
    per_page?: number;
    search?: string;
    order_by?: string;
    order?: 'asc' | 'desc';
}
export interface TeltonikaPacket {
    imei: string;
    codec: 8 | 8 | 16;
    records: TeltonikaRecord[];
    raw: Buffer;
}
export interface TeltonikaRecord {
    timestamp: Date;
    priority: 0 | 1 | 2;
    lat: number;
    lng: number;
    altitude: number;
    heading: number;
    satellites: number;
    speed: number;
    io_elements: TeltonikaIOElements;
}
export interface TeltonikaIOElements {
    event_io_id: number;
    total_io: number;
    ignition?: boolean;
    movement?: boolean;
    gsm_signal?: number;
    speed?: number;
    battery_voltage?: number;
    external_voltage?: number;
    odometer?: number;
    total_odometer?: number;
    gnss_status?: number;
    gnss_pdop?: number;
    gnss_hdop?: number;
    sleep_mode?: number;
    [key: string]: unknown;
}
export interface DashboardStats {
    total_vehicles: number;
    vehicles_online: number;
    vehicles_stopped: number;
    vehicles_offline: number;
    vehicles_no_signal: number;
    active_alerts: number;
    km_today: number;
    km_month: number;
    productivity_today: number;
    productivity_month: number;
}
export interface ReportFilter {
    vehicle_ids?: string[];
    driver_ids?: string[];
    date_from: string;
    date_to: string;
    group_by?: 'day' | 'week' | 'month';
}
export interface KilometrageReport {
    vehicle_id: string;
    economic_num: string;
    plates: string;
    driver_name: string | null;
    total_km: number;
    trips: number;
    avg_speed: number;
    max_speed: number;
    driving_time_minutes: number;
    stopped_time_minutes: number;
}
export interface TripReport {
    id: string;
    vehicle_id: string;
    started_at: string;
    ended_at: string;
    start_address: string | null;
    end_address: string | null;
    distance_km: number;
    duration_minutes: number;
    avg_speed: number;
    max_speed: number;
    points: Array<{
        lat: number;
        lng: number;
        speed: number;
        ts: string;
    }>;
}
//# sourceMappingURL=index.d.ts.map