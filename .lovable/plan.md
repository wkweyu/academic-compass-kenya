

## Fleet Management Module

### Overview
Add a comprehensive fleet management system to the Transport module with vehicle registry, driver management, fuel voucher workflow (issue blank → fill at station → convert to consumption record), and fleet reports.

### Database Tables

**`fleet_vehicles`** — Vehicle registry
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| school_id | bigint FK | |
| registration_number | varchar(20) | Unique per school |
| make | varchar(100) | e.g. Isuzu |
| model | varchar(100) | e.g. NQR |
| capacity | int | Seating capacity |
| year_of_manufacture | int | |
| engine_number | varchar(100) | |
| chassis_number | varchar(100) | |
| insurance_expiry | date | nullable |
| inspection_expiry | date | nullable |
| assigned_route_id | bigint FK transport_transportroute | nullable |
| assigned_driver_id | bigint FK fleet_drivers | nullable |
| status | varchar(20) | 'active', 'maintenance', 'decommissioned' |
| fuel_type | varchar(20) | 'diesel', 'petrol' |
| current_mileage | int | Latest odometer reading |
| created_at | timestamptz | |

**`fleet_drivers`** — Driver registry
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| school_id | bigint FK | |
| full_name | varchar(255) | |
| phone | varchar(20) | |
| license_number | varchar(100) | |
| license_expiry | date | |
| id_number | varchar(50) | National ID |
| is_active | boolean | default true |
| created_at | timestamptz | |

**`fleet_fuel_vouchers`** — Fuel voucher lifecycle
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| school_id | bigint FK | |
| voucher_number | varchar(50) | Auto-generated |
| vehicle_id | bigint FK fleet_vehicles | |
| driver_id | bigint FK fleet_drivers | nullable |
| issued_date | date | Date voucher was issued |
| issued_by | uuid FK auth.users | nullable |
| status | varchar(20) | 'issued', 'filled', 'cancelled' |
| mileage_at_issue | int | Odometer when issued |
| authorized_amount | numeric(12,2) | Max fuel amount authorized |
| authorized_litres | numeric(10,2) | nullable, max litres |
| -- Filled at station (null until converted) -- | | |
| station_name | varchar(255) | nullable |
| litres_filled | numeric(10,2) | nullable |
| price_per_litre | numeric(10,2) | nullable |
| actual_amount | numeric(12,2) | nullable |
| mileage_at_fill | int | nullable |
| fill_date | date | nullable |
| receipt_number | varchar(100) | nullable, station receipt |
| converted_at | timestamptz | nullable |
| remarks | text | nullable |
| created_at | timestamptz | |

RLS: All tables school-scoped via `get_user_school_id()`.

### Frontend Changes

**Expand `TransportModule.tsx`** tabs to include:
- **Fleet** tab — Vehicle CRUD (registration, make/model, capacity, status, assigned route/driver, insurance/inspection expiry alerts)
- **Drivers** tab — Driver CRUD (name, phone, license details, active status)
- **Fuel Vouchers** tab — Three sub-views:
  1. **Issue Voucher**: Select vehicle, driver, enter authorized amount/litres, current mileage → generates a printable blank voucher form with school header, vehicle details, authorization, signature blocks
  2. **Pending Vouchers**: List of vouchers with status='issued' → click to "Convert" which opens a form to fill: station name, litres, price/litre, actual amount, fill mileage, receipt number → updates status to 'filled' and updates vehicle current_mileage
  3. **Voucher History**: All vouchers with filters by vehicle, date range, status

**Printable Fuel Voucher Form** — Clean document with:
- School name/logo header
- Voucher number, date
- Vehicle: reg number, make/model, fuel type
- Driver name, license
- Odometer reading at issue
- Authorized amount/litres
- Blank fields for: station name, litres filled, price/litre, total cost, receipt no, fill date
- Signature blocks: Authorized by, Driver, Station attendant

**Fleet Reports** sub-tab:
- Fuel consumption per vehicle (litres, cost, km/litre efficiency)
- Vehicle fleet summary (status, mileage, insurance/inspection alerts)

### Service Layer

**New `src/services/fleetService.ts`**:
- Vehicle CRUD, Driver CRUD
- `issueVoucher()` — creates voucher with status='issued', auto-generates voucher number
- `convertVoucher()` — updates voucher with station details, sets status='filled', updates vehicle mileage
- `getVouchers()` — filtered by status, vehicle, date range
- `getFuelConsumptionReport()` — aggregates filled vouchers by vehicle for a date range

### Integration
- Add Fleet, Drivers, Fuel Vouchers tabs to the existing `TransportModule.tsx` TabsList
- No changes to existing routes/students/reports tabs

