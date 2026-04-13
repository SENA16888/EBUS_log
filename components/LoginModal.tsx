import React, { useMemo, useState } from 'react';
import { UserAccount } from '../types';
import { normalizePhone } from '../services/accessControl';
import { Loader2 } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  isLoading?: boolean;
  accounts: UserAccount[];
  onLogin: (phone: string) => boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, isLoading = false, accounts, onLogin }) => {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError('');
    if (!normalizePhone(phone)) {
      setError('Vui long nhap so dien thoai.');
      return;
    }
    const ok = onLogin(phone);
    if (!ok) {
      setError('Khong tim thay tai khoan phu hop.');
    } else {
      setPhone('');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-slate-800">Dang nhap he thong</h2>
          <p className="text-sm text-slate-500">
            {isLoading ? 'Vui long cho...' : 'Nhap so dien thoai de tiep tuc.'}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="So dien thoai"
              disabled={isLoading}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
            />
            {isLoading && (
              <div className="absolute right-3 top-3 flex items-center">
                <Loader2 size={18} className="animate-spin text-slate-400" />
              </div>
            )}
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-blue-700 transition disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 size={16} className="animate-spin" />}
            {isLoading ? 'Dang tai...' : 'Dang nhap'}
          </button>
        </form>
        {isLoading && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-xs text-blue-700 text-center font-medium">
              ⏳ Dang tai du lieu tu he thong, vui long cho...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
