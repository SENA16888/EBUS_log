import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { AppState, EventStatus } from '../types';
import { Package, Truck, Calendar, AlertTriangle } from 'lucide-react';

interface DashboardProps {
  appState: AppState;
}

export const Dashboard: React.FC<DashboardProps> = ({ appState }) => {
  const totalItems = appState.inventory.reduce((acc, item) => acc + item.totalQuantity, 0);
  const totalInUse = appState.inventory.reduce((acc, item) => acc + item.inUseQuantity, 0);
  const activeEvents = appState.events.filter(e => e.status === EventStatus.ONGOING).length;
  const upcomingEvents = appState.events.filter(e => e.status === EventStatus.UPCOMING).length;
  const lowStockItems = appState.inventory.filter(i => i.availableQuantity < 5).length;

  const categoryData = appState.inventory.reduce((acc: any[], item) => {
    const existing = acc.find(x => x.name === item.category);
    if (existing) {
      existing.value += item.totalQuantity;
    } else {
      acc.push({ name: item.category, value: item.totalQuantity });
    }
    return acc;
  }, []);

  const eventStatusData = [
    { name: 'Đang diễn ra', value: activeEvents, color: '#22c55e' }, // green-500
    { name: 'Sắp tới', value: upcomingEvents, color: '#3b82f6' }, // blue-500
    { name: 'Đã hoàn thành', value: appState.events.filter(e => e.status === EventStatus.COMPLETED).length, color: '#94a3b8' }, // slate-400
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Tổng Quan Kho</h2>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">Tổng Thiết Bị</p>
            <h3 className="text-3xl font-bold text-gray-800 mt-1">{totalItems}</h3>
          </div>
          <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
            <Package size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">Đang Tại Sự Kiện</p>
            <h3 className="text-3xl font-bold text-orange-600 mt-1">{totalInUse}</h3>
          </div>
          <div className="bg-orange-100 p-3 rounded-lg text-orange-600">
            <Truck size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">Sự Kiện Sắp Tới</p>
            <h3 className="text-3xl font-bold text-blue-600 mt-1">{upcomingEvents}</h3>
          </div>
          <div className="bg-indigo-100 p-3 rounded-lg text-indigo-600">
            <Calendar size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">Sắp Hết Hàng</p>
            <h3 className="text-3xl font-bold text-red-600 mt-1">{lowStockItems}</h3>
          </div>
          <div className="bg-red-100 p-3 rounded-lg text-red-600">
            <AlertTriangle size={24} />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-80">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Phân Bố Danh Mục</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-80">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Trạng Thái Sự Kiện</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={eventStatusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {eventStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 text-sm text-gray-600 mt-2">
            {eventStatusData.map((d, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{backgroundColor: d.color}}></div>
                {d.name} ({d.value})
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};