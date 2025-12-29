
import React, { useEffect, useMemo, useState } from 'react';
import { Event, InventoryItem, EventStatus, ComboPackage, Employee, EventExpense, EventStaffAllocation, Quotation, EventProcessStep, EventLayout, EventLayoutBlock, LayoutPackageSource, ChecklistDirection, ChecklistStatus, ChecklistSignature, EventTimelineEntry, EventTimelinePhase } from '../types';
import { 
  Calendar, MapPin, Box, ArrowLeft, Plus, Minus, X, Layers, 
  Users, DollarSign, Trash2, Truck, BookOpen, 
  Utensils, Wallet, Printer, Coffee, AlertCircle,
  TrendingUp, ArrowRightLeft, UserCheck, Link as LinkIcon, Clock3,
  Calculator, ChevronRight, PieChart as PieIcon, FileText, CheckCircle, RefreshCw, Upload, Download, ScanBarcode
} from 'lucide-react';
import { EventExportModal } from './EventExportModal';
import { EventChecklist } from './EventChecklist';

interface EventManagerProps {
  events: Event[];
  inventory: InventoryItem[];
  packages?: ComboPackage[];
  employees?: Employee[];
  quotations?: Quotation[];
  saleOrders?: any[];
  onExportToEvent: (eventId: string, itemId: string, qty: number) => void;
  onExportPackageToEvent?: (eventId: string, packageId: string, qty: number) => void;
  onSyncQuotation?: (eventId: string, quotationId: string) => void;
  onRemoveEventItems?: (eventId: string, itemIds: string[]) => void;
  onReturnFromEvent: (eventId: string, itemId: string, qty: number) => void;
  onUpdateEventItemQuantity?: (eventId: string, itemId: string, qty: number) => void;
  onToggleItemDone?: (eventId: string, itemId: string, done: boolean) => void;
  onCreateEvent: (newEvent: Event) => void;
  onAssignStaff?: (eventId: string, staffData: EventStaffAllocation) => void;
  onRemoveStaff?: (eventId: string, employeeId: string) => void;
  onToggleStaffDone?: (eventId: string, employeeId: string, done: boolean) => void;
  onAddExpense?: (eventId: string, expense: EventExpense) => void;
  onRemoveExpense?: (eventId: string, expenseId: string) => void;
  onLinkQuotation?: (eventId: string, quotationId: string) => void;
  onFinalizeOrder?: (eventId: string) => void;
  onUpdateEvent?: (eventId: string, updates: Partial<Event>) => void;
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

const createDefaultProcessSteps = (): EventProcessStep[] =>
  PROCESS_STEPS_TEMPLATE.map(step => ({
    id: step.id,
    title: step.title,
    checklist: step.checklist.map((label, index) => ({
      id: `${step.id}-${index}`,
      label,
      checked: false
    }))
  }));

type EventSession = NonNullable<Event['session']>;
type EventScheduleItem = { date: string; sessions: EventSession[] };

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

const TIMELINE_PHASES: { value: EventTimelinePhase; label: string; color: string; description: string }[] = [
  { value: 'BEFORE', label: 'Trước sự kiện', color: 'bg-amber-50 border-amber-100', description: 'Công tác chuẩn bị, vận chuyển, set up' },
  { value: 'DURING', label: 'Trong sự kiện', color: 'bg-emerald-50 border-emerald-100', description: 'Những mốc diễn ra trong chương trình' },
  { value: 'AFTER', label: 'Sau sự kiện', color: 'bg-slate-50 border-slate-200', description: 'Thu hồi, tổng kết, bàn giao' }
];

const getStaffSessions = (staff?: Pick<EventStaffAllocation, 'session' | 'sessions'>): EventSession[] => {
  if (!staff) return [];
  if (staff.sessions && staff.sessions.length > 0) return staff.sessions as EventSession[];
  return staff.session ? [staff.session as EventSession] : [];
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
      return { date: it.date, sessions: event.session ? [event.session] : ['MORNING'] };
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

export const EventManager: React.FC<EventManagerProps> = ({ 
  events, 
  inventory,
  packages = [],
  employees = [],
  quotations = [],
  saleOrders = [],
  onExportToEvent,
  onExportPackageToEvent,
  onSyncQuotation,
  onRemoveEventItems,
  onReturnFromEvent,
  onUpdateEventItemQuantity,
  onCreateEvent,
  onAssignStaff,
  onRemoveStaff,
  onToggleItemDone,
  onToggleStaffDone,
  onAddExpense,
  onRemoveExpense,
  onLinkQuotation,
  onFinalizeOrder,
  onUpdateEvent,
  onLinkSaleOrder,
  onChecklistScan,
  onUpdateChecklistNote,
  onSaveChecklistSignature
}) => {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'EQUIPMENT' | 'STAFF' | 'COSTS' | 'FLOWS' | 'LAYOUT' | 'CHECKLIST' | 'TIMELINE'>('EQUIPMENT');
  const [selectedLayoutBlockId, setSelectedLayoutBlockId] = useState<string | null>(null);
  
  // Modals
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showExportPDFModal, setShowExportPDFModal] = useState(false);
  
  // Create Event Form State
  const [newEventData, setNewEventData] = useState({
    name: '',
    client: '',
    location: ''
  });
  const [newEventSchedule, setNewEventSchedule] = useState<EventScheduleItem[]>([]);
  const [newScheduleDate, setNewScheduleDate] = useState('');
  const [timelinePhase, setTimelinePhase] = useState<EventTimelinePhase>('BEFORE');
  const [timelineDatetime, setTimelineDatetime] = useState('');
  const [timelineNote, setTimelineNote] = useState('');
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

  useEffect(() => {
    if (!showExportModal) {
      setExportSearchTerm('');
    }
  }, [showExportModal]);

  // Calendar view state
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarSelectedEventId, setCalendarSelectedEventId] = useState<string | null>(null);
  const [showEventDetailModal, setShowEventDetailModal] = useState(false);

