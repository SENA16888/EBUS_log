
import React, { useEffect, useMemo, useState } from 'react';
import { Event, InventoryItem, EventStatus, ComboPackage, Employee, EventExpense, EventStaffAllocation, Quotation, EventProcessStep } from '../types';
import { 
  Calendar, MapPin, Box, ArrowLeft, Plus, X, Layers, 
  Users, DollarSign, Trash2, Truck, BookOpen, 
  Utensils, Wallet, Printer, Coffee, AlertCircle,
  TrendingUp, ArrowRightLeft, UserCheck, Link as LinkIcon,
  Calculator, ChevronRight, PieChart as PieIcon, FileText, CheckCircle, RefreshCw
} from 'lucide-react';

interface EventManagerProps {
  events: Event[];
  inventory: InventoryItem[];
  packages?: ComboPackage[];
  employees?: Employee[];
  quotations?: Quotation[];
  onExportToEvent: (eventId: string, itemId: string, qty: number) => void;
  onExportPackageToEvent?: (eventId: string, packageId: string, qty: number) => void;
  onSyncQuotation?: (eventId: string, quotationId: string) => void;
  onReturnFromEvent: (eventId: string, itemId: string, qty: number) => void;
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
  onExportToEvent,
  onExportPackageToEvent,
  onSyncQuotation,
  onReturnFromEvent,
  onCreateEvent,
  onAssignStaff,
  onRemoveStaff,
  onAddExpense,
  onRemoveExpense,
  onLinkQuotation,
  onFinalizeOrder,
  onUpdateEvent
}) => {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'EQUIPMENT' | 'STAFF' | 'COSTS' | 'FLOWS'>('EQUIPMENT');
  
  // Modals
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  
  // Create Event Form State
  const [newEventData, setNewEventData] = useState({
    name: '',
    client: '',
    location: ''
  });
  const [newEventSchedule, setNewEventSchedule] = useState<EventScheduleItem[]>([]);
  const [newScheduleDate, setNewScheduleDate] = useState('');
  const sortedNewEventSchedule = useMemo(
    () => [...newEventSchedule].sort((a, b) => a.date.localeCompare(b.date)),
    [newEventSchedule]
  );

  // Export State
  const [exportMode, setExportMode] = useState<'SINGLE' | 'COMBO'>('SINGLE');
  const [selectedItemForExport, setSelectedItemForExport] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [exportQty, setExportQty] = useState(1);

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
  const [staffSession, setStaffSession] = useState<'MORNING' | 'AFTERNOON' | 'EVENING'>('MORNING');
  const [selectedShiftDate, setSelectedShiftDate] = useState<string | null>(null);

  // Expense State
  const [expenseCat, setExpenseCat] = useState<EventExpense['category']>('TRANSPORT_GOODS');
  const [expenseSub, setExpenseSub] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const linkedQuotation = selectedEvent?.quotationId ? quotations.find(q => q.id === selectedEvent.quotationId) : null;
  const fallbackProcessSteps = useMemo(() => createDefaultProcessSteps(), [selectedEventId]);
  const processSteps = selectedEvent?.processSteps && selectedEvent.processSteps.length > 0 ? selectedEvent.processSteps : fallbackProcessSteps;

  useEffect(() => {
    if (selectedEvent && (!selectedEvent.processSteps || selectedEvent.processSteps.length === 0) && onUpdateEvent) {
      onUpdateEvent(selectedEvent.id, { processSteps: createDefaultProcessSteps() });
    }
  }, [selectedEvent, onUpdateEvent]);

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
      processSteps: createDefaultProcessSteps()
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
    if (!selectedShiftDate) {
      alert('Vui lòng chọn ngày và ca (shift) trước khi phân công.');
      return;
    }
    const rate = Number(staffRate);
    const qty = Number(staffQty);
    // Kiểm tra trùng lịch: cùng ngày và cùng ca (so với tất cả các sự kiện)
    const conflicts = events.flatMap(e => (e.staff || []).filter(s => s.employeeId === selectedStaffId && s.session === staffSession && s.shiftDate === selectedShiftDate).map(s => ({ event: e, staff: s })));
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
      salary: rate * qty,
      session: staffSession,
      shiftDate: selectedShiftDate || undefined
    });
    setSelectedStaffId('');
    setStaffTask('');
    setStaffRate('');
    setStaffQty(1);
    setSelectedShiftDate(null);
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
      amount: Number(expenseAmount)
    });
    setExpenseDesc('');
    setExpenseAmount('');
    setExpenseSub('');
  };

  const handleStaffSelect = (empId: string) => {
    setSelectedStaffId(empId);
    const emp = employees.find(e => e.id === empId);
    if (emp) {
      setStaffTask(emp.role);
      setStaffRate(emp.baseRate ? emp.baseRate.toString() : '');
    }
  };

  const handleLinkQuotation = (qId: string) => {
    if (selectedEventId && onLinkQuotation) {
      onLinkQuotation(selectedEventId, qId);
    }
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
  };

  // Tài chính
  const staffCosts = selectedEvent?.staff?.reduce((a, b) => a + b.salary, 0) || 0;
  const otherCosts = selectedEvent?.expenses?.reduce((a, b) => a + b.amount, 0) || 0;
  const totalCosts = staffCosts + otherCosts;
  const revenue = linkedQuotation?.totalAmount || 0;
  const grossProfit = revenue - totalCosts;
  const profitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const totalChecklistCount = processSteps.reduce((acc, step) => acc + step.checklist.length, 0);
  const totalChecklistDone = processSteps.reduce((acc, step) => acc + step.checklist.filter(item => item.checked).length, 0);

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-100px)] gap-6">
      {/* Sidebar */}
      <div className="w-full lg:w-1/3 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col h-full overflow-hidden">
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
              onClick={() => setSelectedEventId(event.id)}
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
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col h-full overflow-hidden">
        {selectedEvent ? (
          <>
            <div className="p-6 border-b border-slate-100">
              <div className="flex justify-between items-start">
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
              
              <div className="flex space-x-8 mt-6">
                <button onClick={() => setDetailTab('EQUIPMENT')} className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${detailTab === 'EQUIPMENT' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  <Box size={16}/> Thiết Bị
                </button>
                <button onClick={() => setDetailTab('STAFF')} className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${detailTab === 'STAFF' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  <Users size={16}/> Nhân Sự
                </button>
                <button onClick={() => setDetailTab('COSTS')} className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${detailTab === 'COSTS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  <DollarSign size={16}/> Chi Phí & Lợi Nhuận
                </button>
                <button onClick={() => setDetailTab('FLOWS')} className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${detailTab === 'FLOWS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  <Layers size={16}/> Luồng xử lý
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
              {detailTab === 'EQUIPMENT' && (
                <div className="space-y-4">
                  {/* Sync From Quotation Banner */}
                  {linkedQuotation && (
                    <div className="bg-blue-600 p-4 rounded-xl text-white shadow-lg flex justify-between items-center">
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

                  <div className="flex gap-2">
                    <button onClick={() => { setExportMode('SINGLE'); setShowExportModal(true); }} className="bg-white border border-blue-600 text-blue-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-50">+ Thêm lẻ</button>
                    <button onClick={() => { setExportMode('COMBO'); setShowExportModal(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700">+ Thêm Combo</button>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="px-3 py-3 font-bold text-gray-500 uppercase text-[10px] text-center">Đã xong</th>
                          <th className="px-4 py-3 font-bold text-gray-500 uppercase text-[10px]">Thiết bị</th>
                          <th className="px-4 py-3 font-bold text-gray-500 uppercase text-[10px] text-center">Số lượng</th>
                          <th className="px-4 py-3 font-bold text-gray-500 uppercase text-[10px] text-center">Đã trả</th>
                          <th className="px-4 py-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedEvent.items.map((alloc, i) => {
                          const item = inventory.find(inv => inv.id === alloc.itemId);
                          return (
                            <tr key={i} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 text-center">
                                <input type="checkbox" checked={!!alloc.done} onChange={e => onToggleItemDone?.(selectedEvent.id, alloc.itemId, e.target.checked)} />
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <img src={item?.imageUrl} className="w-8 h-8 rounded" />
                                  <span className="font-bold">{item?.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center font-black text-blue-600">{alloc.quantity}</td>
                              <td className="px-4 py-3 text-center font-black text-green-600">{alloc.returnedQuantity}</td>
                              <td className="px-4 py-3">
                                <button 
                                  onClick={() => onReturnFromEvent(selectedEvent.id, alloc.itemId, 1)} 
                                  disabled={alloc.returnedQuantity >= alloc.quantity}
                                  className={`p-1 rounded ${
                                    alloc.returnedQuantity >= alloc.quantity 
                                      ? 'text-gray-300 cursor-not-allowed bg-gray-50' 
                                      : 'text-blue-600 hover:bg-blue-100'
                                  }`}
                                  title={alloc.returnedQuantity >= alloc.quantity ? `Đã trả hết ${alloc.quantity} sản phẩm` : `Còn có thể trả ${alloc.quantity - alloc.returnedQuantity} sản phẩm`}
                                >
                                  <ArrowLeft size={16}/>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {selectedEvent.items.length === 0 && (
                          <tr><td colSpan={5} className="p-10 text-center text-gray-400 italic">Chưa có thiết bị nào trong danh sách xuất.</td></tr>
                        )}
                      </tbody>
                    </table>
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
                          <p className="text-xs font-black text-gray-400 uppercase mb-2">Chọn ngày & ca</p>
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
                                                  onClick={() => { setSelectedShiftDate(iso); setStaffSession(sess); }}
                                                  className={`flex-1 text-xs py-1 rounded ${selectedShiftDate === iso && staffSession === sess ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
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
                          {selectedShiftDate && (
                            <div className="mt-2 text-[12px] text-slate-500">Đang chọn: <span className="font-bold text-slate-700">{new Date(selectedShiftDate).toLocaleDateString('vi-VN')}</span> • <span className="font-black">{staffSession === 'MORNING' ? 'SÁNG' : staffSession === 'AFTERNOON' ? 'CHIỀU' : 'TỐI'}</span></div>
                          )}
                        </div>
                      )}
                    <div className="grid grid-cols-4 gap-3">
                      <select className="border border-slate-200 rounded-lg p-2 text-sm bg-white" value={staffUnit} onChange={e => setStaffUnit(e.target.value as any)}>
                        <option value="DAY">Theo Ngày</option>
                        <option value="HOUR">Theo Giờ</option>
                        <option value="FIXED">Trọn gói</option>
                      </select>
                      <select className="border border-slate-200 rounded-lg p-2 text-sm bg-white" value={staffSession} onChange={e => setStaffSession(e.target.value as any)}>
                        <option value="MORNING">SÁNG</option>
                        <option value="AFTERNOON">CHIỀU</option>
                        <option value="EVENING">TỐI</option>
                      </select>
                      <input type="number" className="border border-slate-200 rounded-lg p-2 text-sm text-center" placeholder="SL" value={staffQty} onChange={e => setStaffQty(Number(e.target.value))} />
                      <input type="number" className="border border-slate-200 rounded-lg p-2 text-sm font-bold text-blue-600" placeholder="Đơn giá" value={staffRate} onChange={e => setStaffRate(e.target.value)} />
                    </div>
                    <button onClick={handleStaffAssignSubmit} className="w-full bg-slate-800 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-slate-900 transition shadow-sm">Thêm nhân sự</button>
                  </div>

                  <div className="space-y-3">
                    {selectedEvent.staff?.map((s, idx) => {
                      const emp = employees.find(e => e.id === s.employeeId);
                      return (
                        <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center hover:shadow-md transition">
                           <div className="flex items-center gap-4">
                              <img src={emp?.avatarUrl} className="w-12 h-12 rounded-full border-2 border-slate-100" />
                              <div>
                                <p className="font-bold text-gray-800">{emp?.name}</p>
                                <p className="text-xs font-medium text-blue-600">{s.task} • {s.quantity} {s.unit === 'DAY' ? 'ngày' : 'giờ'}</p>
                                {s.session && (
                                  <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                                    {s.session === 'MORNING' ? 'SÁNG' : s.session === 'AFTERNOON' ? 'CHIỀU' : 'TỐI'}
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

                  {/* PROFIT SUMMARY CARD */}
                  <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                      <PieIcon size={160} />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-l-2 border-blue-500 pl-2">Doanh thu (A)</p>
                        <p className="text-3xl font-black text-blue-400">{revenue.toLocaleString()}đ</p>
                        {linkedQuotation && <p className="text-[10px] text-slate-500 italic">Khách hàng: {linkedQuotation.clientName}</p>}
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
                    </div>
                    <button onClick={handleAddExpenseSubmit} className="w-full bg-slate-800 text-white py-3 rounded-xl text-sm font-black hover:bg-black transition shadow-lg uppercase tracking-widest">Lưu chi phí</button>
                  </div>
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
                <select className="w-full border rounded-xl p-3 bg-white" value={selectedItemForExport} onChange={e => setSelectedItemForExport(e.target.value)}>
                  <option value="">-- Chọn thiết bị --</option>
                  {inventory.filter(i => i.availableQuantity > 0).map(item => <option key={item.id} value={item.id}>{item.name} (Sẵn kho: {item.availableQuantity})</option>)}
                </select>
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
                      const sess = s.session ? ` (${s.session === 'MORNING' ? 'SÁNG' : s.session === 'AFTERNOON' ? 'CHIỀU' : 'TỐI'})` : '';
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
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl p-10 rounded-xl shadow-2xl" id="print-slip">
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
                      <td className="p-3 text-slate-400 italic">Kiểm tra OK</td>
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
                <button onClick={() => window.print()} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black flex items-center gap-2 shadow-lg shadow-blue-200 uppercase tracking-widest text-xs transition active:scale-95"><Printer size={18}/> In Lệnh Xuất Kho</button>
                <button onClick={() => setShowPrintModal(false)} className="bg-slate-100 text-slate-600 px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs">Đóng</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
