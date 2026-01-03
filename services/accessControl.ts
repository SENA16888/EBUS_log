import { AccessPermission, AccessRole, UserAccount } from '../types';

export const ACCESS_PERMISSION_GROUPS: { group: string; items: { key: AccessPermission; label: string }[] }[] = [
  {
    group: 'Kho hang',
    items: [
      { key: 'INVENTORY_EDIT', label: 'Them/sua thiet bi' },
      { key: 'INVENTORY_DELETE', label: 'Xoa thiet bi' }
    ]
  },
  {
    group: 'Goi thiet bi',
    items: [
      { key: 'PACKAGES_EDIT', label: 'Tao/sua goi' },
      { key: 'PACKAGES_DELETE', label: 'Xoa goi' }
    ]
  },
  {
    group: 'Su kien',
    items: [
      { key: 'EVENTS_EDIT', label: 'Cap nhat su kien' },
      { key: 'EVENTS_DELETE', label: 'Xoa su kien' }
    ]
  },
  {
    group: 'Nhan su',
    items: [
      { key: 'EMPLOYEES_EDIT', label: 'Them/sua nhan su' },
      { key: 'EMPLOYEES_DELETE', label: 'Xoa nhan su' }
    ]
  },
  {
    group: 'Bao gia',
    items: [
      { key: 'QUOTATIONS_EDIT', label: 'Tao/sua bao gia' },
      { key: 'QUOTATIONS_DELETE', label: 'Xoa bao gia' }
    ]
  },
  {
    group: 'Hang ban',
    items: [
      { key: 'SALES_EDIT', label: 'Tao/sua hang ban' },
      { key: 'SALES_DELETE', label: 'Xoa hang ban' }
    ]
  },
  {
    group: 'Elearning',
    items: [
      { key: 'ELEARNING_EDIT', label: 'Lam bai/Cap nhat ho so' }
    ]
  },
  {
    group: 'Quan tri',
    items: [
      { key: 'ACCESS_MANAGE', label: 'Quan ly phan quyen' }
    ]
  }
];

export const ALL_ACCESS_PERMISSIONS: AccessPermission[] = ACCESS_PERMISSION_GROUPS.flatMap(group => group.items.map(item => item.key));

export const normalizePhone = (value: string) => value.replace(/[^0-9]/g, '');

export const getDefaultPermissionsForRole = (role: AccessRole): AccessPermission[] => {
  if (role === 'MANAGER') {
    return ALL_ACCESS_PERMISSIONS.filter(p => !p.endsWith('_DELETE') && p !== 'ACCESS_MANAGE');
  }
  if (role === 'STAFF') {
    return ['EVENTS_EDIT', 'ELEARNING_EDIT'];
  }
  return ALL_ACCESS_PERMISSIONS;
};

export const hasPermission = (account: UserAccount | null | undefined, permission: AccessPermission): boolean => {
  if (!account) return false;
  if (account.role === 'ADMIN') return true;
  return (account.permissions || []).includes(permission);
};
