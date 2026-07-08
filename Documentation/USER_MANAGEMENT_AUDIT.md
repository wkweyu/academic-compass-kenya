# User Management Architecture Audit - Report

## 1. Current Backend Architecture
The backend user management is centralized in the `apps.users` module.

- **Central Service**: `apps.users.services.AccountService.provision_account` is the primary logic engine. It handles:
  - Creating/Updating Django `User` records.
  - Syncing with Supabase Auth via the Admin API.
  - Generating unique usernames.
  - Handling entity linkage (e.g., connecting a User to a Teacher or Student record).
  - Managing invitations and audit logging.
- **Models**: The custom `User` model (`apps/users/models.py`) extends `AbstractUser` and adds `school`, `auth_user_id` (linking to Supabase), `role`, `entity_type`, and `entity_id`.
- **Authentication**: The system uses `SupabaseJWTAuthentication` to validate Supabase tokens for Django API requests.
- **Authorization**: Permissions are largely role-based, with roles stored in the Supabase `user_roles` table. Backend logic in `views.py` and `services.py` enforces tenant isolation (`school_id` checks).

## 2. Current Frontend Architecture
The frontend is divided into platform-level (SaaS) and school-level management.

- **Platform Management**: Highly functional. Managed in `SaaSDashboardPage.tsx`. It uses `saasService.ts` to call Supabase Edge Functions (`create-platform-user`, `delete-platform-user`) which in turn interact with both Supabase Auth and the Django backend.
- **School Management**:
  - **Initial Admin**: Created during the school onboarding process via the `create-school-admin` Edge Function.
  - **School UI**: There is **no dedicated User Management or Access Control UI** currently visible to school administrators.
  - **Entity Modules**: The `TeacherManagementModule` and `StudentManagementModule` manage "business entities" (HR records). They do **not** trigger user account creation.

## 3. Endpoint Usage Matrix

| Endpoint | Backend View | Frontend Caller | Status |
| :--- | :--- | :--- | :--- |
| `GET /api/users/` | `UserListView` | `saasService.listManagedUsers` | **Active** (SaaS Dashboard) |
| `POST /api/users/` | `UserListView` | N/A (Called via Edge Function) | **Active** (Platform Users) |
| `POST /api/users/enable-login/` | `EnableLoginView` | **None** | **Disconnected** |
| `POST /api/users/repair-platform-links/` | `PlatformUserRepairView` | `saasService.repairPlatformLinks` | **Active** (Maintenance) |
| `GET /api/users/me/` | `CurrentUserView` | `authService.getCurrentUser` | **Active** (Auth Flow) |
| `GET /api/users/<id>/role-change/preview/` | `UserRoleChangePreviewView` | **None** | **Unused** |
| `POST /api/users/<id>/role-change/` | `UserRoleChangeView` | **None** | **Unused** |

## 4. User Creation flows

### Platform User Flow
1. **Trigger**: Platform Admin clicks "New User" in SaaS Dashboard.
2. **Action**: `saasService.createManagedUser` invokes `create-platform-user` Edge Function.
3. **Execution**: Edge Function creates Supabase Auth user -> Inserts/Updates record in Django `users` table -> Assigns role in `user_roles`.
4. **End**: User receives welcome email and can log in via `/saas/login`.

### School Admin Flow (Initial)
1. **Trigger**: Platform Admin completes "Onboard School" flow.
2. **Action**: `saasService.provisionSchoolAdminAccess` invokes `create-school-admin` Edge Function.
3. **Execution**: Similar to platform flow, but associates user with `school_id` and grants `schooladmin` role.
4. **End**: School Admin receives credentials and can log in via `/auth`.

### School Staff / Teacher / Student Flow (Current)
1. **Trigger**: School Admin adds a staff member or student.
2. **Action**: `staffService.createStaff` or `studentService.createStudent` is called.
3. **Execution**: Direct insert into `teachers` or `students` table.
4. **End**: **No login account is created.** The record exists only for HR/Academic purposes.

## 5. Gap Analysis

### Existing Functionality
- **Robust Platform Management**: Creating, listing, and deleting platform-level staff works correctly.
- **Onboarding Pipeline**: The transition from school creation to admin provisioning is well-implemented.
- **Backend Service Layer**: `AccountService` is highly capable and supports "Enable Login" logic, even though the UI doesn't call it yet.

### Missing Functionality
- **School-level User Management UI**: There is no page for a School Admin to see a list of people who have login access to their school.
- **Enable Login Action**: There is no button in the Staff or Student modules to "Grant System Access".
- **Role Assignment**: While the backend supports it, the School UI cannot currently change a user's role (e.g., promoting a Teacher to a Finance officer).

### Disconnected Functionality
- **`POST /api/users/enable-login/`**: This is a core endpoint intended to bridge the gap between HR entities and login accounts, but it is never referenced in the frontend code.
- **Invitations**: The invitation email system in `AccountService` is "dark"—functional but unreachable from the UI.

## 6. Legacy Code
- `SafeModelBackend` and `PlatformUserRepairView` indicate recent migrations from a legacy or fragmented auth system to the current Supabase-linked architecture.

## 7. Recommendations
1. **Introduce a "Users" Tab**: Add a new tab to the `SystemSettingsModule.tsx` that uses `GET /api/users/` (filtered by school) to show all active accounts.
2. **Implement "Enable Login"**: Add an action to `StaffProfilePage.tsx` and the staff list that calls `POST /api/users/enable-login/`.
3. **Staff Form Integration**: Add an optional "Create Login Account" section to the `StaffForm` that collects an email and triggers provisioning during entity creation.
