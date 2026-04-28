import { AccessPermission, AccessRole, UserAccount } from '../types';

export const ACCESS_PERMISSION_VERSION = 2;

export const ACCESS_PERMISSION_GROUPS: { group: string; items: { key: AccessPermission; label: string }[] }[] = [
  {
    group: 'Tong quan',
    items: [
      { key: 'DASHBOARD_VIEW', label: 'Xem dashboard tong quan' }
    ]
  },
  {
    group: 'Kho hang',
    items: [
      { key: 'INVENTORY_VIEW', label: 'Xem kho hang' },
      { key: 'INVENTORY_EDIT', label: 'Them/sua thiet bi' },
      { key: 'INVENTORY_DELETE', label: 'Xoa thiet bi' }
    ]
  },
  {
    group: 'Goi thiet bi',
    items: [
      { key: 'PACKAGES_VIEW', label: 'Xem goi thiet bi' },
      { key: 'PACKAGES_EDIT', label: 'Tao/sua goi' },
      { key: 'PACKAGES_DELETE', label: 'Xoa goi' }
    ]
  },
  {
    group: 'Su kien',
    items: [
      { key: 'EVENTS_VIEW', label: 'Xem su kien' },
      { key: 'EVENTS_EDIT', label: 'Cap nhat su kien' },
      { key: 'EVENTS_DELETE', label: 'Xoa su kien' }
    ]
  },
  {
    group: 'Nhan su',
    items: [
      { key: 'EMPLOYEES_VIEW', label: 'Xem nhan su' },
      { key: 'EMPLOYEES_EDIT', label: 'Them/sua nhan su' },
      { key: 'EMPLOYEES_DELETE', label: 'Xoa nhan su' }
    ]
  },
  {
    group: 'Bao gia',
    items: [
      { key: 'QUOTATIONS_VIEW', label: 'Xem bao gia' },
      { key: 'QUOTATIONS_EDIT', label: 'Tao/sua bao gia' },
      { key: 'QUOTATIONS_DELETE', label: 'Xoa bao gia' }
    ]
  },
  {
    group: 'Hang ban',
    items: [
      { key: 'SALES_VIEW', label: 'Xem hang ban' },
      { key: 'SALES_EDIT', label: 'Tao/sua hang ban' },
      { key: 'SALES_DELETE', label: 'Xoa hang ban' }
    ]
  },
  {
    group: 'Elearning',
    items: [
      { key: 'ELEARNING_VIEW', label: 'Xem elearning' },
      { key: 'ELEARNING_EDIT', label: 'Lam bai/Cap nhat ho so' }
    ]
  },
  {
    group: 'He thong',
    items: [
      { key: 'LOGS_VIEW', label: 'Xem nhat ky he thong' },
      { key: 'ACCESS_MANAGE', label: 'Quan ly phan quyen' }
    ]
  }
];

export const ALL_ACCESS_PERMISSIONS: AccessPermission[] = ACCESS_PERMISSION_GROUPS.flatMap(group => group.items.map(item => item.key));

const LEGACY_ROLE_VIEW_PERMISSIONS: Record<Exclude<AccessRole, 'ADMIN'>, AccessPermission[]> = {
  MANAGER: [
    'DASHBOARD_VIEW',
    'INVENTORY_VIEW',
    'PACKAGES_VIEW',
    'EVENTS_VIEW',
    'EMPLOYEES_VIEW',
    'QUOTATIONS_VIEW',
    'SALES_VIEW',
    'ELEARNING_VIEW'
  ],
  STAFF: ['ELEARNING_VIEW']
};

const MODULE_VIEW_DEPENDENCIES: { view: AccessPermission; related: AccessPermission[] }[] = [
  { view: 'INVENTORY_VIEW', related: ['INVENTORY_EDIT', 'INVENTORY_DELETE'] },
  { view: 'PACKAGES_VIEW', related: ['PACKAGES_EDIT', 'PACKAGES_DELETE'] },
  { view: 'EVENTS_VIEW', related: ['EVENTS_EDIT', 'EVENTS_DELETE'] },
  { view: 'EMPLOYEES_VIEW', related: ['EMPLOYEES_EDIT', 'EMPLOYEES_DELETE'] },
  { view: 'QUOTATIONS_VIEW', related: ['QUOTATIONS_EDIT', 'QUOTATIONS_DELETE'] },
  { view: 'SALES_VIEW', related: ['SALES_EDIT', 'SALES_DELETE'] },
  { view: 'ELEARNING_VIEW', related: ['ELEARNING_EDIT'] }
];

export const normalizePhone = (value: string) => value.replace(/[^0-9]/g, '');

export const getDefaultPermissionsForRole = (role: AccessRole): AccessPermission[] => {
  if (role === 'MANAGER') {
    return ALL_ACCESS_PERMISSIONS.filter(
      p => !p.endsWith('_DELETE') && p !== 'ACCESS_MANAGE' && p !== 'LOGS_VIEW'
    );
  }
  if (role === 'STAFF') {
    return ['ELEARNING_VIEW', 'ELEARNING_EDIT'];
  }
  return ALL_ACCESS_PERMISSIONS;
};

export const normalizePermissionsForRole = (
  role: AccessRole,
  permissions: AccessPermission[] | undefined,
  permissionsVersion?: number
): AccessPermission[] => {
  if (role === 'ADMIN') return ALL_ACCESS_PERMISSIONS;

  const nextPermissions = new Set<AccessPermission>(
    (permissions || []).filter((permission): permission is AccessPermission =>
      ALL_ACCESS_PERMISSIONS.includes(permission)
    )
  );

  const hasAnyViewPermission = Array.from(nextPermissions).some(permission => permission.endsWith('_VIEW'));
  const isLegacyPermissions = permissionsVersion !== ACCESS_PERMISSION_VERSION;

  if (isLegacyPermissions && !hasAnyViewPermission) {
    LEGACY_ROLE_VIEW_PERMISSIONS[role].forEach(permission => nextPermissions.add(permission));
  }

  MODULE_VIEW_DEPENDENCIES.forEach(({ view, related }) => {
    if (related.some(permission => nextPermissions.has(permission))) {
      nextPermissions.add(view);
    }
  });

  return Array.from(nextPermissions);
};

export const hasPermission = (account: UserAccount | null | undefined, permission: AccessPermission): boolean => {
  if (!account) return false;
  if (account.role === 'ADMIN') return true;
  return (account.permissions || []).includes(permission);
};
