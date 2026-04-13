
import React from 'react';
import { 
  LayoutDashboard, Package, CalendarDays, 
  Settings, Layers, Users, FileText, BookOpen, ShoppingBag, LucideIcon, GraduationCap, LogOut, ClipboardList 
} from 'lucide-react';
import { ActivityLog } from './ActivityLog';
import { LogEntry, UserAccount } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'dashboard' | 'inventory' | 'events' | 'packages' | 'employees' | 'quotations' | 'sales' | 'elearning' | 'logs';
  onTabChange: (tab: 'dashboard' | 'inventory' | 'events' | 'packages' | 'employees' | 'quotations' | 'sales' | 'elearning' | 'logs') => void;
  logs: LogEntry[];
  currentUser?: UserAccount | null;
  canManageAccess?: boolean;
  canViewLogs?: boolean;
  canViewDashboard?: boolean;
  canViewInventory?: boolean;
  canViewPackages?: boolean;
  canViewQuotations?: boolean;
  canViewSales?: boolean;
  canViewElearning?: boolean;
  canViewEmployees?: boolean;
  onOpenAccess?: () => void;
  onLogout?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  onTabChange, 
  logs, 
  currentUser, 
  canManageAccess, 
  canViewLogs, 
  canViewDashboard = true,
  canViewInventory = true,
  canViewPackages = true,
  canViewQuotations = true,
  canViewSales = true,
  canViewElearning = true,
  canViewEmployees = true, 
  onOpenAccess, 
  onLogout 
}) => {
  const tabs: { key: LayoutProps['activeTab']; label: string; icon: LucideIcon }[] = [
    { key: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { key: 'inventory', label: 'Kho hàng', icon: Package },
    { key: 'packages', label: 'Gói thiết bị', icon: Layers },
    { key: 'quotations', label: 'Báo giá', icon: FileText },
    { key: 'sales', label: 'Hàng bán', icon: ShoppingBag },
    { key: 'events', label: 'Sự kiện', icon: CalendarDays },
    { key: 'employees', label: 'Nhân sự', icon: Users },
    { key: 'elearning', label: 'Elearning', icon: GraduationCap }
  ].filter(tab =>
    (tab.key !== 'dashboard' || canViewDashboard) &&
    (tab.key !== 'inventory' || canViewInventory) &&
    (tab.key !== 'packages' || canViewPackages) &&
    (tab.key !== 'quotations' || canViewQuotations) &&
    (tab.key !== 'sales' || canViewSales) &&
    (tab.key !== 'elearning' || canViewElearning) &&
    (tab.key !== 'employees' || canViewEmployees)
  );
  if (canViewLogs) {
    tabs.push({ key: 'logs', label: 'Nhật ký', icon: ClipboardList });
  }
  const activeTabLabel = tabs.find(t => t.key === activeTab)?.label || 'Menu';

  return (
    <div className="flex h-screen bg-slate-50 text-[13px] md:text-[14px]">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 text-white flex flex-col hidden md:flex">
        <div className="p-4">
          <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            EINSTEIN BUS _ AI
          </h1>
          <p className="text-[11px] text-slate-400 mt-1">Quản lý kho sự kiện thông minh</p>
        </div>

        <nav className="flex-1 px-3 space-y-1 mt-3">
          {tabs.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm ${
                  isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <tab.icon size={20} />
                <span className="font-medium text-sm">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
           <button
             onClick={canManageAccess ? onOpenAccess : undefined}
             className={`w-full flex items-center gap-3 px-3 py-2.5 transition ${
               canManageAccess ? 'text-slate-400 hover:text-white' : 'text-slate-600 cursor-not-allowed'
             }`}
             title={canManageAccess ? 'Quan ly phan quyen' : 'Khong du quyen'}
           >
             <Settings size={20} />
             <span className="font-medium text-sm">Cài đặt</span>
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-14 bg-white border-b border-slate-200 flex justify-between items-center px-4 z-20">
          <div className="md:hidden flex items-center gap-2 font-bold text-gray-800 text-sm">
            <span>EINSTEIN BUS _ AI</span>
            <span className="px-2 py-1 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">{activeTabLabel}</span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
             <a 
               href="/huong-dan.html" 
               target="_blank" 
               rel="noreferrer" 
               className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-blue-700 border border-blue-100 rounded-lg hover:bg-blue-50 hover:border-blue-200 transition"
             >
               <BookOpen size={16} />
               <span className="hidden sm:inline">Hướng dẫn sử dụng</span>
               <span className="sm:hidden">Hướng dẫn</span>
             </a>
             <ActivityLog logs={logs} />
             {currentUser && (
               <div className="hidden sm:flex items-center gap-2 bg-slate-100 px-2 py-1 rounded-full text-xs font-semibold text-slate-700">
                 <span>{currentUser.name}</span>
                 <span className="text-[10px] uppercase text-slate-500">{currentUser.role}</span>
                 {onLogout && (
                   <button onClick={onLogout} className="text-slate-500 hover:text-slate-800" title="Dang xuat">
                     <LogOut size={14} />
                   </button>
                 )}
               </div>
             )}
             <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-xs">
                {currentUser?.name?.slice(0, 2).toUpperCase() || 'NA'}
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-3 md:p-4 pb-28 md:pb-6">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-slate-200 shadow-[0_-8px_32px_rgba(15,23,42,0.12)]">
        <div className="flex overflow-x-auto px-1 py-2 gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={`flex-1 min-w-[90px] flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-xl text-[11px] font-semibold transition ${
                  isActive ? 'bg-blue-50 text-blue-700 border border-blue-100 shadow-sm' : 'text-slate-500 border border-transparent'
                }`}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
