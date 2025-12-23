
import React, { useState } from 'react';
import { Event, InventoryItem, EventStatus, ComboPackage, Employee, EventExpense, EventStaffAllocation, Quotation } from '../types';
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
  onCreateEvent: (newEvent: Event) => void;
  onAssignStaff?: (eventId: string, staffData: EventStaffAllocation) => void;
  onRemoveStaff?: (eventId: string, employeeId: string) => void;
  onAddExpense?: (eventId: string, expense: EventExpense) => void;
  onRemoveExpense?: (eventId: string, expenseId: string) => void;
  onLinkQuotation?: (eventId: string, quotationId: string) => void;
  onFinalizeOrder?: (eventId: string) => void;
}

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
  onFinalizeOrder
}) => {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'EQUIPMENT' | 'STAFF' | 'COSTS'>('EQUIPMENT');
  
  // Modals
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  
  // Create Event Form State
  const [newEventData, setNewEventData] = useState({
    name: '',
    client: '',
    location: '',
    startDate: '',
    endDate: ''
  });

  // Export State
  const [exportMode, setExportMode] = useState<'SINGLE' | 'COMBO'>('SINGLE');
  const [selectedItemForExport, setSelectedItemForExport] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [exportQty, setExportQty] = useState(1);

  // Assign Staff State
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [staffTask, setStaffTask] = useState('');
  const [staffUnit, setStaffUnit] = useState<'HOUR' | 'DAY' | 'FIXED'>('DAY');
  const [staffQty, setStaffQty] = useState(1);
  const [staffRate, setStaffRate] = useState('');

  // Expense State
  const [expenseCat, setExpenseCat] = useState<EventExpense['category']>('TRANSPORT_GOODS');
  const [expenseSub, setExpenseSub] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const linkedQuotation = selectedEvent?.quotationId ? quotations.find(q => q.id === selectedEvent.quotationId) : null;

  const handleCreateEventSubmit = () => {
    if (!newEventData.name || !newEventData.client || !newEventData.startDate) {
      alert("Vui lòng điền đủ thông tin sự kiện!");
      return;
    }
    const newEvent: Event = {
      id: `EVT-${Date.now()}`,
      name: newEventData.name,
      client: newEventData.client,
      location: newEventData.location,
      startDate: newEventData.startDate,
      endDate: newEventData.endDate || newEventData.startDate,
      status: EventStatus.UPCOMING,
      items: [],
      staff: [],
      expenses: []
    };
    onCreateEvent(newEvent);
    setShowCreateEventModal(false);
    setNewEventData({ name: '', client: '', location: '', startDate: '', endDate: '' });
    setSelectedEventId(newEvent.id);
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

  const handleStaffAssignSubmit = () => {
    if (!selectedEventId || !selectedStaffId || !staffTask || !staffRate || !onAssignStaff) {
      alert("Vui lòng nhập đầy đủ thông tin nhân sự!");
      return;
    }
    const rate = Number(staffRate);
    const qty = Number(staffQty);
    onAssignStaff(selectedEventId, {
      employeeId: selectedStaffId,
      task: staffTask,
      unit: staffUnit,
      quantity: qty,
      rate: rate,
      salary: rate * qty
    });
    setSelectedStaffId('');
    setStaffTask('');
    setStaffRate('');
    setStaffQty(1);
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

  // Tài chính
  const staffCosts = selectedEvent?.staff?.reduce((a, b) => a + b.salary, 0) || 0;
  const otherCosts = selectedEvent?.expenses?.reduce((a, b) => a + b.amount, 0) || 0;
  const totalCosts = staffCosts + otherCosts;
  const revenue = linkedQuotation?.totalAmount || 0;
  const grossProfit = revenue - totalCosts;
  const profitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-100px)] gap-6">
      {/* Sidebar */}
      <div className="w-full lg:w-1/3 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-gray-800 text-lg">Sự Kiện</h3>
          <button 
            onClick={() => setShowCreateEventModal(true)} 
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {events.length === 0 && <div className="text-center py-10 text-gray-400 italic text-sm">Chưa có sự kiện nào.</div>}
          {events.map(event => (
            <div 
              key={event.id}
              onClick={() => setSelectedEventId(event.id)}
              className={`p-4 rounded-xl border-2 cursor-pointer transition ${selectedEventId === event.id ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-transparent bg-white border-slate-100'}`}
            >
              <h4 className="font-bold text-gray-800">{event.name}</h4>
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><Calendar size={12}/> {event.startDate}</p>
              {event.quotationId && <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full"><LinkIcon size={10}/> Đã gắn báo giá</div>}
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
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <img src={item?.imageUrl} className="w-8 h-8 rounded" />
                                  <span className="font-bold">{item?.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center font-black text-blue-600">{alloc.quantity}</td>
                              <td className="px-4 py-3 text-center font-black text-green-600">{alloc.returnedQuantity}</td>
                              <td className="px-4 py-3">
                                <button onClick={() => onReturnFromEvent(selectedEvent.id, alloc.itemId, 1)} className="p-1 text-blue-600 hover:bg-blue-100 rounded">
                                  <ArrowLeft size={16}/>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {selectedEvent.items.length === 0 && (
                          <tr><td colSpan={4} className="p-10 text-center text-gray-400 italic">Chưa có thiết bị nào trong danh sách xuất.</td></tr>
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
                    <div className="grid grid-cols-3 gap-3">
                      <select className="border border-slate-200 rounded-lg p-2 text-sm bg-white" value={staffUnit} onChange={e => setStaffUnit(e.target.value as any)}>
                        <option value="DAY">Theo Ngày</option>
                        <option value="HOUR">Theo Giờ</option>
                        <option value="FIXED">Trọn gói</option>
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
                              </div>
                           </div>
                           <div className="flex items-center gap-6">
                              <p className="font-black text-gray-800">{s.salary.toLocaleString()}đ</p>
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
                        className="flex-1 rounded-xl p-3 text-sm bg-white text-gray-800 outline-none focus:ring-2 focus:ring-blue-200 border border-white/40 shadow-lg"
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
              <div className="grid grid-cols-2 gap-4">
                 <input type="date" className="w-full border border-slate-300 rounded-xl p-3" value={newEventData.startDate} onChange={e => setNewEventData({...newEventData, startDate: e.target.value})} />
                 <input type="date" className="w-full border border-slate-300 rounded-xl p-3" value={newEventData.endDate} onChange={e => setNewEventData({...newEventData, endDate: e.target.value})} />
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
