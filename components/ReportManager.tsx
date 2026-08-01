import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  Building2,
  BusFront,
  CalendarDays,
  Download,
  FileText,
  PackageX,
  Printer,
  ReceiptText,
  School,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards
} from 'lucide-react';
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
import { AppState, Event, EventExpense, EventStatus, InventoryItem, PayrollAdjustment, Quotation, SaleOrder } from '../types';
import { calcLineTotal } from '../services/pricing';

interface ReportManagerProps {
  appState: AppState;
}

type ConsumableAggregate = {
  itemId: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  events: Set<string>;
  eventName: string;
};

type EquipmentUsageAggregate = {
  itemId: string;
  name: string;
  category: string;
  quantity: number;
  events: Set<string>;
  totalUsage: number;
  maxUsage?: number;
  totalQuantity: number;
};

type MoneyRow = {
  label: string;
  value: number;
  note?: string;
};

type ServiceRevenueRow = {
  eventId: string;
  eventName: string;
  eventDate: string;
  quotationId: string;
  source: string;
  amount: number;
};

type VenueFilter = 'ALL' | 'EH' | 'EBUS';

const VENUE_FILTERS: { value: VenueFilter; label: string; icon: React.ReactNode }[] = [
  { value: 'ALL', label: 'Tất cả', icon: <CalendarDays size={15} /> },
  { value: 'EH', label: 'EH', icon: <Building2 size={15} /> },
  { value: 'EBUS', label: 'EBUS', icon: <BusFront size={15} /> }
];

const EXPENSE_LABELS: Record<EventExpense['category'], string> = {
  TRANSPORT_GOODS: 'Vận chuyển hàng',
  TRANSPORT_STAFF: 'Di chuyển nhân sự',
  FUEL: 'Tiền dầu',
  DRIVER_FEE: 'Tiền tài xế',
  ACCOMMODATION: 'Lưu trú',
  PRINTING: 'In ấn',
  CONSUMABLES: 'Vật tư tiêu hao',
  CATERING: 'Ăn uống',
  MISC: 'Khác'
};

const STATUS_LABELS: Record<EventStatus, string> = {
  [EventStatus.UPCOMING]: 'Sắp tới',
  [EventStatus.ONGOING]: 'Đang chạy',
  [EventStatus.COMPLETED]: 'Hoàn thành',
  [EventStatus.CANCELLED]: 'Đã hủy'
};

const STATUS_COLORS: Record<EventStatus, string> = {
  [EventStatus.UPCOMING]: '#2563eb',
  [EventStatus.ONGOING]: '#16a34a',
  [EventStatus.COMPLETED]: '#0f766e',
  [EventStatus.CANCELLED]: '#94a3b8'
};

const formatNumber = (value: number) => value.toLocaleString('vi-VN');
const formatCurrency = (value: number) => `${Math.round(value || 0).toLocaleString('vi-VN')} đ`;
const currentMonth = () => new Date().toISOString().slice(0, 7);
const monthToIndex = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number);
  return year * 12 + monthNumber - 1;
};

const normalizeMonthRange = (startMonth: string, endMonth: string) => {
  const fallback = currentMonth();
  const start = startMonth || fallback;
  const end = endMonth || start;
  return monthToIndex(start) <= monthToIndex(end)
    ? { startMonth: start, endMonth: end }
    : { startMonth: end, endMonth: start };
};

const formatMonthLabel = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number);
  if (!year || !monthNumber) return month;
  return `Tháng ${monthNumber}/${year}`;
};

const formatRangeLabel = (startMonth: string, endMonth: string) =>
  startMonth === endMonth
    ? formatMonthLabel(startMonth)
    : `${formatMonthLabel(startMonth)} - ${formatMonthLabel(endMonth)}`;

const safeDate = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isDateInRange = (value: string | undefined, startMonth: string, endMonth: string) => {
  if (!value) return false;
  const monthValue = value.slice(0, 7);
  return monthToIndex(monthValue) >= monthToIndex(startMonth) && monthToIndex(monthValue) <= monthToIndex(endMonth);
};

const isEventInRange = (event: Event, startMonth: string, endMonth: string) => {
  if ((event.schedule || []).some(item => isDateInRange(item.date, startMonth, endMonth))) return true;
  const [startYear, startMonthNumber] = startMonth.split('-').map(Number);
  const [endYear, endMonthNumber] = endMonth.split('-').map(Number);
  const periodStart = new Date(startYear, startMonthNumber - 1, 1).getTime();
  const periodEnd = new Date(endYear, endMonthNumber, 0, 23, 59, 59, 999).getTime();
  const start = safeDate(event.startDate)?.getTime();
  const end = safeDate(event.endDate || event.startDate)?.getTime();
  if (!start && !end) return false;
  const rangeStart = start ?? end ?? 0;
  const rangeEnd = end ?? start ?? 0;
  return rangeStart <= periodEnd && rangeEnd >= periodStart;
};

const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getEventDateKeys = (event: Event) => {
  const scheduleDates = (event.schedule || [])
    .map(item => item.date)
    .filter((date): date is string => Boolean(date))
    .sort();
  if (scheduleDates.length > 0) return scheduleDates;
  return [event.startDate, event.endDate]
    .filter((date): date is string => Boolean(date))
    .sort();
};

const getEffectiveEventStatus = (event: Event, todayKey = getLocalDateKey()): EventStatus => {
  if (event.status === EventStatus.CANCELLED) return EventStatus.CANCELLED;
  const dates = getEventDateKeys(event);
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  if (!firstDate && !lastDate) return event.status;
  if (lastDate && lastDate < todayKey) return EventStatus.COMPLETED;
  if (firstDate && firstDate <= todayKey && (!lastDate || lastDate >= todayKey)) return EventStatus.ONGOING;
  return EventStatus.UPCOMING;
};

const getEventVenue = (event: Pick<Event, 'organizationVenue'>) => event.organizationVenue || 'EH';

const getEventStudentCount = (event: Event) => {
  const value = event.studentCount
    ?? event.houseOperation?.studentCount
    ?? event.eventProfile?.attendanceMax
    ?? event.eventProfile?.attendanceMin;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
};

const getVenueLabel = (venue: VenueFilter) => {
  if (venue === 'EH') return 'Einstein House (EH)';
  if (venue === 'EBUS') return 'EBUS';
  return 'Tất cả EH + EBUS';
};

const allocatePenaltyBySmallerSource = (ehAmount: number, ebusAmount: number, penaltyAmount: number) => {
  let remaining = Math.max(0, Number(penaltyAmount) || 0);
  const penalties: Record<'EH' | 'EBUS', number> = { EH: 0, EBUS: 0 };
  const sources = [
    { venue: 'EH' as const, amount: Math.max(0, Number(ehAmount) || 0) },
    { venue: 'EBUS' as const, amount: Math.max(0, Number(ebusAmount) || 0) }
  ]
    .filter(source => source.amount > 0)
    .sort((a, b) => a.amount - b.amount);

  sources.forEach(source => {
    if (remaining <= 0) return;
    const deduction = Math.min(source.amount, remaining);
    penalties[source.venue] += deduction;
    remaining -= deduction;
  });

  return {
    ehPenalty: penalties.EH,
    ebusPenalty: penalties.EBUS,
    unappliedPenalty: remaining
  };
};

const getOrderRevenue = (order: SaleOrder) => {
  const subtotal = (order.items || []).reduce((acc, item) => {
    const quantity = item.soldQuantity ?? item.quantity ?? 0;
    return acc + calcLineTotal(item.price || 0, quantity, item.discount || 0, item.discountPercent || 0);
  }, 0);
  return Math.max(0, subtotal - (order.orderDiscount || 0));
};

