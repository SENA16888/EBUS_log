import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Building2,
  BusFront,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Package,
  ReceiptText,
  ShoppingBag,
  TrendingUp,
  Users
} from 'lucide-react';
import { AppState, Event, EventStatus, EventVenueType, SaleOrder } from '../types';
import { calcLineTotal } from '../services/pricing';

interface DashboardProps {
  appState: AppState;
}

const formatNumber = (value: number) => Math.round(value || 0).toLocaleString('vi-VN');
const formatCurrency = (value: number) => `${formatNumber(value)} đ`;
const todayKey = () => new Date().toISOString().slice(0, 10);
const monthKey = () => new Date().toISOString().slice(0, 7);

const getEventVenue = (event: Pick<Event, 'organizationVenue'>): EventVenueType => event.organizationVenue || 'EH';

const getEventDateKeys = (event: Event) => {
  const scheduled = (event.schedule || [])
    .map(item => item.date)
    .filter((date): date is string => Boolean(date))
    .sort();
  if (scheduled.length) return scheduled;
  return [event.startDate, event.endDate].filter((date): date is string => Boolean(date)).sort();
};

const getEffectiveEventStatus = (event: Event, today = todayKey()): EventStatus => {
  if (event.status === EventStatus.CANCELLED) return EventStatus.CANCELLED;
  const dates = getEventDateKeys(event);
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (!first && !last) return event.status;
  if (last && last < today) return EventStatus.COMPLETED;
  if (first && first <= today && (!last || last >= today)) return EventStatus.ONGOING;
  return EventStatus.UPCOMING;
};

const isDateInCurrentMonth = (date?: string) => Boolean(date && date.slice(0, 7) === monthKey());

const getOrderRevenue = (order: SaleOrder) => {
  const subtotal = (order.items || []).reduce((acc, item) => {
    const qty = item.soldQuantity ?? item.quantity ?? 0;
    return acc + calcLineTotal(item.price || 0, qty, item.discount || 0, item.discountPercent || 0);
  }, 0);
  return Math.max(0, subtotal - (order.orderDiscount || 0));
};

const getServiceRevenue = (event: Event, appState: AppState) => {
  if (!event.quotationId) return 0;
  const quotation = appState.quotations.find(q => q.id === event.quotationId);
  return Math.max(0, Number(quotation?.totalAmount) || Number(quotation?.contract?.contractAmount) || 0);
};

const compactList = <T,>(items: T[], limit: number) => items.slice(0, limit);

