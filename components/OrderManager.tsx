import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Printer, Trash2, X } from 'lucide-react';
import { SaleItem, SaleOrder } from '../types';

interface OrderManagerProps {
  saleOrders: SaleOrder[];
  onCreateSaleReturn?: (order: SaleOrder) => void;
  onCreateSaleOrder?: (order: SaleOrder) => void;
  onDeleteSaleOrder?: (orderId: string) => void;
  saleItems?: SaleItem[];
  onClose?: () => void;
}

export const OrderManager: React.FC<OrderManagerProps> = ({ saleOrders = [], onCreateSaleReturn, onCreateSaleOrder, onDeleteSaleOrder, saleItems = [], onClose }) => {
  const [openOrder, setOpenOrder] = useState<SaleOrder | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [editingItems, setEditingItems] = useState<Record<string, { quantity: number; discount: number }>>({});
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnSelection, setReturnSelection] = useState<Record<string, number>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [printMenuOrderId, setPrintMenuOrderId] = useState<string | null>(null);

  const saleOrdersOnly = useMemo(() => saleOrders.filter(order => (order.type || 'SALE') !== 'RETURN'), [saleOrders]);
  const returnOrders = useMemo(() => saleOrders.filter(order => (order.type || '') === 'RETURN'), [saleOrders]);

  const returnsByOrderId = useMemo(() => {
    const map: Record<string, SaleOrder[]> = {};
    returnOrders.forEach(order => {
      if (!order.relatedOrderId) return;
      if (!map[order.relatedOrderId]) map[order.relatedOrderId] = [];
      map[order.relatedOrderId].push(order);
    });
    Object.values(map).forEach(list => list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    return map;
  }, [returnOrders]);

  const orderGroups = useMemo(() => {
    const groupMap = new Map<string, { key: string; label: string; type: 'EVENT' | 'CUSTOMER'; orders: SaleOrder[]; lastDate: string }>();
    saleOrdersOnly.forEach(order => {
      const type = order.groupType === 'EVENT' ? 'EVENT' : 'CUSTOMER';
      const keyBase = type === 'EVENT' && order.groupId ? order.groupId : (order.groupName || order.customerName || 'Khách lẻ');
      const key = `${type}:${keyBase}`;
      const label = type === 'EVENT'
        ? `Sự kiện: ${order.groupName || order.eventName || order.customerName || 'Chưa rõ'}`
        : `Khách hàng: ${order.groupName || order.customerName || 'Khách lẻ'}`;
      const entry = groupMap.get(key) || { key, label, type, orders: [], lastDate: order.date };
      entry.orders.push(order);
      if (new Date(order.date).getTime() > new Date(entry.lastDate).getTime()) {
        entry.lastDate = order.date;
      }
      groupMap.set(key, entry);
    });
    return Array.from(groupMap.values())
      .map(group => ({
        ...group,
        orders: group.orders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      }))
      .sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime());
  }, [saleOrdersOnly]);

  const orphanReturns = useMemo(() => {
    const saleOrderIds = new Set(saleOrdersOnly.map(order => order.id));
    return returnOrders.filter(order => !order.relatedOrderId || !saleOrderIds.has(order.relatedOrderId));
  }, [saleOrdersOnly, returnOrders]);

  const summary = useMemo(() => {
    const totalOrders = saleOrdersOnly.length;
    // Giá trị hàng hóa: tổng giá trị danh mục (price * qty) của các đơn xuất (không tính chiết khấu)
    const totalGoodsValue = saleOrdersOnly.reduce((acc, o) => acc + ((o.items || []).reduce((s, it) => s + ((it.price || 0) * (it.quantity || 0)), 0)), 0);
    // Doanh thu: chỉ tính đơn đã chốt (FINALIZED) và lấy giá sau chiết khấu
    const totalSalesRevenue = saleOrdersOnly.filter(o => o.status === 'FINALIZED').reduce((acc, o) => acc + ((o.items || []).reduce((s, it) => s + (((it.price || 0) - (it.discount || 0)) * (it.quantity || 0)), 0)), 0);
    const totalReturns = returnOrders.reduce((acc, r) => acc + Math.abs(r.total || r.subtotal || 0), 0);
    const net = Math.max(0, totalSalesRevenue - totalReturns);
    return { totalOrders, totalGoodsValue, totalSalesRevenue, totalReturns, net };
  }, [saleOrdersOnly, returnOrders]);

  const getOrderRevenue = (order: SaleOrder) => {
    const items = order.items || [];
    const subtotal = items.reduce((acc, item) => {
      const discount = item.discount || 0;
      const qty = item.soldQuantity ?? 0;
      const lineTotal = (item.price - discount) * qty;
      return acc + Math.max(0, lineTotal);
    }, 0);
    const orderDiscount = order.orderDiscount || 0;
    return Math.max(0, subtotal - orderDiscount);
  };

  const openPrintWindow = (title: string, bodyHtml: string, autoPrint = true) => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { font-size: 18px; margin: 0 0 12px; }
            .meta { font-size: 12px; color: #64748b; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
            th { background: #f8fafc; text-transform: uppercase; font-size: 10px; letter-spacing: 0.04em; }
            .right { text-align: right; }
            .total { margin-top: 12px; font-weight: 700; }
          </style>
        </head>
        <body>
          ${bodyHtml}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    if (autoPrint) {
      printWindow.print();
    }
  };

  const loadPdfLib = async () => {
    if ((window as any).html2pdf) return (window as any).html2pdf;
    const mod: any = await import('html2pdf.js');
    return (window as any).html2pdf || mod?.default || mod;
  };

  const getBarcode = (itemId?: string, itemBarcode?: string) => {
    if (itemBarcode) return itemBarcode;
    const found = saleItems.find(s => s.id === itemId);
    return found?.barcode || '';
  };

  const buildPrintContent = (order: SaleOrder, mode: 'EXPORT' | 'SOLD' | 'RETURN') => {
    const header = `
      <h1>${mode === 'EXPORT' ? 'Phiếu xuất hàng bán' : mode === 'SOLD' ? 'Phiếu xác nhận hàng đã bán' : 'Phiếu hàng trả về'}</h1>
      <div class="meta">Mã đơn: ${order.id} • Khách hàng: ${order.customerName || '-'} • ${new Date(order.date).toLocaleString()}</div>
    `;
    const signatureBlock = (() => {
      if (mode === 'EXPORT') {
        return `
          <div style="display:flex; justify-content:space-between; margin-top:32px; gap:12px; text-align:center;">
            <div style="flex:1;">
              <div style="font-weight:700; margin-bottom:60px;">Người lập phiếu</div>
              <div style="border-top:1px solid #e2e8f0; padding-top:8px; color:#64748b; font-size:12px;">Ký và ghi rõ họ tên</div>
            </div>
            <div style="flex:1;">
              <div style="font-weight:700; margin-bottom:60px;">Người giao hàng</div>
              <div style="border-top:1px solid #e2e8f0; padding-top:8px; color:#64748b; font-size:12px;">Ký và ghi rõ họ tên</div>
            </div>
            <div style="flex:1;">
              <div style="font-weight:700; margin-bottom:60px;">Người nhận hàng</div>
              <div style="border-top:1px solid #e2e8f0; padding-top:8px; color:#64748b; font-size:12px;">Ký và ghi rõ họ tên</div>
            </div>
            <div style="flex:1;">
              <div style="font-weight:700; margin-bottom:60px;">Quản lý</div>
              <div style="border-top:1px solid #e2e8f0; padding-top:8px; color:#64748b; font-size:12px;">Ký và ghi rõ họ tên</div>
            </div>
          </div>
        `;
      }
      if (mode === 'SOLD') {
        return `
          <div style="display:flex; justify-content:space-between; margin-top:32px; gap:12px; text-align:center;">
            <div style="flex:1;">
              <div style="font-weight:700; margin-bottom:60px;">Nhân viên bán hàng</div>
              <div style="border-top:1px solid #e2e8f0; padding-top:8px; color:#64748b; font-size:12px;">Ký và ghi rõ họ tên</div>
            </div>
            <div style="flex:1;">
              <div style="font-weight:700; margin-bottom:60px;">Quản lý sự kiện</div>
              <div style="border-top:1px solid #e2e8f0; padding-top:8px; color:#64748b; font-size:12px;">Ký và ghi rõ họ tên</div>
            </div>
          </div>
        `;
      }
      return `
        <div style="display:flex; justify-content:space-between; margin-top:32px; gap:12px; text-align:center;">
          <div style="flex:1;">
            <div style="font-weight:700; margin-bottom:60px;">Người lập phiếu</div>
            <div style="border-top:1px solid #e2e8f0; padding-top:8px; color:#64748b; font-size:12px;">Ký và ghi rõ họ tên</div>
          </div>
          <div style="flex:1;">
            <div style="font-weight:700; margin-bottom:60px;">Người giao hàng</div>
            <div style="border-top:1px solid #e2e8f0; padding-top:8px; color:#64748b; font-size:12px;">Ký và ghi rõ họ tên</div>
          </div>
          <div style="flex:1;">
            <div style="font-weight:700; margin-bottom:60px;">Quản lý kho</div>
            <div style="border-top:1px solid #e2e8f0; padding-top:8px; color:#64748b; font-size:12px;">Ký và ghi rõ họ tên</div>
          </div>
        </div>
      `;
    })();
    const title = mode === 'EXPORT' ? 'In thông tin đơn hàng xuất' : mode === 'SOLD' ? 'In thông tin hàng đã bán' : 'In thông tin hàng trả về';
    if (mode === 'EXPORT') {
      const rows = (order.items || []).map((item, index) => {
        const lineValue = (item.price || 0) * (item.quantity || 0);
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${getBarcode(item.itemId, item.barcode) || '-'}</td>
            <td>${item.name}</td>
            <td class="right">${item.quantity || 0}</td>
            <td class="right">${(item.price || 0).toLocaleString()}đ</td>
            <td class="right">${lineValue.toLocaleString()}đ</td>
            <td class="right">${lineValue.toLocaleString()}đ</td>
          </tr>
        `;
      }).join('');
      const totalValue = (order.total || order.subtotal || 0);
      const body = `
        ${header}
        <table>
          <thead>
            <tr>
              <th>STT</th>
              <th>Barcode</th>
              <th>Tên SP</th>
              <th class="right">SL</th>
              <th class="right">Giá niêm yết</th>
              <th class="right">Giá trị đơn hàng</th>
              <th class="right">Tổng</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr>
              <td colspan="5" class="right"><strong>Tổng</strong></td>
              <td class="right"><strong>${totalValue.toLocaleString()}đ</strong></td>
              <td class="right"><strong>${totalValue.toLocaleString()}đ</strong></td>
            </tr>
          </tbody>
        </table>
        <div class="total">Tổng giá trị đơn hàng: ${totalValue.toLocaleString()}đ</div>
        ${signatureBlock}
      `;
      return { body, title };
    }
    if (mode === 'SOLD') {
      const rows = (order.items || []).map((item, index) => {
        const soldQty = item.soldQuantity ?? 0;
        const discount = item.discount || 0;
        const lineRevenue = Math.max(0, (item.price - discount) * soldQty);
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${getBarcode(item.itemId, item.barcode) || '-'}</td>
            <td>${item.name}</td>
            <td class="right">${soldQty}</td>
            <td class="right">${discount.toLocaleString()}đ</td>
            <td class="right">${lineRevenue.toLocaleString()}đ</td>
            <td class="right">${lineRevenue.toLocaleString()}đ</td>
          </tr>
        `;
      }).join('');
      const totalRevenue = getOrderRevenue(order);
      const body = `
        ${header}
        <table>
          <thead>
            <tr>
              <th>STT</th>
              <th>Barcode</th>
              <th>Tên SP</th>
              <th class="right">Số lượng bán</th>
              <th class="right">Chiết khấu</th>
              <th class="right">Doanh thu</th>
              <th class="right">Tổng</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr>
              <td colspan="5" class="right"><strong>Tổng</strong></td>
              <td class="right"><strong>${totalRevenue.toLocaleString()}đ</strong></td>
              <td class="right"><strong>${totalRevenue.toLocaleString()}đ</strong></td>
            </tr>
          </tbody>
        </table>
        <div class="total">Tổng doanh thu: ${totalRevenue.toLocaleString()}đ</div>
        ${signatureBlock}
      `;
      return { body, title };
    }
    const returnOrders = returnsByOrderId[order.id] || [];
    if (returnOrders.length == 0) {
      alert('Chưa có đơn trả hàng để in.');
      return null;
    }
    const returnItemsMap = new Map<string, { itemId: string; barcode?: string; name: string; price: number; discount: number; quantity: number }>();
    returnOrders.forEach(ret => {
      (ret.items || []).forEach(item => {
        const entry = returnItemsMap.get(item.itemId) || {
          itemId: item.itemId,
          barcode: item.barcode,
          name: item.name,
          price: item.price,
          discount: item.discount || 0,
          quantity: 0
        };
        entry.quantity += item.quantity || 0;
        returnItemsMap.set(item.itemId, entry);
      });
    });
    const rows = Array.from(returnItemsMap.values()).map((item, index) => {
      const qty = item.quantity || 0;
      const discount = item.discount || 0;
      const lineValue = Math.max(0, (item.price - discount) * qty);
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${getBarcode(item.itemId, item.barcode) || '-'}</td>
          <td>${item.name}</td>
          <td class="right">${qty}</td>
          <td class="right">${discount.toLocaleString()}đ</td>
          <td class="right">${lineValue.toLocaleString()}đ</td>
          <td class="right">${lineValue.toLocaleString()}đ</td>
        </tr>
      `;
    }).join('');
    const totalReturn = Array.from(returnItemsMap.values()).reduce((acc, item) => {
      const lineValue = Math.max(0, (item.price - (item.discount || 0)) * (item.quantity || 0));
      return acc + lineValue;
    }, 0);
    const body = `
      ${header}
      <table>
        <thead>
          <tr>
            <th>STT</th>
            <th>Barcode</th>
            <th>Tên SP</th>
            <th class="right">SL trả</th>
            <th class="right">Chiết khấu</th>
            <th class="right">Giá trị hàng trả</th>
            <th class="right">Tổng</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr>
            <td colspan="5" class="right"><strong>Tổng</strong></td>
            <td class="right"><strong>${totalReturn.toLocaleString()}đ</strong></td>
            <td class="right"><strong>${totalReturn.toLocaleString()}đ</strong></td>
          </tr>
        </tbody>
      </table>
      <div class="total">Tổng giá trị hàng trả: ${totalReturn.toLocaleString()}đ</div>
      ${signatureBlock}
    `;
    return { body, title };
  };

  const handlePrint = (order: SaleOrder, mode: 'EXPORT' | 'SOLD' | 'RETURN', autoPrint = true) => {
    const content = buildPrintContent(order, mode);
    if (!content) return;
    openPrintWindow(content.title, content.body, autoPrint);
  };

  const handleExportPdf = async (order: SaleOrder, mode: 'EXPORT' | 'SOLD' | 'RETURN') => {
    try {
      const content = buildPrintContent(order, mode);
      if (!content) return;
      const html2pdf = await loadPdfLib();
      const wrapper = document.createElement('div');
      wrapper.innerHTML = content.body;
      const filename = `${order.id}-${mode.toLowerCase()}.pdf`;
      await html2pdf().set({
        filename,
        html2canvas: { scale: 2 },
        pagebreak: { mode: ['css', 'legacy'] },
        margin: [10, 10, 20, 10]
      }).from(wrapper).save();
    } catch (err) {
      console.error('Export PDF error', err);
      alert('Không thể xuất PDF. Vui lòng thử lại hoặc kiểm tra kết nối.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold">Gói hàng bán theo sự kiện/khách hàng</h3>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1">Đóng</button>
            <button onClick={() => window.print()} className="px-3 py-1 bg-slate-100 rounded flex items-center gap-2"><Printer size={16}/> In</button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-3 border rounded">
            <div className="text-xs text-slate-500">Tổng đơn</div>
            <div className="font-black text-lg">{summary.totalOrders}</div>
          </div>
          <div className="p-3 border rounded">
            <div className="text-xs text-slate-500">Giá trị hàng hóa</div>
            <div className="font-black text-lg">{(summary.totalGoodsValue || 0).toLocaleString()}đ</div>
          </div>
          <div className="p-3 border rounded">
            <div className="text-xs text-slate-500">Doanh thu ròng</div>
            <div className="font-black text-lg">{(summary.net || 0).toLocaleString()}đ</div>
          </div>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-auto">
          {saleOrdersOnly.length === 0 && returnOrders.length === 0 && (
            <div className="text-sm text-slate-400">Chưa có đơn bán nào.</div>
          )}

          {orderGroups.map(group => {
            const isExpanded = expandedGroups[group.key] ?? true;
            const groupRevenue = group.orders.reduce((acc, order) => acc + (order.total || order.subtotal || 0), 0);
            const groupOrderValue = groupRevenue;
            const groupSalesRevenue = group.orders.reduce((acc, order) => acc + getOrderRevenue(order), 0);
            const exportQty = group.orders.reduce((acc, order) => acc + (order.items || []).reduce((sub, item) => sub + (item.quantity || 0), 0), 0);
            const returnQty = group.orders.reduce((acc, order) => {
              const returns = returnsByOrderId[order.id] || [];
              return acc + returns.reduce((sub, ret) => sub + (ret.items || []).reduce((itemAcc, item) => itemAcc + (item.quantity || 0), 0), 0);
            }, 0);
            const finalizedCount = group.orders.filter(order => order.status === 'FINALIZED').length;

            return (
              <div key={group.key} className="border rounded-xl p-4 bg-slate-50/40">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <div>
                    <div className="font-black text-slate-800">{group.label}</div>
                    <div className="text-xs text-slate-500">Đơn xuất: {group.orders.length} • Đã chốt: {finalizedCount}/{group.orders.length}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="text-xs text-slate-500">Xuất {exportQty} • Trả {returnQty} • Bán {Math.max(exportQty - returnQty, 0)}</div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-black text-slate-400">Giá trị đơn hàng</div>
                      <div className="font-black text-slate-800">{groupOrderValue.toLocaleString()}đ</div>
                      <div className="text-[10px] uppercase font-black text-slate-400 mt-2">Tổng doanh thu</div>
                      <div className="font-black text-slate-800">{groupSalesRevenue.toLocaleString()}đ</div>
                    </div>
                    <button
                      onClick={() => setExpandedGroups(prev => ({ ...prev, [group.key]: !isExpanded }))}
                      className="p-2 rounded-lg border bg-white text-slate-500"
                      title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
                    >
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 space-y-3">
                    {group.orders.map(order => {
                      const orderReturns = returnsByOrderId[order.id] || [];
                      const orderValue = order.total || order.subtotal || 0;
                      const orderRevenue = getOrderRevenue(order);
                      const orderExportQty = (order.items || []).reduce((acc, item) => acc + (item.quantity || 0), 0);
                      const orderSoldQty = (order.items || []).reduce((acc, item) => acc + (item.soldQuantity || 0), 0);
                      const orderReturnQty = orderReturns.reduce((acc, ret) => acc + (ret.items || []).reduce((sub, item) => sub + (item.quantity || 0), 0), 0);
                      const isCompleted = orderExportQty > 0 && (orderSoldQty + orderReturnQty) >= orderExportQty;
                      const statusLabel = isCompleted ? 'Hoàn tất đơn hàng' : order.exportConfirmed ? 'Đã xuất kho' : 'Chờ xuất kho';
                      return (
                        <div key={order.id} className="border rounded-lg p-3 bg-white">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                              <div className="font-bold">{order.id} • {order.customerName} • {new Date(order.date).toLocaleString()}</div>
                              <div className="text-xs text-slate-500">Xuất: {orderExportQty} • Bán: {orderSoldQty} • Trả: {orderReturnQty} • Giá trị đơn hàng: {orderValue.toLocaleString()}đ • Doanh thu: {orderRevenue.toLocaleString()}đ</div>
                              <span className={`mt-2 inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-full ${isCompleted ? 'bg-green-100 text-green-700' : order.exportConfirmed ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                {statusLabel}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <label className="flex items-center gap-2 text-xs text-slate-500">
                                <input
                                  type="checkbox"
                                  checked={Boolean(order.exportConfirmed)}
                                  disabled={isCompleted}
                                  onChange={e => {
                                    if (!onCreateSaleOrder) return;
                                    const updatedOrder = { ...order, exportConfirmed: e.target.checked };
                                    onCreateSaleOrder(updatedOrder);
                                  }}
                                />
                                Xác nhận đã xuất kho
                              </label>
                              <label className="flex items-center gap-2 text-xs text-slate-500">
                                <input
                                  type="checkbox"
                                  checked={Boolean(order.refundConfirmed)}
                                  onChange={e => {
                                    if (!onCreateSaleOrder) return;
                                    onCreateSaleOrder({ ...order, refundConfirmed: e.target.checked });
                                  }}
                                />
                                Đã hoàn tiền về SAPO EH
                              </label>
                              <label className="flex items-center gap-2 text-xs text-slate-500">
                                <input
                                  type="checkbox"
                                  checked={Boolean(order.returnConfirmed)}
                                  onChange={e => {
                                    if (!onCreateSaleOrder) return;
                                    onCreateSaleOrder({ ...order, returnConfirmed: e.target.checked });
                                  }}
                                />
                                Đã xác nhận trả hàng
                              </label>
                              <div className="relative">
                                <button
                                  onClick={() => setPrintMenuOrderId(prev => prev === order.id ? null : order.id)}
                                  className="px-3 py-1 bg-white border rounded text-xs text-slate-600 flex items-center gap-1"
                                >
                                  <Printer size={14} /> In
                                </button>
                                {printMenuOrderId === order.id && (
                                  <div className="absolute right-0 mt-2 w-56 bg-white border rounded-lg shadow-lg z-10">
                                    <button
                                      onClick={() => { handlePrint(order, 'EXPORT'); setPrintMenuOrderId(null); }}
                                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50"
                                    >
                                      1. In thông tin đơn hàng xuất
                                    </button>
                                    <button
                                      onClick={() => { handlePrint(order, 'SOLD'); setPrintMenuOrderId(null); }}
                                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50"
                                    >
                                      2. In thông tin hàng đã bán
                                    </button>
                                    <button
                                      onClick={() => { handlePrint(order, 'RETURN'); setPrintMenuOrderId(null); }}
                                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50"
                                    >
                                      3. In thông tin hàng trả về
                                    </button>
                                  <button
                                      onClick={() => { handleExportPdf(order, 'EXPORT'); setPrintMenuOrderId(null); }}
                                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-t"
                                    >
                                      Xuất PDF (Xuất hàng)
                                    </button>
                                    <button
                                      onClick={() => { handleExportPdf(order, 'SOLD'); setPrintMenuOrderId(null); }}
                                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50"
                                    >
                                      Xuất PDF (Đã bán)
                                    </button>
                                    <button
                                      onClick={() => { handleExportPdf(order, 'RETURN'); setPrintMenuOrderId(null); }}
                                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50"
                                    >
                                      Xuất PDF (Trả hàng)
                                    </button>
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  setOpenOrder(order);
                                  setShowDetail(true);
                                  const map: Record<string, { quantity: number; discount: number }> = {};
                                  (order.items || []).forEach(item => {
                                    map[item.itemId] = { quantity: item.soldQuantity ?? 0, discount: item.discount || 0 };
                                  });
                                  setEditingItems(map);
                                }}
                                className="px-3 py-1 bg-slate-100 rounded"
                              >
                                NHẬP SL HÀNG ĐÃ BÁN
                              </button>
                              <button
                                onClick={() => {
                                  setOpenOrder(order);
                                  setShowReturnModal(true);
                                  const map: Record<string, number> = {};
                                  (order.items || []).forEach(item => {
                                    map[item.itemId] = 0;
                                  });
                                  setReturnSelection(map);
                                }}
                                className="px-3 py-1 bg-yellow-100 rounded"
                              >
                                Tạo trả hàng
                              </button>
                              <button
                                onClick={() => {
                                  if (!onDeleteSaleOrder) return;
                                  const confirmDelete = window.confirm(`Xóa đơn ${order.id}? Các đơn trả liên quan sẽ bị xóa cùng.`);
                                  if (!confirmDelete) return;
                                  onDeleteSaleOrder(order.id);
                                }}
                                className="px-3 py-1 bg-red-50 text-red-600 border border-red-100 rounded"
                              >
                                <Trash2 size={14} className="inline mr-1" /> Xóa đơn
                              </button>
                            </div>
                          </div>

                          {orderReturns.length > 0 && (
                            <div className="mt-3 space-y-2 border-l-2 border-slate-100 pl-4">
                              {orderReturns.map(ret => (
                                <div key={ret.id} className="flex items-center justify-between text-xs text-slate-500">
                                  <span>Trả: {ret.id} • {new Date(ret.date).toLocaleString()}</span>
                                  <span className="font-bold text-slate-700">-{Math.abs(ret.total || ret.subtotal || 0).toLocaleString()}đ</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {orphanReturns.length > 0 && (
            <div className="border rounded-xl p-4 bg-white">
              <div className="font-bold text-slate-700 mb-2">Đơn trả lẻ</div>
              <div className="space-y-2">
                {orphanReturns.map(order => (
                  <div key={order.id} className="flex items-center justify-between text-sm text-slate-600">
                    <span>{order.id} • {order.customerName} • {new Date(order.date).toLocaleString()}</span>
                    <span className="font-bold">-{Math.abs(order.total || order.subtotal || 0).toLocaleString()}đ</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* Detail modal */}
        {showDetail && openOrder && (
          <div className="fixed inset-0 bg-black/40 z-60 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[85vh] flex flex-col shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold">Chi tiết {openOrder.id}</h3>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button
                      onClick={() => setPrintMenuOrderId(prev => prev === openOrder.id ? null : openOrder.id)}
                      className="px-3 py-1 bg-slate-100 rounded text-xs flex items-center gap-1"
                    >
                      <Printer size={14} /> In
                    </button>
                    {printMenuOrderId === openOrder.id && (
                      <div className="absolute right-0 mt-2 w-56 bg-white border rounded-lg shadow-lg z-10">
                        <button
                          onClick={() => { handlePrint(openOrder, 'EXPORT'); setPrintMenuOrderId(null); }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50"
                        >
                          1. In thông tin đơn hàng xuất
                        </button>
                        <button
                          onClick={() => { handlePrint(openOrder, 'SOLD'); setPrintMenuOrderId(null); }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50"
                        >
                          2. In thông tin hàng đã bán
                        </button>
                        <button
                          onClick={() => { handlePrint(openOrder, 'RETURN'); setPrintMenuOrderId(null); }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50"
                        >
                          3. In thông tin hàng trả về
                        </button>
                        <button
                          onClick={() => { handleExportPdf(openOrder, 'EXPORT'); setPrintMenuOrderId(null); }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-t"
                        >
                          Xuất PDF (Xuất hàng)
                        </button>
                        <button
                          onClick={() => { handleExportPdf(openOrder, 'SOLD'); setPrintMenuOrderId(null); }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50"
                        >
                          Xuất PDF (Đã bán)
                        </button>
                        <button
                          onClick={() => { handleExportPdf(openOrder, 'RETURN'); setPrintMenuOrderId(null); }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50"
                        >
                          Xuất PDF (Trả hàng)
                        </button>
                      </div>
                    )}
                  </div>
                  <button onClick={() => { setShowDetail(false); setOpenOrder(null); }}><X size={18}/></button>
                </div>
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                <div className="text-sm text-slate-500">Khách hàng: {openOrder.customerName} • {openOrder.customerContact}</div>
                <div className="grid grid-cols-1 gap-2">
                  {openOrder.items.map((it: any, idx: number) => (
                    <div key={idx} className="grid grid-cols-6 gap-2 items-center border-b py-2">
                      <div className="col-span-3">
                        <div className="font-bold">{it.name}</div>
                        <div className="text-xs text-slate-500">{it.itemId}</div>
                      </div>
                      <div className="text-sm">Đơn giá: {it.price.toLocaleString()}đ</div>
                      <div>
                        <label className="text-xs">Bán được</label>
                        <input type="number" min={0} max={it.quantity} value={editingItems[it.itemId]?.quantity ?? it.soldQuantity ?? 0} onChange={e => setEditingItems(prev => ({ ...prev, [it.itemId]: { ...(prev[it.itemId] || { quantity: it.soldQuantity ?? 0, discount: it.discount || 0 }), quantity: Number(e.target.value) } }))} className="w-20 border p-1 rounded" />
                      </div>
                      <div>
                        <label className="text-xs">Chiết khấu</label>
                        <input type="number" min={0} value={editingItems[it.itemId]?.discount ?? it.discount ?? 0} onChange={e => setEditingItems(prev => ({ ...prev, [it.itemId]: { ...(prev[it.itemId] || { quantity: it.quantity, discount: it.discount || 0 }), discount: Number(e.target.value) } }))} className="w-28 border p-1 rounded" />
                      </div>
                      <div className="text-right font-black">{(((it.price - (editingItems[it.itemId]?.discount ?? it.discount ?? 0)))* (editingItems[it.itemId]?.quantity ?? it.soldQuantity ?? 0)).toLocaleString()}đ</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 flex-shrink-0">
                {(() => {
                  const previewItems = openOrder.items.map((it: any) => {
                    const edit = editingItems[it.itemId];
                    const qty = edit ? edit.quantity : (it.soldQuantity ?? 0);
                    const discount = edit ? edit.discount : (it.discount || 0);
                    return Math.max(0, (it.price - discount) * (qty || 0));
                  });
                  const previewSubtotal = previewItems.reduce((a: number, b: number) => a + b, 0);
                  const orderDiscount = openOrder.orderDiscount || 0;
                  const previewRevenue = Math.max(0, previewSubtotal - orderDiscount);
                  const orderValue = openOrder.total || openOrder.subtotal || 0;
                  return (
                    <div className="text-sm text-slate-600">
                      Giá trị đơn hàng: <span className="font-black">{orderValue.toLocaleString()}đ</span>
                      <span className="mx-2 text-slate-300">|</span>
                      Doanh thu: <span className="font-black text-blue-700">{previewRevenue.toLocaleString()}đ</span>
                    </div>
                  );
                })()}
                <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => { setShowDetail(false); setOpenOrder(null); }} className="px-4 py-2">Đóng</button>
                <button onClick={() => {
                  const updatedItems = openOrder.items.map((it: any) => {
                    const edit = editingItems[it.itemId];
                    const qty = edit ? edit.quantity : (it.soldQuantity ?? 0);
                    const discount = edit ? edit.discount : (it.discount || 0);
                    if (Number.isNaN(qty)) {
                      return { ...it, soldQuantity: 0, discount, lineTotal: 0 };
                    }
                    const lineTotal = Math.max(0, (it.price - (discount || 0)) * qty);
                    return { ...it, soldQuantity: qty, discount, lineTotal };
                  });
                  const invalid = updatedItems.some(it => it.soldQuantity === null || Number.isNaN(it.soldQuantity));
                  if (invalid) {
                    alert('Vui lòng nhập số lượng bán được và chiết khấu hợp lệ.');
                    return;
                  }
                  const updatedOrder = { ...openOrder, items: updatedItems, status: 'FINALIZED' };
                  if (onCreateSaleOrder) onCreateSaleOrder(updatedOrder);
                  setShowDetail(false); setOpenOrder(null);
                  alert('Đã chốt và lưu doanh thu.');
                }} className="px-4 py-2 bg-blue-600 text-white rounded">Chốt & Lưu</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Return modal */}
        {showReturnModal && openOrder && (
          <div className="fixed inset-0 bg-black/40 z-60 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[85vh] flex flex-col shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold">Tạo trả hàng cho {openOrder.id}</h3>
                <button onClick={() => { setShowReturnModal(false); setOpenOrder(null); }}><X size={18}/></button>
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-1 gap-2">
                  {openOrder.items.map((it: any, idx: number) => {
                    const orderReturns = returnsByOrderId[openOrder.id] || [];
                    const alreadyReturnedQty = orderReturns.reduce((a, r) => a + ((r.items || []).reduce((s: number, ri: any) => s + (ri.itemId === it.itemId ? (ri.quantity || 0) : 0), 0)), 0);
                    const soldQty = it.soldQuantity ?? 0;
                    const maxAllowed = Math.max(0, (it.quantity || 0) - soldQty - alreadyReturnedQty);
                    return (
                      <div key={idx} className="grid grid-cols-6 gap-2 items-center border-b py-2">
                        <div className="col-span-3">
                          <div className="font-bold">{it.name}</div>
                          <div className="text-xs text-slate-500">{it.itemId}</div>
                        </div>
                        <div className="text-sm">Đơn giá: {it.price.toLocaleString()}đ</div>
                        <div>
                          <input
                            type="number"
                            min={0}
                            max={maxAllowed}
                            value={returnSelection[it.itemId] ?? 0}
                            onChange={e => setReturnSelection(prev => ({ ...prev, [it.itemId]: Number(e.target.value) }))}
                            className={`w-20 border p-1 rounded ${maxAllowed === 0 ? 'bg-slate-100 text-slate-400' : ''}`}
                            disabled={maxAllowed === 0}
                          />
                        </div>
                        <div className="text-xs text-slate-400">Còn trả tối đa: {maxAllowed} • Chiết khấu cũ: {it.discount || 0}đ</div>
                        <div className="text-right font-black">{(((it.price - (it.discount || 0)))* (returnSelection[it.itemId] || 0)).toLocaleString()}đ</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 flex-shrink-0">
                {(() => {
                  const orderReturns = returnsByOrderId[openOrder.id] || [];
                  const canComplete = (openOrder.items || []).every((it: any) => {
                    const alreadyReturnedQty = orderReturns.reduce((a, r) => a + ((r.items || []).reduce((s: number, ri: any) => s + (ri.itemId === it.itemId ? (ri.quantity || 0) : 0), 0)), 0);
                    const soldQty = it.soldQuantity ?? 0;
                    return (soldQty + alreadyReturnedQty) >= (it.quantity || 0);
                  });
                  return (
                    <div className="text-xs text-slate-500">
                      {canComplete ? 'Đủ điều kiện hoàn tất đơn hàng (Xuất = Bán + Trả).' : 'Chưa đủ điều kiện hoàn tất đơn hàng.'}
                    </div>
                  );
                })()}
                <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => { setShowReturnModal(false); setOpenOrder(null); }} className="px-4 py-2">Hủy</button>
                <div className="relative">
                  <button
                    onClick={() => setPrintMenuOrderId(prev => prev === 'RETURN' ? null : 'RETURN')}
                    className="px-4 py-2 bg-slate-100 rounded"
                  >
                    In
                  </button>
                  {printMenuOrderId === 'RETURN' && (
                    <div className="absolute right-0 mt-2 w-56 bg-white border rounded-lg shadow-lg z-10">
                      <button
                        onClick={() => { handlePrint(openOrder, 'EXPORT'); setPrintMenuOrderId(null); }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50"
                      >
                        1. In thông tin đơn hàng xuất
                      </button>
                      <button
                        onClick={() => { handlePrint(openOrder, 'SOLD'); setPrintMenuOrderId(null); }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50"
                      >
                        2. In thông tin hàng đã bán
                      </button>
                      <button
                        onClick={() => { handlePrint(openOrder, 'EXPORT', true); setPrintMenuOrderId(null); }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-t"
                      >
                        Xuất PDF (Xuất hàng)
                      </button>
                    </div>
                  )}
                </div>
                <button onClick={() => {
                  const orderReturns = returnsByOrderId[openOrder.id] || [];
                  const built: any[] = [];
                  for (const it of (openOrder.items || [])) {
                    const alreadyReturnedQty = orderReturns.reduce((a, r) => a + ((r.items || []).reduce((s: number, ri: any) => s + (ri.itemId === it.itemId ? (ri.quantity || 0) : 0), 0)), 0);
                    const soldQty = it.soldQuantity ?? 0;
                    const maxAllowed = Math.max(0, (it.quantity || 0) - soldQty - alreadyReturnedQty);
                    const qty = returnSelection[it.itemId] || 0;
                    if (qty > 0) {
                      if (qty > maxAllowed) { alert(`Số lượng trả cho "${it.name}" vượt quá số đã xuất còn lại (${maxAllowed}).`); return; }
                      const discount = it.discount || 0;
                      const lineTotal = -Math.max(0, (it.price - discount) * qty);
                      built.push({ itemId: it.itemId, barcode: it.barcode, name: it.name, price: it.price, quantity: qty, discount, lineTotal });
                    }
                  }
                  const canComplete = (openOrder.items || []).every((it: any) => {
                    const alreadyReturnedQty = orderReturns.reduce((a, r) => a + ((r.items || []).reduce((s: number, ri: any) => s + (ri.itemId === it.itemId ? (ri.quantity || 0) : 0), 0)), 0);
                    const soldQty = it.soldQuantity ?? 0;
                    return (soldQty + alreadyReturnedQty) >= (it.quantity || 0);
                  });
                  if (built.length === 0 && !canComplete) { alert('Chưa chọn sản phẩm trả.'); return; }
                  if (built.length === 0 && canComplete) {
                    if (onCreateSaleOrder) onCreateSaleOrder({ ...openOrder });
                    setShowReturnModal(false); setOpenOrder(null); setReturnSelection({});
                    alert('Đã hoàn tất đơn hàng.');
                    return;
                  }
                  const subtotal = built.reduce((a:any,b:any) => a + (b.lineTotal || 0), 0);
                  const order = {
                    id: `RT-${Date.now()}`,
                    date: new Date().toISOString(),
                    customerName: openOrder.customerName,
                    customerContact: openOrder.customerContact,
                    items: built,
                    subtotal,
                    total: subtotal,
                    note: `Trả hàng cho ${openOrder.id}`,
                    type: 'RETURN',
                    relatedOrderId: openOrder.id,
                    groupType: openOrder.groupType,
                    groupId: openOrder.groupId,
                    groupName: openOrder.groupName,
                    eventId: openOrder.eventId,
                    eventName: openOrder.eventName
                  };
                  if (onCreateSaleReturn) onCreateSaleReturn(order);
                  setShowReturnModal(false); setOpenOrder(null); setReturnSelection({});
                  alert('Đã tạo đơn trả hàng.');
                }} className="px-4 py-2 bg-yellow-600 text-white rounded">Tạo trả hàng</button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default OrderManager;
