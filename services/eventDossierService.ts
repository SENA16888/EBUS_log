import {
  Employee,
  Event,
  EventExpense,
  EventLayout,
  HouseOperationInstance,
  InventoryItem,
  Quotation,
  SaleOrder
} from '../types';
import { calcLineTotal } from './pricing';

export type EventDossierSection =
  | 'PLAN'
  | 'STAFF'
  | 'EXPENSES'
  | 'ADVANCES'
  | 'TIMELINE'
  | 'AGENDA'
  | 'DESIGN'
  | 'EQUIPMENT';

export interface EventDossierExportOptions {
  sections: EventDossierSection[];
  employees?: Employee[];
  quotation?: Quotation | null;
  saleOrders?: SaleOrder[];
  preparedBy?: string;
  approvedBy?: string;
  filename?: string;
  quality?: 'medium' | 'high';
}

type DossierProgram = {
  id: string;
  name: string;
  description?: string;
  date?: string;
  sessions?: Array<'MORNING' | 'AFTERNOON' | 'EVENING'>;
  layout?: EventLayout;
  operation?: HouseOperationInstance;
};

const SESSION_LABELS = {
  MORNING: 'SÁNG',
  AFTERNOON: 'CHIỀU',
  EVENING: 'TỐI'
} as const;

const AUDIENCE_LABELS = {
  MN: 'Mầm non',
  TIEU_HOC: 'Tiểu học',
  THCS: 'THCS',
  THPT: 'THPT',
  PH: 'Phụ huynh'
} as const;

const EVENT_TYPE_LABELS = {
  CAMBRIDGE_DAY: 'Cambridge Day',
  SCIENCE_DAY: 'Ngày hội khoa học',
  BOOK_FAIR: 'Hội sách',
  LIBRARY: 'Thư viện',
  COMMUNITY: 'Cộng đồng'
} as const;

const EXPENSE_CATEGORY_LABELS: Record<EventExpense['category'], string> = {
  TRANSPORT_GOODS: 'Vận chuyển hàng hóa',
  TRANSPORT_STAFF: 'Di chuyển nhân sự',
  ACCOMMODATION: 'Lưu trú',
  PRINTING: 'In ấn',
  CONSUMABLES: 'Vật tư tiêu hao',
  CATERING: 'Ăn uống',
  MISC: 'Chi phí khác'
};

const TIMELINE_PHASE_LABELS = {
  BEFORE: 'Trước sự kiện',
  DURING: 'Trong sự kiện',
  AFTER: 'Sau sự kiện'
} as const;

const UNIT_LABELS = {
  HOUR: 'Giờ',
  DAY: 'Ngày',
  FIXED: 'Trọn gói'
} as const;

const htmlEscape = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const multiline = (value?: string, fallback = 'Chưa cập nhật') =>
  htmlEscape(value || fallback).replace(/\r?\n/g, '<br/>');

const formatMoney = (value?: number) => `${Math.round(Number(value) || 0).toLocaleString('vi-VN')} đ`;

