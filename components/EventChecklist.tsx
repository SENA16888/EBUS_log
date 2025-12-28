import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChecklistDirection, ChecklistStatus, ChecklistSignature, Event, EventChecklist as EventChecklistType, InventoryItem } from '../types';
import { createEmptyChecklist, normalizeChecklist } from '../services/checklistService';
import { normalizeBarcode } from '../services/barcodeService';
import { Barcode, CheckSquare, ClipboardList, CornerDownLeft, Eraser, PenLine, ScanBarcode } from 'lucide-react';

interface EventChecklistProps {
  event: Event;
  inventory: InventoryItem[];
  onScan: (payload: { eventId: string; barcode: string; direction: ChecklistDirection; status?: ChecklistStatus; quantity?: number; note?: string }) => void;
  onUpdateNote?: (eventId: string, itemId: string, note: string) => void;
  onSaveSignature?: (eventId: string, payload: { direction: ChecklistDirection; manager?: ChecklistSignature; operator?: ChecklistSignature; note?: string; itemsSnapshot?: { itemId: string; name?: string; orderQty: number; scannedOut: number; scannedIn: number; damaged: number; lost: number; missing: number; }[]; createSlip?: boolean }) => void;
}

const SignaturePad: React.FC<{ value?: string; onChange: (dataUrl: string | null) => void }> = ({ value, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (value) {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          };
          img.src = value;
        }
      }
    }
  }, [value]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    setHasDrawn(true);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onChange(dataUrl);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        className="w-full h-40 border-2 border-dashed border-slate-200 rounded-xl bg-white"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <div className="flex justify-between items-center text-xs text-slate-500">
        <span>{hasDrawn ? 'Đã ghi nhận chữ ký' : 'Ký trực tiếp trên khung'}</span>
        <button type="button" onClick={handleClear} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold">
          <Eraser size={14} /> Xóa
        </button>
      </div>
    </div>
  );
};

