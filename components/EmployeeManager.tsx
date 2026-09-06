import React, { useEffect, useMemo, useState } from 'react';
import { Employee, Event, EventStatus, EventStaffAllocation, EventVenueType, PayrollAdjustment } from '../types';
import { Search, Plus, X, Pencil, Trash2, Phone, Mail, DollarSign, Calendar, Printer, ChevronDown, ChevronUp, FileText } from 'lucide-react';

type EmployeePdfFieldKey =
  | 'id'
  | 'name'
  | 'role'
  | 'phone'
  | 'email'
  | 'baseRate'
  | 'status'
  | 'participationCount'
  | 'upcomingSchedule'
  | 'lastSchedule';

type EmployeePdfScope = 'ALL' | 'FILTERED' | 'ACTIVE' | 'INACTIVE';

const EMPLOYEE_PDF_FIELDS: { key: EmployeePdfFieldKey; label: string }[] = [
  { key: 'id', label: 'Mã nhân sự' },
  { key: 'name', label: 'Tên' },
  { key: 'role', label: 'Vị trí / chuyên môn' },
  { key: 'phone', label: 'SĐT' },
  { key: 'email', label: 'Email' },
  { key: 'baseRate', label: 'Lương gợi ý' },
  { key: 'status', label: 'Tình trạng làm việc' },
  { key: 'participationCount', label: 'Số sự kiện đã tham gia' },
  { key: 'upcomingSchedule', label: 'Lịch sắp tới' },
  { key: 'lastSchedule', label: 'Lịch gần nhất' }
];

const loadEmployeePdfRenderLibs = async () => {
  const [canvasMod, pdfMod]: any[] = await Promise.all([
    import('html2canvas'),
    import('jspdf')
  ]);
  return {
    html2canvas: canvasMod?.default || canvasMod,
    jsPDF: pdfMod?.jsPDF || pdfMod?.default || pdfMod
  };
};

