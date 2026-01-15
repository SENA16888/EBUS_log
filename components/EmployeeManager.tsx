import React, { useEffect, useMemo, useState } from 'react';
import { Employee, Event, EventStatus, EventStaffAllocation, PayrollAdjustment } from '../types';
import { Search, Plus, X, Pencil, Trash2, Phone, Mail, User, DollarSign, Calendar, Printer, ChevronDown, ChevronUp } from 'lucide-react';

interface EmployeeManagerProps {
  employees: Employee[];
  events?: Event[];
  payrollAdjustments?: PayrollAdjustment[];
  onAddEmployee: (emp: Employee) => void;
  onUpdateEmployee: (emp: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  onUpsertPayrollAdjustment?: (payload: { employeeId: string; month: string; bonusAmount: number; note?: string }) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canAdjustPayroll?: boolean;
}

export const EmployeeManager: React.FC<EmployeeManagerProps> = ({
  employees,
  events = [],
  payrollAdjustments = [],
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onUpsertPayrollAdjustment,
  canEdit = true,
  canDelete = true,
  canAdjustPayroll = false
}) => {
  type StaffEventInfo = {
    event: Event;
    staff: EventStaffAllocation;
    date: string;
    isUpcoming: boolean;
  };
  type PayrollEntry = {
    employeeId: string;
    eventName: string;
    date: string;
    task?: string;
    sessions: string[];
    salary: number;
    rate?: number;
    quantity?: number;
    unit?: EventStaffAllocation['unit'];
    month: string;
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payrollMonth, setPayrollMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [expandedPayrollRows, setExpandedPayrollRows] = useState<Record<string, boolean>>({});
  const [bonusDrafts, setBonusDrafts] = useState<Record<string, { amount: string; note: string }>>({});

  const [formData, setFormData] = useState({
    name: '',
    role: '',
    phone: '',
    email: '',
    baseRate: ''
  });

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.phone.includes(searchTerm)
  );

  const handleOpenEdit = (emp: Employee) => {
    if (!canEdit) return;
    setEditingId(emp.id);
    setFormData({
      name: emp.name,
      role: emp.role,
      phone: emp.phone,
      email: emp.email || '',
      baseRate: emp.baseRate ? emp.baseRate.toString() : ''
    });
    setShowModal(true);
  };

  const handleOpenAdd = () => {
    if (!canEdit) return;
    setEditingId(null);
    setFormData({
      name: '',
      role: '',
      phone: '',
      email: '',
      baseRate: ''
    });
    setShowModal(true);
  };

  const formatDate = (date?: string) => {
    if (!date) return 'Không rõ ngày';
    return new Date(date).toLocaleDateString('vi-VN');
  };

  const sessionLabel: Record<string, string> = {
    MORNING: 'Sáng',
    AFTERNOON: 'Chiều',
    EVENING: 'Tối'
  };
  const getStaffSessions = (staff: EventStaffAllocation) => {
    if (staff.sessions && staff.sessions.length > 0) return staff.sessions;
    return staff.session ? [staff.session] : [];
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const employeeEventStats = useMemo(() => {
    return employees.reduce((acc, emp) => {
      const allocations = events.flatMap(event => (event.staff || [])
        .filter(s => s.employeeId === emp.id)
        .map(s => ({
          event,
          staff: s,
          date: s.shiftDate || event.startDate || event.endDate || '',
          isUpcoming: (() => {
            if (event.status === EventStatus.COMPLETED || event.status === EventStatus.CANCELLED) return false;
            if (!s.shiftDate && !event.startDate) return true;
            return (s.shiftDate || event.startDate || todayStr) >= todayStr;
          })()
        } as StaffEventInfo))
      );

      const sorted = allocations.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      const upcoming = sorted.filter(a => a.isUpcoming);
      const history = sorted.filter(a => !a.isUpcoming);
      acc[emp.id] = {
        participationCount: sorted.length,
        upcoming,
        history
      };
      return acc;
    }, {} as Record<string, { participationCount: number; upcoming: StaffEventInfo[]; history: StaffEventInfo[] }>);
  }, [employees, events, todayStr]);
  const payrollAdjustmentMap = useMemo(() => {
    const map = new Map<string, PayrollAdjustment>();
    payrollAdjustments.forEach(adj => {
      if (adj.employeeId && adj.month) {
        map.set(`${adj.employeeId}-${adj.month}`, adj);
      }
    });
    return map;
  }, [payrollAdjustments]);

  useEffect(() => {
    const nextDrafts: Record<string, { amount: string; note: string }> = {};
    employees.forEach(emp => {
      const adj = payrollAdjustmentMap.get(`${emp.id}-${payrollMonth}`);
      nextDrafts[emp.id] = {
        amount: adj ? String(adj.bonusAmount) : '',
        note: adj?.note || ''
      };
    });
    setBonusDrafts(nextDrafts);
  }, [employees, payrollAdjustmentMap, payrollMonth]);

  const payrollEntries = useMemo<PayrollEntry[]>(() => {
    return events.flatMap(event => {
      return (event.staff || []).map(staff => {
        const date = staff.shiftDate || event.startDate || event.endDate || '';
        if (!date) return null;
        const monthKey = date.slice(0, 7);
        const salaryAmount = Number.isFinite(staff.salary) ? Number(staff.salary) : (staff.unit === 'FIXED' ? staff.rate : (staff.rate || 0) * (staff.quantity || 0));
        return {
          employeeId: staff.employeeId,
          eventName: event.name,
          date,
          task: staff.task,
          sessions: getStaffSessions(staff),
          salary: Number.isFinite(salaryAmount) ? salaryAmount : 0,
          rate: staff.rate,
          quantity: staff.quantity,
          unit: staff.unit,
          month: monthKey
        } as PayrollEntry;
      }).filter((entry): entry is PayrollEntry => Boolean(entry));
    });
  }, [events]);

  const payrollRows = useMemo(() => {
    const grouped = new Map<string, PayrollEntry[]>();
    payrollEntries
      .filter(entry => entry.month === payrollMonth)
      .forEach(entry => {
        const list = grouped.get(entry.employeeId) || [];
        list.push(entry);
        grouped.set(entry.employeeId, list);
      });

    return employees.map(emp => {
      const entries = [...(grouped.get(emp.id) || [])].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      const baseTotal = entries.reduce((sum, entry) => sum + (Number.isFinite(entry.salary) ? entry.salary : 0), 0);
      const adj = payrollAdjustmentMap.get(`${emp.id}-${payrollMonth}`);
      const bonusAmount = Number(adj?.bonusAmount) || 0;
      const bonusNote = adj?.note || '';
      return {
        employee: emp,
        entries,
        baseTotal,
        bonusAmount,
        bonusNote,
        total: baseTotal + bonusAmount
      };
    }).sort((a, b) => b.total - a.total);
  }, [employees, payrollEntries, payrollMonth, payrollAdjustmentMap]);

  const togglePayrollRow = (id: string) => {
    setExpandedPayrollRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleBonusDraftChange = (empId: string, field: 'amount' | 'note', value: string) => {
    setBonusDrafts(prev => ({
      ...prev,
      [empId]: { ...(prev[empId] || { amount: '', note: '' }), [field]: value }
    }));
  };

  const handleSaveBonus = (empId: string) => {
    if (!onUpsertPayrollAdjustment) return;
    const draft = bonusDrafts[empId] || { amount: '', note: '' };
    onUpsertPayrollAdjustment({
      employeeId: empId,
      month: payrollMonth,
      bonusAmount: Number(draft.amount) || 0,
      note: draft.note
    });
  };

  const handlePrintPayroll = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      alert('Trình duyệt đang chặn cửa sổ in. Vui lòng cho phép popup.');
      return;
    }
    const rowsHtml = payrollRows.map(row => {
      const detailHtml = row.entries.length
        ? row.entries.map(entry => {
            const sessionText = entry.sessions.length ? entry.sessions.map(sess => sessionLabel[sess] || sess).join(', ') : '';
            return `<li style="margin-bottom:4px; line-height:1.4;"><strong>${entry.eventName}</strong> • ${formatDate(entry.date)} • ${entry.salary.toLocaleString()} đ${entry.task ? ` • ${entry.task}` : ''}${sessionText ? ` • Ca: ${sessionText}` : ''}</li>`;
          }).join('')
        : '<em>Chưa có nguồn lương trong tháng.</em>';
      return `
        <tr>
          <td>
            <div><strong>${row.employee.name}</strong></div>
            <div style="font-size:12px; color:#475569;">${row.employee.role || 'Chưa có vị trí'} • ${row.employee.phone}</div>
          </td>
          <td style="text-align:right;">${row.baseTotal.toLocaleString()} đ</td>
          <td style="text-align:right;">${row.bonusAmount.toLocaleString()} đ${row.bonusNote ? `<div class="note">${row.bonusNote}</div>` : ''}</td>
          <td style="text-align:right;" class="total">${row.total.toLocaleString()} đ</td>
        </tr>
        <tr>
          <td colspan="4">${row.entries.length ? `<ul style="margin:6px 0 0 14px; padding:0;">${detailHtml}</ul>` : detailHtml}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Bảng lương tháng ${payrollMonth}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; color: #0f172a; }
            h2 { margin: 0 0 12px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px; font-size: 12px; vertical-align: top; }
            th { background: #f8fafc; text-align: left; }
            .total { font-weight: 700; }
            .note { color: #475569; font-size: 11px; margin-top: 4px; }
          </style>
        </head>
        <body>
          <h2>Bảng lương tháng ${payrollMonth}</h2>
          <table>
            <thead>
              <tr>
                <th>Nhân sự</th>
                <th>Tổng lương</th>
                <th>Thưởng</th>
                <th>Tổng cộng</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="4">Chưa có dữ liệu lương cho tháng này.</td></tr>'}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 200);
  };

  const handleSubmit = () => {
    if (!canEdit) return;
    if (!formData.name || !formData.phone) {
      alert("Vui lòng nhập tên và số điện thoại.");
      return;
    }

    const employeeData: Employee = {
      id: editingId || `EMP-${Date.now()}`,
      name: formData.name,
      role: formData.role,
      phone: formData.phone,
      email: formData.email,
      baseRate: formData.baseRate ? Number(formData.baseRate) : 0,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name)}&background=random`
    };

    if (editingId) {
      onUpdateEmployee(employeeData);
    } else {
      onAddEmployee(employeeData);
    }

    setShowModal(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-xl font-semibold text-gray-800">Danh Mục Nhân Sự</h2>
        {canEdit && (
          <button 
            onClick={handleOpenAdd}
            className="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 transition flex items-center gap-2 text-sm font-medium shadow-sm"
          >
            <Plus size={14} /> Thêm Nhân Viên
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Bảng lương</p>
            <h3 className="text-lg font-bold text-gray-800">Tổng hợp lương theo tháng</h3>
            <p className="text-sm text-gray-500">Xem nguồn tính lương từng nhân sự, thêm thưởng kèm lý do và in ra PDF.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="month"
              value={payrollMonth}
              onChange={(e) => setPayrollMonth(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            <button
              onClick={handlePrintPayroll}
              className="inline-flex items-center gap-2 bg-slate-900 text-white px-3 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-slate-950"
            >
              <Printer size={16} /> In PDF
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm border border-slate-100 rounded-lg overflow-hidden">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3">Nhân sự</th>
                <th className="text-right px-4 py-3">Tổng lương</th>
                <th className="text-left px-4 py-3">Thưởng (+ lý do)</th>
                <th className="text-right px-4 py-3">Tổng cộng</th>
                <th className="text-center px-4 py-3">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payrollRows.map(row => {
                const draft = bonusDrafts[row.employee.id] || { amount: '', note: '' };
                return (
                  <React.Fragment key={row.employee.id}>
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{row.employee.name}</p>
                        <p className="text-xs text-slate-500">{row.employee.role || 'Chưa có vị trí'} • {row.employee.phone}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{row.baseTotal.toLocaleString()} đ</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              value={draft.amount}
                              onChange={(e) => handleBonusDraftChange(row.employee.id, 'amount', e.target.value)}
                              className="w-full sm:w-32 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                              placeholder="0"
                              disabled={!canAdjustPayroll}
                            />
                            <input
                              type="text"
                              value={draft.note}
                              onChange={(e) => handleBonusDraftChange(row.employee.id, 'note', e.target.value)}
                              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                              placeholder="Lý do thưởng"
                              disabled={!canAdjustPayroll}
                            />
                            {canAdjustPayroll && (
                              <button
                                onClick={() => handleSaveBonus(row.employee.id)}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
                              >
                                Lưu
                              </button>
                            )}
                          </div>
                          {(row.bonusAmount > 0 || row.bonusNote) && (
                            <p className="text-[11px] text-slate-500">
                              Đã lưu: {row.bonusAmount.toLocaleString()} đ {row.bonusNote ? `• ${row.bonusNote}` : ''}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-blue-700">{row.total.toLocaleString()} đ</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => togglePayrollRow(row.employee.id)}
                          className="text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 text-xs font-semibold"
                        >
                          {expandedPayrollRows[row.employee.id] ? (
                            <>
                              Ẩn <ChevronUp size={14} />
                            </>
                          ) : (
                            <>
                              Chi tiết <ChevronDown size={14} />
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                    {expandedPayrollRows[row.employee.id] && (
                      <tr className="bg-slate-50/60">
                        <td colSpan={5} className="px-4 py-3">
                          {row.entries.length === 0 ? (
                            <p className="text-xs text-slate-500">Chưa có nguồn lương trong tháng này.</p>
                          ) : (
                            <div className="grid md:grid-cols-2 gap-3">
                              {row.entries.map((entry, idx) => (
                                <div key={`${entry.eventName}-${entry.date}-${idx}`} className="border border-slate-200 rounded-lg bg-white p-3 shadow-sm">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="font-semibold text-slate-800">{entry.eventName}</p>
                                    <span className="text-[11px] text-slate-500">{formatDate(entry.date)}</span>
                                  </div>
                                  <p className="text-xs text-slate-500">
                                    {entry.sessions.length ? `Ca: ${entry.sessions.map(sess => sessionLabel[sess] || sess).join(', ')}` : 'Ca: -'}
                                    {entry.task ? ` • ${entry.task}` : ''}
                                  </p>
                                  <p className="text-sm font-bold text-green-700 mt-1">{entry.salary.toLocaleString()} đ</p>
                                  <p className="text-[11px] text-slate-500">
                                    {entry.unit === 'FIXED' ? 'Khoản cố định' : `Đơn giá ${entry.rate?.toLocaleString() || 0} x ${entry.quantity || 0} ${entry.unit === 'DAY' ? 'ngày' : 'giờ/ca'}`}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {payrollRows.length === 0 && (
            <p className="text-sm text-slate-500 p-4">Chưa có dữ liệu lương cho tháng này.</p>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Tìm kiếm nhân viên theo tên, vai trò, SĐT..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </div>

      {/* List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {filteredEmployees.map(emp => (
          <div key={emp.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 flex gap-3 hover:shadow-md transition group relative">
             <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {canEdit && (
                  <button onClick={() => handleOpenEdit(emp)} className="p-1 text-gray-400 hover:text-blue-600 bg-slate-50 rounded">
                    <Pencil size={14} />
                  </button>
                )}
                {canDelete && (
                  <button 
                    onClick={() => { if(window.confirm('Xóa nhân viên này?')) onDeleteEmployee(emp.id); }} 
                    className="p-1 text-gray-400 hover:text-red-600 bg-slate-50 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
             </div>

             <img src={emp.avatarUrl} alt={emp.name} className="w-12 h-12 rounded-full object-cover border border-slate-200" />
             
             <div className="flex-1">
                <h3 className="font-semibold text-gray-800 text-base leading-tight">{emp.name}</h3>
                <p className="text-blue-600 font-medium text-xs mb-1">{emp.role || 'Chưa có vị trí'}</p>
                
                <div className="space-y-0.5 text-xs text-gray-600">
                   <p className="flex items-center gap-2"><Phone size={12} /> {emp.phone}</p>
                   {emp.email && <p className="flex items-center gap-2"><Mail size={12} /> {emp.email}</p>}
                   {emp.baseRate && (
                     <p className="flex items-center gap-2 text-green-600 font-medium">
                    <DollarSign size={12} /> {emp.baseRate.toLocaleString()} đ/ngày
                  </p>
                 )}
                </div>
             </div>

             {/* Lịch sử & lịch sắp tới */}
             <div className="mt-1 text-xs text-gray-700 flex-1 border-t border-slate-100 pt-2">
               {(() => {
                 const stats = employeeEventStats[emp.id] || { participationCount: 0, upcoming: [], history: [] };
                 const upcomingPreview = stats.upcoming[0];
                 const historyPreview = stats.history[stats.history.length - 1];
                 return (
                   <div className="space-y-2">
                     <div className="flex items-center justify-between">
                       <span className="text-gray-600">Đã tham gia: <strong>{stats.participationCount}</strong> sự kiện</span>
                       {stats.upcoming.length > 0 ? (
                         <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold">Sắp tới: {stats.upcoming.length}</span>
                       ) : (
                         <span className="text-[11px] text-gray-400">Không có lịch sắp tới</span>
                       )}
                     </div>

                     {upcomingPreview && (
                       <div className="p-2 rounded-md border border-emerald-100 bg-emerald-50/60">
                         <div className="flex items-start gap-2 text-emerald-700 font-semibold">
                           <Calendar size={12} /> <span className="text-xs leading-tight">{upcomingPreview.event.name}</span>
                         </div>
                         <p className="text-[11px] text-gray-600 mt-1 leading-snug">
                           {formatDate(upcomingPreview.date)} {(() => {
                             const sessions = getStaffSessions(upcomingPreview.staff);
                             return sessions.length ? `• ${sessions.map((s: string) => sessionLabel[s] || s).join(', ')}` : '';
                           })()} {upcomingPreview.staff.task ? `• ${upcomingPreview.staff.task}` : ''}
                           {stats.upcoming.length > 1 && <span className="text-emerald-700 font-semibold"> +{stats.upcoming.length - 1} lịch khác</span>}
                         </p>
                       </div>
                     )}

                     <div>
                       <p className="text-[11px] font-semibold text-gray-500 uppercase mb-1">Lịch sử gần đây</p>
                       {historyPreview ? (
                         <div className="p-2 rounded-md border border-slate-100 bg-slate-50">
                           <div className="flex items-start gap-2 text-gray-800 font-semibold">
                             <Calendar size={12} /> <span className="text-xs leading-tight">{historyPreview.event.name}</span>
                           </div>
                           <p className="text-[11px] text-gray-600 mt-1 leading-snug">
                             {formatDate(historyPreview.date)} {(() => {
                               const sessions = getStaffSessions(historyPreview.staff);
                               return sessions.length ? `• ${sessions.map((s: string) => sessionLabel[s] || s).join(', ')}` : '';
                             })()} {historyPreview.staff.task ? `• ${historyPreview.staff.task}` : ''}
                             {stats.history.length > 1 && <span className="text-gray-700 font-semibold"> +{stats.history.length - 1} lịch cũ</span>}
                           </p>
                         </div>
                       ) : (
                         <p className="text-[11px] text-gray-400">Chưa có dữ liệu lịch sử.</p>
                       )}
                     </div>
                   </div>
                 );
               })()}
             </div>
          </div>
        ))}
      </div>

      {filteredEmployees.length === 0 && (
         <div className="text-center py-20 text-gray-500">
           Không tìm thấy nhân viên nào.
         </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-6">
               <h3 className="text-xl font-bold text-gray-800">{editingId ? 'Sửa Thông Tin Nhân Viên' : 'Thêm Nhân Viên Mới'}</h3>
               <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                 <X size={24} />
               </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Họ và Tên</label>
                <input 
                  type="text" 
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Nguyễn Văn A"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vị trí / Chuyên môn</label>
                <input 
                  type="text" 
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  placeholder="Kỹ thuật viên âm thanh"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                   <input 
                      type="text" 
                      className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Email (Tùy chọn)</label>
                   <input 
                      type="email" 
                      className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lương cơ bản gợi ý (VNĐ)</label>
                <input 
                  type="number" 
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.baseRate}
                  onChange={(e) => setFormData({...formData, baseRate: e.target.value})}
                  placeholder="500000"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button 
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-sm"
              >
                Lưu Thông Tin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
