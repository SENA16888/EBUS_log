
import React, { useEffect, useMemo, useState } from 'react';
import { ComboPackage, InventoryItem } from '../types';
import { Plus, X, Trash2, Package, Pencil } from 'lucide-react';

interface PackageManagerProps {
  packages: ComboPackage[];
  inventory: InventoryItem[];
  onCreatePackage: (newPkg: ComboPackage) => void;
  onUpdatePackage: (pkg: ComboPackage) => void;
  onDeletePackage: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const PackageManager: React.FC<PackageManagerProps> = ({
  packages,
  inventory,
  onCreatePackage,
  onUpdatePackage,
  onDeletePackage,
  canEdit = true,
  canDelete = true
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPkgId, setEditingPkgId] = useState<string | null>(null);
  const [newPkgName, setNewPkgName] = useState('');
  const [newPkgDesc, setNewPkgDesc] = useState('');
  const [newPkgCategory, setNewPkgCategory] = useState('');
  const [newPkgPrice, setNewPkgPrice] = useState(0);
  const [tempItems, setTempItems] = useState<{itemId: string, quantity: number}[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedQty, setSelectedQty] = useState(1);
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [packageSearch, setPackageSearch] = useState('');
  const [detailItemId, setDetailItemId] = useState<string | null>(null);

  const categoryLabel = (category?: string) => category?.trim() || 'Khác/Chưa phân loại';

  const packageCategories = useMemo(() => {
    const set = new Set<string>();
    packages.forEach(pkg => {
      const cat = (pkg.category || '').trim();
      if (cat) set.add(cat);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi', { sensitivity: 'base' }));
  }, [packages]);

  const hasUncategorized = useMemo(
    () => packages.some(pkg => !pkg.category || !pkg.category.trim()),
    [packages]
  );

  const sortedInventory = useMemo(
    () => [...inventory].sort((a, b) => a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' })),
    [inventory]
  );

  const filteredInventory = useMemo(() => {
    const term = itemSearchTerm.trim().toLowerCase();
    let list = sortedInventory;
    if (term) {
      list = sortedInventory.filter(i =>
        i.name.toLowerCase().includes(term) ||
        (i.barcode || '').toLowerCase().includes(term)
      );
    }
    if (selectedItemId && !list.find(i => i.id === selectedItemId)) {
      const selected = sortedInventory.find(i => i.id === selectedItemId);
      if (selected) list = [selected, ...list];
    }
    return list;
  }, [sortedInventory, itemSearchTerm, selectedItemId]);

  useEffect(() => {
    if (!showCreateModal) {
      setItemSearchTerm('');
    }
  }, [showCreateModal]);

  useEffect(() => {
    if (categoryFilter !== 'ALL' && categoryFilter !== 'UNCATEGORIZED' && !packageCategories.includes(categoryFilter)) {
      setCategoryFilter('ALL');
    }
  }, [categoryFilter, packageCategories]);

  const filteredPackages = useMemo(() => {
    const normalizedSearch = packageSearch.trim().toLowerCase();
    return [...packages]
      .filter(pkg => {
        if (categoryFilter === 'UNCATEGORIZED') return !pkg.category || !pkg.category.trim();
        if (categoryFilter !== 'ALL') return pkg.category?.trim() === categoryFilter;
        return true;
      })
      .filter(pkg => {
        if (!normalizedSearch) return true;
        const combined = `${pkg.name} ${pkg.description || ''} ${pkg.category || ''}`.toLowerCase();
        return combined.includes(normalizedSearch);
      })
      .sort((a, b) => {
        const catCompare = categoryLabel(a.category).localeCompare(categoryLabel(b.category), 'vi', { sensitivity: 'base' });
        if (catCompare !== 0) return catCompare;
        return a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' });
      });
  }, [packages, categoryFilter, packageSearch]);

  const detailItem = detailItemId ? inventory.find(i => i.id === detailItemId) : null;

  const handleOpenEdit = (e: React.MouseEvent, pkg: ComboPackage) => {
    if (!canEdit) return;
    e.preventDefault();
    e.stopPropagation();
    setEditingPkgId(pkg.id);
    setNewPkgName(pkg.name);
    setNewPkgDesc(pkg.description);
    setNewPkgCategory(pkg.category || '');
    setNewPkgPrice(pkg.packagePrice || 0);
    setTempItems([...pkg.items]);
    setShowCreateModal(true);
  };

  const handleDeleteClick = (e: React.MouseEvent, pkgId: string, pkgName: string) => {
    if (!canDelete) return;
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm(`CẢNH BÁO:\n\nBạn có chắc chắn muốn xóa vĩnh viễn gói combo "${pkgName}"?\nLưu ý: Các thiết bị trong gói sẽ KHÔNG bị xóa khỏi kho, chỉ xóa định nghĩa gói.`)) {
      onDeletePackage(pkgId);
    }
  };

  const handleAddItemToPkg = () => {
    if (!selectedItemId || selectedQty < 1) return;
    const existing = tempItems.find(i => i.itemId === selectedItemId);
    if (existing) {
      setTempItems(tempItems.map(i => i.itemId === selectedItemId ? {...i, quantity: i.quantity + selectedQty} : i));
    } else {
      setTempItems([...tempItems, { itemId: selectedItemId, quantity: selectedQty }]);
    }
    setSelectedItemId('');
    setSelectedQty(1);
  };

  const handleRemoveItemFromPkg = (itemId: string) => {
    setTempItems(tempItems.filter(i => i.itemId !== itemId));
  };

  const handleSubmitPackage = () => {
    if (!canEdit) return;
    if (!newPkgName || tempItems.length === 0) {
      alert("Vui lòng đặt tên gói và thêm ít nhất 1 thiết bị.");
      return;
    }
    const pkgData: ComboPackage = {
      id: editingPkgId || `PKG-${Date.now()}`,
      name: newPkgName,
      description: newPkgDesc,
      category: newPkgCategory.trim() || undefined,
      packagePrice: Number(newPkgPrice),
      items: tempItems
    };
    if (editingPkgId) onUpdatePackage(pkgData);
    else onCreatePackage(pkgData);
    closeModal();
  };

  const closeModal = () => { setShowCreateModal(false); resetForm(); };
  const resetForm = () => { setNewPkgName(''); setNewPkgDesc(''); setNewPkgCategory(''); setNewPkgPrice(0); setTempItems([]); setSelectedItemId(''); setSelectedQty(1); setEditingPkgId(null); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-gray-800">Quản Lý Gói Thiết Bị (Combo)</h2>
           <p className="text-gray-500 text-sm mt-1">Tạo sẵn các gói sản phẩm để xuất kho nhanh chóng.</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowCreateModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 text-sm font-medium shadow-sm">
            <Plus size={16} /> Tạo Gói Combo
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1">
            <p className="text-[11px] font-bold text-gray-500 uppercase mb-1">Lọc theo danh mục</p>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="ALL">Tất cả danh mục</option>
              {packageCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              {hasUncategorized && <option value="UNCATEGORIZED">Khác / Chưa phân loại</option>}
            </select>
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-bold text-gray-500 uppercase mb-1">Tìm kiếm gói</p>
            <input
              type="text"
              value={packageSearch}
              onChange={(e) => setPackageSearch(e.target.value)}
              placeholder="Tên gói, danh mục hoặc mô tả..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        <p className="text-[12px] text-slate-500">Đang hiển thị {filteredPackages.length}/{packages.length} gói (sắp xếp theo danh mục A-Z, sau đó tên gói).</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredPackages.map(pkg => {
          const shortages = pkg.items.map(it => {
            const inv = inventory.find(i => i.id === it.itemId);
            const available = inv ? inv.availableQuantity : 0;
            return { itemId: it.itemId, required: it.quantity, available };
          }).filter(s => s.available < s.required);
          const needsRestock = shortages.length > 0;

          return (
            <div key={pkg.id} className={`bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col hover:shadow-md transition group relative ${needsRestock ? 'ring-2 ring-orange-200' : ''}`}>
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Package className="text-blue-500" size={20} /> {pkg.name}
                  </h3>
                  <div className="flex items-center flex-wrap gap-2 mt-1">
                    <p className="text-sm font-bold text-blue-600">{pkg.packagePrice?.toLocaleString()} VNĐ</p>
                    <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">{categoryLabel(pkg.category)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {needsRestock ? (
                    <div className="text-xs font-black uppercase text-orange-700 bg-orange-100 px-2 py-1 rounded">Cần bổ sung</div>
                  ) : (
                    <div className="text-xs font-black uppercase text-green-700 bg-green-100 px-2 py-1 rounded">Sẵn sàng</div>
                  )}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-50 relative">
                    {canEdit && (
                      <button onClick={(e) => handleOpenEdit(e, pkg)} title="Sửa gói" className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-blue-100"><Pencil size={18} /></button>
                    )}
                    {canDelete && (
                      <button onClick={(e) => handleDeleteClick(e, pkg.id, pkg.name)} title="Xóa gói" className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-red-100"><Trash2 size={18} /></button>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-5 flex-1">
                <ul className="space-y-2">
                  {pkg.items.map((pkgItem, idx) => {
                    const invItem = inventory.find(i => i.id === pkgItem.itemId);
                    const enough = invItem ? invItem.availableQuantity >= pkgItem.quantity : false;
                    return (
                      <li key={idx} className="relative group">
                        <button
                          type="button"
                          onClick={() => invItem && setDetailItemId(invItem.id)}
                          className={`w-full flex justify-between items-center text-sm text-left rounded-md px-2 py-1 -mx-2 transition ${invItem ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'}`}
                          title={invItem ? 'Nhấn để xem chi tiết' : 'Thiết bị không tồn tại trong kho'}
                        >
                          <span className="text-gray-700 flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${enough ? 'bg-green-400' : 'bg-red-400'}`} />
                            {invItem ? invItem.name : pkgItem.itemId}
                            {!enough && (
                              <span className="text-[10px] text-red-500 font-bold ml-2">(thiếu {Math.max(0, pkgItem.quantity - (invItem?.availableQuantity||0))})</span>
                            )}
                          </span>
                          <span className="font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">x{pkgItem.quantity}</span>
                        </button>
                        {invItem && (
                          <div className="absolute left-0 top-full mt-2 w-[260px] bg-white border border-slate-200 shadow-lg rounded-lg p-3 text-[12px] text-slate-700 opacity-0 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 transition z-20">
                            <p className="font-bold text-slate-900 mb-1">{invItem.name}</p>
                            <p className="text-slate-500 mb-2">{invItem.description || 'Chưa có mô tả.'}</p>
                            <div className="flex flex-wrap gap-2">
                              <span className="bg-slate-100 px-2 py-0.5 rounded">Kho: {invItem.location || '—'}</span>
                              <span className="bg-slate-100 px-2 py-0.5 rounded">Sẵn có: {invItem.availableQuantity}</span>
                              <span className="bg-slate-100 px-2 py-0.5 rounded">Danh mục: {invItem.category || '—'}</span>
                              {invItem.barcode && <span className="bg-slate-100 px-2 py-0.5 rounded">Barcode: {invItem.barcode}</span>}
                            </div>
                            <p className="mt-2 text-[11px] text-blue-600 font-semibold">Nhấn để xem chi tiết</p>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
        {filteredPackages.length === 0 && (
          <div className="col-span-1 md:col-span-2 xl:col-span-3">
            <div className="bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center text-sm text-slate-500">
              {packages.length === 0 ? 'Chưa có gói combo nào. Hãy tạo gói mới để bắt đầu.' : 'Không tìm thấy gói nào khớp bộ lọc hiện tại.'}
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
               <h3 className="text-xl font-bold">{editingPkgId ? 'Sửa Gói Combo' : 'Tạo Gói Combo Mới'}</h3>
               <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="text" className="w-full border p-2 rounded-lg" placeholder="Tên gói" value={newPkgName} onChange={(e) => setNewPkgName(e.target.value)} />
                <input type="text" className="w-full border p-2 rounded-lg" placeholder="Danh mục (VD: Âm thanh, Ánh sáng)" value={newPkgCategory} onChange={(e) => setNewPkgCategory(e.target.value)} />
              </div>
              <input type="number" className="w-full border p-2 rounded-lg" placeholder="Giá gói" value={newPkgPrice} onChange={(e) => setNewPkgPrice(Number(e.target.value))} />
              <div className="border-t pt-4">
                <p className="font-bold mb-2">Thêm thiết bị</p>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={itemSearchTerm}
                    onChange={(e) => setItemSearchTerm(e.target.value)}
                    placeholder="Tìm nhanh theo tên hoặc barcode..."
                    className="w-full border p-2 rounded-lg"
                  />
                  <div className="grid grid-cols-[minmax(0,1fr)_90px_52px] gap-2 items-stretch">
                    <select className="border p-2 rounded-lg min-w-0" value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)}>
                      <option value="">-- Chọn thiết bị --</option>
                      {filteredInventory.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                    <input type="number" className="border p-2 rounded-lg text-center" value={selectedQty} onChange={(e) => setSelectedQty(Number(e.target.value))} />
                    <button onClick={handleAddItemToPkg} className="bg-slate-800 text-white rounded-lg flex items-center justify-center"><Plus size={20}/></button>
                  </div>
                  <p className="text-[12px] text-slate-500">Đang hiển thị {filteredInventory.length}/{inventory.length} thiết bị (A-Z).</p>
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                {tempItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between bg-white p-2 rounded border">
                    <span>{inventory.find(inv => inv.id === item.itemId)?.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">x{item.quantity}</span>
                      <button onClick={() => handleRemoveItemFromPkg(item.itemId)} className="text-red-500"><X size={16}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3 bg-slate-50">
               <button onClick={closeModal} className="px-4 py-2 font-medium">Hủy</button>
               <button onClick={handleSubmitPackage} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold">Lưu Gói</button>
            </div>
          </div>
        </div>
      )}

      {detailItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{detailItem.name}</h3>
                <p className="text-sm text-slate-500">{detailItem.category || 'Khác/Chưa phân loại'}</p>
              </div>
              <button onClick={() => setDetailItemId(null)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)] gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg h-[180px] w-[180px] overflow-hidden flex items-center justify-center">
                  {detailItem.imageUrl ? (
                    <img src={detailItem.imageUrl} alt={detailItem.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="text-[12px] text-slate-400">Không có ảnh</div>
                  )}
                </div>
                <div className="space-y-3">
                  <p className="text-sm text-slate-700">{detailItem.description || 'Chưa có mô tả.'}</p>
                  <div className="flex flex-wrap gap-2 text-[12px]">
                    <span className="bg-slate-100 px-2 py-0.5 rounded">Mã: {detailItem.id}</span>
                    {detailItem.barcode && <span className="bg-slate-100 px-2 py-0.5 rounded">Barcode: {detailItem.barcode}</span>}
                    <span className="bg-slate-100 px-2 py-0.5 rounded">Kho: {detailItem.location || '—'}</span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded">Giá thuê: {detailItem.rentalPrice?.toLocaleString()} VNĐ</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-[11px] text-slate-500">Tổng số lượng</p>
                  <p className="font-bold text-slate-800">{detailItem.totalQuantity}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-[11px] text-slate-500">Sẵn có</p>
                  <p className="font-bold text-slate-800">{detailItem.availableQuantity}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-[11px] text-slate-500">Đang dùng</p>
                  <p className="font-bold text-slate-800">{detailItem.inUseQuantity}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-[11px] text-slate-500">Bảo trì</p>
                  <p className="font-bold text-slate-800">{detailItem.maintenanceQuantity}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-[11px] text-slate-500">Hỏng</p>
                  <p className="font-bold text-slate-800">{detailItem.brokenQuantity}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-[11px] text-slate-500">Mất</p>
                  <p className="font-bold text-slate-800">{detailItem.lostQuantity}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-[11px] text-slate-500">Mức tồn tối thiểu</p>
                  <p className="font-bold text-slate-800">{detailItem.minStock ?? 0}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-[11px] text-slate-500">Số lần sử dụng</p>
                  <p className="font-bold text-slate-800">{detailItem.usageCount || 0}</p>
                </div>
              </div>

              {(detailItem.purchaseLink || detailItem.productionNote || detailItem.plannedPurchase) && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-2">
                  {detailItem.purchaseLink && (
                    <p className="text-slate-700">
                      <span className="font-semibold">Link mua:</span> {detailItem.purchaseLink}
                    </p>
                  )}
                  {detailItem.productionNote && (
                    <p className="text-slate-700">
                      <span className="font-semibold">Ghi chú sản xuất:</span> {detailItem.productionNote}
                    </p>
                  )}
                  {detailItem.plannedPurchase && (
                    <p className="text-slate-700">
                      <span className="font-semibold">Dự kiến mua:</span> {detailItem.plannedQuantity || 0} (ETA: {detailItem.plannedEta || '—'})
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="p-6 border-t flex justify-end gap-3 bg-slate-50">
              <button onClick={() => setDetailItemId(null)} className="px-4 py-2 font-medium">Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
