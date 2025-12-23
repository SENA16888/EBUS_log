

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
  location: string;
  rentalPrice: number;
  // Bổ sung quản lý nhập hàng/sản xuất
  purchaseLink?: string; 
  minStock?: number;
  productionNote?: string;
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
  name: string;
  price: number;
  quantity: number;
}

export interface SaleOrder {
  id: string;
  date: string;
  customerName: string;
  customerContact?: string;
  items: SaleOrderLine[];
  total: number;
  note?: string;
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
}

export interface EventExpense {
  id: string;
  category: 'TRANSPORT_GOODS' | 'TRANSPORT_STAFF' | 'ACCOMMODATION' | 'PRINTING' | 'CONSUMABLES' | 'CATERING' | 'MISC';
  subCategory?: string; 
  description: string;
  amount: number;
}

export interface EventItemAllocation {
  itemId: string;
  quantity: number;
  returnedQuantity: number;
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
  items: EventItemAllocation[];
  staff?: EventStaffAllocation[];
  expenses?: EventExpense[];
  quotationId?: string; 
  isOrderCreated?: boolean; 
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

export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'SUCCESS' | 'INFO' | 'WARNING' | 'ERROR';
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
}