const parseLocalDate = (value?: string) => {
  if (!value) return null;
  const dateOnly = value.slice(0, 10);
  const match = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value?: string, includeWeekday = false) => {
  const date = parseLocalDate(value);
  if (!date) return value || 'Chưa cập nhật';
  return date.toLocaleDateString('vi-VN', {
    ...(includeWeekday ? { weekday: 'long' as const } : {}),
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const formatDateTime = (value?: string) => {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const getPrograms = (event: Event): DossierProgram[] => {
  const schedule = [...(event.schedule || [])].sort((a, b) => a.date.localeCompare(b.date));
  const primary: DossierProgram = {
    id: 'primary-content-program',
    name: event.primaryContentProgram?.name || 'Chương trình chính',
    description: event.primaryContentProgram?.description,
    date: event.primaryContentProgram?.date || schedule[0]?.date || event.startDate,
    sessions: event.primaryContentProgram?.sessions || schedule[0]?.sessions || (event.session ? [event.session] : undefined),
    layout: event.layout,
    operation: event.houseOperation
  };
  return [
    primary,
    ...(event.contentPrograms || []).map(program => ({
      id: program.id,
      name: program.name,
      description: program.description,
      date: program.date,
      sessions: program.sessions,
      layout: program.layout,
      operation: program.houseOperation
    }))
  ];
};

export const getEventDossierSectionCounts = (event: Event) => {
  const programs = getPrograms(event);
  return {
    PLAN: 1,
    STAFF: event.staff?.length || 0,
    EXPENSES: (event.expenses?.length || 0) + (event.staff?.length ? 1 : 0),
    ADVANCES: (event.advanceRequests?.length || 0) + (
      event.advancePaidAmount || event.advanceSkipped || event.advancePaidConfirmed || event.advanceRefundedConfirmed || event.paymentCompleted ? 1 : 0
    ),
    TIMELINE: event.timeline?.length || 0,
    AGENDA: programs.reduce((sum, program) => sum + (program.operation?.agenda?.length || 0), 0),
    DESIGN: programs.reduce(
      (sum, program) => sum
        + (program.operation?.stations?.length || 0)
        + (program.operation?.rotations?.length || 0)
        + (program.layout?.blocks?.length || 0)
        + (program.layout?.floorplanImage ? 1 : 0),
      0
    ),
    EQUIPMENT: event.items?.length || 0
  } satisfies Record<EventDossierSection, number>;
};

const getEventDateLabel = (event: Event) => {
  const schedule = [...(event.schedule || [])].sort((a, b) => a.date.localeCompare(b.date));
  if (schedule.length === 1) return formatDate(schedule[0].date, true);
  if (schedule.length > 1) {
    return `${formatDate(schedule[0].date, true)} - ${formatDate(schedule[schedule.length - 1].date, true)}`;
  }
  if (event.startDate && event.endDate && event.startDate.slice(0, 10) !== event.endDate.slice(0, 10)) {
    return `${formatDate(event.startDate, true)} - ${formatDate(event.endDate, true)}`;
  }
  return formatDate(event.startDate, true);
};

const getProgramTimeLabel = (event: Event) => {
  const profile = event.eventProfile;
  const range = profile?.programTimeStart && profile?.programTimeEnd
    ? `${profile.programTimeStart} - ${profile.programTimeEnd}`
    : '';
  const session = profile?.programSession || event.session;
  return [range, session ? SESSION_LABELS[session] : ''].filter(Boolean).join(' • ');
};

const getAudienceLabel = (event: Event) =>
  (event.eventProfile?.audience || []).map(item => AUDIENCE_LABELS[item]).join(', ');

const getScaleLabel = (event: Event) => {
  const { attendanceMin, attendanceMax } = event.eventProfile || {};
  if (attendanceMin === undefined && attendanceMax === undefined) return 'Chưa cập nhật';
  if (attendanceMin !== undefined && attendanceMax !== undefined && attendanceMin !== attendanceMax) {
    return `${attendanceMin.toLocaleString('vi-VN')} - ${attendanceMax.toLocaleString('vi-VN')} người`;
  }
  return `${(attendanceMax ?? attendanceMin ?? 0).toLocaleString('vi-VN')} người`;
};

const getStaffName = (employeeId: string, employees: Employee[]) =>
  employees.find(employee => employee.id === employeeId)?.name || employeeId || 'Chưa phân công';

const getStaffShift = (staff: NonNullable<Event['staff']>[number]) => {
  const sessions = staff.sessions?.length ? staff.sessions : staff.session ? [staff.session] : [];
  return [
    staff.shiftDate ? formatDate(staff.shiftDate) : '',
    sessions.map(session => SESSION_LABELS[session]).join(' + ')
  ].filter(Boolean).join(' • ') || 'Chưa cập nhật';
};

const calculateStaffCosts = (event: Event) =>
  (event.staff || []).reduce((sum, staff) => sum + (Number(staff.salary) || Number(staff.quantity) * Number(staff.rate) || 0), 0);

const calculateExpenseCosts = (event: Event) =>
  (event.expenses || []).reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);

const calculateSaleOrderRevenue = (order: SaleOrder) => {
  const itemRevenue = (order.items || []).reduce((sum, item) => {
    const quantity = item.soldQuantity ?? item.quantity ?? 0;
    return sum + calcLineTotal(item.price || 0, quantity, item.discount || 0, item.discountPercent || 0);
  }, 0);
  const computed = Math.max(0, itemRevenue - (order.orderDiscount || 0));
  return computed > 0 ? computed : Math.max(0, Number(order.total ?? order.subtotal) || 0);
};

const calculateRevenue = (quotation?: Quotation | null, saleOrders: SaleOrder[] = []) => {
  const quotationRevenue = Number(quotation?.totalAmount) || 0;
  const saleRevenue = saleOrders
    .filter(order => (order.type || 'SALE') !== 'RETURN')
    .reduce((sum, order) => sum + calculateSaleOrderRevenue(order), 0);
  const returns = saleOrders
    .filter(order => order.type === 'RETURN')
    .reduce((sum, order) => sum + Math.abs(Number(order.total ?? order.subtotal) || 0), 0);
  return quotationRevenue + Math.max(0, saleRevenue - returns);
};

const brandHeader = () => `
  <div class="brand-header">
    <div class="brand-mark">⚛</div>
    <div>
      <div class="brand-name"><span>EIN</span>STEIN <b>HOUSE</b></div>
      <div class="brand-tagline">Every Child is A Genius</div>
    </div>
  </div>
`;

const documentFooter = (event: Event) => `
  <div class="document-footer">
    <span>${htmlEscape(event.eventProfile?.code || event.id)}</span>
    <span>Hồ sơ sự kiện • Xuất ngày ${htmlEscape(new Date().toLocaleDateString('vi-VN'))}</span>
  </div>
`;

const sectionHeading = (title: string, subtitle?: string) => `
  <div class="appendix-heading">
    ${brandHeader()}
    <div class="appendix-kicker">HỒ SƠ SỰ KIỆN • PHỤ LỤC</div>
    <h1>${htmlEscape(title)}</h1>
    <p>${htmlEscape(subtitle || '')}</p>
  </div>
`;

const emptyRow = (colspan: number, message = 'Chưa có dữ liệu trong sự kiện') =>
  `<tr><td colspan="${colspan}" class="empty-cell">${htmlEscape(message)}</td></tr>`;

const buildPlanSection = (event: Event, employees: Employee[], preparedBy: string, approvedBy: string) => {
  const profile: Partial<NonNullable<Event['eventProfile']>> = event.eventProfile || {};
  const programs = getPrograms(event);
  const stations = programs.flatMap(program =>
    (program.operation?.stations || []).map(station => ({ station, program }))
  );
  const layoutBlocks = programs.flatMap(program =>
    (program.layout?.blocks || []).map(block => ({ block, program }))
  );
  const contentRows = stations.length > 0
    ? stations.map(({ station, program }, index) => `
        <tr>
          <td class="center strong">${index + 1}</td>
          <td class="strong">${htmlEscape(station.name)}</td>
          <td>${htmlEscape([
            program.name,
            station.room ? `Khu vực: ${station.room}` : '',
            station.equipment?.length ? `Thiết bị: ${station.equipment.map(item => `${item.name} x${item.quantity}`).join(', ')}` : ''
          ].filter(Boolean).join(' • '))}</td>
          <td>${multiline(station.objective)}</td>
          <td>${htmlEscape([
            station.durationMinutes ? `${station.durationMinutes} phút` : '',
            station.script || '',
            station.checklist?.length ? `Checklist: ${station.checklist.join('; ')}` : ''
          ].filter(Boolean).join(' • '))}</td>
        </tr>
      `).join('')
    : layoutBlocks.length > 0
      ? layoutBlocks.map(({ block, program }, index) => `
          <tr>
            <td class="center strong">${index + 1}</td>
            <td class="strong">${htmlEscape(block.name)}</td>
            <td>${htmlEscape([program.name, block.packageName].filter(Boolean).join(' • '))}</td>
            <td>Tổ chức khu vực trải nghiệm theo sơ đồ chương trình.</td>
            <td>${htmlEscape(block.staffName ? `PIC: ${block.staffName}` : 'Triển khai theo sơ đồ trạm đã duyệt.')}</td>
          </tr>
        `).join('')
      : emptyRow(5, 'Chưa thiết kế nội dung/trạm cho sự kiện');

  const timelineRows = [...(event.timeline || [])]
    .sort((a, b) => a.datetime.localeCompare(b.datetime))
    .map((entry, index) => `
      <tr>
        <td class="center">${index + 2}</td>
        <td>${htmlEscape(TIMELINE_PHASE_LABELS[entry.phase])}</td>
        <td>${multiline(entry.note)}</td>
        <td>${htmlEscape(profile.einsteinPic || preparedBy || 'TEAM')}</td>
        <td class="center">${htmlEscape(formatDateTime(entry.datetime))}</td>
        <td></td>
        <td class="money">0 đ</td>
        <td></td>
      </tr>
    `).join('');

  const staffCosts = calculateStaffCosts(event);
  const expenseRows = (event.expenses || []).map((expense, index) => `
    <tr>
      <td class="center">${index + 2 + (event.timeline?.length || 0)}</td>
      <td>${htmlEscape(EXPENSE_CATEGORY_LABELS[expense.category])}</td>
      <td>${multiline(expense.description)}</td>
      <td>${htmlEscape(profile.einsteinPic || preparedBy || 'TEAM')}</td>
      <td></td>
      <td></td>
      <td class="money">${formatMoney(expense.amount)}</td>
      <td>${htmlEscape(expense.vatInvoiceLink ? 'Có hóa đơn/chứng từ' : '')}</td>
    </tr>
  `).join('');
  const totalCosts = staffCosts + calculateExpenseCosts(event);
  const staffNames = (event.staff || []).map(staff => getStaffName(staff.employeeId, employees));
  const eventType = profile.eventType ? EVENT_TYPE_LABELS[profile.eventType] : 'Chương trình trải nghiệm khoa học';
  const audience = getAudienceLabel(event);
  const contact = profile.schoolContact;
  const coordination = [
    profile.partnerOrg ? `Đơn vị phối hợp: ${profile.partnerOrg}` : '',
    contact?.name ? `Đầu mối phía trường: ${contact.name}${contact.phone ? ` (${contact.phone})` : ''}${contact.role ? ` • ${contact.role}` : ''}` : '',
    profile.einsteinPic ? `PIC Einstein Bus: ${profile.einsteinPic}` : '',
    [event.location, profile.addressDetail].filter(Boolean).length ? `Vị trí: ${[event.location, profile.addressDetail].filter(Boolean).join(' • ')}` : '',
    profile.mapLink ? `Map: ${profile.mapLink}` : ''
  ].filter(Boolean).join(' | ');
  const goal = profile.generalGoal ||
    'Giới thiệu và lan tỏa hình ảnh thương hiệu Einstein Bus đến cộng đồng học sinh và phụ huynh, thông qua hoạt động trải nghiệm – khám phá – học tập các sản phẩm STEM chất lượng cao.';
  const titleDate = getEventDateLabel(event);
  const timeLabel = getProgramTimeLabel(event);
  const saleGoal = profile.saleRevenueTarget
    ? `<p>Mục tiêu doanh thu dự kiến: <strong>${formatMoney(profile.saleRevenueTarget)}</strong>.</p>`
    : '';

  return `
    <section class="pdf-section plan-section">
      ${brandHeader()}
      <div class="plan-title">KẾ HOẠCH TRIỂN KHAI SỰ KIỆN | CHUYẾN XE KHOA HỌC - EINSTEIN BUS</div>
      <div class="event-title">${htmlEscape([event.name, profile.organization || event.client, titleDate].filter(Boolean).join(' - '))}</div>
      <table class="compact-table plan-time"><tbody><tr>
        <td class="label-cell">Thời gian triển khai:</td>
        <td>${htmlEscape([titleDate, timeLabel].filter(Boolean).join(' • '))}</td>
      </tr></tbody></table>

      <div class="yellow-title">I. Mục tiêu chung</div>
      <div class="plan-copy">
        <p>${multiline(goal)}</p>
        ${saleGoal}
        <p>Tạo hiệu ứng lan tỏa truyền thông qua hình ảnh, clip và tương tác trực tiếp; hướng tới hợp tác lâu dài trong các hoạt động trải nghiệm khoa học.</p>
      </div>

      <div class="yellow-title">II. Phạm vi triển khai</div>
      <table class="compact-table"><tbody>
        <tr><td class="label-cell">Quy mô:</td><td>${htmlEscape(`${getScaleLabel(event)}${audience ? ` (Đối tượng: ${audience})` : ''}`)}</td></tr>
        <tr><td class="label-cell">Đơn vị phối hợp:</td><td>${htmlEscape(coordination || event.client || 'Chưa cập nhật')}</td></tr>
      </tbody></table>

      <div class="yellow-title">III. Hình thức triển khai</div>
      <div class="single-line">- ${htmlEscape(`${eventType} - ${event.organizationVenue === 'EH' ? 'tổ chức tại Einstein House' : 'triển khai EBUS và các trạm trải nghiệm tại địa điểm sự kiện'}`)}</div>

      <div class="yellow-title">IV. Nội dung</div>
      <table class="compact-table plan-content-table">
        <thead><tr><th>#</th><th>Hoạt động</th><th>Nội dung</th><th>Mục tiêu</th><th>Cách triển khai</th></tr></thead>
        <tbody>${contentRows}</tbody>
      </table>

      <div class="yellow-title">V. Scheme ưu đãi &amp; khuyến mại</div>
      <table class="compact-table"><thead><tr><th>STT</th><th>Tên chương trình</th><th>Chương trình</th><th>Thời gian</th><th>Ghi chú</th></tr></thead>
        <tbody><tr><td class="center">1</td><td>Không</td><td></td><td></td><td></td></tr></tbody>
      </table>

      <div class="yellow-title">VI. Kế hoạch hành động</div>
      <table class="compact-table action-table">
        <thead><tr><th>STT</th><th>Hạng mục</th><th>Nội dung</th><th>PIC</th><th>Thời gian triển khai</th><th>Mục tiêu</th><th>Ngân sách</th><th>Ghi chú</th></tr></thead>
        <tbody>
          <tr class="group-row"><td colspan="6">Vận hành</td><td class="money">${formatMoney(totalCosts)}</td><td></td></tr>
          <tr>
            <td class="center">1</td><td>Nhân sự</td>
            <td>${htmlEscape(event.staff?.length ? `${event.staff.length} phân công nhân sự` : 'Chưa phân công nhân sự')}</td>
            <td>${htmlEscape(staffNames.join(', ') || profile.einsteinPic || preparedBy || 'Chưa phân công')}</td>
            <td>${htmlEscape([titleDate, timeLabel].filter(Boolean).join(' • '))}</td><td></td>
            <td class="money">${formatMoney(staffCosts)}</td><td></td>
          </tr>
          ${timelineRows}
          ${expenseRows}
          <tr class="total-row"><td colspan="6">Tổng tiền</td><td class="money">${formatMoney(totalCosts)}</td><td></td></tr>
        </tbody>
      </table>

      <div class="date-sign">Hà Nội, Ngày .... tháng .... năm ${new Date().getFullYear()}</div>
      <table class="signature-table"><tbody><tr>
        <td><strong>Giám đốc dự án EH</strong><div class="signature-space"></div><strong>${htmlEscape(approvedBy)}</strong></td>
        <td><strong>Người thực hiện</strong><div class="signature-space"></div><strong>${htmlEscape(preparedBy)}</strong></td>
      </tr></tbody></table>
      ${documentFooter(event)}
    </section>
  `;
};

const buildStaffSection = (event: Event, employees: Employee[]) => {
  const rows = (event.staff || []).map((staff, index) => {
    const employee = employees.find(item => item.id === staff.employeeId);
    return `
      <tr>
        <td class="center">${index + 1}</td>
        <td><strong>${htmlEscape(employee?.name || staff.employeeId)}</strong><br/><span class="muted">${htmlEscape(employee?.phone || '')}</span></td>
        <td>${htmlEscape(staff.task || employee?.role || 'Chưa cập nhật')}</td>
        <td>${htmlEscape([staff.stationName, getStaffShift(staff)].filter(Boolean).join(' • '))}</td>
        <td class="center">${htmlEscape(`${staff.quantity || 0} ${UNIT_LABELS[staff.unit].toLowerCase()}`)}</td>
        <td class="money">${formatMoney(staff.rate)}</td>
        <td class="money"><strong>${formatMoney(staff.salary || staff.quantity * staff.rate)}</strong></td>
      </tr>
    `;
  }).join('');
  return `
    <section class="pdf-section appendix-section">
      ${sectionHeading('Danh sách nhân sự & phân công', event.name)}
      <table class="data-table">
        <thead><tr><th>STT</th><th>Nhân sự</th><th>Nhiệm vụ</th><th>Trạm / Ca làm</th><th>Khối lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
        <tbody>${rows || emptyRow(7)}</tbody>
        <tfoot><tr><td colspan="6">Tổng chi phí nhân sự</td><td class="money">${formatMoney(calculateStaffCosts(event))}</td></tr></tfoot>
      </table>
      ${documentFooter(event)}
    </section>
  `;
};

const buildExpenseSection = (event: Event, quotation?: Quotation | null, saleOrders: SaleOrder[] = []) => {
  const staffCosts = calculateStaffCosts(event);
  const expenseCosts = calculateExpenseCosts(event);
  const totalCosts = staffCosts + expenseCosts;
  const revenue = calculateRevenue(quotation, saleOrders);
  const target = Number(event.eventProfile?.saleRevenueTarget) || 0;
  const effectiveRevenue = revenue || target;
  const rows = (event.expenses || []).map((expense, index) => `
    <tr>
      <td class="center">${index + 1}</td>
      <td>${htmlEscape(EXPENSE_CATEGORY_LABELS[expense.category])}</td>
      <td>${htmlEscape(expense.subCategory || '')}</td>
      <td>${multiline(expense.description)}</td>
      <td class="money"><strong>${formatMoney(expense.amount)}</strong></td>
      <td>${expense.vatInvoiceLink ? `<span class="status-ok">Có chứng từ</span><br/><span class="url-text">${htmlEscape(expense.vatInvoiceLink)}</span>` : '<span class="muted">Chưa có</span>'}</td>
    </tr>
  `).join('');
  return `
    <section class="pdf-section appendix-section">
      ${sectionHeading('Chi phí & hiệu quả tài chính', event.name)}
      <div class="metric-grid">
        <div><span>Chi phí nhân sự</span><strong>${formatMoney(staffCosts)}</strong></div>
        <div><span>Chi phí khác</span><strong>${formatMoney(expenseCosts)}</strong></div>
        <div><span>Tổng chi phí</span><strong>${formatMoney(totalCosts)}</strong></div>
        <div><span>${revenue ? 'Doanh thu ghi nhận' : 'Mục tiêu doanh thu'}</span><strong>${formatMoney(effectiveRevenue)}</strong></div>
        <div class="${effectiveRevenue - totalCosts >= 0 ? 'positive' : 'negative'}"><span>Lợi nhuận dự kiến</span><strong>${formatMoney(effectiveRevenue - totalCosts)}</strong></div>
      </div>
      <table class="data-table">
        <thead><tr><th>STT</th><th>Nhóm chi phí</th><th>Phân loại</th><th>Nội dung</th><th>Số tiền</th><th>Hóa đơn / chứng từ</th></tr></thead>
        <tbody>${rows || emptyRow(6)}</tbody>
        <tfoot><tr><td colspan="4">Tổng chi phí khác</td><td class="money">${formatMoney(expenseCosts)}</td><td></td></tr></tfoot>
      </table>
      ${documentFooter(event)}
    </section>
  `;
};

const buildAdvanceSection = (event: Event) => {
  const requests = event.advanceRequests || [];
  const requested = requests.reduce((sum, request) => sum + (Number(request.amount) || 0), 0);
  const paid = Number(event.advancePaidAmount) || 0;
  const vatExpenses = (event.expenses || [])
    .filter(expense => Boolean(expense.vatInvoiceLink))
    .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
  const balance = paid - vatExpenses;
  const rows = requests.map((request, index) => `
    <tr>
      <td class="center">${index + 1}</td>
      <td><strong>${htmlEscape(request.title)}</strong></td>
      <td>${multiline(request.note, '')}</td>
      <td>${htmlEscape(request.createdAt ? formatDateTime(request.createdAt) : '')}</td>
      <td>${htmlEscape(request.source === 'AUTO_PROFILE' ? 'Tự động từ hồ sơ' : 'Nhập thủ công')}</td>
      <td class="money"><strong>${formatMoney(request.amount)}</strong></td>
    </tr>
  `).join('');
  const status = event.advanceSkipped
    ? 'Không thực hiện tạm ứng'
    : event.paymentCompleted
      ? 'Đã hoàn tất thanh toán'
      : event.advanceRefundedConfirmed
        ? 'Đã xác nhận hoàn ứng'
        : event.advancePaidConfirmed
          ? 'Đã xác nhận chi tạm ứng'
          : 'Đang đề nghị / chờ duyệt';
  return `
    <section class="pdf-section appendix-section">
      ${sectionHeading('Đề nghị tạm ứng & hoàn ứng', event.name)}
      <div class="status-banner"><strong>Trạng thái:</strong> ${htmlEscape(status)}</div>
      <div class="metric-grid four">
        <div><span>Tổng đề nghị</span><strong>${formatMoney(requested)}</strong></div>
        <div><span>Đã tạm ứng</span><strong>${formatMoney(paid)}</strong><small>${htmlEscape(event.advancePaidDate ? formatDate(event.advancePaidDate) : '')}</small></div>
        <div><span>Chi phí có chứng từ</span><strong>${formatMoney(vatExpenses)}</strong></div>
        <div class="${balance >= 0 ? 'positive' : 'negative'}"><span>${balance >= 0 ? 'Cần hoàn lại' : 'Cần thanh toán thêm'}</span><strong>${formatMoney(Math.abs(balance))}</strong></div>
      </div>
      <table class="data-table">
        <thead><tr><th>STT</th><th>Khoản tạm ứng</th><th>Ghi chú</th><th>Ngày tạo</th><th>Nguồn</th><th>Số tiền</th></tr></thead>
        <tbody>${rows || emptyRow(6)}</tbody>
        <tfoot><tr><td colspan="5">Tổng đề nghị tạm ứng</td><td class="money">${formatMoney(requested)}</td></tr></tfoot>
      </table>
      ${documentFooter(event)}
    </section>
  `;
};

const buildTimelineSection = (event: Event) => {
  const entries = [...(event.timeline || [])].sort((a, b) => a.datetime.localeCompare(b.datetime));
  const groups = (['BEFORE', 'DURING', 'AFTER'] as const).map(phase => {
    const rows = entries.filter(entry => entry.phase === phase).map((entry, index) => `
      <tr>
        <td class="center">${index + 1}</td>
        <td><strong>${htmlEscape(formatDateTime(entry.datetime))}</strong></td>
        <td>${multiline(entry.note)}</td>
        <td>${htmlEscape(entry.source === 'AUTO_LOGISTICS' ? 'Tự động từ hậu cần' : 'Nhập thủ công')}</td>
      </tr>
    `).join('');
    if (!rows) return '';
    return `
      <h2 class="subheading">${htmlEscape(TIMELINE_PHASE_LABELS[phase])}</h2>
      <table class="data-table timeline-table"><thead><tr><th>STT</th><th>Thời gian</th><th>Công việc / Mốc triển khai</th><th>Nguồn</th></tr></thead><tbody>${rows}</tbody></table>
    `;
  }).join('');
  return `
    <section class="pdf-section appendix-section">
      ${sectionHeading('Timeline hậu cần', `${event.name} • ${entries.length} mốc triển khai`)}
      ${groups || '<div class="empty-block">Chưa có timeline hậu cần.</div>'}
      ${documentFooter(event)}
    </section>
  `;
};

const buildAgendaSection = (event: Event) => {
  const programs = getPrograms(event);
  const content = programs.map(program => {
    const agenda = [...(program.operation?.agenda || [])].sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (!agenda.length) return '';
    const rows = agenda.map((block, index) => `
      <tr>
        <td class="center">${index + 1}</td>
        <td class="center"><strong>${htmlEscape(block.startTime)} - ${htmlEscape(block.endTime)}</strong></td>
        <td><strong>${htmlEscape(block.title)}</strong>${block.sectionCode ? `<br/><span class="muted">Mục ${htmlEscape(block.sectionCode)}</span>` : ''}</td>
        <td>${htmlEscape(block.room || '')}</td>
        <td>${multiline(block.note, '')}${block.warning ? `<br/><span class="warning">Lưu ý: ${htmlEscape(block.warning)}</span>` : ''}</td>
      </tr>
    `).join('');
    const sessionLabel = (program.sessions || []).map(session => SESSION_LABELS[session]).join(' + ');
    return `
      <div class="program-block">
        <h2 class="program-title">${htmlEscape(program.name)}</h2>
        <p class="program-meta">${htmlEscape([formatDate(program.date, true), sessionLabel, program.description].filter(Boolean).join(' • '))}</p>
        <table class="data-table"><thead><tr><th>STT</th><th>Thời gian</th><th>Nội dung</th><th>Phòng / Khu vực</th><th>Ghi chú</th></tr></thead><tbody>${rows}</tbody></table>
      </div>
    `;
  }).join('');
  return `
    <section class="pdf-section appendix-section">
      ${sectionHeading('Agenda chương trình', event.name)}
      ${content || '<div class="empty-block">Chưa có Agenda trong các chương trình của sự kiện.</div>'}
      ${documentFooter(event)}
    </section>
  `;
};

const buildLayoutPreview = (layout?: EventLayout) => {
  if (!layout || (!layout.floorplanImage && !layout.blocks?.length)) return '';
  const blocks = (layout.blocks || []).map(block => `
    <div class="layout-block" style="left:${Number(block.x) || 0}%;top:${Number(block.y) || 0}%;width:${Number(block.width) || 10}%;height:${Number(block.height) || 10}%;border-color:${htmlEscape(block.color || '#2563eb')};background:${htmlEscape(block.color || '#2563eb')}26">
      <strong>${htmlEscape(block.name)}</strong>
      ${block.staffName ? `<small>${htmlEscape(block.staffName)}</small>` : ''}
    </div>
  `).join('');
  const ratio = Number(layout.floorplanAspectRatio) || 16 / 9;
  const height = Math.max(260, Math.min(520, Math.round(720 / ratio)));
  return `
    <div class="layout-preview" style="height:${height}px">
      ${layout.floorplanImage ? `<img src="${htmlEscape(layout.floorplanImage)}" alt="Sơ đồ mặt bằng"/>` : '<div class="layout-placeholder">SƠ ĐỒ BỐ TRÍ TRẠM</div>'}
      ${blocks}
    </div>
  `;
};

const buildDesignSection = (event: Event) => {
  const programs = getPrograms(event);
  const content = programs.map(program => {
    const stations = program.operation?.stations || [];
    const rotations = program.operation?.rotations || [];
    const blocks = program.layout?.blocks || [];
    if (!stations.length && !rotations.length && !blocks.length && !program.layout?.floorplanImage) return '';
    const stationRows = stations.map((station, index) => `
      <tr>
        <td class="center">${index + 1}</td>
        <td><strong>${htmlEscape(station.name)}</strong><br/><span class="muted">${htmlEscape(station.category)}</span></td>
        <td>${htmlEscape(station.room || '')}</td>
        <td class="center">${htmlEscape(station.durationMinutes ? `${station.durationMinutes} phút` : '')}</td>
        <td>${multiline(station.objective)}</td>
        <td>${htmlEscape((station.equipment || []).map(item => `${item.name} x${item.quantity}${item.unit ? ` ${item.unit}` : ''}`).join(', ') || 'Chưa gắn thiết bị')}</td>
        <td>${htmlEscape((station.checklist || []).join('; '))}</td>
      </tr>
    `).join('');
    const blockRows = blocks.map((block, index) => `
      <tr><td class="center">${index + 1}</td><td>${htmlEscape(block.name)}</td><td>${htmlEscape(block.packageName || '')}</td><td>${htmlEscape(block.staffName || '')}</td></tr>
    `).join('');
    const rotationRows = rotations.map((group, index) => `
      <tr><td class="center">${index + 1}</td><td>${htmlEscape(group.name)}</td><td class="center">${htmlEscape(group.studentCount)}</td><td>${htmlEscape(group.route.map(stationId => stations.find(station => station.id === stationId)?.name || stationId).join(' → '))}</td></tr>
    `).join('');
    return `
      <div class="program-block">
        <h2 class="program-title">${htmlEscape(program.name)}</h2>
        <p class="program-meta">${htmlEscape([
          program.operation?.theme ? `Chủ đề: ${program.operation.theme}` : '',
          program.operation?.grade ? `Khối: ${program.operation.grade}` : '',
          program.operation?.studentCount ? `${program.operation.studentCount} học sinh` : '',
          program.operation?.groupCount ? `${program.operation.groupCount} nhóm` : ''
        ].filter(Boolean).join(' • '))}</p>
        ${buildLayoutPreview(program.layout)}
        <h3 class="minor-heading">Thiết kế trạm</h3>
        <table class="data-table"><thead><tr><th>STT</th><th>Trạm</th><th>Phòng</th><th>Thời lượng</th><th>Mục tiêu</th><th>Thiết bị</th><th>Checklist</th></tr></thead><tbody>${stationRows || emptyRow(7)}</tbody></table>
        ${rotationRows ? `<h3 class="minor-heading">Phân nhóm & luân chuyển trạm</h3><table class="data-table"><thead><tr><th>STT</th><th>Nhóm</th><th>Số học sinh</th><th>Lộ trình</th></tr></thead><tbody>${rotationRows}</tbody></table>` : ''}
        ${blockRows ? `<h3 class="minor-heading">Block trên sơ đồ</h3><table class="data-table"><thead><tr><th>STT</th><th>Khu vực</th><th>Gói hoạt động</th><th>Nhân sự phụ trách</th></tr></thead><tbody>${blockRows}</tbody></table>` : ''}
      </div>
    `;
  }).join('');
  return `
    <section class="pdf-section appendix-section">
      ${sectionHeading('Design & sơ đồ trạm', event.name)}
      ${content || '<div class="empty-block">Chưa có Design hoặc sơ đồ trạm trong sự kiện.</div>'}
      ${documentFooter(event)}
    </section>
  `;
};

const buildEquipmentSection = (event: Event, inventory: InventoryItem[]) => {
  const rows = (event.items || []).map((allocation, index) => {
    const item = inventory.find(inventoryItem => inventoryItem.id === allocation.itemId);
    return `
      <tr>
        <td class="center">${index + 1}</td>
        <td>${htmlEscape(item?.barcode || '')}</td>
        <td><strong>${htmlEscape(item?.name || allocation.itemId)}</strong><br/><span class="muted">${htmlEscape(item?.category || '')}</span></td>
        <td class="center"><strong>${htmlEscape(allocation.quantity)}</strong></td>
        <td class="center">${htmlEscape(allocation.returnedQuantity || 0)}</td>
        <td>${htmlEscape(item?.location || '')}</td>
        <td>${allocation.done ? '<span class="status-ok">Đã chuẩn bị</span>' : '<span class="muted">Chưa xác nhận</span>'}</td>
      </tr>
    `;
  }).join('');
  const total = (event.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  return `
    <section class="pdf-section appendix-section">
      ${sectionHeading('Danh mục thiết bị cần mang', `${event.name} • ${event.items.length} loại • ${total} đơn vị`)}
      <table class="data-table">
        <thead><tr><th>STT</th><th>Barcode</th><th>Thiết bị</th><th>Số lượng</th><th>Đã trả</th><th>Vị trí kho</th><th>Trạng thái</th></tr></thead>
        <tbody>${rows || emptyRow(7)}</tbody>
      </table>
      ${documentFooter(event)}
    </section>
  `;
};

const dossierStyles = `
  <style>
    * { box-sizing: border-box; }
    .dossier-root { width: 100%; margin: 0; background: #fff; color: #111827; font-family: Arial, Helvetica, sans-serif; font-size: 10px; line-height: 1.32; }
    .pdf-section { position: relative; width: 100%; padding: 10px 12px 28px; background: #fff; page-break-after: always; break-after: page; }
    .pdf-section:last-child { page-break-after: auto; break-after: auto; }
    .appendix-section { min-height: 1020px; padding: 24px 28px 48px; }
    .brand-header { min-height: 62px; display: flex; align-items: center; justify-content: center; gap: 9px; border: 1px solid #d1d5db; padding: 8px 12px; }
    .brand-mark { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #1670c5; color: #fff; font-size: 24px; font-weight: 900; border: 5px solid #f97316; }
    .brand-name { color: #4f9b39; font-size: 20px; line-height: 1; font-weight: 900; letter-spacing: -.5px; }
    .brand-name span, .brand-name b { color: #f97316; }
    .brand-tagline { color: #3b82c4; text-align: center; font-size: 9px; font-weight: 700; margin-top: 3px; letter-spacing: .4px; }
    .plan-title { border: 1px solid #b7b7b7; border-top: 0; padding: 4px; text-align: center; font-family: 'Times New Roman', serif; font-weight: 700; font-size: 12px; }
    .event-title { border: 1px solid #b7b7b7; border-top: 0; padding: 4px; text-align: center; color: #a80000; font-family: 'Times New Roman', serif; font-weight: 800; font-size: 17px; }
    .compact-table, .data-table, .signature-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .compact-table th, .compact-table td { border: 1px solid #7d7d7d; padding: 3px 4px; vertical-align: top; font-family: 'Times New Roman', serif; font-size: 8.7px; line-height: 1.2; overflow-wrap: anywhere; }
    .compact-table th { text-align: center; font-weight: 700; background: #fff; }
    .plan-time .label-cell, .label-cell { width: 19%; }
    .yellow-title { margin-top: 4px; border: 1px solid #8a7b45; background: #ffe699; padding: 3px 4px; font-family: 'Times New Roman', serif; font-weight: 700; font-size: 9.5px; }
    .plan-copy { border-left: 1px solid #7d7d7d; border-right: 1px solid #7d7d7d; padding: 3px 4px; font-family: 'Times New Roman', serif; font-size: 8.7px; }
    .plan-copy p { margin: 0 0 2px; }
    .single-line { border: 1px solid #7d7d7d; padding: 3px 4px; font-family: 'Times New Roman', serif; font-size: 8.7px; }
    .plan-content-table th:nth-child(1) { width: 3%; } .plan-content-table th:nth-child(2) { width: 17%; } .plan-content-table th:nth-child(3) { width: 23%; } .plan-content-table th:nth-child(4) { width: 25%; } .plan-content-table th:nth-child(5) { width: 32%; }
    .action-table th:nth-child(1) { width: 4%; } .action-table th:nth-child(2) { width: 15%; } .action-table th:nth-child(3) { width: 23%; } .action-table th:nth-child(4) { width: 13%; } .action-table th:nth-child(5) { width: 14%; } .action-table th:nth-child(6) { width: 9%; } .action-table th:nth-child(7) { width: 11%; } .action-table th:nth-child(8) { width: 11%; }
    .group-row td { background: #f5f1e7; font-weight: 700; } .total-row td { font-weight: 800; }
    .center { text-align: center; } .money { text-align: right; white-space: nowrap; } .strong { font-weight: 700; }
    .date-sign { text-align: right; padding: 10px 8px 3px; font-family: 'Times New Roman', serif; font-style: italic; font-size: 9px; }
    .signature-table td { width: 50%; border: 1px solid #5f6368; text-align: center; vertical-align: top; padding: 5px; font-family: 'Times New Roman', serif; font-size: 9px; }
    .signature-space { height: 45px; }
    .document-footer { position: absolute; left: 28px; right: 28px; bottom: 14px; display: flex; justify-content: space-between; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 5px; font-size: 8px; }
    .plan-section .document-footer { left: 12px; right: 12px; bottom: 6px; }
    .appendix-heading { margin-bottom: 20px; }
    .appendix-heading .brand-header { border: 0; justify-content: flex-start; min-height: 50px; padding: 0 0 12px; border-bottom: 2px solid #163b65; }
    .appendix-heading .brand-mark { width: 32px; height: 32px; font-size: 19px; border-width: 4px; }
    .appendix-heading .brand-name { font-size: 17px; }
    .appendix-kicker { color: #c2410c; font-size: 9px; font-weight: 800; letter-spacing: 1.5px; margin-top: 16px; }
    .appendix-heading h1 { margin: 4px 0 2px; color: #123a64; font-size: 25px; line-height: 1.1; }
    .appendix-heading p { margin: 0; color: #64748b; font-size: 11px; font-weight: 600; }
    .data-table { margin: 10px 0 18px; font-size: 9px; }
    .data-table th, .data-table td { border: 1px solid #cbd5e1; padding: 7px 6px; vertical-align: top; overflow-wrap: anywhere; }
    .data-table th { background: #163b65; color: #fff; text-transform: uppercase; font-size: 8px; letter-spacing: .25px; text-align: center; }
    .data-table tbody tr:nth-child(even) td { background: #f8fafc; }
    .data-table tfoot td { background: #fff2cc; color: #7c2d12; font-weight: 800; }
    .data-table tfoot td:first-child { text-align: right; }
    .empty-cell, .empty-block { text-align: center; color: #94a3b8; font-style: italic; padding: 24px !important; }
    .empty-block { border: 1px dashed #cbd5e1; border-radius: 8px; background: #f8fafc; }
    .muted { color: #64748b; font-size: 8px; } .warning { color: #b45309; font-weight: 700; } .url-text { color: #2563eb; font-size: 7px; }
    .status-ok { color: #047857; font-weight: 800; }
    .metric-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 12px 0 20px; }
    .metric-grid.four { grid-template-columns: repeat(4, 1fr); }
    .metric-grid > div { border: 1px solid #dbe4ee; background: #f8fafc; border-radius: 7px; padding: 10px; }
    .metric-grid span { display: block; color: #64748b; font-size: 8px; font-weight: 800; text-transform: uppercase; }
    .metric-grid strong { display: block; color: #163b65; font-size: 13px; margin-top: 4px; }
    .metric-grid small { display: block; color: #64748b; margin-top: 2px; }
    .metric-grid .positive { background: #ecfdf5; border-color: #a7f3d0; } .metric-grid .positive strong { color: #047857; }
    .metric-grid .negative { background: #fff1f2; border-color: #fecdd3; } .metric-grid .negative strong { color: #be123c; }
    .status-banner { margin: 8px 0 14px; border-left: 4px solid #2563eb; background: #eff6ff; color: #1e3a8a; padding: 10px 12px; }
    .subheading, .program-title { color: #163b65; font-size: 14px; margin: 18px 0 6px; padding-bottom: 5px; border-bottom: 1px solid #cbd5e1; }
    .minor-heading { color: #475569; font-size: 10px; text-transform: uppercase; letter-spacing: .6px; margin: 14px 0 4px; }
    .program-block { page-break-inside: auto; break-inside: auto; margin-bottom: 22px; }
    .program-meta { color: #64748b; font-size: 9px; margin: -2px 0 8px; }
    .timeline-table th:nth-child(1) { width: 7%; } .timeline-table th:nth-child(2) { width: 22%; } .timeline-table th:nth-child(4) { width: 19%; }
    .layout-preview { position: relative; width: 100%; overflow: hidden; border: 1px solid #94a3b8; border-radius: 7px; background: #e2e8f0; margin: 10px 0 14px; }
    .layout-preview > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
    .layout-placeholder { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 18px; font-weight: 900; letter-spacing: 2px; }
    .layout-block { position: absolute; border: 2px solid; border-radius: 5px; padding: 4px; color: #0f172a; overflow: hidden; font-size: 8px; text-shadow: 0 1px 2px #fff; }
    .layout-block strong, .layout-block small { display: block; }
    tr, .metric-grid, .layout-preview { break-inside: avoid; page-break-inside: avoid; }
  </style>
`;

export const buildEventDossierHtml = (
  event: Event,
  inventory: InventoryItem[],
  options: EventDossierExportOptions
) => {
  const sections = new Set<EventDossierSection>(options.sections.length ? options.sections : ['PLAN']);
  sections.add('PLAN');
  const employees = options.employees || [];
  const preparedBy = options.preparedBy?.trim() || event.eventProfile?.einsteinPic || 'Phạm Trần Nhân';
  const approvedBy = options.approvedBy?.trim() || 'Vũ Thanh Hà';
  const html = [
    buildPlanSection(event, employees, preparedBy, approvedBy),
    sections.has('STAFF') ? buildStaffSection(event, employees) : '',
    sections.has('EXPENSES') ? buildExpenseSection(event, options.quotation, options.saleOrders) : '',
    sections.has('ADVANCES') ? buildAdvanceSection(event) : '',
    sections.has('TIMELINE') ? buildTimelineSection(event) : '',
    sections.has('AGENDA') ? buildAgendaSection(event) : '',
    sections.has('DESIGN') ? buildDesignSection(event) : '',
    sections.has('EQUIPMENT') ? buildEquipmentSection(event, inventory) : ''
  ].join('');
  return `${dossierStyles}<div class="dossier-root">${html}</div>`;
};

const sanitizeFilename = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .replace(/[^a-zA-Z0-9-_]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 110);

export const exportEventDossier = async (
  event: Event,
  inventory: InventoryItem[],
  options: EventDossierExportOptions
): Promise<void> => {
  const mod: any = await import('html2pdf.js');
  const html2pdf = (window as any).html2pdf || mod?.default || mod;
  if (!html2pdf) throw new Error('Không tải được thư viện tạo PDF.');

  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-10000px';
  wrapper.style.top = '0';
  wrapper.style.width = '748px';
  wrapper.style.background = '#ffffff';
  wrapper.innerHTML = buildEventDossierHtml(event, inventory, options);
  document.body.appendChild(wrapper);

  const defaultFilename = `Ho_so_su_kien_${sanitizeFilename(event.eventProfile?.code || event.name || event.id)}.pdf`;
  try {
    await html2pdf().set({
      filename: options.filename || defaultFilename,
      margin: [6, 6, 8, 6],
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: options.quality === 'high' ? 2 : 1.5,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
      pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.metric-grid', '.layout-preview'] }
    }).from(wrapper.querySelector('.dossier-root')).save();
  } finally {
    wrapper.remove();
  }
};
