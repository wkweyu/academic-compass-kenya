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
