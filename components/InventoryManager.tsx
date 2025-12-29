
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InventoryItem } from '../types';
import { 
  Search, Plus, Filter, X, Trash2, AlertTriangle, Wrench, ClipboardList,
  ShoppingCart, Info, ArrowUpCircle, Settings2, Link as LinkIcon, CheckCircle, CalendarClock, Printer
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
  onUpdateInventory: (item: InventoryItem) => void;
  onAddNewItem: (item: InventoryItem) => void;
  onBulkImport?: (items: InventoryItem[]) => void;
  onRestockItem: (itemId: string, quantity: number) => void;
  onDeleteItem: (itemId: string) => void;
  onStatusChange: (itemId: string, action: string, quantity: number, note: string) => void;
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({ 
  inventory, 
  onUpdateInventory,
  onAddNewItem,
  onBulkImport,
  onRestockItem,
  onDeleteItem,
  onStatusChange
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  
  const [showImportModal, setShowImportModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  
  const [bulkText, setBulkText] = useState('');
  const [importMode, setImportMode] = useState<'NEW' | 'EDIT'>('NEW');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  
  const [statusItem, setStatusItem] = useState<InventoryItem | null>(null);
  const [statusType, setStatusType] = useState('TO_MAINTENANCE');
  const [statusQty, setStatusQty] = useState(1);
  const [statusNote, setStatusNote] = useState('');
  const [restockQty, setRestockQty] = useState(1);
  const [printSelections, setPrintSelections] = useState<{ itemId: string; quantity: number }[]>([]);
  const [printDraftItemId, setPrintDraftItemId] = useState('');
  const [printDraftQty, setPrintDraftQty] = useState(1);
  const [printPreviewUrl, setPrintPreviewUrl] = useState('');

  const [newItemData, setNewItemData] = useState({
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
    e.preventDefault();
    e.stopPropagation();
    setEditingItemId(item.id);
    setNewItemData({
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
    e.preventDefault();
    e.stopPropagation();
    setStatusItem(item);
    setStatusType('TO_MAINTENANCE');
    setStatusQty(1);
    setStatusNote('');
    setShowStatusModal(true);
  }

  const handleOpenRestock = (e: React.MouseEvent, item: InventoryItem) => {
    e.preventDefault();
    e.stopPropagation();
    setStatusItem(item);
    setRestockQty(1);
    setShowRestockModal(true);
  }

  const handleDeleteClick = (e: React.MouseEvent, item: InventoryItem) => {
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
    const name = newItemData.name.trim();
    if (!name) {
      alert("Vui lòng điền tên thiết bị");
      return;
    }
    if (!newItemData.category.trim()) {
      alert("Vui lòng nhập danh mục thiết bị");
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
    const category = newItemData.category.trim();
    const lockedBarcode = normalizeBarcode(existingItem.barcode || '');
    const finalBarcode = lockedBarcode || generateBarcode(existingItem.name);
    const duplicateItem = findDuplicateBarcodeItem(inventory, finalBarcode, existingItem.id);
    if (duplicateItem) {
      alert(`Mã barcode "${finalBarcode}" đang được sử dụng bởi "${duplicateItem.name}". Barcode sản phẩm đã khóa để tránh trùng lặp.`);
      return;
    }
    const updatedItem: InventoryItem = {
      ...existingItem,
      barcode: finalBarcode,
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

  const handleRestockSubmit = () => {
    if (statusItem && restockQty > 0) {
      onRestockItem(statusItem.id, restockQty);
      setShowRestockModal(false);
      setRestockQty(1);
      setStatusItem(null);
    }
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

    const printWindow = window.open('', '_blank', 'width=420,height=680');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>In tem: ${target.name}</title>
          <style>
            @page { size: 40mm 30mm; margin: 2mm; }
            * { box-sizing: border-box; }
            body { margin: 0; padding: 0; font-family: Arial, sans-serif; background: #f8fafc; }
            .sheet { display: flex; flex-wrap: wrap; gap: 2mm; padding: 2mm; }
            .label {
              width: 40mm;
              height: 30mm;
              padding: 2mm 1.5mm 1mm;
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
              font-size: 10px;
              font-weight: 700;
              text-align: center;
              line-height: 1.2;
              margin-bottom: 2px;
            }
            .label img {
              width: 100%;
              max-height: 14mm;
              object-fit: contain;
            }
            .label__code {
              font-family: monospace;
              font-size: 9px;
              letter-spacing: 0.12em;
              text-align: center;
              margin-top: 2px;
            }
            @media print {
              body { background: white; }
              .sheet { gap: 1mm; padding: 1mm; }
              .label { border: none; }
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            ${labelHtml}
          </div>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 300);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
  };

  const handleStatusSubmit = () => {
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

  const handleBulkSubmit = () => {
    if (!bulkText.trim() || !onBulkImport) return;
    const lines = bulkText.split('\n').filter(l => l.trim().length > 0);
    const newItems: InventoryItem[] = lines.map((line, idx) => {
      let raw = line.trim();
      let qty = 1;
      let name = raw;
      const prefixMatch = raw.match(/^(\d+)\s*(?:x|set|bộ|cái|-|loại)?\s*(.+)$/i);
      const suffixMatch = raw.match(/^(.+?)\s*(?:-|\sx|\s|\(|\:)\s*(\d+)\s*\)?$/i);
      if (prefixMatch) { qty = parseInt(prefixMatch[1]); name = prefixMatch[2].trim(); }
      else if (suffixMatch) { name = suffixMatch[1].trim(); qty = parseInt(suffixMatch[2]); }
      return {
        id: `BULK-${Date.now()}-${idx}`,
        barcode: generateBarcode(name || raw),
        name: name,
        category: DEFAULT_CATEGORY,
        description: 'Nhập nhanh từ trình văn bản',
        totalQuantity: qty,
        availableQuantity: qty,
        inUseQuantity: 0,
        maintenanceQuantity: 0,
        brokenQuantity: 0,
        lostQuantity: 0,
        location: 'Kho tổng',
        rentalPrice: 0,
        imageUrl: `https://picsum.photos/200/200?random=${idx}`,
        minStock: 5
      };
    });
    onBulkImport(newItems);
    setBulkText('');
    setShowBulkModal(false);
  };

  const resetForms = () => {
    setNewItemData({
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
          <p className="text-sm text-slate-500 font-medium leading-snug">Quản lý nhập xuất, bảo trì và mua sắm bổ sung.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => setShowBulkModal(true)} className="flex-1 sm:flex-none bg-slate-800 text-white px-4 py-2.5 rounded-xl hover:bg-black transition flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest shadow-md">
            <ClipboardList size={16} /> Nhập Hàng Loạt
          </button>
          <button onClick={() => handleOpenPrintModal()} className="flex-1 sm:flex-none bg-white text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-100 transition flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest shadow-md">
            <Printer size={16} /> In mã
          </button>
          <button onClick={() => { setImportMode('NEW'); setShowImportModal(true); }} className="flex-1 sm:flex-none bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest shadow-md">
            <Plus size={16} /> Thêm Thiết Bị
          </button>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 pb-16">
        {filteredInventory.map(item => {
          const isLowStock = item.availableQuantity <= (item.minStock || 0);
          return (
            <div key={item.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-lg transition-all duration-300 group relative flex flex-col ${isLowStock ? 'border-orange-200' : 'border-slate-100 hover:border-blue-100'}`}>
              
              {/* ACTION BUTTONS: Increased Z-Index to 50 to ensure clickability */}
              <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-50 opacity-0 group-hover:opacity-100 transition-all transform translate-x-3 group-hover:translate-x-0">
                 <button onClick={(e) => handleOpenStatus(e, item)} title="Bảo trì / Báo hỏng" className="p-2 bg-white/95 backdrop-blur shadow text-slate-700 rounded-xl hover:text-orange-500 transition-colors"><Wrench size={16} /></button>
                 <button onClick={(e) => handleOpenRestock(e, item)} title="Nhập thêm hàng" className="p-2 bg-white/95 backdrop-blur shadow text-slate-700 rounded-xl hover:text-green-600 transition-colors"><ArrowUpCircle size={16} /></button>
                 <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOpenPrintModal(item); }} title="In tem mã vạch" className="p-2 bg-white/95 backdrop-blur shadow text-slate-700 rounded-xl hover:text-slate-900 transition-colors"><Printer size={16} /></button>
                 <button onClick={(e) => handleOpenEdit(e, item)} title="Chỉnh sửa thông tin" className="p-2 bg-white/95 backdrop-blur shadow text-slate-700 rounded-xl hover:text-blue-600 transition-colors"><Settings2 size={16} /></button>
                 <button onClick={(e) => handleDeleteClick(e, item)} title="Xóa thiết bị" className="p-2 bg-white/95 backdrop-blur shadow text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={16} /></button>
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
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Mã barcode</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-mono tracking-widest disabled:bg-slate-50 disabled:text-slate-400"
                      placeholder="Để trống hệ thống tự tạo"
                      value={newItemData.barcode}
                      onChange={e => setNewItemData({ ...newItemData, barcode: e.target.value })}
                      disabled={importMode === 'EDIT'}
                    />
                    <button
                      type="button"
                      onClick={() => setNewItemData(prev => ({ ...prev, barcode: generateBarcode(prev.name || prev.category) }))}
                      className="px-4 py-2 rounded-2xl bg-slate-800 text-white text-xs font-black uppercase tracking-widest hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={importMode === 'EDIT'}
                    >
                      Tạo
                    </button>
                  </div>
                  {importMode === 'EDIT' && (
                    <p className="text-[10px] text-amber-600 mt-1">Barcode đã được khóa sau khi tạo để tránh trùng lặp.</p>
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

      {/* 2. Modal Bulk Import */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
           <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="text-xl font-bold text-slate-800">Nhập Hàng Loạt (Smart Scan)</h3>
                 <button onClick={() => setShowBulkModal(false)}><X size={24}/></button>
              </div>
              <p className="text-sm text-slate-500 mb-4">Dán danh sách thiết bị vào bên dưới (VD: "10 micro", "Loa full x 4"). Hệ thống sẽ tự tách số lượng.</p>
              <textarea className="w-full h-64 border-2 border-slate-100 rounded-xl p-4 font-mono text-sm" value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder="10 x Đèn Par Led&#10;5 bộ Micro Shure&#10;Màn hình LED: 20m2"></textarea>
              <button onClick={handleBulkSubmit} className="w-full mt-4 bg-slate-800 text-white py-3 rounded-xl font-bold">Xử lý & Nhập kho</button>
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
                <button onClick={handleAddPrintSelection} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black">
                  Thêm vào danh sách
                </button>
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
                    <div className="w-[160px] h-[120px] border border-dashed border-slate-300 bg-white rounded-lg p-2 flex flex-col items-center justify-center text-center">
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
                <p className="text-[11px] text-slate-500 mt-2">Đặt khổ giấy 40x30mm trong hộp thoại in của trình duyệt, căn giữa để phù hợp máy D35E.</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowPrintModal(false)} className="px-5 py-3 text-slate-500 font-black uppercase tracking-widest text-xs hover:bg-slate-100 rounded-xl">Đóng</button>
              <button onClick={handlePrintLabels} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg hover:bg-black">In tem</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal Restock (Nhập thêm hàng) */}
      {showRestockModal && statusItem && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
             <div className="flex justify-between items-center mb-6">
                <div>
                   <h3 className="text-lg font-bold text-slate-800">Nhập Thêm Hàng</h3>
                   <p className="text-blue-600 font-bold">{statusItem.name}</p>
                </div>
                <button onClick={() => setShowRestockModal(false)}><X size={24}/></button>
             </div>
             <div className="space-y-4">
                <div>
                   <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Số lượng nhập thêm</label>
                   <input type="number" min="1" className="w-full border-2 border-slate-100 rounded-xl p-3 text-2xl font-black text-center text-blue-600" value={restockQty} onChange={e => setRestockQty(Number(e.target.value))} />
                </div>
                <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
                   Tổng kho sau khi nhập: <b>{statusItem.totalQuantity + restockQty}</b>
                </div>
                <button onClick={handleRestockSubmit} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700">Xác nhận nhập kho</button>
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
