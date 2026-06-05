import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Barcode, CheckCircle2, ClipboardCheck, Download, History, PackageCheck, RotateCcw, Save, Search, XCircle } from 'lucide-react';
import { InventoryAuditBaseline, InventoryAuditItem, InventoryAuditSession, InventoryItem } from '../types';
import { findItemByBarcode, normalizeBarcode } from '../services/barcodeService';

type CountDraft = {
  countedQuantity: number;
  note?: string;
  updatedAt: string;
};

interface StocktakeManagerProps {
  inventory: InventoryItem[];
  audits: InventoryAuditSession[];
  onSaveAudit: (payload: {
    title: string;
    baseline: InventoryAuditBaseline;
    note?: string;
    items: InventoryAuditItem[];
    unknownBarcodes?: string[];
    summary: InventoryAuditSession['summary'];
  }) => void;
  canEdit?: boolean;
}

const getSystemQuantity = (item: InventoryItem, baseline: InventoryAuditBaseline) =>
  baseline === 'TOTAL' ? item.totalQuantity || 0 : item.availableQuantity || 0;

const buildSnapshot = (item: InventoryItem): InventoryAuditItem['snapshot'] => ({
  totalQuantity: item.totalQuantity || 0,
  availableQuantity: item.availableQuantity || 0,
  inUseQuantity: item.inUseQuantity || 0,
  maintenanceQuantity: item.maintenanceQuantity || 0,
  brokenQuantity: item.brokenQuantity || 0,
  lostQuantity: item.lostQuantity || 0
});

const formatNumber = (value: number) => value.toLocaleString('vi-VN');

