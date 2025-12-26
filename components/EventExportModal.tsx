import React, { useState } from 'react';
import { Download, X } from 'lucide-react';
import { Event, InventoryItem } from '../types';
import { exportEventChecklist } from '../services/exportService';

interface EventExportModalProps {
  isOpen: boolean;
  event: Event;
  inventory: InventoryItem[];
  onClose: () => void;
}

export const EventExportModal: React.FC<EventExportModalProps> = ({
  isOpen,
  event,
  inventory,
  onClose
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [quality, setQuality] = useState<'medium' | 'high'>('high');
  const [includeHeader, setIncludeHeader] = useState(true);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await exportEventChecklist(event, inventory, {
        filename: `Checklist_${event.name}_${new Date().toLocaleDateString('vi-VN')}.pdf`,
        quality,
        includeHeader
      });
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Xuất file thất bại. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Xuất Checklist</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            disabled={isExporting}
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Event Info */}
          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <p className="text-sm text-gray-600">
              <strong>Sự kiện:</strong> {event.name}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              <strong>Địa điểm:</strong> {event.location}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              <strong>Khách hàng:</strong> {event.client}
            </p>
          </div>

          {/* Options */}
          <div className="space-y-4">
            {/* Quality Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chất lượng in:
              </label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as 'medium' | 'high')}
                disabled={isExporting}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="medium">Trung bình (nhanh hơn)</option>
                <option value="high">Cao (chi tiết hơn)</option>
              </select>
            </div>

            {/* Include Header */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="includeHeader"
                checked={includeHeader}
                onChange={(e) => setIncludeHeader(e.target.checked)}
                disabled={isExporting}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="includeHeader" className="ml-2 text-sm text-gray-700">
                Bao gồm tiêu đề và thông tin sự kiện
              </label>
            </div>
          </div>

          {/* File Info */}
          <div className="bg-gray-50 rounded p-3 text-xs text-gray-600">
            <p>
              📄 File được xuất: <strong>Checklist_{event.name}_{new Date().toLocaleDateString('vi-VN')}.pdf</strong>
            </p>
            <p className="mt-1">📋 Bao gồm: Danh sách sản phẩm, nhân sự, chữ ký</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:bg-blue-400 flex items-center justify-center gap-2"
          >
            <Download size={18} />
            {isExporting ? 'Đang xuất...' : 'Tải PDF'}
          </button>
        </div>
      </div>
    </div>
  );
};
