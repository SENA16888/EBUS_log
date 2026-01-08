

export enum ItemStatus {
  AVAILABLE = 'AVAILABLE',
  IN_USE = 'IN_USE',
  MAINTENANCE = 'MAINTENANCE',
  BROKEN = 'BROKEN',
  LOST = 'LOST'
}

export enum EventStatus {
  UPCOMING = 'UPCOMING',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum TransactionType {
  IMPORT = 'IMPORT',
  EXPORT_EVENT = 'EXPORT_EVENT',
  RETURN_EVENT = 'RETURN_EVENT',
  MAINTENANCE_IN = 'MAINTENANCE_IN',
  MAINTENANCE_OUT = 'MAINTENANCE_OUT',
  REPORT_BROKEN = 'REPORT_BROKEN',
  REPORT_LOST = 'REPORT_LOST',
  FIXED = 'FIXED',
  DISPOSE = 'DISPOSE'
}

export interface InventoryItem {
  id: string;
  barcode?: string;
  name: string;
  category: string;
  description: string;
  imageUrl?: string;
  totalQuantity: number;
  availableQuantity: number;
  inUseQuantity: number;
  maintenanceQuantity: number;
  brokenQuantity: number;
  lostQuantity: number;
  usageCount: number;
  location: string;
  rentalPrice: number;
  // Bổ sung quản lý nhập hàng/sản xuất
  purchaseLink?: string; 
  minStock?: number;
  productionNote?: string;
  plannedPurchase?: boolean;
  plannedQuantity?: number;
  plannedEta?: string;
}

export type InventoryReceiptItemMode = 'EXISTING' | 'NEW';

export interface InventoryReceiptItem {
  mode: InventoryReceiptItemMode;
  itemId?: string;
  name: string;
  category: string;
  quantity: number;
  barcode?: string;
  description?: string;
  imageUrl?: string;
  rentalPrice?: number;
  purchaseLink?: string;
  minStock?: number;
  productionNote?: string;
  location?: string;
}

export interface InventoryReceipt {
  id: string;
  code: string;
  createdAt: string;
  source: string;
  note?: string;
  createdBy?: {
    id?: string;
    name?: string;
    role?: string;
    phone?: string;
  };
  items: InventoryReceiptItem[];
}

export type ChecklistDirection = 'OUT' | 'IN';
export type ChecklistStatus = 'OK' | 'DAMAGED' | 'LOST' | 'MISSING';

export interface ChecklistSignature {
  name: string;
  title?: string;
  signedAt: string;
  dataUrl?: string;
  note?: string;
  direction?: ChecklistDirection;
}

export interface ChecklistSignaturePair {
  manager?: ChecklistSignature;
  operator?: ChecklistSignature;
  note?: string;
  direction: ChecklistDirection;
}

export interface ChecklistSlipItem {
  itemId: string;
  name?: string;
  orderQty: number;
  scannedOut: number;
  scannedIn: number;
  damaged: number;
  lost: number;
  missing: number;
}

export interface ChecklistSlip {
  id: string;
  direction: ChecklistDirection;
  slipNo?: number;
  createdAt: string;
  manager?: ChecklistSignature;
  operator?: ChecklistSignature;
  note?: string;
  items: ChecklistSlipItem[];
}

export interface ChecklistLogEntry {
  id: string;
  barcode?: string;
  itemId?: string;
  itemName?: string;
  direction: ChecklistDirection;
  status: ChecklistStatus;
  quantity: number;
  note?: string;
  timestamp: string;
}

export interface EventChecklist {
  outbound: Record<string, number>;
  inbound: Record<string, number>;
  damaged: Record<string, number>;
  lost: Record<string, number>;
  notes: Record<string, string>;
  logs: ChecklistLogEntry[];
  signature?: ChecklistSignature; // legacy single signature
  signatures?: {
    outbound?: ChecklistSignaturePair;
    inbound?: ChecklistSignaturePair;
  };
  slips?: ChecklistSlip[];
}

export interface SaleItem {
  id: string;
  name: string;
  category?: string;
  description?: string;
  images?: string[];
  price: number;
  link?: string;
  barcode?: string;
}

export interface SaleOrderLine {
  itemId: string;
  barcode?: string;
  name: string;
  price: number;
  quantity: number;
  soldQuantity?: number;
  discount?: number; // VNĐ discount per unit or per line
  discountPercent?: number; // Percentage discount applied on unit price
  lineTotal?: number;
}

export interface SaleOrder {
  id: string;
  date: string;
  customerName: string;
  customerContact?: string;
  items: SaleOrderLine[];
  subtotal?: number;
  orderDiscount?: number;
  total: number;
  note?: string;
  type?: 'SALE' | 'RETURN';
  relatedOrderId?: string;
  groupType?: 'EVENT' | 'CUSTOMER';
  groupId?: string;
  groupName?: string;
  eventId?: string;
  eventName?: string;
  status?: 'DRAFT' | 'FINALIZED';
  exportConfirmed?: boolean;
  refundConfirmed?: boolean;
  returnConfirmed?: boolean;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  phone: string;
  email?: string;
  avatarUrl?: string;
  baseRate?: number;
}

export interface EventStaffAllocation {
  employeeId: string;
  task: string;
  unit: 'HOUR' | 'DAY' | 'FIXED';
  quantity: number;
  rate: number;
  salary: number; 
  session?: 'MORNING' | 'AFTERNOON' | 'EVENING';
  sessions?: ('MORNING' | 'AFTERNOON' | 'EVENING')[];
  shiftDate?: string;
  done?: boolean;
}

export interface EventExpense {
  id: string;
  category: 'TRANSPORT_GOODS' | 'TRANSPORT_STAFF' | 'ACCOMMODATION' | 'PRINTING' | 'CONSUMABLES' | 'CATERING' | 'MISC';
  subCategory?: string; 
  description: string;
  amount: number;
  vatInvoiceLink?: string;
}

export type EventTypeId = 'CAMBRIDGE_DAY' | 'SCIENCE_DAY' | 'BOOK_FAIR' | 'LIBRARY' | 'COMMUNITY';

export interface EventContact {
  name: string;
  phone?: string;
  zalo?: string;
  role?: string;
}

export interface EventProfile {
  code: string;
  organization?: string;
  eventType?: EventTypeId;
  programTimeStart?: string;
  programTimeEnd?: string;
  programSession?: Event['session'];
  addressDetail?: string;
  mapLink?: string;
  setupArea?: string;
  generalGoal?: string;
  salesScope?: 'NO_SALE' | 'LIGHT_ADVICE' | 'SELLING' | 'CUSTOM';
  salesScopeNote?: string;
  audience?: Array<'MN' | 'TIEU_HOC' | 'THCS' | 'THPT' | 'PH'>;
  attendanceMin?: number;
  attendanceMax?: number;
  saleRevenueTarget?: number;
  partnerOrg?: string;
  schoolContact?: EventContact;
  einsteinPic?: string;
}

export interface EventAdvanceRequest {
  id: string;
  title: string;
  note?: string;
  amount: number;
  createdAt?: string;
}

export interface EventItemAllocation {
  itemId: string;
  quantity: number;
  returnedQuantity: number;
  done?: boolean;
}

export type EventProcessStepId = 'ORDER' | 'PLAN' | 'PACK' | 'EXECUTE' | 'CLOSE';

export interface EventProcessChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface EventProcessStep {
  id: EventProcessStepId;
  title: string;
  checklist: EventProcessChecklistItem[];
}

export type LayoutPackageSource = 'QUOTATION' | 'PACKAGE' | 'CUSTOM';

export interface EventLayoutBlock {
  id: string;
  name: string;
  packageId?: string;
  packageName?: string;
  packageSource?: LayoutPackageSource;
  staffId?: string;
  staffName?: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EventLayout {
  floorplanImage?: string;
  floorplanAspectRatio?: number;
  blocks: EventLayoutBlock[];
}

export type EventTimelinePhase = 'BEFORE' | 'DURING' | 'AFTER';

export interface EventTimelineEntry {
  id: string;
  phase: EventTimelinePhase;
  datetime: string;
  note: string;
}

export interface Event {
  id: string;
  name: string;
  client: string;
  location: string;
  startDate: string;
  endDate: string;
  status: EventStatus;
  session?: 'MORNING' | 'AFTERNOON' | 'EVENING';
  // Each schedule entry may include multiple sessions in the same date
  schedule?: Array<{ date: string; sessions: ('MORNING' | 'AFTERNOON' | 'EVENING')[] }>;
  items: EventItemAllocation[];
  staff?: EventStaffAllocation[];
  expenses?: EventExpense[];
  advanceRequests?: EventAdvanceRequest[];
  advancePaidAmount?: number;
  advancePaidDate?: string;
  advancePaidConfirmed?: boolean;
  advanceRefundedConfirmed?: boolean;
  paymentCompleted?: boolean;
  advanceSkipped?: boolean;
  eventProfile?: EventProfile;
  quotationId?: string; 
  isOrderCreated?: boolean; 
  processSteps?: EventProcessStep[];
  layout?: EventLayout;
  saleOrderIds?: string[];
  checklist?: EventChecklist;
  timeline?: EventTimelineEntry[];
}

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  itemId: string;
  eventId?: string;
  quantity: number;
  note?: string;
}

export interface ComboItem {
  itemId: string;
  quantity: number;
}

export interface ComboPackage {
  id: string;
  name: string;
  description: string;
  items: ComboItem[];
  packagePrice: number;
}

export interface QuotationLineItem {
  type: 'ITEM' | 'PACKAGE';
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Quotation {
  id: string;
  clientName: string;
  eventName: string;
  date: string;
  validUntil: string;
  items: QuotationLineItem[];
  discount: number;
  tax: number;
  totalAmount: number;
  note?: string;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED';
}

export interface LogActor {
  id: string;
  name: string;
  role: AccessRole;
  phone?: string;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'SUCCESS' | 'INFO' | 'WARNING' | 'ERROR';
  actor?: LogActor;
}

export type AccessRole = 'ADMIN' | 'MANAGER' | 'STAFF';

export type AccessPermission =
  | 'INVENTORY_EDIT'
  | 'INVENTORY_DELETE'
  | 'PACKAGES_EDIT'
  | 'PACKAGES_DELETE'
  | 'EVENTS_EDIT'
  | 'EVENTS_DELETE'
  | 'EMPLOYEES_EDIT'
  | 'EMPLOYEES_DELETE'
  | 'QUOTATIONS_EDIT'
  | 'QUOTATIONS_DELETE'
  | 'SALES_EDIT'
  | 'SALES_DELETE'
  | 'ELEARNING_EDIT'
  | 'ACCESS_MANAGE';

export interface UserAccount {
  id: string;
  name: string;
  phone: string;
  role: AccessRole;
  permissions: AccessPermission[];
  linkedEmployeeId?: string;
  isActive?: boolean;
  createdAt?: string;
}

export type LearningCategory = 'OPERATIONS' | 'CONTENT' | 'SALES' | 'LOGISTICS' | 'LEADERSHIP';

export type LearningQuestionType = 'MULTIPLE_CHOICE' | 'OPEN';

export interface LearningQuestion {
  id: string;
  prompt: string;
  type: LearningQuestionType;
  options?: string[];
  correctOption?: number;
  answerGuide?: string;
  answerKeywords?: string[];
  maxScore?: number;
}

export interface LearningLesson {
  id: string;
  title: string;
  videoUrl: string;
  duration?: string;
  summary: string;
  skills: string[];
  questions: LearningQuestion[];
}

export interface LearningTrack {
  id: string;
  title: string;
  description: string;
  focus: LearningCategory;
  level: 'BASE' | 'ADVANCED' | 'MASTER';
  badge: string;
  requirements?: {
    minTenureMonths?: number;
    minEvents?: number;
    minScore?: number;
    minScenarioScore?: number;
    mandatoryRoles?: string[];
    requiredLessons?: string[];
  };
  lessons: LearningLesson[];
}

export interface LearningAttempt {
  id: string;
  learnerId: string;
  trackId: string;
  lessonId: string;
  questionId: string;
  type: LearningQuestionType;
  selectedOption?: number;
  answerText?: string;
  score: number;
  feedback: string;
  createdAt: string;
}

export interface LearningProfile {
  id: string;
  name: string;
  employeeId?: string;
  tenureMonths: number;
  eventsAttended: number;
  scenarioScore: number;
  roleHistory: string[];
  badges?: string[];
  currentRank?: string;
  completedLessons?: string[];
  preferredTracks?: string[];
}

export interface CareerRank {
  id: string;
  name: string;
  minTenureMonths: number;
  minEvents: number;
  minAvgScore: number;
  mandatoryRoles?: string[];
  benefits: string[];
}

export interface ActiveSession {
  id: string;
  userId: string;
  userName: string;
  role: AccessRole;
  phone?: string;
  deviceId?: string;
  lastSeen: string;
  online?: boolean;
}

export interface AppState {
  inventory: InventoryItem[];
  events: Event[];
  transactions: Transaction[];
  packages: ComboPackage[];
  employees: Employee[];
  quotations: Quotation[];
  saleItems?: SaleItem[];
  saleOrders?: SaleOrder[];
  logs: LogEntry[];
  inventoryReceipts?: InventoryReceipt[];
  learningTracks?: LearningTrack[];
  learningProfiles?: LearningProfile[];
  learningAttempts?: LearningAttempt[];
  careerRanks?: CareerRank[];
  userAccounts?: UserAccount[];
}
