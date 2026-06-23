import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Barcode, CheckCircle2, ClipboardCheck, Download, FileText, History, PackageCheck, Printer, RotateCcw, Save, Search, X, XCircle } from 'lucide-react';
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

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char] || char));

const loadPdfLib = async () => {
  if ((window as any).html2pdf) return (window as any).html2pdf;
  const mod: any = await import('html2pdf.js');
  return (window as any).html2pdf || mod?.default || mod;
};

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
  const [viewingAudit, setViewingAudit] = useState<InventoryAuditSession | null>(null);
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

  const buildAuditHtml = (audit: InventoryAuditSession) => {
    const countedRows = (audit.items || []).filter(row => row.countedQuantity !== null);
    const varianceRows = countedRows.filter(row => (row.variance || 0) !== 0);
    const rows = (audit.items || []).map((row, idx) => {
      const variance = row.variance || 0;
      const varianceLabel = row.variance === null ? '' : `${variance > 0 ? '+' : ''}${formatNumber(variance)}`;
      const varianceClass = variance === 0 ? 'ok' : variance > 0 ? 'surplus' : 'shortage';
      return `
        <tr>
          <td class="center">${idx + 1}</td>
          <td>
            <strong>${escapeHtml(row.name)}</strong>
            <div class="muted">${escapeHtml(row.category)}${row.location ? ` • ${escapeHtml(row.location)}` : ''}</div>
            <div class="mono">${escapeHtml(row.barcode || row.itemId)}</div>
          </td>
          <td class="center">${row.barcodeAttached ? 'Có' : 'Không'}</td>
          <td class="num">${formatNumber(row.snapshot.totalQuantity)}</td>
          <td class="num">${formatNumber(row.snapshot.availableQuantity)}</td>
          <td class="num">${formatNumber(row.snapshot.inUseQuantity)}</td>
          <td class="num">${formatNumber(row.systemQuantity)}</td>
          <td class="num">${row.countedQuantity === null ? '' : formatNumber(row.countedQuantity)}</td>
          <td class="num ${row.variance === null ? '' : varianceClass}">${varianceLabel}</td>
          <td>${escapeHtml(row.note || '')}</td>
        </tr>
      `;
    }).join('');

    const unknownRows = (audit.unknownBarcodes || []).map(code => `<span class="tag">${escapeHtml(code)}</span>`).join('');
    const createdAt = audit.createdAt ? new Date(audit.createdAt).toLocaleString('vi-VN') : '';
    const baselineLabel = audit.baseline === 'TOTAL' ? 'Tổng kho' : 'Sẵn kho';

    return `
      <div class="audit-doc">
        <style>
          .audit-doc { font-family: Arial, sans-serif; color: #0f172a; padding: 20px; background: #fff; }
          .audit-doc h1 { margin: 0 0 6px; font-size: 24px; text-transform: uppercase; }
          .audit-doc h2 { margin: 22px 0 10px; font-size: 15px; text-transform: uppercase; }
          .audit-doc .top { display: flex; justify-content: space-between; gap: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px; }
          .audit-doc .meta { font-size: 12px; line-height: 1.55; color: #475569; }
          .audit-doc .summary { display: grid; grid-template-columns: repeat(8, 1fr); gap: 8px; margin: 14px 0; }
          .audit-doc .metric { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; background: #f8fafc; }
          .audit-doc .metric span { display: block; font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; }
          .audit-doc .metric strong { display: block; font-size: 18px; margin-top: 3px; }
          .audit-doc table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
          .audit-doc th { background: #f1f5f9; color: #334155; text-align: left; border: 1px solid #cbd5e1; padding: 6px; text-transform: uppercase; font-size: 9px; }
          .audit-doc td { border: 1px solid #e2e8f0; padding: 6px; vertical-align: top; }
          .audit-doc .num { text-align: right; font-weight: 700; }
          .audit-doc .center { text-align: center; }
          .audit-doc .muted { color: #64748b; font-size: 9.5px; margin-top: 2px; }
          .audit-doc .mono { color: #475569; font-family: monospace; font-size: 9.5px; margin-top: 2px; }
          .audit-doc .ok { color: #047857; }
          .audit-doc .surplus { color: #0369a1; }
          .audit-doc .shortage { color: #dc2626; }
          .audit-doc .tag { display: inline-block; border: 1px solid #fed7aa; background: #fff7ed; color: #c2410c; padding: 5px 8px; border-radius: 8px; margin: 0 6px 6px 0; font-family: monospace; font-size: 10px; }
          .audit-doc .signatures { display: flex; justify-content: space-between; margin-top: 34px; page-break-inside: avoid; }
          .audit-doc .signature { width: 42%; text-align: center; font-size: 11px; }
          .audit-doc .signature .line { border-top: 1px solid #0f172a; margin-top: 58px; padding-top: 6px; color: #475569; }
          @media print {
            body { margin: 0; background: #fff; }
            .audit-doc { padding: 12mm; }
            .no-print { display: none !important; }
          }
        </style>
        <div class="top">
          <div>
            <h1>Biên bản kiểm kho</h1>
            <div class="meta">
              <strong>${escapeHtml(audit.code)}</strong><br/>
              ${escapeHtml(audit.title)}<br/>
              Thời gian: ${escapeHtml(createdAt)}
            </div>
          </div>
          <div class="meta">
            Người kiểm: <strong>${escapeHtml(audit.createdBy?.name || 'Chưa rõ')}</strong><br/>
            Vai trò: ${escapeHtml(audit.createdBy?.role || '')}<br/>
            Đối chiếu theo: <strong>${baselineLabel}</strong>
          </div>
        </div>

        ${audit.note ? `<p class="meta"><strong>Ghi chú:</strong> ${escapeHtml(audit.note)}</p>` : ''}

        <div class="summary">
          <div class="metric"><span>Tổng mã</span><strong>${formatNumber(audit.summary.totalItems)}</strong></div>
          <div class="metric"><span>Đã kiểm</span><strong>${formatNumber(audit.summary.countedItems)}</strong></div>
          <div class="metric"><span>Khớp</span><strong>${formatNumber(audit.summary.matchedItems)}</strong></div>
          <div class="metric"><span>Mã lệch</span><strong>${formatNumber(audit.summary.varianceItems)}</strong></div>
          <div class="metric"><span>Mã thiếu</span><strong>${formatNumber(audit.summary.shortageItems)}</strong></div>
          <div class="metric"><span>Mã dư</span><strong>${formatNumber(audit.summary.surplusItems)}</strong></div>
          <div class="metric"><span>SL thiếu</span><strong>${formatNumber(audit.summary.shortageUnits)}</strong></div>
          <div class="metric"><span>SL dư</span><strong>${formatNumber(audit.summary.surplusUnits)}</strong></div>
        </div>

        <h2>Chi tiết đối chiếu</h2>
        <table>
          <thead>
            <tr>
              <th>STT</th>
              <th>Thiết bị</th>
              <th>Đã dán barcode</th>
              <th>Tổng</th>
              <th>Sẵn</th>
              <th>Đang dùng</th>
              <th>Hệ thống</th>
              <th>Thực đếm</th>
              <th>Lệch</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        ${varianceRows.length > 0 ? `<p class="meta"><strong>Lưu ý:</strong> Có ${varianceRows.length} mã lệch cần đối soát xử lý sau kiểm kho.</p>` : ''}

        <h2>Barcode lạ</h2>
        ${unknownRows || '<p class="meta">Không ghi nhận barcode lạ trong phiên này.</p>'}

        <div class="signatures">
          <div class="signature">
            <strong>Người kiểm kho</strong>
            <div class="line">Ký và ghi rõ họ tên</div>
          </div>
          <div class="signature">
            <strong>Quản lý kho</strong>
            <div class="line">Ký và ghi rõ họ tên</div>
          </div>
        </div>
      </div>
    `;
  };

  const openAuditWindow = (audit: InventoryAuditSession, autoPrint = false) => {
    const printWindow = window.open('', '_blank', 'width=1120,height=780');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${escapeHtml(audit.code)} - Kiểm kho</title>
        </head>
        <body>
          <div class="no-print" style="position: sticky; top: 0; display: flex; justify-content: flex-end; gap: 8px; padding: 10px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-family: Arial, sans-serif;">
            <button onclick="window.print()" style="padding: 8px 12px; border: 0; border-radius: 8px; background: #2563eb; color: white; font-weight: 700;">In / lưu PDF</button>
            <button onclick="window.close()" style="padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: white; font-weight: 700;">Đóng</button>
          </div>
          ${buildAuditHtml(audit)}
          ${autoPrint ? '<script>setTimeout(() => window.print(), 350);</script>' : ''}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
  };

  const exportAuditPdf = async (audit: InventoryAuditSession) => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-99999px';
    container.style.top = '0';
    container.style.width = '297mm';
    container.style.backgroundColor = '#ffffff';
    container.innerHTML = buildAuditHtml(audit);
    document.body.appendChild(container);

    try {
      const html2pdf = await loadPdfLib();
      await html2pdf().set({
        margin: 6,
        filename: `${audit.code}-kiem-kho.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      }).from(container).save();
    } catch (err) {
      console.error('Export stocktake PDF error', err);
      alert('Không thể xuất PDF lúc này. Mở cửa sổ xem để in/lưu PDF thay thế.');
      openAuditWindow(audit, true);
    } finally {
      document.body.removeChild(container);
    }
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
                  <div
                    key={audit.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setViewingAudit(audit)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setViewingAudit(audit);
                      }
                    }}
                    className="border border-slate-100 rounded-xl p-3 bg-slate-50 hover:bg-blue-50 hover:border-blue-100 cursor-pointer transition"
                  >
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
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={event => {
                          event.stopPropagation();
                          openAuditWindow(audit);
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-100"
                      >
                        <Printer size={13} /> Cửa sổ
                      </button>
                      <button
                        type="button"
                        onClick={event => {
                          event.stopPropagation();
                          void exportAuditPdf(audit);
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-700"
                      >
                        <FileText size={13} /> PDF
                      </button>
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

      {viewingAudit && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[120] flex items-center justify-center p-3 md:p-6">
          <div className="bg-white w-full max-w-6xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="p-4 md:p-5 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black text-blue-600 uppercase tracking-widest">{viewingAudit.code}</p>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{viewingAudit.title}</h3>
                <p className="text-sm text-slate-500">
                  {new Date(viewingAudit.createdAt).toLocaleString('vi-VN')} • Người kiểm: {viewingAudit.createdBy?.name || 'Chưa rõ'} • So theo {viewingAudit.baseline === 'TOTAL' ? 'tổng kho' : 'sẵn kho'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openAuditWindow(viewingAudit)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-[11px] font-black uppercase tracking-widest hover:bg-slate-100"
                >
                  <Printer size={15} /> Cửa sổ
                </button>
                <button
                  type="button"
                  onClick={() => void exportAuditPdf(viewingAudit)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-blue-700"
                >
                  <FileText size={15} /> Xuất PDF
                </button>
                <button
                  type="button"
                  onClick={() => setViewingAudit(null)}
                  className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  title="Đóng"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-4 md:p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
                {[
                  ['Tổng mã', viewingAudit.summary.totalItems],
                  ['Đã kiểm', viewingAudit.summary.countedItems],
                  ['Khớp', viewingAudit.summary.matchedItems],
                  ['Mã lệch', viewingAudit.summary.varianceItems],
                  ['Mã thiếu', viewingAudit.summary.shortageItems],
                  ['Mã dư', viewingAudit.summary.surplusItems],
                  ['SL thiếu', viewingAudit.summary.shortageUnits],
                  ['SL dư', viewingAudit.summary.surplusUnits]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                    <p className="text-xl font-black text-slate-900">{formatNumber(Number(value) || 0)}</p>
                  </div>
                ))}
              </div>

              {viewingAudit.note && (
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
                  <span className="font-black">Ghi chú: </span>{viewingAudit.note}
                </div>
              )}

              <div className="overflow-auto border border-slate-100 rounded-xl max-h-[54vh]">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <th className="px-3 py-3">Thiết bị</th>
                      <th className="px-3 py-3 text-center">Đã dán barcode</th>
                      <th className="px-3 py-3 text-right">Tổng</th>
                      <th className="px-3 py-3 text-right">Sẵn</th>
                      <th className="px-3 py-3 text-right">Đang dùng</th>
                      <th className="px-3 py-3 text-right">Hệ thống</th>
                      <th className="px-3 py-3 text-right">Thực đếm</th>
                      <th className="px-3 py-3 text-right">Lệch</th>
                      <th className="px-3 py-3">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(viewingAudit.items || []).map(row => {
                      const variance = row.variance || 0;
                      const isCounted = row.countedQuantity !== null;
                      return (
                        <tr key={row.itemId} className="bg-white">
                          <td className="px-3 py-3 min-w-[240px]">
                            <p className="font-bold text-slate-800">{row.name}</p>
                            <p className="text-[11px] text-slate-500">{row.category} {row.location ? `• ${row.location}` : ''}</p>
                            <p className="text-[11px] font-mono text-slate-400">{row.barcode || row.itemId}</p>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`px-2 py-1 rounded-lg text-[11px] font-black ${row.barcodeAttached ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                              {row.barcodeAttached ? 'Có' : 'Không'}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right font-bold text-slate-700">{formatNumber(row.snapshot.totalQuantity)}</td>
                          <td className="px-3 py-3 text-right font-bold text-blue-600">{formatNumber(row.snapshot.availableQuantity)}</td>
                          <td className="px-3 py-3 text-right font-bold text-amber-600">{formatNumber(row.snapshot.inUseQuantity)}</td>
                          <td className="px-3 py-3 text-right font-black text-slate-800">{formatNumber(row.systemQuantity)}</td>
                          <td className="px-3 py-3 text-right font-black text-slate-800">{isCounted ? formatNumber(row.countedQuantity || 0) : '-'}</td>
                          <td className="px-3 py-3 text-right">
                            {isCounted ? (
                              <span className={`inline-flex justify-end min-w-16 px-2 py-1 rounded-lg text-xs font-black ${variance === 0 ? 'bg-emerald-50 text-emerald-700' : variance > 0 ? 'bg-cyan-50 text-cyan-700' : 'bg-red-50 text-red-700'}`}>
                                {variance > 0 ? '+' : ''}{formatNumber(variance)}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-3 py-3 text-slate-600 min-w-[180px]">{row.note || ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="rounded-xl border border-orange-100 bg-orange-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-700 mb-2">Barcode lạ</p>
                {viewingAudit.unknownBarcodes?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {viewingAudit.unknownBarcodes.map(code => (
                      <span key={code} className="px-3 py-2 rounded-xl bg-white border border-orange-100 text-orange-700 text-xs font-mono font-bold">
                        {code}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-orange-700">Không ghi nhận barcode lạ trong phiên này.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
