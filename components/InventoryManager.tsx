
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InventoryItem, InventoryReceipt, InventoryReceiptItem } from '../types';
import { 
  Search, X, Trash2, AlertTriangle, Wrench,
  ShoppingCart, Info, Settings2, Link as LinkIcon, CheckCircle, CalendarClock, Printer, History, FilePlus
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { findDuplicateBarcodeItem, generateBarcode, normalizeBarcode } from '../services/barcodeService';

const DEFAULT_CATEGORY = 'Khác';
const BASE_CATEGORY_SUGGESTIONS = ['STEM', 'Âm thanh', 'Ánh sáng', 'Hiệu ứng', 'Hình ảnh', 'Quảng cáo', 'CSVG'];

const BarcodePreview: React.FC<{ value?: string }> = ({ value }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!value || !svgRef.current) return;
    try {
      JsBarcode(svgRef.current, value, { format: 'CODE128', height: 40, width: 1.4, displayValue: false, margin: 0 });
    } catch (err) {
      console.warn('Không thể vẽ mã vạch', err);
    }
  }, [value]);

  if (!value) return null;

  return (
    <div className="flex flex-col items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
      <svg ref={svgRef} className="w-full max-w-[180px]"></svg>
      <span className="text-[11px] font-mono text-slate-600 tracking-widest">{value}</span>
    </div>
  );
};