export const StocktakeManager: React.FC<StocktakeManagerProps> = ({
  inventory,
  audits,
  onSaveAudit,
  canEdit = true
}) => {
  const [baseline, setBaseline] = useState<InventoryAuditBaseline>('AVAILABLE');
  const [scanCode, setScanCode] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantityDraft, setQuantityDraft] = useState(1);
  const [noteDraft, setNoteDraft] = useState('');
  const [counts, setCounts] = useState<Record<string, CountDraft>>({});
  const [barcodeAttached, setBarcodeAttached] = useState<Record<string, boolean>>({});
  const [unknownBarcodes, setUnknownBarcodes] = useState<string[]>([]);
  const [sessionTitle, setSessionTitle] = useState(() => `Kiểm kho ${new Date().toLocaleDateString('vi-VN')}`);
  const [sessionNote, setSessionNote] = useState('');
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const quantityInputRef = useRef<HTMLInputElement | null>(null);

  const inventoryMap = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    inventory.forEach(item => map.set(item.id, item));
    return map;
  }, [inventory]);

  const selectedItem = selectedItemId ? inventoryMap.get(selectedItemId) : undefined;

  const auditRows = useMemo<InventoryAuditItem[]>(() => {
    return inventory.map(item => {
      const counted = counts[item.id]?.countedQuantity;
      const systemQuantity = getSystemQuantity(item, baseline);
      const countedQuantity = typeof counted === 'number' ? counted : null;
      const variance = countedQuantity === null ? null : countedQuantity - systemQuantity;

      return {
        itemId: item.id,
        barcode: item.barcode,
        name: item.name,
        category: item.category,
        location: item.location,
        systemQuantity,
        countedQuantity,
        variance,
        barcodeAttached: !!barcodeAttached[item.id],
        note: counts[item.id]?.note,
        snapshot: buildSnapshot(item)
      };
    });
  }, [barcodeAttached, baseline, counts, inventory]);

  const summary = useMemo<InventoryAuditSession['summary']>(() => {
    const countedRows = auditRows.filter(row => row.countedQuantity !== null);
    const varianceRows = countedRows.filter(row => (row.variance || 0) !== 0);
    return {
      totalItems: auditRows.length,
      countedItems: countedRows.length,
      matchedItems: countedRows.filter(row => row.variance === 0).length,
      varianceItems: varianceRows.length,
      shortageItems: varianceRows.filter(row => (row.variance || 0) < 0).length,
      surplusItems: varianceRows.filter(row => (row.variance || 0) > 0).length,
      missingItems: auditRows.length - countedRows.length,
      shortageUnits: Math.abs(varianceRows.filter(row => (row.variance || 0) < 0).reduce((sum, row) => sum + (row.variance || 0), 0)),
      surplusUnits: varianceRows.filter(row => (row.variance || 0) > 0).reduce((sum, row) => sum + (row.variance || 0), 0)
    };
  }, [auditRows]);

  const filteredRows = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return auditRows;
    return auditRows.filter(row =>
      row.name.toLowerCase().includes(needle) ||
      row.itemId.toLowerCase().includes(needle) ||
      (row.barcode || '').toLowerCase().includes(needle) ||
      (row.category || '').toLowerCase().includes(needle)
    );
  }, [auditRows, searchTerm]);

  const discrepancyRows = useMemo(() =>
    auditRows.filter(row => row.countedQuantity !== null && (row.variance || 0) !== 0),
  [auditRows]);

  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!selectedItem) return;
    const existing = counts[selectedItem.id];
    setQuantityDraft(existing?.countedQuantity ?? getSystemQuantity(selectedItem, baseline));
    setNoteDraft(existing?.note || '');
  }, [baseline, counts, selectedItem]);

  const selectItem = (item: InventoryItem) => {
    setSelectedItemId(item.id);
    setTimeout(() => quantityInputRef.current?.focus(), 20);
  };

  const handleScanSubmit = (event?: React.FormEvent) => {
    event?.preventDefault();
    const code = normalizeBarcode(scanCode);
    if (!code) return;
    const found = findItemByBarcode(inventory, code);
    if (!found) {
      setUnknownBarcodes(prev => prev.includes(code) ? prev : [code, ...prev].slice(0, 30));
      setScanCode('');
      return;
    }
    selectItem(found);
    setScanCode('');
  };

  const applyCount = (mode: 'SET' | 'ADD' = 'SET') => {
    if (!selectedItem || !canEdit) return;
    const safeQty = Math.max(0, Math.round(Number(quantityDraft) || 0));
    setCounts(prev => {
      const current = prev[selectedItem.id]?.countedQuantity || 0;
      const nextQty = mode === 'ADD' ? current + safeQty : safeQty;
      return {
        ...prev,
        [selectedItem.id]: {
          countedQuantity: nextQty,
          note: noteDraft.trim() || undefined,
          updatedAt: new Date().toISOString()
        }
      };
    });
    setTimeout(() => scanInputRef.current?.focus(), 20);
  };

  const clearItemCount = (itemId: string) => {
    setCounts(prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const resetDraft = () => {
    if (!window.confirm('Xóa toàn bộ số lượng đã kiểm trong phiên đang nhập?')) return;
    setCounts({});
    setBarcodeAttached({});
    setUnknownBarcodes([]);
    setSelectedItemId('');
    setScanCode('');
    setSearchTerm('');
    setSessionNote('');
    setTimeout(() => scanInputRef.current?.focus(), 20);
  };

  const saveAudit = () => {
    if (!canEdit) return;
    if (summary.countedItems === 0) {
      alert('Vui lòng kiểm ít nhất 1 mã hàng trước khi lưu phiên.');
      return;
    }
    onSaveAudit({
      title: sessionTitle.trim() || `Kiểm kho ${new Date().toLocaleDateString('vi-VN')}`,
      baseline,
      note: sessionNote.trim() || undefined,
      items: auditRows,
      unknownBarcodes,
      summary
    });
    setCounts({});
    setBarcodeAttached({});
    setUnknownBarcodes([]);
    setSelectedItemId('');
    setSessionNote('');
    setSessionTitle(`Kiểm kho ${new Date().toLocaleDateString('vi-VN')}`);
    setTimeout(() => scanInputRef.current?.focus(), 20);
  };

  const exportCsv = () => {
    const headers = ['Ma hang', 'Barcode', 'Da dan barcode', 'Ten thiet bi', 'Danh muc', 'Vi tri', 'He thong', 'Thuc dem', 'Lech', 'Ghi chu'];
    const lines = auditRows.map(row => [
      row.itemId,
      row.barcode || '',
      row.barcodeAttached ? 'Co' : 'Khong',
      row.name,
      row.category,
      row.location || '',
      String(row.systemQuantity),
      row.countedQuantity === null ? '' : String(row.countedQuantity),
      row.variance === null ? '' : String(row.variance),
      row.note || ''
    ]);
    const csv = [headers, ...lines]
      .map(line => line.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kiem-kho-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const recentAudits = audits.slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Kiểm Kho</h2>
          <p className="text-sm text-slate-500 font-medium leading-snug">Quét barcode, nhập số lượng thực tế và đối chiếu lệch với số kho hệ thống.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50"
          >
            <Download size={15} /> CSV
          </button>
          <button
            type="button"
            onClick={resetDraft}
            disabled={!canEdit}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 disabled:opacity-50"
          >
            <RotateCcw size={15} /> Làm lại
          </button>
          <button
            type="button"
            onClick={saveAudit}
            disabled={!canEdit || summary.countedItems === 0}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest shadow-md hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={15} /> Lưu phiên
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <div className="bg-white border border-slate-100 rounded-xl p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Đã kiểm</p>
          <p className="text-2xl font-black text-blue-600">{summary.countedItems}<span className="text-xs text-slate-400">/{summary.totalItems}</span></p>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Khớp</p>
          <p className="text-2xl font-black text-emerald-600">{summary.matchedItems}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mã lệch</p>
          <p className="text-2xl font-black text-amber-600">{summary.varianceItems}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Thiếu</p>
          <p className="text-2xl font-black text-red-600">{summary.shortageUnits}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dư</p>
          <p className="text-2xl font-black text-cyan-600">{summary.surplusUnits}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Chưa kiểm</p>
          <p className="text-2xl font-black text-slate-700">{summary.missingItems}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mã lạ</p>
          <p className="text-2xl font-black text-orange-600">{unknownBarcodes.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-4 space-y-4">
          <section className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Barcode size={18} className="text-blue-600" />
              <h3 className="font-black text-slate-800 uppercase tracking-tight">Máy quét</h3>
            </div>
            <form onSubmit={handleScanSubmit} className="space-y-3">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Barcode</label>
              <div className="flex gap-2">
                <input
                  ref={scanInputRef}
                  value={scanCode}
                  onChange={event => setScanCode(event.target.value)}
                  className="flex-1 min-w-0 border-2 border-slate-100 rounded-xl px-4 py-3 text-lg font-mono tracking-widest focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
                  placeholder="Quét mã rồi Enter"
                  disabled={!canEdit}
                />
                <button type="submit" disabled={!canEdit} className="px-4 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest disabled:opacity-50">
                  Tìm
                </button>
              </div>
            </form>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBaseline('AVAILABLE')}
                className={`px-3 py-3 rounded-xl border text-[11px] font-black uppercase tracking-widest ${baseline === 'AVAILABLE' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}
              >
                Sẵn kho
              </button>
              <button
                type="button"
                onClick={() => setBaseline('TOTAL')}
                className={`px-3 py-3 rounded-xl border text-[11px] font-black uppercase tracking-widest ${baseline === 'TOTAL' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}
              >
                Tổng kho
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <input
                value={sessionTitle}
                onChange={event => setSessionTitle(event.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold"
                placeholder="Tên phiên kiểm"
                disabled={!canEdit}
              />
              <textarea
                value={sessionNote}
                onChange={event => setSessionNote(event.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
                rows={2}
                placeholder="Ghi chú phiên kiểm"
                disabled={!canEdit}
              />
            </div>
          </section>

          <section className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <PackageCheck size={18} className="text-emerald-600" />
              <h3 className="font-black text-slate-800 uppercase tracking-tight">Nhập số thực tế</h3>
            </div>

            {selectedItem ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-black text-slate-800">{selectedItem.name}</p>
                  <p className="text-[11px] font-mono text-slate-500">{selectedItem.barcode || selectedItem.id}</p>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                    <div className="bg-white rounded-lg p-2 border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase">Tổng</p>
                      <p className="font-black text-slate-800">{selectedItem.totalQuantity}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase">Sẵn</p>
                      <p className="font-black text-blue-600">{selectedItem.availableQuantity}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase">Đang dùng</p>
                      <p className="font-black text-amber-600">{selectedItem.inUseQuantity}</p>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">
                    Bảo trì {selectedItem.maintenanceQuantity || 0} • Hỏng {selectedItem.brokenQuantity || 0} • Mất {selectedItem.lostQuantity || 0}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Số lượng thực đếm</label>
                  <input
                    ref={quantityInputRef}
                    type="number"
                    min={0}
                    value={quantityDraft}
                    onChange={event => setQuantityDraft(Number(event.target.value))}
                    onKeyDown={event => {
                      if (event.key === 'Enter') applyCount('SET');
                    }}
                    className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-2xl font-black text-center focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
                    disabled={!canEdit}
                  />
                </div>
                <textarea
                  value={noteDraft}
                  onChange={event => setNoteDraft(event.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
                  rows={2}
                  placeholder="Ghi chú riêng cho mã này"
                  disabled={!canEdit}
                />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => applyCount('SET')} disabled={!canEdit} className="bg-blue-600 text-white rounded-xl py-3 text-xs font-black uppercase tracking-widest disabled:opacity-50">
                    Ghi số này
                  </button>
                  <button type="button" onClick={() => applyCount('ADD')} disabled={!canEdit} className="bg-slate-900 text-white rounded-xl py-3 text-xs font-black uppercase tracking-widest disabled:opacity-50">
                    Cộng thêm
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                Quét barcode hoặc chọn một dòng trong bảng để nhập số lượng thực tế.
              </div>
            )}
          </section>

          <section className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <History size={18} className="text-slate-600" />
              <h3 className="font-black text-slate-800 uppercase tracking-tight">Phiên gần đây</h3>
            </div>
            {recentAudits.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có phiên kiểm kho nào được lưu.</p>
            ) : (
              <div className="space-y-2">
                {recentAudits.map(audit => (
                  <div key={audit.id} className="border border-slate-100 rounded-xl p-3 bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{audit.code}</p>
                        <p className="text-sm font-bold text-slate-800">{audit.title}</p>
                        <p className="text-[11px] text-slate-500">{new Date(audit.createdAt).toLocaleString('vi-VN')}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-[10px] font-black ${audit.summary.varianceItems > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {audit.summary.varianceItems} lệch
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="xl:col-span-8 space-y-4">
          <section className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-black text-slate-800 uppercase tracking-tight">Bảng đối chiếu</h3>
                <p className="text-sm text-slate-500">Số hệ thống đang so theo {baseline === 'AVAILABLE' ? 'số sẵn kho' : 'tổng số lượng'}.</p>
              </div>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="Tìm tên, barcode, danh mục"
                />
              </div>
            </div>

            <div className="overflow-auto max-h-[620px] border border-slate-100 rounded-xl">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <th className="px-3 py-3">Thiết bị</th>
                    <th className="px-3 py-3 text-right">Tổng</th>
                    <th className="px-3 py-3 text-right">Sẵn</th>
                    <th className="px-3 py-3 text-right">Đang dùng</th>
                    <th className="px-3 py-3 text-center">Đã dán barcode</th>
                    <th className="px-3 py-3 text-right">Hệ thống</th>
                    <th className="px-3 py-3 text-right">Thực đếm</th>
                    <th className="px-3 py-3 text-right">Lệch</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map(row => {
                    const item = inventoryMap.get(row.itemId);
                    const isSelected = selectedItemId === row.itemId;
                    const isCounted = row.countedQuantity !== null;
                    const variance = row.variance || 0;
                    return (
                      <tr key={row.itemId} className={`${isSelected ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'} cursor-pointer`} onClick={() => item && selectItem(item)}>
                        <td className="px-3 py-3 min-w-[240px]">
                          <p className="font-bold text-slate-800">{row.name}</p>
                          <p className="text-[11px] text-slate-500">{row.category} • {row.location || 'Chưa định vị'}</p>
                          <p className="text-[11px] font-mono text-slate-400">{row.barcode || row.itemId}</p>
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-slate-700">{formatNumber(row.snapshot.totalQuantity)}</td>
                        <td className="px-3 py-3 text-right font-bold text-blue-600">{formatNumber(row.snapshot.availableQuantity)}</td>
                        <td className="px-3 py-3 text-right font-bold text-amber-600">{formatNumber(row.snapshot.inUseQuantity)}</td>
                        <td className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={!!row.barcodeAttached}
                            disabled={!canEdit}
                            onChange={event => {
                              event.stopPropagation();
                              const checked = event.target.checked;
                              setBarcodeAttached(prev => ({ ...prev, [row.itemId]: checked }));
                            }}
                            onClick={event => event.stopPropagation()}
                            className="w-5 h-5 accent-blue-600"
                            title="Đánh dấu thiết bị đã dán tem barcode thực tế"
                          />
                        </td>
                        <td className="px-3 py-3 text-right font-black text-slate-800">{formatNumber(row.systemQuantity)}</td>
                        <td className="px-3 py-3 text-right">
                          {isCounted ? (
                            <span className="font-black text-slate-800">{formatNumber(row.countedQuantity || 0)}</span>
                          ) : (
                            <span className="text-slate-300 font-bold">Chưa kiểm</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {isCounted ? (
                            <span className={`inline-flex items-center justify-end min-w-16 px-2 py-1 rounded-lg text-xs font-black ${variance === 0 ? 'bg-emerald-50 text-emerald-700' : variance > 0 ? 'bg-cyan-50 text-cyan-700' : 'bg-red-50 text-red-700'}`}>
                              {variance > 0 ? '+' : ''}{formatNumber(variance)}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {isCounted && (
                            <button
                              type="button"
                              onClick={event => {
                                event.stopPropagation();
                                clearItemCount(row.itemId);
                              }}
                              className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                              title="Xóa số đã kiểm"
                            >
                              <XCircle size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={18} className="text-amber-600" />
                <h3 className="font-black text-slate-800 uppercase tracking-tight">Mã đang lệch</h3>
              </div>
              {discrepancyRows.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                  <CheckCircle2 size={16} /> Chưa có mã lệch trong phiên hiện tại.
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {discrepancyRows.map(row => (
                    <div key={row.itemId} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{row.name}</p>
                        <p className="text-[11px] text-slate-500">Hệ thống {row.systemQuantity} • Thực đếm {row.countedQuantity}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-lg text-xs font-black ${(row.variance || 0) > 0 ? 'bg-cyan-100 text-cyan-700' : 'bg-red-100 text-red-700'}`}>
                        {(row.variance || 0) > 0 ? '+' : ''}{row.variance}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <ClipboardCheck size={18} className="text-orange-600" />
                <h3 className="font-black text-slate-800 uppercase tracking-tight">Barcode lạ</h3>
              </div>
              {unknownBarcodes.length === 0 ? (
                <p className="text-sm text-slate-500">Barcode không tồn tại trong kho sẽ hiện tại đây để kiểm tra lại tem hoặc khai báo mới.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {unknownBarcodes.map(code => (
                    <span key={code} className="px-3 py-2 rounded-xl bg-orange-50 border border-orange-100 text-orange-700 text-xs font-mono font-bold">
                      {code}
                    </span>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
