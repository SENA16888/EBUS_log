
import React, { useEffect, useMemo, useState } from 'react';
import { Event, InventoryItem, EventStatus, ComboPackage, Employee, EventExpense, EventAdvanceRequest, EventStaffAllocation, Quotation, EventLayout, EventLayoutBlock, LayoutPackageSource, ChecklistDirection, ChecklistStatus, ChecklistSignature, EventTimelineEntry, EventTimelinePhase, EventProfile, EventVenueType, EducationActivity, LearningTrack, EventContentProgram } from '../types';
import {
  Calendar, MapPin, Box, ArrowLeft, Plus, Minus, X, Layers, Building2,
  Users, DollarSign, Trash2, Truck, BookOpen, 
  Utensils, Wallet, Printer, Coffee, AlertCircle,
  TrendingUp, ArrowRightLeft, UserCheck, Link as LinkIcon, Clock3,
  Calculator, ChevronRight, ChevronLeft, PieChart as PieIcon, FileText, CheckCircle, RefreshCw, Upload, Download, ScanBarcode,
  Radio, Wand2, TimerReset, ClipboardCheck, Library, PlayCircle, BarChart3, Pencil
} from 'lucide-react';
import { EventExportModal } from './EventExportModal';
import { EventChecklist } from './EventChecklist';
import { EinsteinHouseOS, EinsteinHouseModuleTab } from './EinsteinHouseOS';
import { calcLineTotal } from '../services/pricing';

interface EventManagerProps {
  events: Event[];
  inventory: InventoryItem[];
  packages?: ComboPackage[];
  employees?: Employee[];
  quotations?: Quotation[];
  saleOrders?: any[];
  educationActivities?: EducationActivity[];
  learningTracks?: LearningTrack[];
  currentUserId?: string;
  currentUserName?: string;
  currentEmployeeId?: string;
  canEdit?: boolean;
  isAdmin?: boolean;
  onExportToEvent: (eventId: string, itemId: string, qty: number) => void;
  onExportPackageToEvent?: (eventId: string, packageId: string, qty: number) => void;
  onSyncQuotation?: (eventId: string, quotationId: string) => void;
  onRemoveEventItems?: (eventId: string, itemIds: string[]) => void;
  onReturnFromEvent: (eventId: string, itemId: string, qty: number) => void;
  onUpdateEventItemQuantity?: (eventId: string, itemId: string, qty: number) => void;
  onToggleItemDone?: (eventId: string, itemId: string, done: boolean) => void;
  onCreateEvent: (newEvent: Event) => void;
  onDeleteEvent?: (eventId: string) => void;
  onAssignStaff?: (eventId: string, staffData: EventStaffAllocation) => void;
  onRemoveStaff?: (eventId: string, employeeId: string, staffKey?: string) => void;
  onToggleStaffDone?: (eventId: string, employeeId: string, done: boolean, staffKey?: string) => void;
  onAddExpense?: (eventId: string, expense: EventExpense) => void;
  onRemoveExpense?: (eventId: string, expenseId: string) => void;
  onAddAdvanceRequest?: (eventId: string, request: EventAdvanceRequest) => void;
  onRemoveAdvanceRequest?: (eventId: string, requestId: string) => void;
  onLinkQuotation?: (eventId: string, quotationId: string) => void;
  onFinalizeOrder?: (eventId: string) => void;
  onUpdateEvent?: (eventId: string, updates: Partial<Event>) => void;
  onRegisterStaff?: (eventId: string, action: 'REGISTER' | 'CANCEL') => void;
  onLinkSaleOrder?: (eventId: string, saleOrderId: string, link: boolean) => void;
  onChecklistScan?: (payload: { eventId: string; barcode: string; direction: ChecklistDirection; status?: ChecklistStatus; quantity?: number; note?: string }) => void;
  onUpdateChecklistNote?: (eventId: string, itemId: string, note: string) => void;
  onSaveChecklistSignature?: (eventId: string, payload: { direction: ChecklistDirection; manager?: ChecklistSignature; operator?: ChecklistSignature; note?: string; itemsSnapshot?: { itemId: string; name?: string; orderQty: number; scannedOut: number; scannedIn: number; damaged: number; lost: number; missing: number; }[]; createSlip?: boolean }) => void;
}

const PROCESS_STEPS_TEMPLATE = [
  {
    id: 'ORDER' as const,
    title: 'Chốt đơn',
    checklist: ['Lead', 'Đã liên hệ', 'Đã gửi proposal', 'Đàm phán', 'Đặt cọc', 'Chốt lịch']
  },
  {
    id: 'PLAN' as const,
    title: 'Lên kế hoạch',
    checklist: ['Nhận bàn giao', 'Lấy thông tin mặt bằng', 'Sơ đồ trạm', 'Timeline ngày diễn ra', 'Chốt số lượng', 'Gán người theo trạm', 'Ca làm']
  },
  {
    id: 'PACK' as const,
    title: 'Đóng gói',
    checklist: ['Lập danh mục', 'Chuẩn bị', 'Kiểm tra hoạt động', 'Đóng gói', 'Giao hàng']
  },
  {
    id: 'EXECUTE' as const,
    title: 'Tổ chức sự kiện',
    checklist: ['Xe đến', 'Setup trạm', 'Test', 'Đón đoàn', 'Chạy ca', 'Tổng kết', 'Thu dọn']
  },
  {
    id: 'CLOSE' as const,
    title: 'Hoàn tất sự kiện',
    checklist: ['Gửi ảnh', 'Báo cáo']
  }
];

type EventSession = NonNullable<Event['session']>;
type EventScheduleItem = { date: string; sessions: EventSession[] };
type EventDetailSection = 'PREP_LOGISTICS' | 'PROGRAM_CONTENT';
type EventDetailTab = 'EQUIPMENT' | 'STAFF' | 'PROFILE' | 'COSTS' | 'LAYOUT' | 'CHECKLIST' | 'TIMELINE' | `EH_${EinsteinHouseModuleTab}`;
type DetailIcon = React.ComponentType<{ size?: number; className?: string }>;
type ContentProgramView = {
  id: string;
  name: string;
  description?: string;
  date?: string;
  sessions?: EventSession[];
  layout?: EventLayout;
  houseOperation?: Event['houseOperation'];
  isPrimary: boolean;
};

const PRIMARY_CONTENT_PROGRAM_ID = 'primary-content-program';

const DETAIL_SECTIONS: { key: EventDetailSection; label: string; description: string; Icon: DetailIcon }[] = [
  {
    key: 'PREP_LOGISTICS',
    label: 'Chuẩn bị/Hậu cần',
    description: 'Thiết bị, barcode, nhân sự, tạm ứng và chi phí triển khai.',
    Icon: Truck
  },
  {
    key: 'PROGRAM_CONTENT',
    label: 'Tổ chức/Nội dung',
    description: 'Hồ sơ chương trình, sơ đồ trạm và vận hành EH/EBUS trong ngày.',
    Icon: Building2
  }
];

const DETAIL_TABS: { key: EventDetailTab; section: EventDetailSection; label: string; icon: DetailIcon; requireEdit?: boolean }[] = [
  { key: 'EQUIPMENT', section: 'PREP_LOGISTICS', label: 'Order Thiết Bị', icon: Box },
  { key: 'CHECKLIST', section: 'PREP_LOGISTICS', label: 'Checklist Barcode', icon: ScanBarcode },
  { key: 'TIMELINE', section: 'PREP_LOGISTICS', label: 'Timeline hậu cần', icon: Clock3 },
  { key: 'STAFF', section: 'PREP_LOGISTICS', label: 'Nhân Sự', icon: Users, requireEdit: true },
  { key: 'COSTS', section: 'PREP_LOGISTICS', label: 'Chi Phí & Lợi Nhuận', icon: DollarSign, requireEdit: true },
  { key: 'PROFILE', section: 'PROGRAM_CONTENT', label: 'Hồ sơ sự kiện', icon: BookOpen },
  { key: 'LAYOUT', section: 'PROGRAM_CONTENT', label: 'Sơ đồ trạm', icon: MapPin },
  { key: 'EH_CONTROL', section: 'PROGRAM_CONTENT', label: 'CONTROL', icon: Radio },
  { key: 'EH_DESIGN', section: 'PROGRAM_CONTENT', label: 'DESIGN', icon: Wand2 },
  { key: 'EH_AGENDA', section: 'PROGRAM_CONTENT', label: 'AGENDA', icon: TimerReset },
  { key: 'EH_TASKS', section: 'PROGRAM_CONTENT', label: 'TASKS', icon: ClipboardCheck },
  { key: 'EH_KNOWLEDGE', section: 'PROGRAM_CONTENT', label: 'KNOWLEDGE', icon: Library },
  { key: 'EH_LIVE', section: 'PROGRAM_CONTENT', label: 'LIVE', icon: PlayCircle },
  { key: 'EH_REPORT', section: 'PROGRAM_CONTENT', label: 'REPORT', icon: BarChart3 }
];

const getHouseModuleTab = (tab: EventDetailTab): EinsteinHouseModuleTab | null =>
  tab.startsWith('EH_') ? tab.replace('EH_', '') as EinsteinHouseModuleTab : null;

const SESSION_LABELS: Record<EventSession, string> = {
  MORNING: 'SÁNG',
  AFTERNOON: 'CHIỀU',
  EVENING: 'TỐI'
};

const SESSION_OPTIONS: { value: EventSession; label: string }[] = [
  { value: 'MORNING', label: 'SÁNG' },
  { value: 'AFTERNOON', label: 'CHIỀU' },
  { value: 'EVENING', label: 'TỐI' }
];

const packageTypeLabel = (pkg?: ComboPackage) => (pkg?.packageType || 'EDUCATION') === 'EVENT_SUPPORT'
  ? 'Phụ trợ sự kiện'
  : 'Học liệu';

const packageTypeBadgeClass = (pkg?: ComboPackage) => (pkg?.packageType || 'EDUCATION') === 'EVENT_SUPPORT'
  ? 'bg-amber-50 text-amber-700 border-amber-100'
  : 'bg-emerald-50 text-emerald-700 border-emerald-100';

const TIMELINE_PHASES: { value: EventTimelinePhase; label: string; color: string; description: string }[] = [
  { value: 'BEFORE', label: 'Trước sự kiện', color: 'bg-amber-50 border-amber-100', description: 'Công tác chuẩn bị, vận chuyển, set up' },
  { value: 'DURING', label: 'Trong sự kiện', color: 'bg-emerald-50 border-emerald-100', description: 'Những mốc diễn ra trong chương trình' },
  { value: 'AFTER', label: 'Sau sự kiện', color: 'bg-slate-50 border-slate-200', description: 'Thu hồi, tổng kết, bàn giao' }
];

const EVENT_TYPE_OPTIONS: { value: EventProfile['eventType']; label: string }[] = [
  { value: 'CAMBRIDGE_DAY', label: 'Cambridge Day' },
  { value: 'SCIENCE_DAY', label: 'Ngày hội khoa học' },
  { value: 'BOOK_FAIR', label: 'Hội sách' },
  { value: 'LIBRARY', label: 'Thư viện' },
  { value: 'COMMUNITY', label: 'Cộng đồng' },
];

const SALES_SCOPE_OPTIONS: { value: NonNullable<EventProfile['salesScope']>; label: string }[] = [
  { value: 'NO_SALE', label: 'Không bán' },
  { value: 'LIGHT_ADVICE', label: 'Tư vấn nhẹ khi phụ huynh hỏi' },
  { value: 'SELLING', label: 'Có bán' },
  { value: 'CUSTOM', label: 'Khác (ghi chú)' },
];

const AUDIENCE_OPTIONS: { value: NonNullable<EventProfile['audience']>[number]; label: string }[] = [
  { value: 'MN', label: 'Mầm non' },
  { value: 'TIEU_HOC', label: 'Tiểu học' },
  { value: 'THCS', label: 'THCS' },
  { value: 'THPT', label: 'THPT' },
  { value: 'PH', label: 'Phụ huynh' },
];

const EVENT_VENUE_OPTIONS: { value: EventVenueType; label: string; description: string }[] = [
  { value: 'EH', label: 'Tại EH', description: 'Phát tại trung tâm Einstein House' },
  { value: 'EBUS', label: 'Bên ngoài EBUS', description: 'Phát cho sự kiện bên ngoài trung tâm' }
];

const getEventVenue = (event?: Pick<Event, 'organizationVenue'>): EventVenueType => event?.organizationVenue || 'EH';

const getEventVenueLabel = (venue?: EventVenueType) =>
  EVENT_VENUE_OPTIONS.find(option => option.value === (venue || 'EH'))?.label || 'Tại EH';

const getEventVenueShortLabel = (venue?: EventVenueType) => (venue || 'EH') === 'EH' ? 'EH' : 'EBUS';

const getEventVenueTone = (venue?: EventVenueType) => {
  const normalized = venue || 'EH';
  return normalized === 'EH'
    ? {
      chip: 'bg-teal-50 text-teal-700 border-teal-200',
      card: 'border-teal-200 bg-teal-50/70 hover:bg-teal-100',
      text: 'text-teal-800',
      dot: 'bg-teal-500'
    }
    : {
      chip: 'bg-blue-50 text-blue-700 border-blue-200',
      card: 'border-blue-200 bg-blue-50/70 hover:bg-blue-100',
      text: 'text-blue-800',
      dot: 'bg-blue-500'
    };
};

const AUTO_ADVANCE_SOURCE: EventAdvanceRequest['source'] = 'AUTO_PROFILE';
const AUTO_ADVANCE_PREFIX = 'profile-auto';
const AUTO_TIMELINE_SOURCE: EventTimelineEntry['source'] = 'AUTO_LOGISTICS';
const AUTO_TIMELINE_PREFIX = 'logistics-auto';
const HANOI_CENTER = { lat: 21.0278, lng: 105.8342 };

const PROVINCE_ROUTE_ESTIMATES: {
  label: string;
  keywords: string[];
  oneWayKm: number;
  vetcRoundTrip: number;
}[] = [
  { label: 'Bắc Ninh', keywords: ['bac ninh', 'tu son', 'tien du', 'que vo'], oneWayKm: 35, vetcRoundTrip: 100000 },
  { label: 'Hưng Yên', keywords: ['hung yen', 'van giang', 'ecopark'], oneWayKm: 45, vetcRoundTrip: 120000 },
  { label: 'Vĩnh Phúc', keywords: ['vinh phuc', 'vinh yen', 'tam dao', 'phuc yen', 'bac dam vac'], oneWayKm: 55, vetcRoundTrip: 120000 },
  { label: 'Bắc Giang', keywords: ['bac giang', 'viet yen', 'luc nam'], oneWayKm: 60, vetcRoundTrip: 150000 },
  { label: 'Hải Dương', keywords: ['hai duong', 'chi linh'], oneWayKm: 65, vetcRoundTrip: 180000 },
  { label: 'Hòa Bình', keywords: ['hoa binh', 'luong son', 'mai chau'], oneWayKm: 75, vetcRoundTrip: 150000 },
  { label: 'Thái Nguyên', keywords: ['thai nguyen', 'song cong', 'pho yen', 'bac kan', 'bac can'], oneWayKm: 80, vetcRoundTrip: 180000 },
  { label: 'Hà Nam', keywords: ['ha nam', 'phu ly'], oneWayKm: 65, vetcRoundTrip: 150000 },
  { label: 'Phú Thọ', keywords: ['phu tho', 'viet tri', 'doan hung'], oneWayKm: 90, vetcRoundTrip: 180000 },
  { label: 'Nam Định', keywords: ['nam dinh'], oneWayKm: 90, vetcRoundTrip: 200000 },
  { label: 'Ninh Bình', keywords: ['ninh binh', 'tam diep'], oneWayKm: 95, vetcRoundTrip: 220000 },
  { label: 'Thái Bình', keywords: ['thai binh'], oneWayKm: 110, vetcRoundTrip: 240000 },
  { label: 'Hải Phòng', keywords: ['hai phong', 'cat ba', 'do son'], oneWayKm: 120, vetcRoundTrip: 320000 },
  { label: 'Tuyên Quang', keywords: ['tuyen quang', 'ha giang'], oneWayKm: 150, vetcRoundTrip: 240000 },
  { label: 'Lạng Sơn', keywords: ['lang son', 'dong dang'], oneWayKm: 155, vetcRoundTrip: 300000 },
  { label: 'Thanh Hóa', keywords: ['thanh hoa', 'sam son'], oneWayKm: 160, vetcRoundTrip: 300000 },
  { label: 'Quảng Ninh', keywords: ['quang ninh', 'ha long', 'cam pha', 'mong cai', 'uông bi', 'uong bi'], oneWayKm: 170, vetcRoundTrip: 500000 },
  { label: 'Cao Bằng', keywords: ['cao bang'], oneWayKm: 280, vetcRoundTrip: 350000 },
  { label: 'Lào Cai', keywords: ['lao cai', 'sapa', 'sa pa', 'yen bai'], oneWayKm: 300, vetcRoundTrip: 450000 },
  { label: 'Sơn La', keywords: ['son la', 'moc chau'], oneWayKm: 300, vetcRoundTrip: 250000 },
  { label: 'Điện Biên', keywords: ['dien bien'], oneWayKm: 450, vetcRoundTrip: 300000 },
  { label: 'Lai Châu', keywords: ['lai chau'], oneWayKm: 420, vetcRoundTrip: 300000 },
  { label: 'Nghệ An', keywords: ['nghe an', 'vinh'], oneWayKm: 300, vetcRoundTrip: 450000 },
  { label: 'Hà Tĩnh', keywords: ['ha tinh'], oneWayKm: 360, vetcRoundTrip: 500000 },
  { label: 'Quảng Trị', keywords: ['quang tri', 'dong hoi', 'quang binh'], oneWayKm: 590, vetcRoundTrip: 650000 },
  { label: 'Huế', keywords: ['hue', 'thua thien hue'], oneWayKm: 670, vetcRoundTrip: 700000 },
  { label: 'Đà Nẵng', keywords: ['da nang', 'hoi an', 'quang nam'], oneWayKm: 760, vetcRoundTrip: 800000 },
  { label: 'Quảng Ngãi', keywords: ['quang ngai', 'kon tum'], oneWayKm: 880, vetcRoundTrip: 850000 },
  { label: 'Gia Lai', keywords: ['gia lai', 'pleiku', 'binh dinh', 'quy nhon'], oneWayKm: 1050, vetcRoundTrip: 900000 },
  { label: 'Đắk Lắk', keywords: ['dak lak', 'đak lak', 'buon ma thuot', 'phu yen', 'tuy hoa'], oneWayKm: 1200, vetcRoundTrip: 950000 },
  { label: 'Khánh Hòa', keywords: ['khanh hoa', 'nha trang', 'ninh thuan', 'phan rang'], oneWayKm: 1300, vetcRoundTrip: 1000000 },
  { label: 'Lâm Đồng', keywords: ['lam dong', 'da lat', 'bao loc', 'dak nong', 'đak nong', 'binh thuan', 'phan thiet'], oneWayKm: 1450, vetcRoundTrip: 1050000 },
  { label: 'Đồng Nai', keywords: ['dong nai', 'bien hoa', 'binh phuoc'], oneWayKm: 1550, vetcRoundTrip: 1100000 },
  { label: 'TP. Hồ Chí Minh', keywords: ['ho chi minh', 'hcm', 'sai gon', 'saigon', 'binh duong', 'thu dau mot', 'ba ria', 'vung tau'], oneWayKm: 1600, vetcRoundTrip: 1100000 },
  { label: 'Tây Ninh', keywords: ['tay ninh', 'long an'], oneWayKm: 1620, vetcRoundTrip: 1100000 },
  { label: 'Cần Thơ', keywords: ['can tho', 'hau giang', 'soc trang'], oneWayKm: 1750, vetcRoundTrip: 1150000 },
  { label: 'Đồng Tháp', keywords: ['dong thap', 'cao lanh', 'sa dec', 'tien giang', 'my tho'], oneWayKm: 1700, vetcRoundTrip: 1150000 },
  { label: 'Vĩnh Long', keywords: ['vinh long', 'ben tre', 'tra vinh'], oneWayKm: 1780, vetcRoundTrip: 1150000 },
  { label: 'An Giang', keywords: ['an giang', 'long xuyen', 'chau doc', 'kien giang', 'rach gia', 'phu quoc'], oneWayKm: 1900, vetcRoundTrip: 1200000 },
  { label: 'Cà Mau', keywords: ['ca mau', 'bac lieu'], oneWayKm: 1950, vetcRoundTrip: 1200000 }
];

const normalizeText = (value?: string | null) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const roundMoney = (value: number, step = 50000) =>
  Math.max(0, Math.round(value / step) * step);

const getInclusiveDateSpan = (start?: string, end?: string) => {
  if (!start) return 1;
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end || start}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 1;
  return Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
};

const getEventDurationInfo = (event: Event) => {
  const schedule = getEventSchedule(event);
  const dates = Array.from(new Set(schedule.map(item => item.date).filter(Boolean))).sort();
  const dayCount = dates.length > 0
    ? dates.length
    : getInclusiveDateSpan(event.startDate, event.endDate);
  const isContinuous = dates.length <= 1
    ? getInclusiveDateSpan(event.startDate, event.endDate) === dayCount
    : dates.every((date, index) => {
      if (index === 0) return true;
      const prev = new Date(`${dates[index - 1]}T00:00:00`).getTime();
      const current = new Date(`${date}T00:00:00`).getTime();
      return current - prev === 86400000;
    });
  return { dayCount: Math.max(1, dayCount), isContinuous };
};

