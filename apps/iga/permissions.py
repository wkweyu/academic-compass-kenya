from rest_framework.exceptions import PermissionDenied


IGA_ADMIN_ROLES = {
    'superadmin',
    'schooladmin',
    'admin',
    'principal',
    'headteacher',
}
PRODUCTION_ENTRY_ROLES = IGA_ADMIN_ROLES | {'farm_manager', 'manager'}
SALES_ENTRY_ROLES = IGA_ADMIN_ROLES | {'sales_officer', 'sales', 'cashier'}
EXPENSE_ENTRY_ROLES = IGA_ADMIN_ROLES | {'accountant', 'finance', 'bursar'}
EXPENSE_APPROVAL_ROLES = IGA_ADMIN_ROLES
INVENTORY_CONTROL_ROLES = IGA_ADMIN_ROLES | {'farm_manager', 'manager', 'accountant', 'finance', 'storekeeper'}


def normalize_role(role):
    return str(role or '').strip().lower().replace('-', '_').replace(' ', '_')


def user_has_iga_role(user, allowed_roles):
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    if getattr(user, 'is_superuser', False):
        return True
    return normalize_role(getattr(user, 'role', '')) in {normalize_role(role) for role in allowed_roles}


def assert_iga_role(user, allowed_roles, action_label):
    if user_has_iga_role(user, allowed_roles):
        return
    allowed = ', '.join(sorted({normalize_role(role) for role in allowed_roles}))
    raise PermissionDenied(f'You do not have permission to {action_label}. Allowed roles: {allowed}.')