export const EventChecklist: React.FC<EventChecklistProps> = ({ event, inventory, onScan, onUpdateNote, onSaveSignature }) => {
  const [scanValue, setScanValue] = useState('');
  const [direction, setDirection] = useState<ChecklistDirection>('OUT');
  const [status, setStatus] = useState<ChecklistStatus>('OK');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [managerName, setManagerName] = useState('');
  const [managerTitle, setManagerTitle] = useState('');
  const [managerSignatureData, setManagerSignatureData] = useState<string | null>(null);
  const [operatorName, setOperatorName] = useState('');
  const [operatorTitle, setOperatorTitle] = useState('');
  const [operatorSignatureData, setOperatorSignatureData] = useState<string | null>(null);
  const [signNote, setSignNote] = useState('');

  const inputRef = useRef<HTMLInputElement | null>(null);

  const checklist: EventChecklistType = useMemo(
    () => normalizeChecklist(event.checklist || createEmptyChecklist()),
    [event.checklist]
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, [direction]);

  useEffect(() => {
    const key = direction === 'OUT' ? 'outbound' : 'inbound';
    const pair = event.checklist?.signatures?.[key];
    if (pair) {
      setManagerName(pair.manager?.name || '');
      setManagerTitle(pair.manager?.title || '');
      setManagerSignatureData(pair.manager?.dataUrl || null);
      setOperatorName(pair.operator?.name || '');
      setOperatorTitle(pair.operator?.title || '');
      setOperatorSignatureData(pair.operator?.dataUrl || null);
      setSignNote(pair.note || '');
    } else {
      setManagerName('');
      setManagerTitle('');
      setManagerSignatureData(null);
      setOperatorName('');
      setOperatorTitle('');
      setOperatorSignatureData(null);
      setSignNote('');
    }
  }, [direction, event.checklist?.signatures]);

  const itemIds = useMemo(() => {
    const ids = new Set<string>();
    event.items.forEach(it => ids.add(it.itemId));
    Object.keys(checklist.outbound || {}).forEach(id => ids.add(id));
    Object.keys(checklist.inbound || {}).forEach(id => ids.add(id));
    Object.keys(checklist.damaged || {}).forEach(id => ids.add(id));
    Object.keys(checklist.lost || {}).forEach(id => ids.add(id));
    return Array.from(ids);
  }, [event.items, checklist]);

  const rows = useMemo(() => itemIds.map(itemId => {
    const inv = inventory.find(i => i.id === itemId);
    const alloc = event.items.find(ai => ai.itemId === itemId);
    const orderQty = alloc?.quantity || 0;
    const scannedOut = checklist.outbound[itemId] || 0;
    const scannedIn = checklist.inbound[itemId] || 0;
    const damaged = checklist.damaged[itemId] || 0;
    const lost = checklist.lost[itemId] || 0;
    const missing = Math.max(0, orderQty - scannedIn - lost);
    return {
      itemId,
      barcode: inv?.barcode,
      name: inv?.name || 'Không tìm thấy trong kho',
      orderQty,
      scannedOut,
      scannedIn,
      damaged,
      lost,
      missing,
      note: checklist.notes[itemId] || ''
    };
  }), [itemIds, checklist, inventory, event.items]);

  const totals = useMemo(() => {
    return rows.reduce((acc, row) => {
      acc.expected += row.orderQty;
      acc.out += row.scannedOut;
      acc.in += row.scannedIn;
      acc.missing += row.missing;
      acc.damaged += row.damaged;
      acc.lost += row.lost;
      return acc;
    }, { expected: 0, out: 0, in: 0, missing: 0, damaged: 0, lost: 0 });
  }, [rows]);

  const matchedItem = useMemo(() => {
    if (!scanValue.trim()) return null;
    const normalized = normalizeBarcode(scanValue.trim());
    return (
      inventory.find(inv => inv.barcode && normalizeBarcode(inv.barcode) === normalized) ||
      inventory.find(inv => normalizeBarcode(inv.id) === normalized) ||
      null
    );
  }, [scanValue, inventory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanValue.trim()) return;
    const finalQty = Math.max(1, quantity || 1);
    onScan({
      eventId: event.id,
      barcode: scanValue,
      direction,
      status: direction === 'OUT' ? 'OK' : status,
      quantity: finalQty,
      note: note.trim() || undefined
    });
    setScanValue('');
    setQuantity(1);
    if (direction === 'OUT') setNote('');
    inputRef.current?.focus();
  };

  const handleQuickStatus = (itemId: string, barcode: string | undefined, status: ChecklistStatus) => {
    onScan({
      eventId: event.id,
      barcode: barcode || itemId,
      direction: 'IN',
      status,
      quantity: 1,
      note: checklist.notes[itemId]
    });
  };

  const handleNoteBlur = (itemId: string, value: string) => {
    onUpdateNote?.(event.id, itemId, value);
  };

  const handleSaveSignature = (role: 'OPERATOR' | 'MANAGER', createSlip?: boolean) => {
    if (!onSaveSignature) return;
    const snapshot = rows.map(row => ({
      itemId: row.itemId,
      name: row.name,
      orderQty: row.orderQty,
      scannedOut: row.scannedOut,
      scannedIn: row.scannedIn,
      damaged: row.damaged,
      lost: row.lost,
      missing: row.missing
    }));
    const payload: any = { direction, note: signNote.trim() || undefined, itemsSnapshot: snapshot, createSlip: createSlip ?? false };
    if (role === 'OPERATOR') {
      if (!operatorName.trim() || !operatorSignatureData) {
        alert('Vui lòng nhập tên và chữ ký của Người lập phiếu/kiểm hàng.');
        return;
      }
      payload.operator = {
        name: operatorName.trim(),
        title: operatorTitle.trim() || undefined,
        note: signNote.trim() || undefined,
        signedAt: new Date().toISOString(),
        dataUrl: operatorSignatureData,
        direction
      };
    } else {
      if (!managerName.trim() || !managerSignatureData) {
        alert('Vui lòng nhập tên và chữ ký của Quản lý kho.');
        return;
      }
      payload.manager = {
        name: managerName.trim(),
        title: managerTitle.trim() || undefined,
        note: signNote.trim() || undefined,
        signedAt: new Date().toISOString(),
        dataUrl: managerSignatureData,
        direction
      };
    }
    onSaveSignature(event.id, payload);
  };

  const handleCreateSlip = () => {
    if (!onSaveSignature) return;
    if (!managerName.trim() || !managerSignatureData || !operatorName.trim() || !operatorSignatureData) {
      alert('Cần đủ chữ ký của Quản lý kho và Người lập phiếu trước khi xuất phiếu.');
      return;
    }
    const snapshot = rows.map(row => ({
      itemId: row.itemId,
      name: row.name,
      orderQty: row.orderQty,
      scannedOut: row.scannedOut,
      scannedIn: row.scannedIn,
      damaged: row.damaged,
      lost: row.lost,
      missing: row.missing
    }));
    onSaveSignature(event.id, {
      direction,
      manager: {
        name: managerName.trim(),
        title: managerTitle.trim() || undefined,
        note: signNote.trim() || undefined,
        signedAt: new Date().toISOString(),
        dataUrl: managerSignatureData,
        direction
      },
      operator: {
        name: operatorName.trim(),
        title: operatorTitle.trim() || undefined,
        note: signNote.trim() || undefined,
        signedAt: new Date().toISOString(),
        dataUrl: operatorSignatureData,
        direction
      },
      note: signNote.trim() || undefined,
      itemsSnapshot: snapshot,
      createSlip: true
    });
  };
  const slips = checklist.slips || [];

  const handleViewSlip = (slipId: string) => {
    const slip = slips.find(s => s.id === slipId);
    if (!slip) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const rowsHtml = slip.items.map(item => `
      <tr>
        <td style="padding:6px;border:1px solid #e2e8f0">${item.name || item.itemId}</td>
        <td style="padding:6px;border:1px solid #e2e8f0;text-align:center">${item.orderQty}</td>
        <td style="padding:6px;border:1px solid #e2e8f0;text-align:center">${item.scannedOut}</td>
        <td style="padding:6px;border:1px solid #e2e8f0;text-align:center">${item.scannedIn}</td>
        <td style="padding:6px;border:1px solid #e2e8f0;text-align:center">${item.damaged}</td>
        <td style="padding:6px;border:1px solid #e2e8f0;text-align:center">${item.lost}</td>
        <td style="padding:6px;border:1px solid #e2e8f0;text-align:center">${item.missing}</td>
      </tr>
    `).join('');
    win.document.write(`
      <html>
        <head>
          <title>Phiếu ${slip.direction === 'OUT' ? 'xuất kho' : 'trả kho'} - ${event.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; color: #0f172a; }
            h1 { margin: 0 0 4px 0; }
            .muted { color: #475569; font-size: 12px; }
            table { border-collapse: collapse; width: 100%; margin-top: 12px; font-size: 13px; }
            .sig { display: flex; gap: 32px; margin-top: 20px; }
            .sig-box { flex:1; text-align: center; }
            .sig-img { width: 160px; height: 80px; object-fit: contain; border: 1px solid #e2e8f0; }
          </style>
        </head>
        <body>
          <h1>Phiếu ${slip.direction === 'OUT' ? 'xuất kho' : 'trả kho'}</h1>
          <div class="muted">${event.name} • ${event.client}</div>
          <div class="muted">Thời gian: ${new Date(slip.createdAt).toLocaleString('vi-VN')}</div>
          <div class="muted">Ghi chú: ${slip.note || '---'}</div>
          <table>
            <thead>
              <tr>
                <th style="padding:6px;border:1px solid #e2e8f0;text-align:left">Thiết bị</th>
                <th style="padding:6px;border:1px solid #e2e8f0">Order</th>
                <th style="padding:6px;border:1px solid #e2e8f0">Đã quét đi</th>
                <th style="padding:6px;border:1px solid #e2e8f0">Đã về</th>
                <th style="padding:6px;border:1px solid #e2e8f0">Hỏng</th>
                <th style="padding:6px;border:1px solid #e2e8f0">Mất</th>
                <th style="padding:6px;border:1px solid #e2e8f0">Thiếu</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div class="sig">
            <div class="sig-box">
              <div class="muted">Quản lý kho</div>
              ${slip.manager?.dataUrl ? `<img class="sig-img" src="${slip.manager.dataUrl}" />` : '<div class="sig-img"></div>'}
              <div>${slip.manager?.name || ''}</div>
              <div class="muted">${slip.manager?.title || ''}</div>
            </div>
            <div class="sig-box">
              <div class="muted">Người lập phiếu / Kiểm hàng</div>
              ${slip.operator?.dataUrl ? `<img class="sig-img" src="${slip.operator.dataUrl}" />` : '<div class="sig-img"></div>'}
              <div>${slip.operator?.name || ''}</div>
              <div class="muted">${slip.operator?.title || ''}</div>
            </div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Checklist barcode</p>
              <h3 className="text-lg font-black text-slate-800">Xuất / Thu hồi hàng hóa</h3>
            </div>
            <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-2 rounded-xl text-xs font-semibold">
              <ScanBarcode size={16}/> Máy quét sẵn sàng
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setDirection('OUT')} className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 ${direction === 'OUT' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <CheckSquare size={14}/> Quét hàng đi
              </button>
              <button type="button" onClick={() => setDirection('IN')} className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 ${direction === 'IN' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <CornerDownLeft size={14}/> Check hàng về
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-3">
                <label className="text-[10px] font-black text-slate-400 uppercase">Mã barcode / ID</label>
                <input
                  ref={inputRef}
                  value={scanValue}
                  onChange={e => setScanValue(normalizeBarcode(e.target.value))}
                  className="w-full border-2 border-slate-200 rounded-xl p-3 text-xl font-mono tracking-widest"
                  placeholder="Quét mã hoặc nhập tay..."
                  autoFocus
                />
                {matchedItem && (
                  <div className="mt-1 p-2 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-2 text-xs">
                    <div className="font-bold text-slate-800">{matchedItem.name}</div>
                    <div className="text-slate-500">({matchedItem.id})</div>
                    <div className="text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Kho: {matchedItem.availableQuantity}</div>
                  </div>
                )}
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase">Số lượng</label>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={e => setQuantity(Number(e.target.value))}
                  className="w-full border-2 border-slate-200 rounded-xl p-3 text-center text-lg font-black"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase">Tình trạng</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as ChecklistStatus)}
                  className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-semibold"
                  disabled={direction === 'OUT'}
                >
                  <option value="OK">OK</option>
                  <option value="DAMAGED">Hỏng</option>
                  <option value="LOST">Mất / Thiếu</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase">Ghi chú</label>
              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm"
                placeholder="VD: Quét cho xe 29A-12345, tình trạng xước nhẹ..."
              />
            </div>

            <button type="submit" className="w-full bg-slate-800 text-white py-3 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-black flex items-center justify-center gap-2">
              <Barcode size={16}/> Ghi nhận
            </button>
          </form>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng quan</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
              <p className="text-[11px] font-semibold text-blue-600">Cần xuất</p>
              <p className="text-2xl font-black text-slate-800">{totals.expected}</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
              <p className="text-[11px] font-semibold text-emerald-600">Đã quét về</p>
              <p className="text-2xl font-black text-slate-800">{totals.in}</p>
            </div>
            <div className="p-3 rounded-xl bg-orange-50 border border-orange-100">
              <p className="text-[11px] font-semibold text-orange-600">Thiếu / Mất</p>
              <p className="text-2xl font-black text-orange-700">{totals.missing + totals.lost}</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
              <p className="text-[11px] font-semibold text-amber-600">Hỏng</p>
              <p className="text-2xl font-black text-amber-700">{totals.damaged}</p>
            </div>
          </div>
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-3 text-xs text-slate-600">
            Quét mã để đối chiếu với danh sách đặt hàng. Hệ thống tự tính thiếu / hỏng / mất dựa trên kết quả quét.
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase text-left">Barcode</th>
                <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase text-left">Thiết bị</th>
                <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase text-center">Order</th>
                <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase text-center">Đã quét đi</th>
                <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase text-center">Đã về</th>
                <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase text-center">Hỏng</th>
                <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase text-center">Mất</th>
                <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase text-center">Thiếu</th>
                <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase text-left">Ghi chú</th>
                <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase text-left w-40">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(row => (
                <tr key={row.itemId} className={row.missing > 0 || row.lost > 0 ? 'bg-orange-50/60' : ''}>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">{row.barcode || row.itemId}</td>
                  <td className="px-3 py-2">
                    <div className="font-bold text-slate-800">{row.name}</div>
                    <div className="text-[11px] text-slate-400">{row.itemId}</div>
                  </td>
                  <td className="px-3 py-2 text-center font-black text-slate-700">{row.orderQty}</td>
                  <td className="px-3 py-2 text-center font-black text-blue-600">{row.scannedOut}</td>
                  <td className="px-3 py-2 text-center font-black text-emerald-600">{row.scannedIn}</td>
                  <td className="px-3 py-2 text-center font-black text-amber-600">{row.damaged}</td>
                  <td className="px-3 py-2 text-center font-black text-red-600">{row.lost}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-2 py-1 rounded-lg text-[11px] font-black ${row.missing > 0 ? 'bg-orange-200 text-orange-800' : 'bg-emerald-100 text-emerald-700'}`}>
                      {row.missing > 0 ? `Thiếu ${row.missing}` : 'Đủ'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      defaultValue={row.note}
                      onBlur={e => handleNoteBlur(row.itemId, e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs"
                      placeholder="Ghi chú riêng cho mã này"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleQuickStatus(row.itemId, row.barcode, 'OK')}
                        className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold"
                      >
                        +1 OK
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickStatus(row.itemId, row.barcode, 'DAMAGED')}
                        className="px-2 py-1 rounded-lg bg-amber-100 text-amber-700 text-[11px] font-bold"
                      >
                        +1 Hỏng
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickStatus(row.itemId, row.barcode, 'LOST')}
                        className="px-2 py-1 rounded-lg bg-red-100 text-red-700 text-[11px] font-bold"
                      >
                        +1 Mất
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-slate-400 text-sm">Chưa có thiết bị nào để checklist. Thêm từ tab Thiết Bị trước.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nhật ký quét</p>
              <h4 className="font-bold text-slate-800">Lịch sử gần nhất</h4>
            </div>
            <ClipboardList size={18} className="text-slate-400" />
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
            {checklist.logs.length === 0 && (
              <div className="text-slate-400 text-sm italic">Chưa có lượt quét nào.</div>
            )}
            {checklist.logs.slice(0, 20).map(log => (
              <div key={log.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex justify-between items-center text-sm">
                <div>
                  <div className="font-bold text-slate-800">{log.itemName || log.itemId || 'Không tìm thấy'}</div>
                  <div className="text-[11px] text-slate-400">{log.barcode}</div>
                  {log.note && <div className="text-[12px] text-slate-600 mt-1">{log.note}</div>}
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">{log.direction === 'OUT' ? 'Hàng đi' : 'Hàng về'}</div>
                  <div className="text-sm font-black">{log.quantity} × {log.status}</div>
                  <div className="text-[11px] text-slate-400">{new Date(log.timestamp).toLocaleString('vi-VN')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chữ ký online</p>
              <h4 className="font-bold text-slate-800">Xác nhận {direction === 'OUT' ? 'phiếu xuất kho' : 'phiếu trả kho'}</h4>
            </div>
            <PenLine size={18} className="text-slate-400" />
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 border border-slate-200 rounded-xl">
                <p className="text-[11px] font-black text-slate-600 uppercase mb-2">Quản lý kho</p>
                <input
                  value={managerName}
                  onChange={e => setManagerName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 text-sm mb-2"
                  placeholder="Tên quản lý kho"
                />
                <input
                  value={managerTitle}
                  onChange={e => setManagerTitle(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 text-sm mb-2"
                  placeholder="Chức vụ / bộ phận"
                />
                <SignaturePad value={managerSignatureData || undefined} onChange={setManagerSignatureData} />
                <button
                  type="button"
                  onClick={() => handleSaveSignature('MANAGER', false)}
                  className="mt-2 w-full bg-slate-700 text-white py-2 rounded-lg text-sm font-bold hover:bg-slate-800"
                >
                  Lưu chữ ký Quản lý (chưa xuất phiếu)
                </button>
              </div>
              <div className="p-3 border border-slate-200 rounded-xl">
                <p className="text-[11px] font-black text-slate-600 uppercase mb-2">Người lập phiếu / Kiểm hàng</p>
                <input
                  value={operatorName}
                  onChange={e => setOperatorName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 text-sm mb-2"
                  placeholder="Tên người lập phiếu/kiểm hàng"
                />
                <input
                  value={operatorTitle}
                  onChange={e => setOperatorTitle(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 text-sm mb-2"
                  placeholder="Chức vụ / bộ phận"
                />
                <SignaturePad value={operatorSignatureData || undefined} onChange={setOperatorSignatureData} />
                <button
                  type="button"
                  onClick={() => handleSaveSignature('OPERATOR', false)}
                  className="mt-2 w-full bg-slate-700 text-white py-2 rounded-lg text-sm font-bold hover:bg-slate-800"
                >
                  Lưu chữ ký Người lập phiếu (chưa xuất phiếu)
                </button>
              </div>
            </div>
            <textarea
              value={signNote}
              onChange={e => setSignNote(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-2 text-sm"
              placeholder="Ghi chú thêm trên phiếu"
              rows={2}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCreateSlip}
                className="w-full bg-blue-600 text-white py-2 rounded-xl font-bold hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <PenLine size={16}/> Xuất phiếu {direction === 'OUT' ? 'xuất kho' : 'trả kho'} (cần đủ 2 chữ ký)
              </button>
            </div>
            {slips.length > 0 && (
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                <p className="text-[11px] font-black text-slate-600 uppercase mb-2">Lịch sử phiếu</p>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {slips.map(slip => (
                    <div key={slip.id} className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-800">{slip.direction === 'OUT' ? 'Phiếu xuất kho' : 'Phiếu trả kho'}</div>
                        <div className="text-[11px] text-slate-500">{new Date(slip.createdAt).toLocaleString('vi-VN')}</div>
                        <div className="text-[12px] text-slate-600">QL kho: {slip.manager?.name || '---'} • Lập phiếu: {slip.operator?.name || '---'}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleViewSlip(slip.id)}
                        className="text-blue-600 text-xs font-bold hover:underline"
                      >
                        Xem / In
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
