import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardCheck,
  History,
  PackagePlus,
  ScanBarcode,
  Search,
  XCircle
} from 'lucide-react';
import {
  ChecklistDirection,
  ChecklistSignature,
  ChecklistStatus,
  Event,
  EventInventoryIncidentType,
  EventPreparationEntry,
  EventPreparationStatus,
  InventoryItem
} from '../types';
import { normalizeChecklist } from '../services/checklistService';
import { normalizeBarcode } from '../services/barcodeService';

type PreparationDraft = Omit<EventPreparationEntry, 'status'> & { status?: EventPreparationStatus };

interface EventChecklistProps {
  event: Event;
  inventory: InventoryItem[];
  onScan?: (payload: { eventId: string; barcode: string; direction: ChecklistDirection; status?: ChecklistStatus; quantity?: number; note?: string }) => void;
  onUpdateNote?: (eventId: string, itemId: string, note: string) => void;
  onSaveSignature?: (eventId: string, payload: { direction: ChecklistDirection; manager?: ChecklistSignature; operator?: ChecklistSignature; note?: string; itemsSnapshot?: { itemId: string; name?: string; orderQty: number; scannedOut: number; scannedIn: number; damaged: number; lost: number; missing: number; }[]; createSlip?: boolean }) => void;
  onSavePreparation?: (eventId: string, entries: Record<string, EventPreparationEntry>, finalize: boolean) => void;
  onReportIncident?: (payload: { eventId: string; itemId: string; type: EventInventoryIncidentType; quantity: number; note?: string }) => void;
  canEdit?: boolean;
}

const STATUS_OPTIONS: Array<{
  value: EventPreparationStatus;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  activeClass: string;
}> = [
  { value: 'ON_BUS', label: 'Có trên xe', icon: CheckCircle2, activeClass: 'bg-emerald-600 text-white border-emerald-600' },
  { value: 'LOAD_TO_BUS', label: 'Bổ sung', icon: PackagePlus, activeClass: 'bg-blue-600 text-white border-blue-600' },
  { value: 'MISSING', label: 'Thiếu', icon: XCircle, activeClass: 'bg-rose-600 text-white border-rose-600' }
];

const INCIDENT_LABELS: Record<EventInventoryIncidentType, string> = {
  CONSUMED: 'Đã tiêu hao',
  DAMAGED: 'Bị hỏng',
  LOST: 'Bị mất',
  RETURN_TO_STORAGE: 'Trả kho tổng'
};

const formatDateTime = (value?: string) => value ? new Date(value).toLocaleString('vi-VN') : '';

