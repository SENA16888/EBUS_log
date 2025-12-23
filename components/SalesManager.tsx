import React, { useState } from 'react';
import { SaleItem } from '../types';
import { Plus, X, Trash2, Printer } from 'lucide-react';

interface SalesManagerProps {
  saleItems: SaleItem[];
  onAddSaleItem: (item: SaleItem) => void;
  onUpdateSaleItem: (item: SaleItem) => void;
  onDeleteSaleItem: (id: string) => void;
  onCreateSaleOrder: (order: any) => void;
}

export const SalesManager: React.FC<SalesManagerProps> = ({ saleItems, onAddSaleItem, onUpdateSaleItem, onDeleteSaleItem }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', category: '', description: '', imageUrl: '', price: 0, link: '', barcode: '' });
  const [selection, setSelection] = useState<Record<string, number>>({});
  const [showExport, setShowExport] = useState(false);

  const openNew = () => { setEditingId(null); setForm({ name: '', category: '', description: '', imageUrl: '', price: 0, link: '' }); setShowModal(true); };
  const openEdit = (item: SaleItem) => { setEditingId(item.id); setForm({ name: item.name, category: item.category || '', description: item.description || '', imageUrl: item.images?.[0] || '', price: item.price, link: item.link || '', barcode: item.barcode || '' }); setShowModal(true); };

  const save = () => {
    if (!form.name) { alert('Vui lòng nhập tên hàng bán'); return; }
    if (editingId) {
      onUpdateSaleItem({ id: editingId, name: form.name, category: form.category, description: form.description, images: form.imageUrl ? [form.imageUrl] : [], price: Number(form.price), link: form.link, barcode: form.barcode });
    } else {
      onAddSaleItem({ id: `SALE-${Date.now()}`, name: form.name, category: form.category, description: form.description, images: form.imageUrl ? [form.imageUrl] : [], price: Number(form.price), link: form.link, barcode: form.barcode });
    }
    setShowModal(false);
  };

  const toggleSelect = (id: string) => {
    setSelection(prev => ({ ...prev, [id]: prev[id] ? 0 : 1 }));
  };

  const selectedList = Object.entries(selection).filter(([_, qty]) => qty > 0).map(([id, qty]) => ({ item: saleItems.find(s => s.id === id), qty }));
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [orderNote, setOrderNote] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black">Hàng Bán Sự Kiện</h2>
          <p className="text-sm text-slate-500">Quản lý danh mục hàng bán và xuất danh sách bán hàng.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowExport(true)} className="bg-green-600 text-white px-4 py-2 rounded">Xuất danh sách</button>
          <button onClick={openNew} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"><Plus size={16}/> Thêm</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {saleItems.map(s => (
          <div key={s.id} className="bg-white p-4 rounded-lg border">
            <div className="flex justify-between">
              <h3 className="font-bold">{s.name}</h3>
              <div className="flex gap-2">
                <button onClick={() => openEdit(s)} className="text-slate-500">Sửa</button>
                <button onClick={() => onDeleteSaleItem(s.id)} className="text-red-500"><Trash2 size={16}/></button>
              </div>
            </div>
            <p className="text-sm text-slate-500 mt-2">{s.category}</p>
            <p className="text-sm mt-2">{s.description}</p>
            <div className="flex justify-between items-center mt-4">
              <div className="font-black">{s.price.toLocaleString()}đ</div>
              <div className="flex items-center gap-2">
                <input type="number" min={0} value={selection[s.id] || 0} onChange={e => setSelection(prev => ({ ...prev, [s.id]: Number(e.target.value) }))} className="w-20 border rounded p-1 text-sm" />
                <button onClick={() => toggleSelect(s.id)} className="px-2 py-1 bg-slate-100 rounded">{selection[s.id] ? 'Bỏ chọn' : 'Chọn'}</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">{editingId ? 'Sửa hàng bán' : 'Thêm hàng bán'}</h3>
              <button onClick={() => setShowModal(false)}><X size={20}/></button>
            </div>
            <div className="space-y-3">
              <input className="w-full border p-2 rounded" placeholder="Tên" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              <input className="w-full border p-2 rounded" placeholder="Danh mục" value={form.category} onChange={e => setForm({...form, category: e.target.value})} />
              <input className="w-full border p-2 rounded" placeholder="Link ảnh" value={form.imageUrl} onChange={e => setForm({...form, imageUrl: e.target.value})} />
              <input className="w-full border p-2 rounded" placeholder="Barcode / Mã vạch" value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} />
              <textarea className="w-full border p-2 rounded" placeholder="Mô tả" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              <input type="number" className="w-full border p-2 rounded" placeholder="Giá niêm yết" value={form.price} onChange={e => setForm({...form, price: Number(e.target.value)})} />
              <input className="w-full border p-2 rounded" placeholder="Link mua" value={form.link} onChange={e => setForm({...form, link: e.target.value})} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2">Hủy</button>
              <button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded">Lưu</button>
            </div>
          </div>
        </div>
      )}

      {/* Export modal */}
      {showExport && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">Danh mục hàng bán xuất</h3>
              <button onClick={() => setShowExport(false)}><X size={20}/></button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                <input className="border p-2 rounded" placeholder="Tên khách hàng" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                <input className="border p-2 rounded" placeholder="Liên hệ" value={customerContact} onChange={e => setCustomerContact(e.target.value)} />
              </div>
              <textarea className="w-full border p-2 rounded mb-2" placeholder="Ghi chú" value={orderNote} onChange={e => setOrderNote(e.target.value)} />
              {selectedList.length === 0 && <div className="text-sm text-slate-400">Chưa chọn mặt hàng nào.</div>}
              {selectedList.map(({ item, qty }, idx) => item && (
                <div key={idx} className="flex justify-between items-center border-b py-2">
                  <div>
                    <div className="font-bold">{item.name} {item.barcode && <span className="ml-2 text-[11px] text-slate-400">({item.barcode})</span>}</div>
                    <div className="text-xs text-slate-500">{item.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black">{item.price.toLocaleString()}đ</div>
                    <div className="text-xs">Số lượng: {qty}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowExport(false)} className="px-4 py-2">Đóng</button>
              <button onClick={() => {
                // create and save order
                if (!customerName) { alert('Vui lòng nhập tên khách hàng'); return; }
                const orderItems = selectedList.map(({ item, qty }) => ({ itemId: item!.id, name: item!.name, price: item!.price, quantity: qty }));
                const total = orderItems.reduce((a,b) => a + (b.price * b.quantity), 0);
                const order = { id: `SO-${Date.now()}`, date: new Date().toISOString(), customerName, customerContact, items: orderItems, total, note: orderNote };
                onCreateSaleOrder(order);
                setShowExport(false);
                setSelection({});
                setCustomerName(''); setCustomerContact(''); setOrderNote('');
                // open print
                setTimeout(() => window.print(), 300);
              }} className="px-4 py-2 bg-blue-600 text-white rounded flex items-center gap-2"><Printer size={16}/> Lưu & In</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesManager;
