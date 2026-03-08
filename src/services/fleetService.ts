import { supabase } from "@/integrations/supabase/client";

// ─── Types ───

export interface FleetVehicle {
  id: number;
  school_id: number;
  registration_number: string;
  make: string;
  model: string;
  capacity: number;
  year_of_manufacture: number | null;
  engine_number: string;
  chassis_number: string;
  insurance_expiry: string | null;
  inspection_expiry: string | null;
  assigned_route_id: number | null;
  assigned_driver_id: number | null;
  status: string;
  fuel_type: string;
  current_mileage: number;
  created_at: string;
  route_name?: string;
  driver_name?: string;
}

export interface FleetDriver {
  id: number;
  school_id: number;
  full_name: string;
  phone: string;
  license_number: string;
  license_expiry: string | null;
  id_number: string;
  is_active: boolean;
  created_at: string;
}

export interface FuelVoucher {
  id: number;
  school_id: number;
  voucher_number: string;
  vehicle_id: number;
  driver_id: number | null;
  issued_date: string;
  issued_by: string | null;
  status: string;
  mileage_at_issue: number;
  authorized_amount: number;
  authorized_litres: number | null;
  station_name: string | null;
  litres_filled: number | null;
  price_per_litre: number | null;
  actual_amount: number | null;
  mileage_at_fill: number | null;
  fill_date: string | null;
  receipt_number: string | null;
  converted_at: string | null;
  remarks: string | null;
  created_at: string;
  // joined
  vehicle_reg?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_fuel_type?: string;
  driver_name?: string;
  driver_license?: string;
}

// ─── Vehicles ───

export const getFleetVehicles = async (): Promise<FleetVehicle[]> => {
  const { data, error } = await supabase
    .from('fleet_vehicles')
    .select('*, fleet_drivers(full_name), transport_transportroute(name)')
    .order('registration_number');
  if (error) throw error;
  return (data || []).map((v: any) => ({
    ...v,
    route_name: v.transport_transportroute?.name || '',
    driver_name: v.fleet_drivers?.full_name || '',
  }));
};

export const createFleetVehicle = async (vehicle: Partial<FleetVehicle>): Promise<FleetVehicle> => {
  const { data: schoolId } = await supabase.rpc('get_user_school_id');
  const { data, error } = await supabase
    .from('fleet_vehicles')
    .insert({ ...vehicle, school_id: schoolId })
    .select()
    .single();
  if (error) throw error;
  return data as FleetVehicle;
};

export const updateFleetVehicle = async (id: number, vehicle: Partial<FleetVehicle>): Promise<FleetVehicle> => {
  const { school_id, id: _id, ...rest } = vehicle as any;
  const { data, error } = await supabase
    .from('fleet_vehicles')
    .update(rest)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as FleetVehicle;
};

export const deleteFleetVehicle = async (id: number): Promise<void> => {
  const { error } = await supabase.from('fleet_vehicles').delete().eq('id', id);
  if (error) throw error;
};

// ─── Drivers ───

export const getFleetDrivers = async (): Promise<FleetDriver[]> => {
  const { data, error } = await supabase
    .from('fleet_drivers')
    .select('*')
    .order('full_name');
  if (error) throw error;
  return (data || []) as FleetDriver[];
};

export const createFleetDriver = async (driver: Partial<FleetDriver>): Promise<FleetDriver> => {
  const { data: schoolId } = await supabase.rpc('get_user_school_id');
  const { data, error } = await supabase
    .from('fleet_drivers')
    .insert({ ...driver, school_id: schoolId })
    .select()
    .single();
  if (error) throw error;
  return data as FleetDriver;
};

export const updateFleetDriver = async (id: number, driver: Partial<FleetDriver>): Promise<FleetDriver> => {
  const { school_id, id: _id, ...rest } = driver as any;
  const { data, error } = await supabase
    .from('fleet_drivers')
    .update(rest)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as FleetDriver;
};

export const deleteFleetDriver = async (id: number): Promise<void> => {
  const { error } = await supabase.from('fleet_drivers').delete().eq('id', id);
  if (error) throw error;
};

// ─── Fuel Vouchers ───