  // Assign Staff State
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [staffTask, setStaffTask] = useState('');
  const [staffUnit, setStaffUnit] = useState<'HOUR' | 'DAY' | 'FIXED'>('DAY');
  const [staffQty, setStaffQty] = useState(1);
  const [staffRate, setStaffRate] = useState('');
  const [selectedSessions, setSelectedSessions] = useState<EventSession[]>([]);
  const [selectedShiftDate, setSelectedShiftDate] = useState<string | null>(null);
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
  const [isMobileListCollapsed, setIsMobileListCollapsed] = useState(false);

  // Expense State
  const [expenseCat, setExpenseCat] = useState<EventExpense['category']>('TRANSPORT_GOODS');
  const [expenseSub, setExpenseSub] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseVatLink, setExpenseVatLink] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [viewingItem, setViewingItem] = useState<InventoryItem | null>(null);

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const linkedQuotation = selectedEvent?.quotationId ? quotations.find(q => q.id === selectedEvent.quotationId) : null;
  const fallbackProcessSteps = useMemo(() => createDefaultProcessSteps(), [selectedEventId]);
  const processSteps = selectedEvent?.processSteps && selectedEvent.processSteps.length > 0 ? selectedEvent.processSteps : fallbackProcessSteps;
  const linkedSaleOrders = useMemo(() => {
    if (!selectedEvent) return [];
    return saleOrders.filter(o => o.eventId === selectedEvent.id || (selectedEvent.saleOrderIds || []).includes(o.id));
  }, [saleOrders, selectedEvent]);
  const selectableSaleOrders = useMemo(() => {
    if (!selectedEvent) return [];
    return saleOrders.filter(o => o.eventId === undefined || o.eventId === selectedEvent.id || (selectedEvent.saleOrderIds || []).includes(o.id));
  }, [saleOrders, selectedEvent]);
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

  useEffect(() => {
    if (selectedEvent && (!selectedEvent.processSteps || selectedEvent.processSteps.length === 0) && onUpdateEvent) {
      onUpdateEvent(selectedEvent.id, { processSteps: createDefaultProcessSteps() });
    }
    setSelectedItemIds([]);
  }, [selectedEvent, onUpdateEvent]);
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
    setTimelineDatetime(firstDate ? `${firstDate}T08:00` : '');
  }, [selectedEvent, selectedEventId]);

  const handleCreateEventSubmit = () => {
    if (!newEventData.name || !newEventData.client || newEventSchedule.length === 0) {
      alert("Vui lòng điền đủ thông tin sự kiện!");
      return;
    }
    const sortedSchedule = [...newEventSchedule].sort((a, b) => a.date.localeCompare(b.date));
    const startDate = sortedSchedule[0].date;
    const endDate = sortedSchedule[sortedSchedule.length - 1].date;
    const primarySession = sortedSchedule[0].sessions?.[0] || 'MORNING';
    const newEvent: Event = {
      id: `EVT-${Date.now()}`,
      name: newEventData.name,
      client: newEventData.client,
      location: newEventData.location,
      startDate,
      endDate,
      session: primarySession,
      schedule: sortedSchedule.map(s => ({ date: s.date, sessions: s.sessions })),
      status: EventStatus.UPCOMING,
      items: [],
      staff: [],
      expenses: [],
      processSteps: createDefaultProcessSteps(),
      timeline: [],
      layout: {
        floorplanImage: '',
        floorplanAspectRatio: undefined,
        blocks: []
      }
    };
    onCreateEvent(newEvent);
    setShowCreateEventModal(false);
    setNewEventData({ name: '', client: '', location: '' });
    setNewEventSchedule([]);
    setNewScheduleDate('');
    setSelectedEventId(newEvent.id);
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

  const formatTimelineDatetime = (value: string) => {
    if (!value) return 'Chưa chọn thời gian';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
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
    const entry: EventTimelineEntry = {
      id: `TL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      phase: timelinePhase,
      datetime: timelineDatetime,
      note: timelineNote.trim()
    };
    const nextTimeline = [...(selectedEvent.timeline || []), entry].sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));
    onUpdateEvent(selectedEvent.id, { timeline: nextTimeline });
    setTimelineNote('');
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

  const handleCreateOrder = () => {
    if (!selectedEventId) return;
    if (onFinalizeOrder) {
      onFinalizeOrder(selectedEventId);
      setShowPrintModal(true);
    }
  };

  const getEventSummary = (eventId: string) => {
    const ev = events.find(e => e.id === eventId);
    if (!ev) return null;
    const linkedQ = ev.quotationId ? quotations.find(q => q.id === ev.quotationId) : null;
    const staffCostsLocal = ev.staff?.reduce((a, b) => a + b.salary, 0) || 0;
    const otherCostsLocal = ev.expenses?.reduce((a, b) => a + b.amount, 0) || 0;
    const totalCostsLocal = staffCostsLocal + otherCostsLocal;
    const revenueLocal = linkedQ?.totalAmount || 0;
    const grossProfitLocal = revenueLocal - totalCostsLocal;
    const profitMarginLocal = revenueLocal > 0 ? (grossProfitLocal / revenueLocal) * 100 : 0;
    const staffCount = ev.staff?.length || 0;
    const itemsCount = ev.items?.reduce((a, b) => a + b.quantity, 0) || 0;
    return {
      event: ev,
      linkedQuotation: linkedQ,
      staffCosts: staffCostsLocal,
      otherCosts: otherCostsLocal,
      totalCosts: totalCostsLocal,
      revenue: revenueLocal,
      grossProfit: grossProfitLocal,
      profitMargin: profitMarginLocal,
      staffCount,
      itemsCount
    };
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

    onAssignStaff(selectedEventId, {
      employeeId: selectedStaffId,
      task: staffTask,
      unit: staffUnit,
      quantity: qty,
      rate: rate,
      salary: staffUnit === 'FIXED' ? rate : rate * qty,
      session: sessionList[0],
      sessions: sessionList,
      shiftDate: selectedShiftDate || undefined
    });
    setSelectedStaffId('');
    setStaffTask('');
    setStaffRate('');
    setStaffQty(1);
    setSelectedShiftDate(null);
    setSelectedSessions([]);
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

  const handleStaffSelect = (empId: string) => {
    setSelectedStaffId(empId);
    const emp = employees.find(e => e.id === empId);
    if (emp) {
      setStaffTask(emp.role);
      setStaffRate(emp.baseRate ? emp.baseRate.toString() : '');
    }
  };

  const handleSessionToggle = (date: string, session: EventSession) => {
    if (selectedShiftDate !== date) {
      setSelectedShiftDate(date);
      setSelectedSessions([session]);
      return;
    }
    setSelectedSessions(prev => {
      const exists = prev.includes(session);
      if (exists) {
        const next = prev.filter(s => s !== session);
        if (next.length === 0) setSelectedShiftDate(null);
        return next;
      }
      if (prev.length >= 2) return prev;
      return [...prev, session];
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

  const updateProcessSteps = (steps: EventProcessStep[]) => {
    if (!selectedEvent || !onUpdateEvent) return;
    onUpdateEvent(selectedEvent.id, { processSteps: steps });
  };

  const handleToggleProcessChecklist = (stepId: EventProcessStep['id'], itemId: string) => {
    const nextSteps = processSteps.map(step => {
      if (step.id !== stepId) return step;
      return {
        ...step,
        checklist: step.checklist.map(item => item.id === itemId ? { ...item, checked: !item.checked } : item)
      };
    });
    updateProcessSteps(nextSteps);

    // Nếu hoàn tất bước "Hoàn tất sự kiện" thì chốt trạng thái sự kiện
    if (stepId === 'CLOSE' && selectedEvent && onUpdateEvent) {
      const closeStep = nextSteps.find(s => s.id === 'CLOSE');
      const allDone = closeStep ? closeStep.checklist.every(c => c.checked) : false;
      if (allDone && selectedEvent.status !== EventStatus.COMPLETED) {
        onUpdateEvent(selectedEvent.id, { status: EventStatus.COMPLETED });
      }
    }
  };

  const eventLayout: EventLayout = selectedEvent?.layout || { floorplanImage: '', blocks: [] };

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
          label: `${pkg.name} • Gói hệ thống`,
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
    onUpdateEvent(selectedEvent.id, { layout });
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
    setLayoutForm(prev => ({
      ...prev,
      name: '',
      customPackageName: '',
      staffId: '',
      staffName: ''
    }));
  }, [selectedEventId]);

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

  // Tài chính
  const staffCosts = selectedEvent?.staff?.reduce((a, b) => a + b.salary, 0) || 0;
  const otherCosts = selectedEvent?.expenses?.reduce((a, b) => a + b.amount, 0) || 0;
  const totalCosts = staffCosts + otherCosts;
  const saleOrdersRevenue = linkedSaleOrders.reduce((sum, order) => sum + (order.total || 0), 0);
  const quotationRevenue = linkedQuotation?.totalAmount || 0;
  const revenue = quotationRevenue + saleOrdersRevenue;
  const grossProfit = revenue - totalCosts;
  const profitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const totalChecklistCount = processSteps.reduce((acc, step) => acc + step.checklist.length, 0);
  const totalChecklistDone = processSteps.reduce((acc, step) => acc + step.checklist.filter(item => item.checked).length, 0);

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-100px)]">
      {/* Sidebar */}
      <div className={`w-full lg:w-1/3 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col h-auto lg:h-full overflow-hidden ${isMobileListCollapsed ? 'hidden' : 'flex'} lg:flex`}>
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-gray-800 text-lg">Sự Kiện</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCreateEventModal(true)} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              <Plus size={20} />
            </button>
            <button onClick={() => setShowCalendarModal(true)} title="Xem lịch" className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition">
              <Calendar size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {events.length === 0 && <div className="text-center py-10 text-gray-400 italic text-sm">Chưa có sự kiện nào.</div>}
          {events.map(event => (
            <div 
              key={event.id}
              onClick={() => {
                setSelectedEventId(event.id);
                if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                  setIsMobileListCollapsed(true);
                }
              }}
              className={`p-4 rounded-xl border-2 cursor-pointer transition ${selectedEventId === event.id ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-transparent bg-white border-slate-100'}`}
            >
              {(() => {
                const schedule = getEventSchedule(event);
                const uniqueSessions = Array.from(new Set(schedule.flatMap(item => item.sessions)));
                const start = schedule[0]?.date || event.startDate;
                const end = schedule[schedule.length - 1]?.date || event.endDate;
                return (
                  <>
                    <h4 className="font-bold text-gray-800">{event.name}</h4>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                      <Calendar size={12}/> {start}{end && end !== start ? ` → ${end}` : ''}
                    </p>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {uniqueSessions.map(session => (
                        <div key={session} className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                          {SESSION_LABELS[session]}
                        </div>
                      ))}
                      {event.quotationId && <div className="inline-flex items-center gap-1 text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full"><LinkIcon size={10}/> Đã gắn báo giá</div>}
                    </div>
                  </>
                );
              })()}
            </div>
          ))}
        </div>
      </div>

      {/* Main Detail Panel */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col lg:h-full overflow-visible lg:overflow-hidden">
        {selectedEvent ? (
          <>
            <div className="p-4 md:p-6 border-b border-slate-100 space-y-3">
              {isMobileListCollapsed && (
                <div className="lg:hidden">
                  <button
                    onClick={() => setIsMobileListCollapsed(false)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200"
                  >
                    <ArrowLeft size={14} /> Danh sách sự kiện
                  </button>
                </div>
              )}
              <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                <div>
                  <h2 className="text-2xl font-black text-gray-800">{selectedEvent.name}</h2>
                  <p className="text-sm text-gray-500">{selectedEvent.client} • {selectedEvent.location}</p>
                </div>
                <button 
                  onClick={handleCreateOrder}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${selectedEvent.isOrderCreated ? 'bg-green-100 text-green-700' : 'bg-slate-800 text-white hover:bg-black'}`}
                >
                  {selectedEvent.isOrderCreated ? <><CheckCircle size={16}/> Đã Chốt Đơn</> : <><FileText size={16}/> Chốt Đơn & In</>}
                </button>
              </div>
              
              <div className="flex flex-wrap gap-4 md:gap-8 mt-6">
                <button onClick={() => setDetailTab('EQUIPMENT')} className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${detailTab === 'EQUIPMENT' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  <Box size={16}/> Order Thiết Bị
                </button>
                <button onClick={() => setDetailTab('CHECKLIST')} className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${detailTab === 'CHECKLIST' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  <ScanBarcode size={16}/> Checklist Barcode
                </button>
                <button onClick={() => setDetailTab('TIMELINE')} className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${detailTab === 'TIMELINE' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  <Clock3 size={16}/> Timeline
                </button>
                <button onClick={() => setDetailTab('STAFF')} className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${detailTab === 'STAFF' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  <Users size={16}/> Nhân Sự
                </button>
                <button onClick={() => setDetailTab('LAYOUT')} className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${detailTab === 'LAYOUT' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  <MapPin size={16}/> Sơ đồ trạm
                </button>
                <button onClick={() => setDetailTab('COSTS')} className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${detailTab === 'COSTS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  <DollarSign size={16}/> Chi Phí & Lợi Nhuận
                </button>
                <button onClick={() => setDetailTab('FLOWS')} className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${detailTab === 'FLOWS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  <Layers size={16}/> Luồng xử lý
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-visible lg:overflow-y-auto p-4 md:p-6 bg-slate-50/30">
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

                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => { setExportMode('SINGLE'); setShowExportModal(true); }} className="bg-white border border-blue-600 text-blue-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-50">+ Thêm lẻ</button>
                    <button onClick={() => { setExportMode('COMBO'); setShowExportModal(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700">+ Thêm Combo</button>
                    <button 
                      onClick={handleRemoveSelectedItems} 
                      disabled={selectedItemIds.length === 0}
                      className={`px-4 py-2 rounded-lg text-sm font-bold border ${selectedItemIds.length === 0 ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'}`}
                    >
                      Xóa thiết bị đã chọn ({selectedItemIds.length})
                    </button>
                  </div>

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
                                />
                              </td>
                              <td className="px-4 py-3 text-center">
                                <input type="checkbox" checked={!!alloc.done} onChange={e => onToggleItemDone?.(selectedEvent.id, alloc.itemId, e.target.checked)} />
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
                                    disabled={alloc.quantity <= (alloc.returnedQuantity || 0)}
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
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleItemQuantityChange(alloc.itemId, alloc.quantity + 1)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
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
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Thêm mốc timeline</p>
                      <p className="text-sm text-slate-600">Chia theo giai đoạn trước / trong / sau để bám sát tiến độ triển khai.</p>
                    </div>
                    <div className="flex flex-col md:flex-row gap-3">
                      <div className="flex-1 space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 uppercase">Ngày giờ</label>
                        <input
                          type="datetime-local"
                          value={timelineDatetime}
                          onChange={e => setTimelineDatetime(e.target.value)}
                          className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        />
                      </div>
                      <div className="w-full md:w-44 space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 uppercase">Giai đoạn</label>
                        <select
                          value={timelinePhase}
                          onChange={e => setTimelinePhase(e.target.value as EventTimelinePhase)}
                          className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
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
                        className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        placeholder="VD: 08:00 - Xe rời kho, 10:30 - set up sân khấu, 22:00 - thu hồi thiết bị..."
                        value={timelineNote}
                        onChange={e => setTimelineNote(e.target.value)}
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={handleAddTimelineEntry}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm flex items-center gap-2"
                      >
                        <Plus size={16}/> Lưu mốc
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
                                    <p className="text-[11px] font-black text-slate-600 uppercase tracking-wide">{formatTimelineDatetime(entry.datetime)}</p>
                                    <p className="text-sm text-slate-800 leading-snug">{entry.note}</p>
                                  </div>
                                  <button
                                    onClick={() => handleRemoveTimelineEntry(entry.id)}
                                    className="text-gray-300 hover:text-red-500 transition"
                                    title="Xóa mốc"
                                  >
                                    <X size={14}/>
                                  </button>
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

              {detailTab === 'STAFF' && (
                <div className="space-y-6">
                   <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm space-y-4">
                    <h4 className="font-bold text-gray-700 text-xs uppercase flex items-center gap-2"><UserCheck size={16} className="text-blue-500"/> Phân công nhân sự sự kiện</h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <select className="border border-slate-200 rounded-lg p-2 text-sm bg-white" value={selectedStaffId} onChange={e => handleStaffSelect(e.target.value)}>
                        <option value="">-- Chọn nhân viên --</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.role})</option>)}
                      </select>
                      <input className="border border-slate-200 rounded-lg p-2 text-sm" placeholder="Nhiệm vụ..." value={staffTask} onChange={e => setStaffTask(e.target.value)} />
                    </div>
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
                        }}
                      >
                        <option value="DAY">Theo Ngày</option>
                        <option value="HOUR">Theo Giờ</option>
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
                        <input type="number" className="border border-slate-200 rounded-lg p-2 text-sm text-center" placeholder="SL" value={staffQty} onChange={e => setStaffQty(Number(e.target.value))} />
                      ) : (
                        <div className="border border-slate-200 rounded-lg p-2 text-sm text-center text-slate-500 bg-slate-50 font-semibold">Trọn gói</div>
                      )}
                      <input type="number" className="border border-slate-200 rounded-lg p-2 text-sm font-bold text-blue-600" placeholder="Đơn giá" value={staffRate} onChange={e => setStaffRate(e.target.value)} />
                    </div>
                    <button onClick={handleStaffAssignSubmit} className="w-full bg-slate-800 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-slate-900 transition shadow-sm">Thêm nhân sự</button>
                  </div>

                  <div className="space-y-3">
                    {selectedEvent.staff?.map((s, idx) => {
                      const emp = employees.find(e => e.id === s.employeeId);
                      const unitLabel = s.unit === 'DAY' ? 'ngày' : s.unit === 'HOUR' ? 'giờ' : 'trọn gói';
                      const quantityLabel = s.unit === 'FIXED' ? 'Trọn gói' : `${s.quantity} ${unitLabel}`;
                      const staffSessions = getStaffSessions(s);
                      return (
                        <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center hover:shadow-md transition">
                           <div className="flex items-center gap-4">
                              <img src={emp?.avatarUrl} className="w-12 h-12 rounded-full border-2 border-slate-100" />
                              <div>
                                <p className="font-bold text-gray-800">{emp?.name}</p>
                                <p className="text-xs font-medium text-blue-600">{s.task} • {quantityLabel}</p>
                                {staffSessions.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {staffSessions.map(sess => (
                                      <div key={sess} className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                                        {SESSION_LABELS[sess]}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {s.shiftDate && (
                                  <div className="text-[11px] text-slate-400 mt-1">{new Date(s.shiftDate).toLocaleDateString('vi-VN')}</div>
                                )}
                              </div>
                           </div>
                           <div className="flex items-center gap-6">
                              <div className="flex items-center gap-3">
                                <input type="checkbox" checked={!!s.done} onChange={e => onToggleStaffDone?.(selectedEvent.id, s.employeeId, e.target.checked)} />
                                <p className="font-black text-gray-800">{s.salary.toLocaleString()}đ</p>
                              </div>
                              <button onClick={() => onRemoveStaff?.(selectedEvent.id, s.employeeId)} className="text-gray-300 hover:text-red-500"><Trash2 size={16}/></button>
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
                        className="w-full border border-slate-200 rounded-lg p-2.5 text-sm" 
                        placeholder="VD: Trạm check-in, Khu trải nghiệm 1..."
                        value={layoutForm.name}
                        onChange={e => setLayoutForm(prev => ({ ...prev, name: e.target.value }))}
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
                            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-white"
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
                          className="w-full border border-slate-200 rounded-lg p-2.5 text-sm" 
                          placeholder="Nhập tên gói bổ sung..."
                          value={layoutForm.customPackageName}
                          onChange={e => setLayoutForm(prev => ({ ...prev, customPackageName: e.target.value }))}
                        />
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase">Nhân sự phụ trách</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select 
                          className="border border-slate-200 rounded-lg p-2.5 text-sm bg-white"
                          value={layoutForm.staffId}
                          onChange={e => {
                            const id = e.target.value;
                            const emp = employees.find(emp => emp.id === id);
                            setLayoutForm(prev => ({ ...prev, staffId: id, staffName: emp?.name || prev.staffName }));
                          }}
                        >
                          <option value="">-- Chọn từ danh sách nhân sự --</option>
                          {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                          ))}
                        </select>
                        <input
                          className="border border-slate-200 rounded-lg p-2.5 text-sm"
                          placeholder="Hoặc nhập nhanh tên nhân sự khác"
                          value={layoutForm.staffName}
                          onChange={e => setLayoutForm(prev => ({ ...prev, staffName: e.target.value }))}
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
                            className={`w-8 h-8 rounded-full border-2 ${layoutForm.color === color ? 'border-slate-900 scale-105' : 'border-slate-200'} transition`}
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <button onClick={handleSaveLayoutBlock} className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-black transition shadow-sm">
                        {editingBlockId ? 'Lưu thay đổi block' : '+ Thêm block vào sơ đồ'}
                      </button>
                      {editingBlockId && (
                        <button onClick={resetLayoutForm} className="w-full bg-slate-100 text-slate-600 py-2.5 rounded-lg text-sm font-bold hover:bg-slate-200 transition shadow-sm">
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
                            className={`p-3 rounded-xl border flex justify-between items-start gap-3 cursor-pointer transition ${selectedLayoutBlockId === block.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-slate-50/60 hover:border-blue-200 hover:bg-blue-50/60'}`}
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
                              onClick={e => { e.stopPropagation(); handleRemoveLayoutBlock(block.id); }}
                              className="text-gray-300 hover:text-red-500"
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
                        <label className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg cursor-pointer hover:bg-blue-700">
                          <Upload size={16}/> Tải ảnh mặt bằng
                          <input type="file" accept="image/*" className="hidden" onChange={e => handleFloorplanUpload(e.target.files?.[0])} />
                        </label>
                        {eventLayout.floorplanImage && (
                          <button onClick={handleRemoveFloorplan} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-200 flex items-center gap-2">
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

              {detailTab === 'FLOWS' && selectedEvent && (
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Luồng xử lý công việc</p>
                      <p className="text-sm font-bold text-slate-700">Tick checklist để đánh dấu hoàn thành.</p>
                    </div>
                    <div className="text-xs text-slate-400 font-medium">
                      Tổng tiến độ: {totalChecklistDone}/{totalChecklistCount}
                    </div>
                  </div>

                  <div className="overflow-x-auto pb-2">
                    <div className="flex items-stretch gap-3 min-w-[1100px]">
                      {processSteps.map((step, index) => {
                        const doneCount = step.checklist.filter(item => item.checked).length;
                        const totalCount = step.checklist.length;
                        const isComplete = totalCount > 0 && doneCount === totalCount;
                        return (
                          <div key={step.id} className="flex items-stretch gap-3">
                            <div className={`relative w-64 p-4 rounded-2xl border shadow-sm ${isComplete ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-white'}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={`h-6 w-6 rounded-full text-[11px] font-black flex items-center justify-center ${isComplete ? 'bg-green-600 text-white' : 'bg-slate-900 text-white'}`}>{index + 1}</span>
                                  <p className="font-black text-sm text-slate-800">{step.title}</p>
                                </div>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isComplete ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{doneCount}/{totalCount}</span>
                              </div>
                              <div className="mt-3 space-y-2">
                                {step.checklist.map(item => (
                                  <label key={item.id} className="flex items-start gap-2 text-xs text-slate-700">
                                    <input
                                      type="checkbox"
                                      className="mt-0.5"
                                      checked={item.checked}
                                      onChange={() => handleToggleProcessChecklist(step.id, item.id)}
                                    />
                                    <span className={item.checked ? 'line-through text-slate-400' : 'text-slate-700'}>{item.label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            {index < processSteps.length - 1 && (
                              <div className="flex items-center text-slate-300">
                                <ChevronRight size={28} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 p-10 italic">
            <Calendar size={60} className="mb-4 opacity-10"/> Chọn một sự kiện từ danh sách để quản lý.
          </div>
        )}
      </div>

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
               <h3 className="text-xl font-bold">Xuất thiết bị lẻ</h3>
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
                <select className="w-full border rounded-xl p-3 bg-white" value={selectedPackageId} onChange={e => setSelectedPackageId(e.target.value)}>
                  <option value="">-- Chọn gói combo --</option>
                  {packages.map(pkg => <option key={pkg.id} value={pkg.id}>{pkg.name}</option>)}
                </select>
              )}
              <input type="number" min="1" className="w-full border rounded-xl p-3" value={exportQty} onChange={e => setExportQty(Number(e.target.value))} />
              <button onClick={handleExportSubmit} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">Xác nhận thêm</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Calendar View */}
      {showCalendarModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl p-6 shadow-2xl max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Lịch Sự Kiện</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowCalendarModal(false)} className="px-3 py-2 bg-slate-100 rounded-lg"><X size={18} /></button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 text-sm">
              {['CN','T2','T3','T4','T5','T6','T7'].map(d => (
                <div key={d} className="text-center font-black text-xs text-slate-500 uppercase">{d}</div>
              ))}

              {/* Simple month grid for current month */}
              {(() => {
                const now = new Date();
                const year = now.getFullYear();
                const month = now.getMonth();
                const first = new Date(year, month, 1);
                const startDay = first.getDay();
                const daysInMonth = new Date(year, month+1, 0).getDate();
                const cells = [] as any[];
                for (let i = 0; i < startDay; i++) cells.push(null);
                for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
                return cells.map((dt, idx) => {
                  if (!dt) return <div key={idx} className="h-24 p-2 border rounded-lg bg-slate-50" />;
                  const key = dt.toISOString().slice(0,10);
                  const dayEvents = events.filter(ev => getEventSchedule(ev).some(item => item.date === key));
                  return (
                    <div key={idx} className="h-24 p-2 border rounded-lg bg-white flex flex-col">
                      <div className="text-xs text-slate-400 font-black">{dt.getDate()}</div>
                      <div className="mt-1 overflow-auto text-[12px]">
                        {dayEvents.map(ev => (
                          <button key={ev.id} onClick={() => { setCalendarSelectedEventId(ev.id); setShowEventDetailModal(true); }} className="w-full text-left truncate py-0.5 px-1 rounded hover:bg-blue-50 text-blue-600 font-medium">
                            <span className="font-medium">{ev.name}</span>
                            {(() => {
                              const sessions = getSessionsForDate(ev, key);
                              return sessions ? sessions.map(s => (
                                <span key={s} className="ml-2 inline-flex items-center text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                                  {SESSION_LABELS[s]}
                                </span>
                              )) : null;
                            })()}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Event Detail from Calendar */}
      {showEventDetailModal && calendarSelectedEventId && (() => {
        const summary = getEventSummary(calendarSelectedEventId!);
        if (!summary) return null;
        const ev = summary.event;
        return (
          <div key={ev.id} className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] overflow-auto relative z-[80]">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-2xl font-black">{ev.name}</h3>
                  <p className="text-sm text-slate-500">{ev.client} • {ev.location}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-xs text-slate-400">{ev.startDate} → {ev.endDate}</p>
                    {(() => {
                      const schedule = getEventSchedule(ev);
                      const uniqueSessions = Array.from(new Set(schedule.flatMap(item => item.sessions)));
                      return uniqueSessions.map(session => (
                        <div key={session} className="inline-flex items-center text-[11px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                          {SESSION_LABELS[session]}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setShowEventDetailModal(false); setCalendarSelectedEventId(null); }} className="px-4 py-2 bg-slate-100 rounded-lg">Đóng</button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs font-black text-slate-500 uppercase">Doanh thu</p>
                  <p className="text-lg font-black text-blue-600">{summary.revenue.toLocaleString()}đ</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs font-black text-slate-500 uppercase">Chi phí</p>
                  <p className="text-lg font-black text-orange-500">{summary.totalCosts.toLocaleString()}đ</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs font-black text-slate-500 uppercase">Lợi nhuận gộp</p>
                  <p className="text-lg font-black text-green-600">{summary.grossProfit.toLocaleString()}đ ({summary.profitMargin.toFixed(1)}%)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border">
                  <p className="text-xs text-slate-400 uppercase font-black">Địa điểm</p>
                  <p className="font-black">{ev.location}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border">
                  <p className="text-xs text-slate-400 uppercase font-black">Nhân sự</p>
                  <p className="font-black">{summary.staffCount} người</p>
                </div>
                <div className="bg-white p-4 rounded-lg border">
                  <p className="text-xs text-slate-400 uppercase font-black">Thiết bị</p>
                  <p className="font-black">{summary.itemsCount} cái</p>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="font-black text-slate-700 mb-2">Danh sách chi tiết</h4>
                  <div className="bg-white rounded-lg border p-4">
                  <p className="text-sm"><b>Lịch tổ chức:</b> {getEventSchedule(ev).length ? getEventSchedule(ev).map(item => `${new Date(item.date).toLocaleDateString('vi-VN')} (${item.sessions.map(s => SESSION_LABELS[s]).join(', ')})`).join(', ') : 'Không có'}</p>
                  <p className="text-sm"><b>Nhân sự:</b> {ev.staff?.length ? ev.staff.map(s => {
                      const emp = employees.find(en => en.id === s.employeeId);
                      const name = emp ? emp.name : s.employeeId;
                      const staffSessions = getStaffSessions(s);
                      const sess = staffSessions.length ? ` (${staffSessions.map(sess => SESSION_LABELS[sess]).join(', ')})` : '';
                      const date = s.shiftDate ? ` ${new Date(s.shiftDate).toLocaleDateString('vi-VN')}` : '';
                      return `${name}${sess}${date}`;
                    }).join(', ') : 'Không có'}</p>
                  <p className="text-sm mt-2"><b>Chi phí:</b> {ev.expenses?.length ? ev.expenses.map(ex => `${ex.description} (${ex.amount}đ)`).join('; ') : 'Không có'}</p>
                  <p className="text-sm mt-2"><b>Thiết bị:</b> {ev.items?.map(it => `${it.itemId} x ${it.quantity}`).join(', ') || 'Không có'}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
          onClose={() => setShowExportPDFModal(false)}
        />
      )}
    </div>
  );
};
