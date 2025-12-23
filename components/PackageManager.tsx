
import React, { useState } from 'react';
import { ComboPackage, InventoryItem } from '../types';
import { Layers, Plus, X, Box, Trash2, Check, Package, Pencil } from 'lucide-react';

interface PackageManagerProps {
  packages: ComboPackage[];
  inventory: InventoryItem[];
  onCreatePackage: (newPkg: ComboPackage) => void;
  onUpdatePackage: (pkg: ComboPackage) => void;
  onDeletePackage: (id: string) => void;
}

export const PackageManager: React.FC<PackageManagerProps> = ({
  packages,
  inventory,
  onCreatePackage,
  onUpdatePackage,
  onDeletePackage
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPkgId, setEditingPkgId] = useState<string | null>(null);
  const [newPkgName, setNewPkgName] = useState('');
  const [newPkgDesc, setNewPkgDesc] = useState('');
  const [newPkgPrice, setNewPkgPrice] = useState(0);
  const [tempItems, setTempItems] = useState<{itemId: string, quantity: number}[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedQty, setSelectedQty] = useState(1);

  const handleOpenEdit = (e: React.MouseEvent, pkg: ComboPackage) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingPkgId(pkg.id);
    setNewPkgName(pkg.name);
    setNewPkgDesc(pkg.description);
    setNewPkgPrice(pkg.packagePrice || 0);
    setTempItems([...pkg.items]);
    setShowCreateModal(true);
  };

  const handleDeleteClick = (e: React.MouseEvent, pkgId: string, pkgName: string) => {
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
    if (!newPkgName || tempItems.length === 0) {
      alert("Vui lòng đặt tên gói và thêm ít nhất 1 thiết bị.");
      return;
    }
    const pkgData: ComboPackage = {
      id: editingPkgId || `PKG-${Date.now()}`,
      name: newPkgName,
      description: newPkgDesc,
      packagePrice: Number(newPkgPrice),
      items: tempItems
    };
    if (editingPkgId) onUpdatePackage(pkgData);
    else onCreatePackage(pkgData);
    closeModal();
  };

  const closeModal = () => { setShowCreateModal(false); resetForm(); };
  const resetForm = () => { setNewPkgName(''); setNewPkgDesc(''); setNewPkgPrice(0); setTempItems([]); setSelectedItemId(''); setSelectedQty(1); setEditingPkgId(null); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-gray-800">Quản Lý Gói Thiết Bị (Combo)</h2>
           <p className="text-gray-500 text-sm mt-1">Tạo sẵn các gói sản phẩm để xuất kho nhanh chóng.</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 text-sm font-medium shadow-sm">
          <Plus size={16} /> Tạo Gói Combo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {packages.map(pkg => (
          <div key={pkg.id} className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col hover:shadow-md transition group relative">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Package className="text-blue-500" size={20} /> {pkg.name}
                </h3>
                <p className="text-sm font-bold text-blue-600 mt-1">{pkg.packagePrice?.toLocaleString()} VNĐ</p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-50 relative">
                <button onClick={(e) => handleOpenEdit(e, pkg)} title="Sửa gói" className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-blue-100"><Pencil size={18} /></button>
                <button onClick={(e) => handleDeleteClick(e, pkg.id, pkg.name)} title="Xóa gói" className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-red-100"><Trash2 size={18} /></button>
              </div>
            </div>
            <div className="p-5 flex-1">
              <ul className="space-y-2">
                {pkg.items.map((pkgItem, idx) => {
                  const invItem = inventory.find(i => i.id === pkgItem.itemId);
                  return (
                    <li key={idx} className="flex justify-between items-center text-sm">
                      <span className="text-gray-700 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>{invItem ? invItem.name : pkgItem.itemId}</span>
                      <span className="font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">x{pkgItem.quantity}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
               <h3 className="text-xl font-bold">{editingPkgId ? 'Sửa Gói Combo' : 'Tạo Gói Combo Mới'}</h3>
               <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <input type="text" className="w-full border p-2 rounded-lg" placeholder="Tên gói" value={newPkgName} onChange={(e) => setNewPkgName(e.target.value)} />
              <input type="number" className="w-full border p-2 rounded-lg" placeholder="Giá gói" value={newPkgPrice} onChange={(e) => setNewPkgPrice(Number(e.target.value))} />
              <div className="border-t pt-4">
                <p className="font-bold mb-2">Thêm thiết bị</p>
                <div className="flex gap-2">
                  <select className="flex-1 border p-2 rounded-lg" value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)}>
                    <option value="">-- Chọn thiết bị --</option>
                    {inventory.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                  <input type="number" className="w-20 border p-2 rounded-lg" value={selectedQty} onChange={(e) => setSelectedQty(Number(e.target.value))} />
                  <button onClick={handleAddItemToPkg} className="bg-slate-800 text-white p-2 rounded-lg"><Plus size={20}/></button>
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
    </div>
  );
};
