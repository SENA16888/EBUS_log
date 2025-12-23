
import React, { useState, useRef, useEffect } from 'react';
import { LogEntry } from '../types';
import { History, X, CheckCircle, Info, AlertTriangle, XCircle } from 'lucide-react';

interface ActivityLogProps {
  logs: LogEntry[];
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ logs }) => {
  const [isOpen, setIsOpen] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (logRef.current && !logRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const getIconForType = (type: LogEntry['type']) => {
    switch(type) {
      case 'SUCCESS': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'WARNING': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'ERROR': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="relative" ref={logRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-500 hover:bg-slate-100 rounded-full relative"
      >
        <History size={20} />
        {logs.length > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white animate-pulse"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-12 right-0 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-30">
          <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
             <h4 className="font-bold text-sm text-gray-700">Nhật Ký Hoạt Động</h4>
             <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
               <X size={16} />
             </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="p-8 text-center text-sm text-gray-400 italic">Chưa có hoạt động nào.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {logs.map(log => (
                  <li key={log.id} className="p-4 hover:bg-slate-50/50">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">{getIconForType(log.type)}</div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-800 leading-tight">{log.message}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {log.timestamp.toLocaleTimeString('vi-VN')}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
