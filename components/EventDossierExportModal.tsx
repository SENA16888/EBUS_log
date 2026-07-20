import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  Download,
  FileText,
  PackageCheck,
  Users,
  Wallet,
  Wand2,
  X
} from 'lucide-react';
import { Employee, Event, InventoryItem, Quotation, SaleOrder } from '../types';
import {
  EventDossierSection,
  exportEventDossier,
  getEventDossierSectionCounts
} from '../services/eventDossierService';

interface EventDossierExportModalProps {
  isOpen: boolean;
  event: Event;
  inventory: InventoryItem[];
  employees?: Employee[];
  quotation?: Quotation | null;
  saleOrders?: SaleOrder[];
  currentUserName?: string;
  onClose: () => void;
}

type OptionalSection = Exclude<EventDossierSection, 'PLAN'>;

const SECTION_OPTIONS: Array<{
  id: OptionalSection;
  label: string;
  description: string;
  countLabel: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  { id: 'STAFF', label: 'Nhân sự', description: 'Phân công, ca làm, đơn giá và thành tiền', countLabel: 'phân công', icon: Users },
  { id: 'EXPENSES', label: 'Chi phí', description: 'Chi phí, chứng từ và hiệu quả tài chính', countLabel: 'khoản chi', icon: Wallet },
  { id: 'ADVANCES', label: 'Tạm ứng', description: 'Đề nghị, đã chi, hoàn ứng và trạng thái', countLabel: 'dữ liệu', icon: Wallet },
  { id: 'TIMELINE', label: 'Timeline hậu cần', description: 'Các mốc trước, trong và sau sự kiện', countLabel: 'mốc', icon: CalendarDays },
  { id: 'AGENDA', label: 'Agenda chương trình', description: 'Khung giờ và nội dung của mọi chương trình', countLabel: 'mốc', icon: CalendarDays },
  { id: 'DESIGN', label: 'Design & sơ đồ trạm', description: 'Trạm, mục tiêu, thiết bị và mặt bằng bố trí', countLabel: 'trạm/block', icon: Wand2 },
  { id: 'EQUIPMENT', label: 'Thiết bị', description: 'Danh mục thiết bị cần mang theo sự kiện', countLabel: 'loại', icon: PackageCheck }
];

const getDefaultSections = (event: Event): EventDossierSection[] => {
  const counts = getEventDossierSectionCounts(event);
  return [
    'PLAN',
    ...SECTION_OPTIONS.filter(option => counts[option.id] > 0).map(option => option.id)
  ];
};