interface EmployeeManagerProps {
  employees: Employee[];
  events?: Event[];
  payrollAdjustments?: PayrollAdjustment[];
  onAddEmployee: (emp: Employee) => void;
  onUpdateEmployee: (emp: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  onUpsertPayrollAdjustment?: (payload: { employeeId: string; month: string; bonusAmount: number; penaltyAmount?: number; note?: string; penaltyNote?: string }) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canAdjustPayroll?: boolean;
  currentEmployeeId?: string;
  selfServiceOnly?: boolean;
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
  canAdjustPayroll = false,
  currentEmployeeId,
  selfServiceOnly = false
}) => {
  type StaffEventInfo = {
    event: Event;
    staff: EventStaffAllocation;
    date: string;
    isUpcoming: boolean;
  };
  type PayrollEntry = {
    employeeId: string;
    venue: EventVenueType;
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
  type PayrollVenueFilter = 'ALL' | EventVenueType;

  const payrollVenueLabels: Record<PayrollVenueFilter, string> = {
    ALL: 'Tổng hợp',
    EH: 'EH',
    EBUS: 'EBUS'
  };
  const payrollVenueLongLabels: Record<PayrollVenueFilter, string> = {
    ALL: 'Tổng hợp EH + EBUS',
    EH: 'Tại EH',
    EBUS: 'EBUS'
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showEmployeePdfModal, setShowEmployeePdfModal] = useState(false);
  const [employeePdfScope, setEmployeePdfScope] = useState<EmployeePdfScope>('ALL');
  const [isExportingEmployeePdf, setIsExportingEmployeePdf] = useState(false);
  const [selectedEmployeePdfFields, setSelectedEmployeePdfFields] = useState<Record<EmployeePdfFieldKey, boolean>>(
    () => EMPLOYEE_PDF_FIELDS.reduce((acc, field) => ({ ...acc, [field.key]: true }), {} as Record<EmployeePdfFieldKey, boolean>)
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payrollMonth, setPayrollMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [payrollVenue, setPayrollVenue] = useState<PayrollVenueFilter>('ALL');
  const [expandedPayrollRows, setExpandedPayrollRows] = useState<Record<string, boolean>>({});
  const [bonusDrafts, setBonusDrafts] = useState<Record<string, { amount: string; note: string; penaltyAmount: string; penaltyNote: string }>>({});

  const [formData, setFormData] = useState({
    name: '',
    role: '',
    phone: '',
    email: '',
    baseRate: '',
    inactive: false
  });

  const visibleEmployees = useMemo(
    () => selfServiceOnly
      ? employees.filter(e => e.id === currentEmployeeId)
      : employees,
    [employees, currentEmployeeId, selfServiceOnly]
  );

  const filteredEmployees = visibleEmployees.filter(e =>
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
      baseRate: emp.baseRate ? emp.baseRate.toString() : '',
      inactive: !!emp.inactive
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
      baseRate: '',
      inactive: false
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
  const getEventVenue = (event: Event): EventVenueType => event.organizationVenue || 'EH';
  const allocatePenaltyBySmallerSource = (ehAmount: number, ebusAmount: number, penaltyAmount: number) => {
    let remaining = Math.max(0, Number(penaltyAmount) || 0);
    const penalties: Record<EventVenueType, number> = { EH: 0, EBUS: 0 };
    const sources = [
      { venue: 'EH' as EventVenueType, amount: Math.max(0, Number(ehAmount) || 0) },
      { venue: 'EBUS' as EventVenueType, amount: Math.max(0, Number(ebusAmount) || 0) }
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

  const escapeHtml = (value: unknown) =>
    String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char] || char));

  const formatCurrency = (value?: number) => `${(value || 0).toLocaleString('vi-VN')}đ`;

  const getEmployeePdfScopeItems = () => {
    if (employeePdfScope === 'FILTERED') return filteredEmployees;
    if (employeePdfScope === 'ACTIVE') return visibleEmployees.filter(emp => !emp.inactive);
    if (employeePdfScope === 'INACTIVE') return visibleEmployees.filter(emp => emp.inactive);
    return visibleEmployees;
  };

  const getScheduleSummary = (info?: StaffEventInfo) => {
    if (!info) return '-';
    const sessions = getStaffSessions(info.staff);
    const sessionText = sessions.length ? sessions.map(sess => sessionLabel[sess] || sess).join(', ') : '';
    return [
      formatDate(info.date),
      info.event.name,
      sessionText ? `Ca: ${sessionText}` : '',
      info.staff.task || ''
    ].filter(Boolean).join(' - ');
  };

  const getEmployeePdfValue = (emp: Employee, fieldKey: EmployeePdfFieldKey) => {
    const stats = employeeEventStats[emp.id] || { participationCount: 0, upcoming: [], history: [] };
    const lastHistory = stats.history[stats.history.length - 1];

    switch (fieldKey) {
      case 'id':
        return emp.id;
      case 'name':
        return emp.name;
      case 'role':
        return emp.role || 'Chưa có vị trí';
      case 'phone':
        return emp.phone || '-';
      case 'email':
        return emp.email || '-';
      case 'baseRate':
        return emp.baseRate ? formatCurrency(emp.baseRate) : '-';
      case 'status':
        return emp.inactive ? 'Đã nghỉ' : 'Đang làm';
      case 'participationCount':
        return stats.participationCount;
      case 'upcomingSchedule':
        return getScheduleSummary(stats.upcoming[0]);
      case 'lastSchedule':
        return getScheduleSummary(lastHistory);
      default:
        return '-';
    }
  };

  const handleExportEmployeePdf = async () => {
    const enabledFields = EMPLOYEE_PDF_FIELDS.filter(field => selectedEmployeePdfFields[field.key]);
    if (enabledFields.length === 0) {
      alert('Vui lòng chọn ít nhất một thông tin để xuất PDF.');
      return;
    }

    const items = getEmployeePdfScopeItems();
    if (items.length === 0) {
      alert('Không có nhân sự phù hợp để xuất PDF.');
      return;
    }

    const scopeLabel = employeePdfScope === 'FILTERED'
      ? 'Theo tìm kiếm hiện tại'
      : employeePdfScope === 'ACTIVE'
        ? 'Đang làm'
        : employeePdfScope === 'INACTIVE'
          ? 'Đã nghỉ'
          : 'Toàn bộ nhân sự';
    const today = new Date();
    const printedAt = today.toLocaleString('vi-VN');
    const filenameDate = today.toISOString().slice(0, 10);
    const rowsPerPage = enabledFields.length <= 5 ? 18 : enabledFields.length <= 8 ? 14 : 10;
    const rowPages = Array.from({ length: Math.ceil(items.length / rowsPerPage) }, (_, index) =>
      items.slice(index * rowsPerPage, (index + 1) * rowsPerPage)
    );
    const headersHtml = [
      '<th class="index-col">STT</th>',
      ...enabledFields.map(field => `<th>${escapeHtml(field.label)}</th>`)
    ].join('');
    const reportCss = `
      .employee-pdf-page { box-sizing: border-box; width: 1123px; min-height: 794px; color: #0f172a; font-family: Arial, sans-serif; padding: 28px; background: #ffffff; }
      .report-head { border-bottom: 2px solid #e2e8f0; margin-bottom: 16px; padding-bottom: 12px; }
      .eyebrow { color: #64748b; font-size: 10px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; }
      h1 { font-size: 24px; line-height: 1.2; margin: 5px 0; text-transform: uppercase; }
      .meta { color: #475569; font-size: 12px; line-height: 1.55; }
      .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 12px 0 16px; }
      .summary div { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; background: #f8fafc; }
      .summary span { display: block; color: #64748b; font-size: 9px; font-weight: 800; letter-spacing: .8px; text-transform: uppercase; }
      .summary b { display: block; font-size: 18px; margin-top: 2px; }
      .page-mini-head { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; margin-bottom: 12px; padding-bottom: 8px; color: #64748b; font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td { border: 1px solid #e2e8f0; padding: 7px; font-size: 10px; line-height: 1.35; vertical-align: top; overflow-wrap: anywhere; }
      th { background: #f1f5f9; color: #334155; font-weight: 800; text-align: left; text-transform: uppercase; }
      tbody tr:nth-child(even) td { background: #f8fafc; }
      .index-col { width: 34px; text-align: center; }
      .status-active { color: #047857; font-weight: 800; }
      .status-inactive { color: #64748b; font-weight: 800; }
    `;
    const buildRowsHtml = (pageRows: Employee[], pageIndex: number) => pageRows.map((emp, rowIndex) => {
      const absoluteIndex = pageIndex * rowsPerPage + rowIndex + 1;
      const cells = enabledFields.map(field => {
        const value = getEmployeePdfValue(emp, field.key);
        const statusClass = field.key === 'status' ? (emp.inactive ? ' class="status-inactive"' : ' class="status-active"') : '';
        return `<td${statusClass}>${escapeHtml(value)}</td>`;
      }).join('');
      return `<tr><td class="index-col">${absoluteIndex}</td>${cells}</tr>`;
    }).join('');
    const summaryHtml = `
      <div class="summary">
        <div><span>Tổng nhân sự</span><b>${items.length}</b></div>
        <div><span>Đang làm</span><b>${items.filter(emp => !emp.inactive).length}</b></div>
        <div><span>Đã nghỉ</span><b>${items.filter(emp => emp.inactive).length}</b></div>
        <div><span>Cột xuất</span><b>${enabledFields.length}</b></div>
      </div>
    `;
    const buildPageHtml = (pageRows: Employee[], pageIndex: number) => `
      <div class="employee-pdf-page">
        <style>${reportCss}</style>
        ${pageIndex === 0
          ? `<header class="report-head">
              <div class="eyebrow">Module nhân sự</div>
              <h1>Danh sách nhân sự</h1>
              <div class="meta">Phạm vi: ${escapeHtml(scopeLabel)} | Số nhân sự: ${items.length} | Thời gian xuất: ${escapeHtml(printedAt)}</div>
            </header>
            ${summaryHtml}`
          : `<div class="page-mini-head"><span>Danh sách nhân sự</span><span>Trang ${pageIndex + 1}</span></div>`
        }
        <table>
          <thead><tr>${headersHtml}</tr></thead>
          <tbody>${buildRowsHtml(pageRows, pageIndex)}</tbody>
        </table>
      </div>
    `;

    const root = document.createElement('div');
    root.style.position = 'absolute';
    root.style.left = '0';
    root.style.top = `${window.scrollY}px`;
    root.style.width = '1123px';
    root.style.background = '#ffffff';
    root.style.pointerEvents = 'none';
    root.style.zIndex = '-1';
    document.body.appendChild(root);

    try {
      setIsExportingEmployeePdf(true);
      const { html2canvas, jsPDF } = await loadEmployeePdfRenderLibs();
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });

      for (let index = 0; index < rowPages.length; index += 1) {
        root.innerHTML = buildPageHtml(rowPages[index], index);
        await new Promise(resolve => window.requestAnimationFrame(() => resolve(null)));
        const pageNode = root.firstElementChild as HTMLElement;
        const canvas = await html2canvas(pageNode, {
          scale: 1.5,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          logging: false,
          width: 1123,
          height: Math.max(794, pageNode.scrollHeight),
          windowWidth: 1123,
          windowHeight: Math.max(794, pageNode.scrollHeight)
        });
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        if (index > 0) pdf.addPage();
        pdf.addImage(imageData, 'JPEG', 0, 0, 297, 210);
        canvas.width = 0;
        canvas.height = 0;
      }

      pdf.save(`Danh_sach_nhan_su_${filenameDate}.pdf`);
      setShowEmployeePdfModal(false);
    } catch (err) {
      console.error('Export employee PDF error', err);
      alert('Không thể xuất PDF danh sách nhân sự. Vui lòng thử lại.');
    } finally {
      root.remove();
      setIsExportingEmployeePdf(false);
    }
  };
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
    const nextDrafts: Record<string, { amount: string; note: string; penaltyAmount: string; penaltyNote: string }> = {};
    visibleEmployees.forEach(emp => {
      const adj = payrollAdjustmentMap.get(`${emp.id}-${payrollMonth}`);
      nextDrafts[emp.id] = {
        amount: adj?.bonusAmount ? String(adj.bonusAmount) : '',
        note: adj?.note || '',
        penaltyAmount: adj?.penaltyAmount ? String(adj.penaltyAmount) : '',
        penaltyNote: adj?.penaltyNote || ''
      };
    });
    setBonusDrafts(nextDrafts);
  }, [visibleEmployees, payrollAdjustmentMap, payrollMonth]);

  const payrollEntries = useMemo<PayrollEntry[]>(() => {
    return events.flatMap(event => {
      return (event.staff || []).map(staff => {
        const date = staff.shiftDate || event.startDate || event.endDate || '';
        if (!date) return null;
        const monthKey = date.slice(0, 7);
        const salaryAmount = Number.isFinite(staff.salary) ? Number(staff.salary) : (staff.unit === 'FIXED' ? staff.rate : (staff.rate || 0) * (staff.quantity || 0));
        return {
          employeeId: staff.employeeId,
          venue: getEventVenue(event),
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

    return visibleEmployees.filter(emp => selfServiceOnly || !emp.inactive).map(emp => {
      const allEntries = [...(grouped.get(emp.id) || [])].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      const ehEntries = allEntries.filter(entry => entry.venue === 'EH');
      const ebusEntries = allEntries.filter(entry => entry.venue === 'EBUS');
      const entries = payrollVenue === 'ALL' ? allEntries : allEntries.filter(entry => entry.venue === payrollVenue);
      const ehBaseTotal = ehEntries.reduce((sum, entry) => sum + (Number.isFinite(entry.salary) ? entry.salary : 0), 0);
      const ebusBaseTotal = ebusEntries.reduce((sum, entry) => sum + (Number.isFinite(entry.salary) ? entry.salary : 0), 0);
      const adj = payrollAdjustmentMap.get(`${emp.id}-${payrollMonth}`);
      const bonusAmount = Number(adj?.bonusAmount) || 0;
      const penaltyAmount = Number(adj?.penaltyAmount) || 0;
      const bonusNote = adj?.note || '';
      const penaltyNote = adj?.penaltyNote || '';
      const penaltyAllocation = allocatePenaltyBySmallerSource(ehBaseTotal, ebusBaseTotal, penaltyAmount);
      const ehTotal = Math.max(0, ehBaseTotal - penaltyAllocation.ehPenalty);
      const ebusTotal = Math.max(0, ebusBaseTotal - penaltyAllocation.ebusPenalty);
      const baseTotal = payrollVenue === 'ALL'
        ? ehTotal + ebusTotal
        : (payrollVenue === 'EH' ? ehTotal : ebusTotal);
      return {
        employee: emp,
        entries,
        ehBaseTotal,
        ebusBaseTotal,
        ehTotal,
        ebusTotal,
        baseTotal,
        bonusAmount,
        penaltyAmount,
        bonusNote,
        penaltyNote,
        ehPenalty: penaltyAllocation.ehPenalty,
        ebusPenalty: penaltyAllocation.ebusPenalty,
        unappliedPenalty: penaltyAllocation.unappliedPenalty,
        total: baseTotal + (payrollVenue === 'ALL' ? bonusAmount : 0)
      };
    }).sort((a, b) => b.total - a.total);
  }, [visibleEmployees, payrollEntries, payrollMonth, payrollAdjustmentMap, selfServiceOnly, payrollVenue]);

  const payrollSummary = useMemo(() => {
    return payrollRows.reduce((acc, row) => ({
      eh: acc.eh + row.ehTotal,
      ebus: acc.ebus + row.ebusTotal,
      bonus: acc.bonus + row.bonusAmount,
      penalty: acc.penalty + row.penaltyAmount,
      total: acc.total + row.total
    }), { eh: 0, ebus: 0, bonus: 0, penalty: 0, total: 0 });
  }, [payrollRows]);

  const togglePayrollRow = (id: string) => {
    setExpandedPayrollRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleBonusDraftChange = (empId: string, field: 'amount' | 'note' | 'penaltyAmount' | 'penaltyNote', value: string) => {
    setBonusDrafts(prev => ({
      ...prev,
      [empId]: { ...(prev[empId] || { amount: '', note: '', penaltyAmount: '', penaltyNote: '' }), [field]: value }
    }));
  };

  const handleSaveBonus = (empId: string) => {
    if (!onUpsertPayrollAdjustment) return;
    const draft = bonusDrafts[empId] || { amount: '', note: '', penaltyAmount: '', penaltyNote: '' };
    onUpsertPayrollAdjustment({
      employeeId: empId,
      month: payrollMonth,
      bonusAmount: Number(draft.amount) || 0,
      penaltyAmount: Number(draft.penaltyAmount) || 0,
      note: draft.note,
      penaltyNote: draft.penaltyNote
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
            const venueText = payrollVenue === 'ALL' ? ` • ${payrollVenueLabels[entry.venue]}` : '';
            return `<li style="margin-bottom:4px; line-height:1.4;"><strong>${entry.eventName}</strong>${venueText} • ${formatDate(entry.date)} • ${entry.salary.toLocaleString()} đ${entry.task ? ` • ${entry.task}` : ''}${sessionText ? ` • Ca: ${sessionText}` : ''}</li>`;
          }).join('')
        : '<em>Chưa có nguồn lương trong tháng.</em>';
      const moneyCells = payrollVenue === 'ALL'
        ? `
          <td style="text-align:right;">${row.ehTotal.toLocaleString()} đ${row.ehPenalty > 0 ? `<div class="note">Đã trừ phạt ${row.ehPenalty.toLocaleString()} đ</div>` : ''}</td>
          <td style="text-align:right;">${row.ebusTotal.toLocaleString()} đ${row.ebusPenalty > 0 ? `<div class="note">Đã trừ phạt ${row.ebusPenalty.toLocaleString()} đ</div>` : ''}</td>
          <td style="text-align:right;">${row.baseTotal.toLocaleString()} đ</td>
          <td style="text-align:right;">${row.bonusAmount.toLocaleString()} đ${row.bonusNote ? `<div class="note">${row.bonusNote}</div>` : ''}</td>
          <td style="text-align:right;">${row.penaltyAmount.toLocaleString()} đ${row.penaltyNote ? `<div class="note">${row.penaltyNote}</div>` : ''}${row.unappliedPenalty > 0 ? `<div class="note">Chưa trừ hết ${row.unappliedPenalty.toLocaleString()} đ do lương không đủ</div>` : ''}</td>
          <td style="text-align:right;" class="total">${row.total.toLocaleString()} đ</td>
        `
        : `
          <td style="text-align:right;">${row.baseTotal.toLocaleString()} đ</td>
        `;
      return `
        <tr>
          <td>
            <div><strong>${row.employee.name}</strong></div>
            <div style="font-size:12px; color:#475569;">${row.employee.role || 'Chưa có vị trí'} • ${row.employee.phone}</div>
          </td>
          ${moneyCells}
        </tr>
        <tr>
          <td colspan="${payrollVenue === 'ALL' ? 7 : 2}">${row.entries.length ? `<ul style="margin:6px 0 0 14px; padding:0;">${detailHtml}</ul>` : detailHtml}</td>
        </tr>
      `;
    }).join('');
    const title = `${selfServiceOnly ? 'Bảng lương cá nhân' : 'Bảng lương'} ${payrollVenueLongLabels[payrollVenue]} tháng ${payrollMonth}`;
    const headerHtml = payrollVenue === 'ALL'
      ? `
        <th>Nhân sự</th>
        <th>Lương EH</th>
        <th>Lương EBUS</th>
        <th>Tổng lương</th>
        <th>Thưởng</th>
        <th>Phạt</th>
        <th>Tổng cộng</th>
      `
      : `
        <th>Nhân sự</th>
        <th>Lương ${payrollVenueLabels[payrollVenue]}</th>
      `;

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
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
          <h2>${title}</h2>
          <table>
            <thead>
              <tr>${headerHtml}</tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="${payrollVenue === 'ALL' ? 7 : 2}">Chưa có dữ liệu lương cho tháng này.</td></tr>`}
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
      avatarUrl: employees.find(emp => emp.id === editingId)?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name)}&background=random`,
      inactive: formData.inactive
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
        <h2 className="text-xl font-semibold text-gray-800">{selfServiceOnly ? 'Bảng Lương Của Tôi' : 'Danh Mục Nhân Sự'}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {!selfServiceOnly && (
            <button
              onClick={() => setShowEmployeePdfModal(true)}
              className="bg-slate-900 text-white px-3 py-2 rounded-md hover:bg-slate-950 transition flex items-center gap-2 text-sm font-medium shadow-sm"
            >
              <FileText size={14} /> Xuất PDF
            </button>
          )}
          {canEdit && (
            <button
              onClick={handleOpenAdd}
              className="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 transition flex items-center gap-2 text-sm font-medium shadow-sm"
            >
              <Plus size={14} /> Thêm Nhân Viên
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Bảng lương</p>
            <h3 className="text-lg font-bold text-gray-800">{selfServiceOnly ? 'Lương cá nhân theo tháng' : 'Tổng hợp lương theo tháng'}</h3>
            <p className="text-sm text-gray-500">
              {selfServiceOnly ? 'Xem nguồn tính lương tại EH, EBUS, thưởng, phạt và tổng cộng của chính bạn theo từng tháng.' : 'Xem nguồn tính lương từng nhân sự theo EH/EBUS, thêm thưởng/phạt kèm lý do và in ra PDF riêng.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="month"
              value={payrollMonth}
              onChange={(e) => setPayrollMonth(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              {(['ALL', 'EH', 'EBUS'] as PayrollVenueFilter[]).map(venue => (
                <button
                  key={venue}
                  onClick={() => setPayrollVenue(venue)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${payrollVenue === venue ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {payrollVenueLabels[venue]}
                </button>
              ))}
            </div>
            <button
              onClick={handlePrintPayroll}
              className="inline-flex items-center gap-2 bg-slate-900 text-white px-3 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-slate-950"
            >
              <Printer size={16} /> In {payrollVenueLabels[payrollVenue]}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
            <p className="text-[11px] font-bold uppercase text-blue-500">Lương EH</p>
            <p className="text-base font-black text-slate-800">{payrollSummary.eh.toLocaleString()} đ</p>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
            <p className="text-[11px] font-bold uppercase text-emerald-500">Lương EBUS</p>
            <p className="text-base font-black text-slate-800">{payrollSummary.ebus.toLocaleString()} đ</p>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
            <p className="text-[11px] font-bold uppercase text-amber-500">Thưởng chung</p>
            <p className="text-base font-black text-slate-800">{payrollSummary.bonus.toLocaleString()} đ</p>
          </div>
          <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2">
            <p className="text-[11px] font-bold uppercase text-rose-500">Phạt chung</p>
            <p className="text-base font-black text-slate-800">{payrollSummary.penalty.toLocaleString()} đ</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-bold uppercase text-slate-500">{payrollVenue === 'ALL' ? 'Tổng cộng' : `Tổng ${payrollVenueLabels[payrollVenue]}`}</p>
            <p className="text-base font-black text-blue-700">{payrollSummary.total.toLocaleString()} đ</p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm border border-slate-100 rounded-lg overflow-hidden">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3">Nhân sự</th>
                {payrollVenue === 'ALL' ? (
                  <>
                    <th className="text-right px-4 py-3">Lương EH</th>
                    <th className="text-right px-4 py-3">Lương EBUS</th>
                    <th className="text-right px-4 py-3">Tổng lương</th>
                    <th className="text-left px-4 py-3">Thưởng / Phạt</th>
                    <th className="text-right px-4 py-3">Tổng cộng</th>
                  </>
                ) : (
                  <th className="text-right px-4 py-3">Lương {payrollVenueLabels[payrollVenue]}</th>
                )}
                <th className="text-center px-4 py-3">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payrollRows.map(row => {
                const draft = bonusDrafts[row.employee.id] || { amount: '', note: '', penaltyAmount: '', penaltyNote: '' };
                return (
                  <React.Fragment key={row.employee.id}>
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{row.employee.name}</p>
                        <p className="text-xs text-slate-500">{row.employee.role || 'Chưa có vị trí'} • {row.employee.phone}</p>
                      </td>
                      {payrollVenue === 'ALL' ? (
                        <>
                          <td className="px-4 py-3 text-right">
                            <p className="font-semibold text-blue-700">{row.ehTotal.toLocaleString()} đ</p>
                            {row.ehPenalty > 0 && <p className="text-[11px] font-semibold text-rose-600">Đã trừ phạt {row.ehPenalty.toLocaleString()} đ</p>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <p className="font-semibold text-emerald-700">{row.ebusTotal.toLocaleString()} đ</p>
                            {row.ebusPenalty > 0 && <p className="text-[11px] font-semibold text-rose-600">Đã trừ phạt {row.ebusPenalty.toLocaleString()} đ</p>}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-800">{row.baseTotal.toLocaleString()} đ</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-2">
                              {canAdjustPayroll ? (
                                <div className="space-y-2">
                                  <div className="grid grid-cols-1 xl:grid-cols-[7rem_1fr] gap-2">
                                    <input
                                      type="number"
                                      min={0}
                                      value={draft.amount}
                                      onChange={(e) => handleBonusDraftChange(row.employee.id, 'amount', e.target.value)}
                                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                      placeholder="Thưởng"
                                    />
                                    <input
                                      type="text"
                                      value={draft.note}
                                      onChange={(e) => handleBonusDraftChange(row.employee.id, 'note', e.target.value)}
                                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                      placeholder="Lý do thưởng"
                                    />
                                  </div>
                                  <div className="grid grid-cols-1 xl:grid-cols-[7rem_1fr_auto] gap-2">
                                    <input
                                      type="number"
                                      min={0}
                                      value={draft.penaltyAmount}
                                      onChange={(e) => handleBonusDraftChange(row.employee.id, 'penaltyAmount', e.target.value)}
                                      className="w-full border border-rose-200 rounded-lg px-3 py-2 text-sm"
                                      placeholder="Phạt"
                                    />
                                    <input
                                      type="text"
                                      value={draft.penaltyNote}
                                      onChange={(e) => handleBonusDraftChange(row.employee.id, 'penaltyNote', e.target.value)}
                                      className="w-full border border-rose-200 rounded-lg px-3 py-2 text-sm"
                                      placeholder="Lý do phạt"
                                    />
                                  <button
                                    onClick={() => handleSaveBonus(row.employee.id)}
                                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
                                  >
                                    Lưu
                                  </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                                  <p className="text-sm font-semibold text-emerald-700">Thưởng: {row.bonusAmount.toLocaleString()} đ</p>
                                  <p className="text-xs text-slate-500">{row.bonusNote || 'Không có ghi chú thưởng'}</p>
                                  <p className="mt-1 text-sm font-semibold text-rose-700">Phạt: {row.penaltyAmount.toLocaleString()} đ</p>
                                  <p className="text-xs text-slate-500">{row.penaltyNote || 'Không có ghi chú phạt'}</p>
                                </div>
                              )}
                              {canAdjustPayroll && (row.bonusAmount > 0 || row.bonusNote || row.penaltyAmount > 0 || row.penaltyNote) && (
                                <p className="text-[11px] text-slate-500">
                                  Đã lưu: thưởng {row.bonusAmount.toLocaleString()} đ, phạt {row.penaltyAmount.toLocaleString()} đ{row.bonusNote ? ` • Thưởng: ${row.bonusNote}` : ''}{row.penaltyNote ? ` • Phạt: ${row.penaltyNote}` : ''}
                                  {row.unappliedPenalty > 0 ? ` • Chưa trừ hết ${row.unappliedPenalty.toLocaleString()} đ do lương không đủ` : ''}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-blue-700">{row.total.toLocaleString()} đ</td>
                        </>
                      ) : (
                        <td className="px-4 py-3 text-right font-bold text-blue-700">{row.baseTotal.toLocaleString()} đ</td>
                      )}
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
                        <td colSpan={payrollVenue === 'ALL' ? 7 : 3} className="px-4 py-3">
                          {row.entries.length === 0 ? (
                            <p className="text-xs text-slate-500">Chưa có nguồn lương trong tháng này.</p>
                          ) : (
                            <div className="grid md:grid-cols-2 gap-3">
                              {row.entries.map((entry, idx) => (
                                <div key={`${entry.eventName}-${entry.date}-${idx}`} className="border border-slate-200 rounded-lg bg-white p-3 shadow-sm">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="font-semibold text-slate-800">{entry.eventName}</p>
                                    <span className="text-[11px] text-slate-500">{payrollVenue === 'ALL' ? `${payrollVenueLabels[entry.venue]} • ` : ''}{formatDate(entry.date)}</span>
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

      {!selfServiceOnly && (
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
      )}

      {/* List */}
      {!selfServiceOnly && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
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
                <div className="flex items-center gap-2 pr-14">
                  <h3 className="font-semibold text-gray-800 text-base leading-tight">{emp.name}</h3>
                  {emp.inactive && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold uppercase whitespace-nowrap">Đã nghỉ</span>
                  )}
                </div>
                <p className="text-blue-600 font-medium text-xs mb-1">{emp.role || 'Chưa có vị trí'}</p>
                
                <div className="space-y-0.5 text-xs text-gray-600">
                   <p className="flex items-center gap-2"><Phone size={12} /> {emp.phone}</p>
                   {emp.email && <p className="flex items-center gap-2"><Mail size={12} /> {emp.email}</p>}
                   {emp.baseRate && (
                     <p className="flex items-center gap-2 text-green-600 font-medium">
                    <DollarSign size={12} /> {emp.baseRate.toLocaleString()} đ/ngày
                  </p>
                 )}
                 {canEdit && (
                   <button
                     onClick={() => onUpdateEmployee({ ...emp, inactive: !emp.inactive })}
                     className={`mt-2 px-2 py-1 rounded-md text-[11px] font-semibold border transition ${emp.inactive ? 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100' : 'border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100'}`}
                   >
                     {emp.inactive ? 'Cho làm lại' : 'Đã nghỉ'}
                   </button>
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
      </div>}

      {!selfServiceOnly && filteredEmployees.length === 0 && (
         <div className="text-center py-20 text-gray-500">
           Không tìm thấy nhân viên nào.
         </div>
      )}

      {/* Modal Xuất PDF danh sách nhân sự */}
      {showEmployeePdfModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[115] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b bg-slate-50 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Xuất PDF nhân sự</p>
                <h3 className="text-2xl font-black text-slate-800">Chọn thông tin nhân sự cần xuất</h3>
                <p className="text-sm text-slate-500">Chỉ những mục được tick mới xuất ra file PDF dạng bảng.</p>
              </div>
              <button
                onClick={() => setShowEmployeePdfModal(false)}
                className="p-2 rounded-xl hover:bg-slate-200"
                disabled={isExportingEmployeePdf}
              >
                <X size={22}/>
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Phạm vi xuất</label>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  {[
                    { key: 'ALL' as EmployeePdfScope, label: 'Toàn bộ', count: visibleEmployees.length },
                    { key: 'FILTERED' as EmployeePdfScope, label: 'Theo tìm kiếm', count: filteredEmployees.length },
                    { key: 'ACTIVE' as EmployeePdfScope, label: 'Đang làm', count: visibleEmployees.filter(emp => !emp.inactive).length },
                    { key: 'INACTIVE' as EmployeePdfScope, label: 'Đã nghỉ', count: visibleEmployees.filter(emp => emp.inactive).length }
                  ].map(option => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setEmployeePdfScope(option.key)}
                      className={`rounded-xl border-2 px-4 py-3 text-left transition ${
                        employeePdfScope === option.key
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-100 bg-white text-slate-600 hover:border-slate-200'
                      }`}
                    >
                      <span className="block text-xs font-black uppercase tracking-widest">{option.label}</span>
                      <span className="text-[11px] font-semibold text-slate-400">{option.count} nhân sự</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Thông tin cần xuất</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedEmployeePdfFields(EMPLOYEE_PDF_FIELDS.reduce((acc, field) => ({ ...acc, [field.key]: true }), {} as Record<EmployeePdfFieldKey, boolean>))}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-200"
                    >
                      Chọn tất cả
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedEmployeePdfFields(EMPLOYEE_PDF_FIELDS.reduce((acc, field) => ({ ...acc, [field.key]: false }), {} as Record<EmployeePdfFieldKey, boolean>))}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {EMPLOYEE_PDF_FIELDS.map(field => (
                    <label
                      key={field.key}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition ${
                        selectedEmployeePdfFields[field.key]
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-blue-600"
                        checked={selectedEmployeePdfFields[field.key]}
                        onChange={e => setSelectedEmployeePdfFields(prev => ({ ...prev, [field.key]: e.target.checked }))}
                      />
                      <span className="text-xs font-black uppercase tracking-widest leading-tight">{field.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <p className="text-xs text-slate-500">
                PDF dùng khổ A4 ngang để danh sách nhân sự hiển thị theo dạng bảng.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowEmployeePdfModal(false)}
                  className="px-5 py-3 text-slate-500 font-black uppercase tracking-widest text-xs hover:bg-slate-200 rounded-xl"
                  disabled={isExportingEmployeePdf}
                >
                  Hủy
                </button>
                <button
                  onClick={() => void handleExportEmployeePdf()}
                  disabled={isExportingEmployeePdf}
                  className="px-7 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:bg-slate-300 disabled:shadow-none"
                >
                  {isExportingEmployeePdf ? 'Đang xuất...' : 'Xuất PDF'}
                </button>
              </div>
            </div>
          </div>
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

              <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.inactive}
                  onChange={(e) => setFormData({...formData, inactive: e.target.checked})}
                  className="h-4 w-4"
                />
                <span className="font-medium">Đã nghỉ - ẩn khỏi phân công tương lai và bảng lương</span>
              </label>
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