const extractMapLatLng = (text: string) => {
  const decoded = decodeURIComponent(text || '');
  const atMatch = decoded.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  const destinationMatch = decoded.match(/[?&](?:destination|query|q)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  const match = atMatch || destinationMatch;
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

const haversineKm = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
  const radius = 6371;
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const estimateEventRoute = (event: Event) => {
  const profile: Partial<EventProfile> = event.eventProfile || {};
  const rawText = [
    event.client,
    event.location,
    profile.organization,
    profile.addressDetail,
    profile.mapLink,
    profile.setupArea
  ].filter(Boolean).join(' ');
  const normalized = normalizeText(rawText);
  const isHanoi = normalized.includes('ha noi') || normalized.includes('hanoi') || normalized.includes('hà noi');
  const matchedProvince = PROVINCE_ROUTE_ESTIMATES
    .filter(item => item.keywords.some(keyword => normalized.includes(keyword)))
    .sort((a, b) => a.oneWayKm - b.oneWayKm)[0];

  if (matchedProvince) {
    return {
      label: matchedProvince.label,
      isOutOfProvince: matchedProvince.label !== 'Hà Nội',
      roundTripKm: matchedProvince.oneWayKm * 2,
      vetcRoundTrip: matchedProvince.vetcRoundTrip,
      basis: `ước tính theo khu vực ${matchedProvince.label}`
    };
  }

  const coords = extractMapLatLng(profile.mapLink || rawText);
  if (coords) {
    const oneWay = haversineKm(HANOI_CENTER, coords) * 1.25;
    const roundTripKm = Math.max(20, Math.round(oneWay * 2));
    return {
      label: isHanoi || roundTripKm <= 80 ? 'Hà Nội' : 'Ngoại tỉnh',
      isOutOfProvince: !isHanoi && roundTripKm > 80,
      roundTripKm,
      vetcRoundTrip: !isHanoi && roundTripKm > 80 ? 250000 : 0,
      basis: 'ước tính từ tọa độ Google Maps'
    };
  }

  return {
    label: isHanoi ? 'Hà Nội' : 'Chưa rõ địa bàn',
    isOutOfProvince: !isHanoi,
    roundTripKm: isHanoi ? 30 : 180,
    vetcRoundTrip: isHanoi ? 0 : 250000,
    basis: isHanoi ? 'mặc định nội thành Hà Nội' : 'chưa nhận diện tỉnh, dùng mức ngoại tỉnh mặc định'
  };
};

const getAutoAdvanceId = (eventId: string, key: string) => `auto-advance-${eventId}-${key}`;

const makeAutoAdvanceRequest = (
  event: Event,
  key: string,
  title: string,
  amount: number,
  note: string
): EventAdvanceRequest | null => {
  const rounded = roundMoney(amount);
  if (rounded <= 0) return null;
  return {
    id: getAutoAdvanceId(event.id, key),
    title,
    amount: rounded,
    note,
    createdAt: event.startDate || new Date().toISOString().slice(0, 10),
    source: AUTO_ADVANCE_SOURCE,
    autoKey: key
  };
};

const getAutoAdvancePlan = (event: Event) => {
  const venue = getEventVenue(event);
  const { dayCount, isContinuous } = getEventDurationInfo(event);
  const route = estimateEventRoute(event);
  const staffCount = Math.max(1, new Set((event.staff || []).map(item => item.employeeId).filter(Boolean)).size || (event.staff || []).length);
  const carCount = Math.max(1, Math.ceil(staffCount / 4));
  const rooms = staffCount <= 1 ? 1 : Math.max(2, Math.ceil(staffCount / 3));
  const nights = Math.max(0, dayCount - 1);
  const isExternal = venue === 'EBUS';
  const requests = [
    isExternal ? makeAutoAdvanceRequest(
      event,
      'fuel',
      'Dầu xe EBUS',
      route.roundTripKm / 100 * 250000,
      `${Math.round(route.roundTripKm)}km khứ hồi • 250.000đ/100km • ${route.basis}`
    ) : null,
    isExternal ? makeAutoAdvanceRequest(
      event,
      'driver',
      'Thuê tài xế',
      (route.isOutOfProvince ? 1000000 : 600000) * dayCount,
      `${dayCount} ngày • ${route.isOutOfProvince ? 'ngoại tỉnh 1.000.000đ/ngày' : 'nội thành Hà Nội 600.000đ/ngày'}`
    ) : null,
    isExternal ? makeAutoAdvanceRequest(
      event,
      'staff-transport',
      'Chở nhân sự',
      route.isOutOfProvince
        ? staffCount * 2 * 275000
        : carCount * route.roundTripKm * 20000,
      route.isOutOfProvince
        ? `${staffCount} nhân sự • vé tỉnh 275.000đ/lượt x 2 lượt`
        : `${staffCount} nhân sự • ${carCount} xe • ${Math.round(route.roundTripKm)}km x 20.000đ/km`
    ) : null,
    isExternal && route.isOutOfProvince ? makeAutoAdvanceRequest(
      event,
      'vetc',
      'VETC / phí đường bộ',
      route.vetcRoundTrip,
      `${route.label} • phí khứ hồi ước tính, có thể chỉnh theo hóa đơn thực tế`
    ) : null,
    isExternal && route.isOutOfProvince && isContinuous && dayCount >= 2 ? makeAutoAdvanceRequest(
      event,
      'accommodation',
      'Lưu trú',
      rooms * nights * 350000,
      `${rooms} phòng x ${nights} đêm • 350.000đ/phòng/đêm • ${staffCount} nhân sự`
    ) : null,
    makeAutoAdvanceRequest(
      event,
      'contingency',
      'Phát sinh dự phòng',
      1000000,
      'Mặc định 1.000.000đ cho vật tư tiêu hao, mua bổ sung hoặc sự cố xe'
    )
  ].filter(Boolean) as EventAdvanceRequest[];

  return {
    requests,
    summary: {
      venue,
      dayCount,
      isContinuous,
      staffCount,
      rooms,
      nights,
      route
    }
  };
};

const isAutoAdvanceRequest = (request: EventAdvanceRequest) =>
  request.source !== 'MANUAL' && (
    request.source === AUTO_ADVANCE_SOURCE ||
    (request.autoKey || '').startsWith(AUTO_ADVANCE_PREFIX) ||
    request.id.startsWith('auto-advance-')
  );

const areAdvanceRequestsEquivalent = (left: EventAdvanceRequest[], right: EventAdvanceRequest[]) =>
  JSON.stringify(left.map(item => ({
    id: item.id,
    title: item.title,
    note: item.note || '',
    amount: item.amount || 0,
    source: item.source || 'MANUAL',
    autoKey: item.autoKey || '',
    createdAt: item.createdAt || ''
  }))) === JSON.stringify(right.map(item => ({
    id: item.id,
    title: item.title,
    note: item.note || '',
    amount: item.amount || 0,
    source: item.source || 'MANUAL',
    autoKey: item.autoKey || '',
    createdAt: item.createdAt || ''
  })));

const getStaffSessions = (staff?: Pick<EventStaffAllocation, 'session' | 'sessions'>): EventSession[] => {
  if (!staff) return [];
  if (staff.sessions && staff.sessions.length > 0) return staff.sessions as EventSession[];
  return staff.session ? [staff.session as EventSession] : [];
};

const STAFF_HOURLY_RATE = 30000;
const STAFF_WATER_ALLOWANCE_HALF_DAY = 10000;
const STAFF_WATER_ALLOWANCE_FULL_DAY = 20000;
const STAFF_MEAL_ALLOWANCE_FULL_DAY = 50000;
const STAFF_DAILY_CAP = 310000;
const STAFF_SESSION_HOURS: Record<EventSession, number> = {
  MORNING: 4,
  AFTERNOON: 4,
  EVENING: 4
};
const AUTO_STAFF_SLOT_SOURCE = 'AUTO_STATION_SLOT' as const;

type AutoStaffSlotStation = {
  id: string;
  name: string;
  packageName?: string;
  areaDescription?: string;
};

type AutoStaffSlot = {
  key: string;
  baseKey: string;
  programId?: string;
  programName?: string;
  station: AutoStaffSlotStation;
  date: string;
  sessions: EventSession[];
  hours: number;
  salary: number;
  allowance: number;
  assigned: EventStaffAllocation[];
};

const makeEventManagerId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const getStaffAllocationKey = (staff: EventStaffAllocation, index?: number) =>
  staff.id || staff.autoKey || `${staff.employeeId}-${staff.shiftDate || 'no-date'}-${getStaffSessions(staff).join('-') || staff.session || 'no-session'}-${index ?? 0}`;

const getStaffWorkHours = (sessions: EventSession[]) =>
  Math.min(8, Math.max(1, sessions.reduce((sum, session) => sum + (STAFF_SESSION_HOURS[session] || 4), 0)));

const calculateStaffCompensation = (hours: number, rate = STAFF_HOURLY_RATE) => {
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

const getStaffCompensationNote = (hours: number, rate = STAFF_HOURLY_RATE) => {
  const { allowance, total } = calculateStaffCompensation(hours, rate);
  const allowanceText = hours >= 8
    ? 'ăn 50.000đ + nước 20.000đ'
    : hours >= 4
      ? 'nước 10.000đ'
      : 'chưa có phụ cấp';
  return `${hours}h x ${rate.toLocaleString()}đ/h + ${allowanceText}${total >= STAFF_DAILY_CAP ? ' • chạm trần 310.000đ/ngày' : allowance > 0 ? '' : ''}`;
};

type StaffCostGroupItem = {
  allocation: EventStaffAllocation;
  index: number;
  key: string;
  hours: number;
};

type StaffCostGroup = {
  key: string;
  employeeId: string;
  shiftDate?: string;
  items: StaffCostGroupItem[];
  sessions: EventSession[];
  stationNames: string[];
  totalHours: number;
  totalSalary: number;
  isDayPolicyGroup: boolean;
};

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

const getStaffCostGroups = (staffList: EventStaffAllocation[] = []): StaffCostGroup[] => {
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
    const sessions = new Set<EventSession>();
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

const getAutoStaffSlotStations = (event: Event): AutoStaffSlotStation[] => {
  const houseStations = event.houseOperation?.stations || [];
  if (houseStations.length > 0) {
    return houseStations.map(station => ({
      id: station.id,
      name: station.name,
      packageName: station.packageName,
      areaDescription: station.areaDescription || station.room
    }));
  }
  return (event.layout?.blocks || []).map(block => ({
    id: block.id,
    name: block.name,
    packageName: block.packageName,
    areaDescription: block.staffName
  }));
};

const getStaffSlotAutoKey = (stationId: string, date: string, sessions: EventSession[], programId?: string) =>
  `staff-slot-${programId ? `${programId}-` : ''}${stationId}-${date}-${sessions.join('-') || 'SESSION'}`;

const getAutoStaffSlots = (event: Event, splitKeys: Set<string>, programId?: string, programName?: string): AutoStaffSlot[] => {
  const stations = getAutoStaffSlotStations(event);
  const schedule = getEventSchedule(event);
  const safeSchedule = schedule.length > 0
    ? schedule
    : [{ date: event.startDate, sessions: event.session ? [event.session] : ['MORNING' as EventSession] }];
  return stations.flatMap(station => safeSchedule.flatMap(item => {
    const sessions = item.sessions.length > 0 ? item.sessions : (event.session ? [event.session] : ['MORNING' as EventSession]);
    const baseKey = getStaffSlotAutoKey(station.id, item.date, sessions, programId);
    const hasSplitAssignment = sessions.length > 1 && sessions.some(session =>
      (event.staff || []).some(staff => staff.autoKey === getStaffSlotAutoKey(station.id, item.date, [session], programId))
    );
    const slotSessionGroups = sessions.length > 1 && (splitKeys.has(baseKey) || hasSplitAssignment)
      ? sessions.map(session => [session])
      : [sessions];
    return slotSessionGroups.map(slotSessions => {
      const isSplitChild = slotSessions.length === 1 && sessions.length > 1;
      const slotKey = isSplitChild ? getStaffSlotAutoKey(station.id, item.date, slotSessions, programId) : baseKey;
      const slotHours = getStaffWorkHours(slotSessions);
      const slotCompensation = calculateStaffCompensation(slotHours);
      const assigned = (event.staff || []).filter(staff =>
        staff.autoKey === slotKey ||
        (!staff.autoKey && staff.stationId === station.id && staff.shiftDate === item.date && getStaffSessions(staff).join('|') === slotSessions.join('|'))
      );
      return {
        key: slotKey,
        baseKey,
        programId,
        programName,
        station,
        date: item.date,
        sessions: slotSessions,
        hours: slotHours,
        salary: slotCompensation.total,
        allowance: slotCompensation.allowance,
        assigned
      };
    });
  }));
};

const LAYOUT_COLORS = ['#2563eb', '#0ea5e9', '#16a34a', '#f97316', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4'];

type ResizeDirection = 'right' | 'left' | 'top' | 'bottom' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const printStyles = `
@media print {
  body {
    margin: 0;
    -webkit-print-color-adjust: exact;
    background: #fff !important;
  }
  body > *:not(#print-slip-wrapper) {
    display: none !important;
  }
  #print-slip-wrapper {
    display: block !important;
    position: static !important;
    inset: auto !important;
    height: auto !important;
    width: auto !important;
    overflow: visible !important;
    background: transparent !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  #print-slip-wrapper {
    background: #fff !important;
  }
  #print-slip {
    box-shadow: none !important;
    border: none !important;
    width: 100% !important;
    max-width: 100% !important;
    padding: 16mm !important;
    margin: 0 auto !important;
  }
  #print-slip table th,
  #print-slip table td {
    padding: 8px 10px !important;
  }
  #print-slip table {
    page-break-inside: auto;
  }
  #print-slip tr {
    page-break-inside: avoid;
    page-break-after: auto;
  }
  .print\\:hidden {
    display: none !important;
  }
}
@page {
  margin: 12mm;
}
`;

const getEventSchedule = (event: Event): EventScheduleItem[] => {
  if (event.schedule && event.schedule.length > 0) {
    const normalized = (event.schedule as any[]).map(it => {
      if (it.sessions && Array.isArray(it.sessions)) return { date: it.date, sessions: it.sessions as EventSession[] };
      if (it.session) return { date: it.date, sessions: [it.session as EventSession] };
      return { date: it.date, sessions: event.session ? [event.session] : ['MORNING' as EventSession] };
    });
    return [...normalized].sort((a, b) => a.date.localeCompare(b.date));
  }
  if (event.startDate) {
    const fallbackSession = event.session || 'MORNING';
    return [{ date: event.startDate, sessions: [fallbackSession] }];
  }
  return [];
};

const getSessionsForDate = (event: Event, date: string): EventSession[] | null => {
  const schedule = getEventSchedule(event);
  const match = schedule.find(item => item.date === date);
  return match ? match.sessions : null;
};

const clonePlain = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const getProgramDefaultDate = (event: Event) =>
  getEventSchedule(event)[0]?.date || event.startDate || new Date().toISOString().slice(0, 10);

const getProgramDefaultSessions = (event: Event): EventSession[] =>
  getEventSchedule(event)[0]?.sessions || (event.session ? [event.session] : ['MORNING']);

const getContentProgramViews = (event: Event): ContentProgramView[] => {
  const primaryMeta = event.primaryContentProgram || {};
  const primary: ContentProgramView = {
    id: PRIMARY_CONTENT_PROGRAM_ID,
    name: primaryMeta.name || 'Chương trình chính',
    description: primaryMeta.description || 'Dữ liệu nội dung mặc định của sự kiện',
    date: primaryMeta.date || getProgramDefaultDate(event),
    sessions: primaryMeta.sessions as EventSession[] | undefined || getProgramDefaultSessions(event),
    layout: event.layout,
    houseOperation: event.houseOperation,
    isPrimary: true
  };
  const clones: ContentProgramView[] = (event.contentPrograms || []).map(program => ({
    id: program.id,
    name: program.name,
    description: program.description,
    date: program.date,
    sessions: program.sessions as EventSession[] | undefined,
    layout: program.layout,
    houseOperation: program.houseOperation,
    isPrimary: false
  }));
  return [primary, ...clones];
};

const getContentProgramEvent = (event: Event, program: ContentProgramView): Event => {
  const programDate = program.date || getProgramDefaultDate(event);
  const programSessions = program.sessions && program.sessions.length > 0 ? program.sessions : getProgramDefaultSessions(event);
  return {
    ...event,
    startDate: programDate,
    endDate: programDate,
    session: programSessions[0],
    schedule: [{ date: programDate, sessions: programSessions }],
    layout: program.layout,
    houseOperation: program.houseOperation
  };
};

const getContentProgramScopedEvents = (event: Event, activeProgramId?: string): Event[] =>
  getContentProgramViews(event).map(program => {
    const scopedEvent = getContentProgramEvent(event, program);
    const rootProgramId = activeProgramId || PRIMARY_CONTENT_PROGRAM_ID;
    const useRootId = program.id === rootProgramId;
    return {
      ...scopedEvent,
      id: useRootId ? event.id : `${event.id}::${program.id}`,
      name: program.isPrimary ? event.name : `${event.name} • ${program.name}`,
      contentPrograms: undefined,
      primaryContentProgram: undefined
    };
  });

const SESSION_DEFAULT_START: Record<EventSession, string> = {
  MORNING: '09:00',
  AFTERNOON: '14:00',
  EVENING: '19:00'
};

const SESSION_DEFAULT_END: Record<EventSession, string> = {
  MORNING: '11:30',
  AFTERNOON: '17:00',
  EVENING: '21:00'
};

const PROFILE_DEFAULT_TIME_RANGE: Record<EventSession, { start: string; end: string }> = {
  MORNING: { start: '08:00', end: '11:00' },
  AFTERNOON: { start: '13:00', end: '16:00' },
  EVENING: { start: '19:00', end: '21:00' }
};

const getDefaultProfileTimeRange = (session?: EventSession) =>
  PROFILE_DEFAULT_TIME_RANGE[session || 'MORNING'];

const parseTimeToMinutes = (value?: string) => {
  const match = (value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const minutesToTime = (minutes: number) => {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, minutes));
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const combineDateTime = (date: string, time: string) => `${date}T${time}`;

const addHoursToLocalDateTime = (dateTime: string, hours: number) => {
  const parsed = new Date(dateTime);
  if (Number.isNaN(parsed.getTime())) return dateTime;
  parsed.setHours(parsed.getHours() + hours);
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  const hh = String(parsed.getHours()).padStart(2, '0');
  const mm = String(parsed.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}`;
};

const addMinutesToLocalDateTime = (dateTime: string, minutes: number) => {
  const parsed = new Date(dateTime);
  if (Number.isNaN(parsed.getTime())) return dateTime;
  parsed.setMinutes(parsed.getMinutes() + minutes);
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  const hh = String(parsed.getHours()).padStart(2, '0');
  const mm = String(parsed.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}`;
};

const getMinutesFromLocalDateTime = (dateTime: string) => {
  const parsed = new Date(dateTime);
  if (Number.isNaN(parsed.getTime())) return 0;
  return parsed.getHours() * 60 + parsed.getMinutes();
};

const addDaysToDateString = (date: string, days: number) => {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setDate(parsed.getDate() + days);
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getProgramStationCount = (program: ContentProgramView) =>
  Math.max(program.houseOperation?.stations?.length || 0, program.layout?.blocks?.length || 0);

const getDateDiffDays = (from: string, to: string) => {
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return 0;
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86400000);
};

const getProgramAgendaTimeBounds = (program: ContentProgramView) => {
  const agenda = program.houseOperation?.agenda || [];
  const starts = agenda.map(block => parseTimeToMinutes(block.startTime)).filter((value): value is number => value !== null);
  const ends = agenda.map(block => parseTimeToMinutes(block.endTime)).filter((value): value is number => value !== null);
  if (starts.length === 0 || ends.length === 0) return null;
  return {
    startTime: minutesToTime(Math.min(...starts)),
    endTime: minutesToTime(Math.max(...ends))
  };
};

const agendaBoundsMatchSessions = (bounds: { startTime: string; endTime: string }, sessions: EventSession[]) => {
  if (sessions.length !== 1) return true;
  const start = parseTimeToMinutes(bounds.startTime);
  if (start === null) return true;
  const [session] = sessions;
  if (session === 'MORNING') return start < 12 * 60;
  if (session === 'AFTERNOON') return start >= 12 * 60 && start < 18 * 60;
  return start >= 17 * 60;
};

const getProgramTimeBounds = (event: Event, program: ContentProgramView, sessions: EventSession[], useSharedProfileTime: boolean) => {
  const agendaBounds = getProgramAgendaTimeBounds(program);
  if (agendaBounds && agendaBoundsMatchSessions(agendaBounds, sessions)) return agendaBounds;
  const profile: Partial<EventProfile> = event.eventProfile || {};
  const safeSessions = sessions.length > 0 ? sessions : [event.session || 'MORNING'];
  const sessionStarts = safeSessions
    .map(session => parseTimeToMinutes(SESSION_DEFAULT_START[session]))
    .filter((value): value is number => value !== null);
  const sessionEnds = safeSessions
    .map(session => parseTimeToMinutes(SESSION_DEFAULT_END[session]))
    .filter((value): value is number => value !== null);
  const fallbackStart = parseTimeToMinutes('09:00') || 540;
  const sharedStart = useSharedProfileTime ? parseTimeToMinutes(profile.programTimeStart) : null;
  const sharedEnd = useSharedProfileTime ? parseTimeToMinutes(profile.programTimeEnd) : null;
  const start = sharedStart ?? Math.min(...sessionStarts, fallbackStart);
  const end = sharedEnd ?? Math.max(...sessionEnds, start + 180);
  return {
    startTime: minutesToTime(start),
    endTime: minutesToTime(Math.max(end, start + 60))
  };
};

const getAutoTimelineId = (eventId: string, key: string) => `auto-timeline-${eventId}-${key}`;
const EARLIEST_SAME_DAY_PROVINCE_DEPARTURE = 5 * 60 + 30;

const getRouteTravelMinutesOneWay = (route: ReturnType<typeof estimateEventRoute>) => {
  if (!route.isOutOfProvince) return 90;
  const oneWayKm = Math.max(30, route.roundTripKm / 2);
  return Math.max(120, Math.min(300, Math.ceil((oneWayKm / 50) * 60) + 45));
};

const makeAutoTimelineEntry = (
  event: Event,
  key: string,
  phase: EventTimelinePhase,
  datetime: string,
  note: string
): EventTimelineEntry => ({
  id: getAutoTimelineId(event.id, key),
  phase,
  datetime,
  note,
  source: AUTO_TIMELINE_SOURCE,
  autoKey: `${AUTO_TIMELINE_PREFIX}-${key}`
});

type AutoTimelineProgramItem = {
  program: ContentProgramView;
  date: string;
  sessions: EventSession[];
  stationCount: number;
  programStart: string;
  programEnd: string;
  setupLeadHours: number;
  setupTime: string;
};

const getAutoTimelinePlan = (event: Event) => {
  const route = estimateEventRoute(event);
  const programs = getContentProgramViews(event);
  const programItems = programs.flatMap(program => {
    const programEvent = getContentProgramEvent(event, program);
    return getEventSchedule(programEvent).map(scheduleItem => ({
      program,
      date: scheduleItem.date,
      sessions: scheduleItem.sessions.length > 0 ? scheduleItem.sessions : getProgramDefaultSessions(programEvent),
      stationCount: getProgramStationCount(program)
    }));
  }).filter(item => item.date);
  const primaryProgram = programs[0];
  const fallbackDate = getProgramDefaultDate(event);
  const safeItems = programItems.length > 0
    ? programItems
    : [{
        program: primaryProgram,
        date: fallbackDate,
        sessions: getProgramDefaultSessions(event),
        stationCount: primaryProgram ? getProgramStationCount(primaryProgram) : 0
      }];
  const maxStationCount = Math.max(0, ...safeItems.map(item => item.stationCount));
  const isLargeSetup = maxStationCount > 6;
  const entries: EventTimelineEntry[] = [];
  const venue = getEventVenue(event);
  const isExternalProvince = venue === 'EBUS' && route.isOutOfProvince;
  const routeLabel = venue === 'EH' ? 'tại EH' : isExternalProvince ? `ngoại tỉnh (${route.label})` : 'Hà Nội';
  const travelMinutesOneWay = getRouteTravelMinutesOneWay(route);
  const timelineItems: AutoTimelineProgramItem[] = safeItems
    .map(item => {
      const { startTime, endTime } = getProgramTimeBounds(event, item.program, item.sessions, programs.length <= 1);
      const programStart = combineDateTime(item.date, startTime);
      const programEnd = combineDateTime(item.date, endTime);
      const setupLeadHours = isExternalProvince && isLargeSetup ? 2 : 1;
      return {
        ...item,
        programStart,
        programEnd,
        setupLeadHours,
        setupTime: addHoursToLocalDateTime(programStart, -setupLeadHours)
      };
    })
    .sort((a, b) => (a.programStart || '').localeCompare(b.programStart || ''));

  const makeReturnEntry = (item: AutoTimelineProgramItem) => {
    const programLabel = programs.length > 1 ? `${item.program.name} - ` : '';
    return makeAutoTimelineEntry(
      event,
      `return-${item.program.id}-${item.date}`,
      'AFTER',
      addHoursToLocalDateTime(item.programEnd, isExternalProvince ? 4 : 1),
      venue === 'EH'
        ? `${programLabel}Thu dọn, hoàn trả không gian Einstein House và cất thiết bị về kho.`
        : isExternalProvince
        ? `${programLabel}Xe EBUS về Hà Nội trong ngày sau sự kiện, kể cả lịch kết thúc muộn.`
        : `${programLabel}Xe EBUS/đội vận hành di chuyển về trung tâm sau khi thu dọn.`
    );
  };

  const firstItem = timelineItems[0];
  const firstProvinceDepartureTime = firstItem
    ? addMinutesToLocalDateTime(firstItem.setupTime, -travelMinutesOneWay)
    : '';
  const canFirstProvinceDepartSameDay = !!(
    isExternalProvince &&
    firstItem &&
    getMinutesFromLocalDateTime(firstProvinceDepartureTime) >= EARLIEST_SAME_DAY_PROVINCE_DEPARTURE
  );
  const shouldPreparePreviousDay = !!(
    firstItem &&
    (
      (isExternalProvince && !canFirstProvinceDepartSameDay) ||
      (isLargeSetup && !isExternalProvince)
    )
  );

  if (shouldPreparePreviousDay && firstItem) {
    const previousDate = addDaysToDateString(firstItem.date, -1);
    entries.push(makeAutoTimelineEntry(
      event,
      'preload-tables-goods',
      'BEFORE',
      combineDateTime(previousDate, isExternalProvince ? '18:00' : '16:00'),
      isExternalProvince
        ? `Xe EBUS khởi hành tối hôm trước vì giờ bắt đầu không đủ biên đi trong ngày: khoảng ${travelMinutesOneWay} phút di chuyển + setup ${firstItem.setupLeadHours}h cho ${maxStationCount} trạm.`
        : `Setup trước 1 ngày: vận chuyển hàng hóa, bàn ghế và kiểm mặt bằng cho ${maxStationCount} trạm.`
    ));
    if (isExternalProvince) {
      entries.push(makeAutoTimelineEntry(
        event,
        'overnight-checkin',
        'BEFORE',
        combineDateTime(previousDate, '22:00'),
        'Đoàn đến địa bàn, nhận phòng/điểm nghỉ và xác nhận lại giờ setup sáng hôm sau.'
      ));
    }
  }

  timelineItems.forEach((item, index) => {
    const previousItem = timelineItems[index - 1];
    const nextItem = timelineItems[index + 1];
    const isFirstProgramOfDay = !previousItem || previousItem.date !== item.date;
    const programLabel = programs.length > 1 ? `${item.program.name} - ` : '';

    if (venue === 'EBUS' && isFirstProgramOfDay) {
      if (route.isOutOfProvince) {
        const departTime = addMinutesToLocalDateTime(item.setupTime, -travelMinutesOneWay);
        const canDepartSameDay = getMinutesFromLocalDateTime(departTime) >= EARLIEST_SAME_DAY_PROVINCE_DEPARTURE;
        if (canDepartSameDay) {
          entries.push(makeAutoTimelineEntry(
            event,
            `depart-province-${item.program.id}-${item.date}`,
            'BEFORE',
            departTime,
            `${programLabel}Xe EBUS khởi hành đi ${route.label} trong ngày: khoảng ${travelMinutesOneWay} phút di chuyển + setup ${item.setupLeadHours}h trước giờ chạy.`
          ));
        }
      } else if (!isLargeSetup) {
        entries.push(makeAutoTimelineEntry(
          event,
          `depart-hanoi-${item.program.id}-${item.date}`,
          'BEFORE',
          addHoursToLocalDateTime(item.programStart, -2),
          `${programLabel}Xe EBUS khởi hành từ trung tâm trước giờ tổ chức 2h, kiêm vận chuyển thiết bị setup.`
        ));
      }
    }

    entries.push(makeAutoTimelineEntry(
      event,
      `setup-${item.program.id}-${item.date}`,
      'BEFORE',
      item.setupTime,
      `${programLabel}Nhân sự có mặt, bắt đầu SETUP trước chương trình ${item.setupLeadHours}h (${item.stationCount || maxStationCount || 0} trạm, ${routeLabel}).`
    ));
    entries.push(makeAutoTimelineEntry(
      event,
      `start-${item.program.id}-${item.date}`,
      'DURING',
      item.programStart,
      `${programLabel}Bắt đầu chương trình theo Agenda.`
    ));
    entries.push(makeAutoTimelineEntry(
      event,
      `finish-${item.program.id}-${item.date}`,
      'AFTER',
      item.programEnd,
      `${programLabel}Kết thúc chương trình, kiểm kê nhanh thiết bị và thu hồi theo trạm.`
    ));

    if (nextItem) {
      const nextLabel = programs.length > 1 ? nextItem.program.name : 'chương trình tiếp theo';
      const gapDays = getDateDiffDays(item.date, nextItem.date);
      if (gapDays === 0) {
        entries.push(makeAutoTimelineEntry(
          event,
          `handover-same-day-${item.program.id}-${nextItem.program.id}-${item.date}`,
          'AFTER',
          addMinutesToLocalDateTime(item.programEnd, 15),
          venue === 'EH'
            ? `${programLabel}Chuyển tiếp sang ${nextLabel}: thu gọn thiết bị vào kho/khu hậu trường, sạc pin và bảo trì nhanh tại chỗ.`
            : `${programLabel}Chuyển tiếp sang ${nextLabel}: cất gọn thiết bị lên xe hoặc kho tại điểm tổ chức, sạc pin/bảo trì tại chỗ và chuẩn bị layout tiếp theo.`
        ));
      } else if (venue === 'EH' || (isExternalProvince && isLargeSetup && gapDays === 1)) {
        entries.push(makeAutoTimelineEntry(
          event,
          `handover-overnight-${item.program.id}-${nextItem.program.id}-${item.date}`,
          'AFTER',
          addMinutesToLocalDateTime(item.programEnd, 30),
          venue === 'EH'
            ? `${programLabel}Cất thiết bị vào kho EH, sạc/bảo trì và giữ sẵn cho ${nextLabel} ngày ${nextItem.date}.`
            : `${programLabel}Niêm phong thiết bị tại xe/kho điểm tổ chức, sạc pin và bàn giao bảo vệ/BTC để chạy tiếp ${nextLabel} ngày ${nextItem.date}.`
        ));
      } else {
        entries.push(makeReturnEntry(item));
      }
    } else {
      entries.push(makeReturnEntry(item));
    }
  });

  return {
    entries: entries.sort((a, b) => (a.datetime || '').localeCompare(b.datetime || '')),
    summary: {
      route,
      maxStationCount,
      isLargeSetup,
      programCount: programs.length,
      travelMinutesOneWay,
      provinceSameDayDeparture: canFirstProvinceDepartSameDay
    }
  };
};

const isAutoTimelineEntry = (entry: EventTimelineEntry) =>
  entry.source !== 'MANUAL' && (
    entry.source === AUTO_TIMELINE_SOURCE ||
    (entry.autoKey || '').startsWith(AUTO_TIMELINE_PREFIX) ||
    entry.id.startsWith('auto-timeline-')
  );

const areTimelineEntriesEquivalent = (left: EventTimelineEntry[], right: EventTimelineEntry[]) =>
  JSON.stringify(left.map(item => ({
    id: item.id,
    phase: item.phase,
    datetime: item.datetime,
    note: item.note,
    source: item.source || 'MANUAL',
    autoKey: item.autoKey || ''
  }))) === JSON.stringify(right.map(item => ({
    id: item.id,
    phase: item.phase,
    datetime: item.datetime,
    note: item.note,
    source: item.source || 'MANUAL',
    autoKey: item.autoKey || ''
  })));

const getProgramDateLabel = (program: ContentProgramView, fallbackEvent: Event) => {
  const date = program.date || getProgramDefaultDate(fallbackEvent);
  const sessions = program.sessions && program.sessions.length > 0 ? program.sessions : getProgramDefaultSessions(fallbackEvent);
  return `${date} • ${sessions.map(session => SESSION_LABELS[session]).join(' + ')}`;
};

const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getEventPrimaryDate = (event: Event): string | null => {
  const schedule = getEventSchedule(event);
  return schedule[0]?.date || event.startDate || event.endDate || null;
};

const getEventLastDate = (event: Event): string | null => {
  const schedule = getEventSchedule(event);
  return schedule[schedule.length - 1]?.date || event.endDate || event.startDate || null;
};

const isEventPast = (event: Event, todayKey = getLocalDateKey()) => {
  const lastDate = getEventLastDate(event);
  return !!lastDate && lastDate < todayKey;
};

const formatDateWithDay = (dateStr?: string | null) => {
  if (!dateStr) return '';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  const day = parsed.toLocaleDateString('vi-VN', { weekday: 'long' });
  return `${parsed.toLocaleDateString('vi-VN')} (${day})`;
};

const generateEventCode = (dateStr?: string) => {
  const baseDate = dateStr || new Date().toISOString().slice(0, 10);
  const cleanDate = baseDate.replace(/-/g, '');
  const suffix = String(Math.floor(Math.random() * 900 + 100));
  return `EB-${cleanDate}-${suffix}`;
};

const getEventTypeLabel = (type?: EventProfile['eventType']) => {
  const found = EVENT_TYPE_OPTIONS.find(opt => opt.value === type);
  return found?.label;
};

const getAudienceLabels = (aud?: EventProfile['audience']) => {
  if (!aud || aud.length === 0) return '';
  return aud
    .map(a => AUDIENCE_OPTIONS.find(opt => opt.value === a)?.label || a)
    .join(', ');
};

const formatMonthLabel = (key: string) => {
  const parsed = new Date(`${key}-01`);
  if (Number.isNaN(parsed.getTime())) return key;
  return parsed.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
};

export const EventManager: React.FC<EventManagerProps> = ({
  events,
  inventory,
  packages = [],
  employees = [],
  quotations = [],
  saleOrders = [],
  educationActivities = [],
  learningTracks = [],
  currentUserId,
  currentUserName,
  currentEmployeeId,
  canEdit = true,
  isAdmin = false,
  onExportToEvent,
  onExportPackageToEvent,
  onSyncQuotation,
  onRemoveEventItems,
  onReturnFromEvent,
  onUpdateEventItemQuantity,
  onCreateEvent,
  onDeleteEvent,
  onAssignStaff,
  onRemoveStaff,
  onToggleItemDone,
  onToggleStaffDone,
  onAddExpense,
  onRemoveExpense,
  onAddAdvanceRequest,
  onRemoveAdvanceRequest,
  onLinkQuotation,
  onFinalizeOrder,
  onUpdateEvent,
  onRegisterStaff,
  onLinkSaleOrder,
  onChecklistScan,
  onUpdateChecklistNote,
  onSaveChecklistSignature
}) => {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventScreenMode, setEventScreenMode] = useState<'HOME' | 'DASHBOARD' | 'DETAIL'>('HOME');
  const [detailSection, setDetailSection] = useState<EventDetailSection>('PREP_LOGISTICS');
  const [detailTab, setDetailTab] = useState<EventDetailTab>('EQUIPMENT');
  const [selectedLayoutBlockId, setSelectedLayoutBlockId] = useState<string | null>(null);
  
  // Modals
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showExportPDFModal, setShowExportPDFModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Create Event Form State
  const [newEventData, setNewEventData] = useState({
    name: '',
    client: '',
    location: '',
    organizationVenue: 'EH' as EventVenueType
  });
  const [newEventSchedule, setNewEventSchedule] = useState<EventScheduleItem[]>([]);
  const [newScheduleDate, setNewScheduleDate] = useState('');
  const [timelinePhase, setTimelinePhase] = useState<EventTimelinePhase>('BEFORE');
  const [timelineDatetime, setTimelineDatetime] = useState('');
  const [timelineNote, setTimelineNote] = useState('');
  const [editingTimelineId, setEditingTimelineId] = useState<string | null>(null);
  const sortedNewEventSchedule = useMemo(
    () => [...newEventSchedule].sort((a, b) => a.date.localeCompare(b.date)),
    [newEventSchedule]
  );

  // Export State
  const [exportMode, setExportMode] = useState<'SINGLE' | 'COMBO'>('SINGLE');
  const [selectedItemForExport, setSelectedItemForExport] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [exportQty, setExportQty] = useState(1);
  const [exportSearchTerm, setExportSearchTerm] = useState('');

  const sortedInventoryForExport = useMemo(
    () => [...inventory].sort((a, b) => a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' })),
    [inventory]
  );

  const filteredInventoryForExport = useMemo(() => {
    const term = exportSearchTerm.trim().toLowerCase();
    let list = sortedInventoryForExport;
    if (term) {
      list = sortedInventoryForExport.filter(item =>
        item.name.toLowerCase().includes(term) ||
        (item.barcode || '').toLowerCase().includes(term)
      );
    }
    if (selectedItemForExport && !list.find(item => item.id === selectedItemForExport)) {
      const selectedItem = sortedInventoryForExport.find(item => item.id === selectedItemForExport);
      if (selectedItem) list = [selectedItem, ...list];
    }
    return list;
  }, [sortedInventoryForExport, exportSearchTerm, selectedItemForExport]);

  const selectedPackageForExport = useMemo(
    () => packages.find(pkg => pkg.id === selectedPackageId),
    [packages, selectedPackageId]
  );

  const selectedPackagePreviewItems = useMemo(() => {
    if (!selectedPackageForExport) return [];
    return selectedPackageForExport.items.map(pkgItem => {
      const inventoryItem = inventory.find(item => item.id === pkgItem.itemId);
      return {
        itemId: pkgItem.itemId,
        name: inventoryItem?.name || 'Thiết bị không còn trong kho',
        category: inventoryItem?.category || '',
        quantity: pkgItem.quantity
      };
    });
  }, [inventory, selectedPackageForExport]);

  useEffect(() => {
    if (!showExportModal) {
      setExportSearchTerm('');
    }
  }, [showExportModal]);

  const visibleDetailTabs = useMemo(
    () => DETAIL_TABS.filter(tab => tab.section === detailSection && (!tab.requireEdit || canEdit)),
    [canEdit, detailSection]
  );

  const handleDetailSectionChange = (section: EventDetailSection) => {
    setDetailSection(section);
    const firstTab = DETAIL_TABS.find(tab => tab.section === section && (!tab.requireEdit || canEdit));
    if (firstTab) setDetailTab(firstTab.key);
  };

  useEffect(() => {
    if (!visibleDetailTabs.some(tab => tab.key === detailTab)) {
      const fallback = visibleDetailTabs[0] || DETAIL_TABS[0];
      setDetailTab(fallback.key);
    }
  }, [visibleDetailTabs, detailTab]);
  const [calendarView, setCalendarView] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [activeContentProgramId, setActiveContentProgramId] = useState(PRIMARY_CONTENT_PROGRAM_ID);
  const [isContentProgramEditorOpen, setIsContentProgramEditorOpen] = useState(false);
  const calendarMonthLabel = useMemo(
    () => new Date(calendarView.year, calendarView.month, 1).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' }),
    [calendarView]
  );

  // Assign Staff State
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [staffSearchTerm, setStaffSearchTerm] = useState('');
  const [staffTask, setStaffTask] = useState('');
  const [staffUnit, setStaffUnit] = useState<'HOUR' | 'DAY' | 'FIXED'>('HOUR');
  const [staffQty, setStaffQty] = useState(4);
  const [staffRate, setStaffRate] = useState(String(STAFF_HOURLY_RATE));
  const [selectedSessions, setSelectedSessions] = useState<EventSession[]>([]);
  const [selectedShiftDate, setSelectedShiftDate] = useState<string | null>(null);
  const [splitAutoStaffSlotKeys, setSplitAutoStaffSlotKeys] = useState<Set<string>>(() => new Set());
  const [layoutForm, setLayoutForm] = useState({
    name: '',
    packageId: '',
    packageName: '',
    packageSource: 'QUOTATION' as LayoutPackageSource,
    customPackageName: '',
    staffId: '',
    staffName: '',
    color: LAYOUT_COLORS[0]
  });
  const [draggingBlock, setDraggingBlock] = useState<{ id: string; offsetX: number; offsetY: number; rect: DOMRect } | null>(null);
  const [resizingBlock, setResizingBlock] = useState<{ id: string; direction: ResizeDirection; rect: DOMRect } | null>(null);
  const [showLayoutFullscreen, setShowLayoutFullscreen] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  // Expense State
  const [expenseCat, setExpenseCat] = useState<EventExpense['category']>('TRANSPORT_GOODS');
  const [expenseSub, setExpenseSub] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseVatLink, setExpenseVatLink] = useState('');
  const [advanceTitle, setAdvanceTitle] = useState('');
  const [advanceNote, setAdvanceNote] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [editingAdvanceId, setEditingAdvanceId] = useState<string | null>(null);
  const [editingAdvanceTitle, setEditingAdvanceTitle] = useState('');
  const [editingAdvanceNote, setEditingAdvanceNote] = useState('');
  const [editingAdvanceAmount, setEditingAdvanceAmount] = useState('');
  const [advancePaidAmountInput, setAdvancePaidAmountInput] = useState('');
  const [advancePaidDateInput, setAdvancePaidDateInput] = useState('');
  const [advancePaidConfirmed, setAdvancePaidConfirmed] = useState(false);
  const [advanceRefundedConfirmed, setAdvanceRefundedConfirmed] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [advanceSkipped, setAdvanceSkipped] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [viewingItem, setViewingItem] = useState<InventoryItem | null>(null);

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const contentProgramViews = useMemo(
    () => selectedEvent ? getContentProgramViews(selectedEvent) : [],
    [selectedEvent]
  );
  const activeContentProgram = useMemo(
    () => contentProgramViews.find(program => program.id === activeContentProgramId) || contentProgramViews[0],
    [activeContentProgramId, contentProgramViews]
  );
  const activeContentEvent = useMemo(
    () => selectedEvent && activeContentProgram ? getContentProgramEvent(selectedEvent, activeContentProgram) : selectedEvent,
    [activeContentProgram, selectedEvent]
  );
  const eventsForActiveContent = useMemo(
    () => selectedEvent && activeContentProgram
      ? events.flatMap(event => event.id === selectedEvent.id
        ? getContentProgramScopedEvents(event, activeContentProgram.id)
        : getContentProgramScopedEvents(event)
      ).map(event => event.id === selectedEvent.id ? activeContentEvent || event : event)
      : events.flatMap(event => getContentProgramScopedEvents(event)),
    [activeContentEvent, activeContentProgram, events, selectedEvent]
  );
  const eventProfile = selectedEvent?.eventProfile || {};
  const canEditProfile = canEdit && isAdmin;
  const autoAdvancePlan = useMemo(
    () => selectedEvent ? getAutoAdvancePlan(selectedEvent) : null,
    [selectedEvent]
  );
  const autoTimelinePlan = useMemo(
    () => selectedEvent ? getAutoTimelinePlan(selectedEvent) : null,
    [selectedEvent]
  );
  const autoStaffSlots = useMemo(
    () => selectedEvent
      ? contentProgramViews.flatMap(program => {
        const programEvent = getContentProgramEvent(selectedEvent, program);
        return getAutoStaffSlots(
          programEvent,
          splitAutoStaffSlotKeys,
          program.isPrimary ? undefined : program.id,
          contentProgramViews.length > 1 ? program.name : undefined
        );
      })
      : [],
    [contentProgramViews, selectedEvent, splitAutoStaffSlotKeys]
  );
  const filledAutoStaffSlots = autoStaffSlots.filter(slot => slot.assigned.length > 0).length;
  const linkedQuotation = selectedEvent?.quotationId ? quotations.find(q => q.id === selectedEvent.quotationId) : null;
  const linkedSaleOrders = useMemo(() => {
    if (!selectedEvent) return [];
    return saleOrders.filter(o => o.eventId === selectedEvent.id || (selectedEvent.saleOrderIds || []).includes(o.id));
  }, [saleOrders, selectedEvent]);
  const selectableSaleOrders = useMemo(() => {
    if (!selectedEvent) return [];
    return saleOrders.filter(o => o.eventId === undefined || o.eventId === selectedEvent.id || (selectedEvent.saleOrderIds || []).includes(o.id));
  }, [saleOrders, selectedEvent]);

  useEffect(() => {
    if (!selectedEvent || !autoAdvancePlan || !onUpdateEvent || !canEdit) return;
    const manualRequests = (selectedEvent.advanceRequests || []).filter(req => !isAutoAdvanceRequest(req));
    const manualAutoKeys = new Set(manualRequests.map(req => req.autoKey).filter(Boolean));
    const nextAutoRequests = autoAdvancePlan.requests.filter(req => !req.autoKey || !manualAutoKeys.has(req.autoKey));
    const nextRequests = [...nextAutoRequests, ...manualRequests];
    if (!areAdvanceRequestsEquivalent(selectedEvent.advanceRequests || [], nextRequests)) {
      onUpdateEvent(selectedEvent.id, { advanceRequests: nextRequests });
    }
  }, [autoAdvancePlan, canEdit, onUpdateEvent, selectedEvent]);

  useEffect(() => {
    if (!selectedEvent || !autoTimelinePlan || !onUpdateEvent || !canEdit) return;
    const manualEntries = (selectedEvent.timeline || []).filter(entry => !isAutoTimelineEntry(entry));
    const manualEntryIds = new Set(manualEntries.map(entry => entry.id));
    const manualAutoKeys = new Set(manualEntries.map(entry => entry.autoKey).filter(Boolean));
    const nextAutoEntries = autoTimelinePlan.entries.filter(entry =>
      !manualEntryIds.has(entry.id) &&
      (!entry.autoKey || !manualAutoKeys.has(entry.autoKey))
    );
    const nextTimeline = [...nextAutoEntries, ...manualEntries]
      .sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));
    if (!areTimelineEntriesEquivalent(selectedEvent.timeline || [], nextTimeline)) {
      onUpdateEvent(selectedEvent.id, { timeline: nextTimeline });
    }
  }, [autoTimelinePlan, canEdit, onUpdateEvent, selectedEvent]);

  useEffect(() => {
    if (!selectedEvent) return;
    if (!contentProgramViews.some(program => program.id === activeContentProgramId)) {
      setActiveContentProgramId(PRIMARY_CONTENT_PROGRAM_ID);
    }
  }, [activeContentProgramId, contentProgramViews, selectedEvent]);

  const updateContentProgram = (programId: string, patch: Partial<EventContentProgram>) => {
    if (!selectedEvent || !onUpdateEvent) return;
    if (programId === PRIMARY_CONTENT_PROGRAM_ID) {
      const primaryPatch = {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.date !== undefined ? { date: patch.date } : {}),
        ...(patch.sessions !== undefined ? { sessions: patch.sessions } : {}),
        updatedAt: new Date().toISOString()
      };
      onUpdateEvent(selectedEvent.id, {
        primaryContentProgram: {
          ...(selectedEvent.primaryContentProgram || {}),
          ...primaryPatch
        }
      });
      return;
    }
    const nextPrograms = (selectedEvent.contentPrograms || []).map(program =>
      program.id === programId
        ? { ...program, ...patch, updatedAt: new Date().toISOString() }
        : program
    );
    onUpdateEvent(selectedEvent.id, { contentPrograms: nextPrograms });
  };

  const removeContentProgram = (programId: string) => {
    if (!selectedEvent || !onUpdateEvent || programId === PRIMARY_CONTENT_PROGRAM_ID) return;
    if (!window.confirm('Xóa chương trình nội dung này? Hồ sơ và hậu cần chung của sự kiện vẫn được giữ.')) return;
    const nextPrograms = (selectedEvent.contentPrograms || []).filter(program => program.id !== programId);
    onUpdateEvent(selectedEvent.id, { contentPrograms: nextPrograms });
    setActiveContentProgramId(PRIMARY_CONTENT_PROGRAM_ID);
  };

  const toggleContentProgramSession = (program: ContentProgramView, session: EventSession) => {
    const current = program.sessions && program.sessions.length > 0 ? program.sessions : getProgramDefaultSessions(selectedEvent!);
    const next = current.includes(session)
      ? current.filter(item => item !== session)
      : [...current, session];
    updateContentProgram(program.id, { sessions: next.length > 0 ? next : [session] });
  };

  const persistActiveContentUpdates = (updates: Partial<Event>) => {
    if (!selectedEvent || !onUpdateEvent || !activeContentProgram) return;
    if (activeContentProgram.isPrimary) {
      onUpdateEvent(selectedEvent.id, updates);
      return;
    }

    const rootUpdates: Partial<Event> = {};
    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'layout' && key !== 'houseOperation') {
        (rootUpdates as any)[key] = value;
      }
    });

    const nextPrograms = (selectedEvent.contentPrograms || []).map(program => {
      if (program.id !== activeContentProgram.id) return program;
      return {
        ...program,
        ...('layout' in updates ? { layout: updates.layout } : {}),
        ...('houseOperation' in updates ? { houseOperation: updates.houseOperation } : {}),
        updatedAt: new Date().toISOString()
      };
    });
    onUpdateEvent(selectedEvent.id, { ...rootUpdates, contentPrograms: nextPrograms });
  };

  const handleUpdateActiveContentEvent = (eventId: string, updates: Partial<Event>) => {
    if (!selectedEvent || eventId !== selectedEvent.id) {
      onUpdateEvent?.(eventId, updates);
      return;
    }
    persistActiveContentUpdates(updates);
  };

  const createContentProgramClone = () => {
    if (!selectedEvent || !onUpdateEvent) return;
    const sourceProgram = activeContentProgram || contentProgramViews[0];
    const sourceEvent = activeContentEvent || selectedEvent;
    const now = new Date().toISOString();
    const id = makeEventManagerId('content-program');
    const clone: EventContentProgram = {
      id,
      name: `Chương trình ${contentProgramViews.length + 1}`,
      description: `Clone từ ${sourceProgram?.name || 'chương trình chính'}`,
      date: sourceProgram?.date || getProgramDefaultDate(selectedEvent),
      sessions: sourceProgram?.sessions && sourceProgram.sessions.length > 0
        ? [...sourceProgram.sessions]
        : getProgramDefaultSessions(sourceEvent),
      layout: clonePlain(sourceEvent.layout || { floorplanImage: '', blocks: [] }),
      houseOperation: sourceEvent.houseOperation ? clonePlain(sourceEvent.houseOperation) : undefined,
      createdAt: now,
      updatedAt: now
    };
    onUpdateEvent(selectedEvent.id, { contentPrograms: [...(selectedEvent.contentPrograms || []), clone] });
    setDetailSection('PROGRAM_CONTENT');
    setDetailTab('EH_CONTROL');
    setActiveContentProgramId(id);
    setIsContentProgramEditorOpen(true);
  };

  const todayKey = getLocalDateKey();

  const groupedEventsByMonth = useMemo(() => {
    const buckets: Record<string, Event[]> = {};
    const pastBuckets: Record<string, Event[]> = {};
    const others: Event[] = [];
    const pastOthers: Event[] = [];
    events.forEach(ev => {
      const primary = getEventPrimaryDate(ev);
      if (!primary) {
        if (isEventPast(ev, todayKey)) pastOthers.push(ev);
        else others.push(ev);
        return;
      }
      const parsed = new Date(primary);
      const key = Number.isNaN(parsed.getTime())
        ? primary.slice(0, 7)
        : `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
      const target = isEventPast(ev, todayKey) ? pastBuckets : buckets;
      if (!target[key]) target[key] = [];
      target[key].push(ev);
    });
    const makeGroups = (source: Record<string, Event[]>, past = false) => Object.keys(source)
      .sort((a, b) => past ? b.localeCompare(a) : a.localeCompare(b))
      .map(key => ({
        key,
        label: formatMonthLabel(key),
        isPast: past,
        events: source[key].sort((a, b) => {
          const da = getEventPrimaryDate(a) || '';
          const db = getEventPrimaryDate(b) || '';
          return past ? db.localeCompare(da) : da.localeCompare(db);
        })
      }));
    const groups = makeGroups(buckets);
    if (others.length) {
      groups.push({ key: 'others', label: 'Khác', isPast: false, events: others });
    }
    const pastGroups = makeGroups(pastBuckets, true);
    if (pastOthers.length) {
      pastGroups.push({ key: 'past-others', label: 'Khác', isPast: true, events: pastOthers });
    }
    return { upcoming: groups, past: pastGroups };
  }, [events, todayKey]);
  const timelineEntries = useMemo<EventTimelineEntry[]>(() => {
    if (!selectedEvent?.timeline) return [];
    return [...selectedEvent.timeline].sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));
  }, [selectedEvent]);
  const groupedTimeline = useMemo<Record<EventTimelinePhase, EventTimelineEntry[]>>(() => {
    const groups: Record<EventTimelinePhase, EventTimelineEntry[]> = { BEFORE: [], DURING: [], AFTER: [] };
    timelineEntries.forEach(entry => {
      const key = entry.phase || 'BEFORE';
      const safeKey = (['BEFORE', 'DURING', 'AFTER'].includes(key) ? key : 'BEFORE') as EventTimelinePhase;
      groups[safeKey].push(entry);
    });
    return groups;
  }, [timelineEntries]);
  const activeEmployees = useMemo(
    () => employees.filter(emp => !emp.inactive),
    [employees]
  );
  const eventStaffRegistrations = useMemo(
    () => (selectedEvent?.staffRegistrations || []).filter(item => item.status !== 'CANCELLED'),
    [selectedEvent?.staffRegistrations]
  );
  const registeredEmployeeIds = useMemo(
    () => new Set(eventStaffRegistrations.map(item => item.employeeId)),
    [eventStaffRegistrations]
  );
  const registeredStaffRows = useMemo(
    () => eventStaffRegistrations.map(registration => ({
      registration,
      employee: employees.find(emp => emp.id === registration.employeeId)
    })),
    [employees, eventStaffRegistrations]
  );
  const currentEmployee = useMemo(
    () => currentEmployeeId ? employees.find(emp => emp.id === currentEmployeeId) : undefined,
    [currentEmployeeId, employees]
  );
  const currentStaffRegistration = useMemo(
    () => eventStaffRegistrations.find(item =>
      (currentEmployeeId && item.employeeId === currentEmployeeId) ||
      (currentUserId && item.userId === currentUserId)
    ),
    [currentEmployeeId, currentUserId, eventStaffRegistrations]
  );
  const isCurrentUserRegisteredForEvent = (event?: Event) =>
    !!event?.staffRegistrations?.some(item =>
      item.status !== 'CANCELLED' &&
      (
        (currentEmployeeId && item.employeeId === currentEmployeeId) ||
        (currentUserId && item.userId === currentUserId)
      )
    );
  const selectedEventIsPast = selectedEvent ? isEventPast(selectedEvent, todayKey) : false;
  const sortRegisteredEmployeesFirst = (list: Employee[]) =>
    [...list].sort((a, b) => {
      const aRegistered = registeredEmployeeIds.has(a.id) ? 0 : 1;
      const bRegistered = registeredEmployeeIds.has(b.id) ? 0 : 1;
      return aRegistered - bRegistered || a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' });
    });
  const staffSearch = staffSearchTerm.trim().toLowerCase();
  const assignableEmployees = useMemo(() => {
    const filtered = !staffSearch ? activeEmployees : activeEmployees.filter(emp =>
      emp.name.toLowerCase().includes(staffSearch) ||
      (emp.role || '').toLowerCase().includes(staffSearch) ||
      emp.phone.includes(staffSearch)
    );
    return sortRegisteredEmployeesFirst(filtered);
  }, [activeEmployees, registeredEmployeeIds, staffSearch]);

  useEffect(() => {
    setSelectedItemIds([]);
    setAdvanceTitle('');
    setAdvanceNote('');
    setAdvanceAmount('');
    cancelEditAdvanceRequest();
    setSplitAutoStaffSlotKeys(new Set());
  }, [selectedEvent]);
  useEffect(() => {
    if (eventScreenMode !== 'HOME' && !selectedEvent) {
      setEventScreenMode('HOME');
    }
  }, [eventScreenMode, selectedEvent]);
  useEffect(() => {
    if (!selectedEvent) {
      setTimelineDatetime('');
      setTimelineNote('');
      return;
    }
    const schedule = getEventSchedule(selectedEvent);
    const firstDate = schedule[0]?.date || selectedEvent.startDate || '';
    setTimelinePhase('BEFORE');
    setTimelineNote('');
    setEditingTimelineId(null);
    setTimelineDatetime(firstDate ? `${firstDate}T08:00` : '');
  }, [selectedEvent, selectedEventId]);

  useEffect(() => {
    if (!selectedEvent || !onUpdateEvent || !canEdit) return;
    const profile = selectedEvent.eventProfile || {};
    const updates: Partial<EventProfile> = {};
    const schedule = getEventSchedule(selectedEvent);
    const defaultSession = (profile.programSession || schedule[0]?.sessions?.[0] || selectedEvent.session || 'MORNING') as EventSession;
    const defaultTimeRange = getDefaultProfileTimeRange(defaultSession);
    if (!profile.code) {
      updates.code = generateEventCode(selectedEvent.startDate || selectedEvent.endDate || new Date().toISOString().slice(0, 10));
    }
    if (!profile.organization && selectedEvent.client) {
      updates.organization = selectedEvent.client;
    }
    if (!profile.programSession) {
      updates.programSession = defaultSession;
    }
    if (!profile.programTimeStart) {
      updates.programTimeStart = defaultTimeRange.start;
    }
    if (!profile.programTimeEnd) {
      updates.programTimeEnd = defaultTimeRange.end;
    }
    if (!profile.addressDetail && selectedEvent.location) {
      updates.addressDetail = selectedEvent.location;
    }
    if (Object.keys(updates).length > 0) {
      onUpdateEvent(selectedEvent.id, { eventProfile: { ...profile, ...updates } });
    }
  }, [selectedEvent, onUpdateEvent, canEdit]);

  useEffect(() => {
    if (!selectedEvent) {
      setAdvancePaidAmountInput('');
      setAdvancePaidDateInput('');
      setAdvancePaidConfirmed(false);
      setAdvanceRefundedConfirmed(false);
      setPaymentCompleted(false);
      setAdvanceSkipped(false);
      return;
    }
    const hasAmount = typeof selectedEvent.advancePaidAmount === 'number' && Number.isFinite(selectedEvent.advancePaidAmount);
    setAdvancePaidAmountInput(hasAmount ? selectedEvent.advancePaidAmount.toString() : '');
    setAdvancePaidDateInput(selectedEvent.advancePaidDate || '');
    setAdvancePaidConfirmed(!!selectedEvent.advancePaidConfirmed);
    setAdvanceRefundedConfirmed(!!selectedEvent.advanceRefundedConfirmed);
    setPaymentCompleted(!!selectedEvent.paymentCompleted);
    setAdvanceSkipped(!!selectedEvent.advanceSkipped);
  }, [selectedEvent]);

  const handleCreateEventSubmit = () => {
    if (!newEventData.name || !newEventData.client || newEventSchedule.length === 0) {
      alert("Vui lòng điền đủ thông tin sự kiện!");
      return;
    }
    const sortedSchedule = [...newEventSchedule].sort((a, b) => a.date.localeCompare(b.date));
    const startDate = sortedSchedule[0].date;
    const endDate = sortedSchedule[sortedSchedule.length - 1].date;
    const primarySession = sortedSchedule[0].sessions?.[0] || 'MORNING';
    const defaultTimeRange = getDefaultProfileTimeRange(primarySession);
    const newEvent: Event = {
      id: `EVT-${Date.now()}`,
      name: newEventData.name,
      client: newEventData.client,
      location: newEventData.location,
      organizationVenue: newEventData.organizationVenue,
      startDate,
      endDate,
      session: primarySession,
      schedule: sortedSchedule.map(s => ({ date: s.date, sessions: s.sessions })),
      status: EventStatus.UPCOMING,
      items: [],
      staff: [],
      expenses: [],
      advanceRequests: [],
      advancePaidAmount: 0,
      advancePaidDate: '',
      advancePaidConfirmed: false,
      advanceRefundedConfirmed: false,
      paymentCompleted: false,
      advanceSkipped: false,
      eventProfile: {
        code: generateEventCode(startDate),
        organization: newEventData.client,
        programSession: primarySession,
        programTimeStart: defaultTimeRange.start,
        programTimeEnd: defaultTimeRange.end,
        addressDetail: newEventData.location
      },
      timeline: [],
      layout: {
        floorplanImage: '',
        floorplanAspectRatio: undefined,
        blocks: []
      }
    };
    onCreateEvent(newEvent);
    setShowCreateEventModal(false);
    setNewEventData({ name: '', client: '', location: '', organizationVenue: 'EH' });
    setNewEventSchedule([]);
    setNewScheduleDate('');
    setSelectedEventId(newEvent.id);
    setEventScreenMode('DETAIL');
  };

  const handleConfirmDeleteEvent = () => {
    if (!selectedEvent || !onDeleteEvent) return;
    if (!isAdmin) {
      alert('Chỉ ADMIN được phép xóa sự kiện.');
      return;
    }
    const fallbackId = events.find(ev => ev.id !== selectedEvent.id)?.id || null;
    onDeleteEvent(selectedEvent.id);
    setShowDeleteConfirm(false);
    setSelectedEventId(fallbackId);
    setSelectedItemIds([]);
    setEventScreenMode('HOME');
  };

  const handleAddScheduleDate = () => {
    if (!newScheduleDate) return;
    if (newEventSchedule.some(item => item.date === newScheduleDate)) {
      return;
    }
    setNewEventSchedule(prev => [...prev, { date: newScheduleDate, sessions: ['MORNING'] }]);
    setNewScheduleDate('');
  };

  const toggleScheduleSession = (date: string, session: EventSession) => {
    setNewEventSchedule(prev => prev.map(item => {
      if (item.date !== date) return item;
      const has = item.sessions.includes(session);
      return { ...item, sessions: has ? item.sessions.filter(s => s !== session) : [...item.sessions, session] };
    }));
  };

  const handleRemoveScheduleDate = (date: string) => {
    setNewEventSchedule(prev => prev.filter(item => item.date !== date));
  };

  const handleCalendarMonthChange = (delta: number) => {
    setCalendarView(prev => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const resetCalendarToCurrentMonth = () => {
    const now = new Date();
    setCalendarView({ year: now.getFullYear(), month: now.getMonth() });
  };

  const openEventDetail = (eventId: string) => {
    setSelectedEventId(eventId);
    setEventScreenMode(isAdmin ? 'DETAIL' : 'DASHBOARD');
  };

  const formatTimelineDatetime = (value: string) => {
    if (!value) return 'Chưa chọn thời gian';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short', hour12: false });
  };

  const handleAddTimelineEntry = () => {
    if (!selectedEvent || !onUpdateEvent) return;
    if (!timelineDatetime) {
      alert('Vui lòng chọn ngày giờ cho mốc timeline.');
      return;
    }
    if (!timelineNote.trim()) {
      alert('Vui lòng nhập nội dung cần thực hiện.');
      return;
    }
    if (editingTimelineId) {
      const current = (selectedEvent.timeline || []).find(entry => entry.id === editingTimelineId);
      if (!current) {
        setEditingTimelineId(null);
        return;
      }
      const nextTimeline = (selectedEvent.timeline || []).map(entry =>
        entry.id === editingTimelineId
          ? {
            ...entry,
            phase: timelinePhase,
            datetime: timelineDatetime,
            note: timelineNote.trim(),
            source: 'MANUAL' as const
          }
          : entry
      ).sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));
      onUpdateEvent(selectedEvent.id, { timeline: nextTimeline });
      setEditingTimelineId(null);
      setTimelineNote('');
      return;
    }
    const entry: EventTimelineEntry = {
      id: `TL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      phase: timelinePhase,
      datetime: timelineDatetime,
      note: timelineNote.trim(),
      source: 'MANUAL'
    };
    const nextTimeline = [...(selectedEvent.timeline || []), entry].sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));
    onUpdateEvent(selectedEvent.id, { timeline: nextTimeline });
    setTimelineNote('');
  };

  const handleEditTimelineEntry = (entry: EventTimelineEntry) => {
    if (!canEdit) return;
    setEditingTimelineId(entry.id);
    setTimelinePhase(entry.phase || 'BEFORE');
    setTimelineDatetime(entry.datetime || '');
    setTimelineNote(entry.note || '');
  };

  const handleCancelTimelineEdit = () => {
    if (!selectedEvent) return;
    const schedule = getEventSchedule(selectedEvent);
    const firstDate = schedule[0]?.date || selectedEvent.startDate || '';
    setEditingTimelineId(null);
    setTimelinePhase('BEFORE');
    setTimelineNote('');
    setTimelineDatetime(firstDate ? `${firstDate}T08:00` : '');
  };

  const handleRemoveTimelineEntry = (entryId: string) => {
    if (!selectedEvent || !onUpdateEvent) return;
    const nextTimeline = (selectedEvent.timeline || []).filter(entry => entry.id !== entryId);
    onUpdateEvent(selectedEvent.id, { timeline: nextTimeline });
  };

  const handleExportSubmit = () => {
    if (!selectedEventId) return;
    if (exportMode === 'SINGLE' && selectedItemForExport) {
      onExportToEvent(selectedEventId, selectedItemForExport, Number(exportQty));
    } else if (exportMode === 'COMBO' && selectedPackageId && onExportPackageToEvent) {
      onExportPackageToEvent(selectedEventId, selectedPackageId, Number(exportQty));
    } else {
      alert(exportMode === 'COMBO' ? 'Vui lòng chọn gói combo cần thêm.' : 'Vui lòng chọn thiết bị cần thêm.');
      return;
    }
    setShowExportModal(false);
    setSelectedItemForExport('');
    setSelectedPackageId('');
    setExportQty(1);
  };

  const handleSyncFromQuotation = () => {
    if (!selectedEventId || !linkedQuotation || !onSyncQuotation) return;
    
    if (window.confirm(`Hệ thống sẽ đồng bộ toàn bộ danh mục từ báo giá sang danh sách xuất kho. Tiếp tục?`)) {
      onSyncQuotation(selectedEventId, linkedQuotation.id);
      alert(`Đã thực hiện đồng bộ báo giá vào danh sách xuất kho!`);
    }
  };

  const handleSyncFromHouseOperation = () => {
    if (!selectedEvent || !onUpdateEvent) return;
    const stations = activeContentEvent?.houseOperation?.stations || [];
    const targetMap = new Map<string, number>();
    stations.forEach(station => {
      (station.equipment || []).forEach(item => {
        if (!item.itemId) return;
        targetMap.set(item.itemId, (targetMap.get(item.itemId) || 0) + (Number(item.quantity) || 0));
      });
    });
    if (targetMap.size === 0) {
      alert('EH OS chưa có thiết bị kho trong Program Canvas/Knowledge để đồng bộ.');
      return;
    }
    const existingMap = new Map(selectedEvent.items.map(item => [item.itemId, item]));
    const nextItems = selectedEvent.items.filter(item => !targetMap.has(item.itemId));
    targetMap.forEach((quantity, itemId) => {
      const existing = existingMap.get(itemId);
      nextItems.push({
        itemId,
        quantity,
        returnedQuantity: Math.min(existing?.returnedQuantity || 0, quantity),
        done: existing?.done
      });
    });
    onUpdateEvent(selectedEvent.id, { items: nextItems });
    alert(`Đã đồng bộ ${targetMap.size} thiết bị từ ${activeContentProgram?.name || 'EH OS'} sang sự kiện.`);
  };

  const handleCreateOrder = () => {
    if (!selectedEventId) return;
    if (onFinalizeOrder) {
      onFinalizeOrder(selectedEventId);
      setShowPrintModal(true);
    }
  };

  const handleStaffAssignSubmit = () => {
    if (!selectedEventId || !selectedStaffId || !staffTask || !staffRate || !onAssignStaff) {
      alert("Vui lòng nhập đầy đủ thông tin nhân sự!");
      return;
    }
    const sessionList = selectedSessions.slice(0, 2);
    if (!selectedShiftDate || sessionList.length === 0) {
      alert('Vui lòng chọn ngày và tối thiểu 1 ca trước khi phân công.');
      return;
    }
    const rate = Number(staffRate);
    const qty = staffUnit === 'FIXED' ? 1 : Number(staffQty);
    // Kiểm tra trùng lịch: cùng ngày và cùng ca (so với tất cả các sự kiện)
    const conflicts = events.flatMap(e => (e.staff || [])
      .filter(s => s.employeeId === selectedStaffId && s.shiftDate === selectedShiftDate)
      .filter(s => {
        const existingSessions = getStaffSessions(s);
        return existingSessions.some(sess => sessionList.includes(sess));
      })
      .map(s => ({ event: e, staff: s }))
    );
    // If conflict found (exclude assigning same person twice to same event/shift)
    const conflictingOther = conflicts.filter(c => c.event.id !== selectedEventId);
    if (conflictingOther.length > 0) {
      const list = conflictingOther.map(c => `${c.event.name} (${c.event.startDate})`).join('\n');
      alert(`Nhân sự đã bị phân công trùng ca vào ngày này:\n${list}\n\nVui lòng chọn ca khác hoặc nhân sự khác.`);
      return;
    }

    const computedHours = staffUnit === 'HOUR'
      ? getStaffWorkHours(sessionList)
      : Number(staffQty);
    const calculated = staffUnit === 'HOUR'
      ? calculateStaffCompensation(computedHours, rate).total
      : staffUnit === 'FIXED'
        ? rate
        : Math.min(STAFF_DAILY_CAP * qty, rate * qty);

    onAssignStaff(selectedEventId, {
      id: makeEventManagerId('staff'),
      employeeId: selectedStaffId,
      task: staffTask,
      unit: staffUnit,
      quantity: staffUnit === 'HOUR' ? computedHours : qty,
      rate: rate,
      salary: calculated,
      session: sessionList[0],
      sessions: sessionList,
      shiftDate: selectedShiftDate || undefined,
      source: 'MANUAL'
    });
    setSelectedStaffId('');
    setStaffSearchTerm('');
    setStaffTask('');
    setStaffRate(String(STAFF_HOURLY_RATE));
    setStaffQty(4);
    setSelectedShiftDate(null);
    setSelectedSessions([]);
  };

  const findStaffScheduleConflict = (employeeId: string, date: string, sessions: EventSession[], ignoreAutoKey?: string) => {
    return events.flatMap(event => (event.staff || [])
      .filter(staff => staff.employeeId === employeeId && staff.shiftDate === date && staff.autoKey !== ignoreAutoKey)
      .filter(staff => getStaffSessions(staff).some(session => sessions.includes(session)))
      .map(staff => ({ event, staff }))
    );
  };

  const assignEmployeeToStaffSlot = (slot: AutoStaffSlot, employeeId: string) => {
    if (!selectedEvent || !onUpdateEvent || !canEdit) return;
    const currentStaff = selectedEvent.staff || [];
    if (!employeeId) {
      onUpdateEvent(selectedEvent.id, { staff: currentStaff.filter(staff => staff.autoKey !== slot.key) });
      return;
    }
    const employee = activeEmployees.find(emp => emp.id === employeeId);
    if (!employee) return;
    const alreadyAssignedToSlot = currentStaff.some(staff => staff.autoKey === slot.key && staff.employeeId === employeeId);
    if (alreadyAssignedToSlot) return;
    const conflicts = findStaffScheduleConflict(employeeId, slot.date, slot.sessions, slot.key)
      .filter(conflict => conflict.event.id !== selectedEvent.id || conflict.staff.autoKey !== slot.key);
    if (conflicts.length > 0) {
      const list = conflicts.map(conflict => `${conflict.event.name} (${conflict.staff.task})`).join('\n');
      alert(`Nhân sự đã bị phân công trùng ca:\n${list}\n\nVui lòng chọn nhân sự khác hoặc điều chỉnh ca.`);
      return;
    }
    const allocation: EventStaffAllocation = {
      id: makeEventManagerId('staff-slot'),
      employeeId,
      task: `${slot.programName ? `${slot.programName} • ` : ''}Phụ trách trạm ${slot.station.name}`,
      unit: 'HOUR',
      quantity: slot.hours,
      rate: STAFF_HOURLY_RATE,
      salary: slot.salary,
      session: slot.sessions[0],
      sessions: slot.sessions,
      shiftDate: slot.date,
      stationId: slot.station.id,
      stationName: slot.station.name,
      source: AUTO_STAFF_SLOT_SOURCE,
      autoKey: slot.key,
      done: false
    };
    onUpdateEvent(selectedEvent.id, { staff: [...currentStaff, allocation] });
  };

  const removeEmployeeFromStaffSlot = (slot: AutoStaffSlot, staffId: string) => {
    if (!selectedEvent || !onUpdateEvent || !canEdit) return;
    const nextStaff = (selectedEvent.staff || []).filter(staff =>
      !(staff.autoKey === slot.key && (staff.id || '') === staffId)
    );
    onUpdateEvent(selectedEvent.id, { staff: nextStaff });
  };

  const splitStaffSlotBySession = (slot: AutoStaffSlot) => {
    if (!selectedEvent || !canEdit) return;
    if (slot.sessions.length <= 1) return;
    setSplitAutoStaffSlotKeys(prev => {
      const next = new Set(prev);
      next.add(slot.baseKey);
      return next;
    });
    if (slot.assigned.length === 0 || !onUpdateEvent) return;
    const firstSession = slot.sessions[0];
    const firstKey = getStaffSlotAutoKey(slot.station.id, slot.date, [firstSession], slot.programId);
    const hours = getStaffWorkHours([firstSession]);
    const compensation = calculateStaffCompensation(hours);
    const nextStaff = (selectedEvent.staff || []).map(staff => staff.autoKey === slot.key ? {
      ...staff,
      id: staff.id || makeEventManagerId('staff-slot'),
      task: `${slot.programName ? `${slot.programName} • ` : ''}Phụ trách trạm ${slot.station.name}`,
      unit: 'HOUR' as const,
      quantity: hours,
      rate: STAFF_HOURLY_RATE,
      salary: compensation.total,
      session: firstSession,
      sessions: [firstSession],
      shiftDate: slot.date,
      stationId: slot.station.id,
      stationName: slot.station.name,
      source: AUTO_STAFF_SLOT_SOURCE,
      autoKey: firstKey
    } : staff);
    onUpdateEvent(selectedEvent.id, { staff: nextStaff });
  };

  const handleAddExpenseSubmit = () => {
    if (!selectedEventId || !expenseAmount || !onAddExpense) {
      alert("Vui lòng nhập số tiền!");
      return;
    }
    onAddExpense(selectedEventId, {
      id: `EXP-${Date.now()}`,
      category: expenseCat,
      subCategory: expenseSub,
      description: expenseDesc || expenseCat,
      amount: Number(expenseAmount),
      vatInvoiceLink: expenseVatLink || undefined
    });
    setExpenseDesc('');
    setExpenseAmount('');
    setExpenseSub('');
    setExpenseVatLink('');
  };

  const handleAddAdvanceRequestSubmit = () => {
    if (!selectedEventId || !onAddAdvanceRequest) return;
    if (!advanceTitle.trim()) {
      alert('Vui lòng nhập hạng mục tạm ứng.');
      return;
    }
    const parsedAmount = Number(advanceAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      alert('Số tiền tạm ứng không hợp lệ.');
      return;
    }
    const payload: EventAdvanceRequest = {
      id: `ADV-${Date.now()}`,
      title: advanceTitle.trim(),
      note: advanceNote.trim() || undefined,
      amount: parsedAmount,
      createdAt: new Date().toISOString(),
      source: 'MANUAL'
    };
    onAddAdvanceRequest(selectedEventId, payload);
    setAdvanceTitle('');
    setAdvanceNote('');
    setAdvanceAmount('');
  };

  const beginEditAdvanceRequest = (request: EventAdvanceRequest) => {
    setEditingAdvanceId(request.id);
    setEditingAdvanceTitle(request.title);
    setEditingAdvanceNote(request.note || '');
    setEditingAdvanceAmount(String(request.amount || 0));
  };

  const cancelEditAdvanceRequest = () => {
    setEditingAdvanceId(null);
    setEditingAdvanceTitle('');
    setEditingAdvanceNote('');
    setEditingAdvanceAmount('');
  };

  const saveEditedAdvanceRequest = () => {
    if (!selectedEvent || !onUpdateEvent || !editingAdvanceId) return;
    if (!editingAdvanceTitle.trim()) {
      alert('Vui lòng nhập hạng mục tạm ứng.');
      return;
    }
    const parsedAmount = Number(editingAdvanceAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      alert('Số tiền tạm ứng không hợp lệ.');
      return;
    }
    const nextRequests = (selectedEvent.advanceRequests || []).map(request => {
      if (request.id !== editingAdvanceId) return request;
      return {
        ...request,
        title: editingAdvanceTitle.trim(),
        note: editingAdvanceNote.trim() || undefined,
        amount: parsedAmount,
        source: 'MANUAL' as const,
        autoKey: request.autoKey
      };
    });
    onUpdateEvent(selectedEvent.id, { advanceRequests: nextRequests });
    cancelEditAdvanceRequest();
  };

  const persistAdvancePaid = (updates: Partial<Event>) => {
    if (!selectedEvent || !onUpdateEvent) return;
    onUpdateEvent(selectedEvent.id, updates);
  };

  const handleAdvancePaidAmountChange = (value: string) => {
    if (advanceSkipped) return;
    setAdvancePaidAmountInput(value);
    if (value === '') return;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      persistAdvancePaid({ advancePaidAmount: parsed });
    }
  };

  const handleAdvancePaidAmountBlur = () => {
    if (!selectedEvent || !onUpdateEvent || advanceSkipped) return;
    const parsed = Number(advancePaidAmountInput);
    const normalized = Number.isFinite(parsed) ? parsed : 0;
    onUpdateEvent(selectedEvent.id, { advancePaidAmount: normalized });
    setAdvancePaidAmountInput(normalized.toString());
  };

  const handleAdvancePaidDateChange = (value: string) => {
    setAdvancePaidDateInput(value);
    if (advanceSkipped) return;
    persistAdvancePaid({ advancePaidDate: value });
  };

  const handleAdvancePaidConfirmedChange = (checked: boolean) => {
    setAdvancePaidConfirmed(checked);
    if (advanceSkipped) return;
    persistAdvancePaid({ advancePaidConfirmed: checked });
  };

  const handleAdvanceRefundedConfirmedChange = (checked: boolean) => {
    setAdvanceRefundedConfirmed(checked);
    persistAdvancePaid({ advanceRefundedConfirmed: checked });
  };

  const handlePaymentCompletedChange = (checked: boolean) => {
    setPaymentCompleted(checked);
    persistAdvancePaid({ paymentCompleted: checked });
  };

  const handleAdvanceSkippedChange = (checked: boolean) => {
    setAdvanceSkipped(checked);
    persistAdvancePaid({ advanceSkipped: checked });
  };

  const updateEventProfile = (patch: Partial<EventProfile>) => {
    if (!selectedEvent || !onUpdateEvent || !canEditProfile) return;
    onUpdateEvent(selectedEvent.id, { eventProfile: { ...(selectedEvent.eventProfile || {}), ...patch } });
  };

  const updateSchoolContact = (patch: Partial<NonNullable<EventProfile['schoolContact']>>) => {
    const current = eventProfile.schoolContact || { name: '' };
    updateEventProfile({ schoolContact: { ...current, ...patch } });
  };

  const toggleAudience = (aud: NonNullable<EventProfile['audience']>[number]) => {
    const current = eventProfile.audience || [];
    const next = current.includes(aud) ? current.filter(a => a !== aud) : [...current, aud];
    updateEventProfile({ audience: next });
  };

  const generateAiGoal = () => {
    if (!canEditProfile) return;
    const org = eventProfile.organization || selectedEvent?.client || 'đối tác';
    const type = getEventTypeLabel(eventProfile.eventType) || 'chương trình trải nghiệm';
    const audience = getAudienceLabels(eventProfile.audience) || 'học sinh và phụ huynh';
    const scale =
      eventProfile.attendanceMin !== undefined || eventProfile.attendanceMax !== undefined
        ? `quy mô ${eventProfile.attendanceMin ?? 0} - ${eventProfile.attendanceMax ?? 0} người`
        : 'quy mô phù hợp';
    const salesNote = salesScopeIsSelling
      ? ` thúc đẩy doanh thu mục tiêu ${eventProfile.saleRevenueTarget ? `${eventProfile.saleRevenueTarget.toLocaleString()}đ` : 'đã đặt'}.`
      : '.';
    const suggestion = `Tăng nhận diện ${org} qua ${type}, mang lại trải nghiệm học tập sáng tạo cho ${audience}, đảm bảo vận hành trơn tru ${scale} và xây dựng thiện cảm với nhà trường${salesNote}`;
    updateEventProfile({ generalGoal: suggestion });
  };

  const handleStaffSelect = (empId: string) => {
    setSelectedStaffId(empId);
    const emp = activeEmployees.find(e => e.id === empId);
    if (emp) {
      setStaffTask(emp.role);
      setStaffRate(emp.baseRate ? emp.baseRate.toString() : String(STAFF_HOURLY_RATE));
    }
  };

  const handleSessionToggle = (date: string, session: EventSession) => {
    if (selectedShiftDate !== date) {
      setSelectedShiftDate(date);
      setSelectedSessions([session]);
      if (staffUnit === 'HOUR') setStaffQty(getStaffWorkHours([session]));
      return;
    }
    setSelectedSessions(prev => {
      const exists = prev.includes(session);
      if (exists) {
        const next = prev.filter(s => s !== session);
        if (next.length === 0) setSelectedShiftDate(null);
        if (staffUnit === 'HOUR') setStaffQty(next.length > 0 ? getStaffWorkHours(next) : 4);
        return next;
      }
      if (prev.length >= 2) return prev;
      const next = [...prev, session];
      if (staffUnit === 'HOUR') setStaffQty(getStaffWorkHours(next));
      return next;
    });
  };

  const handleLinkQuotation = (qId: string) => {
    if (selectedEventId && onLinkQuotation) {
      onLinkQuotation(selectedEventId, qId);
    }
  };

  const toggleSelectedItem = (itemId: string, checked: boolean) => {
    setSelectedItemIds(prev => {
      if (checked) return Array.from(new Set([...prev, itemId]));
      return prev.filter(id => id !== itemId);
    });
  };

  const handleRemoveSelectedItems = () => {
    if (!selectedEventId || selectedItemIds.length === 0 || !onRemoveEventItems) return;
    const confirmMsg = `Xóa ${selectedItemIds.length} thiết bị khỏi danh sách order sự kiện?`;
    if (!window.confirm(confirmMsg)) return;
    onRemoveEventItems(selectedEventId, selectedItemIds);
    setSelectedItemIds([]);
  };

  const handleItemQuantityChange = (itemId: string, qty: number) => {
    if (!selectedEvent || !onUpdateEventItemQuantity) return;
    const numericQty = Number.isFinite(qty) ? qty : 0;
    const safeQty = Math.max(0, Math.round(numericQty));
    onUpdateEventItemQuantity(selectedEvent.id, itemId, safeQty);
  };



  const eventLayout: EventLayout = activeContentEvent?.layout || { floorplanImage: '', blocks: [] };

  const layoutPackageOptions = useMemo(() => {
    const options: { value: string; label: string; displayName: string; source: LayoutPackageSource; rawId: string }[] = [];
    if (linkedQuotation) {
      linkedQuotation.items.forEach(item => {
        options.push({
          value: `Q-${item.id}-${item.type}`,
          label: `${item.name} • Báo giá`,
          displayName: item.name,
          source: 'QUOTATION',
          rawId: item.id
        });
      });
    }
    packages.forEach(pkg => {
      const exists = options.some(opt => opt.rawId === pkg.id && opt.source === 'PACKAGE');
      if (!exists) {
        options.push({
          value: `PKG-${pkg.id}`,
          label: `${pkg.name} • ${packageTypeLabel(pkg)}`,
          displayName: pkg.name,
          source: 'PACKAGE',
          rawId: pkg.id
        });
      }
    });
    return options;
  }, [linkedQuotation, packages]);

  const persistLayout = (layout: EventLayout) => {
    if (!selectedEvent || !onUpdateEvent) return;
    persistActiveContentUpdates({ layout });
  };

  const handleFloorplanUpload = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : undefined;
        persistLayout({ ...eventLayout, floorplanImage: src, floorplanAspectRatio: ratio });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFloorplan = () => {
    persistLayout({ ...eventLayout, floorplanImage: '', floorplanAspectRatio: undefined });
  };

  const resetLayoutForm = () => {
    setLayoutForm({
      name: '',
      packageId: '',
      packageName: '',
      packageSource: 'QUOTATION',
      customPackageName: '',
      staffId: '',
      staffName: '',
      color: LAYOUT_COLORS[(eventLayout.blocks.length + 1) % LAYOUT_COLORS.length]
    });
    setEditingBlockId(null);
  };

  const handleSaveLayoutBlock = () => {
    if (!selectedEvent) return;
    if (!layoutForm.name.trim()) {
      alert('Vui lòng nhập tên trạm/khu vực.');
      return;
    }

    const packageName = layoutForm.packageSource === 'CUSTOM' ? layoutForm.customPackageName : layoutForm.packageName;
    const staffLabel = layoutForm.staffName || employees.find(e => e.id === layoutForm.staffId)?.name || '';

    if (editingBlockId) {
      updateLayoutBlock(editingBlockId, {
        name: layoutForm.name.trim(),
        packageId: layoutForm.packageSource === 'CUSTOM' ? undefined : layoutForm.packageId || undefined,
        packageName: packageName || undefined,
        packageSource: layoutForm.packageSource,
        staffId: layoutForm.staffId || undefined,
        staffName: staffLabel || undefined,
        color: layoutForm.color
      });
      setSelectedLayoutBlockId(editingBlockId);
      resetLayoutForm();
      return;
    }

    const newBlock: EventLayoutBlock = {
      id: `BLOCK-${Date.now()}`,
      name: layoutForm.name.trim(),
      packageId: layoutForm.packageSource === 'CUSTOM' ? undefined : layoutForm.packageId || undefined,
      packageName: packageName || undefined,
      packageSource: layoutForm.packageSource,
      staffId: layoutForm.staffId || undefined,
      staffName: staffLabel || undefined,
      color: layoutForm.color,
      x: clamp(8 + eventLayout.blocks.length * 3, 2, 78),
      y: clamp(8 + eventLayout.blocks.length * 3, 2, 78),
      width: 18,
      height: 12
    };

    persistLayout({ ...eventLayout, blocks: [...eventLayout.blocks, newBlock] });
    resetLayoutForm();
    setSelectedLayoutBlockId(newBlock.id);
  };

  const updateLayoutBlock = (blockId: string, updates: Partial<EventLayoutBlock>) => {
    const nextBlocks = eventLayout.blocks.map(block => block.id === blockId ? { ...block, ...updates } : block);
    persistLayout({ ...eventLayout, blocks: nextBlocks });
  };

  const handleRemoveLayoutBlock = (blockId: string) => {
    const nextBlocks = eventLayout.blocks.filter(block => block.id !== blockId);
    persistLayout({ ...eventLayout, blocks: nextBlocks });
    if (selectedLayoutBlockId === blockId) {
      setSelectedLayoutBlockId(null);
    }
  };

  const handleBlockDragStart = (e: React.MouseEvent, blockId: string) => {
    const container = (e.currentTarget as HTMLElement).closest('[data-layout-board]') as HTMLElement | null;
    if (!container) return;
    const block = eventLayout.blocks.find(b => b.id === blockId);
    if (!block) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = container.getBoundingClientRect();
    const offsetX = ((e.clientX - rect.left) / rect.width) * 100 - block.x;
    const offsetY = ((e.clientY - rect.top) / rect.height) * 100 - block.y;
    setDraggingBlock({ id: blockId, offsetX, offsetY, rect });
    setSelectedLayoutBlockId(blockId);
  };

  const handleResizeStart = (e: React.MouseEvent, blockId: string, direction: ResizeDirection) => {
    const container = (e.currentTarget as HTMLElement).closest('[data-layout-board]') as HTMLElement | null;
    if (!container) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = container.getBoundingClientRect();
    setResizingBlock({ id: blockId, direction, rect });
    setSelectedLayoutBlockId(blockId);
  };

  const handlePrintLayout = () => {
    if (!selectedEvent) return;
    const printWindow = window.open('', 'PRINT', 'width=1400,height=900');
    if (!printWindow) return;
    const ratio = eventLayout.floorplanAspectRatio || 16 / 9;
    const backgroundStyle = eventLayout.floorplanImage 
      ? `background-image:url(${eventLayout.floorplanImage});background-size:contain;background-repeat:no-repeat;background-position:center;`
      : `background:#0f172a;`;
    const blocksHtml = eventLayout.blocks.map(block => `
      <div style="
        position:absolute;
        left:${block.x}%;
        top:${block.y}%;
        width:${block.width}%;
        height:${block.height}%;
        border:2px solid ${block.color};
        background:${block.color}20;
        border-radius:12px;
        box-sizing:border-box;
        overflow:hidden;
      ">
        <div style="padding:12px;font-size:13px;font-weight:800;color:#0f172a;line-height:1.5;text-shadow:0 1px 3px rgba(0,0,0,0.65),0 0 1px #fff;">
          <div>${block.name}</div>
          ${block.packageName ? `<div style="font-size:12px;font-weight:700;margin-top:2px;text-shadow:0 1px 3px rgba(0,0,0,0.6),0 0 1px #fff;">${block.packageName}</div>` : ''}
          ${block.staffName ? `<div style="font-size:12px;font-weight:700;margin-top:2px;color:#0f172a;text-shadow:0 1px 3px rgba(0,0,0,0.6),0 0 1px #fff;">${block.staffName}</div>` : ''}
        </div>
      </div>
    `).join('');
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Sơ đồ trạm - ${selectedEvent.name}</title>
          <style>
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body style="margin:0;padding:24px;background:#0b1224;font-family:Arial, sans-serif;color:#fff;">
          <h2 style="margin:0 0 12px;font-size:20px;font-weight:900;">Sơ đồ trạm • ${selectedEvent.name}</h2>
          <p style="margin:0 0 16px;font-size:12px;color:#cbd5e1;">Kéo thả các block đại diện cho khu vực và nhân sự.</p>
          <div style="position:relative;width:100%;aspect-ratio:${ratio};max-height:820px;border:1px dashed #cbd5e1;border-radius:16px;${backgroundStyle}overflow:hidden;">
            ${blocksHtml}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const rect = draggingBlock?.rect || resizingBlock?.rect;
      if (!rect) return;
      const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
      const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

      if (draggingBlock) {
        const block = eventLayout.blocks.find(b => b.id === draggingBlock.id);
        if (!block) return;
        const newX = clamp(xPercent - draggingBlock.offsetX, 0, 100 - block.width);
        const newY = clamp(yPercent - draggingBlock.offsetY, 0, 100 - block.height);
        updateLayoutBlock(block.id, { x: newX, y: newY });
      } else if (resizingBlock) {
        const block = eventLayout.blocks.find(b => b.id === resizingBlock.id);
        if (!block) return;
        const minSize = 6;
        let nextX = block.x;
        let nextY = block.y;
        let nextW = block.width;
        let nextH = block.height;

        if (resizingBlock.direction.includes('right')) {
          nextW = clamp(xPercent - nextX, minSize, 100 - nextX);
        }
        if (resizingBlock.direction.includes('left')) {
          const newX = clamp(xPercent, 0, nextX + nextW - minSize);
          nextW = nextW + (nextX - newX);
          nextX = newX;
        }
        if (resizingBlock.direction.includes('bottom')) {
          nextH = clamp(yPercent - nextY, minSize, 100 - nextY);
        }
        if (resizingBlock.direction.includes('top')) {
          const newY = clamp(yPercent, 0, nextY + nextH - minSize);
          nextH = nextH + (nextY - newY);
          nextY = newY;
        }
        updateLayoutBlock(block.id, { x: nextX, y: nextY, width: nextW, height: nextH });
      }
    };

    const handleMouseUp = () => {
      if (draggingBlock) setDraggingBlock(null);
      if (resizingBlock) setResizingBlock(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingBlock, resizingBlock, eventLayout.blocks]);

  useEffect(() => {
    setSelectedLayoutBlockId(null);
    setDraggingBlock(null);
    setResizingBlock(null);
    setShowLayoutFullscreen(false);
    setEditingBlockId(null);
    setShowDeleteConfirm(false);
    setLayoutForm(prev => ({
      ...prev,
      name: '',
      customPackageName: '',
      staffId: '',
      staffName: ''
    }));
  }, [selectedEventId, activeContentProgramId]);

  const renderLayoutBoard = (variant: 'main' | 'fullscreen') => {
    const ratio = eventLayout.floorplanAspectRatio || 16 / 9;
    return (
      <div 
        data-layout-board={variant}
        className={`relative rounded-2xl border border-dashed border-slate-300 bg-slate-900/60 overflow-hidden w-full ${variant === 'fullscreen' ? '' : 'max-h-[560px]'}`}
        style={{
          backgroundImage: eventLayout.floorplanImage ? `url(${eventLayout.floorplanImage})` : undefined,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          aspectRatio: `${ratio}`
        }}
      >
        {!eventLayout.floorplanImage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-slate-200 p-6">
            <MapPin size={48} className="mb-3 opacity-70" />
            <p className="font-black text-lg">Tải ảnh mặt bằng để bắt đầu</p>
            <p className="text-sm text-slate-300 max-w-xl">Sau khi tải ảnh, hãy kéo từng block sang và điều chỉnh kích thước bằng cách kéo ở cạnh hoặc góc.</p>
          </div>
        )}

        {eventLayout.blocks.map(block => (
          <div
            key={block.id}
            className={`absolute rounded-lg border shadow-lg transition cursor-move ${selectedLayoutBlockId === block.id ? 'ring-2 ring-blue-500' : ''}`}
            onMouseDown={e => handleBlockDragStart(e, block.id)}
            style={{
              left: `${block.x}%`,
              top: `${block.y}%`,
              width: `${block.width}%`,
              height: `${block.height}%`,
              borderColor: block.color,
              backgroundColor: `${block.color}1A`
            }}
          >
            <div className="absolute inset-0 p-2 pointer-events-none space-y-1">
              <p className="text-xs font-black text-slate-900 flex items-center gap-1" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.65), 0 0 1px #fff' }}>
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: block.color }}></span>
                {block.name}
              </p>
              {block.packageName && <p className="text-[11px] font-semibold text-slate-800 leading-tight" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6), 0 0 1px #fff' }}>{block.packageName}</p>}
              {block.staffName && <p className="text-[11px] text-blue-900 font-semibold leading-tight" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6), 0 0 1px #fff' }}>{block.staffName}</p>}
            </div>

            <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border border-slate-300 rounded cursor-e-resize" onMouseDown={e => handleResizeStart(e, block.id, 'right')}></div>
            <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border border-slate-300 rounded cursor-w-resize" onMouseDown={e => handleResizeStart(e, block.id, 'left')}></div>
            <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-3 h-3 bg-white border border-slate-300 rounded cursor-n-resize" onMouseDown={e => handleResizeStart(e, block.id, 'top')}></div>
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-3 h-3 bg-white border border-slate-300 rounded cursor-s-resize" onMouseDown={e => handleResizeStart(e, block.id, 'bottom')}></div>
            <div className="absolute -right-1 -top-1 w-3 h-3 bg-white border border-slate-300 rounded cursor-ne-resize" onMouseDown={e => handleResizeStart(e, block.id, 'top-right')}></div>
            <div className="absolute -left-1 -top-1 w-3 h-3 bg-white border border-slate-300 rounded cursor-nw-resize" onMouseDown={e => handleResizeStart(e, block.id, 'top-left')}></div>
            <div className="absolute -right-1 -bottom-1 w-3 h-3 bg-white border border-slate-300 rounded cursor-se-resize" onMouseDown={e => handleResizeStart(e, block.id, 'bottom-right')}></div>
            <div className="absolute -left-1 -bottom-1 w-3 h-3 bg-white border border-slate-300 rounded cursor-sw-resize" onMouseDown={e => handleResizeStart(e, block.id, 'bottom-left')}></div>
          </div>
        ))}
      </div>
    );
  };

  const calculateSaleOrderRevenue = (order: any) => {
    const items = order.items || [];
    const subtotal = items.reduce((sum: number, item: any) => {
      // Lấy số lượng đã bán nếu có, fallback sang số lượng xuất kho để phản ánh doanh thu thực mang đi
      const soldQty = item.soldQuantity ?? item.quantity ?? 0;
      const discount = item.discount || 0;
      const price = item.price || 0;
      const discountPercent = item.discountPercent || 0;
      const lineRevenue = Math.max(0, calcLineTotal(price, soldQty, discount, discountPercent));
      return sum + lineRevenue;
    }, 0);
    const orderDiscount = order.orderDiscount || 0;
    const computed = Math.max(0, subtotal - orderDiscount);
    if (computed > 0) return computed;
    const fallbackTotal = order.total ?? order.subtotal ?? 0;
    return Math.max(0, Number(fallbackTotal) || 0);
  };

  // Tài chính
  const advanceRequests = selectedEvent?.advanceRequests || [];
  const totalAdvanceAmount = advanceRequests.reduce((sum, req) => sum + (req.amount || 0), 0);
  const vatExpensesTotal = (selectedEvent?.expenses || []).filter(exp => exp.vatInvoiceLink).reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  const advancePaidAmountNumber = Number(advancePaidAmountInput || selectedEvent?.advancePaidAmount || 0) || 0;
  const advanceRefundAmount = advancePaidAmountNumber - vatExpensesTotal;
  const payableVatAmount = advanceSkipped ? Math.max(0, vatExpensesTotal) : Math.max(0, vatExpensesTotal - advancePaidAmountNumber);
  const salesScopeIsSelling = ['SELLING', 'LIGHT_ADVICE', 'CUSTOM'].includes(eventProfile.salesScope || '');
  const salesScopeLabel = useMemo(() => {
    const found = SALES_SCOPE_OPTIONS.find(opt => opt.value === eventProfile.salesScope);
    if (found?.value === 'CUSTOM' && eventProfile.salesScopeNote) return eventProfile.salesScopeNote;
    if (found) return found.label;
    if (eventProfile.salesScopeNote) return eventProfile.salesScopeNote;
    return 'Chưa cập nhật';
  }, [eventProfile.salesScope, eventProfile.salesScopeNote]);
  const eventDateLabel = useMemo(() => {
    if (!selectedEvent) return '';
    const schedule = getEventSchedule(selectedEvent);
    if (schedule.length === 0) return '';
    if (schedule.length === 1) return formatDateWithDay(schedule[0].date);
    const first = schedule[0];
    const last = schedule[schedule.length - 1];
    return `${formatDateWithDay(first.date)} → ${formatDateWithDay(last.date)}`;
  }, [selectedEvent]);
  const programTimeLabel = useMemo(() => {
    const timeRange = eventProfile.programTimeStart && eventProfile.programTimeEnd
      ? `${eventProfile.programTimeStart} - ${eventProfile.programTimeEnd}`
      : '';
    const sessionLabel = eventProfile.programSession ? SESSION_LABELS[eventProfile.programSession as EventSession] : '';
    return [timeRange, sessionLabel].filter(Boolean).join(' • ');
  }, [eventProfile.programSession, eventProfile.programTimeEnd, eventProfile.programTimeStart]);
  const staffCostGroups = useMemo(() => getStaffCostGroups(selectedEvent?.staff || []), [selectedEvent?.staff]);
  const staffCosts = staffCostGroups.reduce((sum, group) => sum + group.totalSalary, 0);
  const otherCosts = selectedEvent?.expenses?.reduce((a, b) => a + b.amount, 0) || 0;
  const totalCosts = staffCosts + otherCosts;
  const saleOrderRevenueTotal = linkedSaleOrders
    .filter(order => (order.type || 'SALE') !== 'RETURN')
    .reduce((sum, order) => sum + calculateSaleOrderRevenue(order), 0);
  const saleOrderReturnTotal = linkedSaleOrders
    .filter(order => (order.type || '') === 'RETURN')
    .reduce((sum, order) => sum + Math.abs(order.total || order.subtotal || 0), 0);
  const saleOrdersRevenue = Math.max(0, saleOrderRevenueTotal - saleOrderReturnTotal);
  const saleGoodsValue = saleOrdersRevenue;
  const quotationRevenue = linkedQuotation?.totalAmount || 0;
  const revenue = quotationRevenue + saleOrdersRevenue;
  const grossProfit = revenue - totalCosts;
  const profitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const eventProfileSummary = useMemo(() => {
    if (!selectedEvent) return [];
    const lines: string[] = [];
    lines.push(`Sự kiện: ${selectedEvent.name || 'Chưa đặt tên'}${eventProfile.code ? ` (${eventProfile.code})` : ''}`);
    const typeLabel = getEventTypeLabel(eventProfile.eventType);
    if (typeLabel) lines.push(`Loại sự kiện: ${typeLabel}`);
    if (eventProfile.organization) lines.push(`Đơn vị/Trường: ${eventProfile.organization}`);
    lines.push(`Thời gian: ${eventDateLabel || 'Chưa cập nhật'}${programTimeLabel ? ` • ${programTimeLabel}` : ''}`);
    const locationParts = [
      selectedEvent.location || '',
      eventProfile.addressDetail || '',
      eventProfile.setupArea ? `Khu vực: ${eventProfile.setupArea}` : ''
    ].filter(Boolean);
    lines.push(`Vị trí: ${locationParts.join(' • ') || 'Chưa cập nhật'}`);
    if (eventProfile.mapLink) lines.push(`Map: ${eventProfile.mapLink}`);
    lines.push(`Mục tiêu chung: ${eventProfile.generalGoal || 'Chưa cập nhật'}`);
    lines.push(`Phạm vi: ${salesScopeLabel}`);
    if (salesScopeIsSelling) {
      lines.push(`Giá trị hàng hóa mang đi: ${saleGoodsValue.toLocaleString()}đ`);
      if (eventProfile.saleRevenueTarget !== undefined) {
        lines.push(`Mục tiêu doanh thu: ${eventProfile.saleRevenueTarget.toLocaleString()}đ`);
      }
    }
    const aud = getAudienceLabels(eventProfile.audience);
    if (aud) lines.push(`Đối tượng: ${aud}`);
    if (eventProfile.attendanceMin !== undefined || eventProfile.attendanceMax !== undefined) {
      lines.push(`Quy mô dự kiến: ${eventProfile.attendanceMin ?? 0} - ${eventProfile.attendanceMax ?? 0} người`);
    }
    if (eventProfile.partnerOrg) lines.push(`Đơn vị phối hợp/BTC: ${eventProfile.partnerOrg}`);
    if (eventProfile.schoolContact && eventProfile.schoolContact.name) {
      const sc = eventProfile.schoolContact;
      const contactParts = [sc.phone, sc.zalo, sc.role].filter(Boolean).join(' • ');
      lines.push(`Đầu mối phía trường: ${sc.name}${contactParts ? ` (${contactParts})` : ''}`);
    }
    if (eventProfile.einsteinPic) lines.push(`PIC Einstein Bus: ${eventProfile.einsteinPic}`);
    lines.push(`Chi phí tổ chức dự kiến: ${totalCosts.toLocaleString()}đ`);
    lines.push(`Kế hoạch hành động (TIMELINE): ${timelineEntries.length} mốc`);
    return lines;
  }, [
    selectedEvent,
    eventProfile.code,
    eventProfile.eventType,
    eventProfile.organization,
    eventProfile.addressDetail,
    eventProfile.setupArea,
    eventProfile.generalGoal,
    eventProfile.mapLink,
    eventProfile.audience,
    eventProfile.attendanceMin,
    eventProfile.attendanceMax,
    eventProfile.partnerOrg,
    eventProfile.schoolContact,
    eventProfile.einsteinPic,
    eventProfile.saleRevenueTarget,
    eventDateLabel,
    programTimeLabel,
    salesScopeLabel,
    salesScopeIsSelling,
    saleGoodsValue,
    totalCosts,
    timelineEntries.length
  ]);
  const publicLiveBaseUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}`
    : '';
  const getDashboardLiveUrl = (programId: string) =>
    publicLiveBaseUrl
      ? `${publicLiveBaseUrl}?ehLive=${selectedEvent?.id || ''}&ehProgram=${encodeURIComponent(programId)}`
      : '';
  const dashboardMapUrl = eventProfile.mapLink
    || (selectedEvent?.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedEvent.location)}` : '');
  const dashboardEquipmentItems = selectedEvent
    ? selectedEvent.items.map(item => {
      const inv = inventory.find(it => it.id === item.itemId);
      return {
        ...item,
        name: inv?.name || item.itemId,
        category: inv?.category || '',
        quantity: Number(item.quantity) || 0
      };
    })
    : [];
  const dashboardIncidentCount = contentProgramViews.reduce(
    (sum, program) => sum + (program.houseOperation?.incidents?.filter(incident => incident.status === 'OPEN').length || 0),
    0
  );
  const dashboardStationCount = contentProgramViews.reduce(
    (sum, program) => sum + Math.max(program.houseOperation?.stations?.length || 0, program.layout?.blocks?.length || 0),
    0
  );
  const dashboardDoneTasks = contentProgramViews.reduce(
    (sum, program) => sum + (program.houseOperation?.tasks?.filter(task => task.status === 'DONE').length || 0),
    0
  );
  const dashboardTotalTasks = contentProgramViews.reduce(
    (sum, program) => sum + (program.houseOperation?.tasks?.length || 0),
    0
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-100px)]">
      {eventScreenMode === 'HOME' && (
        <div className="w-full lg:w-[360px] bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col h-auto lg:h-full overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="font-bold text-gray-800 text-lg">Sự kiện & Vận hành</h3>
              <p className="text-xs text-slate-500">Chọn sự kiện trước khi vào hậu cần hoặc nội dung</p>
            </div>
            {canEdit && (
              <button onClick={() => setShowCreateEventModal(true)} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                <Plus size={20} />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {events.length === 0 && <div className="text-center py-10 text-gray-400 italic text-sm">Chưa có sự kiện nào.</div>}
            {groupedEventsByMonth.upcoming.length > 0 && (
              <div className="space-y-3">
                <p className="text-[11px] font-black text-blue-500 uppercase tracking-widest">Sắp tới / đang diễn ra</p>
                {groupedEventsByMonth.upcoming.map(group => (
                  <div key={group.key} className="space-y-2">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{group.label}</p>
                    {group.events.map(event => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => openEventDetail(event.id)}
                        className={`w-full p-4 rounded-xl border-2 text-left transition ${selectedEventId === event.id ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-transparent bg-white border-slate-100 hover:border-slate-200'}`}
                      >
                        {(() => {
                          const schedule = getEventSchedule(event);
                          const uniqueSessions = Array.from(new Set(schedule.flatMap(item => item.sessions)));
                          const start = schedule[0]?.date || event.startDate;
                          const end = schedule[schedule.length - 1]?.date || event.endDate;
                          const venue = getEventVenue(event);
                          const venueTone = getEventVenueTone(venue);
                          const registeredByCurrentUser = isCurrentUserRegisteredForEvent(event);
                          return (
                            <>
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="font-bold text-gray-800 leading-snug">{event.name}</h4>
                                <span className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black ${venueTone.chip}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${venueTone.dot}`}></span>
                                  {getEventVenueShortLabel(venue)}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                <Calendar size={12}/> {start}{end && end !== start ? ` → ${end}` : ''}
                              </p>
                              <div className="mt-2 flex items-center gap-2 flex-wrap">
                                {uniqueSessions.map(session => (
                                  <div key={session} className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                                    {SESSION_LABELS[session]}
                                  </div>
                                ))}
                                {registeredByCurrentUser && (
                                  <div className="inline-flex items-center gap-1 text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-full">
                                    <UserCheck size={10}/> Đã đăng ký
                                  </div>
                                )}
                                {event.quotationId && <div className="inline-flex items-center gap-1 text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full"><LinkIcon size={10}/> Đã gắn báo giá</div>}
                                {event.advancePaidConfirmed && !event.advanceSkipped && (
                                  <div className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                                    <CheckCircle size={10}/> Đã tạm ứng
                                  </div>
                                )}
                                {event.advanceRefundedConfirmed && (
                                  <div className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                    <RefreshCw size={10}/> Đã hoàn ứng
                                  </div>
                                )}
                                {event.paymentCompleted && (
                                  <div className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-900 text-white px-2 py-0.5 rounded-full">
                                    <DollarSign size={10}/> Đã thanh toán
                                  </div>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {groupedEventsByMonth.past.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Sự kiện đã tổ chức</p>
                {groupedEventsByMonth.past.map(group => (
                  <div key={group.key} className="space-y-2">
                    <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">{group.label}</p>
                    {group.events.map(event => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => openEventDetail(event.id)}
                        className={`w-full p-4 rounded-xl border text-left transition opacity-60 grayscale hover:opacity-85 hover:grayscale-0 ${selectedEventId === event.id ? 'border-blue-300 bg-blue-50 shadow-sm opacity-90 grayscale-0' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}
                      >
                        {(() => {
                          const schedule = getEventSchedule(event);
                          const uniqueSessions = Array.from(new Set(schedule.flatMap(item => item.sessions)));
                          const start = schedule[0]?.date || event.startDate;
                          const end = schedule[schedule.length - 1]?.date || event.endDate;
                          const venue = getEventVenue(event);
                          const venueTone = getEventVenueTone(venue);
                          const registeredByCurrentUser = isCurrentUserRegisteredForEvent(event);
                          return (
                            <>
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="font-bold text-gray-700 leading-snug">{event.name}</h4>
                                <span className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black ${venueTone.chip}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${venueTone.dot}`}></span>
                                  {getEventVenueShortLabel(venue)}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                <Calendar size={12}/> {start}{end && end !== start ? ` → ${end}` : ''}
                              </p>
                              <div className="mt-2 flex items-center gap-2 flex-wrap">
                                {uniqueSessions.map(session => (
                                  <div key={session} className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                                    {SESSION_LABELS[session]}
                                  </div>
                                ))}
                                <div className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                                  Đã tổ chức
                                </div>
                                {registeredByCurrentUser && (
                                  <div className="inline-flex items-center gap-1 text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                    <UserCheck size={10}/> Đã đăng ký
                                  </div>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col lg:h-full overflow-visible lg:overflow-hidden">
        {eventScreenMode === 'HOME' ? (
          <>
            <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50/40">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">Danh sách & lịch sự kiện</h2>
                  <p className="text-sm text-slate-500">Chọn một sự kiện để mở workspace Chuẩn bị/Hậu cần hoặc Tổ chức/Nội dung cho EBUS và EH.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleCalendarMonthChange(-1)} className="px-3 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition">
                    <ChevronLeft size={16} />
                  </button>
                  <button onClick={resetCalendarToCurrentMonth} className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 hover:bg-blue-100 transition text-sm font-semibold">
                    Hôm nay
                  </button>
                  <button onClick={() => handleCalendarMonthChange(1)} className="px-3 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-visible lg:overflow-y-auto p-4 md:p-6 bg-slate-50/30">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h3 className="text-lg font-bold text-slate-800">Lịch sự kiện</h3>
                  <p className="text-sm text-slate-500">{calendarMonthLabel}</p>
                </div>
                <div className="p-4 md:p-5">
                  <div className="grid grid-cols-7 gap-2 text-sm">
                    {['T2','T3','T4','T5','T6','T7','CN'].map((d, weekdayIndex) => (
                      <div
                        key={d}
                        className={`rounded-lg py-2 text-center font-black text-xs uppercase ${
                          weekdayIndex >= 5
                            ? 'bg-rose-50 text-rose-600 border border-rose-100'
                            : 'text-slate-500'
                        }`}
                      >
                        {d}
                      </div>
                    ))}

                    {(() => {
                      const year = calendarView.year;
                      const month = calendarView.month;
                      const first = new Date(year, month, 1);
                      const startDay = (first.getDay() + 6) % 7;
                      const daysInMonth = new Date(year, month + 1, 0).getDate();
                      const cells = [] as (Date | null)[];
                      for (let i = 0; i < startDay; i++) cells.push(null);
                      for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
                      return cells.map((dt, idx) => {
                        const isWeekendCell = idx % 7 >= 5;
                        if (!dt) return <div key={idx} className={`min-h-[110px] p-2 border rounded-lg ${isWeekendCell ? 'bg-rose-50/50 border-rose-100' : 'bg-slate-50 border-slate-100'}`} />;
                        const key = getLocalDateKey(dt);
                        const isToday = key === todayKey;
                        const dayEvents = events.filter(ev => getEventSchedule(ev).some(item => item.date === key));
                        return (
                          <div
                            key={idx}
                            className={`min-h-[110px] p-2 border rounded-lg flex flex-col ${
                              isToday
                                ? 'bg-yellow-50 border-yellow-300 ring-2 ring-yellow-200 shadow-sm'
                                : isWeekendCell
                                  ? 'bg-rose-50/35 border-rose-200 ring-1 ring-rose-50'
                                  : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className={`text-xs font-black ${isToday ? 'text-yellow-700' : isWeekendCell ? 'text-rose-500' : 'text-slate-400'}`}>{dt.getDate()}</div>
                              {isToday && (
                                <span className="rounded-full bg-yellow-200 px-1.5 py-0.5 text-[9px] font-black text-yellow-800">Hôm nay</span>
                              )}
                            </div>
                            <div className="mt-2 space-y-1 overflow-auto text-[12px]">
                              {dayEvents.map(ev => {
                                const venue = getEventVenue(ev);
                                const venueTone = getEventVenueTone(venue);
                                return (
                                  <button
                                    key={ev.id}
                                    type="button"
                                    onClick={() => openEventDetail(ev.id)}
                                    className={`w-full text-left rounded-md border px-2 py-1 transition ${venueTone.card}`}
                                  >
                                    <span className={`flex items-center gap-1 truncate font-semibold ${venueTone.text}`}>
                                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${venueTone.dot}`}></span>
                                      <span className="truncate">{getEventVenueShortLabel(venue)} - {ev.name}</span>
                                    </span>
                                    <span className="block text-[10px] text-slate-500">
                                      {(getSessionsForDate(ev, key) || []).map(s => SESSION_LABELS[s]).join(' • ')}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : eventScreenMode === 'DASHBOARD' && selectedEvent ? (
          <>
            <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50/40 shrink-0">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <button
                    onClick={() => setEventScreenMode('HOME')}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 transition"
                  >
                    <ArrowLeft size={14} /> Quay lại danh sách
                  </button>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-black text-slate-900">{selectedEvent.name}</h2>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-black ${getEventVenueTone(getEventVenue(selectedEvent)).chip}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${getEventVenueTone(getEventVenue(selectedEvent)).dot}`}></span>
                        {getEventVenueLabel(getEventVenue(selectedEvent))}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{selectedEvent.client || eventProfile.organization || 'Chưa cập nhật đơn vị'} • {eventDateLabel || selectedEvent.startDate}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {dashboardMapUrl && (
                    <a
                      href={dashboardMapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-black text-blue-700 hover:bg-blue-100"
                    >
                      <MapPin size={16}/> Google Map
                    </a>
                  )}
                  {contentProgramViews[0] && getDashboardLiveUrl(contentProgramViews[0].id) && (
                    <a
                      href={getDashboardLiveUrl(contentProgramViews[0].id)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-black text-white hover:bg-black"
                    >
                      <PlayCircle size={16}/> Xem LIVE
                    </a>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setEventScreenMode('DETAIL')}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-700"
                    >
                      <Pencil size={16}/> Mở chỉnh sửa
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4 md:p-6 space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-black uppercase text-slate-400">Chương trình</p>
                  <p className="mt-1 text-2xl font-black text-slate-900">{contentProgramViews.length}</p>
                </div>
                <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">
                  <p className="text-[11px] font-black uppercase text-teal-700">Trạm/Khu vực</p>
                  <p className="mt-1 text-2xl font-black text-teal-800">{dashboardStationCount}</p>
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-[11px] font-black uppercase text-blue-700">Nhân sự</p>
                  <p className="mt-1 text-2xl font-black text-blue-800">{staffCostGroups.length}</p>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                  <p className="text-[11px] font-black uppercase text-amber-700">Incident mở</p>
                  <p className="mt-1 text-2xl font-black text-amber-800">{dashboardIncidentCount}</p>
                </div>
              </div>

              {!isAdmin && onRegisterStaff && (
                <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                        <UserCheck size={18} className="text-blue-600"/> Đăng ký tham gia sự kiện
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {currentStaffRegistration
                          ? `Bạn đã đăng ký tham gia sự kiện này${currentStaffRegistration.updatedAt ? ` lúc ${new Date(currentStaffRegistration.updatedAt).toLocaleString('vi-VN')}` : ''}.`
                          : 'Đăng ký trước để ADMIN ưu tiên bạn khi phân công nhân sự.'}
                      </p>
                      <p className="mt-2 text-xs font-bold text-slate-400">
                        {currentEmployee?.name || currentUserName || 'Tài khoản hiện tại'} • {currentEmployee?.role || 'Nhân sự'} • {eventStaffRegistrations.length} người đã đăng ký
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRegisterStaff(selectedEvent.id, currentStaffRegistration ? 'CANCEL' : 'REGISTER')}
                      disabled={selectedEventIsPast}
                      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        currentStaffRegistration
                          ? 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {currentStaffRegistration ? <X size={16}/> : <UserCheck size={16}/>}
                      {selectedEventIsPast ? 'Sự kiện đã qua' : currentStaffRegistration ? 'Hủy đăng ký' : 'Đăng ký tham gia'}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-5">
                <div className="space-y-5">
                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2"><BookOpen size={18}/> Hồ sơ nhanh</h3>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-[11px] font-black uppercase text-slate-400">Thời gian</p>
                        <p className="mt-1 font-bold text-slate-800">{eventDateLabel || 'Chưa cập nhật'}{programTimeLabel ? ` • ${programTimeLabel}` : ''}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-[11px] font-black uppercase text-slate-400">Địa điểm</p>
                        <p className="mt-1 font-bold text-slate-800">{[selectedEvent.location, eventProfile.addressDetail].filter(Boolean).join(' • ') || 'Chưa cập nhật'}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-[11px] font-black uppercase text-slate-400">Đối tượng / Quy mô</p>
                        <p className="mt-1 font-bold text-slate-800">
                          {getAudienceLabels(eventProfile.audience) || 'Chưa cập nhật'}
                          {(eventProfile.attendanceMin || eventProfile.attendanceMax) ? ` • ${eventProfile.attendanceMin ?? 0}-${eventProfile.attendanceMax ?? 0} người` : ''}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-[11px] font-black uppercase text-slate-400">Liên hệ</p>
                        <p className="mt-1 font-bold text-slate-800">
                          {eventProfile.schoolContact?.name || eventProfile.einsteinPic || 'Chưa cập nhật'}
                          {eventProfile.schoolContact?.phone ? ` • ${eventProfile.schoolContact.phone}` : ''}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-black text-slate-900 flex items-center gap-2"><Radio size={18}/> Chương trình nội dung</h3>
                      <span className="text-xs font-bold text-slate-500">Tasks {dashboardDoneTasks}/{dashboardTotalTasks}</span>
                    </div>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {contentProgramViews.map(program => {
                        const operation = program.houseOperation;
                        const agenda = operation?.agenda || [];
                        const firstAgenda = agenda[0];
                        const lastAgenda = agenda[agenda.length - 1];
                        const stationCount = Math.max(operation?.stations?.length || 0, program.layout?.blocks?.length || 0);
                        return (
                          <div key={program.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-black text-slate-900">{program.name}</p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">{getProgramDateLabel(program, selectedEvent)}</p>
                              </div>
                              <a
                                href={getDashboardLiveUrl(program.id)}
                                target="_blank"
                                rel="noreferrer"
                                className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-black text-white"
                              >
                                <PlayCircle size={12}/> LIVE
                              </a>
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                              <div className="rounded-lg bg-white p-2 border border-slate-100">
                                <p className="text-[10px] font-black uppercase text-slate-400">Trạm</p>
                                <p className="font-black text-slate-900">{stationCount}</p>
                              </div>
                              <div className="rounded-lg bg-white p-2 border border-slate-100">
                                <p className="text-[10px] font-black uppercase text-slate-400">Agenda</p>
                                <p className="font-black text-slate-900">{agenda.length}</p>
                              </div>
                              <div className="rounded-lg bg-white p-2 border border-slate-100">
                                <p className="text-[10px] font-black uppercase text-slate-400">Incident</p>
                                <p className="font-black text-slate-900">{operation?.incidents?.filter(incident => incident.status === 'OPEN').length || 0}</p>
                              </div>
                            </div>
                            <p className="mt-3 text-xs font-semibold text-slate-600">
                              {firstAgenda && lastAgenda ? `${firstAgenda.startTime} - ${lastAgenda.endTime}` : 'Chưa có agenda'} • {operation?.theme || program.description || 'Chưa cập nhật chủ đề'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2"><Clock3 size={18}/> Timeline hậu cần</h3>
                    <div className="mt-4 space-y-2">
                      {timelineEntries.slice(0, 8).map(entry => (
                        <div key={entry.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <p className="text-[11px] font-black uppercase text-slate-500">{formatTimelineDatetime(entry.datetime)}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">{entry.note}</p>
                        </div>
                      ))}
                      {timelineEntries.length === 0 && <p className="text-sm text-slate-400 italic">Chưa có timeline hậu cần.</p>}
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2"><Users size={18}/> Nhân sự</h3>
                    <div className="mt-4 space-y-2">
                      {staffCostGroups.map(group => {
                        const emp = employees.find(employee => employee.id === group.employeeId);
                        return (
                          <div key={group.key} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-black text-slate-900">{emp?.name || group.employeeId}</p>
                              <span className="text-xs font-black text-slate-500">{group.totalHours || group.items.length}h</span>
                            </div>
                            <p className="mt-1 text-xs font-semibold text-slate-500">{group.shiftDate ? new Date(group.shiftDate).toLocaleDateString('vi-VN') : 'Chưa có ngày'} • {group.sessions.map(session => SESSION_LABELS[session]).join(' + ') || 'Chưa có ca'}</p>
                            {group.stationNames.length > 0 && <p className="mt-1 text-xs font-semibold text-teal-700">Trạm: {group.stationNames.join(', ')}</p>}
                          </div>
                        );
                      })}
                      {staffCostGroups.length === 0 && <p className="text-sm text-slate-400 italic">Chưa phân công nhân sự.</p>}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2"><Box size={18}/> Thiết bị cần mang</h3>
                    <div className="mt-4 space-y-2 max-h-[360px] overflow-auto pr-1">
                      {dashboardEquipmentItems.map(item => (
                        <div key={item.itemId} className="rounded-lg border border-slate-100 bg-slate-50 p-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="font-bold text-slate-900">{item.name}</p>
                            {item.category && <p className="text-xs text-slate-500">{item.category}</p>}
                          </div>
                          <span className="rounded-lg bg-white px-2 py-1 text-sm font-black text-slate-800 border border-slate-100">x{item.quantity}</span>
                        </div>
                      ))}
                      {dashboardEquipmentItems.length === 0 && <p className="text-sm text-slate-400 italic">Chưa có danh sách thiết bị.</p>}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2"><LinkIcon size={18}/> Liên kết nhanh</h3>
                    <div className="mt-4 grid grid-cols-1 gap-2">
                      {dashboardMapUrl && (
                        <a href={dashboardMapUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-black text-blue-700 hover:bg-blue-100">
                          Mở Google Map
                        </a>
                      )}
                      {contentProgramViews.map(program => (
                        <a key={program.id} href={getDashboardLiveUrl(program.id)} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-100">
                          LIVE - {program.name}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : selectedEvent ? (
          <>
            <div className="p-3 md:p-4 border-b border-slate-100 space-y-3 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setEventScreenMode('HOME')}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition"
                >
                  <ArrowLeft size={14} /> Quay lại trang chủ Sự kiện
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setEventScreenMode('DASHBOARD')}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-black rounded-full bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition"
                  >
                    <BarChart3 size={14}/> Xem Dashboard
                  </button>
                )}
              </div>
              <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                <div>
                  <h2 className="text-2xl font-black text-gray-800">{selectedEvent.name}</h2>
                  <p className="text-sm text-gray-500">{selectedEvent.client} • {selectedEvent.location} • {getEventVenueLabel(getEventVenue(selectedEvent))}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                    {EVENT_VENUE_OPTIONS.map(option => {
                      const isSelected = getEventVenue(selectedEvent) === option.value;
                      const tone = getEventVenueTone(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => onUpdateEvent?.(selectedEvent.id, { organizationVenue: option.value })}
                          disabled={!canEdit || !onUpdateEvent}
                          title={option.description}
                          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-black transition sm:flex-none ${
                            isSelected
                              ? `${tone.chip} border-transparent`
                              : 'text-slate-500 hover:bg-slate-50'
                          } disabled:opacity-60 disabled:cursor-not-allowed`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`}></span>
                          {option.value === 'EH' ? 'Tại EH' : 'EBUS'}
                        </button>
                      );
                    })}
                  </div>
                  {isAdmin && onDeleteEvent && (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition"
                    >
                      <Trash2 size={16}/> Xóa sự kiện
                    </button>
                  )}
                  <button
                    onClick={handleCreateOrder}
                    disabled={!canEdit && !selectedEvent.isOrderCreated}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${selectedEvent.isOrderCreated ? 'bg-green-100 text-green-700' : !canEdit ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-slate-800 text-white hover:bg-black'}`}
                  >
                    {selectedEvent.isOrderCreated ? (
                      <><CheckCircle size={16}/> Đã Chốt Đơn</>
                    ) : !canEdit ? (
                      <><FileText size={16}/> Chưa chốt đơn</>
                    ) : (
                      <><FileText size={16}/> Chốt Đơn & In</>
                    )}
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
                {DETAIL_SECTIONS.map(section => {
                  const SectionIcon = section.Icon;
                  const isSelected = detailSection === section.key;
                  return (
                    <button
                      key={section.key}
                      type="button"
                      onClick={() => handleDetailSectionChange(section.key)}
                      className={`rounded-xl border p-3 text-left transition ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`rounded-lg p-2 ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          <SectionIcon size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-black">{section.label}</p>
                          <p className="mt-1 text-xs font-medium text-slate-500 leading-snug">{section.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {detailSection === 'PROGRAM_CONTENT' && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm space-y-2">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Chương trình nội dung</p>
                      {isContentProgramEditorOpen && (
                        <p className="text-xs font-semibold text-slate-600">Hồ sơ dùng chung, mỗi chương trình có Sơ đồ, Design, Agenda, Knowledge, Live và Report riêng.</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setIsContentProgramEditorOpen(prev => !prev)}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
                      >
                        {isContentProgramEditorOpen ? 'Thu gọn' : 'Mở chỉnh sửa'}
                      </button>
                      <button
                        type="button"
                        onClick={createContentProgramClone}
                        disabled={!canEdit || !onUpdateEvent}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-xs font-black text-white hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-500"
                      >
                        <Plus size={14}/> {contentProgramViews.length > 1 ? 'Clone chương trình' : 'Bật nâng cao'}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {contentProgramViews.map(program => {
                      const operation = program.houseOperation;
                      const isSelected = activeContentProgram?.id === program.id;
                      return (
                        <button
                          key={program.id}
                          type="button"
                          onClick={() => setActiveContentProgramId(program.id)}
                          className={`min-w-[190px] rounded-lg border p-2 text-left transition ${
                            isSelected
                              ? 'border-teal-500 bg-teal-50 text-teal-900'
                              : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:border-teal-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-black leading-snug">{program.name}</p>
                            {program.isPrimary && (
                              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-slate-500 border border-slate-200">Gốc</span>
                            )}
                          </div>
                          <p className="mt-1 text-[10px] font-semibold text-slate-500">{getProgramDateLabel(program, selectedEvent)}</p>
                          <p className="mt-1 text-[10px] text-slate-500">
                            {operation?.stations?.length || 0} trạm • {operation?.agenda?.length || 0} mốc agenda • {program.layout?.blocks?.length || 0} block sơ đồ
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {activeContentProgram && isContentProgramEditorOpen && (
                    <div className={`grid grid-cols-1 gap-3 rounded-xl border border-teal-100 bg-teal-50/50 p-3 ${
                      activeContentProgram.isPrimary
                        ? 'lg:grid-cols-[1.2fr_0.8fr_1fr]'
                        : 'lg:grid-cols-[1.2fr_0.8fr_1fr_auto]'
                    }`}>
                      <div>
                        <label className="block text-[10px] font-black text-teal-700 uppercase mb-1">Tên chương trình</label>
                        <input
                          className="w-full rounded-lg border border-teal-100 bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500"
                          value={activeContentProgram.name}
                          onChange={e => updateContentProgram(activeContentProgram.id, { name: e.target.value })}
                          disabled={!canEdit}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-teal-700 uppercase mb-1">Ngày tổ chức</label>
                        <input
                          type="date"
                          className="w-full rounded-lg border border-teal-100 bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500"
                          value={activeContentProgram.date || getProgramDefaultDate(selectedEvent)}
                          onChange={e => updateContentProgram(activeContentProgram.id, { date: e.target.value })}
                          disabled={!canEdit}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-teal-700 uppercase mb-1">Buổi</label>
                        <div className="flex flex-wrap gap-2">
                          {SESSION_OPTIONS.map(option => {
                            const sessions = activeContentProgram.sessions && activeContentProgram.sessions.length > 0
                              ? activeContentProgram.sessions
                              : getProgramDefaultSessions(selectedEvent);
                            const checked = sessions.includes(option.value);
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => toggleContentProgramSession(activeContentProgram, option.value)}
                                disabled={!canEdit}
                                className={`rounded-lg border px-3 py-2 text-xs font-black ${
                                  checked
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-slate-200 bg-white text-slate-500'
                                } disabled:opacity-50`}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {!activeContentProgram.isPrimary && (
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => removeContentProgram(activeContentProgram.id)}
                            disabled={!canEdit}
                            className="inline-flex h-10 items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-red-500 hover:bg-red-50 disabled:opacity-50"
                            title="Xóa chương trình clone"
                          >
                            <Trash2 size={16}/>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-slate-50/30">
              <div className="sticky top-0 z-20 border-b border-slate-100 bg-slate-50/95 px-4 pt-3 pb-2 backdrop-blur md:px-5">
                <div className="mx-auto mb-2 h-1 w-12 rounded-full bg-slate-300/80"></div>
                <div className="flex gap-4 md:gap-6 overflow-x-auto">
                  {visibleDetailTabs.map(tab => {
                    const TabIcon = tab.icon;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setDetailTab(tab.key)}
                        className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${detailTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                      >
                        <TabIcon size={16} /> {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="p-4 md:p-5">
              {detailTab === 'EQUIPMENT' && (
                <div className="space-y-4">
                  {/* Sync From Quotation Banner */}
                  {linkedQuotation && (
                    <div className="bg-blue-600 p-4 rounded-xl text-white shadow-lg flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                       <div className="flex items-center gap-3">
                          <div className="bg-white/20 p-2 rounded-lg"><RefreshCw size={24}/></div>
                          <div>
                            <p className="text-sm font-bold">Tìm thấy báo giá đã liên kết</p>
                            <p className="text-xs opacity-80">Đồng bộ nhanh danh mục thiết bị từ báo giá của {linkedQuotation.clientName}?</p>
                          </div>
                       </div>
                       <button onClick={handleSyncFromQuotation} className="bg-white text-blue-600 px-4 py-2 rounded-lg text-xs font-black hover:bg-slate-100 transition shadow-sm uppercase">Đồng bộ ngay</button>
                    </div>
                  )}

                  {canEdit && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => { setExportMode('SINGLE'); setShowExportModal(true); }}
                        className="bg-white border border-blue-600 text-blue-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-50"
                      >
                        + Thêm lẻ
                      </button>
                      <button
                        onClick={() => { setExportMode('COMBO'); setShowExportModal(true); }}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700"
                      >
                        + Thêm Combo
                      </button>
                      <button
                        onClick={handleSyncFromHouseOperation}
                        disabled={!activeContentEvent?.houseOperation?.stations?.length}
                        className={`px-4 py-2 rounded-lg text-sm font-bold border ${activeContentEvent?.houseOperation?.stations?.length ? 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100' : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'}`}
                      >
                        Đồng bộ từ {activeContentProgram?.name || 'chương trình'}
                      </button>
                      <button
                        onClick={handleRemoveSelectedItems}
                        disabled={selectedItemIds.length === 0}
                        className={`px-4 py-2 rounded-lg text-sm font-bold border ${selectedItemIds.length === 0 ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'}`}
                      >
                        Xóa thiết bị đã chọn ({selectedItemIds.length})
                      </button>
                    </div>
                  )}

                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                    <table className="min-w-[760px] w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="px-3 py-3 font-bold text-gray-500 uppercase text-[10px] text-center">
                            <input 
                              type="checkbox" 
                              checked={selectedEvent?.items.length > 0 && selectedItemIds.length === selectedEvent.items.length}
                              onChange={e => {
                                if (!selectedEvent) return;
                                setSelectedItemIds(e.target.checked ? selectedEvent.items.map(it => it.itemId) : []);
                              }} 
                              disabled={!canEdit}
                            />
                          </th>
                          <th className="px-3 py-3 font-bold text-gray-500 uppercase text-[10px] text-center">Đã xong</th>
                          <th className="px-4 py-3 font-bold text-gray-500 uppercase text-[10px]">Order Thiết bị</th>
                          <th className="px-4 py-3 font-bold text-gray-500 uppercase text-[10px] text-center">Cần</th>
                          <th className="px-4 py-3 font-bold text-gray-500 uppercase text-[10px] text-center">Kho đang có</th>
                          <th className="px-4 py-3 font-bold text-gray-500 uppercase text-[10px] text-center">Thiếu</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedEvent.items.map((alloc, i) => {
                          const item = inventory.find(inv => inv.id === alloc.itemId);
                          const availableNow = item?.availableQuantity ?? 0;
                          const displayAvailable = Math.max(0, availableNow);
                          const overdraw = availableNow < 0 ? Math.abs(availableNow) : 0;
                          const brokenQty = item?.brokenQuantity ?? 0;
                          const lostQty = item?.lostQuantity ?? 0;
                          const maintenanceQty = item?.maintenanceQuantity ?? 0;
                          const effectiveStock = availableNow + alloc.quantity; // cộng lại phần đang giữ cho sự kiện này
                          const shortage = Math.max(0, alloc.quantity - effectiveStock);
                          const shortageLabel = shortage > 0 ? `Thiếu ${shortage}` : 'Đủ';
                          return (
                            <tr key={i} className={`hover:bg-slate-50/50 ${shortage > 0 ? 'bg-amber-50' : ''}`}>
                              <td className="px-4 py-3 text-center">
                                <input 
                                  type="checkbox" 
                                  checked={selectedItemIds.includes(alloc.itemId)}
                                  onChange={e => toggleSelectedItem(alloc.itemId, e.target.checked)} 
                                  disabled={!canEdit}
                                />
                              </td>
                              <td className="px-4 py-3 text-center">
                                <input type="checkbox" checked={!!alloc.done} onChange={e => onToggleItemDone?.(selectedEvent.id, alloc.itemId, e.target.checked)} disabled={!canEdit} />
                              </td>
                          <td className="px-4 py-3">
                                <button 
                                  type="button"
                                  onClick={() => item && setViewingItem(item)}
                                  className="flex items-center gap-3 text-left w-full hover:bg-slate-50 rounded-lg px-1 py-0.5"
                                >
                                  <img src={item?.imageUrl} className="w-8 h-8 rounded object-cover border border-slate-100" />
                                  <div>
                                    <span className="font-bold text-slate-800">{item?.name}</span>
                                    <p className="text-[11px] text-slate-500">{item?.category}</p>
                                  </div>
                                </button>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleItemQuantityChange(alloc.itemId, alloc.quantity - 1)}
                                    disabled={!canEdit || alloc.quantity <= (alloc.returnedQuantity || 0)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    <Minus size={14} />
                                  </button>
                                  <input
                                    type="number"
                                    min={alloc.returnedQuantity || 0}
                                    className="w-16 text-center border border-slate-200 rounded-lg p-1 font-black text-blue-600"
                                    value={alloc.quantity}
                                    onChange={e => handleItemQuantityChange(alloc.itemId, Number(e.target.value))}
                                    disabled={!canEdit}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleItemQuantityChange(alloc.itemId, alloc.quantity + 1)}
                                    disabled={!canEdit}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    <Plus size={14} />
                                  </button>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex flex-col items-center gap-1">
                                  <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg text-[11px] font-black bg-slate-100 text-slate-700">
                                    OK {displayAvailable}
                                  </span>
                                  {overdraw > 0 && (
                                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg text-[10px] font-black bg-red-100 text-red-700">
                                      Thiếu kho {overdraw}
                                    </span>
                                  )}
                                  <div className="flex gap-1 flex-wrap justify-center">
                                    {maintenanceQty > 0 && <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-[10px] font-bold">BT: {maintenanceQty}</span>}
                                    {brokenQty > 0 && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">Hỏng: {brokenQty}</span>}
                                    {lostQty > 0 && <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-[10px] font-bold">Mất: {lostQty}</span>}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center justify-center px-2 py-1 rounded-lg text-[11px] font-black ${shortage > 0 ? 'bg-amber-200 text-amber-800' : 'bg-green-100 text-green-700'}`}>
                                  {shortageLabel}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {selectedEvent.items.length === 0 && (
                          <tr><td colSpan={6} className="p-10 text-center text-gray-400 italic">Chưa có thiết bị nào trong danh sách xuất.</td></tr>
                        )}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'CHECKLIST' && selectedEvent && (
                <EventChecklist
                  event={selectedEvent}
                  inventory={inventory}
                  onScan={onChecklistScan || (() => {})}
                  onUpdateNote={onUpdateChecklistNote}
                  onSaveSignature={onSaveChecklistSignature}
                />
              )}

              {detailTab === 'TIMELINE' && selectedEvent && (
                <div className="space-y-4">
                  {autoTimelinePlan && (
                    <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Timeline hậu cần tự động</p>
                        <p className="mt-1 text-sm font-semibold text-blue-900">
                          {autoTimelinePlan.summary.route.isOutOfProvince ? `Ngoại tỉnh - ${autoTimelinePlan.summary.route.label}` : 'Hà Nội'} • {autoTimelinePlan.summary.maxStationCount} trạm • {autoTimelinePlan.summary.programCount} chương trình
                        </p>
                        <p className="text-xs text-blue-700">
                          {autoTimelinePlan.summary.route.isOutOfProvince
                            ? autoTimelinePlan.summary.provinceSameDayDeparture
                              ? `Ngoại tỉnh: tự tính đi trong ngày nếu còn đủ biên giờ, ước lượng ${autoTimelinePlan.summary.travelMinutesOneWay} phút di chuyển một chiều và setup ${autoTimelinePlan.summary.isLargeSetup ? '2h' : '1h'}.`
                              : `Ngoại tỉnh: giờ bắt đầu sớm nên tự chuyển sang phương án đi tối hôm trước, ước lượng ${autoTimelinePlan.summary.travelMinutesOneWay} phút di chuyển một chiều.`
                            : autoTimelinePlan.summary.isLargeSetup
                              ? 'Trên 6 trạm tại Hà Nội: tự thêm mốc vận chuyển/setup trước 1 ngày và setup trước giờ chạy.'
                              : 'Từ 6 trạm trở xuống: tự tính xe khởi hành, nhân sự có mặt setup trước 1h và mốc quay về.'}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-2 text-right border border-blue-100">
                        <p className="text-[10px] font-black uppercase text-blue-500">Mốc tự động</p>
                        <p className="text-lg font-black text-blue-800">{autoTimelinePlan.entries.length}</p>
                      </div>
                    </div>
                  )}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {editingTimelineId ? 'Sửa mốc timeline' : 'Thêm mốc timeline'}
                      </p>
                      <p className="text-sm text-slate-600">
                        {editingTimelineId
                          ? 'Mốc sau khi sửa sẽ trở thành mốc tùy chỉnh để không bị timeline tự động ghi đè.'
                          : 'Chia theo giai đoạn trước / trong / sau để bám sát tiến độ triển khai.'}
                      </p>
                    </div>
                    <div className="flex flex-col md:flex-row gap-3">
                      <div className="flex-1 space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 uppercase">Ngày giờ</label>
                        <input
                          type="datetime-local"
                          lang="vi"
                          value={timelineDatetime}
                          onChange={e => setTimelineDatetime(e.target.value)}
                          disabled={!canEdit}
                          className={`w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none ${canEdit ? 'bg-white' : 'bg-slate-100 text-slate-500'}`}
                        />
                      </div>
                      <div className="w-full md:w-44 space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 uppercase">Giai đoạn</label>
                        <select
                          value={timelinePhase}
                          onChange={e => setTimelinePhase(e.target.value as EventTimelinePhase)}
                          disabled={!canEdit}
                          className={`w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none ${canEdit ? 'bg-white' : 'bg-slate-100 text-slate-500'}`}
                        >
                          {TIMELINE_PHASES.map(phase => (
                            <option key={phase.value} value={phase.value}>{phase.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600 uppercase">Nội dung công việc</label>
                      <textarea
                        rows={2}
                        className={`w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none ${canEdit ? 'bg-white' : 'bg-slate-100 text-slate-500'}`}
                        placeholder="VD: 08:00 - Xe rời kho, 10:30 - set up sân khấu, 22:00 - thu hồi thiết bị..."
                        value={timelineNote}
                        onChange={e => setTimelineNote(e.target.value)}
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      {editingTimelineId && (
                        <button
                          type="button"
                          onClick={handleCancelTimelineEdit}
                          className="px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 text-slate-600 hover:bg-slate-50"
                        >
                          Hủy sửa
                        </button>
                      )}
                      <button
                        onClick={handleAddTimelineEntry}
                        disabled={!canEdit}
                        className={`px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 ${canEdit ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
                      >
                        {editingTimelineId ? <Pencil size={16}/> : <Plus size={16}/>}
                        {editingTimelineId ? 'Cập nhật mốc' : 'Lưu mốc'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {TIMELINE_PHASES.map(phase => {
                      const items = groupedTimeline[phase.value] || [];
                      return (
                        <div key={phase.value} className={`p-4 rounded-2xl border shadow-sm ${phase.color}`}>
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1">
                                <Clock3 size={12}/> {phase.label}
                              </p>
                              <p className="text-xs text-slate-500">{phase.description}</p>
                            </div>
                            <span className="px-2 py-1 rounded-full bg-white text-slate-700 text-[11px] font-black border border-slate-200 shadow-sm">{items.length} mốc</span>
                          </div>
                          <div className="space-y-3">
                            {items.length === 0 && (
                              <p className="text-sm text-slate-400 italic">Chưa có mốc nào.</p>
                            )}
                            {items.map(entry => (
                              <div key={entry.id} className="bg-white rounded-xl border border-slate-200 p-3 shadow-[0_5px_20px_rgba(15,23,42,0.05)]">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-[11px] font-black text-slate-600 uppercase tracking-wide">{formatTimelineDatetime(entry.datetime)}</p>
                                      {isAutoTimelineEntry(entry) && (
                                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-700 border border-blue-100">Tự động</span>
                                      )}
                                    </div>
                                    <p className="text-sm text-slate-800 leading-snug">{entry.note}</p>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleEditTimelineEntry(entry)}
                                      disabled={!canEdit}
                                      className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40"
                                      title="Sửa mốc"
                                    >
                                      <Pencil size={14}/>
                                    </button>
                                    {!isAutoTimelineEntry(entry) && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveTimelineEntry(entry.id)}
                                        className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition"
                                        title="Xóa mốc"
                                      >
                                        <X size={14}/>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {detailTab === 'STAFF' && selectedEvent && (
                <div className="space-y-6">
                  <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm space-y-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h4 className="font-bold text-gray-700 text-xs uppercase flex items-center gap-2">
                          <UserCheck size={16} className="text-blue-600"/> Nhân sự đã đăng ký
                        </h4>
                        <p className="mt-1 text-xs text-slate-500">
                          Dùng danh sách này để ưu tiên khi phân slot. Nhân sự chỉ đăng ký tham gia, ADMIN vẫn quyết định vị trí cụ thể.
                        </p>
                      </div>
                      <div className="rounded-lg bg-blue-50 px-3 py-2 text-right">
                        <p className="text-[10px] font-black uppercase text-blue-600">Đăng ký</p>
                        <p className="text-lg font-black text-blue-700">{eventStaffRegistrations.length}</p>
                      </div>
                    </div>
                    {registeredStaffRows.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                        {registeredStaffRows.map(({ registration, employee }) => {
                          const assigned = (selectedEvent.staff || []).some(staff => staff.employeeId === registration.employeeId);
                          return (
                            <div key={registration.id} className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-black text-slate-800">{employee?.name || registration.name}</p>
                                  <p className="truncate text-[11px] font-semibold text-blue-700">{employee?.role || registration.role || 'Nhân sự'}</p>
                                </div>
                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${assigned ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-blue-700 border border-blue-100'}`}>
                                  {assigned ? 'Đã phân' : 'Ưu tiên'}
                                </span>
                              </div>
                              <p className="mt-1 text-[10px] font-semibold text-slate-400">
                                {new Date(registration.updatedAt || registration.createdAt).toLocaleString('vi-VN')}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                        Chưa có nhân sự nào đăng ký tham gia sự kiện này.
                      </div>
                    )}
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-teal-100 shadow-sm space-y-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h4 className="font-bold text-gray-700 text-xs uppercase flex items-center gap-2">
                          <Users size={16} className="text-teal-600"/> Slot nhân sự tự động từ DESIGN
                        </h4>
                        <p className="mt-1 text-xs text-slate-500">
                          Lương tự tính theo 30.000đ/giờ, đủ 4h hỗ trợ nước 10.000đ, đủ 8h cộng ăn 50.000đ + nước 20.000đ, tối đa 310.000đ/ngày.
                        </p>
                      </div>
                      <div className="rounded-lg bg-teal-50 px-3 py-2 text-right">
                        <p className="text-[10px] font-black uppercase text-teal-600">Đã phân công</p>
                        <p className="text-lg font-black text-teal-700">{filledAutoStaffSlots}/{autoStaffSlots.length}</p>
                      </div>
                    </div>

                    {autoStaffSlots.length > 0 ? (
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                        {autoStaffSlots.map(slot => {
                          const assignedEmployees = slot.assigned
                            .map(staff => ({ staff, employee: employees.find(emp => emp.id === staff.employeeId) }));
                          const allAssignedDone = slot.assigned.length > 0 && slot.assigned.every(staff => !!staff.done);
                          const availableEmployees = sortRegisteredEmployeesFirst(activeEmployees.filter(emp =>
                            !slot.assigned.some(staff => staff.employeeId === emp.id)
                          ));
                          return (
                            <div key={slot.key} className={`rounded-xl border p-4 transition ${slot.assigned.length > 0 ? 'border-teal-200 bg-teal-50/50' : 'border-slate-200 bg-slate-50/60'}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-black text-slate-800">{slot.station.name}</p>
                                    {slot.programName && (
                                      <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-black text-teal-700">
                                        {slot.programName}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500">
                                    {slot.station.packageName || 'Trạm/khu vực trong DESIGN'}
                                    {slot.station.areaDescription ? ` • ${slot.station.areaDescription}` : ''}
                                  </p>
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200">
                                      {new Date(slot.date).toLocaleDateString('vi-VN')}
                                    </span>
                                    {slot.sessions.map(session => (
                                      <span key={session} className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-100">
                                        {SESSION_LABELS[session]}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  {slot.sessions.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => splitStaffSlotBySession(slot)}
                                      disabled={!canEdit}
                                      className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-white px-2 py-1 text-[11px] font-black text-teal-700 hover:bg-teal-50 disabled:opacity-50"
                                      title="Tách thành từng buổi riêng"
                                    >
                                      <ArrowRightLeft size={13}/> Tách 2 buổi
                                    </button>
                                  )}
                                  {slot.assigned.length > 0 && (
                                    <label className="inline-flex items-center gap-2 text-[11px] font-bold text-teal-700">
                                      <input
                                        type="checkbox"
                                        checked={allAssignedDone}
                                        onChange={e => slot.assigned.forEach(staff =>
                                          onToggleStaffDone?.(selectedEvent.id, staff.employeeId, e.target.checked, staff.id || staff.autoKey)
                                        )}
                                      />
                                      Xong ({slot.assigned.length})
                                    </label>
                                  )}
                                </div>
                              </div>
                              <div className="mt-3 grid grid-cols-1 gap-3 items-center">
                                <select
                                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-100"
                                  value=""
                                  onChange={e => assignEmployeeToStaffSlot(slot, e.target.value)}
                                  disabled={!canEdit}
                                >
                                  <option value="">+ Thêm nhân sự cho trạm này</option>
                                  {availableEmployees.map(emp => (
                                    <option key={emp.id} value={emp.id}>
                                      {registeredEmployeeIds.has(emp.id) ? '★ ' : ''}{emp.name} ({emp.role}){registeredEmployeeIds.has(emp.id) ? ' - Đã đăng ký' : ''}
                                    </option>
                                  ))}
                                </select>
                                {slot.assigned.length > 0 && (
                                  <div className="space-y-2">
                                    {assignedEmployees.map(({ staff, employee }) => (
                                      <div key={staff.id || `${slot.key}-${staff.employeeId}`} className="flex items-center justify-between gap-3 rounded-lg border border-teal-100 bg-white px-3 py-2">
                                        <div>
                                          <p className="text-sm font-black text-slate-800">{employee?.name || staff.employeeId}</p>
                                          <p className="text-[11px] font-semibold text-teal-700">{employee?.role || 'Nhân sự'}{staff.done ? ' • Đã xong' : ''}</p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => removeEmployeeFromStaffSlot(slot, staff.id || '')}
                                          disabled={!canEdit || !staff.id}
                                          className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-400 hover:text-red-500 disabled:opacity-50"
                                          title="Gỡ nhân sự khỏi slot"
                                        >
                                          <Trash2 size={15}/>
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white border border-slate-100 px-3 py-2">
                                <p className="text-[11px] text-slate-500">{getStaffCompensationNote(slot.hours)} / người</p>
                                <p className="text-sm font-black text-teal-700">{slot.salary.toLocaleString()}đ/người</p>
                              </div>
                              {assignedEmployees.length > 0 && (
                                <p className="mt-2 text-xs font-semibold text-teal-700">
                                  Đang giao cho {assignedEmployees.map(item => item.employee?.name || item.staff.employeeId).join(', ')}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                        Chưa có trạm trong DESIGN hoặc Sơ đồ trạm. Khi thêm trạm/khu vực, danh sách slot nhân sự sẽ tự hiện ở đây.
                      </div>
                    )}
                  </div>

                   <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm space-y-4">
                    <h4 className="font-bold text-gray-700 text-xs uppercase flex items-center gap-2"><UserCheck size={16} className="text-blue-500"/> Phân công ngoài slot</h4>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        className="border border-slate-200 rounded-lg p-2 text-sm"
                        placeholder="Tìm nhanh tên nhân sự..."
                        value={staffSearchTerm}
                        onChange={e => setStaffSearchTerm(e.target.value)}
                      />
                      <select className="border border-slate-200 rounded-lg p-2 text-sm bg-white" value={selectedStaffId} onChange={e => handleStaffSelect(e.target.value)}>
                        <option value="">-- Chọn nhân viên --</option>
                        {assignableEmployees.map(e => (
                          <option key={e.id} value={e.id}>
                            {registeredEmployeeIds.has(e.id) ? '★ ' : ''}{e.name} ({e.role}){registeredEmployeeIds.has(e.id) ? ' - Đã đăng ký' : ''}
                          </option>
                        ))}
                      </select>
                      <input className="border border-slate-200 rounded-lg p-2 text-sm" placeholder="Nhiệm vụ..." value={staffTask} onChange={e => setStaffTask(e.target.value)} />
                    </div>
                    {staffSearchTerm && assignableEmployees.length === 0 && (
                      <p className="text-xs text-amber-600">Không tìm thấy nhân sự đang làm phù hợp.</p>
                    )}
                      {/* Shift picker: show dates between start and end and allow picking Sáng/Chiều/Tối */}
                      {selectedEvent && (
                        <div className="mt-3">
                          <p className="text-xs font-black text-gray-400 uppercase mb-2">Chọn ngày & ca (tối đa 2 ca)</p>
                          <div className="flex gap-2 overflow-auto pb-2">
                            {(() => {
                              const start = new Date(selectedEvent.startDate);
                              const end = new Date(selectedEvent.endDate || selectedEvent.startDate);
                              const dates: Date[] = [];
                              for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                                dates.push(new Date(d));
                              }
                              return dates.map(dt => {
                                const iso = dt.toISOString().slice(0,10);
                                const display = dt.toLocaleDateString('vi-VN');
                                return (
                                  <div key={iso} className="min-w-[140px] p-2 bg-white rounded-lg border border-slate-100">
                                    <div className="text-[12px] font-black text-slate-600">{display}</div>
                                          <div className="flex gap-2 mt-2">
                                            {(() => {
                                              const sessionsForDate = getEventSchedule(selectedEvent).find(s => s.date === iso)?.sessions || [];
                                              const buttonsToRender: EventSession[] = sessionsForDate.length > 0 ? sessionsForDate : ['MORNING','AFTERNOON','EVENING'];
                                              return buttonsToRender.map(sess => (
                                                <button
                                                  key={sess}
                                                  onClick={() => handleSessionToggle(iso, sess)}
                                                  className={`flex-1 text-xs py-1 rounded ${selectedShiftDate === iso && selectedSessions.includes(sess) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                                                >
                                                  {sess === 'MORNING' ? 'SÁNG' : sess === 'AFTERNOON' ? 'CHIỀU' : 'TỐI'}
                                                </button>
                                              ));
                                            })()}
                                          </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                          {selectedShiftDate && selectedSessions.length > 0 && (
                            <div className="mt-2 text-[12px] text-slate-500">
                              Đang chọn: <span className="font-bold text-slate-700">{new Date(selectedShiftDate).toLocaleDateString('vi-VN')}</span> • <span className="font-black">{selectedSessions.map(s => SESSION_LABELS[s]).join(', ')}</span>
                            </div>
                          )}
                        </div>
                      )}
                    <div className="grid grid-cols-4 gap-3 items-center">
                      <select 
                        className="border border-slate-200 rounded-lg p-2 text-sm bg-white" 
                        value={staffUnit} 
                        onChange={e => {
                          const value = e.target.value as 'HOUR' | 'DAY' | 'FIXED';
                          setStaffUnit(value);
                          if (value === 'FIXED') setStaffQty(1);
                          if (value === 'HOUR') setStaffQty(selectedSessions.length > 0 ? getStaffWorkHours(selectedSessions) : 4);
                        }}
                      >
                        <option value="HOUR">Theo Giờ</option>
                        <option value="DAY">Theo Ngày</option>
                        <option value="FIXED">Trọn gói</option>
                      </select>
                      <div className="border border-slate-200 rounded-lg p-2 bg-slate-50">
                        <p className="text-[10px] font-black text-slate-500 uppercase leading-tight">Ca đã chọn</p>
                        <p className="text-xs text-slate-700 font-semibold">
                          {selectedShiftDate && selectedSessions.length > 0 
                            ? `${new Date(selectedShiftDate).toLocaleDateString('vi-VN')} • ${selectedSessions.map(s => SESSION_LABELS[s]).join(', ')}`
                            : 'Chưa chọn'}
                        </p>
                      </div>
                      {staffUnit !== 'FIXED' ? (
                        <input
                          type="number"
                          className="border border-slate-200 rounded-lg p-2 text-sm text-center"
                          placeholder={staffUnit === 'HOUR' ? 'Số giờ' : 'Số ngày'}
                          value={staffQty}
                          onChange={e => setStaffQty(Number(e.target.value))}
                          readOnly={staffUnit === 'HOUR' && selectedSessions.length > 0}
                        />
                      ) : (
                        <div className="border border-slate-200 rounded-lg p-2 text-sm text-center text-slate-500 bg-slate-50 font-semibold">Trọn gói</div>
                      )}
                      <input type="number" className="border border-slate-200 rounded-lg p-2 text-sm font-bold text-blue-600" placeholder="Đơn giá" value={staffRate} onChange={e => setStaffRate(e.target.value)} />
                    </div>
                    {staffUnit === 'HOUR' && (
                      <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-blue-700 font-semibold">
                          {getStaffCompensationNote(Number(staffQty) || 0, Number(staffRate) || STAFF_HOURLY_RATE)}
                        </p>
                        <p className="text-sm font-black text-blue-800">
                          {calculateStaffCompensation(Number(staffQty) || 0, Number(staffRate) || STAFF_HOURLY_RATE).total.toLocaleString()}đ
                        </p>
                      </div>
                    )}
                    <button onClick={handleStaffAssignSubmit} className="w-full bg-slate-800 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-slate-900 transition shadow-sm">Thêm nhân sự</button>
                  </div>

                  <div className="space-y-3">
                    {staffCostGroups.map(group => {
                      const emp = employees.find(e => e.id === group.employeeId);
                      const primaryAllocation = group.items[0]?.allocation;
                      const isGrouped = group.items.length > 1;
                      const hasAutoSlot = group.items.some(item => item.allocation.source === AUTO_STAFF_SLOT_SOURCE);
                      const allDone = group.items.every(item => !!item.allocation.done);
                      const groupDateLabel = group.shiftDate ? new Date(group.shiftDate).toLocaleDateString('vi-VN') : '';
                      const handleToggleGroupDone = (done: boolean) => {
                        group.items.forEach(item => {
                          const key = item.allocation.id || item.allocation.autoKey || item.key;
                          onToggleStaffDone?.(selectedEvent.id, item.allocation.employeeId, done, key);
                        });
                      };
                      const handleRemoveGroup = () => {
                        group.items.forEach(item => {
                          const key = item.allocation.id || item.allocation.autoKey || item.key;
                          onRemoveStaff?.(selectedEvent.id, item.allocation.employeeId, key);
                        });
                      };
                      return (
                        <div key={group.key} className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center gap-4 hover:shadow-md transition">
                           <div className="flex items-center gap-4">
                              <img src={emp?.avatarUrl} className="w-12 h-12 rounded-full border-2 border-slate-100" />
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-bold text-gray-800">{emp?.name}</p>
                                  {hasAutoSlot && (
                                    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-black text-teal-700">
                                      Tự động từ trạm
                                    </span>
                                  )}
                                  {group.isDayPolicyGroup && (
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">
                                      Gộp chính sách ngày
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs font-medium text-blue-600">
                                  {isGrouped
                                    ? `${group.items.length} phân công • ${group.totalHours} giờ`
                                    : `${primaryAllocation?.task || 'Phân công'} • ${primaryAllocation?.unit === 'FIXED' ? 'Trọn gói' : `${primaryAllocation?.quantity || group.totalHours} ${primaryAllocation?.unit === 'DAY' ? 'ngày' : 'giờ'}`}`}
                                </p>
                                {group.stationNames.length > 0 && (
                                  <p className="text-[11px] text-teal-700 font-semibold mt-0.5">Trạm: {group.stationNames.join(', ')}</p>
                                )}
                                {group.sessions.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {group.sessions.map(sess => (
                                      <div key={sess} className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                                        {SESSION_LABELS[sess]}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {isGrouped && (
                                  <div className="mt-2 space-y-0.5">
                                    {group.items.map(item => {
                                      const allocationSessions = getStaffSessions(item.allocation);
                                      const allocationSessionLabel = allocationSessions.map(sess => SESSION_LABELS[sess]).join(' + ');
                                      return (
                                        <p key={item.key} className="text-[11px] font-semibold text-slate-500">
                                          {allocationSessionLabel ? `${allocationSessionLabel} • ` : ''}{item.allocation.task} • {item.hours || item.allocation.quantity} giờ
                                        </p>
                                      );
                                    })}
                                  </div>
                                )}
                                {groupDateLabel && (
                                  <div className="text-[11px] text-slate-400 mt-1">{groupDateLabel}</div>
                                )}
                              </div>
                           </div>
                           <div className="flex items-center gap-6">
                              <div className="flex items-center gap-3">
                                <input type="checkbox" checked={allDone} onChange={e => handleToggleGroupDone(e.target.checked)} />
                                <div className="text-right">
                                  <p className="font-black text-gray-800">{group.totalSalary.toLocaleString()}đ</p>
                                  {group.isDayPolicyGroup && (
                                    <p className="text-[10px] font-bold text-amber-600">8h/ngày - trần 310k</p>
                                  )}
                                </div>
                              </div>
                              <button onClick={handleRemoveGroup} className="text-gray-300 hover:text-red-500"><Trash2 size={16}/></button>
                           </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {detailTab === 'LAYOUT' && selectedEvent && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 h-full">
                    <div>
                      <p className="text-[11px] font-black uppercase text-slate-400">Dashbroad vị trí nhân sự</p>
                      <p className="text-sm font-bold text-slate-700">Tạo block, gắn gói hoạt động và người phụ trách.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase">Tên trạm / khu vực</label>
                      <input 
                        className={`w-full border border-slate-200 rounded-lg p-2.5 text-sm ${canEdit ? 'bg-white' : 'bg-slate-100 text-slate-500'}`}
                        placeholder="VD: Trạm check-in, Khu trải nghiệm 1..."
                        value={layoutForm.name}
                        onChange={e => setLayoutForm(prev => ({ ...prev, name: e.target.value }))}
                        disabled={!canEdit}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase">Gắn gói hoạt động</label>
                      {(() => {
                        const selectedValue = layoutForm.packageSource === 'CUSTOM' 
                          ? 'CUSTOM' 
                          : layoutPackageOptions.find(opt => opt.rawId === layoutForm.packageId && opt.source === layoutForm.packageSource)?.value || '';
                        return (
                          <select
                            className={`w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none ${canEdit ? 'bg-white' : 'bg-slate-100 text-slate-500'}`}
                            value={selectedValue}
                            onChange={e => {
                              const val = e.target.value;
                              if (val === 'CUSTOM') {
                                setLayoutForm(prev => ({ ...prev, packageId: '', packageName: '', packageSource: 'CUSTOM', customPackageName: '' }));
                                return;
                              }
                              const opt = layoutPackageOptions.find(o => o.value === val);
                              if (opt) {
                                setLayoutForm(prev => ({ ...prev, packageId: opt.rawId, packageName: opt.displayName, packageSource: opt.source, customPackageName: '' }));
                              } else {
                                setLayoutForm(prev => ({ ...prev, packageId: '', packageName: '', packageSource: 'QUOTATION', customPackageName: '' }));
                              }
                            }}
                            disabled={!canEdit}
                          >
                            <option value="">-- Chọn từ báo giá hoặc gói có sẵn --</option>
                            {layoutPackageOptions.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                            <option value="CUSTOM">+ Thêm gói khác</option>
                          </select>
                        );
                      })()}
                      {layoutForm.packageSource === 'CUSTOM' && (
                        <input 
                          className={`w-full border border-slate-200 rounded-lg p-2.5 text-sm ${canEdit ? 'bg-white' : 'bg-slate-100 text-slate-500'}`}
                          placeholder="Nhập tên gói bổ sung..."
                          value={layoutForm.customPackageName}
                          onChange={e => setLayoutForm(prev => ({ ...prev, customPackageName: e.target.value }))}
                          disabled={!canEdit}
                        />
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase">Nhân sự phụ trách</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select 
                          className={`border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none ${canEdit ? 'bg-white' : 'bg-slate-100 text-slate-500'}`}
                          value={layoutForm.staffId}
                          onChange={e => {
                            const id = e.target.value;
                            const emp = employees.find(emp => emp.id === id);
                            setLayoutForm(prev => ({ ...prev, staffId: id, staffName: emp?.name || prev.staffName }));
                          }}
                          disabled={!canEdit}
                        >
                          <option value="">-- Chọn từ danh sách nhân sự --</option>
                          {activeEmployees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                          ))}
                        </select>
                        <input
                          className={`border border-slate-200 rounded-lg p-2.5 text-sm ${canEdit ? 'bg-white' : 'bg-slate-100 text-slate-500'}`}
                          placeholder="Hoặc nhập nhanh tên nhân sự khác"
                          value={layoutForm.staffName}
                          onChange={e => setLayoutForm(prev => ({ ...prev, staffName: e.target.value }))}
                          disabled={!canEdit}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase">Màu block</label>
                      <div className="flex flex-wrap gap-2">
                        {LAYOUT_COLORS.map(color => (
                          <button
                            key={color}
                            onClick={() => setLayoutForm(prev => ({ ...prev, color }))}
                            className={`w-8 h-8 rounded-full border-2 ${layoutForm.color === color ? 'border-slate-900 scale-105' : 'border-slate-200'} transition ${canEdit ? '' : 'opacity-50 cursor-not-allowed'}`}
                            style={{ backgroundColor: color }}
                            title={color}
                            disabled={!canEdit}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        onClick={handleSaveLayoutBlock}
                        disabled={!canEdit}
                        className={`w-full py-2.5 rounded-lg text-sm font-bold transition shadow-sm ${canEdit ? 'bg-slate-900 text-white hover:bg-black' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
                      >
                        {editingBlockId ? 'Lưu thay đổi block' : '+ Thêm block vào sơ đồ'}
                      </button>
                      {editingBlockId && (
                        <button
                          onClick={resetLayoutForm}
                          disabled={!canEdit}
                          className={`w-full py-2.5 rounded-lg text-sm font-bold transition shadow-sm ${canEdit ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                        >
                          Hủy chỉnh sửa
                        </button>
                      )}
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                      <p className="text-xs font-black uppercase text-slate-400 mb-2 flex items-center gap-2"><Layers size={14}/> Danh sách block</p>
                      <div className="space-y-2 max-h-[260px] overflow-auto pr-1">
                        {eventLayout.blocks.length === 0 && (
                          <div className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg">Chưa có block nào. Thêm block và kéo sang mặt bằng.</div>
                        )}
                        {eventLayout.blocks.map(block => (
                          <div 
                            key={block.id} 
                            onClick={() => {
                              if (!canEdit) return;
                              setSelectedLayoutBlockId(block.id);
                              setEditingBlockId(block.id);
                              setLayoutForm({
                                name: block.name,
                                packageId: block.packageId || '',
                                packageName: block.packageName || '',
                                packageSource: block.packageSource || 'QUOTATION',
                                customPackageName: block.packageSource === 'CUSTOM' ? block.packageName || '' : '',
                                staffId: block.staffId || '',
                                staffName: block.staffName || '',
                                color: block.color || LAYOUT_COLORS[0]
                              });
                            }}
                            className={`p-3 rounded-xl border flex justify-between items-start gap-3 ${canEdit ? 'cursor-pointer transition' : 'bg-slate-50 cursor-not-allowed'} ${selectedLayoutBlockId === block.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-slate-50/60 hover:border-blue-200 hover:bg-blue-50/60'}`}
                          >
                            <div className="flex items-start gap-3">
                              <span className="w-3 h-3 rounded-full mt-1" style={{ backgroundColor: block.color }}></span>
                              <div>
                                <p className="font-black text-slate-800 text-sm">{block.name}</p>
                                {block.packageName && <p className="text-[11px] text-slate-500">{block.packageName}</p>}
                                {block.staffName && <p className="text-[11px] text-blue-600 font-semibold">{block.staffName}</p>}
                              </div>
                            </div>
                            <button 
                              onClick={e => { e.stopPropagation(); if (canEdit) handleRemoveLayoutBlock(block.id); }}
                              disabled={!canEdit}
                              className={`text-gray-300 ${canEdit ? 'hover:text-red-500' : 'opacity-50 cursor-not-allowed'}`}
                            >
                              <Trash2 size={14}/>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black uppercase text-slate-400">Mặt bằng & bố trí</p>
                        <p className="text-sm text-slate-600">Tải ảnh mặt bằng, kéo thả block để đặt khu vực và nhân sự.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold ${canEdit ? 'bg-blue-600 text-white cursor-pointer hover:bg-blue-700' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}>
                          <Upload size={16}/> Tải ảnh mặt bằng
                          <input type="file" accept="image/*" className="hidden" onChange={e => canEdit && handleFloorplanUpload(e.target.files?.[0])} disabled={!canEdit} />
                        </label>
                        {eventLayout.floorplanImage && (
                          <button onClick={handleRemoveFloorplan} disabled={!canEdit} className={`px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${canEdit ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
                            <X size={16}/> Xóa ảnh
                          </button>
                        )}
                        <button onClick={() => setShowLayoutFullscreen(true)} className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-black flex items-center gap-2">
                          <MapPin size={16}/> Toàn màn hình
                        </button>
                        <button onClick={handlePrintLayout} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 flex items-center gap-2">
                          <Printer size={16}/> In sơ đồ trạm
                        </button>
                      </div>
                    </div>

                    {renderLayoutBoard('main')}
                  </div>
                </div>
              )}

              {detailTab === 'EH_CONTROL' && selectedEvent && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                          <Radio size={18} className="text-blue-600"/> Overview chương trình
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">Một hồ sơ sự kiện dùng chung, nhiều chương trình nội dung vận hành độc lập.</p>
                      </div>
                      <button
                        type="button"
                        onClick={createContentProgramClone}
                        disabled={!canEdit || !onUpdateEvent}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-black text-white hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-500"
                      >
                        <Plus size={16}/> Clone chương trình
                      </button>
                    </div>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">
                        <p className="text-[11px] font-black uppercase text-teal-700">Số chương trình</p>
                        <p className="mt-1 text-2xl font-black text-teal-800">{contentProgramViews.length}</p>
                      </div>
                      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                        <p className="text-[11px] font-black uppercase text-blue-700">Tổng trạm</p>
                        <p className="mt-1 text-2xl font-black text-blue-800">
                          {contentProgramViews.reduce((sum, program) => sum + (program.houseOperation?.stations?.length || 0), 0)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                        <p className="text-[11px] font-black uppercase text-amber-700">Incident mở</p>
                        <p className="mt-1 text-2xl font-black text-amber-800">
                          {contentProgramViews.reduce((sum, program) => sum + (program.houseOperation?.incidents?.filter(incident => incident.status === 'OPEN').length || 0), 0)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {contentProgramViews.map(program => {
                      const operation = program.houseOperation;
                      const doneTasks = operation?.tasks?.filter(task => task.status === 'DONE').length || 0;
                      const totalTasks = operation?.tasks?.length || 0;
                      const agenda = operation?.agenda || [];
                      const firstAgenda = agenda[0];
                      const lastAgenda = agenda[agenda.length - 1];
                      const isSelected = activeContentProgram?.id === program.id;
                      return (
                        <button
                          key={program.id}
                          type="button"
                          onClick={() => setActiveContentProgramId(program.id)}
                          className={`rounded-xl border p-5 text-left transition ${
                            isSelected
                              ? 'border-teal-500 bg-teal-50 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-teal-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-base font-black text-slate-900">{program.name}</p>
                              <p className="mt-1 text-xs font-semibold text-slate-500">{getProgramDateLabel(program, selectedEvent)}</p>
                            </div>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-black ${program.isPrimary ? 'bg-slate-100 text-slate-600' : 'bg-teal-100 text-teal-700'}`}>
                              {program.isPrimary ? 'Gốc' : 'Clone'}
                            </span>
                          </div>
                          <div className="mt-4 grid grid-cols-3 gap-2">
                            <div className="rounded-lg bg-white/80 border border-slate-100 p-3">
                              <p className="text-[10px] font-black uppercase text-slate-400">Trạm</p>
                              <p className="text-lg font-black text-slate-800">{operation?.stations?.length || 0}</p>
                            </div>
                            <div className="rounded-lg bg-white/80 border border-slate-100 p-3">
                              <p className="text-[10px] font-black uppercase text-slate-400">Tasks</p>
                              <p className="text-lg font-black text-slate-800">{doneTasks}/{totalTasks}</p>
                            </div>
                            <div className="rounded-lg bg-white/80 border border-slate-100 p-3">
                              <p className="text-[10px] font-black uppercase text-slate-400">Sơ đồ</p>
                              <p className="text-lg font-black text-slate-800">{program.layout?.blocks?.length || 0}</p>
                            </div>
                          </div>
                          <p className="mt-3 text-xs text-slate-500">
                            Agenda: {firstAgenda && lastAgenda ? `${firstAgenda.startTime} - ${lastAgenda.endTime}` : 'Chưa khởi tạo'}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {getHouseModuleTab(detailTab) && detailTab !== 'EH_CONTROL' && selectedEvent && (
                <EinsteinHouseOS
                  events={eventsForActiveContent}
                  inventory={inventory}
                  employees={employees}
                  packages={packages}
                  educationActivities={educationActivities}
                  learningTracks={learningTracks}
                  canEdit={canEdit && !!onUpdateEvent}
                  embedded
                  lockEventSelection
                  activeModuleTab={getHouseModuleTab(detailTab) || undefined}
                  initialEventId={selectedEvent.id}
                  liveProgramId={activeContentProgram?.id}
                  onUpdateEvent={handleUpdateActiveContentEvent}
                />
              )}

              {detailTab === 'PROFILE' && selectedEvent && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-gray-800 text-xs uppercase flex items-center gap-2">
                        <BookOpen size={16} className="text-blue-600" /> Hồ sơ sự kiện (Event Profile)
                      </h4>
                      <span className="text-[11px] text-slate-500 font-semibold">Tự động lấy từ thông tin sự kiện{canEditProfile ? ', cho phép admin bổ sung chi tiết' : ' • Chế độ chỉ xem'}</span>
                    </div>

                    {!canEditProfile && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-600">
                        Chỉ Admin được chỉnh sửa Hồ sơ sự kiện. Bạn đang xem ở chế độ đọc.
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h5 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Thông tin định danh</h5>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Mã sự kiện (auto)</label>
                          <input className="w-full border rounded-xl p-3 text-sm bg-slate-50 font-bold text-slate-700" value={eventProfile.code || ''} readOnly />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Tên sự kiện</label>
                          <input className="w-full border rounded-xl p-3 text-sm bg-slate-50" value={selectedEvent.name} readOnly />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Đơn vị / Trường</label>
                          <input 
                            className="w-full border rounded-xl p-3 text-sm"
                            placeholder="Tên đầy đủ"
                            value={eventProfile.organization || ''}
                            onChange={e => updateEventProfile({ organization: e.target.value })}
                            disabled={!canEditProfile}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Loại sự kiện</label>
                          <select 
                            className="w-full border rounded-xl p-3 text-sm bg-white"
                            value={eventProfile.eventType || ''}
                            onChange={e => updateEventProfile({ eventType: (e.target.value || undefined) as EventProfile['eventType'] })}
                            disabled={!canEditProfile}
                          >
                            <option value="">-- Chọn loại sự kiện --</option>
                            {EVENT_TYPE_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Ngày tổ chức + Thứ</label>
                          <input className="w-full border rounded-xl p-3 text-sm bg-slate-50" value={eventDateLabel || 'Chưa cập nhật'} readOnly />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2">
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Khung giờ chương trình</label>
                            <div className="flex items-center gap-2">
                              <input 
                                type="time"
                                className="w-full border rounded-xl p-3 text-sm"
                                value={eventProfile.programTimeStart || ''}
                                onChange={e => updateEventProfile({ programTimeStart: e.target.value })}
                                disabled={!canEditProfile}
                              />
                              <span className="text-slate-400 text-sm">–</span>
                              <input 
                                type="time"
                                className="w-full border rounded-xl p-3 text-sm"
                                value={eventProfile.programTimeEnd || ''}
                                onChange={e => updateEventProfile({ programTimeEnd: e.target.value })}
                                disabled={!canEditProfile}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Buổi</label>
                            <select 
                              className="w-full border rounded-xl p-3 text-sm bg-white"
                              value={eventProfile.programSession || ''}
                              onChange={e => {
                                const nextSession = (e.target.value || undefined) as EventSession | undefined;
                                const defaults = getDefaultProfileTimeRange(nextSession);
                                updateEventProfile({
                                  programSession: nextSession,
                                  programTimeStart: defaults.start,
                                  programTimeEnd: defaults.end
                                });
                              }}
                              disabled={!canEditProfile}
                            >
                              <option value="">-- Buổi --</option>
                              {SESSION_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Địa chỉ chi tiết</label>
                          <input 
                            className="w-full border rounded-xl p-3 text-sm"
                            placeholder="Số nhà, phường/quận..."
                            value={eventProfile.addressDetail || ''}
                            onChange={e => updateEventProfile({ addressDetail: e.target.value })}
                            disabled={!canEditProfile}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Google Map link</label>
                          <input 
                            className="w-full border rounded-xl p-3 text-sm"
                            placeholder="https://maps.google.com/..."
                            value={eventProfile.mapLink || ''}
                            onChange={e => updateEventProfile({ mapLink: e.target.value })}
                            disabled={!canEditProfile}
                          />
                        </div>
                        <div className="md:col-span-3">
                          <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Khu vực set-up</label>
                          <input 
                            className="w-full border rounded-xl p-3 text-sm"
                            placeholder="Ví dụ: sân/sảnh – STEAM Zone"
                            value={eventProfile.setupArea || ''}
                            onChange={e => updateEventProfile({ setupArea: e.target.value })}
                            disabled={!canEditProfile}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h5 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Mục tiêu & Phạm vi</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <div className="flex items-center justify-between gap-2">
                            <label className="block text-[10px] font-black text-gray-400 uppercase">Mục tiêu chung</label>
                            <button 
                              type="button"
                              onClick={generateAiGoal}
                              disabled={!canEditProfile}
                              className={`text-[11px] font-bold px-3 py-1 rounded-lg border ${canEditProfile ? 'border-blue-200 text-blue-600 hover:bg-blue-50' : 'border-slate-200 text-slate-400 cursor-not-allowed'}`}
                            >
                              Gợi ý mục tiêu (AI)
                            </button>
                          </div>
                          <textarea 
                            rows={3}
                            className="w-full border rounded-xl p-3 text-sm"
                            placeholder="3–5 dòng mô tả mục tiêu"
                            value={eventProfile.generalGoal || ''}
                            onChange={e => updateEventProfile({ generalGoal: e.target.value })}
                            disabled={!canEditProfile}
                          />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                          <p className="text-[10px] font-black text-gray-400 uppercase">Phạm vi bán hàng</p>
                          <div className="flex flex-wrap gap-2">
                            {SALES_SCOPE_OPTIONS.map(opt => {
                              const active = eventProfile.salesScope === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => updateEventProfile({ salesScope: opt.value, salesScopeNote: opt.value === 'CUSTOM' ? eventProfile.salesScopeNote : undefined })}
                                  className={`px-3 py-2 rounded-xl border text-sm font-semibold transition ${active ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'} ${!canEditProfile ? 'opacity-60 cursor-not-allowed' : ''}`}
                                  disabled={!canEditProfile}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                          {eventProfile.salesScope === 'CUSTOM' && (
                            <input 
                              className="w-full border rounded-xl p-3 text-sm"
                              placeholder="Ghi chú phạm vi bán hàng"
                              value={eventProfile.salesScopeNote || ''}
                              onChange={e => updateEventProfile({ salesScopeNote: e.target.value })}
                              disabled={!canEditProfile}
                            />
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:col-span-2">
                          <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Mục tiêu doanh thu (đ)</label>
                            <input 
                              type="number"
                              className="w-full border rounded-xl p-3 text-sm"
                              placeholder="0"
                              value={eventProfile.saleRevenueTarget ?? ''}
                              onChange={e => updateEventProfile({ saleRevenueTarget: e.target.value === '' ? undefined : Number(e.target.value) })}
                              disabled={!canEditProfile}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Giá trị hàng hóa mang đi (đ)</label>
                            <input 
                              className="w-full border rounded-xl p-3 text-sm bg-slate-50"
                              value={saleGoodsValue.toLocaleString()}
                              readOnly
                            />
                          </div>
                        </div>
                        <div>
                          <p className="block text-[10px] font-black text-gray-400 uppercase mb-2">Đối tượng tham gia</p>
                          <div className="grid grid-cols-2 gap-2">
                            {AUDIENCE_OPTIONS.map(opt => (
                              <label key={opt.value} className="inline-flex items-center gap-2 text-sm text-slate-700">
                                <input 
                                  type="checkbox"
                                  checked={(eventProfile.audience || []).includes(opt.value)}
                                  onChange={() => toggleAudience(opt.value)}
                                  disabled={!canEditProfile}
                                />
                                {opt.label}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Quy mô min</label>
                            <input 
                              type="number"
                              className="w-full border rounded-xl p-3 text-sm"
                              placeholder="0"
                              value={eventProfile.attendanceMin ?? ''}
                              onChange={e => updateEventProfile({ attendanceMin: e.target.value === '' ? undefined : Number(e.target.value) })}
                              disabled={!canEditProfile}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Quy mô max</label>
                            <input 
                              type="number"
                              className="w-full border rounded-xl p-3 text-sm"
                              placeholder="0"
                              value={eventProfile.attendanceMax ?? ''}
                              onChange={e => updateEventProfile({ attendanceMax: e.target.value === '' ? undefined : Number(e.target.value) })}
                              disabled={!canEditProfile}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h5 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Bên liên quan (Stakeholders)</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Đơn vị phối hợp / BTC</label>
                          <input 
                            className="w-full border rounded-xl p-3 text-sm"
                            placeholder="Tên đơn vị phối hợp"
                            value={eventProfile.partnerOrg || ''}
                            onChange={e => updateEventProfile({ partnerOrg: e.target.value })}
                            disabled={!canEditProfile}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">PIC Einstein Bus</label>
                          <input 
                            className="w-full border rounded-xl p-3 text-sm"
                            placeholder="Tên người phụ trách"
                            value={eventProfile.einsteinPic || ''}
                            onChange={e => updateEventProfile({ einsteinPic: e.target.value })}
                            disabled={!canEditProfile}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Đầu mối phía trường - Tên</label>
                          <input 
                            className="w-full border rounded-xl p-3 text-sm"
                            placeholder="Tên"
                            value={eventProfile.schoolContact?.name || ''}
                            onChange={e => updateSchoolContact({ name: e.target.value })}
                            disabled={!canEditProfile}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">SĐT</label>
                          <input 
                            className="w-full border rounded-xl p-3 text-sm"
                            placeholder="Số điện thoại"
                            value={eventProfile.schoolContact?.phone || ''}
                            onChange={e => updateSchoolContact({ phone: e.target.value })}
                            disabled={!canEditProfile}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Zalo</label>
                          <input 
                            className="w-full border rounded-xl p-3 text-sm"
                            placeholder="Zalo"
                            value={eventProfile.schoolContact?.zalo || ''}
                            onChange={e => updateSchoolContact({ zalo: e.target.value })}
                            disabled={!canEditProfile}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Vai trò</label>
                          <input 
                            className="w-full border rounded-xl p-3 text-sm"
                            placeholder="Vai trò"
                            value={eventProfile.schoolContact?.role || ''}
                            onChange={e => updateSchoolContact({ role: e.target.value })}
                            disabled={!canEditProfile}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Tóm tắt hồ sơ tự sinh</p>
                      <div className="space-y-1 text-sm text-slate-700">
                        {eventProfileSummary.map((line, idx) => (
                          <p key={idx}>{line}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'COSTS' && (
                <div className="space-y-6">
                  {/* QUOTATION LINK SECTION */}
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 rounded-2xl text-white shadow-xl space-y-4">
                    <div className="flex justify-between items-center">
                       <h4 className="font-black text-xs uppercase flex items-center gap-2 tracking-widest">
                         <LinkIcon size={16} /> Liên kết báo giá khách hàng
                       </h4>
                       {linkedQuotation && (
                         <span className="bg-white/20 px-3 py-1 rounded text-[10px] font-black uppercase">ĐÃ XÁC NHẬN DOANH THU</span>
                       )}
                    </div>
                    
                    <div className="flex gap-3">
                      <select 
                        className="flex-1 border-none rounded-xl p-3 text-sm bg-white/10 text-white outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-md"
                        value={selectedEvent.quotationId || ''}
                        onChange={e => handleLinkQuotation(e.target.value)}
                      >
                        <option value="" className="text-gray-800 font-bold">-- Chọn báo giá để tính lợi nhuận --</option>
                        {quotations.map(q => (
                          <option key={q.id} value={q.id} className="text-gray-800 font-medium">
                            {q.id} - {q.clientName} ({q.totalAmount.toLocaleString()}đ)
                          </option>
                        ))}
                      </select>
                      {selectedEvent.quotationId && (
                        <button 
                          onClick={() => handleLinkQuotation('')}
                          className="bg-red-500 hover:bg-red-600 p-3 rounded-xl transition shadow-lg"
                        >
                          <X size={20} />
                        </button>
                      )}
                    </div>
                    
                    {!selectedEvent.quotationId && (
                      <div className="flex items-center gap-2 bg-black/20 p-3 rounded-xl">
                        <AlertCircle size={16} className="text-yellow-300" />
                        <p className="text-[11px] text-blue-50 font-medium italic">
                          Vui lòng chọn báo giá để hệ thống tính toán Doanh thu và Lợi nhuận gộp cho sự kiện này.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* SALE ORDER LINK SECTION */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-gray-800 text-xs uppercase flex items-center gap-2">
                        <LinkIcon size={16} className="text-green-600" /> Gán đơn hàng bán cho sự kiện
                      </h4>
                      <span className="text-[11px] text-slate-500 font-semibold">{linkedSaleOrders.length} đơn đã gán</span>
                    </div>
                    <div className="flex gap-3">
                      <select
                        className="flex-1 border rounded-xl p-3 text-sm bg-white"
                        value=""
                        onChange={e => {
                          const id = e.target.value;
                          if (!id) return;
                          onLinkSaleOrder?.(selectedEvent.id, id, true);
                        }}
                      >
                        <option value="">-- Chọn đơn bán để gán --</option>
                        {selectableSaleOrders.map(order => (
                          <option key={order.id} value={order.id}>
                            {order.id} • {order.customerName || 'Khách lẻ'} • {order.total?.toLocaleString()}đ
                            {order.eventId && order.eventId !== selectedEvent.id ? ' (Đang gán sự kiện khác)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    {linkedSaleOrders.length > 0 ? (
                      <div className="space-y-2">
                        {linkedSaleOrders.map(order => (
                          <div key={order.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <div>
                              <p className="font-bold text-slate-800 text-sm">{order.id} • {order.customerName || 'Khách lẻ'}</p>
                              <p className="text-[11px] text-slate-500">{order.date} • {order.items?.length || 0} dòng</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-black text-green-600 text-sm">{(order.total || 0).toLocaleString()}đ</span>
                              <button onClick={() => onLinkSaleOrder?.(selectedEvent.id, order.id, false)} className="text-gray-300 hover:text-red-500">
                                <Trash2 size={16}/>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic">Chưa gán đơn bán nào. Gán để tính doanh thu tổng.</div>
                    )}
                  </div>

                  {/* ADVANCE REQUESTS */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-gray-800 text-xs uppercase flex items-center gap-2">
                        <Wallet size={16} className="text-amber-600" /> Yêu cầu tạm ứng
                      </h4>
                      <span className="text-[11px] text-slate-500 font-semibold">Tổng yêu cầu: {totalAdvanceAmount.toLocaleString()}đ</span>
                    </div>
                    {autoAdvancePlan && (
                      <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-widest text-amber-700">Tạm ứng tự động từ Hồ sơ sự kiện</p>
                            <p className="mt-1 text-sm text-amber-900">
                              {autoAdvancePlan.summary.venue === 'EBUS' ? 'Bên ngoài EBUS' : 'Tại EH'} • {autoAdvancePlan.summary.route.label} • {Math.round(autoAdvancePlan.summary.route.roundTripKm)}km khứ hồi • {autoAdvancePlan.summary.dayCount} ngày
                            </p>
                            <p className="mt-1 text-[11px] text-amber-700">
                              {autoAdvancePlan.summary.route.basis} • {autoAdvancePlan.summary.staffCount} nhân sự
                              {autoAdvancePlan.summary.nights > 0 ? ` • ${autoAdvancePlan.summary.rooms} phòng x ${autoAdvancePlan.summary.nights} đêm` : ''}
                            </p>
                          </div>
                          <div className="text-left md:text-right">
                            <p className="text-[11px] font-bold text-amber-700">Tự sinh</p>
                            <p className="text-2xl font-black text-amber-800">
                              {autoAdvancePlan.requests.reduce((sum, req) => sum + (req.amount || 0), 0).toLocaleString()}đ
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div className="md:col-span-4">
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Hạng mục</label>
                        <input 
                          className="w-full border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                          placeholder="Ví dụ: Tạm ứng vận chuyển, tạm ứng ăn ở..."
                          value={advanceTitle}
                          onChange={e => setAdvanceTitle(e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-5">
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Ghi chú / Nội dung</label>
                        <input 
                          className="w-full border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                          placeholder="Mô tả ngắn về lý do tạm ứng"
                          value={advanceNote}
                          onChange={e => setAdvanceNote(e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Số tiền (VNĐ)</label>
                        <input 
                          type="number"
                          className="w-full border rounded-xl p-3 text-sm font-bold text-amber-700 outline-none focus:ring-2 focus:ring-amber-500"
                          placeholder="0"
                          value={advanceAmount}
                          onChange={e => setAdvanceAmount(e.target.value)}
                        />
                      </div>
                    </div>
                    <button onClick={handleAddAdvanceRequestSubmit} className="w-full bg-amber-600 text-white py-3 rounded-xl text-sm font-black hover:bg-amber-700 transition shadow-lg uppercase tracking-widest">
                      Thêm yêu cầu tạm ứng
                    </button>

                    {advanceRequests.length > 0 ? (
                      <div className="overflow-auto border border-slate-200 rounded-xl">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-50 text-left">
                            <tr>
                              <th className="px-4 py-2 font-black text-slate-500 text-[11px] uppercase tracking-widest w-12">#</th>
                              <th className="px-4 py-2 font-black text-slate-500 text-[11px] uppercase tracking-widest">Hạng mục</th>
                              <th className="px-4 py-2 font-black text-slate-500 text-[11px] uppercase tracking-widest">Ghi chú</th>
                              <th className="px-4 py-2 font-black text-slate-500 text-[11px] uppercase tracking-widest text-right">Số tiền</th>
                              <th className="px-4 py-2"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {advanceRequests.map((req, idx) => {
                              const isEditing = editingAdvanceId === req.id;
                              const isEditedAutoRequest = req.source === 'MANUAL' && !!req.autoKey;
                              return (
                                <tr key={req.id} className="border-t border-slate-100 hover:bg-amber-50/40">
                                  <td className="px-4 py-2 text-xs text-slate-500">{idx + 1}</td>
                                  {isEditing ? (
                                    <>
                                      <td className="px-4 py-2">
                                        <input
                                          className="w-full min-w-[180px] rounded-lg border border-amber-200 px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                                          value={editingAdvanceTitle}
                                          onChange={e => setEditingAdvanceTitle(e.target.value)}
                                          autoFocus
                                        />
                                        {req.createdAt && (
                                          <p className="mt-1 text-[11px] text-slate-400">Ngày yêu cầu: {new Date(req.createdAt).toLocaleDateString('vi-VN')}</p>
                                        )}
                                      </td>
                                      <td className="px-4 py-2">
                                        <input
                                          className="w-full min-w-[220px] rounded-lg border border-amber-200 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-amber-500"
                                          value={editingAdvanceNote}
                                          onChange={e => setEditingAdvanceNote(e.target.value)}
                                          placeholder="Ghi chú"
                                        />
                                      </td>
                                      <td className="px-4 py-2 text-right">
                                        <input
                                          type="number"
                                          className="w-36 rounded-lg border border-amber-200 px-3 py-2 text-right text-sm font-bold text-amber-700 outline-none focus:ring-2 focus:ring-amber-500"
                                          value={editingAdvanceAmount}
                                          onChange={e => setEditingAdvanceAmount(e.target.value)}
                                          placeholder="0"
                                        />
                                      </td>
                                      <td className="px-4 py-2">
                                        <div className="flex items-center justify-end gap-2">
                                          <button
                                            type="button"
                                            onClick={saveEditedAdvanceRequest}
                                            className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-2 text-xs font-black text-white hover:bg-amber-700"
                                            title="Lưu thay đổi"
                                          >
                                            <CheckCircle size={14}/> Lưu
                                          </button>
                                          <button
                                            type="button"
                                            onClick={cancelEditAdvanceRequest}
                                            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"
                                            title="Hủy sửa"
                                          >
                                            <X size={14}/>
                                          </button>
                                        </div>
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="px-4 py-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="font-bold text-slate-800">{req.title}</p>
                                          {isAutoAdvanceRequest(req) && (
                                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">
                                              Tự động
                                            </span>
                                          )}
                                          {isEditedAutoRequest && (
                                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-700">
                                              Đã chỉnh
                                            </span>
                                          )}
                                        </div>
                                        {req.createdAt && (
                                          <p className="text-[11px] text-slate-400">Ngày yêu cầu: {new Date(req.createdAt).toLocaleDateString('vi-VN')}</p>
                                        )}
                                      </td>
                                      <td className="px-4 py-2 text-sm text-slate-600">{req.note || '—'}</td>
                                      <td className="px-4 py-2 text-right font-bold text-amber-700">{(req.amount || 0).toLocaleString()}đ</td>
                                      <td className="px-4 py-2 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                          <button
                                            type="button"
                                            onClick={() => beginEditAdvanceRequest(req)}
                                            className="text-gray-300 hover:text-amber-600"
                                            title="Sửa yêu cầu"
                                          >
                                            <Pencil size={16}/>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => onRemoveAdvanceRequest?.(selectedEvent.id, req.id)}
                                            className="text-gray-300 hover:text-red-500"
                                            title="Xóa yêu cầu"
                                          >
                                            <Trash2 size={16}/>
                                          </button>
                                        </div>
                                      </td>
                                    </>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot className="bg-slate-50 border-t border-slate-200">
                            <tr>
                              <td colSpan={3} className="px-4 py-3 text-right font-black text-slate-700 uppercase tracking-widest">Tổng tạm ứng</td>
                              <td className="px-4 py-3 text-right font-black text-amber-700 text-lg">{totalAdvanceAmount.toLocaleString()}đ</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic border border-dashed border-slate-200 rounded-xl p-3">
                        Chưa có yêu cầu tạm ứng nào. Điền hạng mục, ghi chú và số tiền rồi bấm "Thêm" để lưu.
                      </div>
                    )}
                  </div>

                  {/* ADVANCE PAID SUMMARY */}
                  <div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="font-bold text-gray-800 text-xs uppercase flex items-center gap-2">
                        <CheckCircle size={16} className="text-emerald-600" /> Đã tạm ứng
                      </h4>
                      <div className="flex items-center gap-3 flex-wrap justify-end">
                        <div className="text-[11px] text-slate-500 font-semibold">
                          Tổng hóa đơn VAT: <span className="font-bold text-slate-700">{vatExpensesTotal.toLocaleString()}đ</span>
                        </div>
                        <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4"
                            checked={advanceSkipped}
                            onChange={e => handleAdvanceSkippedChange(e.target.checked)}
                          />
                          Chưa làm tạm ứng
                        </label>
                      </div>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tổng tiền hóa đơn VAT</p>
                        <p className="text-[11px] text-slate-500">Cộng các chi phí đã đính kèm hóa đơn VAT</p>
                      </div>
                      <p className="text-2xl font-black text-slate-800">{vatExpensesTotal.toLocaleString()}đ</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <label className={`flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm font-semibold ${advanceSkipped ? 'text-emerald-400 cursor-not-allowed opacity-60' : 'text-emerald-700'}`}>
                        <input 
                          type="checkbox" 
                          className="w-4 h-4"
                          checked={advancePaidConfirmed && !advanceSkipped}
                          onChange={e => handleAdvancePaidConfirmedChange(e.target.checked)}
                          disabled={advanceSkipped}
                        />
                        Đã nhận tạm ứng
                      </label>
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">
                          {advanceSkipped ? 'Số tiền cần thanh toán (VNĐ)' : 'Số tiền đã tạm ứng (VNĐ)'}
                        </label>
                        <input 
                          type="number"
                          className={`w-full border rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 ${advanceSkipped ? 'bg-slate-50 text-slate-700' : 'text-emerald-700'}`}
                          placeholder="0"
                          value={advanceSkipped ? vatExpensesTotal.toString() : advancePaidAmountInput}
                          onChange={advanceSkipped ? undefined : (e => handleAdvancePaidAmountChange(e.target.value))}
                          onBlur={advanceSkipped ? undefined : handleAdvancePaidAmountBlur}
                          readOnly={advanceSkipped}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">
                          {advanceSkipped ? 'Ngày thanh toán (dự kiến)' : 'Ngày tạm ứng'}
                        </label>
                        <input 
                          type="date"
                          className="w-full border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-500"
                          value={advancePaidDateInput}
                          onChange={advanceSkipped ? undefined : (e => handleAdvancePaidDateChange(e.target.value))}
                          disabled={advanceSkipped}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <label className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-sm font-semibold text-blue-700">
                        <input 
                          type="checkbox"
                          className="w-4 h-4"
                          checked={advanceRefundedConfirmed}
                          onChange={e => handleAdvanceRefundedConfirmedChange(e.target.checked)}
                        />
                        Đã hoàn ứng
                      </label>
                      <label className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 md:col-span-2">
                        <input 
                          type="checkbox"
                          className="w-4 h-4"
                          checked={paymentCompleted}
                          onChange={e => handlePaymentCompletedChange(e.target.checked)}
                        />
                        Đã hoàn thành thanh toán (kết thúc sự kiện)
                      </label>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                          {advanceSkipped ? 'Số tiền cần thanh toán' : 'Số tiền hoàn ứng dự kiến'}
                        </p>
                        <p className="text-[11px] text-emerald-700">
                          {advanceSkipped ? '= Chi phí có VAT (chưa tạm ứng)' : '= Đã tạm ứng - Chi phí có VAT'}
                        </p>
                      </div>
                      <p className={`text-2xl font-black ${advanceSkipped ? 'text-blue-700' : (advanceRefundAmount >= 0 ? 'text-emerald-700' : 'text-red-600')}`}>
                        {(advanceSkipped ? payableVatAmount : advanceRefundAmount).toLocaleString()}đ
                      </p>
                    </div>
                  </div>

                  {/* PROFIT SUMMARY CARD */}
                  <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                      <PieIcon size={160} />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-l-2 border-blue-500 pl-2">Doanh thu (A)</p>
                        <p className="text-3xl font-black text-blue-400">{revenue.toLocaleString()}đ</p>
                        <p className="text-[11px] text-slate-400">
                          {quotationRevenue > 0 && <span className="mr-3">Báo giá: {quotationRevenue.toLocaleString()}đ</span>}
                          {saleOrdersRevenue > 0 && <span>Đơn bán: {saleOrdersRevenue.toLocaleString()}đ</span>}
                          {quotationRevenue === 0 && saleOrdersRevenue === 0 && <span>Chưa có doanh thu</span>}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-l-2 border-orange-500 pl-2">Giá vốn / Chi phí (B)</p>
                        <p className="text-3xl font-black text-orange-400">{totalCosts.toLocaleString()}đ</p>
                        <p className="text-[10px] text-slate-500 italic">Nhân sự: {staffCosts.toLocaleString()}đ | Vận hành: {otherCosts.toLocaleString()}đ</p>
                      </div>
                      <div className="space-y-2 text-right md:text-left">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-l-2 border-green-500 pl-2">Biên lợi nhuận</p>
                        <p className={`text-3xl font-black ${profitMargin > 30 ? 'text-green-400' : 'text-yellow-400'}`}>{profitMargin.toFixed(1)}%</p>
                      </div>
                    </div>
                    
                    <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
                       <span className="text-xs font-black uppercase tracking-widest text-slate-500">LỢI NHUẬN GỘP DỰ KIẾN (A - B)</span>
                       <div className="flex flex-col items-end">
                         <span className={`text-5xl font-black tracking-tight ${grossProfit >= 0 ? 'text-white' : 'text-red-500'}`}>
                           {grossProfit.toLocaleString()} <span className="text-xl">VNĐ</span>
                         </span>
                       </div>
                    </div>
                  </div>

                  {/* Operational Expenses Form */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <h4 className="font-bold text-gray-800 text-xs uppercase flex items-center gap-2 border-b pb-3 mb-2">
                      <TrendingUp className="text-orange-500" size={16} /> Nhập Chi phí vận hành phát sinh
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Loại chi phí</label>
                        <select className="w-full border rounded-xl p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" value={expenseCat} onChange={e => setExpenseCat(e.target.value as any)}>
                          <option value="TRANSPORT_GOODS">Vận chuyển hàng hóa</option>
                          <option value="TRANSPORT_STAFF">Vận chuyển nhân sự</option>
                          <option value="ACCOMMODATION">Lưu trú / Khách sạn</option>
                          <option value="PRINTING">In ấn / Ấn phẩm</option>
                          <option value="CONSUMABLES">Đồ tiêu hao (Pin, băng dính...)</option>
                          <option value="CATERING">Ăn uống (Team)</option>
                          <option value="MISC">Khác</option>
                        </select>
                      </div>
                      {(expenseCat.includes('TRANSPORT')) && (
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Chiều vận chuyển</label>
                          <select className="w-full border rounded-xl p-3 text-sm bg-white outline-none" value={expenseSub} onChange={e => setExpenseSub(e.target.value)}>
                            <option value="">-- Chọn chiều --</option>
                            <option value="Chiều đi">Chiều đi</option>
                            <option value="Chiều về">Chiều về</option>
                            <option value="Khứ hồi">Khứ hồi</option>
                          </select>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Diễn giải</label>
                        <input className="w-full border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Mô tả nội dung chi phí..." value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Số tiền (VNĐ)</label>
                        <input type="number" className="w-full border rounded-xl p-3 text-sm font-bold text-orange-600 outline-none focus:ring-2 focus:ring-orange-500" placeholder="0" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Link hóa đơn VAT (nếu có)</label>
                        <input className="w-full border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://drive.google.com/... hoặc link cổng hóa đơn" value={expenseVatLink} onChange={e => setExpenseVatLink(e.target.value)} />
                      </div>
                    </div>
                    <button onClick={handleAddExpenseSubmit} className="w-full bg-slate-800 text-white py-3 rounded-xl text-sm font-black hover:bg-black transition shadow-lg uppercase tracking-widest">Lưu chi phí</button>
                  </div>

                  {/* List Existing Expenses */}
                  {(selectedEvent.expenses?.length || 0) > 0 && (
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                       <h4 className="font-bold text-gray-800 text-xs uppercase flex items-center gap-2 border-b pb-3 mb-2">
                         <Wallet className="text-green-600" size={16} /> Chi phí đã nhập
                       </h4>
                       <div className="space-y-2">
                         {selectedEvent.expenses?.map((exp, idx) => (
                           <div key={exp.id || idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <div>
                                 <p className="font-bold text-sm text-gray-700">{exp.description}</p>
                                 <p className="text-xs text-slate-400">{exp.category} {exp.subCategory ? `• ${exp.subCategory}` : ''}</p>
                                 {exp.vatInvoiceLink && (
                                   <a href={exp.vatInvoiceLink} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 underline">
                                     Hóa đơn VAT
                                   </a>
                                 )}
                              </div>
                              <div className="flex items-center gap-4">
                                 <span className="font-bold text-orange-600">{exp.amount.toLocaleString()}đ</span>
                                 <button onClick={() => onRemoveExpense?.(selectedEvent.id, exp.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={16}/></button>
                              </div>
                           </div>
                         ))}
                       </div>
                    </div>
                  )}
                </div>
              )}


            </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 p-10 italic">
            <Calendar size={60} className="mb-4 opacity-10"/> Chọn một sự kiện từ danh sách để quản lý.
          </div>
        )}
      </div>

      {/* MODAL: Delete Event */}
      {showDeleteConfirm && selectedEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-6 border-b bg-red-50 flex justify-between items-start">
              <div>
                <p className="text-[11px] font-black text-red-500 uppercase">Xóa sự kiện</p>
                <h3 className="text-xl font-bold text-gray-800">{selectedEvent.name}</h3>
                <p className="text-sm text-slate-600">{selectedEvent.client} • {selectedEvent.location}</p>
              </div>
              <button onClick={() => setShowDeleteConfirm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                <p className="font-bold mb-1">Chỉ ADMIN được xóa sự kiện.</p>
                <p>Thao tác này sẽ gỡ toàn bộ dữ liệu sự kiện và bỏ liên kết đơn bán (nếu có). Hành động không thể hoàn tác.</p>
              </div>
              <div className="text-sm text-slate-600 space-y-1">
                <p><span className="font-semibold text-slate-800">Thời gian:</span> {eventDateLabel || 'Không rõ'}</p>
                <p><span className="font-semibold text-slate-800">Khách hàng:</span> {selectedEvent.client}</p>
              </div>
            </div>
            <div className="p-6 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 font-bold text-gray-500">Hủy</button>
              <button onClick={handleConfirmDeleteEvent} className="px-5 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 flex items-center gap-2">
                <Trash2 size={16}/> Xóa vĩnh viễn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Layout Fullscreen */}
      {showLayoutFullscreen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-6xl p-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><MapPin size={18}/> Sơ đồ trạm - Toàn màn hình</h3>
                <p className="text-sm text-slate-500">Kéo thả và phóng to rộng rãi hơn.</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handlePrintLayout} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 flex items-center gap-2">
                  <Printer size={16}/> In sơ đồ trạm
                </button>
                <button onClick={() => setShowLayoutFullscreen(false)} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200">
                  <X size={20}/>
                </button>
              </div>
            </div>
            {renderLayoutBoard('fullscreen')}
          </div>
        </div>
      )}

      {/* MODAL: Create Event */}
      {showCreateEventModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
               <h3 className="text-xl font-bold text-gray-800">Tạo Sự Kiện Mới</h3>
               <button onClick={() => setShowCreateEventModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-4">
              <input type="text" className="w-full border border-slate-300 rounded-xl p-3" value={newEventData.name} onChange={e => setNewEventData({...newEventData, name: e.target.value})} placeholder="Tên sự kiện" />
              <input type="text" className="w-full border border-slate-300 rounded-xl p-3" value={newEventData.client} onChange={e => setNewEventData({...newEventData, client: e.target.value})} placeholder="Khách hàng" />
              <input type="text" className="w-full border border-slate-300 rounded-xl p-3" value={newEventData.location} onChange={e => setNewEventData({...newEventData, location: e.target.value})} placeholder="Địa điểm" />
              <div className="grid grid-cols-2 gap-2">
                {EVENT_VENUE_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setNewEventData({ ...newEventData, organizationVenue: option.value })}
                    className={`rounded-xl border px-3 py-2 text-left transition ${
                      newEventData.organizationVenue === option.value
                        ? 'border-blue-500 bg-blue-50 text-blue-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block text-sm font-black">{option.label}</span>
                    <span className="block text-[10px] font-semibold text-slate-500">{option.description}</span>
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <label className="text-[12px] font-bold text-gray-600 block">Ngày tổ chức (chọn trên lịch)</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    className="w-full border border-slate-300 rounded-xl p-3"
                    value={newScheduleDate}
                    onChange={e => setNewScheduleDate(e.target.value)}
                  />
                  <button onClick={handleAddScheduleDate} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">Thêm</button>
                </div>
                {sortedNewEventSchedule.length === 0 ? (
                  <div className="text-xs text-slate-400 italic">Chưa chọn ngày tổ chức.</div>
                ) : (
                  <div className="space-y-2">
                    {sortedNewEventSchedule.map(item => (
                      <div key={item.date} className="flex flex-col md:flex-row md:items-center gap-2 border border-slate-200 rounded-xl p-3">
                        <div className="flex items-center gap-2 flex-1">
                          <Calendar size={16} className="text-slate-400" />
                          <span className="text-sm font-semibold text-slate-700">{new Date(item.date).toLocaleDateString('vi-VN')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {SESSION_OPTIONS.map(opt => {
                            const active = item.sessions.includes(opt.value);
                            return (
                              <button key={opt.value} onClick={() => toggleScheduleSession(item.date, opt.value)} className={`px-3 py-1 rounded text-sm ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                                {opt.label}
                              </button>
                            );
                          })}
                          <button onClick={() => handleRemoveScheduleDate(item.date)} className="text-red-500 hover:text-red-600">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setShowCreateEventModal(false)} className="px-4 py-2 font-bold text-gray-500">Hủy</button>
              <button onClick={handleCreateEventSubmit} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold">Tạo Sự Kiện</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Export */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
               <h3 className="text-xl font-bold">{exportMode === 'COMBO' ? 'Thêm Combo vào order' : 'Xuất thiết bị lẻ'}</h3>
               <button onClick={() => setShowExportModal(false)} className="text-gray-400"><X size={24}/></button>
            </div>
            <div className="space-y-4">
              {exportMode === 'SINGLE' ? (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Tìm thiết bị nhanh</label>
                    <input
                      type="text"
                      value={exportSearchTerm}
                      onChange={(e) => setExportSearchTerm(e.target.value)}
                      placeholder="Nhập tên, barcode hoặc mã SP..."
                      className="w-full border rounded-xl p-3 bg-white"
                    />
                    <p className="text-[11px] text-slate-500">
                      Đang hiển thị {filteredInventoryForExport.length}/{inventory.length} thiết bị (xếp A-Z)
                    </p>
                  </div>
                  <select className="w-full border rounded-xl p-3 bg-white" value={selectedItemForExport} onChange={e => setSelectedItemForExport(e.target.value)}>
                    <option value="">-- Chọn thiết bị --</option>
                    {filteredInventoryForExport.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} (Sẵn: {item.availableQuantity})
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <div className="space-y-3">
                  <select className="w-full border rounded-xl p-3 bg-white" value={selectedPackageId} onChange={e => setSelectedPackageId(e.target.value)}>
                    <option value="">-- Chọn gói combo --</option>
                    {packages.map(pkg => <option key={pkg.id} value={pkg.id}>{pkg.name} • {packageTypeLabel(pkg)}</option>)}
                  </select>
                  {selectedPackageForExport ? (
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Combo đã chọn</p>
                      <div className="mt-1 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-slate-900">{selectedPackageForExport.name}</p>
                          <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black ${packageTypeBadgeClass(selectedPackageForExport)}`}>
                            {packageTypeLabel(selectedPackageForExport)}
                          </span>
                          {selectedPackageForExport.description && (
                            <p className="mt-0.5 text-xs text-slate-600">{selectedPackageForExport.description}</p>
                          )}
                        </div>
                        <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-[11px] font-black text-blue-700 border border-blue-100">
                          x{exportQty || 1}
                        </span>
                      </div>
                      <div className="mt-3 max-h-32 overflow-y-auto rounded-lg bg-white/70 border border-blue-100 divide-y divide-blue-50">
                        {selectedPackagePreviewItems.map(pkgItem => (
                          <div key={pkgItem.itemId} className="flex items-center justify-between gap-3 px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-800">{pkgItem.name}</p>
                              {pkgItem.category && <p className="truncate text-[11px] text-slate-500">{pkgItem.category}</p>}
                            </div>
                            <span className="shrink-0 text-xs font-black text-slate-700">
                              {pkgItem.quantity * Math.max(1, Number(exportQty) || 1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-500">
                      Chưa chọn combo nào.
                    </div>
                  )}
                </div>
              )}
              <input type="number" min="1" className="w-full border rounded-xl p-3" value={exportQty} onChange={e => setExportQty(Number(e.target.value))} />
              <button onClick={handleExportSubmit} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">Xác nhận thêm</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Print Slip */}
      {showPrintModal && selectedEvent && (
        <div id="print-slip-wrapper" className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 overflow-y-auto">
          <style>{printStyles}</style>
          <div className="bg-white w-full max-w-4xl p-8 rounded-xl shadow-2xl" id="print-slip">
             <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-8">
                <div>
                   <h1 className="text-2xl font-black uppercase">Phiếu Xuất Kho Thiết Bị</h1>
                   <p className="text-sm font-bold text-slate-500 uppercase">Mã đơn: EX-{selectedEvent.id}</p>
                   <p className="text-sm">Ngày xuất: {new Date().toLocaleDateString('vi-VN')}</p>
                </div>
                <div className="text-right">
                   <h2 className="text-lg font-bold">EVENTSTOCK AI</h2>
                   <p className="text-xs text-slate-500">Warehouse & Logistics Management</p>
                </div>
             </div>
             
             <div className="grid grid-cols-2 gap-8 mb-8 bg-slate-50 p-6 rounded-xl border border-slate-100">
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dự án / Sự kiện:</p>
                   <p className="font-black text-slate-800">{selectedEvent.name}</p>
                   <p className="text-sm text-slate-600">{selectedEvent.client}</p>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Địa điểm triển khai:</p>
                   <p className="text-sm font-bold text-slate-800">{selectedEvent.location}</p>
                   <p className="text-xs text-slate-500 italic mt-1">Giao hàng tận nơi & Setup</p>
                </div>
             </div>

             <table className="w-full border-collapse text-sm mb-12">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="p-3 text-left rounded-tl-lg uppercase text-[10px] font-black tracking-widest">STT</th>
                    <th className="p-3 text-left uppercase text-[10px] font-black tracking-widest">Tên Thiết Bị</th>
                    <th className="p-3 text-center uppercase text-[10px] font-black tracking-widest">Số lượng</th>
                    <th className="p-3 text-left rounded-tr-lg uppercase text-[10px] font-black tracking-widest">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-x border-b border-slate-200">
                  {selectedEvent.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-3 text-slate-500">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-800">{inventory.find(inv => inv.id === it.itemId)?.name}</td>
                      <td className="p-3 text-center font-black text-blue-600">{it.quantity}</td>
                      <td className="p-3 text-slate-400 italic">&nbsp;</td>
                    </tr>
                  ))}
                  {selectedEvent.items.length === 0 && (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-400">Không có thiết bị.</td></tr>
                  )}
                </tbody>
             </table>

             <div className="grid grid-cols-3 gap-8 text-center text-[10px] font-black uppercase tracking-widest mt-20">
                <div className="space-y-16">
                   <p>Người Lập Phiếu</p>
                   <div className="border-b border-slate-300 w-24 mx-auto"></div>
                </div>
                <div className="space-y-16">
                   <p>Thủ Kho Xuất</p>
                   <div className="border-b border-slate-300 w-24 mx-auto"></div>
                </div>
                <div className="space-y-16 text-blue-600">
                   <p>Đại Diện Khách Hàng</p>
                   <div className="border-b border-slate-300 w-24 mx-auto"></div>
                </div>
             </div>
             
             <div className="mt-20 text-center text-[9px] text-slate-400 italic border-t pt-8 uppercase tracking-widest font-bold">
               Vui lòng kiểm tra kỹ danh mục và tình trạng trước khi bàn giao - Mọi hư hỏng sau khi xuất kho sẽ được xử lý theo hợp đồng.
             </div>

             <div className="mt-12 flex justify-end gap-3 print:hidden">
                <button onClick={() => setShowExportPDFModal(true)} className="bg-green-600 text-white px-8 py-3 rounded-xl font-black flex items-center gap-2 shadow-lg shadow-green-200 uppercase tracking-widest text-xs transition active:scale-95"><Download size={18}/> Tải Checklist PDF</button>
                <button onClick={() => window.print()} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black flex items-center gap-2 shadow-lg shadow-blue-200 uppercase tracking-widest text-xs transition active:scale-95"><Printer size={18}/> In Lệnh Xuất Kho</button>
                <button onClick={() => setShowPrintModal(false)} className="bg-slate-100 text-slate-600 px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs">Đóng</button>
             </div>
          </div>
        </div>
      )}

      {/* MODAL: Item Detail */}
      {viewingItem && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-black text-slate-500 uppercase">Thông tin thiết bị</p>
                <h3 className="text-2xl font-black text-gray-800">{viewingItem.name}</h3>
                <p className="text-sm text-slate-500 mt-1">{viewingItem.category}</p>
              </div>
              <button onClick={() => setViewingItem(null)} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <img src={viewingItem.imageUrl} alt={viewingItem.name} className="w-full h-48 object-cover rounded-xl border border-slate-100 bg-slate-50" />
              </div>
              <div className="md:col-span-2 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                    <p className="text-[11px] font-black text-slate-500 uppercase">Tổng số</p>
                    <p className="text-xl font-black text-slate-800">{viewingItem.totalQuantity}</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                    <p className="text-[11px] font-black text-emerald-700 uppercase">Đang rảnh</p>
                    <p className="text-xl font-black text-emerald-700">{viewingItem.availableQuantity}</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                    <p className="text-[11px] font-black text-blue-700 uppercase">Đang xuất</p>
                    <p className="text-xl font-black text-blue-700">{viewingItem.inUseQuantity}</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                    <p className="text-[11px] font-black text-amber-700 uppercase">Bảo trì / Hỏng</p>
                    <p className="text-xl font-black text-amber-700">{(viewingItem.maintenanceQuantity || 0) + (viewingItem.brokenQuantity || 0)}</p>
                  </div>
                </div>
                {viewingItem.description && (
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                    <p className="text-[11px] font-black text-slate-500 uppercase mb-1">Mô tả</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{viewingItem.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                    <p className="text-[11px] font-black text-slate-500 uppercase mb-1">Đơn giá thuê</p>
                    <p className="text-lg font-black text-blue-600">{viewingItem.rentalPrice.toLocaleString()} đ</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                    <p className="text-[11px] font-black text-slate-500 uppercase mb-1">Vị trí kho</p>
                    <p className="text-sm font-semibold text-slate-800">{viewingItem.location}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export PDF Modal */}
      {selectedEventId && (
        <EventExportModal
          isOpen={showExportPDFModal}
          event={events.find(e => e.id === selectedEventId)!}
          inventory={inventory}
          employees={employees || []}
          onClose={() => setShowExportPDFModal(false)}
        />
      )}
    </div>
  );
};
