import React, { useEffect, useState } from 'react';
import { Quotation, ComboPackage, InventoryItem, QuotationLineItem } from '../types';
import { 
  FileText, Plus, X, Search, Trash2, Printer, 
  Send, CheckCircle, Download, Package, Box, 
  Calculator, ChevronRight, FileCheck, Upload, Wand2, BadgeDollarSign, ExternalLink
} from 'lucide-react';

interface QuotationManagerProps {
  quotations: Quotation[];
  packages: ComboPackage[];
  inventory: InventoryItem[];
  onCreateQuotation: (q: Quotation) => void;
  onDeleteQuotation: (id: string) => void;
  onUpdateStatus: (id: string, status: Quotation['status']) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

type QuotationSource = 'QUOTE' | 'CONTRACT';

const MAX_CONTRACT_FILE_SIZE = 500 * 1024;

const parseMoneyValue = (value: string) => {
  const normalized = value.replace(/[^\d]/g, '');
  return normalized ? Number(normalized) : 0;
};

const normalizeContractDateTime = (value: string) => {
  const match = value.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:\D{0,8}(\d{1,2})[:h](\d{2}))?/);
  if (!match) return '';
  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  const year = match[3];
  const hour = (match[4] || '00').padStart(2, '0');
  const minute = (match[5] || '00').padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}`;
};

const extractContractInfo = (text: string) => {
  const compactText = text.replace(/\s+/g, ' ').trim();
  const amountContext = compactText.match(/(?:tổng\s*(?:cộng|giá trị|tiền|thanh toán)|giá trị hợp đồng|thành tiền|tạm tính)[^\d]{0,80}([\d.,\s]{5,})\s*(?:vnd|vnđ|đ|dong)?/i);
  const allMoneyValues = Array.from(compactText.matchAll(/(\d{1,3}(?:[.,\s]\d{3})+|\d{7,})\s*(?:vnd|vnđ|đ|dong)?/gi))
    .map(match => parseMoneyValue(match[1]))
    .filter(value => value > 0);
  const amount = amountContext ? parseMoneyValue(amountContext[1]) : Math.max(0, ...allMoneyValues);
  const dateMatch = compactText.match(/\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}(?:\D{0,8}\d{1,2}[:h]\d{2})?/);
  const titleMatch = compactText.match(/(?:hợp đồng|contract|báo giá|quotation)[^.\n]{0,90}/i);

  return {
    contractAmount: amount || undefined,
    contractDateTime: dateMatch ? normalizeContractDateTime(dateMatch[0]) : '',
    contractTitle: titleMatch ? titleMatch[0].trim() : ''
  };
};

const extractReadablePdfText = (bytes: ArrayBuffer) => {
  const raw = new TextDecoder('latin1').decode(bytes);
  return raw
    .replace(/\\[()]/g, '')
    .replace(/[^\x09\x0A\x0D\x20-\x7EÀ-ỹ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const QuotationManager: React.FC<QuotationManagerProps> = ({
  quotations,
  packages,
  inventory,
  onCreateQuotation,
  onDeleteQuotation,
  onUpdateStatus,
  canEdit = true,
  canDelete = true
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingQuotation, setViewingQuotation] = useState<Quotation | null>(null);
  const [pendingPdfId, setPendingPdfId] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const handleCloseViewer = () => { setViewingQuotation(null); setPendingPdfId(null); };
  
  // Create Form State
  const [clientName, setClientName] = useState('');
  const [eventName, setEventName] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [quoteItems, setQuoteItems] = useState<QuotationLineItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [note, setNote] = useState('');
  const [quoteSource, setQuoteSource] = useState<QuotationSource>('QUOTE');
  const [contractFileName, setContractFileName] = useState('');
  const [contractFileDataUrl, setContractFileDataUrl] = useState('');
  const [contractFileType, setContractFileType] = useState('');
  const [contractTitle, setContractTitle] = useState('');
  const [contractDateTime, setContractDateTime] = useState('');
  const [contractAmount, setContractAmount] = useState(0);
  const [contractContactName, setContractContactName] = useState('');
  const [contractSourceText, setContractSourceText] = useState('');
  const [contractNote, setContractNote] = useState('');

  const calculateSubtotal = (items: QuotationLineItem[]) => {
    return items.reduce((sum, item) => sum + item.total, 0);
  };

  const calculateTotal = () => {
    if (quoteSource === 'CONTRACT') return Math.max(0, contractAmount);
    const subtotal = calculateSubtotal(quoteItems);
    return subtotal - discount;
  };

  const loadPdfLib = async () => {
    if ((window as any).html2pdf) return (window as any).html2pdf;
    const mod: any = await import('html2pdf.js');
    return (window as any).html2pdf || mod?.default || mod;
  };

  const handleExportPdf = async (quote: Quotation | null) => {
    if (!quote) return;
    const target = document.getElementById('quotation-print');
    if (!target) {
      console.warn('Không tìm thấy nội dung để xuất PDF.');
      return;
    }
    setIsExportingPdf(true);
    try {
      const html2pdf = await loadPdfLib();
      await html2pdf().set({
        margin: 10,
        filename: `${quote.id}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(target).save();
    } catch (err) {
      console.error('Xuất PDF thất bại', err);
      alert('Xuất PDF thất bại. Vui lòng thử lại.');
    } finally {
      setIsExportingPdf(false);
      setPendingPdfId(null);
    }
  };

  useEffect(() => {
    if (pendingPdfId && viewingQuotation?.id === pendingPdfId) {
      const timer = setTimeout(() => {
        handleExportPdf(viewingQuotation);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [pendingPdfId, viewingQuotation]);

  const applyExtractedContractInfo = (text: string, fallbackTitle?: string) => {
    const extracted = extractContractInfo(text);
    if (extracted.contractTitle) {
      setContractTitle(extracted.contractTitle);
      if (!eventName) setEventName(extracted.contractTitle);
    } else if (fallbackTitle && !contractTitle) {
      const title = fallbackTitle.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      setContractTitle(title);
      if (!eventName) setEventName(title);
    }
    if (extracted.contractDateTime) setContractDateTime(extracted.contractDateTime);
    if (extracted.contractAmount) setContractAmount(extracted.contractAmount);
  };

  const handleContractFileUpload = (file?: File | null) => {
    if (!file) return;
    if (file.size > MAX_CONTRACT_FILE_SIZE) {
      alert('File hợp đồng đang lớn hơn 500KB. Để tránh lỗi lưu dữ liệu, vui lòng dùng file PDF nhỏ hơn hoặc lưu link hợp đồng trong ghi chú.');
      return;
    }
    if (file.type && file.type !== 'application/pdf') {
      alert('Hiện khu vực này ưu tiên file PDF. Vui lòng tải lên hợp đồng dạng PDF.');
      return;
    }

    setQuoteSource('CONTRACT');
    setContractFileName(file.name);
    setContractFileType(file.type || 'application/pdf');
    const reader = new FileReader();
    reader.onload = () => {
      setContractFileDataUrl(String(reader.result || ''));
    };
    reader.readAsDataURL(file);

    const textReader = new FileReader();
    textReader.onload = () => {
      const bytes = textReader.result;
      if (!(bytes instanceof ArrayBuffer)) return;
      const readableText = extractReadablePdfText(bytes);
      if (readableText) {
        setContractSourceText(readableText.slice(0, 8000));
        applyExtractedContractInfo(readableText, file.name);
      } else {
        applyExtractedContractInfo('', file.name);
      }
    };
    textReader.readAsArrayBuffer(file);
  };

  const handleExtractContractText = () => {
    if (!contractSourceText.trim()) {
      alert('Vui lòng dán nội dung hợp đồng hoặc tải PDF trước khi trích thông tin.');
      return;
    }
    applyExtractedContractInfo(contractSourceText, contractFileName);
  };

  const handleAddItem = (itemId: string) => {
    if (!canEdit) return;
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;
    
    const newItem: QuotationLineItem = {
      type: 'ITEM',
      id: item.id,
      name: item.name,
      quantity: 1,
      unitPrice: item.rentalPrice,
      total: item.rentalPrice
    };
    setQuoteItems([...quoteItems, newItem]);
  };

  const handleAddPackage = (pkgId: string) => {
    if (!canEdit) return;
    const pkg = packages.find(p => p.id === pkgId);
    if (!pkg) return;

    const newItem: QuotationLineItem = {
      type: 'PACKAGE',
      id: pkg.id,
      name: pkg.name,
      quantity: 1,
      unitPrice: pkg.packagePrice,
      total: pkg.packagePrice
    };
    setQuoteItems([...quoteItems, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    if (!canEdit) return;
    setQuoteItems(quoteItems.filter((_, i) => i !== index));
  };

  const handleUpdateItemQty = (index: number, qty: number) => {
    if (!canEdit) return;
    setQuoteItems(quoteItems.map((item, i) => {
      if (i === index) {
        return { ...item, quantity: qty, total: qty * item.unitPrice };
      }
      return item;
    }));
  };

  const handleSubmitQuotation = () => {
    if (!canEdit) return;
    if (quoteSource === 'CONTRACT') {
      if (!clientName || !eventName || contractAmount <= 0) {
        alert('Vui lòng nhập khách hàng, tên sự kiện và giá trị hợp đồng.');
        return;
      }
    } else if (!clientName || quoteItems.length === 0) {
      alert("Vui lòng nhập tên khách hàng và ít nhất 1 hạng mục.");
      return;
    }

    const newQuote: Quotation = {
      id: `QT-${Date.now()}`,
      clientName,
      eventName,
      date: new Date().toISOString().split('T')[0],
      validUntil: validUntil || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items: quoteItems,
      discount: quoteSource === 'CONTRACT' ? 0 : discount,
      tax: 0,
      totalAmount: calculateTotal(),
      note: quoteSource === 'CONTRACT' ? [note, contractNote].filter(Boolean).join('\n') : note,
      status: 'DRAFT',
      source: quoteSource,
      ...(quoteSource === 'CONTRACT' ? {
        contract: {
          fileName: contractFileName || undefined,
          fileDataUrl: contractFileDataUrl || undefined,
          fileType: contractFileType || undefined,
          sourceText: contractSourceText ? contractSourceText.slice(0, 8000) : undefined,
          contractTitle: contractTitle || eventName || undefined,
          contractDateTime: contractDateTime || undefined,
          contractAmount,
          contactName: contractContactName || undefined,
          note: contractNote || undefined
        }
      } : {})
    };

    onCreateQuotation(newQuote);
    setShowCreateModal(false);
    resetForm();
  };

  const resetForm = () => {
    setClientName('');
    setEventName('');
    setValidUntil('');
    setQuoteItems([]);
    setDiscount(0);
    setNote('');
    setQuoteSource('QUOTE');
    setContractFileName('');
    setContractFileDataUrl('');
    setContractFileType('');
    setContractTitle('');
    setContractDateTime('');
    setContractAmount(0);
    setContractContactName('');
    setContractSourceText('');
    setContractNote('');
  };

  const renderStatusBadge = (status: Quotation['status']) => {
    switch (status) {
      case 'ACCEPTED': return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">ĐÃ CHỐT</span>;
      case 'SENT': return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">ĐÃ GỬI</span>;
      default: return <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold">BẢN NHÁP</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-gray-800">Quản Lý Báo Giá</h2>
           <p className="text-gray-500 text-sm mt-1">Tạo báo giá chuyên nghiệp cho khách hàng dựa trên kho và gói thiết bị.</p>
        </div>
        {canEdit && (
          <button 
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 text-sm font-medium shadow-sm"
          >
            <Plus size={16} /> Tạo Báo Giá Mới
          </button>
        )}
      </div>

      {/* Quotation List Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Mã / Khách hàng</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Sự kiện</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Ngày tạo</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Tổng tiền</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Trạng thái</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quotations.map(q => (
              <tr key={q.id} className="hover:bg-slate-50/50 transition">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-800">{q.id}</p>
                    {q.source === 'CONTRACT' && (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase">Hợp đồng</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{q.clientName}</p>
                  {q.contract?.fileName && <p className="text-[11px] text-slate-400 truncate max-w-[220px]">{q.contract.fileName}</p>}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{q.eventName || '---'}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{q.date}</td>
                <td className="px-6 py-4 font-bold text-blue-600">{q.totalAmount.toLocaleString()} đ</td>
                <td className="px-6 py-4 text-center">{renderStatusBadge(q.status)}</td>
                <td className="px-6 py-4 text-right space-x-2">
                   <button 
                    onClick={() => setViewingQuotation(q)}
                    className="p-2 text-gray-400 hover:text-blue-600 transition"
                    title="Xem chi tiết báo giá"
                   >
                     <FileText size={18} />
                   </button>
                   <button 
                    onClick={() => { setViewingQuotation(q); setPendingPdfId(q.id); }}
                    className="p-2 text-gray-400 hover:text-green-600 transition"
                    title="Xuất PDF"
                   >
                     <Download size={18} />
                   </button>
                   {canDelete && (
                     <button 
                      onClick={() => onDeleteQuotation(q.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition"
                     >
                       <Trash2 size={18} />
                     </button>
                   )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {quotations.length === 0 && (
          <div className="text-center py-20 text-gray-400 italic">Chưa có báo giá nào được tạo.</div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                 <FileCheck className="text-blue-600" /> Lập Báo Giá Mới
               </h3>
               <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                 <X size={24} />
               </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col lg:flex-row gap-8">
               {/* Left: Input Form */}
               <div className="flex-1 space-y-6">
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setQuoteSource('QUOTE')}
                      className={`rounded-lg px-3 py-2 text-sm font-bold transition ${quoteSource === 'QUOTE' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      Báo giá thiết bị
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuoteSource('CONTRACT')}
                      className={`rounded-lg px-3 py-2 text-sm font-bold transition ${quoteSource === 'CONTRACT' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      Hợp đồng/PDF
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Khách hàng</label>
                        <input 
                          type="text" 
                          className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          placeholder="Tên cá nhân/tổ chức"
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tên sự kiện</label>
                        <input 
                          type="text" 
                          className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          value={eventName}
                          onChange={(e) => setEventName(e.target.value)}
                          placeholder="VD: Hội nghị tổng kết"
                        />
                     </div>
                  </div>

                  {quoteSource === 'CONTRACT' && (
                    <div className="border-t border-slate-100 pt-6 space-y-4">
                      <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="font-bold text-gray-800 flex items-center gap-2">
                              <FileText size={18} className="text-blue-600" /> Thông tin hợp đồng
                            </h4>
                            <p className="text-xs text-slate-500 mt-1">
                              Tải PDF hoặc dán nội dung hợp đồng để lưu doanh thu chính thức cho sự kiện.
                            </p>
                          </div>
                          <label className="inline-flex items-center gap-2 bg-blue-600 text-white rounded-lg px-3 py-2 text-xs font-bold hover:bg-blue-700 cursor-pointer">
                            <Upload size={15} />
                            Tải PDF
                            <input
                              type="file"
                              accept="application/pdf,.pdf"
                              className="hidden"
                              onChange={e => handleContractFileUpload(e.target.files?.[0])}
                            />
                          </label>
                        </div>
                        {contractFileName && (
                          <div className="flex items-center justify-between gap-2 rounded-lg bg-white border border-blue-100 px-3 py-2 text-xs">
                            <span className="font-semibold text-slate-700 truncate">{contractFileName}</span>
                            {contractFileDataUrl && (
                              <a
                                href={contractFileDataUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-blue-700 font-bold hover:underline shrink-0"
                              >
                                <ExternalLink size={13} /> Mở
                              </a>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tên hợp đồng</label>
                          <input
                            type="text"
                            className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            value={contractTitle}
                            onChange={e => setContractTitle(e.target.value)}
                            placeholder="VD: Hợp đồng tổ chức sự kiện..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Người liên hệ</label>
                          <input
                            type="text"
                            className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            value={contractContactName}
                            onChange={e => setContractContactName(e.target.value)}
                            placeholder="Tên sale/đại diện khách hàng"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ngày giờ hợp đồng/sự kiện</label>
                          <input
                            type="datetime-local"
                            className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            value={contractDateTime}
                            onChange={e => setContractDateTime(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Giá trị hợp đồng</label>
                          <div className="relative">
                            <BadgeDollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600" />
                            <input
                              type="number"
                              min="0"
                              className="w-full border border-slate-300 rounded-lg py-2 pl-9 pr-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-black text-blue-700"
                              value={contractAmount}
                              onChange={e => setContractAmount(Number(e.target.value))}
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <label className="block text-xs font-bold text-gray-500 uppercase">Nội dung trích từ PDF / hợp đồng</label>
                          <button
                            type="button"
                            onClick={handleExtractContractText}
                            className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5 hover:bg-blue-100"
                          >
                            <Wand2 size={14} /> Trích thông tin
                          </button>
                        </div>
                        <textarea
                          className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          rows={4}
                          value={contractSourceText}
                          onChange={e => setContractSourceText(e.target.value)}
                          placeholder="Nếu PDF là bản scan và không tự đọc được, hãy copy nội dung chính của hợp đồng vào đây rồi bấm Trích thông tin."
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ghi chú hợp đồng</label>
                        <textarea
                          className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          rows={2}
                          value={contractNote}
                          onChange={e => setContractNote(e.target.value)}
                          placeholder="Điều khoản thanh toán, số hợp đồng, link Drive..."
                        />
                      </div>
                    </div>
                  )}

                  {quoteSource === 'QUOTE' && (
                  <div className="border-t border-slate-100 pt-6">
                     <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                       <Calculator size={18} className="text-blue-500" /> Thêm hạng mục
                     </h4>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-2">
                           <p className="text-xs font-bold text-gray-400 uppercase">Gói Combo</p>
                           <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                              {packages.map(p => (
                                <button 
                                  key={p.id}
                                  onClick={() => handleAddPackage(p.id)}
                                  className="w-full text-left p-2 hover:bg-blue-50 text-xs flex items-center justify-between"
                                >
                                  <span>{p.name}</span>
                                  <span className="font-bold text-blue-600">{p.packagePrice.toLocaleString()}đ</span>
                                </button>
                              ))}
                           </div>
                        </div>
                        <div className="space-y-2">
                           <p className="text-xs font-bold text-gray-400 uppercase">Thiết bị lẻ</p>
                           <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                              {inventory.map(i => (
                                <button 
                                  key={i.id}
                                  onClick={() => handleAddItem(i.id)}
                                  className="w-full text-left p-2 hover:bg-blue-50 text-xs flex items-center justify-between"
                                >
                                  <span>{i.name}</span>
                                  <span className="font-bold text-blue-600">{i.rentalPrice.toLocaleString()}đ</span>
                                </button>
                              ))}
                           </div>
                        </div>
                     </div>
                  </div>
                  )}

                  <div className="border-t border-slate-100 pt-6">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ghi chú báo giá</label>
                    <textarea 
                      className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      rows={2}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>
               </div>

               {/* Right: Items Preview & Totals */}
               <div className="w-full lg:w-96 bg-slate-50 p-6 rounded-2xl flex flex-col h-full border border-slate-200 shadow-inner">
                  <h4 className="font-bold text-gray-800 mb-4 uppercase text-xs">
                    {quoteSource === 'CONTRACT' ? 'Tóm tắt hợp đồng' : 'Chi tiết bảng giá'}
                  </h4>
                  
                  <div className="flex-1 overflow-y-auto space-y-3 mb-6">
                     {quoteSource === 'CONTRACT' ? (
                       <div className="space-y-3">
                         <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                           <p className="text-[10px] font-black text-blue-600 uppercase">Giá trị ghi nhận doanh thu</p>
                           <p className="mt-2 text-2xl font-black text-blue-700">{contractAmount.toLocaleString()} đ</p>
                           <p className="mt-1 text-xs text-slate-500">Số tiền này sẽ được đưa vào doanh thu khi gắn báo giá/hợp đồng vào sự kiện.</p>
                         </div>
                         <div className="bg-white p-4 rounded-xl border border-slate-100 text-sm space-y-2">
                           <div>
                             <p className="text-[10px] font-black text-slate-400 uppercase">Tên hợp đồng</p>
                             <p className="font-bold text-slate-800">{contractTitle || eventName || 'Chưa nhập'}</p>
                           </div>
                           <div>
                             <p className="text-[10px] font-black text-slate-400 uppercase">Ngày giờ</p>
                             <p className="font-bold text-slate-800">{contractDateTime ? new Date(contractDateTime).toLocaleString('vi-VN') : 'Chưa nhập'}</p>
                           </div>
                           <div>
                             <p className="text-[10px] font-black text-slate-400 uppercase">File</p>
                             <p className="font-bold text-slate-800 break-words">{contractFileName || 'Chưa tải PDF'}</p>
                           </div>
                         </div>
                       </div>
                     ) : (
                     <>
                     {quoteItems.length === 0 && (
                       <p className="text-center text-gray-400 text-sm mt-10 italic">Chưa có hạng mục nào.</p>
                     )}
                     {quoteItems.map((item, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 relative group">
                           <button 
                            onClick={() => handleRemoveItem(idx)}
                            className="absolute -top-1 -right-1 bg-red-100 text-red-600 p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition"
                           >
                             <X size={12} />
                           </button>
                           <p className="text-xs font-bold text-gray-700">{item.name}</p>
                           <div className="flex justify-between items-center mt-2">
                              <div className="flex items-center gap-2">
                                 <input 
                                  type="number" 
                                  min="1" 
                                  className="w-10 border border-slate-200 rounded p-0.5 text-xs text-center"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateItemQty(idx, Number(e.target.value))}
                                 />
                                 <span className="text-[10px] text-gray-400">x {item.unitPrice.toLocaleString()}đ</span>
                              </div>
                              <p className="text-xs font-bold text-blue-600">{item.total.toLocaleString()}đ</p>
                           </div>
                        </div>
                     ))}
                     </>
                     )}
                  </div>

                  <div className="space-y-3 border-t border-slate-200 pt-4">
                     <div className="flex justify-between text-sm">
                        <span className="text-gray-500">{quoteSource === 'CONTRACT' ? 'Giá trị hợp đồng:' : 'Tạm tính:'}</span>
                        <span className="font-bold text-gray-700">
                          {(quoteSource === 'CONTRACT' ? contractAmount : calculateSubtotal(quoteItems)).toLocaleString()} đ
                        </span>
                     </div>
                     {quoteSource === 'QUOTE' && (
                     <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Chiết khấu:</span>
                        <input 
                          type="number" 
                          className="w-24 border border-slate-300 rounded p-1 text-right text-xs font-bold"
                          value={discount}
                          onChange={(e) => setDiscount(Number(e.target.value))}
                        />
                     </div>
                     )}
                     <div className="flex justify-between text-lg pt-2 border-t border-blue-200">
                        <span className="font-bold text-gray-800">TỔNG CỘNG:</span>
                        <span className="font-black text-blue-600">{calculateTotal().toLocaleString()} VNĐ</span>
                     </div>
                  </div>
               </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
               <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium">Hủy bỏ</button>
               {canEdit && (
                 <button 
                  onClick={handleSubmitQuotation}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md shadow-blue-200 transition"
                 >
                   Tạo & Lưu Báo Giá
                 </button>
               )}
            </div>
          </div>
        </div>
      )}

      {/* View Detail / Invoice Modal */}
      {viewingQuotation && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
             <div className="p-4 bg-slate-800 text-white flex justify-between items-center print:hidden">
                <h3 className="font-bold">Xem trước Báo giá</h3>
                <div className="flex gap-2">
                   <button 
                     onClick={() => handleExportPdf(viewingQuotation)}
                     className="p-2 bg-white/10 hover:bg-white/20 rounded flex items-center gap-2 text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                     disabled={isExportingPdf}
                   >
                     <Download size={16} /> {isExportingPdf ? 'Đang xuất...' : 'Xuất PDF'}
                   </button>
                   <button onClick={() => window.print()} className="p-2 bg-white/10 hover:bg-white/20 rounded flex items-center gap-2 text-xs">
                      <Printer size={16} /> In Báo Giá
                    </button>
                    {canEdit && (
                      <button 
                        onClick={() => { onUpdateStatus(viewingQuotation.id, 'ACCEPTED'); handleCloseViewer(); }} 
                        className="p-2 bg-green-600 hover:bg-green-700 rounded flex items-center gap-2 text-xs"
                      >
                        <CheckCircle size={16} /> Chốt Báo Giá
                      </button>
                    )}
                    <button onClick={handleCloseViewer} className="p-2 text-white/50 hover:text-white">
                      <X size={20} />
                    </button>
                 </div>
              </div>

              {/* Invoice Layout */}
              <div className="flex-1 overflow-y-auto p-6 md:p-12 bg-white text-slate-800" id="quotation-print">
                 <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-12">
                    <div>
                       <h1 className="text-3xl font-black text-blue-600 mb-1">BÁO GIÁ DỊCH VỤ</h1>
                       <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">SỐ: {viewingQuotation.id}</p>
                    </div>
                <div className="text-right">
                  <h2 className="text-xl font-bold">EINSTEIN BUS _ AI Warehouse</h2>
                  <p className="text-sm text-slate-500">123 Phố Sự Kiện, Hà Nội</p>
                  <p className="text-sm text-slate-500">Hotline: 09xx-xxx-xxx</p>
                </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 mb-12">
                    <div>
                       <p className="text-xs font-bold text-blue-600 uppercase mb-2">Khách hàng / Đơn vị:</p>
                       <p className="text-lg font-bold">{viewingQuotation.clientName}</p>
                       <p className="text-sm text-slate-600 mt-1">Sự kiện: <span className="font-medium">{viewingQuotation.eventName}</span></p>
                       {viewingQuotation.source === 'CONTRACT' && (
                         <div className="mt-3 rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm">
                           <p className="text-xs font-bold text-blue-600 uppercase">Hợp đồng/PDF</p>
                           <p className="font-bold text-slate-800 mt-1">{viewingQuotation.contract?.contractTitle || viewingQuotation.eventName}</p>
                           {viewingQuotation.contract?.contractDateTime && (
                             <p className="text-slate-600 mt-1">Ngày giờ: {new Date(viewingQuotation.contract.contractDateTime).toLocaleString('vi-VN')}</p>
                           )}
                           {viewingQuotation.contract?.fileDataUrl && (
                             <a
                               href={viewingQuotation.contract.fileDataUrl}
                               target="_blank"
                               rel="noreferrer"
                               className="inline-flex items-center gap-1 text-blue-700 font-bold text-xs mt-2 print:hidden"
                             >
                               <ExternalLink size={13} /> Mở file hợp đồng
                             </a>
                           )}
                         </div>
                       )}
                    </div>
                    <div className="text-right">
                       <p className="text-xs font-bold text-blue-600 uppercase mb-2">Thời gian:</p>
                       <p className="text-sm">Ngày lập: <span className="font-bold">{viewingQuotation.date}</span></p>
                       <p className="text-sm">Có giá trị đến: <span className="font-bold">{viewingQuotation.validUntil}</span></p>
                    </div>
                 </div>

                 {viewingQuotation.items.length > 0 ? (
                 <div className="overflow-x-auto">
                 <table className="min-w-[560px] w-full mb-8">
                    <thead>
                       <tr className="bg-slate-100 text-left">
                          <th className="px-4 py-3 text-xs font-bold uppercase">Hạng mục</th>
                          <th className="px-4 py-3 text-xs font-bold uppercase text-center">Số lượng</th>
                          <th className="px-4 py-3 text-xs font-bold uppercase text-right">Đơn giá</th>
                          <th className="px-4 py-3 text-xs font-bold uppercase text-right">Thành tiền</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {viewingQuotation.items.map((item, idx) => (
                          <tr key={idx}>
                             <td className="px-4 py-4">
                                <p className="font-bold text-sm">{item.name}</p>
                                <p className="text-[10px] text-slate-400">{item.type === 'PACKAGE' ? 'Dịch vụ trọn gói' : 'Thiết bị lẻ'}</p>
                             </td>
                             <td className="px-4 py-4 text-sm text-center font-bold">{item.quantity}</td>
                             <td className="px-4 py-4 text-sm text-right">{item.unitPrice.toLocaleString()}</td>
                            <td className="px-4 py-4 text-sm text-right font-bold">{item.total.toLocaleString()}</td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
                 </div>
                 ) : (
                   <div className="mb-8 rounded-2xl border border-blue-100 bg-blue-50 p-5">
                     <p className="text-xs font-bold text-blue-600 uppercase">Giá trị hợp đồng ghi nhận</p>
                     <p className="mt-2 text-3xl font-black text-blue-700">{viewingQuotation.totalAmount.toLocaleString()} đ</p>
                     <p className="mt-2 text-sm text-slate-600">
                       Báo giá này được tạo từ hợp đồng/PDF nên không có danh sách thiết bị chi tiết. Khi gắn vào sự kiện, hệ thống dùng số tiền này để tính doanh thu.
                     </p>
                   </div>
                 )}

                 <div className="flex justify-end">
                    <div className="w-72 space-y-3">
                       <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Tạm tính:</span>
                          <span className="font-bold">{calculateSubtotal(viewingQuotation.items).toLocaleString()} đ</span>
                       </div>
                       {viewingQuotation.discount > 0 && (
                          <div className="flex justify-between text-sm text-red-600">
                             <span className="font-medium">Chiết khấu:</span>
                             <span className="font-bold">-{viewingQuotation.discount.toLocaleString()} đ</span>
                          </div>
                       )}
                       <div className="flex justify-between text-xl border-t-2 border-slate-800 pt-3">
                          <span className="font-black">TỔNG CỘNG:</span>
                          <span className="font-black text-blue-600">{viewingQuotation.totalAmount.toLocaleString()} đ</span>
                       </div>
                    </div>
                 </div>

                 <div className="mt-12 pt-8 border-t border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Ghi chú & Điều khoản:</p>
                    <p className="text-xs text-slate-500 leading-relaxed italic">
                       {viewingQuotation.note || 'Báo giá đã bao gồm kỹ thuật vận hành cơ bản. Quý khách vui lòng chốt báo giá trước ngày tổ chức 2 ngày.'}
                    </p>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