export const Dashboard: React.FC<DashboardProps> = ({ appState }) => {
  const data = useMemo(() => {
    const today = todayKey();
    const month = monthKey();
    const saleOrders = appState.saleOrders || [];
    const saleOrdersOnly = saleOrders.filter(order => (order.type || 'SALE') !== 'RETURN');
    const finalizedSalesThisMonth = saleOrdersOnly.filter(order => order.status === 'FINALIZED' && isDateInCurrentMonth(order.date));
    const monthSaleRevenue = finalizedSalesThisMonth.reduce((sum, order) => sum + getOrderRevenue(order), 0);

    const events = appState.events.map(event => ({
      event,
      status: getEffectiveEventStatus(event, today),
      firstDate: getEventDateKeys(event)[0] || event.startDate,
      lastDate: getEventDateKeys(event).slice(-1)[0] || event.endDate || event.startDate,
      venue: getEventVenue(event)
    }));
    const monthEvents = events.filter(item => isDateInCurrentMonth(item.firstDate) || isDateInCurrentMonth(item.lastDate));
    const todayEvents = events.filter(item => item.firstDate <= today && item.lastDate >= today);
    const upcomingEvents = events
      .filter(item => item.status === EventStatus.UPCOMING)
      .sort((a, b) => (a.firstDate || '').localeCompare(b.firstDate || ''));

    const serviceRevenueThisMonth = monthEvents.reduce((sum, item) => sum + getServiceRevenue(item.event, appState), 0);
    const quotePipeline = appState.quotations
      .filter(quote => isDateInCurrentMonth(quote.date))
      .reduce((sum, quote) => sum + (Number(quote.totalAmount) || 0), 0);
    const expensesThisMonth = monthEvents.reduce((sum, item) =>
      sum + (item.event.expenses || []).reduce((expenseSum, expense) => expenseSum + (expense.amount || 0), 0), 0);
    const staffAssignmentsThisMonth = monthEvents.reduce((sum, item) => sum + (item.event.staff?.length || 0), 0);

    const totalItems = appState.inventory.reduce((sum, item) => sum + (item.totalQuantity || 0), 0);
    const availableItems = appState.inventory.reduce((sum, item) => sum + (item.availableQuantity || 0), 0);
    const inUseItems = appState.inventory.reduce((sum, item) => sum + (item.inUseQuantity || 0), 0);
    const lowStockItems = [...appState.inventory]
      .filter(item => (item.availableQuantity || 0) < (item.minStock || 5))
      .sort((a, b) => (a.availableQuantity || 0) - (b.availableQuantity || 0));
    const damagedOrLost = appState.inventory.reduce((sum, item) => sum + (item.brokenQuantity || 0) + (item.lostQuantity || 0), 0);

    const statusData = [
      { name: 'Sắp tới', value: events.filter(item => item.status === EventStatus.UPCOMING).length, color: '#2563eb' },
      { name: 'Đang chạy', value: events.filter(item => item.status === EventStatus.ONGOING).length, color: '#16a34a' },
      { name: 'Hoàn thành', value: events.filter(item => item.status === EventStatus.COMPLETED).length, color: '#0f766e' },
      { name: 'Đã hủy', value: events.filter(item => item.status === EventStatus.CANCELLED).length, color: '#94a3b8' }
    ];

    const venueData = [
      { name: 'EH', value: monthEvents.filter(item => item.venue === 'EH').length, color: '#0f766e' },
      { name: 'EBUS', value: monthEvents.filter(item => item.venue === 'EBUS').length, color: '#2563eb' }
    ];

    const revenueData = [
      { name: 'Dịch vụ', value: serviceRevenueThisMonth, fill: '#0f766e' },
      { name: 'Bán hàng', value: monthSaleRevenue, fill: '#2563eb' },
      { name: 'Pipeline', value: Math.max(0, quotePipeline - serviceRevenueThisMonth), fill: '#f59e0b' }
    ].filter(item => item.value > 0);

    const inventoryByCategory = Object.values(appState.inventory.reduce((acc, item) => {
      const key = item.category || 'Khác';
      acc[key] = acc[key] || { name: key, value: 0 };
      acc[key].value += item.totalQuantity || 0;
      return acc;
    }, {} as Record<string, { name: string; value: number }>))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    return {
      today,
      month,
      monthEvents,
      todayEvents,
      upcomingEvents,
      statusData,
      venueData,
      revenueData,
      inventoryByCategory,
      monthSaleRevenue,
      serviceRevenueThisMonth,
      quotePipeline,
      expensesThisMonth,
      staffAssignmentsThisMonth,
      totalItems,
      availableItems,
      inUseItems,
      lowStockItems,
      damagedOrLost,
      recentOrders: compactList([...saleOrdersOnly].sort((a, b) => (b.date || '').localeCompare(a.date || '')), 5),
      recentQuotes: compactList([...appState.quotations].sort((a, b) => (b.date || '').localeCompare(a.date || '')), 5)
    };
  }, [appState]);

  const kpis = [
    {
      title: 'Sự kiện tháng này',
      value: formatNumber(data.monthEvents.length),
      sub: `${formatNumber(data.todayEvents.length)} đang diễn ra hôm nay`,
      icon: <CalendarDays size={18} />,
      tone: 'bg-blue-50 text-blue-700 border-blue-100'
    },
    {
      title: 'Doanh thu ghi nhận',
      value: formatCurrency(data.serviceRevenueThisMonth + data.monthSaleRevenue),
      sub: `${formatCurrency(data.serviceRevenueThisMonth)} dịch vụ, ${formatCurrency(data.monthSaleRevenue)} bán hàng`,
      icon: <TrendingUp size={18} />,
      tone: 'bg-emerald-50 text-emerald-700 border-emerald-100'
    },
    {
      title: 'Chi phí vận hành',
      value: formatCurrency(data.expensesThisMonth),
      sub: `${formatNumber(data.staffAssignmentsThisMonth)} lượt nhân sự trong tháng`,
      icon: <ReceiptText size={18} />,
      tone: 'bg-rose-50 text-rose-700 border-rose-100'
    },
    {
      title: 'Kho sẵn sàng',
      value: `${formatNumber(data.availableItems)} / ${formatNumber(data.totalItems)}`,
      sub: `${formatNumber(data.inUseItems)} đang xuất, ${formatNumber(data.lowStockItems.length)} cảnh báo tồn`,
      icon: <Boxes size={18} />,
      tone: 'bg-cyan-50 text-cyan-700 border-cyan-100'
    }
  ];

  return (
    <div className="space-y-5">
      <section className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase text-blue-700">
              <ClipboardList size={16} /> Tổng quan vận hành
            </div>
            <h2 className="mt-1 text-2xl font-black text-slate-900">Einstein House & EBUS</h2>
            <p className="mt-1 text-sm text-slate-500">Snapshot tháng {data.month}: sự kiện, doanh thu, kho và nhân sự đang vận hành.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <div className="rounded-lg border border-teal-100 bg-teal-50 px-3 py-2">
              <p className="text-[11px] font-bold uppercase text-teal-700">EH tháng này</p>
              <p className="text-lg font-black text-slate-900">{formatNumber(data.venueData[0].value)}</p>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
              <p className="text-[11px] font-bold uppercase text-blue-700">EBUS tháng này</p>
              <p className="text-lg font-black text-slate-900">{formatNumber(data.venueData[1].value)}</p>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
              <p className="text-[11px] font-bold uppercase text-amber-700">Pipeline báo giá</p>
              <p className="text-lg font-black text-slate-900">{formatCurrency(data.quotePipeline)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(item => (
          <div key={item.title} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg border ${item.tone}`}>
              {item.icon}
            </div>
            <p className="text-[12px] font-bold uppercase text-slate-400">{item.title}</p>
            <p className="mt-1 text-xl font-black text-slate-900">{item.value}</p>
            <p className="mt-1 text-xs text-slate-500">{item.sub}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase text-slate-400">Doanh thu tháng</p>
              <h3 className="text-base font-bold text-slate-900">Dịch vụ, bán hàng và pipeline</h3>
            </div>
            <ArrowUpRight size={18} className="text-slate-400" />
          </div>
          <div className="h-72">
            {data.revenueData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.revenueData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${Math.round(Number(value) / 1000000)}m`} />
                  <Tooltip formatter={(value: unknown) => formatCurrency(Number(value))} />
                  <Bar dataKey="value" radius={[7, 7, 0, 0]}>
                    {data.revenueData.map(item => <Cell key={item.name} fill={item.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Chưa có dữ liệu doanh thu trong tháng.</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase text-slate-400">Trạng thái sự kiện</p>
              <h3 className="text-base font-bold text-slate-900">Toàn hệ thống</h3>
            </div>
            <CheckCircle2 size={18} className="text-slate-400" />
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.statusData} cx="50%" cy="50%" innerRadius={48} outerRadius={70} paddingAngle={4} dataKey="value">
                  {data.statusData.map(item => <Cell key={item.name} fill={item.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {data.statusData.map(item => (
              <div key={item.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.name}
                </span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase text-slate-400">Hôm nay</p>
              <h3 className="text-base font-bold text-slate-900">Sự kiện đang chạy</h3>
            </div>
            <CalendarDays size={18} className="text-blue-600" />
          </div>
          <div className="space-y-2.5">
            {data.todayEvents.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Không có sự kiện trong hôm nay.</p>}
            {compactList(data.todayEvents, 5).map(({ event, venue }) => (
              <div key={event.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{event.name}</p>
                    <p className="text-xs text-slate-500">{event.client} - {event.location}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-black ${venue === 'EH' ? 'bg-teal-50 text-teal-700' : 'bg-blue-50 text-blue-700'}`}>
                    {venue}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">{event.items.length} thiết bị, {event.staff?.length || 0} nhân sự</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase text-slate-400">Sắp tới</p>
              <h3 className="text-base font-bold text-slate-900">Lịch gần nhất</h3>
            </div>
            <BusFront size={18} className="text-slate-500" />
          </div>
          <div className="space-y-2.5">
            {data.upcomingEvents.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Chưa có sự kiện sắp tới.</p>}
            {compactList(data.upcomingEvents, 5).map(({ event, firstDate, venue }) => (
              <div key={event.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-white p-3">
                <div>
                  <p className="font-semibold text-slate-900">{event.name}</p>
                  <p className="text-xs text-slate-500">{event.client}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-700">{firstDate}</p>
                  <p className={`mt-1 text-[11px] font-black ${venue === 'EH' ? 'text-teal-700' : 'text-blue-700'}`}>{venue}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase text-slate-400">Cảnh báo kho</p>
              <h3 className="text-base font-bold text-slate-900">Cần xử lý</h3>
            </div>
            <AlertTriangle size={18} className="text-amber-600" />
          </div>
          <div className="space-y-2.5">
            {data.lowStockItems.length === 0 && data.damagedOrLost === 0 && <p className="py-6 text-center text-sm text-slate-400">Kho đang ổn định.</p>}
            {data.damagedOrLost > 0 && (
              <div className="rounded-lg border border-rose-100 bg-rose-50 p-3">
                <p className="font-bold text-rose-800">Hư hỏng/mất: {formatNumber(data.damagedOrLost)}</p>
                <p className="text-xs text-rose-600">Kiểm tra lại biên bản và tồn kho thực tế.</p>
              </div>
            )}
            {compactList(data.lowStockItems, 4).map(item => (
              <div key={item.id} className="rounded-lg border border-amber-100 bg-amber-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">{item.name}</p>
                  <span className="text-xs font-black text-amber-800">{formatNumber(item.availableQuantity)}</span>
                </div>
                <p className="text-xs text-amber-700">{item.category} - ngưỡng {formatNumber(item.minStock || 5)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase text-slate-400">Kho theo nhóm</p>
              <h3 className="text-base font-bold text-slate-900">Phân bổ thiết bị</h3>
            </div>
            <Package size={18} className="text-slate-500" />
          </div>
          <div className="h-72">
            {data.inventoryByCategory.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.inventoryByCategory} layout="vertical" margin={{ left: 18 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={120} fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2563eb" radius={[0, 7, 7, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Chưa có dữ liệu kho.</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5">
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase text-slate-400">Hoạt động thương mại</p>
                <h3 className="text-base font-bold text-slate-900">Đơn bán gần nhất</h3>
              </div>
              <ShoppingBag size={18} className="text-slate-500" />
            </div>
            <div className="space-y-2">
              {data.recentOrders.length === 0 && <p className="text-sm text-slate-400">Chưa có đơn bán.</p>}
              {data.recentOrders.map(order => (
                <div key={order.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                  <div>
                    <p className="font-semibold text-slate-900">{order.customerName || 'Khách lẻ'}</p>
                    <p className="text-xs text-slate-500">{order.date} - {order.status || 'DRAFT'}</p>
                  </div>
                  <span className="text-sm font-black text-emerald-700">{formatCurrency(getOrderRevenue(order))}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase text-slate-400">Báo giá</p>
                <h3 className="text-base font-bold text-slate-900">Mới cập nhật</h3>
              </div>
              <FileText size={18} className="text-slate-500" />
            </div>
            <div className="space-y-2">
              {data.recentQuotes.length === 0 && <p className="text-sm text-slate-400">Chưa có báo giá.</p>}
              {data.recentQuotes.map(quote => (
                <div key={quote.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                  <div>
                    <p className="font-semibold text-slate-900">{quote.clientName}</p>
                    <p className="text-xs text-slate-500">{quote.eventName || quote.id} - {quote.status}</p>
                  </div>
                  <span className="text-sm font-black text-blue-700">{formatCurrency(quote.totalAmount || 0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">
          <div className="flex items-center gap-2 text-teal-800">
            <Building2 size={18} />
            <p className="font-black">EH</p>
          </div>
          <p className="mt-2 text-sm text-teal-700">{formatNumber(data.venueData[0].value)} sự kiện trong tháng, ưu tiên lịch phòng và nhân sự đón đoàn.</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-center gap-2 text-blue-800">
            <BusFront size={18} />
            <p className="font-black">EBUS</p>
          </div>
          <p className="mt-2 text-sm text-blue-700">{formatNumber(data.venueData[1].value)} sự kiện trong tháng, theo dõi thiết bị xuất kho và vận chuyển.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-slate-800">
            <Users size={18} />
            <p className="font-black">Nhân sự</p>
          </div>
          <p className="mt-2 text-sm text-slate-600">{formatNumber(data.staffAssignmentsThisMonth)} lượt phân công trong tháng hiện tại.</p>
        </div>
      </section>
    </div>
  );
};
