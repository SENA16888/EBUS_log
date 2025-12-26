import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Event, InventoryItem } from '../types';

interface ExportOptions {
  filename?: string;
  quality?: 'low' | 'medium' | 'high';
  includeHeader?: boolean;
}

export const exportEventChecklist = async (
  event: Event,
  inventory: InventoryItem[],
  options: ExportOptions = {}
): Promise<void> => {
  const { 
    filename = `Event_${event.name}_Checklist.pdf`,
    quality = 'high',
    includeHeader = true
  } = options;

  try {
    // Create a temporary container for rendering
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.width = '210mm'; // A4 width
    container.style.padding = '20px';
    container.style.backgroundColor = 'white';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.fontSize = '12px';
    container.style.color = '#000';

    // Header
    if (includeHeader) {
      const header = document.createElement('div');
      header.style.marginBottom = '20px';
      header.style.borderBottom = '2px solid #333';
      header.style.paddingBottom = '10px';
      header.innerHTML = `
        <h1 style="margin: 0; font-size: 24px; color: #333;">${event.name}</h1>
        <p style="margin: 5px 0; font-size: 11px; color: #666;">
          <strong>Địa điểm:</strong> ${event.location} | 
          <strong>Khách hàng:</strong> ${event.client}<br/>
          <strong>Thời gian:</strong> ${new Date(event.startDate).toLocaleDateString('vi-VN')} - ${new Date(event.endDate).toLocaleDateString('vi-VN')}
        </p>
      `;
      container.appendChild(header);
    }

    // Section 1: Inventory Checklist
    const inventorySection = document.createElement('div');
    inventorySection.style.marginBottom = '30px';
    inventorySection.style.pageBreakInside = 'avoid';

    const inventoryTitle = document.createElement('h2');
    inventoryTitle.style.fontSize = '16px';
    inventoryTitle.style.fontWeight = 'bold';
    inventoryTitle.style.marginBottom = '10px';
    inventoryTitle.style.borderBottom = '1px solid #999';
    inventoryTitle.style.paddingBottom = '5px';
    inventoryTitle.textContent = 'DANH SÁCH SẢN PHẨM CẦM ĐI';
    inventorySection.appendChild(inventoryTitle);

    // Build inventory table
    const inventoryTable = document.createElement('table');
    inventoryTable.style.width = '100%';
    inventoryTable.style.borderCollapse = 'collapse';
    inventoryTable.style.marginBottom = '10px';
    inventoryTable.style.fontSize = '11px';

    // Table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.style.backgroundColor = '#f0f0f0';
    headerRow.style.borderBottom = '2px solid #333';
    
    const headers = ['STT', 'Tên sản phẩm', 'Số lượng', 'Ghi chú'];
    headers.forEach(h => {
      const th = document.createElement('th');
      th.style.padding = '8px';
      th.style.textAlign = 'left';
      th.style.fontWeight = 'bold';
      th.style.border = '1px solid #ddd';
      th.textContent = h;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    inventoryTable.appendChild(thead);

    // Table body
    const tbody = document.createElement('tbody');
    event.items.forEach((item, idx) => {
      const inv = inventory.find(i => i.id === item.itemId);
      if (!inv) return;

      const row = document.createElement('tr');
      row.style.borderBottom = '1px solid #ddd';
      row.style.backgroundColor = idx % 2 === 0 ? '#fff' : '#f9f9f9';

      const cells = [
        (idx + 1).toString(),
        inv.name,
        item.quantity.toString(),
        item.done ? '✓ Hoàn tất' : 'Chưa'
      ];

      cells.forEach((cell, cellIdx) => {
        const td = document.createElement('td');
        td.style.padding = '8px';
        td.style.border = '1px solid #ddd';
        td.style.textAlign = cellIdx === 2 ? 'center' : 'left';
        td.textContent = cell;
        if (cellIdx === 3 && item.done) {
          td.style.color = '#28a745';
          td.style.fontWeight = 'bold';
        }
        row.appendChild(td);
      });

      tbody.appendChild(row);
    });
    inventoryTable.appendChild(tbody);
    inventorySection.appendChild(inventoryTable);

    // Summary
    const summary = document.createElement('div');
    summary.style.fontSize = '11px';
    summary.style.color = '#666';
    const totalQty = event.items.reduce((sum, item) => sum + item.quantity, 0);
    const completedItems = event.items.filter(i => i.done).length;
    summary.innerHTML = `
      <p style="margin: 5px 0;"><strong>Tổng số loại:</strong> ${event.items.length}</p>
      <p style="margin: 5px 0;"><strong>Tổng số lượng:</strong> ${totalQty}</p>
      <p style="margin: 5px 0;"><strong>Đã kiểm:</strong> ${completedItems}/${event.items.length}</p>
    `;
    inventorySection.appendChild(summary);
    container.appendChild(inventorySection);

    // Section 2: Staff Checklist (if exists)
    if (event.staff && event.staff.length > 0) {
      const staffSection = document.createElement('div');
      staffSection.style.marginBottom = '30px';
      staffSection.style.pageBreakInside = 'avoid';

      const staffTitle = document.createElement('h2');
      staffTitle.style.fontSize = '16px';
      staffTitle.style.fontWeight = 'bold';
      staffTitle.style.marginBottom = '10px';
      staffTitle.style.borderBottom = '1px solid #999';
      staffTitle.style.paddingBottom = '5px';
      staffTitle.textContent = 'DANH SÁCH NHÂN SỰ';
      staffSection.appendChild(staffTitle);

      const staffTable = document.createElement('table');
      staffTable.style.width = '100%';
      staffTable.style.borderCollapse = 'collapse';
      staffTable.style.fontSize = '11px';

      const staffHead = document.createElement('thead');
      const staffHeaderRow = document.createElement('tr');
      staffHeaderRow.style.backgroundColor = '#f0f0f0';
      staffHeaderRow.style.borderBottom = '2px solid #333';

      ['STT', 'Tên', 'Vị trí', 'Ca làm', 'Trạng thái'].forEach(h => {
        const th = document.createElement('th');
        th.style.padding = '8px';
        th.style.textAlign = 'left';
        th.style.fontWeight = 'bold';
        th.style.border = '1px solid #ddd';
        th.textContent = h;
        staffHeaderRow.appendChild(th);
      });
      staffHead.appendChild(staffHeaderRow);
      staffTable.appendChild(staffHead);

      const staffBody = document.createElement('tbody');
      event.staff.forEach((staff, idx) => {
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid #ddd';
        row.style.backgroundColor = idx % 2 === 0 ? '#fff' : '#f9f9f9';

        const staffCells = [
          (idx + 1).toString(),
          staff.task || 'N/A',
          `${staff.quantity} ${staff.unit}`,
          staff.session || staff.sessions?.join(', ') || 'N/A',
          staff.done ? '✓' : ''
        ];

        staffCells.forEach((cell, cellIdx) => {
          const td = document.createElement('td');
          td.style.padding = '8px';
          td.style.border = '1px solid #ddd';
          td.textContent = cell;
          if (cellIdx === 4 && staff.done) {
            td.style.color = '#28a745';
            td.style.fontWeight = 'bold';
          }
          row.appendChild(td);
        });

        staffBody.appendChild(row);
      });
      staffTable.appendChild(staffBody);
      staffSection.appendChild(staffTable);
      container.appendChild(staffSection);
    }

    // Section 3: Notes/Signature
    const footerSection = document.createElement('div');
    footerSection.style.marginTop = '40px';
    footerSection.style.paddingTop = '20px';
    footerSection.style.borderTop = '1px solid #999';
    footerSection.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-top: 40px;">
        <div style="text-align: center; width: 40%;">
          <p style="margin-bottom: 60px; font-size: 10px;">Người lập</p>
          <p style="border-top: 1px solid #000; padding-top: 5px; font-size: 10px;">Ký và ghi rõ họ tên</p>
        </div>
        <div style="text-align: center; width: 40%;">
          <p style="margin-bottom: 60px; font-size: 10px;">Người kiểm tra</p>
          <p style="border-top: 1px solid #000; padding-top: 5px; font-size: 10px;">Ký và ghi rõ họ tên</p>
        </div>
      </div>
      <p style="text-align: center; font-size: 10px; color: #999; margin-top: 30px;">
        In lúc: ${new Date().toLocaleString('vi-VN')}
      </p>
    `;
    footerSection.appendChild(footerSection);
    container.appendChild(footerSection);

    document.body.appendChild(container);

    // Convert HTML to Canvas
    const canvas = await html2canvas(container, {
      scale: quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1,
      logging: false,
      backgroundColor: '#ffffff'
    });

    // Create PDF from Canvas
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgWidth = 210 - 20; // A4 width minus margins
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    // Add image pages to PDF
    pdf.addImage(imgData, 'PNG', 10, position + 10, imgWidth, imgHeight);
    heightLeft -= pdf.internal.pageSize.getHeight() - 20;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position + 10, imgWidth, imgHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();
    }

    pdf.save(filename);

    // Cleanup
    document.body.removeChild(container);
    console.log(`PDF exported: ${filename}`);
  } catch (error) {
    console.error('Error exporting PDF:', error);
    throw error;
  }
};
