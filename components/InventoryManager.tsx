
import React, { useEffect, useMemo, useState } from 'react';
import { InventoryItem } from '../types';
import { 
  Search, Plus, Filter, X, Trash2, AlertTriangle, Wrench, ClipboardList,
  ShoppingCart, Info, ArrowUpCircle, Settings2, Link as LinkIcon, CheckCircle, CalendarClock
} from 'lucide-react';

const DEFAULT_CATEGORY = 'Khác';
const BASE_CATEGORY_SUGGESTIONS = ['STEM', 'Âm thanh', 'Ánh sáng', 'Hiệu ứng', 'Hình ảnh', 'Quảng cáo', 'CSVG'];

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
  
  const [bulkText, setBulkText] = useState('');
  const [importMode, setImportMode] = useState<'NEW' | 'EDIT'>('NEW');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  
  const [statusItem, setStatusItem] = useState<InventoryItem | null>(null);
  const [statusType, setStatusType] = useState('TO_MAINTENANCE');
  const [statusQty, setStatusQty] = useState(1);
  const [statusNote, setStatusNote] = useState('');
  const [restockQty, setRestockQty] = useState(1);

  const [newItemData, setNewItemData] = useState({
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
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'All' || item.category === filterCategory;
    const isLowStock = item.availableQuantity <= (item.minStock || 0);
    const matchesLowStock = !showLowStockOnly || isLowStock;
    return matchesSearch && matchesCategory && matchesLowStock;
  });

  const handleOpenEdit = (e: React.MouseEvent, item: InventoryItem) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingItemId(item.id);
    setNewItemData({
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
    const newItem: InventoryItem = {
      id: `ITEM-${Date.now()}`,
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
    const updatedItem: InventoryItem = {
      ...existingItem,
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

  const handleStatusSubmit = () => {
    if (statusItem && statusQty > 0) {
      onStatusChange(statusItem.id, statusType, statusQty, statusNote);
      setShowStatusModal(false);
      setStatusItem(null);
    }
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
      name: '', category: DEFAULT_CATEGORY, description: '', location: '', totalQuantity: 1,
      imageUrl: 'https://picsum.photos/200/200', rentalPrice: 0, purchaseLink: '',
      minStock: 5, productionNote: '', plannedPurchase: false, plannedQuantity: 0, plannedEta: ''
    });
    setEditingItemId(null);
    setImportMode('NEW');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Hệ Thống Kho Thiết Bị</h2>
          <p className="text-sm text-slate-500 font-medium">Quản lý nhập xuất, bảo trì và mua sắm bổ sung.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => setShowBulkModal(true)} className="flex-1 sm:flex-none bg-slate-800 text-white px-5 py-3 rounded-2xl hover:bg-black transition flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest shadow-lg">
            <ClipboardList size={18} /> Nhập Hàng Loạt
          </button>
          <button onClick={() => { setImportMode('NEW'); setShowImportModal(true); }} className="flex-1 sm:flex-none bg-blue-600 text-white px-5 py-3 rounded-2xl hover:bg-blue-700 transition flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest shadow-lg">
            <Plus size={18} /> Thêm Thiết Bị
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input type="text" placeholder="Tìm tên thiết bị, mã SP..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 text-sm" />
          </div>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="border border-slate-100 rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 text-xs font-black uppercase">
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setShowLowStockOnly(prev => !prev)}
          aria-pressed={showLowStockOnly}
          title={showLowStockOnly ? 'Bỏ lọc sắp hết hàng' : 'Lọc sắp hết hàng'}
          className={`p-5 rounded-3xl border flex items-center gap-4 text-white shadow-lg transition ${
            showLowStockOnly ? 'bg-orange-600 border-orange-500 ring-2 ring-orange-200' : 'bg-orange-500 border-orange-400 hover:bg-orange-600'
          }`}
        >
          <AlertTriangle size={24} />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Sắp hết hàng</p>
            <p className="text-2xl font-black leading-none">{inventory.filter(i => i.availableQuantity <= (i.minStock || 0)).length} mã</p>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
        {filteredInventory.map(item => {
          const isLowStock = item.availableQuantity <= (item.minStock || 0);
          return (
            <div key={item.id} className={`bg-white rounded-[2rem] shadow-sm border-2 overflow-hidden hover:shadow-2xl transition-all duration-300 group relative flex flex-col ${isLowStock ? 'border-orange-200' : 'border-slate-50 hover:border-blue-100'}`}>
              
              {/* ACTION BUTTONS: Increased Z-Index to 50 to ensure clickability */}
              <div className="absolute top-4 right-4 flex flex-col gap-2 z-50 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                 <button onClick={(e) => handleOpenStatus(e, item)} title="Bảo trì / Báo hỏng" className="p-2.5 bg-white/95 backdrop-blur shadow-xl text-slate-700 rounded-2xl hover:text-orange-500 transition-colors"><Wrench size={18} /></button>
                 <button onClick={(e) => handleOpenRestock(e, item)} title="Nhập thêm hàng" className="p-2.5 bg-white/95 backdrop-blur shadow-xl text-slate-700 rounded-2xl hover:text-green-600 transition-colors"><ArrowUpCircle size={18} /></button>
                 <button onClick={(e) => handleOpenEdit(e, item)} title="Chỉnh sửa thông tin" className="p-2.5 bg-white/95 backdrop-blur shadow-xl text-slate-700 rounded-2xl hover:text-blue-600 transition-colors"><Settings2 size={18} /></button>
                 <button onClick={(e) => handleDeleteClick(e, item)} title="Xóa thiết bị" className="p-2.5 bg-white/95 backdrop-blur shadow-xl text-red-400 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={18} /></button>
              </div>

              <div className="relative h-48 bg-slate-100 overflow-hidden">
                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest">{item.category}</div>
                {isLowStock && <div className="absolute bottom-4 left-4 bg-red-600 text-white text-[9px] font-black px-3 py-1.5 rounded-full shadow-xl animate-pulse uppercase tracking-widest">Cảnh báo tồn kho</div>}
                {item.plannedPurchase && (
                  <div className="absolute bottom-4 right-4 bg-amber-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-xl uppercase tracking-widest flex items-center gap-1">
                    <CalendarClock size={12}/> Dự kiến {item.plannedQuantity || 0}{item.plannedEta ? ` • ${item.plannedEta}` : ''}
                  </div>
                )}
              </div>

              <div className="p-6 flex-1 flex flex-col">
                <h3 className="font-black text-slate-800 text-base leading-snug line-clamp-2 h-12 mb-3">{item.name}</h3>
                <div className="space-y-4 flex-1">
                  <div className="flex justify-between items-end">
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sẵn kho</p>
                       <p className={`text-2xl font-black ${isLowStock ? 'text-orange-600' : 'text-blue-600'}`}>{item.availableQuantity}<span className="text-xs text-slate-300 font-medium ml-1">/ {item.totalQuantity}</span></p>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giá thuê</p>
                       <p className="text-sm font-black text-slate-700">{(item.rentalPrice || 0).toLocaleString()}đ</p>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                    <div className="bg-blue-500 h-full transition-all duration-700" style={{ width: `${(item.availableQuantity / item.totalQuantity) * 100}%` }} />
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-100 text-[11px] font-bold text-slate-600 truncate uppercase tracking-tighter">
                    {item.location || 'Chưa định vị'}
                  </div>
                  
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
                   <input type="number" min="1" max={statusItem.availableQuantity} className="w-full border-2 border-slate-100 rounded-xl p-3 text-xl font-bold text-center" value={statusQty} onChange={e => setStatusQty(Number(e.target.value))} />
                   <p className="text-[10px] text-right mt-1 text-slate-400">Tối đa khả dụng: {statusItem.availableQuantity}</p>
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
