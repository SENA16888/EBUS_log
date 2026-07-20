import { Event, EventStaffAllocation } from '../types';

export type StaffSession = NonNullable<Event['session']>;

export const STAFF_HOURLY_RATE = 30000;
export const STAFF_DAILY_CAP = 310000;

const STAFF_WATER_ALLOWANCE_HALF_DAY = 10000;
const STAFF_WATER_ALLOWANCE_FULL_DAY = 20000;
const STAFF_MEAL_ALLOWANCE_FULL_DAY = 50000;
const STAFF_SESSION_HOURS: Record<StaffSession, number> = {
  MORNING: 4,
  AFTERNOON: 4,
  EVENING: 4
};

export type StaffCostGroupItem = {
  allocation: EventStaffAllocation;
  index: number;
  key: string;
  hours: number;
};

export type StaffCostGroup = {
  key: string;
  employeeId: string;
  shiftDate?: string;
  items: StaffCostGroupItem[];
  sessions: StaffSession[];
  stationNames: string[];
  totalHours: number;
  totalSalary: number;
  isDayPolicyGroup: boolean;
};

export const getStaffSessions = (
  staff?: Pick<EventStaffAllocation, 'session' | 'sessions'>
): StaffSession[] => {
  if (!staff) return [];
  if (staff.sessions && staff.sessions.length > 0) return staff.sessions as StaffSession[];
  return staff.session ? [staff.session as StaffSession] : [];
};

export const getStaffWorkHours = (sessions: StaffSession[]) =>
  Math.min(8, Math.max(1, sessions.reduce((sum, session) => sum + (STAFF_SESSION_HOURS[session] || 4), 0)));

export const calculateStaffCompensation = (hours: number, rate = STAFF_HOURLY_RATE) => {
  const normalizedHours = Math.max(0, Number(hours) || 0);
  const base = normalizedHours * rate;
  const allowance = normalizedHours >= 8
    ? STAFF_MEAL_ALLOWANCE_FULL_DAY + STAFF_WATER_ALLOWANCE_FULL_DAY
    : normalizedHours >= 4
      ? STAFF_WATER_ALLOWANCE_HALF_DAY
      : 0;
  const total = Math.min(STAFF_DAILY_CAP, base + allowance);
  return { base, allowance, total };
};

export const getStaffCompensationNote = (hours: number, rate = STAFF_HOURLY_RATE) => {
  const { allowance, total } = calculateStaffCompensation(hours, rate);
  const allowanceText = hours >= 8
    ? 'ăn 50.000đ + nước 20.000đ'
    : hours >= 4
      ? 'nước 10.000đ'
      : 'chưa có phụ cấp';
  return `${hours}h x ${rate.toLocaleString('vi-VN')}đ/h + ${allowanceText}${total >= STAFF_DAILY_CAP ? ' • chạm trần 310.000đ/ngày' : allowance > 0 ? '' : ''}`;
};

const getStaffAllocationKey = (staff: EventStaffAllocation, index?: number) =>
  staff.id || staff.autoKey || `${staff.employeeId}-${staff.shiftDate || 'no-date'}-${getStaffSessions(staff).join('-') || staff.session || 'no-session'}-${index ?? 0}`;

const getStaffAllocationHours = (staff: EventStaffAllocation) => {
  if (staff.unit !== 'HOUR') return 0;
  const quantity = Number(staff.quantity) || 0;
  return quantity > 0 ? quantity : getStaffWorkHours(getStaffSessions(staff));
};

const calculateStaffDayGroupCompensation = (items: StaffCostGroupItem[]) => {
  const totalHours = items.reduce((sum, item) => sum + item.hours, 0);
  const base = items.reduce((sum, item) => {
    const rate = Number(item.allocation.rate) || STAFF_HOURLY_RATE;
    return sum + item.hours * rate;
  }, 0);
  const allowance = totalHours >= 8
    ? STAFF_MEAL_ALLOWANCE_FULL_DAY + STAFF_WATER_ALLOWANCE_FULL_DAY
    : totalHours >= 4
      ? STAFF_WATER_ALLOWANCE_HALF_DAY
      : 0;
  return {
    totalHours,
    total: Math.min(STAFF_DAILY_CAP, base + allowance)
  };
};

export const getStaffCostGroups = (staffList: EventStaffAllocation[] = []): StaffCostGroup[] => {
  const groups = new Map<string, StaffCostGroup>();
  staffList.forEach((allocation, index) => {
    const key = allocation.unit === 'HOUR' && allocation.shiftDate
      ? `day-${allocation.employeeId}-${allocation.shiftDate}`
      : `single-${getStaffAllocationKey(allocation, index)}`;
    const item: StaffCostGroupItem = {
      allocation,
      index,
      key: getStaffAllocationKey(allocation, index),
      hours: getStaffAllocationHours(allocation)
    };
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
      return;
    }
    groups.set(key, {
      key,
      employeeId: allocation.employeeId,
      shiftDate: allocation.shiftDate,
      items: [item],
      sessions: [],
      stationNames: [],
      totalHours: 0,
      totalSalary: 0,
      isDayPolicyGroup: false
    });
  });

  return Array.from(groups.values()).map(group => {
    const sessions = new Set<StaffSession>();
    const stationNames = new Set<string>();
    group.items.forEach(item => {
      getStaffSessions(item.allocation).forEach(session => sessions.add(session));
      if (item.allocation.stationName) stationNames.add(item.allocation.stationName);
    });
    const allHourly = group.items.every(item => item.allocation.unit === 'HOUR');
    const groupedPay = allHourly
      ? calculateStaffDayGroupCompensation(group.items)
      : {
          totalHours: group.items.reduce((sum, item) => sum + (Number(item.allocation.quantity) || 0), 0),
          total: group.items.reduce((sum, item) => sum + (Number(item.allocation.salary) || 0), 0)
        };
    return {
      ...group,
      sessions: Array.from(sessions),
      stationNames: Array.from(stationNames),
      totalHours: groupedPay.totalHours,
      totalSalary: groupedPay.total,
      isDayPolicyGroup: allHourly && group.shiftDate !== undefined && groupedPay.totalHours >= 8
    };
  });
};

export const calculateGroupedStaffCosts = (staffList: EventStaffAllocation[] = []) =>
  getStaffCostGroups(staffList).reduce((sum, group) => sum + group.totalSalary, 0);
