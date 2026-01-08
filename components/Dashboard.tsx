import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';
import { AppState, EventStatus } from '../types';
import { 
  Sparkles, Package, Truck, Calendar, AlertTriangle, Layers, TrendingUp, Users, FileText, Activity, Clock, CheckCircle, ShoppingBag 
} from 'lucide-react';
import { calcLineTotal } from '../services/pricing';

interface DashboardProps {
  appState: AppState;
}

const formatNumber = (value: number) => value.toLocaleString('vi-VN');
const formatCurrency = (value: number) => `${value.toLocaleString('vi-VN')} đ`;

export const Dashboard: React.FC<DashboardProps> = ({ appState }) => {
  const saleOrders = appState.saleOrders || [];
  const saleOrdersOnly = saleOrders.filter(order => (order.type || 'SALE') !== 'RETURN');
  const returnOrders = saleOrders.filter(order => (order.type || '') === 'RETURN');

  const totalItems = appState.inventory.reduce((acc, item) => acc + item.totalQuantity, 0);
  const totalAvailable = appState.inventory.reduce((acc, item) => acc + item.availableQuantity, 0);
  const totalInUse = appState.inventory.reduce((acc, item) => acc + item.inUseQuantity, 0);
  const lowStockItems = appState.inventory
    .filter(i => i.availableQuantity < (i.minStock || 5))
    .sort((a, b) => a.availableQuantity - b.availableQuantity)
    .slice(0, 5);

  const getOrderRevenue = (order: any) => {
    const items = order.items || [];
    const subtotal = items.reduce((acc: number, item: any) => {
      const discount = item.discount || 0;
      const discountPercent = item.discountPercent || 0;
      const qty = item.soldQuantity ?? item.quantity ?? 0;
      const lineTotal = calcLineTotal(item.price, qty, discount, discountPercent);
      return acc + Math.max(0, lineTotal);
    }, 0);
    const orderDiscount = order.orderDiscount || 0;
    return Math.max(0, subtotal - orderDiscount);
  };

  const saleSummary = (() => {
    const totalOrders = saleOrdersOnly.length;
    const totalSalesRevenue = saleOrdersOnly
      .filter(o => o.status === 'FINALIZED')
      .reduce((acc, o) => acc + getOrderRevenue(o), 0);
    const totalReturns = returnOrders.reduce((acc, r) => acc + Math.abs(r.total || r.subtotal || 0), 0);
    const net = Math.max(0, totalSalesRevenue - totalReturns);
    return { totalOrders, totalSalesRevenue, totalReturns, net };
  })();

  const monthlySales = (() => {
    const bucket = new Map<string, { label: string; date: number; value: number }>();
    saleOrdersOnly.forEach(order => {
      const d = new Date(order.date);
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      const label = d.toLocaleString('vi-VN', { month: 'short', year: '2-digit' });
      const current = bucket.get(key) || { label, date: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), value: 0 };
      current.value += getOrderRevenue(order);
      bucket.set(key, current);
    });
    return Array.from(bucket.values())
      .sort((a, b) => a.date - b.date)
      .slice(-6)
      .map(item => ({ name: item.label, value: item.value }));
  })();

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
    { name: 'Đang diễn ra', value: appState.events.filter(e => e.status === EventStatus.ONGOING).length, color: '#22c55e' },
    { name: 'Sắp tới', value: appState.events.filter(e => e.status === EventStatus.UPCOMING).length, color: '#3b82f6' },
    { name: 'Hoàn thành', value: appState.events.filter(e => e.status === EventStatus.COMPLETED).length, color: '#0ea5e9' },
    { name: 'Huỷ', value: appState.events.filter(e => e.status === EventStatus.CANCELLED).length, color: '#cbd5e1' }
  ];

  const upcomingEvents = [...appState.events]
    .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))
    .slice(0, 4);

  const recentOrders = [...saleOrdersOnly]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 4);

  const recentQuotations = [...appState.quotations]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 4);

  const acceptedQuotes = appState.quotations.filter(q => q.status === 'ACCEPTED');
  const staffAssignments = appState.events.reduce((acc, ev) => acc + (ev.staff?.length || 0), 0);

  const statCards = [
    {
      title: 'Thiết bị toàn kho',
      value: totalItems,
      sub: `${formatNumber(totalAvailable)} đang sẵn sàng`,
      icon: <Package size={18} />,
      accent: 'from-blue-500/10 to-indigo-500/10 text-blue-700',
    },
    {
      title: 'Thiết bị đang xuất',
      value: totalInUse,
      sub: `${formatNumber(lowStockItems.length)} hạng mục cảnh báo`,
      icon: <Truck size={18} />,
      accent: 'from-amber-500/10 to-orange-500/10 text-orange-700',
    },
    {
      title: 'Tổng sự kiện',
      value: appState.events.length,
      sub: `${eventStatusData[1].value} sắp tới • ${eventStatusData[0].value} đang chạy`,
      icon: <Calendar size={18} />,
      accent: 'from-emerald-500/10 to-teal-500/10 text-emerald-700',
    },
    {
      title: 'Doanh thu ròng',
      value: saleSummary.net,
      format: formatCurrency,
      sub: `${saleSummary.totalOrders} đơn bán • ${formatCurrency(saleSummary.totalReturns)} hoàn trả`,
      icon: <TrendingUp size={18} />,
      accent: 'from-slate-700/10 to-slate-500/10 text-slate-800',
    },
    {
      title: 'Báo giá đã chốt',
      value: acceptedQuotes.length,
      sub: `${formatCurrency(acceptedQuotes.reduce((s, q) => s + (q.totalAmount || 0), 0))} giá trị`,
      icon: <FileText size={18} />,
      accent: 'from-violet-500/10 to-purple-500/10 text-purple-700',
    },
    {
      title: 'Gói & combo',
      value: appState.packages.length,
      sub: `${formatNumber(appState.inventory.length)} mã thiết bị`,
      icon: <Layers size={18} />,
      accent: 'from-sky-500/10 to-cyan-500/10 text-sky-700',
    },
    {
      title: 'Nhân sự',
      value: appState.employees.length,
      sub: `${formatNumber(staffAssignments)} phân công đang mở`,
      icon: <Users size={18} />,
      accent: 'from-pink-500/10 to-rose-500/10 text-rose-700',
    },
    {
      title: 'Bán lẻ',
      value: appState.saleItems?.length || 0,
      sub: `${saleSummary.totalSalesRevenue ? formatCurrency(saleSummary.totalSalesRevenue) : 'Chưa có doanh thu'}`,
      icon: <ShoppingBag size={18} />,
      accent: 'from-lime-500/10 to-green-500/10 text-lime-700',
    },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 p-5 text-white shadow-lg border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-sky-200 font-semibold">
              <Sparkles size={16} /> EINSTEIN BUS _ AI
            </p>
            <h2 className="text-2xl md:text-3xl font-black mt-1.5 leading-tight">Bảng điều khiển tổng quan</h2>
            <p className="text-slate-200 mt-1.5 max-w-2xl text-sm">Tổng hợp dữ liệu kho, sự kiện, bán hàng và báo giá trong một màn hình.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <div className="px-3 py-1.5 rounded-full bg-white/10 border border-white/10">
              {eventStatusData[1].value} sự kiện sắp tới
            </div>
            <div className="px-3 py-1.5 rounded-full bg-white/10 border border-white/10">
              {lowStockItems.length} cảnh báo tồn kho
            </div>
            <div className="px-3 py-1.5 rounded-full bg-white/10 border border-white/10">
              {saleSummary.totalOrders} đơn bán
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-3.5">
        {statCards.map((card, idx) => (
          <div 
            key={card.title} 
            className="bg-white rounded-xl border border-slate-100 shadow-sm p-3.5 flex flex-col gap-1.5 hover:shadow-md transition"
          >
            <div className={`w-9 h-9 rounded-lg bg-gradient-to-r ${card.accent} flex items-center justify-center`}>
              {card.icon}
            </div>
            <p className="text-[13px] text-slate-500 font-medium">{card.title}</p>
            <h3 className="text-xl font-black text-slate-900 leading-tight">
              {card.format ? card.format(card.value) : formatNumber(card.value)}
            </h3>
            <p className="text-[11px] text-slate-500 leading-snug">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-black uppercase text-slate-400">Doanh thu đơn bán</p>
              <h4 className="text-base font-bold text-slate-800">6 tháng gần nhất</h4>
            </div>
            <div className="flex items-center gap-2 text-sm text-emerald-600 font-semibold">
              <TrendingUp size={16} />
              {formatCurrency(saleSummary.totalSalesRevenue)}
            </div>
          </div>
          {monthlySales.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthlySales}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v / 1000000)}m`} />
                <Tooltip formatter={(val: any) => formatCurrency(Number(val))} />
                <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, stroke: '#2563eb', fill: '#fff' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-slate-400 py-10 text-sm">Chưa có dữ liệu đơn bán để hiển thị.</div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase text-slate-400">Sức khỏe sự kiện</p>
              <h4 className="text-base font-bold text-slate-800">Trạng thái</h4>
            </div>
            <div className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-600 text-[11px] font-semibold flex items-center gap-1">
              <Activity size={14} /> {appState.events.length} sự kiện
            </div>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={eventStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                  {eventStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {eventStatusData.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-[13px] bg-slate-50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></span>
                  <span className="text-slate-600">{d.name}</span>
                </div>
                <span className="font-bold text-slate-800">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <p className="text-xs font-black uppercase text-slate-400">Lịch sự kiện</p>
              <h4 className="text-base font-bold text-slate-800">Sắp tới</h4>
            </div>
            <Clock size={16} className="text-slate-500" />
          </div>
          <div className="space-y-2.5">
            {upcomingEvents.length === 0 && <p className="text-[13px] text-slate-400">Chưa có sự kiện nào.</p>}
            {upcomingEvents.map(ev => (
              <div key={ev.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 hover:bg-slate-100 transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{ev.name}</p>
                    <p className="text-xs text-slate-500">{ev.client} • {ev.location}</p>
                  </div>
                  <div className="text-[11px] px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-semibold">
                    {ev.startDate}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {ev.items.length} thiết bị • {ev.staff?.length || 0} nhân sự
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <p className="text-xs font-black uppercase text-slate-400">Tồn kho</p>
              <h4 className="text-base font-bold text-slate-800">Sắp hết hàng</h4>
            </div>
            <AlertTriangle size={16} className="text-amber-500" />
          </div>
          <div className="space-y-2.5">
            {lowStockItems.length === 0 && <p className="text-[13px] text-slate-400">Kho đang an toàn.</p>}
            {lowStockItems.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-100">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                  <p className="text-xs text-amber-700">Còn {item.availableQuantity} / {item.totalQuantity}</p>
                </div>
                <span className="text-[11px] font-black text-amber-800 bg-amber-100 px-2 py-1 rounded-full">
                  {item.category}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <p className="text-xs font-black uppercase text-slate-400">Đơn bán gần nhất</p>
              <h4 className="text-base font-bold text-slate-800">Hoạt động bán</h4>
            </div>
            <CheckCircle size={16} className="text-emerald-500" />
          </div>
          <div className="space-y-2.5">
            {recentOrders.length === 0 && <p className="text-[13px] text-slate-400">Chưa có đơn bán.</p>}
            {recentOrders.map(order => (
              <div key={order.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50/60">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{order.customerName}</p>
                    <p className="text-xs text-slate-500">{new Date(order.date).toLocaleDateString('vi-VN')}</p>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                    {formatCurrency(getOrderRevenue(order))}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{(order.items || []).length} dòng hàng • {order.status || 'DRAFT'}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-black uppercase text-slate-400">Phân bố danh mục</p>
              <h4 className="text-base font-bold text-slate-800">Kho theo nhóm</h4>
            </div>
            <Layers size={16} className="text-slate-500" />
          </div>
          <div className="h-64">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={36} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-slate-400 py-10 text-[13px]">Chưa có dữ liệu danh mục.</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-black uppercase text-slate-400">Báo giá</p>
              <h4 className="text-base font-bold text-slate-800">Gần nhất</h4>
            </div>
            <FileText size={16} className="text-slate-500" />
          </div>
          <div className="space-y-2.5">
            {recentQuotations.length === 0 && <p className="text-[13px] text-slate-400">Chưa có báo giá.</p>}
            {recentQuotations.map(q => (
              <div key={q.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{q.clientName}</p>
                  <p className="text-xs text-slate-500">{q.eventName || 'Chưa gắn sự kiện'} • {q.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold text-blue-700">{formatCurrency(q.totalAmount)}</p>
                  <p className="text-[11px] text-slate-500 uppercase font-black">{q.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
