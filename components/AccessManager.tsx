import React, { useMemo, useState } from 'react';
import { Employee, UserAccount, AccessRole, AccessPermission } from '../types';
import { ACCESS_PERMISSION_GROUPS, getDefaultPermissionsForRole, normalizePhone } from '../services/accessControl';
import { X, ShieldCheck, UserPlus, Trash2, RefreshCw } from 'lucide-react';

interface AccessManagerProps {
  isOpen: boolean;
  accounts: UserAccount[];
  employees: Employee[];
  currentUserId?: string;
  onClose: () => void;
  onUpsertAccount: (account: UserAccount) => void;
  onDeleteAccount: (accountId: string) => void;
}

const ROLE_LABELS: Record<AccessRole, string> = {
  ADMIN: 'ADMIN',
  MANAGER: 'QUAN LY',
  STAFF: 'NHAN VIEN'
};

export const AccessManager: React.FC<AccessManagerProps> = ({
  isOpen,
  accounts,
  employees,
  currentUserId,
  onClose,
  onUpsertAccount,
  onDeleteAccount
}) => {
  const [newAccount, setNewAccount] = useState({
    name: '',
    phone: '',
    role: 'STAFF' as AccessRole,
    linkedEmployeeId: ''
  });

  const sortedAccounts = useMemo(() => [...accounts].sort((a, b) => a.name.localeCompare(b.name)), [accounts]);
  const sortedEmployees = useMemo(() => [...employees].sort((a, b) => a.name.localeCompare(b.name)), [employees]);

  if (!isOpen) return null;

  const handleCreateAccount = () => {
    const name = newAccount.name.trim();
    const phone = normalizePhone(newAccount.phone);
    if (!name || !phone) {
      alert('Vui long nhap ten va so dien thoai.');
      return;
    }
    const exists = accounts.some(acc => normalizePhone(acc.phone) === phone);
    if (exists) {
      alert('So dien thoai da ton tai.');
      return;
    }
    const account: UserAccount = {
      id: `user-${Date.now()}`,
      name,
      phone: newAccount.phone.trim(),
      role: newAccount.role,
      permissions: getDefaultPermissionsForRole(newAccount.role),
      linkedEmployeeId: newAccount.linkedEmployeeId || undefined,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    onUpsertAccount(account);
    setNewAccount({ name: '', phone: '', role: 'STAFF', linkedEmployeeId: '' });
  };

  const updateAccount = (account: UserAccount, patch: Partial<UserAccount>) => {
    onUpsertAccount({ ...account, ...patch });
  };

  const togglePermission = (account: UserAccount, perm: AccessPermission) => {
    const permissions = new Set(account.permissions || []);
    if (permissions.has(perm)) {
      permissions.delete(perm);
    } else {
      permissions.add(perm);
    }
    updateAccount(account, { permissions: Array.from(permissions) });
  };

  const handleSelectEmployee = (employeeId: string) => {
    setNewAccount(prev => {
      const employee = employees.find(emp => emp.id === employeeId);
      return {
        ...prev,
        linkedEmployeeId: employeeId,
        name: employee?.name || prev.name,
        phone: employee?.phone || prev.phone
      };
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[130] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-blue-600" size={20} />
            <div>
              <h3 className="font-bold text-slate-800">Quan ly phan quyen</h3>
              <p className="text-xs text-slate-500">Chon nhung chuc nang tai khoan duoc phep thao tac.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-slate-700">
                <UserPlus size={16} /> Tao tai khoan
              </div>
              <input
                type="text"
                placeholder="Ten nhan su"
                value={newAccount.name}
                onChange={e => setNewAccount(prev => ({ ...prev, name: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="So dien thoai"
                value={newAccount.phone}
                onChange={e => setNewAccount(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
              <select
                value={newAccount.role}
                onChange={e => setNewAccount(prev => ({ ...prev, role: e.target.value as AccessRole }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                {Object.keys(ROLE_LABELS).map(role => (
                  <option key={role} value={role}>{ROLE_LABELS[role as AccessRole]}</option>
                ))}
              </select>
              <select
                value={newAccount.linkedEmployeeId}
                onChange={e => handleSelectEmployee(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Lien ket nhan su (tuy chon)</option>
                {sortedEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name} - {emp.phone}</option>
                ))}
              </select>
              <button
                onClick={handleCreateAccount}
                className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-700"
              >
                Tao tai khoan
              </button>
            </div>

            <div className="text-xs text-slate-500">
              Ghi chu: ADMIN co toan quyen. MANAGER mac dinh duoc phep sua, khong duoc xoa.
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            {sortedAccounts.map(account => (
              <div key={account.id} className="border border-slate-100 rounded-xl p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800">{account.name}</p>
                      {account.id === currentUserId && (
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Dang dung</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{account.phone}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={account.role}
                      onChange={e => updateAccount(account, { role: e.target.value as AccessRole, permissions: getDefaultPermissionsForRole(e.target.value as AccessRole) })}
                      className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs"
                    >
                      {Object.keys(ROLE_LABELS).map(role => (
                        <option key={role} value={role}>{ROLE_LABELS[role as AccessRole]}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={account.isActive !== false}
                        onChange={e => updateAccount(account, { isActive: e.target.checked })}
                      />
                      Hoat dong
                    </label>
                    <button
                      onClick={() => updateAccount(account, { permissions: getDefaultPermissionsForRole(account.role) })}
                      className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                      title="Reset quyen"
                    >
                      <RefreshCw size={12} /> Reset quyen
                    </button>
                    <button
                      onClick={() => onDeleteAccount(account.id)}
                      className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                    >
                      <Trash2 size={12} /> Xoa
                    </button>
                  </div>
                </div>

                {account.role === 'ADMIN' ? (
                  <div className="mt-3 text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg p-3">
                    ADMIN duoc phep thao tac tat ca chuc nang.
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {ACCESS_PERMISSION_GROUPS.map(group => (
                      <div key={group.group}>
                        <p className="text-xs font-semibold text-slate-500 mb-2">{group.group}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {group.items.map(item => (
                            <label key={item.key} className="flex items-center gap-2 text-xs text-slate-700">
                              <input
                                type="checkbox"
                                checked={(account.permissions || []).includes(item.key)}
                                onChange={() => togglePermission(account, item.key)}
                              />
                              {item.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