export const getVouchers = async (filters?: {
  status?: string;
  vehicleId?: number;
  dateFrom?: string;
  dateTo?: string;
}): Promise<FuelVoucher[]> => {
  let query = supabase
    .from('fleet_fuel_vouchers')
    .select('*, fleet_vehicles(registration_number, make, model, fuel_type), fleet_drivers(full_name, license_number)')
    .order('created_at', { ascending: false });

  if (filters?.status && filters.status !== 'all') query = query.eq('status', filters.status);
  if (filters?.vehicleId) query = query.eq('vehicle_id', filters.vehicleId);
  if (filters?.dateFrom) query = query.gte('issued_date', filters.dateFrom);
  if (filters?.dateTo) query = query.lte('issued_date', filters.dateTo);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((v: any) => ({
    ...v,
    vehicle_reg: v.fleet_vehicles?.registration_number || '',
    vehicle_make: v.fleet_vehicles?.make || '',
    vehicle_model: v.fleet_vehicles?.model || '',
    vehicle_fuel_type: v.fleet_vehicles?.fuel_type || '',
    driver_name: v.fleet_drivers?.full_name || '',
    driver_license: v.fleet_drivers?.license_number || '',
  }));
};

export const issueVoucher = async (params: {
  vehicle_id: number;
  driver_id: number | null;
  mileage_at_issue: number;
  authorized_amount: number;
  authorized_litres?: number | null;
  remarks?: string;
}): Promise<FuelVoucher> => {
  const { data: schoolId } = await supabase.rpc('get_user_school_id');
  if (!schoolId) throw new Error('No school found');

  const { data: voucherNumber } = await supabase.rpc('generate_fuel_voucher_number', { p_school_id: schoolId });

  const { data: userData } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('fleet_fuel_vouchers')
    .insert({
      school_id: schoolId,
      voucher_number: voucherNumber,
      vehicle_id: params.vehicle_id,
      driver_id: params.driver_id,
      mileage_at_issue: params.mileage_at_issue,
      authorized_amount: params.authorized_amount,
      authorized_litres: params.authorized_litres || null,
      remarks: params.remarks || null,
      issued_by: userData?.user?.id || null,
      status: 'issued',
      issued_date: new Date().toISOString().split('T')[0],
    })
    .select('*, fleet_vehicles(registration_number, make, model, fuel_type), fleet_drivers(full_name, license_number)')
    .single();

  if (error) throw error;
  return {
    ...data,
    vehicle_reg: (data as any).fleet_vehicles?.registration_number || '',
    vehicle_make: (data as any).fleet_vehicles?.make || '',
    vehicle_model: (data as any).fleet_vehicles?.model || '',
    vehicle_fuel_type: (data as any).fleet_vehicles?.fuel_type || '',
    driver_name: (data as any).fleet_drivers?.full_name || '',
    driver_license: (data as any).fleet_drivers?.license_number || '',
  } as FuelVoucher;
};

export const convertVoucher = async (
  voucherId: number,
  fillData: {
    station_name: string;
    litres_filled: number;
    price_per_litre: number;
    actual_amount: number;
    mileage_at_fill: number;
    fill_date: string;
    receipt_number: string;
  }
): Promise<void> => {
  const { data: voucher, error: fetchErr } = await supabase
    .from('fleet_fuel_vouchers')
    .select('vehicle_id')
    .eq('id', voucherId)
    .single();
  if (fetchErr) throw fetchErr;

  const { error } = await supabase
    .from('fleet_fuel_vouchers')
    .update({
      ...fillData,
      status: 'filled',
      converted_at: new Date().toISOString(),
    })
    .eq('id', voucherId);
  if (error) throw error;

  // Update vehicle mileage
  await supabase
    .from('fleet_vehicles')
    .update({ current_mileage: fillData.mileage_at_fill })
    .eq('id', voucher.vehicle_id);
};

export const cancelVoucher = async (voucherId: number): Promise<void> => {
  const { error } = await supabase
    .from('fleet_fuel_vouchers')
    .update({ status: 'cancelled' })
    .eq('id', voucherId);
  if (error) throw error;
};

// ─── Reports ───

