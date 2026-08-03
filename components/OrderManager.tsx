import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Printer, Trash2, X } from 'lucide-react';
import { Event, SaleItem, SaleOrder } from '../types';
import { calcLineTotal } from '../services/pricing';

interface OrderManagerProps {
  saleOrders: SaleOrder[];
  onCreateSaleReturn?: (order: SaleOrder) => void;
  onCreateSaleOrder?: (order: SaleOrder) => void;
  onDeleteSaleOrder?: (orderId: string) => void;
  saleItems?: SaleItem[];
  events?: Event[];
  onClose?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const OrderManager: React.FC<OrderManagerProps> = ({
  saleOrders = [],
  onCreateSaleReturn,
  onCreateSaleOrder,
  onDeleteSaleOrder,
  saleItems = [],
  events = [],
  onClose,
  canEdit = true,
  canDelete = true
}) => {
  const [openOrder, setOpenOrder] = useState<SaleOrder | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [editingItems, setEditingItems] = useState<Record<string, { quantity: number; discount: number; discountPercent: number }>>({});
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnSelection, setReturnSelection] = useState<Record<string, number>>({});
  const [returnDiscounts, setReturnDiscounts] = useState<Record<string, { discount: number; discountPercent: number }>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [printMenuOrderId, setPrintMenuOrderId] = useState<string | null>(null);
  const [scanSold, setScanSold] = useState('');
  const [scanReturn, setScanReturn] = useState('');
  const [editingPaymentOrder, setEditingPaymentOrder] = useState<SaleOrder | null>(null);
  const [editingPaymentMeta, setEditingPaymentMeta] = useState({ date: '', customerName: '', customerContact: '', eventId: '', note: '' });
  const [editingPaymentItems, setEditingPaymentItems] = useState<Record<string, { quantity: number; discount: number; discountPercent: number }>>({});

  const saleOrdersOnly = useMemo(() => saleOrders.filter(order => (order.type || 'SALE') !== 'RETURN'), [saleOrders]);
  const outboundSaleOrders = useMemo(() => saleOrdersOnly.filter(order => !order.relatedOrderId), [saleOrdersOnly]);
  const finalizedPaymentOrders = useMemo(() => saleOrdersOnly.filter(order => !!order.relatedOrderId && order.status === 'FINALIZED'), [saleOrdersOnly]);
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
    outboundSaleOrders.forEach(order => {
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
  }, [outboundSaleOrders]);

  const orphanReturns = useMemo(() => {
    const saleOrderIds = new Set(outboundSaleOrders.map(order => order.id));
    return returnOrders.filter(order => !order.relatedOrderId || !saleOrderIds.has(order.relatedOrderId));
  }, [outboundSaleOrders, returnOrders]);

