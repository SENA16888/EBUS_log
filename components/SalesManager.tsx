import React, { useMemo, useState } from 'react';
import { Event, SaleItem, SaleOrder } from '../types';
import { CreditCard, ImageIcon, Plus, Printer, ScanLine, Trash2, X } from 'lucide-react';
import OrderManager from './OrderManager';
import { calcLineTotal } from '../services/pricing';

interface SalesManagerProps {
  saleItems: SaleItem[];
  events?: Event[];
  onAddSaleItem: (item: SaleItem) => void;
  onUpdateSaleItem: (item: SaleItem) => void;
  onDeleteSaleItem: (id: string) => void;
  onCreateSaleOrder: (order: SaleOrder) => void;
  saleOrders?: SaleOrder[];
  onCreateSaleReturn?: (order: SaleOrder) => void;
  onDeleteSaleOrder?: (orderId: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

type PaymentLine = {
  itemId: string;
  barcode?: string;
  name: string;
  price: number;
  imageUrl?: string;
  exportedQuantity: number;
  alreadySoldQuantity: number;
  returnedQuantity: number;
  quantity: number;
  discount: number;
  discountPercent: number;
};

export const SalesManager: React.FC<SalesManagerProps> = ({
  saleItems,
  events = [],
  onAddSaleItem,
  onUpdateSaleItem,
  onDeleteSaleItem,
  onCreateSaleOrder,
  saleOrders = [],
  onCreateSaleReturn,
  onDeleteSaleOrder,
  canEdit = true,
  canDelete = true
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', category: '', description: '', imageUrl: '', price: 0, link: '', barcode: '' });
  const [selection, setSelection] = useState<Record<string, number | undefined>>({});
  const [lineDiscounts, setLineDiscounts] = useState<Record<string, number>>({});
  const [showExport, setShowExport] = useState(false);
  const [groupType, setGroupType] = useState<'EVENT' | 'CUSTOMER'>(() => (events.length > 0 ? 'EVENT' : 'CUSTOMER'));
  const [selectedEventId, setSelectedEventId] = useState('');

  const openNew = () => { if (!canEdit) return; setEditingId(null); setForm({ name: '', category: '', description: '', imageUrl: '', price: 0, link: '', barcode: '' }); setShowModal(true); };
  const openEdit = (item: SaleItem) => { if (!canEdit) return; setEditingId(item.id); setForm({ name: item.name, category: item.category || '', description: item.description || '', imageUrl: item.images?.[0] || '', price: item.price, link: item.link || '', barcode: item.barcode || '' }); setShowModal(true); };

  const save = () => {
    if (!canEdit) return;
    if (!form.name) { alert('Vui lòng nhập tên hàng bán'); return; }
    if (editingId) {
      onUpdateSaleItem({ id: editingId, name: form.name, category: form.category, description: form.description, images: form.imageUrl ? [form.imageUrl] : [], price: Number(form.price), link: form.link, barcode: form.barcode });
    } else {
      onAddSaleItem({ id: `SALE-${Date.now()}`, name: form.name, category: form.category, description: form.description, images: form.imageUrl ? [form.imageUrl] : [], price: Number(form.price), link: form.link, barcode: form.barcode });
    }
    setShowModal(false);
  };

  const toggleSelect = (id: string) => {
    setSelection(prev => {
      if (prev[id]) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: 1 };
    });
  };

  const selectedList = Object.entries(selection).filter(([_, qty]) => qty > 0).map(([id, qty]) => ({ item: saleItems.find(s => s.id === id), qty }));
  const customerOptions = useMemo(() => {
    const names = saleOrders.map(order => order.customerName).filter(Boolean);
    return Array.from(new Set(names));
  }, [saleOrders]);
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [openOrder, setOpenOrder] = useState<any | null>(null);
  const [returnSelection, setReturnSelection] = useState<Record<string, number>>({});
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [editingOrderItems, setEditingOrderItems] = useState<Record<string, { quantity: number; discount: number; discountPercent: number }>>({});
  const [paymentScan, setPaymentScan] = useState('');
  const [paymentCart, setPaymentCart] = useState<Record<string, PaymentLine>>({});
  const [paymentCode, setPaymentCode] = useState(() => `PAY-${Date.now().toString().slice(-6)}`);
  const [selectedPaymentOrderId, setSelectedPaymentOrderId] = useState('');
  const selectedSubtotal = selectedList.reduce((acc, { item }) => acc + ((item!.price - (lineDiscounts[item!.id] || 0)) * (selection[item!.id] || 1)), 0);
  const totalAfterDiscount = Math.max(0, selectedSubtotal - orderDiscount);
  const saleOrdersOnly = useMemo(() => saleOrders.filter(order => (order.type || 'SALE') !== 'RETURN'), [saleOrders]);
  const returnOrders = useMemo(() => saleOrders.filter(order => (order.type || '') === 'RETURN'), [saleOrders]);
  const returnsByOrderId = useMemo(() => {
    const map: Record<string, SaleOrder[]> = {};
    returnOrders.forEach(order => {
      if (!order.relatedOrderId) return;
      if (!map[order.relatedOrderId]) map[order.relatedOrderId] = [];
      map[order.relatedOrderId].push(order);
    });
    return map;
  }, [returnOrders]);
  const finalizedOrders = useMemo(() => saleOrders.filter(order => (order.type || 'SALE') !== 'RETURN' && order.status === 'FINALIZED'), [saleOrders]);
  const paymentStats = useMemo(() => {
    const soldQuantity = finalizedOrders.reduce((acc, order) => acc + (order.items || []).reduce((sum, item) => sum + (item.soldQuantity ?? item.quantity ?? 0), 0), 0);
    const collected = finalizedOrders.reduce((acc, order) => acc + Math.max(0, order.total || order.subtotal || 0), 0);
    return { soldQuantity, collected };
  }, [finalizedOrders]);
  const activePaymentOrderId = selectedPaymentOrderId || saleOrdersOnly[0]?.id || '';
  const selectedPaymentOrder = saleOrdersOnly.find(order => order.id === activePaymentOrderId) || null;
  const paymentLines = Object.values(paymentCart);
  const paymentSubtotal = paymentLines.reduce((acc, line) => acc + calcLineTotal(line.price || 0, line.quantity || 0, line.discount || 0, line.discountPercent || 0), 0);
  const getReturnedQuantity = (orderId: string, itemId: string) => {
    return (returnsByOrderId[orderId] || []).reduce((acc, order) => (
      acc + (order.items || []).reduce((sum, item) => sum + (item.itemId === itemId ? (item.quantity || 0) : 0), 0)
    ), 0);
  };
  const selectedOrderRemainingQuantity = selectedPaymentOrder
    ? (selectedPaymentOrder.items || []).reduce((acc, item) => {
      const remaining = Math.max(0, (item.quantity || 0) - (item.soldQuantity || 0) - getReturnedQuantity(selectedPaymentOrder.id, item.itemId));
      const inCart = paymentCart[item.itemId]?.quantity || 0;
      return acc + Math.max(0, remaining - inCart);
    }, 0)
    : 0;

  const findOrderLineForPayment = (code: string) => {
    const normalized = code.trim().toLowerCase();
    if (!normalized) return null;
    if (!selectedPaymentOrder) return null;
    const matchedCatalogItem = saleItems.find(item => (item.barcode || '').trim().toLowerCase() === normalized || item.id.toLowerCase() === normalized);
    const orderLine = (selectedPaymentOrder.items || []).find(item =>
      item.itemId.toLowerCase() === normalized ||
      (item.barcode || '').trim().toLowerCase() === normalized ||
      (matchedCatalogItem && item.itemId === matchedCatalogItem.id)
    );
    if (!orderLine) return null;
    const catalogItem = saleItems.find(item => item.id === orderLine.itemId);
    const returnedQuantity = getReturnedQuantity(selectedPaymentOrder.id, orderLine.itemId);
    const remainingQuantity = Math.max(0, (orderLine.quantity || 0) - (orderLine.soldQuantity || 0) - returnedQuantity);
    return { orderLine, catalogItem, returnedQuantity, remainingQuantity };
  };

  const addPaymentItem = (match: NonNullable<ReturnType<typeof findOrderLineForPayment>>) => {
    setPaymentCart(prev => {
      const existing = prev[match.orderLine.itemId];
      const currentQty = existing?.quantity || 0;
      if (currentQty >= match.remainingQuantity) return prev;
      return {
        ...prev,
        [match.orderLine.itemId]: existing
          ? { ...existing, quantity: existing.quantity + 1 }
          : {
            itemId: match.orderLine.itemId,
            barcode: match.orderLine.barcode || match.catalogItem?.barcode,
            name: match.orderLine.name,
            price: match.orderLine.price,
            imageUrl: match.catalogItem?.images?.[0],
            exportedQuantity: match.orderLine.quantity || 0,
            alreadySoldQuantity: match.orderLine.soldQuantity || 0,
            returnedQuantity: match.returnedQuantity,
            quantity: 1,
            discount: 0,
            discountPercent: 0
          }
      };
    });
  };

  const updatePaymentLine = (itemId: string, patch: Partial<Omit<PaymentLine, 'item'>>) => {
    setPaymentCart(prev => {
      const line = prev[itemId];
      if (!line) return prev;
      return { ...prev, [itemId]: { ...line, ...patch } };
    });
  };

  const removePaymentLine = (itemId: string) => {
    setPaymentCart(prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const finalizePayment = () => {
    if (!canEdit) return;
    if (!selectedPaymentOrder) { alert('Vui lòng chọn đơn hàng đã xuất để thanh toán.'); return; }
    if (paymentLines.length === 0) { alert('Chưa có sản phẩm trong thanh toán.'); return; }
    const invalidLine = paymentLines.find(line => line.quantity <= 0 || line.quantity > Math.max(0, line.exportedQuantity - line.alreadySoldQuantity - line.returnedQuantity));
    if (invalidLine) { alert(`Số lượng bán của "${invalidLine.name}" vượt số lượng còn lại.`); return; }
    const updatedItems = (selectedPaymentOrder.items || []).map(item => {
      const paymentLine = paymentCart[item.itemId];
      if (!paymentLine) return item;
      const nextSoldQuantity = (item.soldQuantity || 0) + paymentLine.quantity;
      const lineTotal = Math.max(0, calcLineTotal(item.price || 0, nextSoldQuantity, paymentLine.discount || 0, paymentLine.discountPercent || 0));
      return {
        ...item,
        soldQuantity: nextSoldQuantity,
        discount: paymentLine.discount || 0,
        discountPercent: paymentLine.discountPercent || 0,
        lineTotal
      };
    });
    const subtotal = updatedItems.reduce((acc, item) => acc + Math.max(0, calcLineTotal(item.price || 0, item.soldQuantity || 0, item.discount || 0, item.discountPercent || 0)), 0);
    const updatedOrder: SaleOrder = {
      ...selectedPaymentOrder,
      items: updatedItems,
      subtotal,
      total: Math.max(0, subtotal - (selectedPaymentOrder.orderDiscount || 0)),
      note: `${selectedPaymentOrder.note || ''}${selectedPaymentOrder.note ? '\n' : ''}Thanh toán ${paymentCode}`.trim(),
      status: 'FINALIZED'
    };
    onCreateSaleOrder(updatedOrder);
    setPaymentCart({});
    setPaymentScan('');
    setPaymentCode(`PAY-${Date.now().toString().slice(-6)}`);
    alert('Đã cập nhật thanh toán vào đơn hàng đã xuất.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">Hàng Bán Sự Kiện</h2>
          <p className="text-sm text-slate-500">Quản lý danh mục hàng bán và xuất danh sách bán hàng.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowHistory(true)} className="bg-slate-700 text-white px-4 py-2 rounded">Lịch sử đơn</button>
          <button onClick={() => setShowExport(true)} className="bg-green-600 text-white px-4 py-2 rounded">Xuất danh sách</button>
          {canEdit && (
            <button onClick={openNew} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"><Plus size={16}/> Thêm</button>
          )}
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex-1 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h3 className="text-lg font-black flex items-center gap-2"><CreditCard size={20} /> Thanh toán nhanh</h3>
                <p className="text-sm text-slate-500">Chọn đơn đã xuất, quét barcode, chỉnh chiết khấu và chốt hàng đã bán.</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                  <div className="text-xs text-slate-500">Đã bán</div>
                  <div className="font-black">{paymentStats.soldQuantity.toLocaleString()}</div>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                  <div className="text-xs text-slate-500">Còn lại</div>
                  <div className="font-black text-emerald-700">{selectedOrderRemainingQuantity.toLocaleString()}</div>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                  <div className="text-xs text-slate-500">Đã thu</div>
                  <div className="font-black text-blue-700">{paymentStats.collected.toLocaleString()}đ</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
              <div className="lg:col-span-2">
                <label className="text-xs font-black text-slate-500">Đơn hàng đã xuất</label>
                <select
                  className="w-full border rounded-lg p-2"
                  value={activePaymentOrderId}
                  onChange={e => {
                    setSelectedPaymentOrderId(e.target.value);
                    setPaymentCart({});
                    setPaymentScan('');
                  }}
                  disabled={!canEdit || saleOrdersOnly.length === 0}
                >
                  {saleOrdersOnly.length === 0 ? (
                    <option value="">Chưa có đơn xuất</option>
                  ) : saleOrdersOnly.map(order => (
                    <option key={order.id} value={order.id}>
                      {order.id} - {order.groupName || order.eventName || order.customerName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="lg:col-span-2">
                <label className="text-xs font-black text-slate-500">Quét barcode / mã hàng</label>
                <div className="relative">
                  <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    value={paymentScan}
                    onChange={e => setPaymentScan(e.target.value)}
                    onKeyDown={e => {
                      if (e.key !== 'Enter') return;
                      if (!selectedPaymentOrder) { alert('Vui lòng chọn đơn hàng đã xuất.'); return; }
                      const match = findOrderLineForPayment(paymentScan);
                      if (!match) { alert('Không tìm thấy sản phẩm trong đơn hàng đã xuất.'); return; }
                      const currentQty = paymentCart[match.orderLine.itemId]?.quantity || 0;
                      if (currentQty >= match.remainingQuantity) { alert('Sản phẩm này đã hết số lượng còn lại trong đơn xuất.'); return; }
                      addPaymentItem(match);
                      setPaymentScan('');
                    }}
                    placeholder="Quét rồi nhấn Enter"
                    className="w-full border rounded-lg py-2 pl-9 pr-3"
                    disabled={!canEdit || !selectedPaymentOrder}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-black text-slate-500">Mã thanh toán</label>
                <input className="w-full border rounded-lg p-2" value={paymentCode} onChange={e => setPaymentCode(e.target.value)} disabled={!canEdit} />
              </div>
              <div>
                <label className="text-xs font-black text-slate-500">Khách / sự kiện</label>
                <input className="w-full border rounded-lg p-2 bg-slate-50" value={selectedPaymentOrder ? (selectedPaymentOrder.groupName || selectedPaymentOrder.eventName || selectedPaymentOrder.customerName) : ''} readOnly />
              </div>
            </div>

            {paymentLines.length === 0 ? (
              <div className="border border-dashed border-slate-200 rounded-lg p-4 text-sm text-slate-400">Chưa có sản phẩm trong thanh toán.</div>
            ) : (
              <div className="space-y-2">
                {paymentLines.map(line => {
                  const image = line.imageUrl;
                  const maxQuantity = Math.max(0, line.exportedQuantity - line.alreadySoldQuantity - line.returnedQuantity);
                  const remainingAfterLine = Math.max(0, maxQuantity - (line.quantity || 0));
                  const lineTotal = calcLineTotal(line.price || 0, line.quantity || 0, line.discount || 0, line.discountPercent || 0);
                  return (
                    <div key={line.itemId} className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center border border-slate-100 rounded-lg p-3">
                      <div className="lg:col-span-4 flex items-center gap-3 min-w-0">
                        <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                          {image ? <img src={image} alt={line.name} className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-slate-400" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold truncate">{line.name}</div>
                          <div className="text-xs text-slate-500 font-mono truncate">{line.barcode || line.itemId}</div>
                          <div className="text-sm font-black">{line.price.toLocaleString()}đ</div>
                          <div className="text-xs text-emerald-700">Còn lại: {remainingAfterLine}/{maxQuantity}</div>
                        </div>
                      </div>
                      <div className="lg:col-span-2">
                        <label className="text-xs text-slate-500">Số lượng</label>
                        <input type="number" min={1} max={maxQuantity} value={line.quantity} onChange={e => updatePaymentLine(line.itemId, { quantity: Math.min(maxQuantity, Math.max(1, Number(e.target.value) || 1)) })} className="w-full border rounded p-2" disabled={!canEdit} />
                      </div>
                      <div className="lg:col-span-2">
                        <label className="text-xs text-slate-500">CK tiền mặt</label>
                        <input type="number" min={0} value={line.discount} onChange={e => updatePaymentLine(line.itemId, { discount: Number(e.target.value) })} className="w-full border rounded p-2" disabled={!canEdit} />
                      </div>
                      <div className="lg:col-span-2">
                        <label className="text-xs text-slate-500">% CK</label>
                        <input type="number" min={0} max={100} value={line.discountPercent} onChange={e => updatePaymentLine(line.itemId, { discountPercent: Number(e.target.value) })} className="w-full border rounded p-2" disabled={!canEdit} />
                      </div>
                      <div className="lg:col-span-2 flex items-center justify-between gap-2">
                        <div className="font-black text-blue-700">{lineTotal.toLocaleString()}đ</div>
                        {canEdit && <button onClick={() => removePaymentLine(line.itemId)} className="text-red-500"><Trash2 size={16} /></button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="lg:w-64 border border-slate-200 rounded-lg p-4 bg-slate-50">
            {selectedPaymentOrder && (
              <div className="mb-3 text-xs text-slate-500">
                Gắn với <span className="font-bold text-slate-700">{selectedPaymentOrder.id}</span>
              </div>
            )}
            <div className="text-xs text-slate-500">Tổng thanh toán</div>
            <div className="text-2xl font-black text-blue-700 mt-1">{paymentSubtotal.toLocaleString()}đ</div>
            <button onClick={finalizePayment} disabled={!canEdit || !selectedPaymentOrder || paymentLines.length === 0} className="mt-4 w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-bold disabled:opacity-50">
              Đã bán
            </button>
          </div>
        </div>
      </section>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
        <div className="text-sm text-slate-500">Chọn nhiều mặt hàng bằng checkbox, chỉnh số lượng ngay tại chỗ.</div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => {
            // select all with qty 1
            const all: Record<string, number> = {};
            saleItems.forEach(i => all[i.id] = 1);
            setSelection(all);
          }} className="px-3 py-1 bg-slate-100 rounded">Chọn tất cả</button>
          <button onClick={() => setSelection({})} className="px-3 py-1 bg-slate-100 rounded">Bỏ chọn tất cả</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {saleItems.map(s => (
          <div key={s.id} className={`bg-white p-4 rounded-lg border ${selection[s.id] > 0 ? 'ring-2 ring-blue-200' : ''}`}>
            <div className="flex justify-between">
              <h3 className="font-bold">{s.name}</h3>
              <div className="flex gap-2">
                {canEdit && <button onClick={() => openEdit(s)} className="text-slate-500">Sửa</button>}
                {canDelete && <button onClick={() => onDeleteSaleItem(s.id)} className="text-red-500"><Trash2 size={16}/></button>}
              </div>
            </div>
            <p className="text-sm text-slate-500 mt-2">{s.category}</p>
            <p className="text-sm mt-2">{s.description}</p>
            <div className="flex justify-between items-center mt-4">
              <div className="font-black">{s.price.toLocaleString()}đ</div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={Boolean(selection[s.id] && selection[s.id] > 0)} onChange={e => {
                  if (e.target.checked) {
                    setSelection(prev => ({ ...prev, [s.id]: prev[s.id] && prev[s.id] > 0 ? prev[s.id] : 1 }));
                  } else {
                    setSelection(prev => {
                      const next = { ...prev };
                      delete next[s.id];
                      return next;
                    });
                  }
                }} className="h-4 w-4" />
                <input
                  type="number"
                  min={1}
                  value={selection[s.id] ?? ''}
                  onChange={e => {
                    const val = e.target.value;
                    setSelection(prev => {
                      if (val === '') {
                        const next = { ...prev };
                        delete next[s.id];
                        return next;
                      }
                      return { ...prev, [s.id]: Number(val) };
                    });
                  }}
                  className="w-20 border rounded p-1 text-sm"
                />
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
              {canEdit && <button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded">Lưu</button>}
            </div>
          </div>
        </div>
      )}

      {/* Export modal */}
      {showExport && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">Danh mục hàng bán xuất</h3>
              <button onClick={() => setShowExport(false)}><X size={20}/></button>
            </div>
            <div className="space-y-2 flex-1 overflow-y-auto pr-1">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => setGroupType('EVENT')}
                    disabled={events.length === 0}
                    className={`px-3 py-1 rounded text-sm font-bold ${groupType === 'EVENT' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'} ${events.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Theo sự kiện
                  </button>
                  <button
                    onClick={() => setGroupType('CUSTOMER')}
                    className={`px-3 py-1 rounded text-sm font-bold ${groupType === 'CUSTOMER' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                  >
                    Theo khách hàng
                  </button>
                </div>
                {groupType === 'EVENT' && (
                  <select
                    className="flex-1 border p-2 rounded text-sm"
                    value={selectedEventId}
                    onChange={e => {
                      const nextId = e.target.value;
                      setSelectedEventId(nextId);
                      const selectedEvent = events.find(ev => ev.id === nextId);
                      if (selectedEvent && !customerName.trim()) {
                        setCustomerName(selectedEvent.client);
                      }
                    }}
                  >
                    <option value="">{events.length > 0 ? '-- Chọn sự kiện --' : 'Chưa có sự kiện'}</option>
                    {events.map(ev => (
                      <option key={ev.id} value={ev.id}>{ev.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                <div>
                  <input
                    className="border p-2 rounded w-full"
                    placeholder="Tên khách hàng"
                    list="customer-options"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                  />
                  <datalist id="customer-options">
                    {customerOptions.map(name => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>
                <input className="border p-2 rounded" placeholder="Liên hệ" value={customerContact} onChange={e => setCustomerContact(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
                <textarea className="md:col-span-2 w-full border p-2 rounded" placeholder="Ghi chú" value={orderNote} onChange={e => setOrderNote(e.target.value)} />
                <div>
                  <label className="text-xs font-black text-slate-500">Chiết khấu (VNĐ)</label>
                  <input type="number" className="w-full border p-2 rounded" value={orderDiscount} onChange={e => setOrderDiscount(Number(e.target.value))} />
                </div>
              </div>
              {selectedList.length === 0 && <div className="text-sm text-slate-400">Chưa chọn mặt hàng nào.</div>}
              {selectedList.map(({ item, qty }, idx) => item && (
                <div key={idx} className="grid grid-cols-6 gap-2 items-center border-b py-2">
                  <div className="col-span-3">
                    <div className="font-bold">{item.name} {item.barcode && <span className="ml-2 text-[11px] text-slate-400">({item.barcode})</span>}</div>
                    <div className="text-xs text-slate-500">{item.description}</div>
                  </div>
                  <div className="text-sm text-right">Đơn giá: {item.price.toLocaleString()}đ</div>
                  <div>
                    <input type="number" min={0} value={selection[item.id] || qty} onChange={e => setSelection(prev => ({ ...prev, [item.id]: Number(e.target.value) }))} className="w-20 border p-1 rounded" />
                  </div>
                  <div>
                    <input type="number" min={0} value={lineDiscounts[item.id] || 0} onChange={e => setLineDiscounts(prev => ({ ...prev, [item.id]: Number(e.target.value) }))} className="w-28 border p-1 rounded" placeholder="Chiết khấu (VNĐ)" />
                  </div>
                  <div className="text-right font-black">{(((item.price - (lineDiscounts[item.id] || 0)))* (selection[item.id] || qty)).toLocaleString()}đ</div>
                </div>
              ))}
              <div className="mt-3 text-right space-y-1">
                <div className="text-sm">Tạm tính: <span className="font-black">{selectedSubtotal.toLocaleString()}đ</span></div>
                <div className="text-sm text-slate-500">Chiết khấu đơn: <span className="font-black">{orderDiscount.toLocaleString()}đ</span></div>
                <div className="text-sm">Thành tiền: <span className="font-black text-blue-700">{totalAfterDiscount.toLocaleString()}đ</span></div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowExport(false)} className="px-4 py-2">Đóng</button>
              {canEdit && (
                <button onClick={() => {
                  // create and save order with per-line discounts
                  if (!customerName) { alert('Vui lòng nhập tên khách hàng'); return; }
                  if (groupType === 'EVENT' && !selectedEventId) { alert('Vui lòng chọn sự kiện'); return; }
                  const selectedEvent = events.find(ev => ev.id === selectedEventId);
                  const orderItems = selectedList.map(({ item }) => {
                    const qty = selection[item!.id] || 0;
                    const discount = lineDiscounts[item!.id] || 0;
                    const lineTotal = Math.max(0, (item!.price - discount) * qty);
                    return { itemId: item!.id, barcode: item!.barcode, name: item!.name, price: item!.price, quantity: qty, discount, lineTotal };
                  }).filter(i => i.quantity > 0);
                  if (orderItems.length === 0) { alert('Chưa có sản phẩm bán.'); return; }
                  const subtotal = orderItems.reduce((a,b) => a + (b.lineTotal || 0), 0);
                  const order = {
                    id: `SO-${Date.now()}`,
                    date: new Date().toISOString(),
                    customerName,
                    customerContact,
                    items: orderItems,
                    subtotal,
                    orderDiscount,
                    total: Math.max(0, subtotal - orderDiscount),
                    note: orderNote,
                    type: 'SALE',
                    groupType,
                    groupId: groupType === 'EVENT' ? selectedEvent?.id : customerName,
                    groupName: groupType === 'EVENT' ? selectedEvent?.name : customerName,
                    eventId: selectedEvent?.id,
                    eventName: selectedEvent?.name,
                    status: 'DRAFT'
                  };
                  onCreateSaleOrder(order);
                  setShowExport(false);
                  setSelection({}); setLineDiscounts({});
                  setCustomerName(''); setCustomerContact(''); setOrderNote(''); setOrderDiscount(0);
                  setSelectedEventId('');
                  // open print
                  setTimeout(() => window.print(), 300);
                }} className="px-4 py-2 bg-blue-600 text-white rounded flex items-center gap-2"><Printer size={16}/> Lưu & In</button>
              )}
            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <OrderManager
          saleOrders={saleOrders}
          saleItems={saleItems}
          onCreateSaleReturn={onCreateSaleReturn}
          onCreateSaleOrder={onCreateSaleOrder}
          onDeleteSaleOrder={onDeleteSaleOrder}
          onClose={() => setShowHistory(false)}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}

      {/* Order detail / return modal */}
      {showOrderDetail && openOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">Chi tiết {openOrder.id}</h3>
              <button onClick={() => { setShowOrderDetail(false); setOpenOrder(null); setReturnSelection({}); setOrderDiscount(0); }}><X size={20}/></button>
            </div>
              <div className="space-y-3">
              <div className="text-sm text-slate-500">Khách hàng: {openOrder.customerName} • {openOrder.customerContact}</div>
              <div className="grid grid-cols-1 gap-2">
                {openOrder.items.map((it: any, idx: number) => {
                  const edited = editingOrderItems[it.itemId];
                  const quantity = edited?.quantity ?? it.quantity;
                  const discount = edited?.discount ?? it.discount ?? 0;
                  const discountPercent = edited?.discountPercent ?? it.discountPercent ?? 0;
                  const lineTotal = calcLineTotal(it.price, quantity, discount, discountPercent);
                  return (
                    <div key={idx} className="grid grid-cols-8 gap-2 items-center border-b py-2">
                      <div className="col-span-3">
                        <div className="font-bold">{it.name}</div>
                        <div className="text-xs text-slate-500">{it.itemId}</div>
                      </div>
                      <div className="text-sm">Đơn giá: {it.price.toLocaleString()}đ</div>
                      <div>
                        <label className="text-xs">Bán được</label>
                        <input
                          type="number"
                          min={0}
                          max={it.quantity}
                          value={quantity}
                          onChange={e => setEditingOrderItems(prev => ({ ...prev, [it.itemId]: { ...(prev[it.itemId] || { quantity: it.quantity, discount: it.discount || 0, discountPercent: it.discountPercent || 0 }), quantity: Number(e.target.value) } }))}
                          className="w-20 border p-1 rounded"
                          disabled={!canEdit}
                        />
                      </div>
                      <div>
                        <label className="text-xs">Chiết khấu</label>
                        <input
                          type="number"
                          min={0}
                          value={discount}
                          onChange={e => setEditingOrderItems(prev => ({ ...prev, [it.itemId]: { ...(prev[it.itemId] || { quantity: it.quantity, discount: it.discount || 0, discountPercent: it.discountPercent || 0 }), discount: Number(e.target.value) } }))}
                          className="w-24 border p-1 rounded"
                          disabled={!canEdit}
                        />
                      </div>
                      <div>
                        <label className="text-xs">% CK</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={discountPercent}
                          onChange={e => setEditingOrderItems(prev => ({ ...prev, [it.itemId]: { ...(prev[it.itemId] || { quantity: it.quantity, discount: it.discount || 0, discountPercent: it.discountPercent || 0 }), discountPercent: Number(e.target.value) } }))}
                          className="w-20 border p-1 rounded"
                          disabled={!canEdit}
                        />
                      </div>
                      <div className="text-right font-black">{lineTotal.toLocaleString()}đ</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-4 flex justify-between items-center gap-2">
              <div className="flex items-center gap-3">
                <label className="text-sm">Số lượng trả (nếu có)</label>
                <input
                  type="number"
                  className="border p-1 rounded w-24"
                  value={returnSelection['__all'] || 0}
                  onChange={e => setReturnSelection(prev => ({ ...prev, ['__all']: Number(e.target.value) }))}
                  placeholder="0"
                  disabled={!canEdit}
                />
                <span className="text-xs text-slate-400">(tùy chỉnh nếu cần)</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowOrderDetail(false); setOpenOrder(null); }} className="px-4 py-2">Đóng</button>
                {canEdit && (
                  <button onClick={() => {
                    // finalize sale update
                    const updatedItems = openOrder.items.map((it: any) => {
                      const edit = editingOrderItems[it.itemId];
                      const qty = edit ? edit.quantity : it.quantity;
                      const discount = edit ? edit.discount : (it.discount || 0);
                      const discountPercent = edit ? edit.discountPercent : (it.discountPercent || 0);
                      const lineTotal = calcLineTotal(it.price, qty, discount, discountPercent);
                      return { ...it, quantity: qty, discount, discountPercent, lineTotal };
                    });
                    const subtotal = updatedItems.reduce((a: number,b: any) => a + (b.lineTotal || 0), 0);
                    const updatedOrder = { ...openOrder, items: updatedItems, subtotal, total: subtotal };
                    onCreateSaleOrder(updatedOrder); // save as new snapshot (or use update handler if available)
                    setShowOrderDetail(false); setOpenOrder(null); setShowHistory(false); setEditingOrderItems({});
                    alert('Đã chốt và lưu doanh thu bán hàng.');
                  }} className="px-4 py-2 bg-blue-600 text-white rounded">Chốt & Lưu</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesManager;