export const getFuelConsumptionReport = async (dateFrom: string, dateTo: string): Promise<any[]> => {
  const { data, error } = await supabase
    .from('fleet_fuel_vouchers')
    .select('*, fleet_vehicles(registration_number, make, model)')
    .eq('status', 'filled')
    .gte('fill_date', dateFrom)
    .lte('fill_date', dateTo)
    .order('fill_date');
  if (error) throw error;

  // Group by vehicle
  const vehicleMap: Record<number, any> = {};
  (data || []).forEach((v: any) => {
    const vid = v.vehicle_id;
    if (!vehicleMap[vid]) {
      vehicleMap[vid] = {
        vehicle_id: vid,
        registration_number: v.fleet_vehicles?.registration_number || '',
        make_model: `${v.fleet_vehicles?.make || ''} ${v.fleet_vehicles?.model || ''}`.trim(),
        total_litres: 0,
        total_cost: 0,
        voucher_count: 0,
        min_mileage: Infinity,
        max_mileage: 0,
      };
    }
    vehicleMap[vid].total_litres += Number(v.litres_filled || 0);
    vehicleMap[vid].total_cost += Number(v.actual_amount || 0);
    vehicleMap[vid].voucher_count += 1;
    if (v.mileage_at_issue < vehicleMap[vid].min_mileage) vehicleMap[vid].min_mileage = v.mileage_at_issue;
    if (v.mileage_at_fill > vehicleMap[vid].max_mileage) vehicleMap[vid].max_mileage = v.mileage_at_fill;
  });

  return Object.values(vehicleMap).map((v: any) => {
    const km = v.max_mileage - (v.min_mileage === Infinity ? 0 : v.min_mileage);
    return {
      ...v,
      km_covered: km > 0 ? km : 0,
      km_per_litre: km > 0 && v.total_litres > 0 ? (km / v.total_litres).toFixed(1) : '—',
    };
  });
};

// ─── Maintenance Types ───

export interface MaintenanceRecord {
  id: number;
  school_id: number;
  vehicle_id: number;
  service_type: string;
  description: string;
  service_date: string;
  mileage_at_service: number;
  cost: number;
  vendor: string;
  invoice_number: string;
  next_service_date: string | null;
  next_service_mileage: number | null;
  parts_replaced: string | null;
  status: string;
  created_at: string;
  vehicle_reg?: string;
  vehicle_make_model?: string;
}

export const SERVICE_TYPES = [
  { value: 'oil_change', label: 'Oil Change' },
  { value: 'tire_service', label: 'Tire Service' },
  { value: 'brake_service', label: 'Brake Service' },
  { value: 'engine_repair', label: 'Engine Repair' },
  { value: 'body_work', label: 'Body Work' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'suspension', label: 'Suspension' },
  { value: 'transmission', label: 'Transmission' },
  { value: 'ac_service', label: 'A/C Service' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'general', label: 'General Service' },
];

// ─── Maintenance CRUD ───

export const getMaintenanceRecords = async (filters?: {
  vehicleId?: number;
  dateFrom?: string;
  dateTo?: string;
}): Promise<MaintenanceRecord[]> => {
  let query = supabase
    .from('fleet_maintenance_records')
    .select('*, fleet_vehicles(registration_number, make, model)')
    .order('service_date', { ascending: false });

  if (filters?.vehicleId) query = query.eq('vehicle_id', filters.vehicleId);
  if (filters?.dateFrom) query = query.gte('service_date', filters.dateFrom);
  if (filters?.dateTo) query = query.lte('service_date', filters.dateTo);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((r: any) => ({
    ...r,
    vehicle_reg: r.fleet_vehicles?.registration_number || '',
    vehicle_make_model: `${r.fleet_vehicles?.make || ''} ${r.fleet_vehicles?.model || ''}`.trim(),
  }));
};

export const createMaintenanceRecord = async (record: Partial<MaintenanceRecord>): Promise<MaintenanceRecord> => {
  const { data: schoolId } = await supabase.rpc('get_user_school_id');
  const { data, error } = await supabase
    .from('fleet_maintenance_records')
    .insert({ ...record, school_id: schoolId })
    .select('*, fleet_vehicles(registration_number, make, model)')
    .single();
  if (error) throw error;

  // Update vehicle status to maintenance if status is 'in_progress'
  if (record.status === 'in_progress' && record.vehicle_id) {
    await supabase.from('fleet_vehicles').update({ status: 'maintenance' }).eq('id', record.vehicle_id);
  }
  // Update mileage
  if (record.mileage_at_service && record.vehicle_id) {
    await supabase.from('fleet_vehicles').update({ current_mileage: record.mileage_at_service }).eq('id', record.vehicle_id);
  }

  return { ...data, vehicle_reg: (data as any).fleet_vehicles?.registration_number || '', vehicle_make_model: '' } as MaintenanceRecord;
};

