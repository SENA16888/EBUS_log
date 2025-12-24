
import React from 'react';
import { 
  LayoutDashboard, Package, CalendarDays, 
  Settings, Bell, User, Layers, Users, FileText, BookOpen 
} from 'lucide-react';
import { ActivityLog } from './ActivityLog';
import { LogEntry } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'dashboard' | 'inventory' | 'events' | 'packages' | 'employees' | 'quotations' | 'sales';
  onTabChange: (tab: 'dashboard' | 'inventory' | 'events' | 'packages' | 'employees' | 'quotations' | 'sales') => void;
  logs: LogEntry[];
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, logs }) => {
  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col hidden md:flex">
        <div className="p-6">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            EventStock AI
          </h1>
          <p className="text-xs text-slate-400 mt-1">Quản lý kho sự kiện thông minh</p>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4">
          <button 
            onClick={() => onTabChange('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <LayoutDashboard size={20} />
            <span className="font-medium text-sm">Tổng quan</span>
          </button>
          
          <button 
            onClick={() => onTabChange('inventory')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'inventory' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Package size={20} />
            <span className="font-medium text-sm">Kho hàng</span>
          </button>

          <button 
            onClick={() => onTabChange('packages')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'packages' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Layers size={20} />
            <span className="font-medium text-sm">Gói thiết bị</span>
          </button>

          <button 
            onClick={() => onTabChange('quotations')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'quotations' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FileText size={20} />
            <span className="font-medium text-sm">Báo giá khách</span>
          </button>

          <button 
            onClick={() => onTabChange('sales')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'sales' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Layers size={20} />
            <span className="font-medium text-sm">Hàng bán</span>
          </button>

          <button 
            onClick={() => onTabChange('events')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'events' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <CalendarDays size={20} />
            <span className="font-medium text-sm">Sự kiện</span>
          </button>

          <button 
            onClick={() => onTabChange('employees')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'employees' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Users size={20} />
            <span className="font-medium text-sm">Nhân sự</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
           <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white transition">
             <Settings size={20} />
             <span className="font-medium text-sm">Cài đặt</span>
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex justify-between items-center px-6 z-20">
          <div className="md:hidden font-bold text-gray-800">EventStock AI</div>
          <div className="flex items-center gap-4 ml-auto">
             <a 
               href="/huong-dan.html" 
               target="_blank" 
               rel="noreferrer" 
               className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-blue-700 border border-blue-100 rounded-lg hover:bg-blue-50 hover:border-blue-200 transition"
             >
               <BookOpen size={16} />
               <span className="hidden sm:inline">Hướng dẫn sử dụng</span>
               <span className="sm:hidden">Hướng dẫn</span>
             </a>
             <ActivityLog logs={logs} />
             <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm">
                AD
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
};
