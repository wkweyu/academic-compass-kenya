
-- Fleet Maintenance Records
CREATE TABLE public.fleet_maintenance_records (
  id bigserial PRIMARY KEY,
  school_id bigint NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  vehicle_id bigint NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  service_type varchar(50) NOT NULL DEFAULT 'general',
  description text NOT NULL DEFAULT '',
  service_date date NOT NULL DEFAULT CURRENT_DATE,
  mileage_at_service int NOT NULL DEFAULT 0,
  cost numeric(12,2) NOT NULL DEFAULT 0,
  vendor varchar(255) DEFAULT '',
  invoice_number varchar(100) DEFAULT '',
  next_service_date date,
  next_service_mileage int,
  parts_replaced text,
  status varchar(20) NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fleet_maintenance_school ON public.fleet_maintenance_records(school_id);
CREATE INDEX idx_fleet_maintenance_vehicle ON public.fleet_maintenance_records(vehicle_id);
CREATE INDEX idx_fleet_maintenance_next_date ON public.fleet_maintenance_records(next_service_date);

ALTER TABLE public.fleet_maintenance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School users can manage fleet_maintenance_records"
  ON public.fleet_maintenance_records FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id())
  WITH CHECK (school_id = public.get_user_school_id());