export const updateMaintenanceRecord = async (id: number, record: Partial<MaintenanceRecord>): Promise<MaintenanceRecord> => {
  const { school_id, id: _id, vehicle_reg, vehicle_make_model, ...rest } = record as any;
  const { data, error } = await supabase
    .from('fleet_maintenance_records')
    .update(rest)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as MaintenanceRecord;
};

export const deleteMaintenanceRecord = async (id: number): Promise<void> => {
  const { error } = await supabase.from('fleet_maintenance_records').delete().eq('id', id);
  if (error) throw error;
};

// ─── Upcoming Service Alerts ───

export const getUpcomingServiceAlerts = async (): Promise<MaintenanceRecord[]> => {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const { data, error } = await supabase
    .from('fleet_maintenance_records')
    .select('*, fleet_vehicles(registration_number, make, model, current_mileage)')
    .not('next_service_date', 'is', null)
    .lte('next_service_date', thirtyDaysFromNow.toISOString().split('T')[0])
    .order('next_service_date');

  if (error) throw error;

  // Also check mileage-based alerts
  const { data: mileageAlerts, error: mileErr } = await supabase
    .from('fleet_maintenance_records')
    .select('*, fleet_vehicles(registration_number, make, model, current_mileage)')
    .not('next_service_mileage', 'is', null)
    .order('next_service_mileage');

  if (mileErr) throw mileErr;

  const dateAlerts = (data || []).map((r: any) => ({
    ...r,
    vehicle_reg: r.fleet_vehicles?.registration_number || '',
    vehicle_make_model: `${r.fleet_vehicles?.make || ''} ${r.fleet_vehicles?.model || ''}`.trim(),
    alert_type: 'date',
  }));

  const mileAlerts = (mileageAlerts || [])
    .filter((r: any) => r.fleet_vehicles?.current_mileage >= (r.next_service_mileage - 500))
    .map((r: any) => ({
      ...r,
      vehicle_reg: r.fleet_vehicles?.registration_number || '',
      vehicle_make_model: `${r.fleet_vehicles?.make || ''} ${r.fleet_vehicles?.model || ''}`.trim(),
      alert_type: 'mileage',
    }));

  // Deduplicate by id
  const map = new Map();
  [...dateAlerts, ...mileAlerts].forEach(a => { if (!map.has(a.id)) map.set(a.id, a); });
  return Array.from(map.values());
};

// ─── Maintenance Cost Report ───

export const getMaintenanceCostReport = async (dateFrom: string, dateTo: string): Promise<any[]> => {
  const { data, error } = await supabase
    .from('fleet_maintenance_records')
    .select('*, fleet_vehicles(registration_number, make, model)')
    .eq('status', 'completed')
    .gte('service_date', dateFrom)
    .lte('service_date', dateTo)
    .order('service_date');
  if (error) throw error;

  const vehicleMap: Record<number, any> = {};
  (data || []).forEach((r: any) => {
    const vid = r.vehicle_id;
    if (!vehicleMap[vid]) {
      vehicleMap[vid] = {
        vehicle_id: vid,
        registration_number: r.fleet_vehicles?.registration_number || '',
        make_model: `${r.fleet_vehicles?.make || ''} ${r.fleet_vehicles?.model || ''}`.trim(),
        total_cost: 0,
        service_count: 0,
        by_type: {} as Record<string, number>,
      };
    }
    vehicleMap[vid].total_cost += Number(r.cost || 0);
    vehicleMap[vid].service_count += 1;
    const type = r.service_type || 'general';
    vehicleMap[vid].by_type[type] = (vehicleMap[vid].by_type[type] || 0) + Number(r.cost || 0);
  });

  return Object.values(vehicleMap);
};

// ─── Trip Log Types ───

export interface TripLog {
  id: number;
  school_id: number;
  vehicle_id: number;
  driver_id: number | null;
  route_id: number | null;
  trip_date: string;
  trip_type: string;
  departure_time: string | null;
  arrival_time: string | null;
  departure_location: string;
  arrival_location: string;
  mileage_start: number;
  mileage_end: number | null;
  passenger_count: number;
  notes: string | null;
  status: string;
  created_at: string;
  vehicle_reg?: string;
  driver_name?: string;
  route_name?: string;
}

