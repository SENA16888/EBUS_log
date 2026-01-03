import React, { useMemo, useState } from 'react';
import { UserAccount } from '../types';
import { normalizePhone } from '../services/accessControl';

interface LoginModalProps {
  isOpen: boolean;
  accounts: UserAccount[];
  onLogin: (phone: string) => boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, accounts, onLogin }) => {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
          <p className="text-sm text-slate-500">Nhap so dien thoai de tiep tuc.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="So dien thoai"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-blue-700 transition"
          >
            Dang nhap
          </button>
        </form>
      </div>
    </div>
  );
};
