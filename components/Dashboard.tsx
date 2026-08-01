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
  Award,
  Boxes,
  BusFront,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  MapPin,
  School,
  TrendingUp,
  Users
} from 'lucide-react';
import { AppState, Event, EventStatus, EventVenueType } from '../types';

interface DashboardProps {
  appState: AppState;
}

const formatNumber = (value: number) => Math.round(value || 0).toLocaleString('vi-VN');
const formatCurrency = (value: number) => `${formatNumber(value)} đ`;
const todayKey = () => new Date().toISOString().slice(0, 10);

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

const getEventStudentCount = (event: Event) => {
  const value = event.studentCount
    ?? event.houseOperation?.studentCount
    ?? event.eventProfile?.attendanceMax
    ?? event.eventProfile?.attendanceMin;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
};

const getServiceRevenue = (event: Event, appState: AppState) => {
  if (!event.quotationId) return 0;
  const quotation = appState.quotations.find(q => q.id === event.quotationId);
  return Math.max(0, Number(quotation?.totalAmount) || Number(quotation?.contract?.contractAmount) || 0);
};

const getEventExpenseTotal = (event: Event) =>
  (event.expenses || []).reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);

const countBy = <T,>(items: T[], keyGetter: (item: T) => string) => {
  const map = new Map<string, number>();
  items.forEach(item => {
    const key = keyGetter(item).trim() || 'Chưa cập nhật';
    map.set(key, (map.get(key) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
};

export const Dashboard: React.FC<DashboardProps> = ({ appState }) => {
  const data = useMemo(() => {
    const today = todayKey();
    const normalizedEvents = appState.events.map(event => {
      const dates = getEventDateKeys(event);
      return {
        event,
        venue: getEventVenue(event),
        status: getEffectiveEventStatus(event, today),
        firstDate: dates[0] || event.startDate,
        lastDate: dates[dates.length - 1] || event.endDate || event.startDate
      };
    });

    const ebusEvents = normalizedEvents.filter(item => item.venue === 'EBUS');
    const completedEbusEvents = ebusEvents
      .filter(item => item.status === EventStatus.COMPLETED)
      .sort((a, b) => (a.firstDate || '').localeCompare(b.firstDate || ''));
    const activeEbusEvents = ebusEvents.filter(item => item.status === EventStatus.ONGOING);
    const upcomingEbusEvents = ebusEvents
      .filter(item => item.status === EventStatus.UPCOMING)
      .sort((a, b) => (a.firstDate || '').localeCompare(b.firstDate || ''));

    const totalStudents = completedEbusEvents.reduce((sum, item) => sum + getEventStudentCount(item.event), 0);
    const totalRevenue = completedEbusEvents.reduce((sum, item) => sum + getServiceRevenue(item.event, appState), 0);
    const totalExpense = completedEbusEvents.reduce((sum, item) => sum + getEventExpenseTotal(item.event), 0);
    const totalStaffAssignments = completedEbusEvents.reduce((sum, item) => sum + (item.event.staff?.length || 0), 0);
    const totalEquipmentUnits = completedEbusEvents.reduce((sum, item) =>
      sum + (item.event.items || []).reduce((itemSum, allocation) => {
        const preparedQuantity = item.event.checklist?.preparation?.[allocation.itemId]?.quantity;
        const legacyQuantity = item.event.checklist?.outbound?.[allocation.itemId];
        return itemSum + Math.max(0, Number(preparedQuantity ?? legacyQuantity ?? allocation.quantity) || 0);
      }, 0), 0);
    const schools = new Set(completedEbusEvents.map(item => item.event.client).filter(Boolean));
    const locations = new Set(completedEbusEvents.map(item => item.event.location).filter(Boolean));

    const monthlyTrendMap = new Map<string, { name: string; events: number; students: number }>();
    completedEbusEvents.forEach(item => {
      const month = (item.firstDate || '').slice(0, 7) || 'Chưa rõ';
      const current = monthlyTrendMap.get(month) || { name: month, events: 0, students: 0 };
      current.events += 1;
      current.students += getEventStudentCount(item.event);
      monthlyTrendMap.set(month, current);
    });
    const monthlyTrend = Array.from(monthlyTrendMap.values()).slice(-12);

    const statusData = [
      { name: 'Đã diễn ra', value: completedEbusEvents.length, color: '#0f766e' },
      { name: 'Đang chạy', value: activeEbusEvents.length, color: '#16a34a' },
      { name: 'Sắp tới', value: upcomingEbusEvents.length, color: '#2563eb' },
      { name: 'Đã hủy', value: ebusEvents.filter(item => item.status === EventStatus.CANCELLED).length, color: '#94a3b8' }
    ];

    return {
      completedEbusEvents,
      activeEbusEvents,
      upcomingEbusEvents,
      totalStudents,
      totalRevenue,
      totalExpense,
      totalStaffAssignments,
      totalEquipmentUnits,
      schools: schools.size,
      locations: locations.size,
      avgStudents: completedEbusEvents.length ? Math.round(totalStudents / completedEbusEvents.length) : 0,
      monthlyTrend,
      statusData,
      topSchools: countBy(completedEbusEvents, item => item.event.client).slice(0, 6),
      topLocations: countBy(completedEbusEvents, item => item.event.location).slice(0, 6),
      recentCompleted: completedEbusEvents.slice(-6).reverse()
    };
  }, [appState]);

  const kpis = [
    {
      title: 'Sự kiện EBUS đã diễn ra',
      value: formatNumber(data.completedEbusEvents.length),
      sub: `${formatNumber(data.activeEbusEvents.length)} đang chạy, ${formatNumber(data.upcomingEbusEvents.length)} sắp tới`,
      icon: <BusFront size={18} />,
      tone: 'bg-blue-50 text-blue-700 border-blue-100'
    },
    {
      title: 'Số lượng học sinh tiếp đón',
      value: formatNumber(data.totalStudents),
      sub: `Trung bình ${formatNumber(data.avgStudents)} học sinh / sự kiện`,
      icon: <Users size={18} />,
      tone: 'bg-emerald-50 text-emerald-700 border-emerald-100'
    },
    {
      title: 'Trường/đơn vị đã phục vụ',
      value: formatNumber(data.schools),
      sub: `${formatNumber(data.locations)} địa điểm tổ chức`,
      icon: <School size={18} />,
      tone: 'bg-cyan-50 text-cyan-700 border-cyan-100'
    },
    {
      title: 'Doanh thu dịch vụ ghi nhận',
      value: formatCurrency(data.totalRevenue),
      sub: `Chi phí vận hành ${formatCurrency(data.totalExpense)}`,
      icon: <CircleDollarSign size={18} />,
      tone: 'bg-amber-50 text-amber-700 border-amber-100'
    },
    {
      title: 'Nhân sự triển khai',
      value: formatNumber(data.totalStaffAssignments),
      sub: `${formatNumber(data.totalEquipmentUnits)} lượt thiết bị đã mang đi`,
      icon: <ClipboardList size={18} />,
      tone: 'bg-slate-100 text-slate-800 border-slate-200'
    }
  ];

  return (
    <div className="space-y-5">
      <section className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase text-blue-700">
              <Award size={16} /> Tổng quan chương trình EBUS
            </div>
            <h2 className="mt-1 text-2xl font-black text-slate-900">Các chỉ số EBUS đã diễn ra</h2>
            <p className="mt-1 text-sm text-slate-500">
              Tổng hợp tích lũy các sự kiện EBUS đã tổ chức. Báo cáo chi tiết theo kỳ nằm ở module Báo cáo.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
              <p className="text-[11px] font-bold uppercase text-blue-700">Sắp tới</p>
              <p className="text-lg font-black text-slate-900">{formatNumber(data.upcomingEbusEvents.length)}</p>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
              <p className="text-[11px] font-bold uppercase text-emerald-700">Đang chạy</p>
              <p className="text-lg font-black text-slate-900">{formatNumber(data.activeEbusEvents.length)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
              <p className="text-xs font-black uppercase text-slate-400">Tăng trưởng chương trình</p>
              <h3 className="text-base font-bold text-slate-900">Sự kiện và học sinh theo tháng</h3>
            </div>
            <TrendingUp size={18} className="text-slate-400" />
          </div>
          <div className="h-72">
            {data.monthlyTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" stroke="#0f766e" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value: unknown) => formatNumber(Number(value))} />
                  <Bar yAxisId="left" dataKey="events" name="Sự kiện" fill="#2563eb" radius={[7, 7, 0, 0]} />
                  <Bar yAxisId="right" dataKey="students" name="Học sinh" fill="#0f766e" radius={[7, 7, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Chưa có dữ liệu EBUS đã diễn ra.</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase text-slate-400">Trạng thái EBUS</p>
              <h3 className="text-base font-bold text-slate-900">Toàn chương trình</h3>
            </div>
            <BusFront size={18} className="text-blue-600" />
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
              <p className="text-xs font-black uppercase text-slate-400">Đơn vị tiêu biểu</p>
              <h3 className="text-base font-bold text-slate-900">Theo số lần tổ chức</h3>
            </div>
            <School size={18} className="text-slate-500" />
          </div>
          <div className="space-y-2">
            {data.topSchools.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Chưa có dữ liệu.</p>}
            {data.topSchools.map(row => (
              <div key={row.name} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-semibold text-slate-800">{row.name}</span>
                <span className="text-sm font-black text-blue-700">{formatNumber(row.value)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase text-slate-400">Địa điểm</p>
              <h3 className="text-base font-bold text-slate-900">Nơi đã triển khai</h3>
            </div>
            <MapPin size={18} className="text-slate-500" />
          </div>
          <div className="space-y-2">
            {data.topLocations.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Chưa có dữ liệu.</p>}
            {data.topLocations.map(row => (
              <div key={row.name} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-semibold text-slate-800">{row.name}</span>
                <span className="text-sm font-black text-teal-700">{formatNumber(row.value)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase text-slate-400">Gần nhất</p>
              <h3 className="text-base font-bold text-slate-900">EBUS đã diễn ra</h3>
            </div>
            <CalendarDays size={18} className="text-slate-500" />
          </div>
          <div className="space-y-2">
            {data.recentCompleted.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Chưa có sự kiện đã diễn ra.</p>}
            {data.recentCompleted.map(({ event, firstDate }) => (
              <div key={event.id} className="rounded-lg border border-slate-100 bg-white px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{event.name}</p>
                    <p className="text-xs text-slate-500">{event.client}</p>
                  </div>
                  <span className="text-xs font-bold text-slate-600">{firstDate}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{formatNumber(getEventStudentCount(event))} học sinh tiếp đón</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-center gap-2 text-blue-800">
            <BusFront size={18} />
            <p className="font-black">Phạm vi tổng quan</p>
          </div>
          <p className="mt-2 text-sm text-blue-700">Chỉ tính các sự kiện thuộc EBUS và đã diễn ra, dựa theo ngày tổ chức thực tế.</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-emerald-800">
            <Users size={18} />
            <p className="font-black">Học sinh tiếp đón</p>
          </div>
          <p className="mt-2 text-sm text-emerald-700">Ưu tiên số học sinh trong sự kiện, sau đó lấy dữ liệu vận hành hoặc quy mô dự kiến trong hồ sơ.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-slate-800">
            <Boxes size={18} />
            <p className="font-black">Chi tiết</p>
          </div>
          <p className="mt-2 text-sm text-slate-600">Các bảng chi phí, nhân sự, hóa đơn và lọc EH/EBUS vẫn nằm trong module Báo cáo.</p>
        </div>
      </section>
    </div>
  );
};