export const EventDossierExportModal: React.FC<EventDossierExportModalProps> = ({
  isOpen,
  event,
  inventory,
  employees = [],
  quotation,
  saleOrders = [],
  currentUserName,
  onClose
}) => {
  const [selectedSections, setSelectedSections] = useState<EventDossierSection[]>(() => getDefaultSections(event));
  const [preparedBy, setPreparedBy] = useState(currentUserName || event.eventProfile?.einsteinPic || 'Phạm Trần Nhân');
  const [approvedBy, setApprovedBy] = useState('Vũ Thanh Hà');
  const [quality, setQuality] = useState<'medium' | 'high'>('high');
  const [isExporting, setIsExporting] = useState(false);
  const counts = useMemo(() => getEventDossierSectionCounts(event), [event]);
  const availableSections = useMemo(
    () => SECTION_OPTIONS.filter(option => counts[option.id] > 0).map(option => option.id),
    [counts]
  );
  const allAvailableSelected = availableSections.every(section => selectedSections.includes(section));

  useEffect(() => {
    if (!isOpen) return;
    setSelectedSections(getDefaultSections(event));
    setPreparedBy(currentUserName || event.eventProfile?.einsteinPic || 'Phạm Trần Nhân');
    setApprovedBy('Vũ Thanh Hà');
    setQuality('high');
  }, [currentUserName, event.id, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Escape' && !isExporting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExporting, isOpen, onClose]);

  const toggleSection = (section: OptionalSection) => {
    if (counts[section] === 0 || isExporting) return;
    setSelectedSections(current => current.includes(section)
      ? current.filter(item => item !== section)
      : [...current, section]);
  };

  const toggleAll = () => {
    if (isExporting) return;
    setSelectedSections(allAvailableSelected ? ['PLAN'] : ['PLAN', ...availableSections]);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportEventDossier(event, inventory, {
        sections: selectedSections,
        employees,
        quotation,
        saleOrders,
        preparedBy,
        approvedBy,
        quality
      });
      onClose();
    } catch (error) {
      console.error('Event dossier export failed:', error);
      alert('Không thể xuất hồ sơ sự kiện. Vui lòng thử lại hoặc chọn chất lượng tiêu chuẩn.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/65 p-3 md:p-6" onMouseDown={event => event.target === event.currentTarget && !isExporting && onClose()}>
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 md:px-6">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-blue-600 p-2.5 text-white shadow-sm">
              <FileText size={22}/>
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Xuất hồ sơ sự kiện</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">{event.name}</p>
              <p className="mt-0.5 text-xs text-slate-400">Một file PDF gồm kế hoạch chuẩn và các phụ lục được chọn.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-50"
            aria-label="Đóng"
          >
            <X size={22}/>
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 md:px-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-amber-500 text-white"><Check size={14}/></div>
              <div>
                <p className="text-sm font-black text-amber-900">Kế hoạch triển khai theo mẫu EBUS luôn được bao gồm</p>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-amber-700">Trang kế hoạch có đủ Mục tiêu, Phạm vi, Hình thức, Nội dung, Scheme ưu đãi, Kế hoạch hành động và khối ký duyệt.</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">Chọn phụ lục đính kèm</h3>
              <p className="mt-1 text-xs text-slate-500">Phần chưa có dữ liệu sẽ tạm khóa để tránh tạo trang trắng.</p>
            </div>
            <button
              type="button"
              onClick={toggleAll}
              disabled={availableSections.length === 0 || isExporting}
              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {allAvailableSelected ? 'Bỏ chọn phụ lục' : 'Chọn tất cả phụ lục'}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {SECTION_OPTIONS.map(option => {
              const Icon = option.icon;
              const count = counts[option.id];
              const disabled = count === 0;
              const checked = selectedSections.includes(option.id);
              return (
                <label
                  key={option.id}
                  className={`flex items-start gap-3 rounded-xl border p-4 transition ${
                    disabled
                      ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-55'
                      : checked
                        ? 'cursor-pointer border-blue-400 bg-blue-50 shadow-sm'
                        : 'cursor-pointer border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSection(option.id)}
                    disabled={disabled || isExporting}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className={`rounded-lg p-2 ${checked && !disabled ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <Icon size={17}/>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-black text-slate-800">{option.label}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${disabled ? 'bg-slate-200 text-slate-500' : 'bg-white text-blue-700'}`}>
                        {count} {option.countLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{option.description}</p>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] font-black uppercase text-slate-500">Người thực hiện</label>
              <input
                value={preparedBy}
                onChange={event => setPreparedBy(event.target.value)}
                disabled={isExporting}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Họ và tên"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-black uppercase text-slate-500">Người phê duyệt</label>
              <input
                value={approvedBy}
                onChange={event => setApprovedBy(event.target.value)}
                disabled={isExporting}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Họ và tên"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-black uppercase text-slate-500">Chất lượng PDF</label>
              <select
                value={quality}
                onChange={event => setQuality(event.target.value as 'medium' | 'high')}
                disabled={isExporting}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="high">Cao (khuyến nghị)</option>
                <option value="medium">Tiêu chuẩn (nhẹ hơn)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
          <p className="text-xs font-semibold text-slate-500">
            Sẽ xuất {selectedSections.length} phần trong cùng một file PDF.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="flex-1 rounded-lg bg-slate-100 px-5 py-2.5 text-sm font-black text-slate-600 hover:bg-slate-200 disabled:opacity-50 sm:flex-none"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || !preparedBy.trim() || !approvedBy.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300 sm:flex-none"
            >
              <Download size={17}/>
              {isExporting ? 'Đang tạo hồ sơ...' : 'Xuất hồ sơ PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