interface InventoryManagerProps {
  inventory: InventoryItem[];
  receipts: InventoryReceipt[];
  onUpdateInventory: (item: InventoryItem) => void;
  onAddNewItem: (item: InventoryItem) => void;
  onDeleteItem: (itemId: string) => void;
  onStatusChange: (itemId: string, action: string, quantity: number, note: string) => void;
  onCreateReceipt: (payload: { source: string; note?: string; items: InventoryReceiptItem[] }) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canCreateReceipt?: boolean;
  isAdmin?: boolean;
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({ 
  inventory, 
  receipts,
  onUpdateInventory,
  onAddNewItem,
  onDeleteItem,
  onStatusChange,
  onCreateReceipt,
  canEdit = true,
  canDelete = true,
  canCreateReceipt = false,
  isAdmin = false
}) => {
  const createEmptyReceiptItem = (): (InventoryReceiptItem & { tempId: string }) => ({
    tempId: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    mode: 'EXISTING',
    lifecycle: 'DEPRECIATION',
    itemId: '',
    name: '',
    category: DEFAULT_CATEGORY,
    quantity: 1,
    consumableUnit: '',
    maxUsage: undefined,
    barcode: '',
    description: '',
    imageUrl: 'https://picsum.photos/200/200',
    rentalPrice: 0,
    purchaseLink: '',
    minStock: 5,
    productionNote: '',
    location: 'Kho tổng',
    plannedEta: ''
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  
  const [showImportModal, setShowImportModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  
  const [importMode, setImportMode] = useState<'NEW' | 'EDIT'>('NEW');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  
  const [statusItem, setStatusItem] = useState<InventoryItem | null>(null);
  const [statusType, setStatusType] = useState('TO_MAINTENANCE');
  const [statusQty, setStatusQty] = useState(1);
  const [statusNote, setStatusNote] = useState('');
  const [printSelections, setPrintSelections] = useState<{ itemId: string; quantity: number }[]>([]);
  const [printDraftItemId, setPrintDraftItemId] = useState('');
  const [printDraftQty, setPrintDraftQty] = useState(1);
  const [printPreviewUrl, setPrintPreviewUrl] = useState('');
  const [printLabelHeight, setPrintLabelHeight] = useState(22); // mm
  const [receiptSource, setReceiptSource] = useState('');
  const [receiptNote, setReceiptNote] = useState('');
  const [receiptItems, setReceiptItems] = useState<Array<InventoryReceiptItem & { tempId: string }>>([
    createEmptyReceiptItem()
  ]);

  const [newItemData, setNewItemData] = useState<{
    lifecycle: InventoryReceiptItem['lifecycle'];
    consumableUnit: string;
    maxUsage?: number;
    barcode: string;
    name: string;
    category: string;
    description: string;
    location: string;
    totalQuantity: number;
    imageUrl: string;
    rentalPrice: number;
    purchaseLink: string;
    minStock: number;
    productionNote: string;
    plannedPurchase: boolean;
    plannedQuantity: number;
    plannedEta: string;
  }>({
    lifecycle: 'DEPRECIATION',
    consumableUnit: '',
    maxUsage: 0,
    barcode: '',
    name: '',
    category: DEFAULT_CATEGORY,
    description: '',
    location: '',
    totalQuantity: 1,
    imageUrl: 'https://picsum.photos/200/200',
    rentalPrice: 0,
    purchaseLink: '',
    minStock: 5,
    productionNote: '',
    plannedPurchase: false,
    plannedQuantity: 0,
    plannedEta: ''
  });

  const categorySuggestions = useMemo(() => {
    const suggestionSet = new Set<string>([DEFAULT_CATEGORY, ...BASE_CATEGORY_SUGGESTIONS]);
    inventory.forEach(item => {
      if (item.category) {
        suggestionSet.add(item.category);
      }
    });
    return Array.from(suggestionSet);
  }, [inventory]);

  const categories = useMemo(() => {
    const categorySet = new Set<string>();
    inventory.forEach(item => {
      if (item.category) {
        categorySet.add(item.category);
      }
    });
    return ['All', ...Array.from(categorySet)];
  }, [inventory]);

  const recentReceipts = useMemo(() => receipts.slice(0, 5), [receipts]);

  useEffect(() => {
    if (!categories.includes(filterCategory)) {
      setFilterCategory('All');
    }
  }, [categories, filterCategory]);

  const filteredInventory = inventory.filter(item => {
    const needle = searchTerm.toLowerCase();
    const matchesSearch = item.name.toLowerCase().includes(needle) || 
                          item.id.toLowerCase().includes(needle) ||
                          (item.barcode || '').toLowerCase().includes(needle);
    const matchesCategory = filterCategory === 'All' || item.category === filterCategory;
    const isLowStock = item.availableQuantity <= (item.minStock || 0);
    const matchesLowStock = !showLowStockOnly || isLowStock;
    return matchesSearch && matchesCategory && matchesLowStock;
  });

  const getStatusMaxQty = (item: InventoryItem | null, type: string) => {
    if (!item) return 0;
    if (type === 'FIXED') return item.brokenQuantity || 0;
    if (type === 'DISPOSE') return (item.availableQuantity || 0) + (item.brokenQuantity || 0);
    return item.availableQuantity;
  };

  const statusMaxQty = getStatusMaxQty(statusItem, statusType);

  useEffect(() => {
    setStatusQty(prev => {
      if (statusMaxQty <= 0) return 0;
      const next = prev || 1;
      return Math.min(Math.max(1, next), statusMaxQty);
    });
  }, [statusMaxQty, statusType]);

  const generateBarcodeDataUrl = (value: string) => {
    const canvas = document.createElement('canvas');
    try {
      JsBarcode(canvas, value, { format: 'CODE128', height: 40, width: 1.6, displayValue: false, margin: 0 });
      return canvas.toDataURL('image/png');
    } catch (err) {
      console.warn('Không thể tạo ảnh barcode', err);
      return '';
    }
  };

  useEffect(() => {
    const first = printSelections[0];
    const target = first ? inventory.find(i => i.id === first.itemId) : undefined;
    if (target?.barcode) {
      setPrintPreviewUrl(generateBarcodeDataUrl(target.barcode));
    } else {
      setPrintPreviewUrl('');
    }
  }, [printSelections, inventory]);

  const handleOpenEdit = (e: React.MouseEvent, item: InventoryItem) => {
    if (!canEdit) return;
    e.preventDefault();
    e.stopPropagation();
    setEditingItemId(item.id);
    setNewItemData({
      lifecycle: item.lifecycle || 'DEPRECIATION',
      consumableUnit: item.consumableUnit || '',
      maxUsage: item.maxUsage ?? 0,
      barcode: item.barcode || '',
      name: item.name,
      category: item.category,
      description: item.description || '',
      location: item.location || '',
      totalQuantity: item.totalQuantity,
      imageUrl: item.imageUrl || 'https://picsum.photos/200/200',
      rentalPrice: item.rentalPrice || 0,
      purchaseLink: item.purchaseLink || '',
      minStock: item.minStock || 5,
      productionNote: item.productionNote || '',
      plannedPurchase: !!item.plannedPurchase,
      plannedQuantity: item.plannedQuantity || 0,
      plannedEta: item.plannedEta || ''
    });
    setImportMode('EDIT');
    setShowImportModal(true);
  };

  const handleOpenStatus = (e: React.MouseEvent, item: InventoryItem) => {
    if (!canEdit) return;
    e.preventDefault();
    e.stopPropagation();
    setStatusItem(item);
    setStatusType('TO_MAINTENANCE');
    setStatusQty(1);
    setStatusNote('');
    setShowStatusModal(true);
  }

  const handleDeleteClick = (e: React.MouseEvent, item: InventoryItem) => {
    if (!canDelete) return;
    e.preventDefault();
    e.stopPropagation();

    // Check if item is in use before allowing deletion
    if (item.inUseQuantity > 0) {
      alert(`KHÔNG THỂ XÓA:\n\nThiết bị "${item.name}" đang được sử dụng (${item.inUseQuantity} chiếc) tại sự kiện.\nVui lòng thu hồi thiết bị về kho trước khi xóa.`);
      return;
    }

    if (window.confirm(`XÁC NHẬN XÓA:\n\nBạn có chắc chắn muốn xóa vĩnh viễn thiết bị "${item.name}" khỏi kho?\nHành động này không thể hoàn tác.`)) {
      onDeleteItem(item.id);
    }
  };

  const handleAddNewSubmit = () => {
    if (!canEdit) return;
    if (!canCreateReceipt) {
      alert('Chỉ ADMIN được phép thêm thiết bị mới. Vui lòng tạo phiếu nhập kho.');
      return;
    }
    const name = newItemData.name.trim();
    if (!name) {
      alert("Vui lòng điền tên thiết bị");
      return;
    }
    if (!newItemData.category.trim()) {
      alert("Vui lòng nhập danh mục thiết bị");
      return;
    }
    const lifecycle = newItemData.lifecycle || 'DEPRECIATION';
    if (lifecycle === 'DEPRECIATION' && (!newItemData.maxUsage || Number(newItemData.maxUsage) <= 0)) {
      alert('Nhập số lần sử dụng tối đa cho thiết bị khấu hao.');
      return;
    }
    if (lifecycle === 'CONSUMABLE' && !newItemData.consumableUnit.trim()) {
      alert('Vui lòng nhập đơn vị tính cho hàng tiêu hao.');
      return;
    }
    const category = newItemData.category.trim();
    const finalBarcode = normalizeBarcode(newItemData.barcode) || generateBarcode(newItemData.name);
    const duplicateItem = findDuplicateBarcodeItem(inventory, finalBarcode);
    if (duplicateItem) {
      alert(`Mã barcode "${finalBarcode}" đã tồn tại cho thiết bị "${duplicateItem.name}". Vui lòng nhập mã khác để đảm bảo duy nhất.`);
      return;
    }
    const newItem: InventoryItem = {
      id: `ITEM-${Date.now()}`,
      barcode: finalBarcode,
      lifecycle,
      consumableUnit: lifecycle === 'CONSUMABLE' ? (newItemData.consumableUnit.trim() || undefined) : undefined,
      maxUsage: lifecycle === 'DEPRECIATION' ? Number(newItemData.maxUsage) : undefined,
      name,
      category,
      description: newItemData.description,
      location: newItemData.location || 'Kho tổng',
      totalQuantity: Number(newItemData.totalQuantity),
      availableQuantity: Number(newItemData.totalQuantity),
      inUseQuantity: 0,
      maintenanceQuantity: 0,
      brokenQuantity: 0,
      lostQuantity: 0,
      usageCount: 0,
      imageUrl: newItemData.imageUrl,
      rentalPrice: Number(newItemData.rentalPrice),
      purchaseLink: newItemData.purchaseLink,
      minStock: Number(newItemData.minStock),
      productionNote: newItemData.productionNote,
      plannedPurchase: newItemData.plannedPurchase,
      plannedQuantity: Number(newItemData.plannedQuantity) || 0,
      plannedEta: newItemData.plannedEta
    };
    onAddNewItem(newItem);
    setShowImportModal(false);
    resetForms();
  };

  const handleEditSubmit = () => {
    if (!canEdit) return;
    if (!editingItemId) return;
    const existingItem = inventory.find(i => i.id === editingItemId);
    if (!existingItem) return;
    const name = newItemData.name.trim();
    if (!name) {
      alert("Vui lòng điền tên thiết bị");
      return;
    }
    if (!newItemData.category.trim()) {
      alert("Vui lòng nhập danh mục thiết bị");
      return;
    }
    const lifecycle = newItemData.lifecycle || existingItem.lifecycle || 'DEPRECIATION';
    if (lifecycle === 'DEPRECIATION' && (!newItemData.maxUsage || Number(newItemData.maxUsage) <= 0)) {
      alert('Nhập số lần sử dụng tối đa cho thiết bị khấu hao.');
      return;
    }
    if (lifecycle === 'CONSUMABLE' && !newItemData.consumableUnit.trim()) {
      alert('Vui lòng nhập đơn vị tính cho hàng tiêu hao.');
      return;
    }
    const category = newItemData.category.trim();
    const editableBarcode = isAdmin ? normalizeBarcode(newItemData.barcode || '') : normalizeBarcode(existingItem.barcode || '');
    const finalBarcode = editableBarcode || generateBarcode(existingItem.name || category);
    const duplicateItem = findDuplicateBarcodeItem(inventory, finalBarcode, existingItem.id);
    if (duplicateItem) {
      alert(`Mã barcode "${finalBarcode}" đang được sử dụng bởi "${duplicateItem.name}".`);
      return;
    }
    const updatedItem: InventoryItem = {
      ...existingItem,
      barcode: finalBarcode,
      lifecycle,
      consumableUnit: lifecycle === 'CONSUMABLE' ? (newItemData.consumableUnit.trim() || undefined) : undefined,
      maxUsage: lifecycle === 'DEPRECIATION' ? Number(newItemData.maxUsage) : undefined,
      name,
      category,
      description: newItemData.description,
      location: newItemData.location,
      imageUrl: newItemData.imageUrl,
      rentalPrice: Number(newItemData.rentalPrice),
      purchaseLink: newItemData.purchaseLink,
      minStock: Number(newItemData.minStock),
      productionNote: newItemData.productionNote,
      plannedPurchase: newItemData.plannedPurchase,
      plannedQuantity: Number(newItemData.plannedQuantity) || 0,
      plannedEta: newItemData.plannedEta
    };
    onUpdateInventory(updatedItem);
    setShowImportModal(false);
    resetForms();
  };

  const handleOpenPrintModal = (item?: InventoryItem) => {
    const defaultItemId = item?.id || inventory.find(i => i.barcode)?.id || '';
    const initialSelection = defaultItemId ? [{ itemId: defaultItemId, quantity: 1 }] : [];
    setPrintSelections(initialSelection);
    setPrintDraftItemId('');
    setPrintDraftQty(1);
    setShowPrintModal(true);
  };

  const handleAddPrintSelection = () => {
    const itemId = printDraftItemId || printSelections[0]?.itemId || '';
    const target = inventory.find(i => i.id === itemId);
    if (!target) {
      alert('Vui lòng chọn thiết bị.');
      return;
    }
    if (!normalizeBarcode(target.barcode || '')) {
      alert('Thiết bị chưa có barcode. Vui lòng cập nhật barcode trước khi in.');
      return;
    }
    const qty = Math.max(1, Math.round(printDraftQty || 1));
    setPrintSelections(prev => {
      const idx = prev.findIndex(p => p.itemId === itemId);
      if (idx > -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: qty };
        return next;
      }
      return [...prev, { itemId, quantity: qty }];
    });
    setPrintDraftItemId('');
    setPrintDraftQty(1);
  };

  const handlePrintLabels = () => {
    if (!printSelections.length) {
      alert('Vui lòng thêm thiết bị cần in.');
      return;
    }

    const itemsMap: Record<string, InventoryItem> = {};
    inventory.forEach(i => { itemsMap[i.id] = i; });

    const missingBarcode = printSelections.filter(sel => !normalizeBarcode(itemsMap[sel.itemId]?.barcode || ''));
    if (missingBarcode.length) {
      alert('Một số thiết bị chưa có barcode, vui lòng cập nhật trước khi in.');
      return;
    }

    const labelChunks: string[] = [];
    printSelections.forEach(sel => {
      const target = itemsMap[sel.itemId];
      if (!target) return;
      const code = normalizeBarcode(target.barcode || '');
      const safeQty = Math.min(500, Math.max(1, Math.round(sel.quantity || 1)));
      const barcodeImg = generateBarcodeDataUrl(code);
      if (!barcodeImg) return;
      const safeName = (target.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');

      const labels = Array.from({ length: safeQty }).map(() => `
        <div class="label">
          <div class="label__name">${safeName}</div>
          <img src="${barcodeImg}" alt="${safeCode}" />
          <div class="label__code">${safeCode}</div>
        </div>
      `).join('');
      labelChunks.push(labels);
    });

    if (!labelChunks.length) {
      alert('Không thể tạo tem in (có thể mã barcode không hợp lệ).');
      return;
    }

    const labelHtml = labelChunks.join('');
    const totalLabels = printSelections.reduce(
      (sum, sel) => sum + Math.min(500, Math.max(1, Math.round(sel.quantity || 1))),
      0
    );
    const titleItem = itemsMap[printSelections[0]?.itemId || ''];
    const titleName = titleItem?.name || 'In tem barcode';
    const safeLabelHeight = Math.min(40, Math.max(16, Number.isFinite(printLabelHeight) ? printLabelHeight : 22));

    const printWindow = window.open('', '_blank', 'width=420,height=680');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>In tem: ${titleName}</title>
          <style>
            /* Khổ 2 tem/row: 35x22mm mỗi tem. Trang rộng 74mm, 2 cột, khoảng cách hàng 3mm, cột 4mm. */
            @page { size: 74mm auto; margin: 1mm; }
            * { box-sizing: border-box; }
            body { margin: 0; padding: 0; font-family: Arial, sans-serif; background: #f8fafc; }
            .sheet {
              width: 74mm;
              display: grid;
              grid-template-columns: repeat(2, 35mm);
              column-gap: 4mm;
              row-gap: 3mm;
              padding: 1mm 0 1mm 2mm; /* chừa 2mm trái để đủ 74mm */
            }
            .label {
              width: 35mm;
              height: ${safeLabelHeight}mm;
              padding: 1.5mm 1mm 1mm;
              background: white;
              border: 1px dashed #e2e8f0;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              overflow: hidden;
            }
            .label__name {
              width: 100%;
              font-size: 8.5px;
              font-weight: 700;
              text-align: center;
              line-height: 1.2;
              margin-bottom: 1mm;
              padding: 0 2mm;
            }
            .label img {
              width: 100%;
              max-height: ${Math.max(6, Math.round(safeLabelHeight - 10))}mm;
              object-fit: contain;
            }
            .label__code {
              font-family: monospace;
              font-size: 8px;
              letter-spacing: 0.12em;
              text-align: center;
              margin-top: 1mm;
              white-space: nowrap;
            }
            .status {
              position: fixed;
              top: 6px;
              right: 6px;
              background: rgba(15, 23, 42, 0.9);
              color: white;
              padding: 6px 10px;
              border-radius: 8px;
              font-size: 11px;
              z-index: 10;
            }
            @media print {
              body { background: white; }
              .sheet { column-gap: 4mm; row-gap: 3mm; padding: 1mm 0 1mm 2mm; }
              .label { border: none; }
              .status { display: none; }
            }
          </style>
        </head>
        <body>
          <div id="status" class="status">Đang tải tem (${totalLabels})...</div>
          <div class="sheet">
            ${labelHtml}
          </div>
          <script>
            const waitImages = () => {
              const imgs = Array.from(document.querySelectorAll('img'));
              return Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => {
                img.onload = () => res(null);
                img.onerror = () => res(null);
              })));
            };
            waitImages().then(() => {
              const s = document.getElementById('status');
              if (s) s.style.display = 'none';
              window.print();
              setTimeout(() => window.close(), 400);
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
  };

  const handleReceiptItemChange = (tempId: string, changes: Partial<InventoryReceiptItem>) => {
    setReceiptItems(prev => prev.map(item => item.tempId === tempId ? { ...item, ...changes } : item));
  };

  const handleSelectExistingForReceipt = (tempId: string, itemId: string) => {
    const found = inventory.find(i => i.id === itemId);
    setReceiptItems(prev => prev.map(item => {
      if (item.tempId !== tempId) return item;
      if (!found) return { ...item, itemId };
      return {
        ...item,
        mode: 'EXISTING',
        itemId,
        name: found.name,
        lifecycle: found.lifecycle || 'DEPRECIATION',
        consumableUnit: found.consumableUnit || item.consumableUnit,
        maxUsage: typeof found.maxUsage === 'number' ? found.maxUsage : item.maxUsage,
        category: found.category || item.category,
        quantity: item.quantity || 1,
        barcode: found.barcode || item.barcode,
        location: found.location || 'Kho tổng',
        rentalPrice: found.rentalPrice ?? item.rentalPrice,
        purchaseLink: found.purchaseLink || item.purchaseLink,
        minStock: typeof found.minStock === 'number' ? found.minStock : item.minStock,
        productionNote: found.productionNote || item.productionNote,
        description: found.description || item.description,
        imageUrl: found.imageUrl || item.imageUrl
      };
    }));
  };

  const handleReceiptModeChange = (tempId: string, mode: InventoryReceiptItem['mode']) => {
    setReceiptItems(prev => prev.map(item => {
      if (item.tempId !== tempId) return item;
      if (mode === 'EXISTING') {
        const found = item.itemId ? inventory.find(i => i.id === item.itemId) : undefined;
        return {
          ...item,
          mode,
          name: found?.name || '',
          barcode: found?.barcode || '',
          category: found?.category || item.category,
          lifecycle: found?.lifecycle || 'DEPRECIATION',
          consumableUnit: found?.consumableUnit || item.consumableUnit,
          maxUsage: typeof found?.maxUsage === 'number' ? found.maxUsage : item.maxUsage,
          location: found?.location || 'Kho tổng'
        };
      }
      if (mode === 'PLANNED') {
        return {
          ...item,
          mode,
          itemId: '',
          name: '',
          barcode: '',
          lifecycle: 'DEPRECIATION',
          consumableUnit: '',
          maxUsage: item.maxUsage ?? 0,
          category: DEFAULT_CATEGORY,
          location: 'Kho tổng',
          quantity: item.quantity || 0
        };
      }
      return {
        ...item,
        mode: 'NEW',
        itemId: '',
        name: '',
        barcode: '',
        lifecycle: 'DEPRECIATION',
        consumableUnit: '',
        maxUsage: item.maxUsage ?? 0,
        category: DEFAULT_CATEGORY,
        location: 'Kho tổng'
      };
    }));
  };

  const handleAddReceiptLine = () => setReceiptItems(prev => [...prev, createEmptyReceiptItem()]);

  const handleRemoveReceiptLine = (tempId: string) => {
    setReceiptItems(prev => prev.length > 1 ? prev.filter(item => item.tempId !== tempId) : prev);
  };

  const resetReceiptForm = () => {
    setReceiptSource('');
    setReceiptNote('');
    setReceiptItems([createEmptyReceiptItem()]);
  };

  const handleSubmitReceipt = () => {
    if (!canCreateReceipt) {
      alert('Chỉ ADMIN được phép lập phiếu nhập kho.');
      return;
    }
    const trimmedSource = receiptSource.trim();
    if (!trimmedSource) {
      alert('Vui lòng nhập nguồn gốc/đường link cho phiếu.');
      return;
    }
    const errors: string[] = [];
    const payloadItems: InventoryReceiptItem[] = receiptItems.map((item, idx) => {
      const qty = item.mode === 'PLANNED' ? Math.max(0, Math.round(item.quantity || 0)) : Math.max(1, Math.round(item.quantity || 0));
      const found = item.itemId ? inventory.find(i => i.id === item.itemId) : undefined;
      const lifecycle = (item.lifecycle || found?.lifecycle || 'DEPRECIATION') as InventoryReceiptItem['lifecycle'];
      const unit = (item.consumableUnit || found?.consumableUnit || '').trim();
      const maxUsage = lifecycle === 'DEPRECIATION'
        ? (typeof item.maxUsage === 'number' ? item.maxUsage : found?.maxUsage)
        : undefined;

      if (lifecycle === 'DEPRECIATION' && (!maxUsage || maxUsage <= 0)) {
        errors.push(`Nhập số lần sử dụng tối đa cho dòng ${idx + 1}.`);
        return null;
      }
      if (lifecycle === 'CONSUMABLE' && !unit) {
        errors.push(`Điền đơn vị tính cho dòng ${idx + 1}.`);
        return null;
      }

      if (item.mode === 'EXISTING') {
        if (!item.itemId) {
          errors.push(`Chọn thiết bị có sẵn cho dòng ${idx + 1}.`);
          return null;
        }
        return {
          mode: 'EXISTING',
          lifecycle,
          consumableUnit: unit || undefined,
          maxUsage: lifecycle === 'DEPRECIATION' ? maxUsage : undefined,
          itemId: item.itemId,
          name: found?.name || item.name,
          category: found?.category || item.category || DEFAULT_CATEGORY,
          quantity: qty,
          barcode: found?.barcode || item.barcode,
          description: item.description || found?.description,
          imageUrl: found?.imageUrl || item.imageUrl,
          rentalPrice: typeof item.rentalPrice === 'number' ? item.rentalPrice : found?.rentalPrice,
          purchaseLink: item.purchaseLink || found?.purchaseLink,
          minStock: typeof item.minStock === 'number' ? item.minStock : found?.minStock,
          productionNote: item.productionNote || found?.productionNote,
          location: item.location || found?.location || 'Kho tổng',
          plannedEta: item.plannedEta
        };
      }
      if (!item.name.trim()) {
        errors.push(`Điền tên thiết bị mới ở dòng ${idx + 1}.`);
        return null;
      }
      return {
        mode: item.mode === 'PLANNED' ? 'PLANNED' : 'NEW',
        lifecycle,
        consumableUnit: unit || undefined,
        maxUsage: lifecycle === 'DEPRECIATION' ? maxUsage : undefined,
        itemId: item.itemId,
        name: item.name.trim(),
        category: item.category || DEFAULT_CATEGORY,
        quantity: qty,
        barcode: item.barcode,
        description: item.description,
        imageUrl: item.imageUrl,
        rentalPrice: item.rentalPrice,
        purchaseLink: item.purchaseLink,
        minStock: item.minStock,
        productionNote: item.productionNote,
        location: item.location,
        plannedEta: item.plannedEta
      };
    }).filter(Boolean) as InventoryReceiptItem[];
    if (errors.length) {
      alert(errors.join('\n'));
      return;
    }
    if (!payloadItems.length) {
      alert('Vui lòng thêm ít nhất 1 thiết bị hợp lệ.');
      return;
    }
    onCreateReceipt({ source: trimmedSource, note: receiptNote.trim(), items: payloadItems });
    setShowReceiptModal(false);
    resetReceiptForm();
  };

  const handleStatusSubmit = () => {
    if (!canEdit) return;
    if (!statusItem) return;
    if (statusQty <= 0) return;

    const maxAllowed = getStatusMaxQty(statusItem, statusType);
    if (maxAllowed <= 0) {
      if (statusType === 'FIXED') {
        alert('Chưa có thiết bị hỏng để sửa.');
      } else if (statusType === 'DISPOSE') {
        alert('Không còn số lượng khả dụng hoặc hỏng để thanh lý.');
      }
      return;
    }
    if (statusQty > maxAllowed) {
      alert(`Số lượng tối đa cho thao tác này là ${maxAllowed}.`);
      return;
    }
    onStatusChange(statusItem.id, statusType, statusQty, statusNote);
    setShowStatusModal(false);
    setStatusItem(null);
  };

  const resetForms = () => {
    setNewItemData({
      lifecycle: 'DEPRECIATION',
      consumableUnit: '',
      maxUsage: 0,
      barcode: '',
      name: '', category: DEFAULT_CATEGORY, description: '', location: '', totalQuantity: 1,
      imageUrl: 'https://picsum.photos/200/200', rentalPrice: 0, purchaseLink: '',
      minStock: 5, productionNote: '', plannedPurchase: false, plannedQuantity: 0, plannedEta: ''
    });
    setEditingItemId(null);
    setImportMode('NEW');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Hệ Thống Kho Thiết Bị</h2>
          <p className="text-sm text-slate-500 font-medium leading-snug">Quản lý nhập xuất, bảo trì và mua sắm bổ sung. Mọi bổ sung kho phải đi qua phiếu nhập có nguồn gốc.</p>
        </div>
        <div className="flex flex-col gap-2 w-full sm:w-auto items-stretch sm:items-end">
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={() => handleOpenPrintModal()} className="flex-1 sm:flex-none bg-white text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-100 transition flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest shadow-md">
              <Printer size={16} /> In mã
            </button>
            {canCreateReceipt && (
              <button
                onClick={() => { resetReceiptForm(); setShowReceiptModal(true); }}
                className="flex-1 sm:flex-none bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest shadow-md"
              >
                <FilePlus size={16} /> Phiếu nhập kho
              </button>
            )}
          </div>
          {!canCreateReceipt && (
            <p className="text-[11px] text-slate-400 text-left sm:text-right">Chỉ ADMIN được phép lập phiếu nhập kho.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3.5">
        <div className="lg:col-span-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input type="text" placeholder="Tìm tên thiết bị, mã SP..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-3 py-2.5 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 text-sm" />
          </div>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="border border-slate-100 rounded-xl py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 text-[11px] font-black uppercase">
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setShowLowStockOnly(prev => !prev)}
          aria-pressed={showLowStockOnly}
          title={showLowStockOnly ? 'Bỏ lọc sắp hết hàng' : 'Lọc sắp hết hàng'}
          className={`p-4 rounded-2xl border flex items-center gap-3 text-white shadow-md transition ${
            showLowStockOnly ? 'bg-orange-600 border-orange-500 ring-2 ring-orange-200' : 'bg-orange-500 border-orange-400 hover:bg-orange-600'
          }`}
        >
          <AlertTriangle size={20} />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Sắp hết hàng</p>
            <p className="text-xl font-black leading-none">{inventory.filter(i => i.availableQuantity <= (i.minStock || 0)).length} mã</p>
          </div>
        </button>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lịch sử phiếu nhập</p>
            <h3 className="text-lg font-black text-slate-800">Phiếu nhập gần đây</h3>
            <p className="text-sm text-slate-500">Ghi lại nguồn gốc, người lập và danh mục thiết bị nhập kho.</p>
          </div>
          {canCreateReceipt && (
            <button
              onClick={() => { resetReceiptForm(); setShowReceiptModal(true); }}
              className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border border-blue-100 hover:bg-blue-100 transition"
            >
              Lập phiếu
            </button>
          )}
        </div>
        {recentReceipts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Chưa có phiếu nhập kho nào. Khi nhập mới, hãy tạo phiếu và lưu nguồn gốc.</p>
        ) : (
          <div className="mt-3 space-y-3 max-h-72 overflow-y-auto pr-1">
            {recentReceipts.map(receipt => (
              <div key={receipt.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50/70">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                      <History size={16} />
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{receipt.code}</p>
                      <p className="text-sm font-bold text-slate-800 line-clamp-1">{receipt.source}</p>
                      <p className="text-[11px] text-slate-500">{new Date(receipt.createdAt).toLocaleString('vi-VN')}</p>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-500 font-semibold">
                    <p className="text-sm font-black text-blue-600">{receipt.items.length} dòng</p>
                    <p>Người lập: {receipt.createdBy?.name || 'ADMIN'}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {receipt.items.slice(0, 4).map(it => (
                    <span key={`${receipt.id}-${it.itemId || it.name}`} className="px-2 py-1 rounded-full text-[11px] font-bold border border-slate-200 bg-white text-slate-700">
                      {it.name || 'Thiết bị mới'} • {it.mode === 'PLANNED' ? `ảo ${it.quantity || 0}` : `+${it.quantity} ${it.mode === 'NEW' ? 'mới' : 'bổ sung'}`}
                    </span>
                  ))}
                  {receipt.items.length > 4 && (
                    <span className="px-2 py-1 rounded-full text-[10px] font-bold border border-slate-200 bg-slate-100 text-slate-600">
                      +{receipt.items.length - 4} dòng khác
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 pb-16">
        {filteredInventory.map(item => {
          const lifecycle = item.lifecycle === 'CONSUMABLE' ? 'CONSUMABLE' : 'DEPRECIATION';
          const isLowStock = item.availableQuantity <= (item.minStock || 0);
          const usageCapacity = lifecycle === 'DEPRECIATION' && item.maxUsage ? item.maxUsage * Math.max(1, item.totalQuantity) : null;
          const remainingUsage = usageCapacity !== null ? Math.max(0, usageCapacity - (item.usageCount || 0)) : null;
          return (
            <div key={item.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-lg transition-all duration-300 group relative flex flex-col ${isLowStock ? 'border-orange-200' : 'border-slate-100 hover:border-blue-100'}`}>
              
              {/* ACTION BUTTONS: Increased Z-Index to 50 to ensure clickability */}
              <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-50 opacity-0 group-hover:opacity-100 transition-all transform translate-x-3 group-hover:translate-x-0">
                 {canEdit && (
                   <button onClick={(e) => handleOpenStatus(e, item)} title="Bảo trì / Báo hỏng" className="p-2 bg-white/95 backdrop-blur shadow text-slate-700 rounded-xl hover:text-orange-500 transition-colors"><Wrench size={16} /></button>
                 )}
                 <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOpenPrintModal(item); }} title="In tem mã vạch" className="p-2 bg-white/95 backdrop-blur shadow text-slate-700 rounded-xl hover:text-slate-900 transition-colors"><Printer size={16} /></button>
                 {canEdit && (
                   <button onClick={(e) => handleOpenEdit(e, item)} title="Chỉnh sửa thông tin" className="p-2 bg-white/95 backdrop-blur shadow text-slate-700 rounded-xl hover:text-blue-600 transition-colors"><Settings2 size={16} /></button>
                 )}
                 {canDelete && (
                   <button onClick={(e) => handleDeleteClick(e, item)} title="Xóa thiết bị" className="p-2 bg-white/95 backdrop-blur shadow text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={16} /></button>
                 )}
              </div>

              <div className="relative h-40 bg-slate-100 overflow-hidden">
                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest">{item.category}</div>
                {isLowStock && <div className="absolute bottom-4 left-4 bg-red-600 text-white text-[9px] font-black px-3 py-1.5 rounded-full shadow-xl animate-pulse uppercase tracking-widest">Cảnh báo tồn kho</div>}
                {item.plannedPurchase && (
                  <div className="absolute bottom-4 right-4 bg-amber-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow uppercase tracking-widest flex items-center gap-1">
                    <CalendarClock size={12}/> Dự kiến {item.plannedQuantity || 0}{item.plannedEta ? ` • ${item.plannedEta}` : ''}
                  </div>
                )}
              </div>

              <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-black text-slate-800 text-sm leading-snug line-clamp-2 h-10 mb-2.5">{item.name}</h3>
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${lifecycle === 'CONSUMABLE' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                    {lifecycle === 'CONSUMABLE' ? 'Tiêu hao' : 'Khấu hao'}
                  </span>
                  {lifecycle === 'CONSUMABLE' && item.consumableUnit && (
                    <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-white border border-amber-200 text-amber-700">
                      Đơn vị: {item.consumableUnit}
                    </span>
                  )}
                  {usageCapacity !== null && remainingUsage !== null && (
                    <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-blue-50 border border-blue-100 text-blue-700">
                      Còn {remainingUsage}/{usageCapacity} lượt
                    </span>
                  )}
                  {usageCapacity !== null && remainingUsage !== null && remainingUsage <= 0 && (
                    <span className="px-2 py-1 rounded-full text-[10px] font-black bg-red-50 border border-red-200 text-red-700">
                      Hết khấu hao
                    </span>
                  )}
                </div>
                <div className="space-y-3 flex-1">
                  <div className="flex justify-between items-end">
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sẵn kho</p>
                       <p className={`text-xl font-black ${isLowStock ? 'text-orange-600' : 'text-blue-600'}`}>{item.availableQuantity}<span className="text-xs text-slate-300 font-medium ml-1">/ {item.totalQuantity}</span></p>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giá thuê</p>
                       <p className="text-sm font-black text-slate-700">{(item.rentalPrice || 0).toLocaleString()}đ</p>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                    <div className="bg-blue-500 h-full transition-all duration-700" style={{ width: `${(item.availableQuantity / item.totalQuantity) * 100}%` }} />
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100 text-[11px] font-bold text-slate-600 truncate uppercase tracking-tighter">
                    {item.location || 'Chưa định vị'}
                  </div>

                  <div className="flex items-center justify-between bg-blue-50 border border-blue-100 p-2 rounded-xl text-[11px] font-bold text-blue-700">
                    <div className="flex items-center gap-2">
                      <History size={14} />
                      <span>Đã sử dụng</span>
                    </div>
                    <span className="text-sm text-slate-800">
                      {(item.usageCount || 0).toLocaleString()} lần
                      {usageCapacity !== null ? ` / ${usageCapacity.toLocaleString()}` : ''}
                    </span>
                  </div>

                  {item.barcode && (
                    <div className="bg-white border border-slate-200 rounded-xl p-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mã barcode</p>
                        <p className="text-sm font-mono text-slate-700">{item.barcode}</p>
                      </div>
                      <BarcodePreview value={item.barcode} />
                    </div>
                  )}
                  
                  {/* Status Indicators */}
                  {(item.maintenanceQuantity > 0 || item.brokenQuantity > 0 || item.lostQuantity > 0) && (
                    <div className="flex gap-1 flex-wrap">
                      {item.maintenanceQuantity > 0 && <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-[10px] font-bold">Bảo trì: {item.maintenanceQuantity}</span>}
                      {item.brokenQuantity > 0 && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">Hỏng: {item.brokenQuantity}</span>}
                      {item.lostQuantity > 0 && <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-[10px] font-bold">Mất: {item.lostQuantity}</span>}
                    </div>
                  )}
                  {item.plannedPurchase && (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 p-3 rounded-2xl text-[11px] font-bold text-amber-700">
                      <CalendarClock size={14}/> Dự kiến mua: {item.plannedQuantity || 0} {item.plannedEta ? `• ${item.plannedEta}` : ''}
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-100 flex gap-2 mt-auto">
                    {item.purchaseLink ? (
                      <button onClick={(e) => { e.stopPropagation(); window.open(item.purchaseLink, '_blank'); }} className="flex-1 bg-orange-100 text-orange-600 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-orange-600 hover:text-white transition-all shadow-sm">
                        <ShoppingCart size={12} /> Mua bổ sung
                      </button>
                    ) : (
                      <div className="flex-1 bg-slate-50 text-slate-300 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2">
                        <LinkIcon size={12} /> Chưa có link
                      </div>
                    )}
                    {item.productionNote && (
                      <button onClick={(e) => { e.stopPropagation(); alert(`THÔNG TIN SẢN XUẤT:\n\n${item.productionNote}`); }} className="p-2.5 bg-blue-50 text-blue-500 rounded-xl hover:bg-blue-500 hover:text-white transition-all">
                        <Info size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* --- MODALS SECTION --- */}

      {/* 1. Modal Thêm/Sửa Thiết Bị */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
            <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
               <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">{importMode === 'EDIT' ? 'Cập Nhật Thiết Bị' : 'Khai Báo Thiết Bị Mới'}</h3>
               <button onClick={() => setShowImportModal(false)} className="p-3 hover:bg-slate-200 rounded-full transition-colors"><X size={24}/></button>
            </div>
            <div className="p-8 overflow-y-auto space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tên thiết bị *</label>
                  <input type="text" className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none" value={newItemData.name} onChange={(e) => setNewItemData({...newItemData, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Danh mục</label>
                  <input
                    list="inventory-category-options"
                    type="text"
                    className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold bg-white"
                    placeholder="Nhập hoặc chọn danh mục"
                    value={newItemData.category}
                    onChange={(e) => setNewItemData({ ...newItemData, category: e.target.value })}
                  />
                  <datalist id="inventory-category-options">
                    {categorySuggestions.map(cat => <option key={cat} value={cat} />)}
                  </datalist>
                  <p className="text-[10px] text-slate-400 mt-1">Gõ để thêm danh mục mới hoặc chọn gợi ý sẵn có.</p>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Loại hàng *</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setNewItemData(prev => ({
                        ...prev,
                        lifecycle: 'DEPRECIATION',
                        maxUsage: prev.maxUsage && prev.maxUsage > 0 ? prev.maxUsage : 10
                      }))}
                      className={`px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest border-2 transition ${newItemData.lifecycle === 'DEPRECIATION' ? 'bg-slate-800 text-white border-slate-900 shadow' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                    >
                      Khấu hao
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewItemData(prev => ({
                        ...prev,
                        lifecycle: 'CONSUMABLE',
                        consumableUnit: prev.consumableUnit || 'cái',
                        maxUsage: undefined
                      }))}
                      className={`px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest border-2 transition ${newItemData.lifecycle === 'CONSUMABLE' ? 'bg-amber-500 text-white border-amber-600 shadow' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                    >
                      Tiêu hao
                    </button>
                  </div>
                  {newItemData.lifecycle === 'DEPRECIATION' ? (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                      <div className="md:col-span-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Số lần sử dụng tối đa</label>
                        <input
                          type="number"
                          min={1}
                          value={newItemData.maxUsage || ''}
                          onChange={e => setNewItemData({ ...newItemData, maxUsage: Number(e.target.value) })}
                          className="w-full border-2 border-slate-100 rounded-2xl p-4 text-xl font-black text-center"
                          placeholder="VD: 30 lần"
                        />
                      </div>
                      <div className="md:col-span-2 text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-2xl p-3">
                        Mỗi lần thiết bị được trả về từ sự kiện sẽ trừ 1 lần sử dụng. Khi hết lượt, hệ thống đánh dấu thiết bị đã hết khấu hao.
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                      <div className="md:col-span-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Đơn vị tính</label>
                        <input
                          type="text"
                          value={newItemData.consumableUnit}
                          onChange={e => setNewItemData({ ...newItemData, consumableUnit: e.target.value })}
                          className="w-full border-2 border-amber-100 rounded-2xl p-4 text-sm font-bold"
                          placeholder="VD: hộp, cái, bộ..."
                        />
                      </div>
                      <div className="md:col-span-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl p-3">
                        Hàng tiêu hao sẽ tự trừ tồn dựa trên số lượng xuất - số lượng kiểm về sau sự kiện.
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Mã barcode</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-mono tracking-widest disabled:bg-slate-50 disabled:text-slate-400"
                      placeholder="Để trống hệ thống tự tạo"
                      value={newItemData.barcode}
                      onChange={e => setNewItemData({ ...newItemData, barcode: e.target.value })}
                      disabled={importMode === 'EDIT' && !isAdmin}
                    />
                    <button
                      type="button"
                      onClick={() => setNewItemData(prev => ({ ...prev, barcode: generateBarcode(prev.name || prev.category) }))}
                      className="px-4 py-2 rounded-2xl bg-slate-800 text-white text-xs font-black uppercase tracking-widest hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={importMode === 'EDIT' && !isAdmin}
                    >
                      Tạo
                    </button>
                  </div>
                  {importMode === 'EDIT' && !isAdmin && (
                    <p className="text-[10px] text-amber-600 mt-1">Barcode đã được khóa sau khi tạo để tránh trùng lặp.</p>
                  )}
                  {importMode === 'EDIT' && isAdmin && (
                    <p className="text-[10px] text-emerald-600 mt-1">ADMIN có thể chỉnh sửa barcode, hệ thống sẽ kiểm tra trùng.</p>
                  )}
                  {newItemData.barcode && (
                    <div className="mt-2">
                      <BarcodePreview value={normalizeBarcode(newItemData.barcode)} />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tổng số lượng</label>
                  <input type="number" className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-black" value={newItemData.totalQuantity} onChange={(e) => setNewItemData({...newItemData, totalQuantity: Number(e.target.value)})} disabled={importMode === 'EDIT'} />
                  {importMode === 'EDIT' && <p className="text-[10px] text-blue-500 mt-1 italic">Dùng chức năng "Nhập thêm hàng" để tăng số lượng.</p>}
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Giá thuê (VNĐ)</label>
                  <input type="number" className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-black" value={newItemData.rentalPrice} onChange={(e) => setNewItemData({...newItemData, rentalPrice: Number(e.target.value)})} />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ngưỡng cảnh báo tồn</label>
                  <input type="number" className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-black" value={newItemData.minStock} onChange={(e) => setNewItemData({...newItemData, minStock: Number(e.target.value)})} />
                </div>

                <div className="md:col-span-2">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Link ảnh minh họa</label>
                   <input type="text" className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold" value={newItemData.imageUrl} onChange={(e) => setNewItemData({...newItemData, imageUrl: e.target.value})} />
                </div>
                <div className="md:col-span-2">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Link mua hàng / NCC</label>
                   <input type="text" className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold" value={newItemData.purchaseLink} onChange={(e) => setNewItemData({...newItemData, purchaseLink: e.target.value})} placeholder="https://..." />
                </div>
                <div className="md:col-span-2 border border-amber-100 rounded-2xl p-4 bg-amber-50/60">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Dự kiến mua (chưa nhập kho)</label>
                    <input
                      type="checkbox"
                      className="w-5 h-5 accent-amber-500"
                      checked={newItemData.plannedPurchase}
                      onChange={e => setNewItemData({ ...newItemData, plannedPurchase: e.target.checked })}
                    />
                  </div>
                  {newItemData.plannedPurchase && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                      <div>
                        <label className="block text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">Số lượng dự kiến</label>
                        <input
                          type="number"
                          className="w-full border border-amber-200 rounded-xl p-3 text-sm font-bold text-amber-700"
                          value={newItemData.plannedQuantity}
                          onChange={e => setNewItemData({ ...newItemData, plannedQuantity: Number(e.target.value) })}
                          min={0}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">Thời gian dự kiến</label>
                        <input
                          type="text"
                          className="w-full border border-amber-200 rounded-xl p-3 text-sm font-bold"
                          placeholder="VD: 12/2024 hoặc Tuần 1/12"
                          value={newItemData.plannedEta}
                          onChange={e => setNewItemData({ ...newItemData, plannedEta: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="md:col-span-2">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ghi chú kỹ thuật / Sản xuất</label>
                   <textarea rows={3} className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold" value={newItemData.productionNote} onChange={(e) => setNewItemData({...newItemData, productionNote: e.target.value})} placeholder="Kích thước, trọng lượng, lưu ý..." />
                </div>
              </div>
            </div>
            <div className="p-8 border-t bg-slate-50 flex justify-end gap-4">
               <button onClick={() => setShowImportModal(false)} className="px-6 py-3 text-slate-500 font-black uppercase tracking-widest text-xs hover:bg-slate-200 rounded-2xl">Hủy</button>
               <button onClick={importMode === 'NEW' ? handleAddNewSubmit : handleEditSubmit} className="px-10 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-200 hover:bg-blue-700">Xác nhận</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal Phiếu nhập kho */}
      {showReceiptModal && (
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden">
            <div className="flex items-start justify-between gap-3 p-6 border-b bg-slate-50">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phiếu nhập kho</p>
                <h3 className="text-2xl font-black text-slate-800">Tạo phiếu nhập kho</h3>
                <p className="text-sm text-slate-500">Bổ sung thiết bị mới hoặc tăng số lượng cho hàng có sẵn. Ghi rõ nguồn gốc để truy xuất.</p>
              </div>
              <button onClick={() => { setShowReceiptModal(false); resetReceiptForm(); }} className="p-2 rounded-xl hover:bg-slate-200">
                <X size={22}/>
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Nguồn gốc *</label>
                  <input
                    type="text"
                    value={receiptSource}
                    onChange={e => setReceiptSource(e.target.value)}
                    placeholder="Link NCC, hợp đồng, ghi chú nguồn..."
                    className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Ghi chú phiếu</label>
                  <input
                    type="text"
                    value={receiptNote}
                    onChange={e => setReceiptNote(e.target.value)}
                    placeholder="Thêm mô tả / nội dung thanh toán (tùy chọn)"
                    className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {receiptItems.map((line, idx) => (
                  <div key={line.tempId} className="border border-slate-100 rounded-xl p-4 bg-slate-50/60">
                    <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-1 rounded-full bg-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-widest">Dòng {idx + 1}</span>
                        <select
                          value={line.mode}
                          onChange={e => handleReceiptModeChange(line.tempId, e.target.value as InventoryReceiptItem['mode'])}
                          className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold bg-white"
                        >
                          <option value="EXISTING">Bổ sung thiết bị có sẵn</option>
                          <option value="NEW">Thêm thiết bị mới</option>
                          <option value="PLANNED">Nhập ảo (dự kiến mua/sản xuất)</option>
                        </select>
                    </div>
                    {receiptItems.length > 1 && (
                      <button onClick={() => handleRemoveReceiptLine(line.tempId)} className="text-xs text-red-500 font-bold hover:underline">Xóa dòng</button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Loại</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={line.mode === 'EXISTING'}
                        onClick={() => handleReceiptItemChange(line.tempId, {
                          lifecycle: 'DEPRECIATION',
                          maxUsage: line.maxUsage && line.maxUsage > 0 ? line.maxUsage : 10
                        })}
                        className={`px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest border transition ${line.lifecycle !== 'CONSUMABLE' ? 'bg-slate-800 text-white border-slate-900 shadow' : 'bg-white text-slate-600 border-slate-200'} ${line.mode === 'EXISTING' ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        Khấu hao
                      </button>
                      <button
                        type="button"
                        disabled={line.mode === 'EXISTING'}
                        onClick={() => handleReceiptItemChange(line.tempId, {
                          lifecycle: 'CONSUMABLE',
                          consumableUnit: line.consumableUnit || 'cái',
                          maxUsage: undefined
                        })}
                        className={`px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest border transition ${line.lifecycle === 'CONSUMABLE' ? 'bg-amber-500 text-white border-amber-600 shadow' : 'bg-white text-slate-600 border-slate-200'} ${line.mode === 'EXISTING' ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        Tiêu hao
                      </button>
                    </div>
                    {line.mode === 'EXISTING' && (
                      <span className="text-[11px] text-slate-500">
                        (Loại hiện tại: {line.lifecycle === 'CONSUMABLE' ? 'Tiêu hao' : 'Khấu hao'})
                      </span>
                    )}
                  </div>

                  {line.lifecycle === 'CONSUMABLE' ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Đơn vị tiêu hao</label>
                        <input
                          type="text"
                          value={line.consumableUnit || ''}
                          onChange={e => handleReceiptItemChange(line.tempId, { consumableUnit: e.target.value })}
                          disabled={line.mode === 'EXISTING'}
                          className="w-full border-2 border-amber-100 rounded-xl p-3 text-sm font-bold bg-white"
                          placeholder="VD: hộp, cái, bộ..."
                        />
                      </div>
                      <div className="md:col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] font-semibold text-amber-700">
                        Số lượng tiêu hao = xuất kho - số kiểm về. Hệ thống tự trừ khỏi tồn khi chốt phiếu trả hàng.
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Số lần sử dụng tối đa</label>
                        <input
                          type="number"
                          min={1}
                          value={line.maxUsage ?? ''}
                          onChange={e => handleReceiptItemChange(line.tempId, { maxUsage: Number(e.target.value) })}
                          disabled={line.mode === 'EXISTING'}
                          className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-black text-blue-600 bg-white"
                          placeholder="VD: 20"
                        />
                      </div>
                      <div className="md:col-span-2 bg-slate-50 border border-slate-100 rounded-xl p-3 text-[11px] font-semibold text-slate-600">
                        Khấu hao tính theo lượt sử dụng. Mỗi lần thiết bị hoàn về, hệ thống trừ 1 lượt cho từng đơn vị được xuất.
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {line.mode === 'EXISTING' ? (
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Thiết bị có sẵn</label>
                          <select
                            value={line.itemId}
                            onChange={e => handleSelectExistingForReceipt(line.tempId, e.target.value)}
                            className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-bold bg-white"
                          >
                            <option value="">-- Chọn thiết bị --</option>
                            {inventory.map(item => (
                              <option key={item.id} value={item.id}>
                                {item.name} {item.barcode ? `• ${item.barcode}` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Tên thiết bị mới *</label>
                          <input
                            type="text"
                            value={line.name}
                            onChange={e => handleReceiptItemChange(line.tempId, { name: e.target.value })}
                            placeholder="Ví dụ: Loa Array L-ACME"
                            className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-bold"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                          {line.mode === 'PLANNED' ? 'Số lượng dự kiến (không tăng tồn kho)' : 'Số lượng nhập'}
                        </label>
                        <input
                          type="number"
                          min={line.mode === 'PLANNED' ? 0 : 1}
                          value={line.quantity}
                          onChange={e => handleReceiptItemChange(line.tempId, { quantity: Number(e.target.value) })}
                          className="w-full border-2 border-slate-100 rounded-xl p-3 text-xl font-black text-center text-blue-600"
                        />
                        {line.mode === 'PLANNED' && (
                          <p className="text-[11px] text-amber-600 mt-1">Tạo danh mục dự kiến mua/sản xuất, không cộng tồn kho.</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Danh mục</label>
                        <input
                          type="text"
                          value={line.category}
                          onChange={e => handleReceiptItemChange(line.tempId, { category: e.target.value })}
                          className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-bold bg-white"
                          disabled={line.mode === 'EXISTING'}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Mã barcode</label>
                        <input
                          type="text"
                          value={line.barcode}
                          onChange={e => handleReceiptItemChange(line.tempId, { barcode: e.target.value })}
                          placeholder="Để trống để hệ thống tạo"
                          className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-mono tracking-widest bg-white"
                          disabled={line.mode === 'EXISTING'}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Vị trí kho</label>
                        <input
                          type="text"
                          value={line.location}
                          onChange={e => handleReceiptItemChange(line.tempId, { location: e.target.value })}
                          className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-bold bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Link mua / nguồn</label>
                        <input
                          type="text"
                          value={line.purchaseLink || ''}
                          onChange={e => handleReceiptItemChange(line.tempId, { purchaseLink: e.target.value })}
                          placeholder="https:// hoặc mô tả NCC"
                          className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Ngưỡng cảnh báo</label>
                        <input
                          type="number"
                          value={line.minStock ?? ''}
                          onChange={e => {
                            const value = e.target.value;
                            handleReceiptItemChange(line.tempId, { minStock: value === '' ? undefined : Number(value) });
                          }}
                          className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-bold text-blue-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Giá thuê (VNĐ)</label>
                        <input
                          type="number"
                          value={line.rentalPrice ?? ''}
                          onChange={e => {
                            const value = e.target.value;
                            handleReceiptItemChange(line.tempId, { rentalPrice: value === '' ? undefined : Number(value) });
                          }}
                          className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-bold text-blue-600"
                        />
                      </div>
                    </div>

                    {line.mode === 'PLANNED' && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Thời gian dự kiến</label>
                          <input
                            type="text"
                            value={line.plannedEta || ''}
                            onChange={e => handleReceiptItemChange(line.tempId, { plannedEta: e.target.value })}
                            placeholder="VD: Tháng 12/2024"
                            className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-semibold bg-white"
                          />
                        </div>
                        <div className="md:col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] font-semibold text-amber-700">
                          Dùng để thêm danh mục dự kiến nhập kho (mua hoặc sản xuất) nhằm xây dựng combo/gói trước. Số lượng kho thực tế giữ nguyên.
                        </div>
                      </div>
                    )}

                    <div className="mt-3">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Ghi chú / Mô tả</label>
                      <textarea
                        rows={2}
                        value={line.description || ''}
                        onChange={e => handleReceiptItemChange(line.tempId, { description: e.target.value })}
                        className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-semibold bg-white"
                        placeholder="Thông số, tình trạng nhập, series..."
                      />
                    </div>
                    <div className="mt-3">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Link hình ảnh</label>
                      <input
                        type="text"
                        value={line.imageUrl || ''}
                        onChange={e => handleReceiptItemChange(line.tempId, { imageUrl: e.target.value })}
                        className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-semibold bg-white"
                        placeholder="https:// hình ảnh minh họa"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleAddReceiptLine}
                className="w-full border-2 border-dashed border-slate-200 rounded-xl py-3 text-sm font-black text-slate-600 hover:border-blue-300 hover:text-blue-600"
              >
                + Thêm dòng thiết bị
              </button>
            </div>

            <div className="p-6 border-t bg-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="text-sm text-slate-500">
                Tổng <b>{receiptItems.length}</b> dòng • Nguồn gốc bắt buộc cho tất cả thiết bị nhập kho.
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => { setShowReceiptModal(false); resetReceiptForm(); }} className="px-5 py-3 text-slate-500 font-black uppercase tracking-widest text-xs hover:bg-slate-200 rounded-2xl">
                  Hủy
                </button>
                <button onClick={handleSubmitReceipt} className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-200 hover:bg-blue-700">
                  Lưu phiếu nhập
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2.5 Modal Print Barcode */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-800">In tem mã vạch</h3>
                <p className="text-sm text-slate-500">Chọn thiết bị và số lượng tem. Khổ mặc định 40x30mm (máy HPRT D35E).</p>
              </div>
              <button onClick={() => setShowPrintModal(false)}><X size={24}/></button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Chọn sản phẩm</label>
                  <select
                    value={printDraftItemId}
                    onChange={e => setPrintDraftItemId(e.target.value)}
                    className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-bold bg-white"
                  >
                    <option value="">-- Chọn thiết bị --</option>
                    {inventory.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} {item.barcode ? `• ${item.barcode}` : '(chưa có mã)'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Số lượng tem</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={printDraftQty}
                    onChange={e => setPrintDraftQty(Number(e.target.value))}
                    className="w-full border-2 border-slate-100 rounded-xl p-3 text-xl font-black text-center text-blue-600"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 text-center">Giới hạn 500 tem/thiết bị.</p>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="text-sm text-slate-500">
                  Đã chọn: <b>{printSelections.length}</b> thiết bị, tổng <b>{printSelections.reduce((s, it) => s + it.quantity, 0)}</b> tem.
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <label className="font-bold uppercase tracking-widest">Chiều cao ô</label>
                    <input
                      type="number"
                      min={16}
                      max={40}
                      value={printLabelHeight}
                      onChange={e => setPrintLabelHeight(Number(e.target.value))}
                      className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-sm text-center"
                    />
                    <span className="text-[11px] text-slate-500">mm</span>
                  </div>
                  <button onClick={handleAddPrintSelection} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black">
                  Thêm vào danh sách
                  </button>
                </div>
              </div>

              {printSelections.length > 0 && (
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                      <tr>
                        <th className="py-2 px-3 text-left">Thiết bị</th>
                        <th className="py-2 px-3 text-left">Barcode</th>
                        <th className="py-2 px-3 text-center">Tem</th>
                        <th className="py-2 px-3 text-right"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {printSelections.map(sel => {
                        const item = inventory.find(i => i.id === sel.itemId);
                        if (!item) return null;
                        return (
                          <tr key={sel.itemId} className="border-t border-slate-100">
                            <td className="py-2 px-3 font-bold text-slate-800">{item.name}</td>
                            <td className="py-2 px-3 font-mono text-xs text-slate-500">{item.barcode || 'Chưa có mã'}</td>
                            <td className="py-2 px-3 text-center font-black text-blue-600">{sel.quantity}</td>
                            <td className="py-2 px-3 text-right">
                              <button onClick={() => setPrintSelections(prev => prev.filter(p => p.itemId !== sel.itemId))} className="text-red-500 text-xs font-bold hover:underline">Xóa</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Xem trước tem (mẫu)</label>
                  <div className="border border-slate-200 rounded-xl p-3 flex items-center justify-center bg-slate-50 min-h-[120px]">
                    {printPreviewUrl && printSelections.length > 0 ? (
                      <div
                        className="w-[160px] border border-dashed border-slate-300 bg-white rounded-lg p-2 flex flex-col items-center justify-center text-center"
                        style={{ height: `${printLabelHeight * 4}px`, minHeight: '100px' }}
                      >
                        <p className="text-[11px] font-bold text-slate-700 line-clamp-2 mb-1">
                          {inventory.find(i => i.id === printSelections[0].itemId)?.name}
                        </p>
                        <img src={printPreviewUrl} alt="barcode preview" className="w-full h-[50px] object-contain" />
                        <p className="text-[10px] font-mono text-slate-500 tracking-[0.12em] mt-1">
                          {inventory.find(i => i.id === printSelections[0].itemId)?.barcode}
                        </p>
                      </div>
                  ) : (
                    <p className="text-sm text-slate-400">Chọn thiết bị để xem trước tem.</p>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-2">Khổ 2 tem/row: 35x22mm (đặt giấy 74mm x chiều dài), tăng “Chiều cao ô” để giãn hàng.</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowPrintModal(false)} className="px-5 py-3 text-slate-500 font-black uppercase tracking-widest text-xs hover:bg-slate-100 rounded-xl">Đóng</button>
              <button onClick={handlePrintLabels} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg hover:bg-black">In tem</button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Modal Change Status (Bảo trì/Hỏng/Mất) */}
      {showStatusModal && statusItem && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
             <div className="flex justify-between items-center mb-6">
                <div>
                   <h3 className="text-lg font-bold text-slate-800">Cập Nhật Trạng Thái</h3>
                   <p className="text-blue-600 font-bold">{statusItem.name}</p>
                </div>
                <button onClick={() => setShowStatusModal(false)}><X size={24}/></button>
             </div>
             
             <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                   <button onClick={() => setStatusType('TO_MAINTENANCE')} className={`p-3 rounded-xl border-2 text-sm font-bold flex flex-col items-center gap-2 ${statusType === 'TO_MAINTENANCE' ? 'border-yellow-400 bg-yellow-50 text-yellow-700' : 'border-slate-100 text-slate-400'}`}>
                      <Wrench size={20}/> Bảo trì
                   </button>
                   <button onClick={() => setStatusType('TO_BROKEN')} className={`p-3 rounded-xl border-2 text-sm font-bold flex flex-col items-center gap-2 ${statusType === 'TO_BROKEN' ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-100 text-slate-400'}`}>
                      <AlertTriangle size={20}/> Báo hỏng
                   </button>
                   <button onClick={() => setStatusType('TO_LOST')} className={`p-3 rounded-xl border-2 text-sm font-bold flex flex-col items-center gap-2 ${statusType === 'TO_LOST' ? 'border-gray-400 bg-gray-50 text-gray-700' : 'border-slate-100 text-slate-400'}`}>
                      <Info size={20}/> Báo mất
                   </button>
                   <button onClick={() => setStatusType('FIXED')} className={`p-3 rounded-xl border-2 text-sm font-bold flex flex-col items-center gap-2 ${statusType === 'FIXED' ? 'border-green-400 bg-green-50 text-green-700' : 'border-slate-100 text-slate-400'}`}>
                      <CheckCircle size={20}/> Đã sửa xong
                   </button>
                   <button onClick={() => setStatusType('DISPOSE')} className={`p-3 rounded-xl border-2 text-sm font-bold flex flex-col items-center gap-2 ${statusType === 'DISPOSE' ? 'border-black bg-slate-800 text-white' : 'border-slate-100 text-slate-400'}`}>
                      <Trash2 size={20}/> Thanh lý
                   </button>
                </div>

                <div>
                   <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Số lượng xử lý</label>
                   <input
                     type="number"
                     min="1"
                     max={statusMaxQty || undefined}
                     disabled={statusMaxQty <= 0}
                     className="w-full border-2 border-slate-100 rounded-xl p-3 text-xl font-bold text-center disabled:bg-slate-50 disabled:text-slate-400"
                     value={statusQty || ''}
                     onChange={e => setStatusQty(Number(e.target.value))}
                   />
                   <p className="text-[10px] text-right mt-1 text-slate-400">
                     {statusType === 'FIXED'
                       ? `Tối đa sửa: ${statusItem.brokenQuantity} (theo số lượng hỏng)`
                       : statusType === 'DISPOSE'
                         ? `Tối đa thanh lý: ${statusMaxQty} (sẵn + hỏng)`
                         : `Tối đa khả dụng: ${statusItem.availableQuantity}`}
                   </p>
                </div>

                <div>
                   <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Ghi chú</label>
                   <input type="text" className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm" placeholder="VD: Hỏng nguồn, chờ linh kiện..." value={statusNote} onChange={e => setStatusNote(e.target.value)} />
                </div>

                <button onClick={handleStatusSubmit} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-black transition">Cập nhật</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
