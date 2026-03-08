
-- Fleet Drivers table (created first since fleet_vehicles references it)
CREATE TABLE public.fleet_drivers (
  id bigserial PRIMARY KEY,
  school_id bigint NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  full_name varchar(255) NOT NULL,
  phone varchar(20) DEFAULT '',
  license_number varchar(100) DEFAULT '',
  license_expiry date,
  id_number varchar(50) DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Fleet Vehicles table
CREATE TABLE public.fleet_vehicles (
  id bigserial PRIMARY KEY,
  school_id bigint NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  registration_number varchar(20) NOT NULL,
  make varchar(100) DEFAULT '',
  model varchar(100) DEFAULT '',
  capacity int DEFAULT 0,
  year_of_manufacture int,
  engine_number varchar(100) DEFAULT '',
  chassis_number varchar(100) DEFAULT '',
  insurance_expiry date,
  inspection_expiry date,
  assigned_route_id bigint REFERENCES public.transport_transportroute(id) ON DELETE SET NULL,
  assigned_driver_id bigint REFERENCES public.fleet_drivers(id) ON DELETE SET NULL,
  status varchar(20) NOT NULL DEFAULT 'active',
  fuel_type varchar(20) NOT NULL DEFAULT 'diesel',
  current_mileage int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, registration_number)
);

-- Fleet Fuel Vouchers table
CREATE TABLE public.fleet_fuel_vouchers (
  id bigserial PRIMARY KEY,
  school_id bigint NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  voucher_number varchar(50) NOT NULL,
  vehicle_id bigint NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  driver_id bigint REFERENCES public.fleet_drivers(id) ON DELETE SET NULL,
  issued_date date NOT NULL DEFAULT CURRENT_DATE,
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status varchar(20) NOT NULL DEFAULT 'issued',
  mileage_at_issue int NOT NULL DEFAULT 0,
  authorized_amount numeric(12,2) NOT NULL DEFAULT 0,
  authorized_litres numeric(10,2),
  station_name varchar(255),
  litres_filled numeric(10,2),
  price_per_litre numeric(10,2),
  actual_amount numeric(12,2),
  mileage_at_fill int,
  fill_date date,
  receipt_number varchar(100),
  converted_at timestamptz,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_fleet_vehicles_school ON public.fleet_vehicles(school_id);
CREATE INDEX idx_fleet_drivers_school ON public.fleet_drivers(school_id);
CREATE INDEX idx_fleet_fuel_vouchers_school ON public.fleet_fuel_vouchers(school_id);
CREATE INDEX idx_fleet_fuel_vouchers_vehicle ON public.fleet_fuel_vouchers(vehicle_id);
CREATE INDEX idx_fleet_fuel_vouchers_status ON public.fleet_fuel_vouchers(status);

-- RLS
ALTER TABLE public.fleet_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_fuel_vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School users can manage fleet_drivers"
  ON public.fleet_drivers FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id())
  WITH CHECK (school_id = public.get_user_school_id());

CREATE POLICY "School users can manage fleet_vehicles"
  ON public.fleet_vehicles FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id())
  WITH CHECK (school_id = public.get_user_school_id());

CREATE POLICY "School users can manage fleet_fuel_vouchers"
  ON public.fleet_fuel_vouchers FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id())
  WITH CHECK (school_id = public.get_user_school_id());

-- Voucher number generator
CREATE OR REPLACE FUNCTION public.generate_fuel_voucher_number(p_school_id bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  year_str TEXT;
  counter INTEGER;
BEGIN
  year_str := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  SELECT COALESCE(MAX(
    CASE WHEN voucher_number ~ ('^FV' || year_str || '[0-9]+$')
    THEN CAST(SUBSTRING(voucher_number FROM LENGTH('FV' || year_str) + 1) AS INTEGER)
    ELSE 0 END
  ), 0) + 1 INTO counter
  FROM public.fleet_fuel_vouchers
  WHERE school_id = p_school_id AND voucher_number LIKE 'FV' || year_str || '%';
  
  RETURN 'FV' || year_str || LPAD(counter::TEXT, 4, '0');
END;
$$;