  const soldBySourceOrderId = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    finalizedPaymentOrders.forEach(order => {
      if (!order.relatedOrderId) return;
      if (!map[order.relatedOrderId]) map[order.relatedOrderId] = {};
      (order.items || []).forEach(item => {
        const quantity = item.soldQuantity ?? item.quantity ?? 0;
        map[order.relatedOrderId!][item.itemId] = (map[order.relatedOrderId!][item.itemId] || 0) + quantity;
      });
    });
    return map;
  }, [finalizedPaymentOrders]);

  const paymentsBySourceOrderId = useMemo(() => {
    const map: Record<string, SaleOrder[]> = {};
    finalizedPaymentOrders.forEach(order => {
      if (!order.relatedOrderId) return;
      if (!map[order.relatedOrderId]) map[order.relatedOrderId] = [];
      map[order.relatedOrderId].push(order);
    });
    Object.values(map).forEach(list => list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    return map;
  }, [finalizedPaymentOrders]);

  const getLinkedSoldQuantity = (order: SaleOrder, itemId: string) => {
    const legacySoldQuantity = (order.items || []).find(item => item.itemId === itemId)?.soldQuantity || 0;
    return legacySoldQuantity + (soldBySourceOrderId[order.id]?.[itemId] || 0);
  };

  const summary = useMemo(() => {
    const totalOrders = outboundSaleOrders.length;
    // Giá trị hàng hóa: tổng giá trị danh mục (price * qty) của các đơn xuất (không tính chiết khấu)
    const totalGoodsValue = outboundSaleOrders.reduce((acc, o) => acc + ((o.items || []).reduce((s, it) => s + ((it.price || 0) * (it.quantity || 0)), 0)), 0);
    // Doanh thu: chỉ tính số lượng đã bán, hàng trả về kho không phải hoàn tiền.
    const totalSalesRevenue = saleOrdersOnly
      .filter(o => o.status === 'FINALIZED')
      .reduce((acc, o) => acc + Math.max(0, (o.items || []).reduce((s, it) => {
        const qty = it.soldQuantity ?? 0;
        return s + calcLineTotal(it.price || 0, qty, it.discount || 0, it.discountPercent || 0);
      }, 0) - (o.orderDiscount || 0)), 0);
    const returnedUnits = returnOrders.reduce((acc, r) => acc + (r.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0), 0);
    const net = totalSalesRevenue;
    return { totalOrders, totalGoodsValue, totalSalesRevenue, returnedUnits, net };
  }, [outboundSaleOrders, saleOrdersOnly, returnOrders]);

  const getOrderRevenue = (order: SaleOrder) => {
    const items = order.items || [];
    const subtotal = items.reduce((acc, item) => {
      const qty = item.soldQuantity ?? 0;
      const lineTotal = calcLineTotal(item.price || 0, qty, item.discount || 0, item.discountPercent || 0);
      return acc + Math.max(0, lineTotal);
    }, 0);
    const orderDiscount = order.orderDiscount || 0;
    return Math.max(0, subtotal - orderDiscount);
  };

  const getLinkedOrderRevenue = (order: SaleOrder) => {
    const linkedPayments = paymentsBySourceOrderId[order.id] || [];
    return getOrderRevenue(order) + linkedPayments.reduce((sum, payment) => sum + getOrderRevenue(payment), 0);
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

  const findItemByBarcode = (order: SaleOrder, code: string) => {
    const normalized = code.trim();
    if (!normalized) return null;
    const direct = (order.items || []).find(it => (it.barcode || '').trim() === normalized);
    if (direct) return direct;
    const matchedSaleItem = saleItems.find(si => (si.barcode || '').trim() === normalized);
    if (!matchedSaleItem) return null;
    return (order.items || []).find(it => it.itemId === matchedSaleItem.id) || null;
  };

  const toDateTimeLocal = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
  };

  const openPaymentEdit = (payment: SaleOrder) => {
    setEditingPaymentOrder(payment);
    setEditingPaymentMeta({
      date: toDateTimeLocal(payment.date),
      customerName: payment.customerName || '',
      customerContact: payment.customerContact || '',
      eventId: payment.eventId || '',
      note: payment.note || ''
    });
    const map: Record<string, { quantity: number; discount: number; discountPercent: number }> = {};
    (payment.items || []).forEach(item => {
      map[item.itemId] = {
        quantity: item.soldQuantity ?? item.quantity ?? 0,
        discount: item.discount || 0,
        discountPercent: item.discountPercent || 0
      };
    });
    setEditingPaymentItems(map);
  };

  const closePaymentEdit = () => {
    setEditingPaymentOrder(null);
    setEditingPaymentMeta({ date: '', customerName: '', customerContact: '', eventId: '', note: '' });
    setEditingPaymentItems({});
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
            <td>${item.name}<div style="font-size:10px;color:#64748b;">${item.paymentId}${item.paymentEventName ? ` • ${item.paymentEventName}` : ''}</div></td>
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
      const linkedPayments = paymentsBySourceOrderId[order.id] || [];
      const soldRows = linkedPayments.length > 0
        ? linkedPayments.flatMap(payment => (payment.items || []).map(item => ({ ...item, paymentId: payment.id, paymentDate: payment.date, paymentEventName: payment.eventName })))
        : (order.items || []).filter(item => (item.soldQuantity || 0) > 0).map(item => ({ ...item, paymentId: order.id, paymentDate: order.date, paymentEventName: order.eventName }));
      const rows = soldRows.map((item, index) => {
        const soldQty = item.soldQuantity ?? item.quantity ?? 0;
        const discount = item.discount || 0;
        const discountPercent = item.discountPercent || 0;
        const lineRevenue = Math.max(0, calcLineTotal(item.price || 0, soldQty, discount, discountPercent));
        const discountLabel = `${discount.toLocaleString()}đ${discountPercent ? ` (${discountPercent}%)` : ''}`;
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${getBarcode(item.itemId, item.barcode) || '-'}</td>
            <td>${item.name}</td>
            <td class="right">${soldQty}</td>
            <td class="right">${discountLabel}</td>
            <td class="right">${lineRevenue.toLocaleString()}đ</td>
            <td class="right">${lineRevenue.toLocaleString()}đ</td>
          </tr>
        `;
      }).join('');
      const totalRevenue = getLinkedOrderRevenue(order);
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
    const returnItemsMap = new Map<string, { itemId: string; barcode?: string; name: string; price: number; discount: number; discountPercent: number; quantity: number }>();
    returnOrders.forEach(ret => {
      (ret.items || []).forEach(item => {
        const entry = returnItemsMap.get(item.itemId) || {
          itemId: item.itemId,
          barcode: item.barcode,
          name: item.name,
          price: item.price,
          discount: item.discount || 0,
          discountPercent: item.discountPercent || 0,
          quantity: 0
        };
        entry.quantity += item.quantity || 0;
        returnItemsMap.set(item.itemId, entry);
      });
    });
    const rows = Array.from(returnItemsMap.values()).map((item, index) => {
      const qty = item.quantity || 0;
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${getBarcode(item.itemId, item.barcode) || '-'}</td>
          <td>${item.name}</td>
          <td class="right">${qty}</td>
          <td>Trả sản phẩm chưa bán về kho</td>
        </tr>
      `;
    }).join('');
    const totalReturnQty = Array.from(returnItemsMap.values()).reduce((acc, item) => acc + (item.quantity || 0), 0);
    const body = `
      ${header}
      <table>
        <thead>
          <tr>
            <th>STT</th>
            <th>Barcode</th>
            <th>Tên SP</th>
            <th class="right">SL trả</th>
            <th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr>
            <td colspan="3" class="right"><strong>Tổng số lượng trả</strong></td>
            <td class="right"><strong>${totalReturnQty.toLocaleString()}</strong></td>
            <td></td>
          </tr>
        </tbody>
      </table>
      <div class="total">Tổng số lượng hàng trả về kho: ${totalReturnQty.toLocaleString()} sản phẩm</div>
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
            <div className="text-[11px] text-slate-500">Trả về kho: {summary.returnedUnits.toLocaleString()} sản phẩm</div>
          </div>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-auto">
          {outboundSaleOrders.length === 0 && returnOrders.length === 0 && (
            <div className="text-sm text-slate-400">Chưa có đơn bán nào.</div>
          )}

          {orderGroups.map(group => {
            const isExpanded = expandedGroups[group.key] ?? true;
            const groupRevenue = group.orders.reduce((acc, order) => acc + (order.total || order.subtotal || 0), 0);
            const groupOrderValue = groupRevenue;
            const groupSalesRevenue = group.orders.reduce((acc, order) => acc + getLinkedOrderRevenue(order), 0);
            const exportQty = group.orders.reduce((acc, order) => acc + (order.items || []).reduce((sub, item) => sub + (item.quantity || 0), 0), 0);
            const returnQty = group.orders.reduce((acc, order) => {
              const returns = returnsByOrderId[order.id] || [];
              return acc + returns.reduce((sub, ret) => sub + (ret.items || []).reduce((itemAcc, item) => itemAcc + (item.quantity || 0), 0), 0);
            }, 0);
            const finalizedCount = group.orders.filter(order => order.status === 'FINALIZED' || getLinkedOrderRevenue(order) > 0).length;

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
                      const paymentOrders = paymentsBySourceOrderId[order.id] || [];
                      const orderValue = order.total || order.subtotal || 0;
                      const orderRevenue = getLinkedOrderRevenue(order);
                      const orderExportQty = (order.items || []).reduce((acc, item) => acc + (item.quantity || 0), 0);
                      const orderSoldQty = (order.items || []).reduce((acc, item) => acc + getLinkedSoldQuantity(order, item.itemId), 0);
                      const orderReturnQty = orderReturns.reduce((acc, ret) => acc + (ret.items || []).reduce((sub, item) => sub + (item.quantity || 0), 0), 0);
                      const isCompleted = orderExportQty > 0 && (orderSoldQty + orderReturnQty) >= orderExportQty;
                      const hasPayment = orderRevenue > 0;
                      const statusLabel = isCompleted ? 'Hoàn tất đơn hàng' : hasPayment ? 'Đang bán' : order.exportConfirmed ? 'Đã xuất kho' : 'Chờ xuất kho';
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
                                  disabled={isCompleted || !canEdit}
                                  onChange={e => {
                                    if (!canEdit) return;
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
                                  disabled={!canEdit}
                                  onChange={e => {
                                    if (!canEdit) return;
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
                                  disabled={!canEdit}
                                  onChange={e => {
                                    if (!canEdit) return;
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
                              {canDelete && (
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
                              )}
                            </div>
                          </div>

                          {paymentOrders.length > 0 && (
                            <div className="mt-3 space-y-2 border-l-2 border-green-100 pl-4">
                              {paymentOrders.map(payment => (
                                <div key={payment.id} className="rounded-lg bg-green-50 border border-green-100 px-3 py-2 text-xs text-slate-700">
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                    <span className="font-bold">{payment.id} • {new Date(payment.date).toLocaleString()} • {payment.eventName || payment.groupName || order.eventName || '-'}</span>
                                    <span className="flex items-center gap-2 sm:justify-end">
                                      <span className="font-black text-green-700">{getOrderRevenue(payment).toLocaleString()}đ</span>
                                      {canEdit && (
                                        <button
                                          onClick={() => openPaymentEdit(payment)}
                                          className="px-2 py-1 bg-white border border-green-200 rounded text-green-700 font-bold"
                                        >
                                          <Pencil size={12} className="inline mr-1" /> Sửa
                                        </button>
                                      )}
                                      {canDelete && (
                                        <button
                                          onClick={() => {
                                            if (!onDeleteSaleOrder) return;
                                            const confirmDelete = window.confirm(`Xóa giao dịch ${payment.id}?`);
                                            if (!confirmDelete) return;
                                            onDeleteSaleOrder(payment.id);
                                          }}
                                          className="px-2 py-1 bg-red-50 border border-red-100 rounded text-red-600 font-bold"
                                        >
                                          <Trash2 size={12} className="inline mr-1" /> Xóa
                                        </button>
                                      )}
                                    </span>
                                  </div>
                                  <div className="mt-1 text-slate-500">
                                    {(payment.items || []).map(item => `${item.name} x ${item.soldQuantity ?? item.quantity ?? 0}`).join(' • ')}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {orderReturns.length > 0 && (
                            <div className="mt-3 space-y-2 border-l-2 border-slate-100 pl-4">
                              {orderReturns.map(ret => (
                                <div key={ret.id} className="flex items-center justify-between text-xs text-slate-500">
                                  <span>Trả: {ret.id} • {new Date(ret.date).toLocaleString()}</span>
                                  <span className="font-bold text-slate-700">
                                    {(ret.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0).toLocaleString()} sản phẩm
                                  </span>
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
                    <span className="font-bold">
                      {(order.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0).toLocaleString()} sản phẩm
                    </span>
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
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
                  <input
                    value={scanSold}
                    onChange={e => setScanSold(e.target.value)}
                    onKeyDown={e => {
                      if (!canEdit) return;
                      if (e.key === 'Enter') {
                        const matched = findItemByBarcode(openOrder, scanSold);
                        if (!matched) { alert('Không tìm thấy sản phẩm theo barcode.'); return; }
                        const maxQty = matched.quantity ?? 0;
                        const current = editingItems[matched.itemId]?.quantity ?? matched.soldQuantity ?? 0;
                        const nextQty = Math.min(maxQty, current + 1);
                        setEditingItems(prev => ({
                          ...prev,
                          [matched.itemId]: {
                            ...(prev[matched.itemId] || { quantity: matched.soldQuantity ?? 0, discount: matched.discount || 0, discountPercent: matched.discountPercent || 0 }),
                            quantity: nextQty
                          }
                        }));
                        setScanSold('');
                      }
                    }}
                    placeholder="Quét barcode để cộng SL bán"
                    className="border rounded px-3 py-2 w-full sm:max-w-xs"
                    disabled={!canEdit}
                  />
                  <span className="text-xs text-slate-500">Enter sau khi quét để +1 số lượng</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {openOrder.items.map((it: any, idx: number) => {
                    const edited = editingItems[it.itemId];
                    const quantity = edited?.quantity ?? it.soldQuantity ?? 0;
                    const discount = edited?.discount ?? it.discount ?? 0;
                    const discountPercent = edited?.discountPercent ?? it.discountPercent ?? 0;
                    const lineTotal = calcLineTotal(it.price || 0, quantity || 0, discount, discountPercent);
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
                            onChange={e => setEditingItems(prev => ({ ...prev, [it.itemId]: { ...(prev[it.itemId] || { quantity: it.soldQuantity ?? 0, discount: it.discount || 0, discountPercent: it.discountPercent || 0 }), quantity: Number(e.target.value) } }))}
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
                            onChange={e => setEditingItems(prev => ({ ...prev, [it.itemId]: { ...(prev[it.itemId] || { quantity: it.quantity, discount: it.discount || 0, discountPercent: it.discountPercent || 0 }), discount: Number(e.target.value) } }))}
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
                            onChange={e => setEditingItems(prev => ({ ...prev, [it.itemId]: { ...(prev[it.itemId] || { quantity: it.quantity, discount: it.discount || 0, discountPercent: it.discountPercent || 0 }), discountPercent: Number(e.target.value) } }))}
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
              <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 flex-shrink-0">
                {(() => {
                  const previewItems = openOrder.items.map((it: any) => {
                    const edit = editingItems[it.itemId];
                    const qty = edit ? edit.quantity : (it.soldQuantity ?? 0);
                    const discount = edit ? edit.discount : (it.discount || 0);
                    const discountPercent = edit ? edit.discountPercent : (it.discountPercent || 0);
                    return Math.max(0, calcLineTotal(it.price || 0, qty || 0, discount, discountPercent));
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
                {canEdit && (
                  <button onClick={() => {
                    const updatedItems = openOrder.items.map((it: any) => {
                      const edit = editingItems[it.itemId];
                      const qty = edit ? edit.quantity : (it.soldQuantity ?? 0);
                      const discount = edit ? edit.discount : (it.discount || 0);
                      const discountPercent = edit ? edit.discountPercent : (it.discountPercent || 0);
                      if (Number.isNaN(qty)) {
                        return { ...it, soldQuantity: 0, discount, discountPercent, lineTotal: 0 };
                      }
                      const lineTotal = Math.max(0, calcLineTotal(it.price || 0, qty, discount, discountPercent));
                      return { ...it, soldQuantity: qty, discount, discountPercent, lineTotal };
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
                )}
                </div>
              </div>
            </div>
          </div>
        )}

        {editingPaymentOrder && (
          <div className="fixed inset-0 bg-black/40 z-60 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-3xl p-6 max-h-[85vh] flex flex-col shadow-2xl">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-bold">Sửa giao dịch {editingPaymentOrder.id}</h3>
                  <div className="text-xs text-slate-500">Phiếu xuất gốc: {editingPaymentOrder.relatedOrderId || '-'}</div>
                </div>
                <button onClick={closePaymentEdit}><X size={18} /></button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs font-bold text-slate-500">Ngày giờ bán</label>
                  <input
                    type="datetime-local"
                    value={editingPaymentMeta.date}
                    onChange={e => setEditingPaymentMeta(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full border rounded p-2"
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500">Sự kiện ghi doanh thu</label>
                  <select
                    value={editingPaymentMeta.eventId}
                    onChange={e => setEditingPaymentMeta(prev => ({ ...prev, eventId: e.target.value }))}
                    className="w-full border rounded p-2"
                    disabled={!canEdit}
                  >
                    <option value="">Không gắn sự kiện</option>
                    {events.map(event => (
                      <option key={event.id} value={event.id}>{event.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500">Khách hàng</label>
                  <input
                    value={editingPaymentMeta.customerName}
                    onChange={e => setEditingPaymentMeta(prev => ({ ...prev, customerName: e.target.value }))}
                    className="w-full border rounded p-2"
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500">Liên hệ</label>
                  <input
                    value={editingPaymentMeta.customerContact}
                    onChange={e => setEditingPaymentMeta(prev => ({ ...prev, customerContact: e.target.value }))}
                    className="w-full border rounded p-2"
                    disabled={!canEdit}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-slate-500">Ghi chú</label>
                  <textarea
                    value={editingPaymentMeta.note}
                    onChange={e => setEditingPaymentMeta(prev => ({ ...prev, note: e.target.value }))}
                    className="w-full border rounded p-2"
                    disabled={!canEdit}
                  />
                </div>
              </div>

              <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                {(editingPaymentOrder.items || []).map(item => {
                  const draft = editingPaymentItems[item.itemId] || { quantity: item.soldQuantity ?? item.quantity ?? 0, discount: item.discount || 0, discountPercent: item.discountPercent || 0 };
                  const lineTotal = calcLineTotal(item.price || 0, draft.quantity || 0, draft.discount || 0, draft.discountPercent || 0);
                  return (
                    <div key={item.itemId} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center border-b py-2">
                      <div className="md:col-span-4">
                        <div className="font-bold text-sm">{item.name}</div>
                        <div className="text-xs text-slate-500">{item.barcode || item.itemId}</div>
                      </div>
                      <div className="text-sm md:col-span-2">{(item.price || 0).toLocaleString()}đ</div>
                      <div className="md:col-span-2">
                        <label className="text-xs text-slate-500">SL bán</label>
                        <input
                          type="number"
                          min={0}
                          value={draft.quantity}
                          onChange={e => setEditingPaymentItems(prev => ({ ...prev, [item.itemId]: { ...draft, quantity: Number(e.target.value) } }))}
                          className="w-full border rounded p-2"
                          disabled={!canEdit}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs text-slate-500">CK tiền</label>
                        <input
                          type="number"
                          min={0}
                          value={draft.discount}
                          onChange={e => setEditingPaymentItems(prev => ({ ...prev, [item.itemId]: { ...draft, discount: Number(e.target.value) } }))}
                          className="w-full border rounded p-2"
                          disabled={!canEdit}
                        />
                      </div>
                      <div className="md:col-span-1">
                        <label className="text-xs text-slate-500">% CK</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={draft.discountPercent}
                          onChange={e => setEditingPaymentItems(prev => ({ ...prev, [item.itemId]: { ...draft, discountPercent: Number(e.target.value) } }))}
                          className="w-full border rounded p-2"
                          disabled={!canEdit}
                        />
                      </div>
                      <div className="md:col-span-1 text-right font-black text-green-700">{lineTotal.toLocaleString()}đ</div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-sm text-slate-600">
                  Tổng mới: <span className="font-black text-green-700">
                    {(editingPaymentOrder.items || []).reduce((sum, item) => {
                      const draft = editingPaymentItems[item.itemId] || { quantity: item.soldQuantity ?? item.quantity ?? 0, discount: item.discount || 0, discountPercent: item.discountPercent || 0 };
                      return sum + calcLineTotal(item.price || 0, draft.quantity || 0, draft.discount || 0, draft.discountPercent || 0);
                    }, 0).toLocaleString()}đ
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={closePaymentEdit} className="px-4 py-2">Đóng</button>
                  {canEdit && (
                    <button
                      onClick={() => {
                        if (!onCreateSaleOrder || !editingPaymentOrder) return;
                        const selectedEvent = events.find(event => event.id === editingPaymentMeta.eventId);
                        const updatedItems = (editingPaymentOrder.items || []).map(item => {
                          const draft = editingPaymentItems[item.itemId] || { quantity: item.soldQuantity ?? item.quantity ?? 0, discount: item.discount || 0, discountPercent: item.discountPercent || 0 };
                          const quantity = Math.max(0, Number(draft.quantity) || 0);
                          const discount = Math.max(0, Number(draft.discount) || 0);
                          const discountPercent = Math.min(100, Math.max(0, Number(draft.discountPercent) || 0));
                          const lineTotal = calcLineTotal(item.price || 0, quantity, discount, discountPercent);
                          return { ...item, quantity, soldQuantity: quantity, discount, discountPercent, lineTotal };
                        }).filter(item => item.quantity > 0);
                        if (updatedItems.length === 0) { alert('Giao dịch phải có ít nhất 1 sản phẩm. Nếu muốn bỏ giao dịch, hãy dùng nút Xóa.'); return; }
                        const subtotal = updatedItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
                        const updatedOrder: SaleOrder = {
                          ...editingPaymentOrder,
                          date: editingPaymentMeta.date ? new Date(editingPaymentMeta.date).toISOString() : editingPaymentOrder.date,
                          customerName: editingPaymentMeta.customerName,
                          customerContact: editingPaymentMeta.customerContact,
                          note: editingPaymentMeta.note,
                          eventId: selectedEvent?.id,
                          eventName: selectedEvent?.name,
                          groupType: selectedEvent ? 'EVENT' : editingPaymentOrder.groupType,
                          groupId: selectedEvent?.id || editingPaymentOrder.groupId,
                          groupName: selectedEvent?.name || editingPaymentOrder.groupName,
                          items: updatedItems,
                          subtotal,
                          orderDiscount: 0,
                          total: subtotal,
                          status: 'FINALIZED'
                        };
                        onCreateSaleOrder(updatedOrder);
                        closePaymentEdit();
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded font-bold"
                    >
                      Lưu
                    </button>
                  )}
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
                <button onClick={() => { setShowReturnModal(false); setOpenOrder(null); setReturnDiscounts({}); }}><X size={18}/></button>
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-1 gap-2">
                  {openOrder.items.map((it: any, idx: number) => {
                    const orderReturns = returnsByOrderId[openOrder.id] || [];
                    const alreadyReturnedQty = orderReturns.reduce((a, r) => a + ((r.items || []).reduce((s: number, ri: any) => s + (ri.itemId === it.itemId ? (ri.quantity || 0) : 0), 0)), 0);
                    const soldQty = getLinkedSoldQuantity(openOrder, it.itemId);
                    const maxAllowed = Math.max(0, (it.quantity || 0) - soldQty - alreadyReturnedQty);
                    const returnDiscount = returnDiscounts[it.itemId]?.discount || 0;
                    const returnDiscountPercent = returnDiscounts[it.itemId]?.discountPercent || 0;
                    const oldDiscountPercent = it.discountPercent || 0;
                    const oldDiscountLabel = `${(it.discount || 0).toLocaleString()}đ${oldDiscountPercent ? ` (${oldDiscountPercent}%)` : ''}`;
                    const lineTotal = calcLineTotal(it.price || 0, returnSelection[it.itemId] || 0, returnDiscount, returnDiscountPercent);
                    return (
                      <div key={idx} className="grid grid-cols-8 gap-2 items-center border-b py-2">
                        <div className="col-span-2">
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
                          disabled={maxAllowed === 0 || !canEdit}
                        />
                        </div>
                        <div>
                          <label className="text-xs">CK trả</label>
                          <input
                            type="number"
                            min={0}
                            value={returnDiscount}
                            onChange={e => setReturnDiscounts(prev => ({ ...prev, [it.itemId]: { ...(prev[it.itemId] || { discount: 0, discountPercent: 0 }), discount: Number(e.target.value) } }))}
                            className="w-24 border p-1 rounded"
                            disabled={maxAllowed === 0 || !canEdit}
                          />
                        </div>
                        <div>
                          <label className="text-xs">% CK trả</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={returnDiscountPercent}
                            onChange={e => setReturnDiscounts(prev => ({ ...prev, [it.itemId]: { ...(prev[it.itemId] || { discount: 0, discountPercent: 0 }), discountPercent: Number(e.target.value) } }))}
                            className="w-20 border p-1 rounded"
                            disabled={maxAllowed === 0 || !canEdit}
                          />
                        </div>
                        <div className="text-xs text-slate-400">Còn trả tối đa: {maxAllowed} • CK bán cũ: {oldDiscountLabel}</div>
                        <div className="text-right font-black">{lineTotal.toLocaleString()}đ</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-3 text-sm">
                <input
                  value={scanReturn}
                  onChange={e => setScanReturn(e.target.value)}
                  onKeyDown={e => {
                    if (!canEdit) return;
                    if (e.key === 'Enter') {
                      const matched = findItemByBarcode(openOrder, scanReturn);
                      if (!matched) { alert('Không tìm thấy sản phẩm theo barcode.'); return; }
                      const orderReturns = returnsByOrderId[openOrder.id] || [];
                      const alreadyReturnedQty = orderReturns.reduce((a, r) => a + ((r.items || []).reduce((s: number, ri: any) => s + (ri.itemId === matched.itemId ? (ri.quantity || 0) : 0), 0)), 0);
                      const soldQty = getLinkedSoldQuantity(openOrder, matched.itemId);
                      const maxAllowed = Math.max(0, (matched.quantity || 0) - soldQty - alreadyReturnedQty);
                      const current = returnSelection[matched.itemId] || 0;
                      if (maxAllowed <= 0) { alert('Đã đạt số lượng tối đa có thể trả.'); return; }
                      const nextQty = Math.min(maxAllowed, current + 1);
                      setReturnSelection(prev => ({ ...prev, [matched.itemId]: nextQty }));
                      setScanReturn('');
                    }
                  }}
                  placeholder="Quét barcode để cộng SL trả"
                  className="border rounded px-3 py-2 w-full sm:max-w-xs"
                  disabled={!canEdit}
                />
                <span className="text-xs text-slate-500">Enter sau khi quét để +1 số lượng trả</span>
              </div>
              <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 flex-shrink-0">
                {(() => {
                  const orderReturns = returnsByOrderId[openOrder.id] || [];
                  const canComplete = (openOrder.items || []).every((it: any) => {
                    const alreadyReturnedQty = orderReturns.reduce((a, r) => a + ((r.items || []).reduce((s: number, ri: any) => s + (ri.itemId === it.itemId ? (ri.quantity || 0) : 0), 0)), 0);
                    const soldQty = getLinkedSoldQuantity(openOrder, it.itemId);
                    return (soldQty + alreadyReturnedQty) >= (it.quantity || 0);
                  });
                  return (
                    <div className="text-xs text-slate-500">
                      {canComplete ? 'Đủ điều kiện hoàn tất đơn hàng (Xuất = Bán + Trả).' : 'Chưa đủ điều kiện hoàn tất đơn hàng.'}
                    </div>
                  );
                })()}
                <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => { setShowReturnModal(false); setOpenOrder(null); setReturnDiscounts({}); }} className="px-4 py-2">Hủy</button>
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
                {canEdit && (
                  <button onClick={() => {
                    const orderReturns = returnsByOrderId[openOrder.id] || [];
                    const built: any[] = [];
                    for (const it of (openOrder.items || [])) {
                      const alreadyReturnedQty = orderReturns.reduce((a, r) => a + ((r.items || []).reduce((s: number, ri: any) => s + (ri.itemId === it.itemId ? (ri.quantity || 0) : 0), 0)), 0);
                      const soldQty = getLinkedSoldQuantity(openOrder, it.itemId);
                      const maxAllowed = Math.max(0, (it.quantity || 0) - soldQty - alreadyReturnedQty);
                      const qty = returnSelection[it.itemId] || 0;
                      if (qty > 0) {
                        if (qty > maxAllowed) { alert(`Số lượng trả cho "${it.name}" vượt quá số đã xuất còn lại (${maxAllowed}).`); return; }
                        const discount = returnDiscounts[it.itemId]?.discount || 0;
                        const discountPercent = returnDiscounts[it.itemId]?.discountPercent || 0;
                        const lineTotal = 0;
                        built.push({ itemId: it.itemId, barcode: it.barcode, name: it.name, price: it.price, quantity: qty, discount, discountPercent, lineTotal });
                      }
                    }
                    const canComplete = (openOrder.items || []).every((it: any) => {
                      const alreadyReturnedQty = orderReturns.reduce((a, r) => a + ((r.items || []).reduce((s: number, ri: any) => s + (ri.itemId === it.itemId ? (ri.quantity || 0) : 0), 0)), 0);
                      const soldQty = getLinkedSoldQuantity(openOrder, it.itemId);
                      return (soldQty + alreadyReturnedQty) >= (it.quantity || 0);
                    });
                    if (built.length === 0 && !canComplete) { alert('Chưa chọn sản phẩm trả.'); return; }
                    if (built.length === 0 && canComplete) {
                      if (onCreateSaleOrder) onCreateSaleOrder({ ...openOrder });
                      setShowReturnModal(false); setOpenOrder(null); setReturnSelection({}); setReturnDiscounts({});
                      alert('Đã hoàn tất đơn hàng.');
                      return;
                    }
                    const subtotal = 0;
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
                    setShowReturnModal(false); setOpenOrder(null); setReturnSelection({}); setReturnDiscounts({});
                    alert('Đã tạo đơn trả hàng.');
                  }} className="px-4 py-2 bg-yellow-600 text-white rounded">Tạo trả hàng</button>
                )}
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