export const TRIP_TYPES = [
  { value: 'morning', label: 'Morning Pick-up' },
  { value: 'afternoon', label: 'Afternoon Drop-off' },
  { value: 'field_trip', label: 'Field Trip' },
  { value: 'sports', label: 'Sports/Events' },
  { value: 'other', label: 'Other' },
];

// ─── Trip Log CRUD ───

export const getTripLogs = async (filters?: {
  vehicleId?: number;
  dateFrom?: string;
  dateTo?: string;
  tripType?: string;
}): Promise<TripLog[]> => {
  let query = supabase
    .from('fleet_trip_logs')
    .select('*, fleet_vehicles(registration_number), fleet_drivers(full_name), transport_transportroute(name)')
    .order('trip_date', { ascending: false })
    .order('departure_time', { ascending: false });

  if (filters?.vehicleId) query = query.eq('vehicle_id', filters.vehicleId);
  if (filters?.dateFrom) query = query.gte('trip_date', filters.dateFrom);
  if (filters?.dateTo) query = query.lte('trip_date', filters.dateTo);
  if (filters?.tripType && filters.tripType !== 'all') query = query.eq('trip_type', filters.tripType);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((t: any) => ({
    ...t,
    vehicle_reg: t.fleet_vehicles?.registration_number || '',
    driver_name: t.fleet_drivers?.full_name || '',
    route_name: t.transport_transportroute?.name || '',
  }));
};

export const createTripLog = async (trip: Partial<TripLog>): Promise<TripLog> => {
  const { data: schoolId } = await supabase.rpc('get_user_school_id');
  const { data, error } = await supabase
    .from('fleet_trip_logs')
    .insert({ ...trip, school_id: schoolId })
    .select('*, fleet_vehicles(registration_number), fleet_drivers(full_name), transport_transportroute(name)')
    .single();
  if (error) throw error;

  // Update vehicle mileage if mileage_end provided
  if (trip.mileage_end && trip.vehicle_id) {
    await supabase.from('fleet_vehicles').update({ current_mileage: trip.mileage_end }).eq('id', trip.vehicle_id);
  }

  return { ...data, vehicle_reg: (data as any).fleet_vehicles?.registration_number || '', driver_name: (data as any).fleet_drivers?.full_name || '', route_name: (data as any).transport_transportroute?.name || '' } as TripLog;
};

export const updateTripLog = async (id: number, trip: Partial<TripLog>): Promise<TripLog> => {
  const { school_id, id: _id, vehicle_reg, driver_name, route_name, ...rest } = trip as any;
  const { data, error } = await supabase
    .from('fleet_trip_logs')
    .update(rest)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  if (trip.mileage_end && trip.vehicle_id) {
    await supabase.from('fleet_vehicles').update({ current_mileage: trip.mileage_end }).eq('id', trip.vehicle_id);
  }

  return data as TripLog;
};

export const deleteTripLog = async (id: number): Promise<void> => {
  const { error } = await supabase.from('fleet_trip_logs').delete().eq('id', id);
  if (error) throw error;
};

// ─── Trip Reports ───

export const getTripSummaryReport = async (dateFrom: string, dateTo: string): Promise<any[]> => {
  const { data, error } = await supabase
    .from('fleet_trip_logs')
    .select('*, fleet_vehicles(registration_number, make, model)')
    .gte('trip_date', dateFrom)
    .lte('trip_date', dateTo)
    .order('trip_date');
  if (error) throw error;

  const vehicleMap: Record<number, any> = {};
  (data || []).forEach((t: any) => {
    const vid = t.vehicle_id;
    if (!vehicleMap[vid]) {
      vehicleMap[vid] = {
        vehicle_id: vid,
        registration_number: t.fleet_vehicles?.registration_number || '',
        make_model: `${t.fleet_vehicles?.make || ''} ${t.fleet_vehicles?.model || ''}`.trim(),
        trip_count: 0,
        total_passengers: 0,
        total_km: 0,
        by_type: {} as Record<string, number>,
      };
    }
    vehicleMap[vid].trip_count += 1;
    vehicleMap[vid].total_passengers += t.passenger_count || 0;
    const km = (t.mileage_end && t.mileage_start) ? (t.mileage_end - t.mileage_start) : 0;
    vehicleMap[vid].total_km += Math.max(0, km);
    const type = t.trip_type || 'other';
    vehicleMap[vid].by_type[type] = (vehicleMap[vid].by_type[type] || 0) + 1;
  });

  return Object.values(vehicleMap);
};
