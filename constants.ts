
import { InventoryItem, Event, Transaction, EventStatus, TransactionType, ComboPackage, Employee } from './types';

export const MOCK_INVENTORY: InventoryItem[] = [
  {
    id: 'ITEM-001',
    name: 'Màn hình LED P3.91 Indoor',
    category: 'Hình ảnh',
    description: 'Cabinet 500x500mm, độ sáng cao, phù hợp sự kiện trong nhà.',
    imageUrl: 'https://picsum.photos/200/200?random=1',
    totalQuantity: 100,
    availableQuantity: 78,
    inUseQuantity: 20,
    maintenanceQuantity: 0,
    brokenQuantity: 2,
    lostQuantity: 0,
    location: 'Kho A - Kệ 1',
    rentalPrice: 500000 // 500k per m2/event
  },
  {
    id: 'ITEM-002',
    name: 'Loa JBL VRX932LA-1',
    category: 'Âm thanh',
    description: 'Line Array Speaker 12 inch Two-Way.',
    imageUrl: 'https://picsum.photos/200/200?random=2',
    totalQuantity: 24,
    availableQuantity: 24,
    inUseQuantity: 0,
    maintenanceQuantity: 0,
    brokenQuantity: 0,
    lostQuantity: 0,
    location: 'Kho B - Kệ 2',
    rentalPrice: 800000
  },
  {
    id: 'ITEM-003',
    name: 'Đèn Moving Head Beam 230W',
    category: 'Ánh sáng',
    description: 'Đèn Beam chuyên dụng cho sân khấu ca nhạc.',
    imageUrl: 'https://picsum.photos/200/200?random=3',
    totalQuantity: 50,
    availableQuantity: 38,
    inUseQuantity: 5,
    maintenanceQuantity: 5,
    brokenQuantity: 2,
    lostQuantity: 0,
    location: 'Kho A - Kệ 3',
    rentalPrice: 300000
  },
  {
    id: 'ITEM-004',
    name: 'Micro Shure UR4D',
    category: 'Âm thanh',
    description: 'Bộ thu phát micro không dây chuyên nghiệp.',
    imageUrl: 'https://picsum.photos/200/200?random=4',
    totalQuantity: 10,
    availableQuantity: 8,
    inUseQuantity: 2,
    maintenanceQuantity: 0,
    brokenQuantity: 0,
    lostQuantity: 0,
    location: 'Tủ thiết bị nhỏ',
    rentalPrice: 200000
  },
  {
    id: 'ITEM-005',
    name: 'Máy tạo khói 3000W',
    category: 'Hiệu ứng',
    description: 'Máy phun khói công suất lớn, DMX control.',
    imageUrl: 'https://picsum.photos/200/200?random=5',
    totalQuantity: 4,
    availableQuantity: 3,
    inUseQuantity: 0,
    maintenanceQuantity: 0,
    brokenQuantity: 0,
    lostQuantity: 1,
    location: 'Kho C - Sàn',
    rentalPrice: 400000
  }
];

export const MOCK_PACKAGES: ComboPackage[] = [
  {
    id: 'PKG-001',
    name: 'Gói Âm Thanh Hội Thảo Cơ Bản',
    description: 'Gói chuẩn cho 100 khách, bao gồm 2 loa, 2 mic và phụ kiện.',
    packagePrice: 2500000, // Giá gói ưu đãi
    items: [
      { itemId: 'ITEM-002', quantity: 2 },
      { itemId: 'ITEM-004', quantity: 2 }
    ]
  },
  {
    id: 'PKG-002',
    name: 'Gói Ánh Sáng Sân Khấu Tiệc Cưới',
    description: '8 đèn Beam, 1 máy khói, trọn gói setup.',
    packagePrice: 5000000,
    items: [
      { itemId: 'ITEM-003', quantity: 8 },
      { itemId: 'ITEM-005', quantity: 1 }
    ]
  }
];

export const MOCK_EMPLOYEES: Employee[] = [
  {
    id: 'EMP-001',
    name: 'Nguyễn Văn A',
    role: 'Kỹ thuật Âm thanh',
    phone: '0901234567',
    email: 'nguyenvana@example.com',
    baseRate: 500000,
    avatarUrl: 'https://ui-avatars.com/api/?name=Nguyen+Van+A&background=random'
  }
];

export const MOCK_EVENTS: Event[] = [];
export const MOCK_TRANSACTIONS: Transaction[] = [];
