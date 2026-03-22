
-- Fleet Trip Logs
CREATE TABLE public.fleet_trip_logs (
  id bigserial PRIMARY KEY,
  school_id bigint NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  vehicle_id bigint NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  driver_id bigint REFERENCES public.fleet_drivers(id) ON DELETE SET NULL,
  route_id bigint REFERENCES public.transport_transportroute(id) ON DELETE SET NULL,
  trip_date date NOT NULL DEFAULT CURRENT_DATE,
  trip_type varchar(20) NOT NULL DEFAULT 'morning',
  departure_time time,
  arrival_time time,
  departure_location varchar(255) DEFAULT '',
  arrival_location varchar(255) DEFAULT '',
  mileage_start int NOT NULL DEFAULT 0,
  mileage_end int,
  passenger_count int NOT NULL DEFAULT 0,
  notes text,
  status varchar(20) NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fleet_trip_logs_school ON public.fleet_trip_logs(school_id);
CREATE INDEX idx_fleet_trip_logs_vehicle ON public.fleet_trip_logs(vehicle_id);
CREATE INDEX idx_fleet_trip_logs_date ON public.fleet_trip_logs(trip_date);

ALTER TABLE public.fleet_trip_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School users can manage fleet_trip_logs"
  ON public.fleet_trip_logs FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id())
  WITH CHECK (school_id = public.get_user_school_id());