export const EventChecklist: React.FC<EventChecklistProps> = ({
  event,
  inventory,
  onSavePreparation,
  onReportIncident,
  canEdit = true
}) => {
  const checklist = useMemo(() => normalizeChecklist(event.checklist), [event.checklist]);
  const inventoryMap = useMemo(() => new Map(inventory.map(item => [item.id, item])), [inventory]);
  const [drafts, setDrafts] = useState<Record<string, PreparationDraft>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [scanValue, setScanValue] = useState('');
  const [highlightedItemId, setHighlightedItemId] = useState('');
  const [incidentItemId, setIncidentItemId] = useState('');
  const [incidentType, setIncidentType] = useState<EventInventoryIncidentType>('DAMAGED');
  const [incidentQuantity, setIncidentQuantity] = useState(1);
  const [incidentNote, setIncidentNote] = useState('');

  useEffect(() => {
    const nextDrafts: Record<string, PreparationDraft> = {};
    event.items.forEach(allocation => {
      const saved = checklist.preparation?.[allocation.itemId];
      if (saved) {
        nextDrafts[allocation.itemId] = { ...saved };
        return;
      }
      const legacyQuantity = checklist.outbound?.[allocation.itemId] || 0;
      nextDrafts[allocation.itemId] = legacyQuantity > 0
        ? { status: 'ON_BUS', quantity: Math.min(legacyQuantity, allocation.quantity), note: 'Dữ liệu checklist cũ' }
        : { quantity: allocation.quantity };
    });
    setDrafts(nextDrafts);
  }, [event.id, event.items, checklist.preparation, checklist.outbound]);

  const rows = useMemo(() => event.items.map(allocation => {
    const item = inventoryMap.get(allocation.itemId);
    const draft = drafts[allocation.itemId] || { quantity: allocation.quantity };
    const busQuantity = item
      ? (typeof item.busQuantity === 'number' ? item.busQuantity : item.availableQuantity)
      : 0;
    return {
      allocation,
      item,
      draft,
      busQuantity,
      missingQuantity: Math.max(0, allocation.quantity - (draft.status ? draft.quantity : 0))
    };
  }), [drafts, event.items, inventoryMap]);

  const filteredRows = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(row =>
      (row.item?.name || row.allocation.itemId).toLowerCase().includes(needle)
      || (row.item?.barcode || '').toLowerCase().includes(needle)
      || (row.item?.category || '').toLowerCase().includes(needle)
    );
  }, [rows, searchTerm]);

  const summary = useMemo(() => rows.reduce((acc, row) => {
    acc.required += row.allocation.quantity;
    if (row.draft.status) acc.confirmedItems += 1;
    acc.ready += row.draft.status ? row.draft.quantity : 0;
    acc.missing += row.missingQuantity;
    acc.load += row.draft.status === 'LOAD_TO_BUS' ? (row.draft.loadQuantity || 0) : 0;
    return acc;
  }, { required: 0, ready: 0, missing: 0, load: 0, confirmedItems: 0 }), [rows]);

  const incidentItem = inventoryMap.get(incidentItemId);

  const updateDraft = (itemId: string, patch: Partial<PreparationDraft>) => {
    setDrafts(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || { quantity: 0 }), ...patch }
    }));
  };

  const selectStatus = (itemId: string, status: EventPreparationStatus, orderQuantity: number) => {
    const current = drafts[itemId];
    const quantity = status === 'MISSING'
      ? Math.min(current?.status ? current.quantity || 0 : 0, orderQuantity)
      : Math.max(1, Math.min(current?.quantity || orderQuantity, orderQuantity));
    updateDraft(itemId, {
      status,
      quantity,
      loadQuantity: status === 'LOAD_TO_BUS'
        ? Math.max(1, Math.min(current?.loadQuantity || 1, quantity))
        : undefined
    });
  };

  const confirmAllOnBus = () => {
    const next = { ...drafts };
    event.items.forEach(allocation => {
      next[allocation.itemId] = {
        ...next[allocation.itemId],
        status: 'ON_BUS',
        quantity: allocation.quantity,
        loadQuantity: undefined
      };
    });
    setDrafts(next);
  };

  const buildEntries = () => (Object.entries(drafts) as Array<[string, PreparationDraft]>).reduce<Record<string, EventPreparationEntry>>((acc, [itemId, draft]) => {
    if (!draft.status) return acc;
    acc[itemId] = {
      status: draft.status,
      quantity: Math.max(0, Math.round(draft.quantity || 0)),
      loadQuantity: draft.status === 'LOAD_TO_BUS' ? Math.max(0, Math.round(draft.loadQuantity || 0)) : undefined,
      note: draft.note?.trim() || undefined,
      confirmedAt: draft.confirmedAt
    };
    return acc;
  }, {});

  const savePreparation = (finalize: boolean) => {
    if (!canEdit || !onSavePreparation) return;
    if (finalize && summary.confirmedItems !== rows.length) {
      alert(`Còn ${rows.length - summary.confirmedItems} mã hàng chưa xác nhận.`);
      return;
    }
    onSavePreparation(event.id, buildEntries(), finalize);
  };

  const handleScan = (eventSubmit: React.FormEvent) => {
    eventSubmit.preventDefault();
    const code = normalizeBarcode(scanValue);
    if (!code) return;
    const found = rows.find(row =>
      normalizeBarcode(row.item?.barcode || '') === code
      || normalizeBarcode(row.allocation.itemId) === code
    );
    if (!found) {
      alert('Mã này không có trong Order thiết bị của sự kiện.');
      return;
    }
    setHighlightedItemId(found.allocation.itemId);
    setSearchTerm(found.item?.name || found.allocation.itemId);
    selectStatus(found.allocation.itemId, 'ON_BUS', found.allocation.quantity);
    setScanValue('');
  };

  const reportIncident = () => {
    if (!canEdit || !onReportIncident || !incidentItemId) return;
    if (incidentType === 'CONSUMED' && incidentItem?.lifecycle !== 'CONSUMABLE') {
      alert('Chỉ hàng Tiêu hao mới có thể ghi nhận đã dùng hết.');
      return;
    }
    const busQuantity = incidentItem
      ? (typeof incidentItem.busQuantity === 'number' ? incidentItem.busQuantity : incidentItem.availableQuantity)
      : 0;
    if (busQuantity <= 0) {
      alert('Mã hàng này không còn số lượng khả dụng trên xe.');
      return;
    }
    onReportIncident({
      eventId: event.id,
      itemId: incidentItemId,
      type: incidentType,
      quantity: Math.min(busQuantity, Math.max(1, Math.round(incidentQuantity || 1))),
      note: incidentNote.trim() || undefined
    });
    setIncidentQuantity(1);
    setIncidentNote('');
  };

  return (
    <div className="space-y-4">
      <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Chuẩn bị chuyến</p>
            <h3 className="text-lg font-black text-slate-900">Checklist xe EBUS</h3>
            <p className="text-sm text-slate-500 mt-1">{event.name}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirmAllOnBus}
              disabled={!canEdit || rows.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 disabled:opacity-50"
            >
              <Check size={16} /> Xác nhận đủ theo Order
            </button>
            <button
              type="button"
              onClick={() => savePreparation(false)}
              disabled={!canEdit || !onSavePreparation}
              className="px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 disabled:opacity-50"
            >
              Lưu nháp
            </button>
            <button
              type="button"
              onClick={() => savePreparation(true)}
              disabled={!canEdit || !onSavePreparation || rows.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
            >
              <ClipboardCheck size={16} /> Chốt checklist
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 border-b border-slate-100">
          {[
            ['Cần mang', summary.required, 'text-slate-900'],
            ['Đã xác nhận', `${summary.confirmedItems}/${rows.length}`, 'text-blue-600'],
            ['Sẵn sàng', summary.ready, 'text-emerald-600'],
            ['Cần bổ sung', summary.load, 'text-cyan-700'],
            ['Còn thiếu', summary.missing, 'text-rose-600']
          ].map(([label, value, tone]) => (
            <div key={String(label)} className="px-4 py-3 border-r border-slate-100 last:border-r-0">
              <p className="text-[10px] font-black uppercase text-slate-400">{label}</p>
              <p className={`text-xl font-black ${tone}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="p-4 border-b border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={eventChange => setSearchTerm(eventChange.target.value)}
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm"
              placeholder="Tìm thiết bị trong Order"
            />
          </div>
          <form onSubmit={handleScan} className="flex gap-2">
            <div className="relative flex-1">
              <ScanBarcode size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={scanValue}
                onChange={eventChange => setScanValue(eventChange.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg font-mono text-sm"
                placeholder="Quét barcode để tìm nhanh"
              />
            </div>
            <button type="submit" className="px-4 rounded-lg bg-slate-900 text-white text-xs font-bold">Tìm</button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Thiết bị</th>
                <th className="px-3 py-3 text-center">Order</th>
                <th className="px-3 py-3 text-center">Trên xe</th>
                <th className="px-3 py-3 text-left">Xác nhận</th>
                <th className="px-3 py-3 text-center">SL mang</th>
                <th className="px-3 py-3 text-center">SL bổ sung</th>
                <th className="px-4 py-3 text-left">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map(row => (
                <tr key={row.allocation.itemId} className={highlightedItemId === row.allocation.itemId ? 'bg-blue-50' : 'hover:bg-slate-50'}>
                  <td className="px-4 py-3 min-w-[220px]">
                    <p className="font-bold text-slate-900">{row.item?.name || row.allocation.itemId}</p>
                    <p className="text-[11px] text-slate-500">{row.item?.category || 'Chưa có danh mục'} · {row.item?.lifecycle === 'CONSUMABLE' ? 'Tiêu hao' : 'Khấu hao'}</p>
                  </td>
                  <td className="px-3 py-3 text-center font-black">{row.allocation.quantity}</td>
                  <td className="px-3 py-3 text-center font-bold text-blue-700">{row.busQuantity}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1.5">
                      {STATUS_OPTIONS.map(option => {
                        const Icon = option.icon;
                        const active = row.draft.status === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            title={option.label}
                            onClick={() => selectStatus(row.allocation.itemId, option.value, row.allocation.quantity)}
                            disabled={!canEdit}
                            className={`h-9 px-2.5 rounded-lg border inline-flex items-center gap-1.5 text-[11px] font-bold whitespace-nowrap ${active ? option.activeClass : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'} disabled:opacity-50`}
                          >
                            <Icon size={14} /> {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <input
                      type="number"
                      min={0}
                      max={row.allocation.quantity}
                      value={row.draft.quantity}
                      onChange={eventChange => updateDraft(row.allocation.itemId, { quantity: Number(eventChange.target.value) })}
                      disabled={!canEdit || !row.draft.status}
                      className="w-16 border border-slate-200 rounded-lg px-2 py-2 text-center font-black disabled:bg-slate-100"
                    />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <input
                      type="number"
                      min={0}
                      max={row.draft.quantity}
                      value={row.draft.status === 'LOAD_TO_BUS' ? row.draft.loadQuantity || 0 : 0}
                      onChange={eventChange => updateDraft(row.allocation.itemId, { loadQuantity: Number(eventChange.target.value) })}
                      disabled={!canEdit || row.draft.status !== 'LOAD_TO_BUS'}
                      className="w-16 border border-slate-200 rounded-lg px-2 py-2 text-center font-black disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </td>
                  <td className="px-4 py-3 min-w-[180px]">
                    <input
                      value={row.draft.note || ''}
                      onChange={eventChange => updateDraft(row.allocation.itemId, { note: eventChange.target.value })}
                      disabled={!canEdit}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs disabled:bg-slate-100"
                      placeholder="Ghi chú"
                    />
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr><td colSpan={7} className="py-10 text-center text-slate-400">Không có thiết bị phù hợp.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>{checklist.finalizedAt ? `Chốt gần nhất: ${formatDateTime(checklist.finalizedAt)}` : 'Checklist chưa được chốt'}</span>
          {(Object.values(checklist.inbound || {}) as number[]).reduce((sum, value) => sum + value, 0) > 0 && (
            <span>Dữ liệu trả kho cũ: {(Object.values(checklist.inbound) as number[]).reduce((sum, value) => sum + value, 0)}</span>
          )}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <AlertTriangle size={18} className="text-amber-600" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Sau sự kiện · tùy chọn</p>
            <h3 className="font-black text-slate-900">Báo sự cố nhanh</h3>
          </div>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Thiết bị</label>
            <select
              value={incidentItemId}
              onChange={eventChange => setIncidentItemId(eventChange.target.value)}
              disabled={!canEdit}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white"
            >
              <option value="">Chọn thiết bị trong Order</option>
              {rows.map(row => (
                <option key={row.allocation.itemId} value={row.allocation.itemId}>
                  {row.item?.name || row.allocation.itemId} · trên xe {row.busQuantity}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Xử lý</label>
            <select
              value={incidentType}
              onChange={eventChange => setIncidentType(eventChange.target.value as EventInventoryIncidentType)}
              disabled={!canEdit}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white"
            >
              {Object.entries(INCIDENT_LABELS).map(([value, label]) => (
                <option key={value} value={value} disabled={value === 'CONSUMED' && incidentItem?.lifecycle !== 'CONSUMABLE'}>{label}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Số lượng</label>
            <input
              type="number"
              min={1}
              value={incidentQuantity}
              onChange={eventChange => setIncidentQuantity(Number(eventChange.target.value))}
              disabled={!canEdit}
              className="w-full border border-slate-200 rounded-lg px-2 py-2.5 text-center font-black"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Ghi chú</label>
            <input
              value={incidentNote}
              onChange={eventChange => setIncidentNote(eventChange.target.value)}
              disabled={!canEdit}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
              placeholder="Tình trạng hoặc lý do"
            />
          </div>
          <button
            type="button"
            title="Ghi nhận sự cố"
            onClick={reportIncident}
            disabled={!canEdit || !incidentItemId || !onReportIncident}
            className="md:col-span-1 h-[42px] inline-flex items-center justify-center rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
          >
            <Check size={18} />
          </button>
        </div>

        {(checklist.incidents || []).length > 0 && (
          <div className="border-t border-slate-100">
            <div className="px-4 py-2.5 bg-slate-50 flex items-center gap-2 text-xs font-bold text-slate-600">
              <History size={14} /> Sự cố đã ghi nhận
            </div>
            <div className="divide-y divide-slate-100">
              {(checklist.incidents || []).slice(0, 8).map(incident => {
                const item = inventoryMap.get(incident.itemId);
                return (
                  <div key={incident.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div>
                      <span className="font-bold text-slate-900">{item?.name || incident.itemId}</span>
                      <span className="text-slate-500"> · {INCIDENT_LABELS[incident.type]} · {incident.quantity}</span>
                      {incident.note && <p className="text-xs text-slate-500 mt-0.5">{incident.note}</p>}
                    </div>
                    <span className="text-xs text-slate-400">{formatDateTime(incident.createdAt)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