const getQuotationRevenue = (quotation?: AppState['quotations'][number] | null) => {
  if (!quotation) return 0;
  return Math.max(0, Number(quotation.totalAmount) || Number(quotation.contract?.contractAmount) || 0);
};

const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const downloadCsv = (filename: string, rows: unknown[][]) => {
  const csv = rows.map(row => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
};

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char] || char));

export const ReportManager: React.FC<ReportManagerProps> = ({ appState }) => {
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [endMonth, setEndMonth] = useState(currentMonth);
  const [venueFilter, setVenueFilter] = useState<VenueFilter>('ALL');

  const report = useMemo(() => {
    const period = normalizeMonthRange(startMonth, endMonth);
    const periodLabel = formatRangeLabel(period.startMonth, period.endMonth);
    const venueLabel = getVenueLabel(venueFilter);
    const inventoryMap = new Map<string, InventoryItem>(appState.inventory.map(item => [item.id, item]));
    const quotationMap = new Map<string, Quotation>(appState.quotations.map(quotation => [quotation.id, quotation]));
    const allLinkedQuotationIds = new Set(appState.events.map(event => event.quotationId).filter((id): id is string => Boolean(id)));
    const allMonthlyEvents = appState.events
      .filter(event => isEventInRange(event, period.startMonth, period.endMonth))
      .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
    const monthlyEvents = allMonthlyEvents
      .filter(event => venueFilter === 'ALL' || getEventVenue(event) === venueFilter)
      .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
    const studentTotal = monthlyEvents.reduce((sum, event) => sum + getEventStudentCount(event), 0);
    const monthlyEventIds = new Set(monthlyEvents.map(event => event.id));
    const monthlyEventSaleOrderIds = new Set(monthlyEvents.flatMap(event => event.saleOrderIds || []));
    const todayKey = getLocalDateKey();
    const eventStatusById = new Map(monthlyEvents.map(event => [event.id, getEffectiveEventStatus(event, todayKey)]));

    const periodSaleOrders = (appState.saleOrders || []).filter(order => isDateInRange(order.date, period.startMonth, period.endMonth));
    const saleOrders = periodSaleOrders.filter(order =>
      venueFilter === 'ALL'
      || (order.eventId ? monthlyEventIds.has(order.eventId) : false)
      || monthlyEventSaleOrderIds.has(order.id)
    );
    const sales = saleOrders.filter(order => (order.type || 'SALE') !== 'RETURN');
    const returns = saleOrders.filter(order => (order.type || '') === 'RETURN');
    const finalizedSales = sales.filter(order => order.status === 'FINALIZED');
    const saleRevenue = finalizedSales.reduce((sum, order) => sum + getOrderRevenue(order), 0);
    const returnedUnits = returns.reduce((sum, order) =>
      sum + (order.items || []).reduce((itemSum, item) => itemSum + (item.quantity || 0), 0), 0);
    const netSaleRevenue = saleRevenue;

    const countedServiceQuotationIds = new Set<string>();
    const serviceRevenueRows = monthlyEvents.flatMap((event): ServiceRevenueRow[] => {
      if (!event.quotationId || countedServiceQuotationIds.has(event.quotationId)) return [];
      const quotation = quotationMap.get(event.quotationId);
      if (!quotation) return [];
      countedServiceQuotationIds.add(event.quotationId);
      return [{
        eventId: event.id,
        eventName: event.name,
        eventDate: event.startDate || event.endDate || quotation.date,
        quotationId: quotation.id,
        source: quotation.source === 'CONTRACT' ? 'Hợp đồng' : 'Báo giá',
        amount: getQuotationRevenue(quotation)
      }];
    });
    const serviceRevenue = serviceRevenueRows.reduce((sum, row) => sum + row.amount, 0);
    const serviceRevenueByEvent = new Map(serviceRevenueRows.map(row => [row.eventId, row.amount]));
    const acceptedQuotations = appState.quotations.filter(q =>
      venueFilter === 'ALL'
      && !allLinkedQuotationIds.has(q.id)
      && q.status === 'ACCEPTED'
      && isDateInRange(q.date, period.startMonth, period.endMonth)
      && !countedServiceQuotationIds.has(q.id)
    );
    const acceptedQuotationRevenue = acceptedQuotations.reduce((sum, q) => sum + getQuotationRevenue(q), 0);
    const quotedRevenue = serviceRevenue + acceptedQuotationRevenue;
    const recognizedRevenue = netSaleRevenue + quotedRevenue;

    const expenseRows = monthlyEvents.flatMap(event =>
      (event.expenses || []).map(expense => ({
        ...expense,
        eventId: event.id,
        eventName: event.name,
        eventDate: event.startDate
      }))
    );
    const expenseTotal = expenseRows.reduce((sum, expense) => sum + (expense.amount || 0), 0);
    const expenseChart = Object.entries(EXPENSE_LABELS).map(([key, label]) => ({
      name: label,
      value: expenseRows
        .filter(expense => expense.category === key)
        .reduce((sum, expense) => sum + (expense.amount || 0), 0)
    })).filter(item => item.value > 0);

    const buildStaffEntries = (sourceEvents: Event[]) => sourceEvents.flatMap(event =>
      (event.staff || []).map(staff => {
        const date = staff.shiftDate || event.startDate || event.endDate || '';
        if (staff.shiftDate && !isDateInRange(staff.shiftDate, period.startMonth, period.endMonth)) return null;
        const employee = appState.employees.find(emp => emp.id === staff.employeeId);
        const salary = Number.isFinite(staff.salary)
          ? Number(staff.salary)
          : (staff.unit === 'FIXED' ? staff.rate : (staff.rate || 0) * (staff.quantity || 0));
        return {
          employeeId: staff.employeeId,
          employeeName: employee?.name || staff.employeeId,
          role: employee?.role || '',
          eventName: event.name,
          date,
          month: date.slice(0, 7),
          venue: getEventVenue(event),
          task: staff.task,
          salary: Number.isFinite(salary) ? salary : 0
        };
      }).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    );

    const staffEntries = buildStaffEntries(monthlyEvents);
    const allPayrollStaffEntries = buildStaffEntries(allMonthlyEvents);
    const payrollBaseByEmployeeMonth = allPayrollStaffEntries.reduce((map, entry) => {
      if (!entry.month) return map;
      const key = `${entry.employeeId}::${entry.month}`;
      const current = map.get(key) || { employeeId: entry.employeeId, month: entry.month, eh: 0, ebus: 0 };
      if (entry.venue === 'EBUS') current.ebus += entry.salary;
      else current.eh += entry.salary;
      map.set(key, current);
      return map;
    }, new Map<string, { employeeId: string; month: string; eh: number; ebus: number }>());
    const payrollAdjustmentMap = new Map<string, PayrollAdjustment>((appState.payrollAdjustments || [])
      .map(adjustment => [`${adjustment.employeeId}::${adjustment.month}`, adjustment]));
    const payrollAllocationByEmployeeMonth = Array.from(payrollBaseByEmployeeMonth.values()).reduce((map, base) => {
      const key = `${base.employeeId}::${base.month}`;
      const adjustment = payrollAdjustmentMap.get(key);
      const penaltyAmount = Number(adjustment?.penaltyAmount) || 0;
      const penaltyAllocation = allocatePenaltyBySmallerSource(base.eh, base.ebus, penaltyAmount);
      map.set(key, {
        bonusAmount: Number(adjustment?.bonusAmount) || 0,
        penaltyAmount,
        ...penaltyAllocation
      });
      return map;
    }, new Map<string, { bonusAmount: number; penaltyAmount: number; ehPenalty: number; ebusPenalty: number; unappliedPenalty: number }>());

    const staffRowMap = staffEntries.reduce((map, entry) => {
      const current = map.get(entry.employeeId) || {
        employeeId: entry.employeeId,
        employeeName: entry.employeeName,
        role: entry.role,
        shifts: 0,
        salary: 0,
        grossSalary: 0,
        bonusAmount: 0,
        penaltyAmount: 0,
        unappliedPenalty: 0,
        events: new Set<string>()
      };
      current.shifts += 1;
      current.salary += entry.salary;
      current.grossSalary += entry.salary;
      current.events.add(entry.eventName);
      map.set(entry.employeeId, current);
      return map;
    }, new Map<string, { employeeId: string; employeeName: string; role: string; shifts: number; salary: number; grossSalary: number; bonusAmount: number; penaltyAmount: number; unappliedPenalty: number; events: Set<string> }>());
    const visiblePayrollSlices = staffEntries.reduce((map, entry) => {
      const key = `${entry.employeeId}::${entry.month}::${entry.venue}`;
      const current = map.get(key) || { employeeId: entry.employeeId, month: entry.month, venue: entry.venue, salary: 0 };
      current.salary += entry.salary;
      map.set(key, current);
      return map;
    }, new Map<string, { employeeId: string; month: string; venue: 'EH' | 'EBUS'; salary: number }>());
    visiblePayrollSlices.forEach(slice => {
      const row = staffRowMap.get(slice.employeeId);
      const allocation = payrollAllocationByEmployeeMonth.get(`${slice.employeeId}::${slice.month}`);
      if (!row || !allocation) return;
      const sourcePenalty = slice.venue === 'EBUS' ? allocation.ebusPenalty : allocation.ehPenalty;
      const appliedPenalty = Math.min(slice.salary, sourcePenalty);
      row.salary -= appliedPenalty;
      row.penaltyAmount += appliedPenalty;
      if (venueFilter === 'ALL') {
        row.unappliedPenalty += allocation.unappliedPenalty;
      }
    });
    const visibleEmployeeMonths = Array.from(staffEntries.reduce((map, entry) => {
      if (entry.month) map.set(`${entry.employeeId}::${entry.month}`, { employeeId: entry.employeeId, month: entry.month });
      return map;
    }, new Map<string, { employeeId: string; month: string }>()).values());
    if (venueFilter === 'ALL') {
      visibleEmployeeMonths.forEach(({ employeeId, month }) => {
        const row = staffRowMap.get(employeeId);
        const allocation = payrollAllocationByEmployeeMonth.get(`${employeeId}::${month}`);
        if (!row || !allocation?.bonusAmount) return;
        row.salary += allocation.bonusAmount;
        row.bonusAmount += allocation.bonusAmount;
      });
    }
    const staffRows = Array.from(staffRowMap.values())
      .map(row => ({ ...row, events: Array.from(row.events) }))
      .sort((a, b) => b.salary - a.salary);
    const staffCost = staffRows.reduce((sum, row) => sum + row.salary, 0);
    const staffAdjustmentSummary = staffRows.reduce((sum, row) => ({
      bonus: sum.bonus + row.bonusAmount,
      penalty: sum.penalty + row.penaltyAmount,
      unappliedPenalty: sum.unappliedPenalty + row.unappliedPenalty
    }), { bonus: 0, penalty: 0, unappliedPenalty: 0 });

    const advances = monthlyEvents.flatMap(event =>
      (event.advanceRequests || []).map(advance => ({
        ...advance,
        eventName: event.name,
        paid: !!event.advancePaidConfirmed
      }))
    );
    const confirmedAdvance = monthlyEvents.reduce((sum, event) =>
      sum + (event.advancePaidConfirmed ? (event.advancePaidAmount || 0) : 0), 0);

    const consumableRows = monthlyEvents.flatMap(event =>
      (event.items || []).map(allocation => {
        const item = inventoryMap.get(allocation.itemId);
        if (!item || item.lifecycle !== 'CONSUMABLE') return null;
        const preparedQuantity = event.checklist?.preparation?.[allocation.itemId]?.quantity;
        const legacyCarried = event.checklist?.outbound?.[allocation.itemId] || allocation.quantity || 0;
        const carriedQuantity = Math.max(0, preparedQuantity ?? legacyCarried);
        if (carriedQuantity <= 0) return null;
        return {
          itemId: item.id,
          name: item.name,
          category: item.category,
          unit: item.consumableUnit || 'cái',
          eventName: event.name,
          quantity: carriedQuantity
        };
      }).filter((row): row is NonNullable<typeof row> => Boolean(row))
    );
    const carriedAggregateMap = consumableRows.reduce((map, row) => {
      const current = map.get(row.itemId) || { ...row, quantity: 0, events: new Set<string>() };
      current.quantity += row.quantity;
      current.events.add(row.eventName);
      map.set(row.itemId, current);
      return map;
    }, new Map<string, ConsumableAggregate>());
    const consumableCarriedSummary = Array.from(carriedAggregateMap.values() as IterableIterator<ConsumableAggregate>)
      .map(row => ({ ...row, events: Array.from(row.events) }))
      .sort((a, b) => b.quantity - a.quantity);

    const actualConsumptionRows = [
      ...monthlyEvents.flatMap(event => (event.checklist?.incidents || [])
        .filter(incident => incident.type === 'CONSUMED')
        .map(incident => {
          const item = inventoryMap.get(incident.itemId);
          if (!item || item.lifecycle !== 'CONSUMABLE') return null;
          return {
            itemId: item.id,
            name: item.name,
            category: item.category,
            unit: item.consumableUnit || 'cái',
            eventName: event.name,
            quantity: incident.quantity || 0
          };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row))),
      ...((venueFilter === 'EH' ? [] : appState.inventoryAudits || [])
        .filter(audit => !!audit.reconciledAt && isDateInRange(audit.reconciledAt || audit.createdAt, period.startMonth, period.endMonth))
        .flatMap(audit => (audit.items || [])
          .filter(row => row.varianceReason === 'CONSUMED' && (row.variance || 0) < 0)
          .map(row => {
            const item = inventoryMap.get(row.itemId);
            if (!item || item.lifecycle !== 'CONSUMABLE') return null;
            return {
              itemId: item.id,
              name: item.name,
              category: item.category,
              unit: item.consumableUnit || 'cái',
              eventName: audit.code,
              quantity: Math.abs(row.variance || 0)
            };
          })
          .filter((row): row is NonNullable<typeof row> => Boolean(row)))
      )
    ];
    const actualAggregateMap = actualConsumptionRows.reduce((map, row) => {
      const current = map.get(row.itemId) || { ...row, quantity: 0, events: new Set<string>() };
      current.quantity += row.quantity;
      current.events.add(row.eventName);
      map.set(row.itemId, current);
      return map;
    }, new Map<string, ConsumableAggregate>());
    const actualConsumableSummary = Array.from(actualAggregateMap.values() as IterableIterator<ConsumableAggregate>)
      .map(row => ({
        ...row,
        events: Array.from(row.events),
        carriedQuantity: consumableCarriedSummary.find(carried => carried.itemId === row.itemId)?.quantity || 0
      }))
      .sort((a, b) => b.quantity - a.quantity);
    const consumableSummary = [
      ...actualConsumableSummary,
      ...consumableCarriedSummary
        .filter(carried => !actualConsumableSummary.some(actual => actual.itemId === carried.itemId))
        .map(carried => ({ ...carried, quantity: 0, carriedQuantity: carried.quantity }))
    ].sort((a, b) => b.quantity - a.quantity || b.carriedQuantity - a.carriedQuantity);

    const equipmentUsageMap = monthlyEvents.flatMap(event =>
      (event.items || []).map(allocation => {
        const item = inventoryMap.get(allocation.itemId);
        if (!item || item.lifecycle === 'CONSUMABLE') return null;
        const prepared = event.checklist?.preparation?.[allocation.itemId];
        const legacyQuantity = event.checklist?.outbound?.[allocation.itemId] || 0;
        const quantity = prepared
          ? (prepared.status === 'MISSING' && prepared.quantity === 0 ? 0 : prepared.quantity)
          : legacyQuantity;
        if (quantity <= 0) return null;
        return { item, eventName: event.name, quantity };
      }).filter((row): row is NonNullable<typeof row> => Boolean(row))
    ).reduce((map, row) => {
      const current = map.get(row.item.id) || {
        itemId: row.item.id,
        name: row.item.name,
        category: row.item.category,
        quantity: 0,
        events: new Set<string>(),
        totalUsage: row.item.usageCount || 0,
        maxUsage: row.item.maxUsage,
        totalQuantity: row.item.totalQuantity || 0
      };
      current.quantity += row.quantity;
      current.events.add(row.eventName);
      map.set(row.item.id, current);
      return map;
    }, new Map<string, EquipmentUsageAggregate>());
    const equipmentUsageSummary = Array.from(equipmentUsageMap.values() as IterableIterator<EquipmentUsageAggregate>)
      .map(row => ({ ...row, events: Array.from(row.events) }))
      .sort((a, b) => b.quantity - a.quantity);

    const damageByItem = new Map<string, { itemId: string; name: string; category: string; damaged: number; lost: number; sources: Set<string> }>();
    const addDamage = (itemId: string, damaged: number, lost: number, source: string) => {
      if (!itemId || (damaged <= 0 && lost <= 0)) return;
      const item = inventoryMap.get(itemId);
      const current = damageByItem.get(itemId) || {
        itemId,
        name: item?.name || itemId,
        category: item?.category || '',
        damaged: 0,
        lost: 0,
        sources: new Set<string>()
      };
      current.damaged += damaged;
      current.lost += lost;
      current.sources.add(source);
      damageByItem.set(itemId, current);
    };

    monthlyEvents.forEach(event => {
      Object.entries(event.checklist?.damaged || {}).forEach(([itemId, qty]) => addDamage(itemId, Number(qty) || 0, 0, event.name));
      Object.entries(event.checklist?.lost || {}).forEach(([itemId, qty]) => addDamage(itemId, 0, Number(qty) || 0, event.name));
    });
    (appState.transactions || [])
      .filter(tx => isDateInRange(tx.date, period.startMonth, period.endMonth))
      .filter(tx => venueFilter === 'ALL' || (tx.eventId ? monthlyEventIds.has(tx.eventId) : false))
      .forEach(tx => {
        if (tx.type === 'REPORT_BROKEN') addDamage(tx.itemId, tx.quantity || 0, 0, tx.note || 'Giao dịch kho');
        if (tx.type === 'REPORT_LOST') addDamage(tx.itemId, 0, tx.quantity || 0, tx.note || 'Giao dịch kho');
      });
    const damageRows = Array.from(damageByItem.values())
      .map(row => ({ ...row, sources: Array.from(row.sources) }))
      .sort((a, b) => (b.damaged + b.lost) - (a.damaged + a.lost));

    const receipts = (venueFilter === 'ALL' ? (appState.inventoryReceipts || []) : [])
      .filter(receipt => isDateInRange(receipt.createdAt, period.startMonth, period.endMonth))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const receiptUnits = receipts.reduce((sum, receipt) =>
      sum + (receipt.items || []).reduce((itemSum, item) => itemSum + (item.quantity || 0), 0), 0);
    const vatInvoiceRows = expenseRows.filter(expense => !!expense.vatInvoiceLink);
    const missingInvoiceExpenses = expenseRows.filter(expense => !expense.vatInvoiceLink);

    const eventStatusRows = Object.values(EventStatus).map(status => ({
      name: STATUS_LABELS[status],
      value: monthlyEvents.filter(event => eventStatusById.get(event.id) === status).length,
      color: STATUS_COLORS[status]
    }));

    const monthlyInventorySnapshot = appState.inventory.reduce((acc, item) => ({
      broken: acc.broken + (item.brokenQuantity || 0),
      lost: acc.lost + (item.lostQuantity || 0),
      consumables: acc.consumables + (item.lifecycle === 'CONSUMABLE' ? (item.availableQuantity || 0) : 0)
    }), { broken: 0, lost: 0, consumables: 0 });
    const staffCostNote = [
      `${staffEntries.length} lượt phân công`,
      staffAdjustmentSummary.bonus > 0 ? `thưởng ${formatCurrency(staffAdjustmentSummary.bonus)}` : '',
      staffAdjustmentSummary.penalty > 0 ? `đã trừ phạt ${formatCurrency(staffAdjustmentSummary.penalty)}` : '',
      staffAdjustmentSummary.unappliedPenalty > 0 ? `chưa trừ hết ${formatCurrency(staffAdjustmentSummary.unappliedPenalty)}` : ''
    ].filter(Boolean).join(', ');

    const financialRows: MoneyRow[] = [
      { label: 'Doanh thu đơn bán đã chốt', value: saleRevenue, note: `${finalizedSales.length}/${sales.length} đơn đã chốt` },
      { label: 'Hàng bán trả về kho', value: 0, note: `${returns.length} phiếu trả • ${returnedUnits} sản phẩm` },
      { label: 'Doanh thu dịch vụ theo sự kiện', value: serviceRevenue, note: `${serviceRevenueRows.length} sự kiện đã gắn báo giá/hợp đồng` },
      { label: 'Báo giá đã chấp nhận chưa gắn sự kiện', value: acceptedQuotationRevenue, note: `${acceptedQuotations.length} báo giá` },
      { label: 'Chi phí sự kiện', value: -expenseTotal, note: `${expenseRows.length} khoản chi` },
      { label: 'Chi phí nhân sự', value: -staffCost, note: staffCostNote },
      { label: 'Tạm ứng đã xác nhận', value: -confirmedAdvance, note: `${advances.length} đề nghị tạm ứng` }
    ];

    return {
      period,
      periodLabel,
      venueFilter,
      venueLabel,
      eventStatusById,
      monthlyEvents,
      studentTotal,
      sales,
      finalizedSales,
      returns,
      saleRevenue,
      returnedUnits,
      netSaleRevenue,
      serviceRevenueRows,
      serviceRevenue,
      serviceRevenueByEvent,
      acceptedQuotations,
      acceptedQuotationRevenue,
      quotedRevenue,
      recognizedRevenue,
      expenseRows,
      expenseTotal,
      expenseChart,
      staffEntries,
      staffRows,
      staffCost,
      staffAdjustmentSummary,
      confirmedAdvance,
      advances,
      consumableRows,
      consumableCarriedSummary,
      consumableSummary,
      equipmentUsageSummary,
      damageRows,
      receipts,
      receiptUnits,
      vatInvoiceRows,
      missingInvoiceExpenses,
      eventStatusRows,
      monthlyInventorySnapshot,
      financialRows
    };
  }, [appState, startMonth, endMonth, venueFilter]);

  const totalDamaged = report.damageRows.reduce((sum, row) => sum + row.damaged, 0);
  const totalLost = report.damageRows.reduce((sum, row) => sum + row.lost, 0);
  const consumableTotal = report.consumableSummary.reduce((sum, row) => sum + row.quantity, 0);
  const netAfterOperatingCost = report.recognizedRevenue - report.expenseTotal - report.staffCost;

  const chartData = [
    { name: 'Doanh thu', value: report.recognizedRevenue, fill: '#16a34a' },
    { name: 'Chi phí', value: report.expenseTotal, fill: '#dc2626' },
    { name: 'Nhân sự', value: report.staffCost, fill: '#2563eb' },
    { name: 'Tạm ứng', value: report.confirmedAdvance, fill: '#f59e0b' }
  ].filter(item => item.value > 0);

  const exportReportCsv = () => {
    const rows: unknown[][] = [
      ['Báo cáo giai đoạn', report.periodLabel],
      ['Phạm vi', report.venueLabel],
      [],
      ['Tổng quan'],
      ['Chỉ số', 'Giá trị', 'Ghi chú'],
      ['Số sự kiện', report.monthlyEvents.length, ''],
      ['Số lượng học sinh tiếp đón', report.studentTotal, 'Lấy từ số học sinh sự kiện/vận hành hoặc quy mô dự kiến trong hồ sơ'],
      ['Doanh thu ghi nhận', report.recognizedRevenue, 'Đơn bán đã chốt + dịch vụ từ sự kiện đã gắn báo giá/hợp đồng + báo giá đã chấp nhận chưa gắn sự kiện'],
      ['Chi phí sự kiện', report.expenseTotal, ''],
      ['Chi phí nhân sự', report.staffCost, ''],
      ['Lãi/lỗ vận hành tạm tính', netAfterOperatingCost, 'Chưa bao gồm giá vốn nếu chưa nhập trong hệ thống'],
      ['Hàng hư hỏng', totalDamaged, ''],
      ['Hàng mất', totalLost, ''],
      ['Hàng tiêu hao', consumableTotal, ''],
      [],
      ['Chi tiết tài chính'],
      ['Hạng mục', 'Giá trị', 'Ghi chú'],
      ...report.financialRows.map(row => [row.label, row.value, row.note || '']),
      [],
      ['Doanh thu dịch vụ theo sự kiện'],
      ['Sự kiện', 'Ngày', 'Báo giá/Hợp đồng', 'Nguồn', 'Số tiền'],
      ...report.serviceRevenueRows.map(row => [row.eventName, row.eventDate, row.quotationId, row.source, row.amount]),
      [],
      ['Sự kiện trong giai đoạn'],
      ['Tên sự kiện', 'Khách hàng', 'Địa điểm', 'Ngày bắt đầu', 'Ngày kết thúc', 'Trạng thái', 'Học sinh tiếp đón', 'Doanh thu dịch vụ', 'Chi phí', 'Nhân sự'],
      ...report.monthlyEvents.map(event => [
        event.name,
        event.client,
        event.location,
        event.startDate,
        event.endDate,
        STATUS_LABELS[report.eventStatusById.get(event.id) || event.status],
        getEventStudentCount(event),
        report.serviceRevenueByEvent.get(event.id) || 0,
        (event.expenses || []).reduce((sum, expense) => sum + (expense.amount || 0), 0),
        event.staff?.length || 0
      ]),
      [],
      ['Chi phí'],
      ['Sự kiện', 'Nhóm chi phí', 'Mô tả', 'Số tiền', 'Có hóa đơn'],
      ...report.expenseRows.map(expense => [
        expense.eventName,
        EXPENSE_LABELS[expense.category],
        expense.description,
        expense.amount,
        expense.vatInvoiceLink ? 'Có' : 'Chưa có'
      ]),
      [],
      ['Nhân sự'],
      ['Nhân sự', 'Vai trò', 'Số lượt', 'Lương gốc', 'Thưởng', 'Phạt đã trừ', 'Lương thực tính', 'Sự kiện'],
      ...report.staffRows.map(row => [row.employeeName, row.role, row.shifts, row.grossSalary, row.bonusAmount, row.penaltyAmount, row.salary, row.events.join('; ')]),
      [],
      ['Hàng hư hỏng/mất'],
      ['Mã hàng', 'Tên hàng', 'Danh mục', 'Hư hỏng', 'Mất', 'Nguồn ghi nhận'],
      ...report.damageRows.map(row => [row.itemId, row.name, row.category, row.damaged, row.lost, row.sources.join('; ')]),
      [],
      ['Hàng tiêu hao'],
      ['Mã hàng', 'Tên hàng', 'Danh mục', 'Tiêu hao thực tế', 'Lượt mang theo', 'Đơn vị', 'Nguồn ghi nhận'],
      ...report.consumableSummary.map(row => [row.itemId, row.name, row.category, row.quantity, row.carriedQuantity, row.unit, row.events.join('; ')]),
      [],
      ['Mức độ sử dụng thiết bị'],
      ['Mã hàng', 'Tên hàng', 'Danh mục', 'Lượt dùng trong kỳ', 'Số sự kiện', 'Tổng lượt tích lũy', 'Ngưỡng khấu hao mỗi đơn vị'],
      ...report.equipmentUsageSummary.map(row => [row.itemId, row.name, row.category, row.quantity, row.events.length, row.totalUsage, row.maxUsage || '']),
      [],
      ['Phiếu nhập/hóa đơn kho'],
      ['Mã phiếu', 'Ngày tạo', 'Nguồn', 'Số dòng', 'Số lượng', 'Ghi chú'],
      ...report.receipts.map(receipt => [
        receipt.code,
        receipt.createdAt,
        receipt.source,
        receipt.items.length,
        receipt.items.reduce((sum, item) => sum + (item.quantity || 0), 0),
        receipt.note || ''
      ])
    ];
    downloadCsv(`bao-cao-${report.venueFilter.toLowerCase()}-${report.period.startMonth}-${report.period.endMonth}.csv`, rows);
  };

  const printReport = () => {
    const printWindow = window.open('', '_blank', 'width=1120,height=780');
    if (!printWindow) {
      alert('Trình duyệt đang chặn cửa sổ in. Vui lòng cho phép popup.');
      return;
    }
    const moneyRows = report.financialRows.map(row => `
      <tr>
        <td>${escapeHtml(row.label)}</td>
        <td style="text-align:right;">${escapeHtml(formatCurrency(row.value))}</td>
        <td>${escapeHtml(row.note || '')}</td>
      </tr>
    `).join('');
    const eventRows = report.monthlyEvents.map(event => `
      <tr>
        <td>${escapeHtml(event.name)}</td>
        <td>${escapeHtml(event.client)}</td>
        <td>${escapeHtml(event.startDate)} - ${escapeHtml(event.endDate)}</td>
        <td>${escapeHtml(STATUS_LABELS[report.eventStatusById.get(event.id) || event.status])}</td>
        <td style="text-align:right;">${escapeHtml(formatNumber(getEventStudentCount(event)))}</td>
        <td style="text-align:right;">${escapeHtml(formatCurrency(report.serviceRevenueByEvent.get(event.id) || 0))}</td>
        <td style="text-align:right;">${escapeHtml(formatCurrency((event.expenses || []).reduce((sum, expense) => sum + (expense.amount || 0), 0)))}</td>
      </tr>
    `).join('');
    const staffRows = report.staffRows.map(row => `
      <tr>
        <td>${escapeHtml(row.employeeName)}</td>
        <td>${escapeHtml(row.role)}</td>
        <td style="text-align:right;">${escapeHtml(row.shifts)}</td>
        <td style="text-align:right;">${escapeHtml(formatCurrency(row.grossSalary))}</td>
        <td style="text-align:right;">${escapeHtml(formatCurrency(row.bonusAmount))}</td>
        <td style="text-align:right;">${escapeHtml(formatCurrency(row.penaltyAmount))}</td>
        <td style="text-align:right;">${escapeHtml(formatCurrency(row.salary))}</td>
      </tr>
    `).join('');
    const damageRows = report.damageRows.map(row => `
      <tr>
        <td>${escapeHtml(row.name)}</td>
        <td style="text-align:right;">${escapeHtml(row.damaged)}</td>
        <td style="text-align:right;">${escapeHtml(row.lost)}</td>
        <td>${escapeHtml(row.sources.join('; '))}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Báo cáo ${escapeHtml(report.periodLabel)}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; }
            h1 { margin: 0 0 4px; font-size: 24px; }
            h2 { margin: 24px 0 8px; font-size: 16px; }
            .meta { color: #64748b; font-size: 12px; margin-bottom: 18px; }
            .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 16px 0; }
            .box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; }
            .label { color: #64748b; font-size: 11px; }
            .value { font-weight: 800; font-size: 16px; margin-top: 3px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 7px; text-align: left; vertical-align: top; }
            th { background: #f8fafc; }
          </style>
        </head>
        <body>
          <h1>Báo cáo tổng hợp ${escapeHtml(report.periodLabel)}</h1>
          <div class="meta">Phạm vi: ${escapeHtml(report.venueLabel)} • In lúc ${escapeHtml(new Date().toLocaleString('vi-VN'))}</div>
          <div class="grid">
            <div class="box"><div class="label">Sự kiện</div><div class="value">${escapeHtml(report.monthlyEvents.length)}</div></div>
            <div class="box"><div class="label">Học sinh tiếp đón</div><div class="value">${escapeHtml(formatNumber(report.studentTotal))}</div></div>
            <div class="box"><div class="label">Doanh thu ghi nhận</div><div class="value">${escapeHtml(formatCurrency(report.recognizedRevenue))}</div></div>
            <div class="box"><div class="label">Chi phí + nhân sự</div><div class="value">${escapeHtml(formatCurrency(report.expenseTotal + report.staffCost))}</div></div>
            <div class="box"><div class="label">Tạm tính còn lại</div><div class="value">${escapeHtml(formatCurrency(netAfterOperatingCost))}</div></div>
          </div>
          <h2>Tài chính</h2>
          <table><thead><tr><th>Hạng mục</th><th>Giá trị</th><th>Ghi chú</th></tr></thead><tbody>${moneyRows}</tbody></table>
          <h2>Sự kiện</h2>
          <table><thead><tr><th>Tên</th><th>Khách hàng</th><th>Thời gian</th><th>Trạng thái</th><th>Học sinh</th><th>Doanh thu dịch vụ</th><th>Chi phí</th></tr></thead><tbody>${eventRows || '<tr><td colspan="7">Không có dữ liệu.</td></tr>'}</tbody></table>
          <h2>Nhân sự</h2>
          <table><thead><tr><th>Nhân sự</th><th>Vai trò</th><th>Số lượt</th><th>Lương gốc</th><th>Thưởng</th><th>Phạt đã trừ</th><th>Lương thực tính</th></tr></thead><tbody>${staffRows || '<tr><td colspan="7">Không có dữ liệu.</td></tr>'}</tbody></table>
          <h2>Hư hỏng/mất mát</h2>
          <table><thead><tr><th>Hàng hóa</th><th>Hư hỏng</th><th>Mất</th><th>Nguồn</th></tr></thead><tbody>${damageRows || '<tr><td colspan="4">Không có dữ liệu.</td></tr>'}</tbody></table>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const StatCard = ({
    title,
    value,
    sub,
    icon,
    tone
  }: {
    title: string;
    value: string;
    sub: string;
    icon: React.ReactNode;
    tone: string;
  }) => (
    <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${tone}`}>
        {icon}
      </div>
      <div className="text-[12px] font-bold uppercase text-slate-400">{title}</div>
      <div className="mt-1 text-xl font-black text-slate-900 leading-tight">{value}</div>
      <div className="mt-1 text-xs text-slate-500 leading-snug">{sub}</div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase text-blue-700">
              <FileText size={16} /> Báo cáo tổng hợp
            </div>
            <h2 className="text-2xl font-black text-slate-900 mt-1">Báo cáo theo giai đoạn</h2>
            <p className="text-sm text-slate-500 mt-1">
              Tổng hợp chi phí, hóa đơn, doanh thu, nhân sự, hư hỏng, tiêu hao và số lượng sự kiện theo khoảng tháng đã chọn.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700">
                <CalendarDays size={16} />
                <span className="text-xs text-slate-500 whitespace-nowrap">Từ</span>
                <input
                  type="month"
                  value={startMonth}
                  onChange={event => setStartMonth(event.target.value || currentMonth())}
                  className="bg-transparent outline-none min-w-0"
                />
              </label>
              <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700">
                <CalendarDays size={16} />
                <span className="text-xs text-slate-500 whitespace-nowrap">Đến</span>
                <input
                  type="month"
                  value={endMonth}
                  onChange={event => setEndMonth(event.target.value || currentMonth())}
                  className="bg-transparent outline-none min-w-0"
                />
              </label>
            </div>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              {VENUE_FILTERS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setVenueFilter(option.value)}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-bold transition ${
                    venueFilter === option.value
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                const monthValue = currentMonth();
                setStartMonth(monthValue);
                setEndMonth(monthValue);
              }}
              className="inline-flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Tháng này
            </button>
            <button
              onClick={exportReportCsv}
              className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-blue-700"
            >
              <Download size={16} /> CSV
            </button>
            <button
              onClick={printReport}
              className="inline-flex items-center justify-center gap-2 bg-slate-800 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-slate-900"
            >
              <Printer size={16} /> In
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <div className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
            <CalendarDays size={14} /> {report.periodLabel}
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
            {venueFilter === 'EBUS' ? <BusFront size={14} /> : venueFilter === 'EH' ? <Building2 size={14} /> : <CalendarDays size={14} />} {report.venueLabel}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3.5">
        <StatCard
          title="Số sự kiện"
          value={formatNumber(report.monthlyEvents.length)}
          sub={`${formatNumber(report.monthlyEvents.filter(event => report.eventStatusById.get(event.id) === EventStatus.COMPLETED).length)} hoàn thành`}
          icon={<CalendarDays size={18} />}
          tone="bg-blue-50 text-blue-700"
        />
        <StatCard
          title="Số lượng học sinh tiếp đón"
          value={formatNumber(report.studentTotal)}
          sub={`Tính theo ${report.venueLabel.toLowerCase()} trong giai đoạn`}
          icon={<School size={18} />}
          tone="bg-teal-50 text-teal-700"
        />
        <StatCard
          title="Doanh thu ghi nhận"
          value={formatCurrency(report.recognizedRevenue)}
          sub={`${formatCurrency(report.netSaleRevenue)} bán hàng, ${formatCurrency(report.serviceRevenue)} dịch vụ, ${formatCurrency(report.acceptedQuotationRevenue)} báo giá lẻ`}
          icon={<TrendingUp size={18} />}
          tone="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          title="Chi phí vận hành"
          value={formatCurrency(report.expenseTotal + report.staffCost)}
          sub={`${formatCurrency(report.expenseTotal)} chi phí, ${formatCurrency(report.staffCost)} nhân sự`}
          icon={<TrendingDown size={18} />}
          tone="bg-rose-50 text-rose-700"
        />
        <StatCard
          title="Hóa đơn"
          value={formatNumber(report.receipts.length + report.vatInvoiceRows.length)}
          sub={`${formatNumber(report.missingInvoiceExpenses.length)} khoản chi chưa gắn hóa đơn VAT`}
          icon={<ReceiptText size={18} />}
          tone="bg-amber-50 text-amber-700"
        />
        <StatCard
          title="Nhân sự"
          value={formatNumber(report.staffRows.length)}
          sub={`${formatNumber(report.staffEntries.length)} lượt phân công trong giai đoạn`}
          icon={<Users size={18} />}
          tone="bg-indigo-50 text-indigo-700"
        />
        <StatCard
          title="Hàng hư hỏng/mất"
          value={`${formatNumber(totalDamaged)} / ${formatNumber(totalLost)}`}
          sub={`Tồn hiện tại: ${formatNumber(report.monthlyInventorySnapshot.broken)} hỏng, ${formatNumber(report.monthlyInventorySnapshot.lost)} mất`}
          icon={<PackageX size={18} />}
          tone="bg-red-50 text-red-700"
        />
        <StatCard
          title="Hàng tiêu hao"
          value={formatNumber(consumableTotal)}
          sub={`${formatNumber(report.consumableSummary.filter(row => row.quantity > 0).length)} mã có tiêu hao thực tế`}
          icon={<Boxes size={18} />}
          tone="bg-cyan-50 text-cyan-700"
        />
        <StatCard
          title="Tạm tính còn lại"
          value={formatCurrency(netAfterOperatingCost)}
          sub="Chưa trừ giá vốn nếu chưa được nhập riêng"
          icon={<WalletCards size={18} />}
          tone="bg-slate-100 text-slate-800"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-black uppercase text-slate-400">Dòng tiền</p>
              <h3 className="text-base font-bold text-slate-900">Doanh thu, chi phí và nhân sự</h3>
            </div>
          </div>
          <div className="h-72">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${Math.round(Number(value) / 1000000)}m`} />
                  <Tooltip formatter={(value: unknown) => formatCurrency(Number(value))} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {chartData.map(item => <Cell key={item.name} fill={item.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">Chưa có dữ liệu tài chính trong giai đoạn.</div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-black uppercase text-slate-400">Sự kiện</p>
              <h3 className="text-base font-bold text-slate-900">Trạng thái trong giai đoạn</h3>
            </div>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={report.eventStatusRows} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={4} dataKey="value">
                  {report.eventStatusRows.map(row => <Cell key={row.name} fill={row.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {report.eventStatusRows.map(row => (
              <div key={row.name} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                  {row.name}
                </span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-black uppercase text-slate-400">Tài chính</p>
              <h3 className="text-base font-bold text-slate-900">Tổng hợp thu chi</h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400 border-b">
                  <th className="py-2 pr-3">Hạng mục</th>
                  <th className="py-2 px-3 text-right">Giá trị</th>
                  <th className="py-2 pl-3">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {report.financialRows.map(row => (
                  <tr key={row.label} className="border-b border-slate-50">
                    <td className="py-2 pr-3 font-semibold text-slate-700">{row.label}</td>
                    <td className={`py-2 px-3 text-right font-black ${row.value < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatCurrency(row.value)}</td>
                    <td className="py-2 pl-3 text-slate-500">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-black uppercase text-slate-400">Chi phí</p>
              <h3 className="text-base font-bold text-slate-900">Theo nhóm chi</h3>
            </div>
          </div>
          <div className="h-64">
            {report.expenseChart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.expenseChart} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" tickFormatter={(value) => `${Math.round(Number(value) / 1000000)}m`} />
                  <YAxis type="category" dataKey="name" width={110} fontSize={12} />
                  <Tooltip formatter={(value: unknown) => formatCurrency(Number(value))} />
                  <Bar dataKey="value" fill="#dc2626" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">Chưa có khoản chi trong giai đoạn.</div>
            )}
          </div>
        </section>

        <section className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-black uppercase text-slate-400">Khấu hao</p>
              <h3 className="text-base font-bold text-slate-900">Thiết bị được dùng nhiều</h3>
            </div>
            <TrendingUp size={16} className="text-blue-700" />
          </div>
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-xs uppercase text-slate-400 border-b">
                  <th className="py-2 pr-3">Thiết bị</th>
                  <th className="py-2 px-3 text-right">Trong kỳ</th>
                  <th className="py-2 px-3 text-right">Sự kiện</th>
                  <th className="py-2 pl-3 text-right">Tích lũy</th>
                </tr>
              </thead>
              <tbody>
                {report.equipmentUsageSummary.length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-center text-slate-400">Chưa có lượt sử dụng được chốt trong giai đoạn.</td></tr>
                )}
                {report.equipmentUsageSummary.slice(0, 20).map(row => {
                  const usageCapacity = row.maxUsage ? row.maxUsage * Math.max(1, row.totalQuantity) : null;
                  return (
                    <tr key={row.itemId} className="border-b border-slate-50">
                      <td className="py-2 pr-3">
                        <div className="font-semibold text-slate-800">{row.name}</div>
                        <div className="text-xs text-slate-500">{row.category}</div>
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-blue-700">{formatNumber(row.quantity)}</td>
                      <td className="py-2 px-3 text-right font-bold">{formatNumber(row.events.length)}</td>
                      <td className="py-2 pl-3 text-right text-xs font-bold text-slate-700">
                        {formatNumber(row.totalUsage)}{usageCapacity ? ` / ${formatNumber(usageCapacity)}` : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-black uppercase text-slate-400">Sự kiện</p>
              <h3 className="text-base font-bold text-slate-900">Danh sách trong giai đoạn</h3>
            </div>
            <span className="text-xs font-bold text-slate-500">{formatNumber(report.monthlyEvents.length)} sự kiện</span>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-xs uppercase text-slate-400 border-b">
                  <th className="py-2 pr-3">Sự kiện</th>
                  <th className="py-2 px-3">Thời gian</th>
                  <th className="py-2 px-3">Trạng thái</th>
                  <th className="py-2 px-3 text-right">Học sinh</th>
                  <th className="py-2 px-3 text-right">Doanh thu dịch vụ</th>
                  <th className="py-2 pl-3 text-right">Chi phí</th>
                </tr>
              </thead>
              <tbody>
                {report.monthlyEvents.length === 0 && (
                  <tr><td colSpan={6} className="py-6 text-center text-slate-400">Không có sự kiện trong giai đoạn.</td></tr>
                )}
                {report.monthlyEvents.map(event => (
                  <tr key={event.id} className="border-b border-slate-50">
                    <td className="py-2 pr-3">
                      <div className="font-semibold text-slate-800">{event.name}</div>
                      <div className="text-xs text-slate-500">{event.client} - {event.location}</div>
                    </td>
                    <td className="py-2 px-3 text-slate-600">{event.startDate} - {event.endDate}</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-1 rounded-full bg-slate-100 text-xs font-bold text-slate-700">{STATUS_LABELS[report.eventStatusById.get(event.id) || event.status]}</span>
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-teal-700">{formatNumber(getEventStudentCount(event))}</td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-700">{formatCurrency(report.serviceRevenueByEvent.get(event.id) || 0)}</td>
                    <td className="py-2 pl-3 text-right font-bold">{formatCurrency((event.expenses || []).reduce((sum, expense) => sum + (expense.amount || 0), 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-black uppercase text-slate-400">Nhân sự</p>
              <h3 className="text-base font-bold text-slate-900">Lương thực tính theo phân công</h3>
            </div>
            <span className="text-xs font-bold text-slate-500">{formatCurrency(report.staffCost)}</span>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-xs uppercase text-slate-400 border-b">
                  <th className="py-2 pr-3">Nhân sự</th>
                  <th className="py-2 px-3 text-right">Lượt</th>
                  <th className="py-2 px-3 text-right">Lương gốc</th>
                  <th className="py-2 px-3 text-right">Thưởng</th>
                  <th className="py-2 px-3 text-right">Phạt</th>
                  <th className="py-2 px-3 text-right">Thực tính</th>
                  <th className="py-2 pl-3">Sự kiện</th>
                </tr>
              </thead>
              <tbody>
                {report.staffRows.length === 0 && (
                  <tr><td colSpan={7} className="py-6 text-center text-slate-400">Chưa có phân công nhân sự.</td></tr>
                )}
                {report.staffRows.map(row => (
                  <tr key={row.employeeId} className="border-b border-slate-50">
                    <td className="py-2 pr-3">
                      <div className="font-semibold text-slate-800">{row.employeeName}</div>
                      <div className="text-xs text-slate-500">{row.role || 'Chưa có vai trò'}</div>
                    </td>
                    <td className="py-2 px-3 text-right">{formatNumber(row.shifts)}</td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-700">{formatCurrency(row.grossSalary)}</td>
                    <td className="py-2 px-3 text-right font-semibold text-emerald-700">{formatCurrency(row.bonusAmount)}</td>
                    <td className="py-2 px-3 text-right font-semibold text-rose-700">
                      <div>{formatCurrency(row.penaltyAmount)}</div>
                      {row.unappliedPenalty > 0 && <div className="text-[11px] text-rose-500">Chưa trừ hết {formatCurrency(row.unappliedPenalty)}</div>}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-blue-700">{formatCurrency(row.salary)}</td>
                    <td className="py-2 pl-3 text-xs text-slate-500">{row.events.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-black uppercase text-slate-400">Kho</p>
              <h3 className="text-base font-bold text-slate-900">Hàng hư hỏng và mất mát</h3>
            </div>
            <AlertTriangle size={16} className="text-rose-600" />
          </div>
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-xs uppercase text-slate-400 border-b">
                  <th className="py-2 pr-3">Hàng hóa</th>
                  <th className="py-2 px-3 text-right">Hư</th>
                  <th className="py-2 px-3 text-right">Mất</th>
                  <th className="py-2 pl-3">Nguồn</th>
                </tr>
              </thead>
              <tbody>
                {report.damageRows.length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-center text-slate-400">Không có ghi nhận hư hỏng/mất mát trong giai đoạn.</td></tr>
                )}
                {report.damageRows.map(row => (
                  <tr key={row.itemId} className="border-b border-slate-50">
                    <td className="py-2 pr-3">
                      <div className="font-semibold text-slate-800">{row.name}</div>
                      <div className="text-xs text-slate-500">{row.category}</div>
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-rose-700">{formatNumber(row.damaged)}</td>
                    <td className="py-2 px-3 text-right font-bold text-slate-700">{formatNumber(row.lost)}</td>
                    <td className="py-2 pl-3 text-xs text-slate-500">{row.sources.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-black uppercase text-slate-400">Kho</p>
              <h3 className="text-base font-bold text-slate-900">Tiêu hao thực tế và lượt mang theo</h3>
            </div>
            <Boxes size={16} className="text-cyan-700" />
          </div>
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-xs uppercase text-slate-400 border-b">
                  <th className="py-2 pr-3">Hàng hóa</th>
                  <th className="py-2 px-3 text-right">Thực tế</th>
                  <th className="py-2 px-3 text-right">Mang theo</th>
                  <th className="py-2 pl-3">Nguồn ghi nhận</th>
                </tr>
              </thead>
              <tbody>
                {report.consumableSummary.length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-center text-slate-400">Không có hàng tiêu hao trong giai đoạn.</td></tr>
                )}
                {report.consumableSummary.map(row => (
                  <tr key={row.itemId} className="border-b border-slate-50">
                    <td className="py-2 pr-3">
                      <div className="font-semibold text-slate-800">{row.name}</div>
                      <div className="text-xs text-slate-500">{row.category}</div>
                    </td>
                    <td className="py-2 px-3 text-right font-bold">{formatNumber(row.quantity)} {row.unit}</td>
                    <td className="py-2 px-3 text-right font-bold text-blue-700">{formatNumber(row.carriedQuantity)} {row.unit}</td>
                    <td className="py-2 pl-3 text-xs text-slate-500">{row.events.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-black uppercase text-slate-400">Hóa đơn và chứng từ</p>
            <h3 className="text-base font-bold text-slate-900">Phiếu nhập kho và hóa đơn chi phí</h3>
          </div>
          <span className="text-xs font-bold text-slate-500">{formatNumber(report.receiptUnits)} sản phẩm nhập</span>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400 border-b">
                  <th className="py-2 pr-3">Phiếu nhập</th>
                  <th className="py-2 px-3">Nguồn</th>
                  <th className="py-2 pl-3 text-right">Số lượng</th>
                </tr>
              </thead>
              <tbody>
                {report.receipts.length === 0 && (
                  <tr><td colSpan={3} className="py-6 text-center text-slate-400">Không có phiếu nhập trong giai đoạn.</td></tr>
                )}
                {report.receipts.map(receipt => (
                  <tr key={receipt.id} className="border-b border-slate-50">
                    <td className="py-2 pr-3">
                      <div className="font-semibold text-slate-800">{receipt.code}</div>
                      <div className="text-xs text-slate-500">{receipt.createdAt}</div>
                    </td>
                    <td className="py-2 px-3 text-slate-600">{receipt.source}</td>
                    <td className="py-2 pl-3 text-right font-bold">{formatNumber(receipt.items.reduce((sum, item) => sum + (item.quantity || 0), 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400 border-b">
                  <th className="py-2 pr-3">Khoản chi</th>
                  <th className="py-2 px-3 text-right">Số tiền</th>
                  <th className="py-2 pl-3">Hóa đơn</th>
                </tr>
              </thead>
              <tbody>
                {report.expenseRows.length === 0 && (
                  <tr><td colSpan={3} className="py-6 text-center text-slate-400">Không có khoản chi trong giai đoạn.</td></tr>
                )}
                {report.expenseRows.map(expense => (
                  <tr key={expense.id} className="border-b border-slate-50">
                    <td className="py-2 pr-3">
                      <div className="font-semibold text-slate-800">{expense.description}</div>
                      <div className="text-xs text-slate-500">{expense.eventName} - {EXPENSE_LABELS[expense.category]}</div>
                    </td>
                    <td className="py-2 px-3 text-right font-bold">{formatCurrency(expense.amount)}</td>
                    <td className="py-2 pl-3">
                      {expense.vatInvoiceLink ? (
                        <a href={expense.vatInvoiceLink} target="_blank" rel="noreferrer" className="text-blue-700 text-xs font-bold hover:underline">
                          Mở hóa đơn
                        </a>
                      ) : (
                        <span className="text-xs text-amber-700 font-bold">Chưa gắn</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};
