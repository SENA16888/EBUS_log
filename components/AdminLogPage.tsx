import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { LogActor, LogEntry, UserAccount } from '../types';

interface AdminLogPageProps {
  logs: LogEntry[];
  accounts: UserAccount[];
}

const TYPE_LABELS: Record<LogEntry['type'], string> = {
  SUCCESS: 'Thanh cong',
  INFO: 'Thong tin',
  WARNING: 'Canh bao',
  ERROR: 'Loi'
};

const TYPE_STYLES: Record<LogEntry['type'], string> = {
  SUCCESS: 'bg-green-100 text-green-700',
  INFO: 'bg-blue-100 text-blue-700',
  WARNING: 'bg-orange-100 text-orange-700',
  ERROR: 'bg-red-100 text-red-700'
};

const formatLogTime = (value: LogEntry['timestamp']) => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString('vi-VN');
};

const getLogActor = (log: LogEntry): LogActor | null => {
  return log.actor ?? null;
};

export const AdminLogPage: React.FC<AdminLogPageProps> = ({ logs, accounts }) => {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | LogEntry['type']>('ALL');
  const [actorFilter, setActorFilter] = useState<'ALL' | 'SYSTEM' | string>('ALL');

  const actorOptions = useMemo(() => {
    const map = new Map<string, LogActor>();
    accounts.forEach(account => {
      map.set(account.id, {
        id: account.id,
        name: account.name,
        role: account.role,
        phone: account.phone
      });
    });
    logs.forEach(log => {
      if (log.actor) {
        map.set(log.actor.id, log.actor);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [accounts, logs]);

  const filteredLogs = useMemo(() => {
    const term = query.trim().toLowerCase();
    return [...logs]
      .filter(log => {
        if (typeFilter !== 'ALL' && log.type !== typeFilter) return false;
        if (actorFilter !== 'ALL') {
          if (actorFilter === 'SYSTEM') {
            if (log.actor) return false;
          } else if (log.actor?.id !== actorFilter) {
            return false;
          }
        }
        if (term) {
          const haystack = [
            log.message,
            log.actor?.name,
            log.actor?.phone,
            log.actor?.role,
            log.actor?.id
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(term)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
        const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
        return timeB - timeA;
      });
  }, [logs, query, typeFilter, actorFilter]);

  const resetFilters = () => {
    setQuery('');
    setTypeFilter('ALL');
    setActorFilter('ALL');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Nhat ky he thong</h2>
          <p className="text-xs text-slate-500">Theo doi hanh dong theo tai khoan va thoi diem.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-600">
            Tong log: <span className="font-semibold text-slate-800">{logs.length}</span>
          </div>
          <div className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-600">
            Dang loc: <span className="font-semibold text-slate-800">{filteredLogs.length}</span>
          </div>
          <div className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-600">
            Tai khoan: <span className="font-semibold text-slate-800">{actorOptions.length}</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Tim theo hanh dong, ten, vai tro, sdt..."
              className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as 'ALL' | LogEntry['type'])}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="ALL">Tat ca muc do</option>
            {Object.entries(TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={actorFilter}
            onChange={e => setActorFilter(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="ALL">Tat ca tai khoan</option>
            <option value="SYSTEM">He thong</option>
            {actorOptions.map(actor => (
              <option key={actor.id} value={actor.id}>
                {actor.name} ({actor.role})
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>Hien thi {filteredLogs.length} log</span>
          <button onClick={resetFilters} className="text-blue-600 hover:text-blue-700 font-semibold">
            Xoa bo loc
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Thoi gian</th>
                <th className="text-left px-4 py-3 font-semibold">Tai khoan</th>
                <th className="text-left px-4 py-3 font-semibold">Hanh dong</th>
                <th className="text-left px-4 py-3 font-semibold">Muc do</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    Khong co log phu hop.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const actor = getLogActor(log);
                  const actorName = actor?.name || 'He thong';
                  const actorMeta = actor
                    ? `${actor.role} • ${actor.phone || actor.id}`
                    : 'Tu dong';

                  return (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                        {formatLogTime(log.timestamp)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-700">{actorName}</div>
                        <div className="text-[11px] text-slate-400">{actorMeta}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{log.message}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold ${TYPE_STYLES[log.type]}`}>
                          {TYPE_LABELS[log.type]}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
