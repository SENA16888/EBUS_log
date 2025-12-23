
import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { InventoryManager } from './components/InventoryManager';
import { EventManager } from './components/EventManager';
import { PackageManager } from './components/PackageManager';
import { EmployeeManager } from './components/EmployeeManager';
import { QuotationManager } from './components/QuotationManager';
import { AIChat } from './components/AIChat';
import { AppState, InventoryItem, Event, EventStatus, Transaction, TransactionType, ComboPackage, Employee, Quotation, QuotationLineItem, EventStaffAllocation, EventExpense, LogEntry } from './types';
import { MOCK_INVENTORY, MOCK_EVENTS, MOCK_TRANSACTIONS, MOCK_PACKAGES, MOCK_EMPLOYEES } from './constants';
import { MessageSquare } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'events' | 'packages' | 'employees' | 'quotations'>('dashboard');
  const [isChatOpen, setIsChatOpen] = useState(false);

  const calculateQuotationTotal = (items: QuotationLineItem[], discount: number) => {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    return subtotal - discount;
  };

  const [appState, setAppState] = useState<AppState>({
    inventory: MOCK_INVENTORY,
    events: MOCK_EVENTS,
    transactions: MOCK_TRANSACTIONS,
    packages: MOCK_PACKAGES,
    employees: MOCK_EMPLOYEES,
    quotations: [],
    logs: []
  });

  const addLog = (message: string, type: LogEntry['type'] = 'INFO') => {
    const newLog: LogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date(),
      message,
      type,
    };
    setAppState(prev => ({
      ...prev,
      logs: [newLog, ...prev.logs].slice(0, 50), // Giữ lại 50 log gần nhất
    }));
  };

  // --- Handlers cho Kho hàng ---
  const handleUpdateInventory = (updatedItem: InventoryItem) => {
    setAppState(prev => ({
      ...prev,
      inventory: prev.inventory.map(i => i.id === updatedItem.id ? updatedItem : i)
    }));
    addLog(`Cập nhật thông tin thiết bị: ${updatedItem.name}`, 'INFO');
  };

  const handleAddNewItem = (item: InventoryItem) => {
    setAppState(prev => ({
      ...prev,
      inventory: [...prev.inventory, item]
    }));
    addLog(`Đã thêm thiết bị mới: ${item.name}`, 'SUCCESS');
  };
  
  const handleBulkImport = (items: InventoryItem[]) => {
    setAppState(prev => {
      let currentInv = [...prev.inventory];
      items.forEach(newItem => {
        const existingIdx = currentInv.findIndex(i => i.name.toLowerCase() === newItem.name.toLowerCase());
        if (existingIdx > -1) {
          currentInv[existingIdx] = {
            ...currentInv[existingIdx],
            totalQuantity: currentInv[existingIdx].totalQuantity + newItem.totalQuantity,
            availableQuantity: currentInv[existingIdx].availableQuantity + newItem.availableQuantity
          };
        } else {
          currentInv.push(newItem);
        }
      });
      return { ...prev, inventory: currentInv };
    });
    addLog(`Đã nhập hàng loạt ${items.length} hạng mục.`, 'INFO');
  };

  const handleDeleteItem = (id: string) => {
    const itemToDelete = appState.inventory.find(i => i.id === id);
    if (!itemToDelete) return;

    if (itemToDelete.inUseQuantity > 0) {
      alert(`CẢNH BÁO: Không thể xóa "${itemToDelete.name}"!\n\nLý do: Đang có ${itemToDelete.inUseQuantity} chiếc đang được sử dụng tại sự kiện.\nVui lòng thu hồi thiết bị về kho trước khi xóa.`);
      addLog(`Xóa thất bại: "${itemToDelete.name}" đang được sử dụng.`, 'WARNING');
      return;
    }

    setAppState(prev => {
      const newInventory = prev.inventory.filter(i => i.id !== id);
      const newPackages = prev.packages.map(pkg => ({
        ...pkg,
        items: pkg.items.filter(item => item.itemId !== id)
      }));
      const newQuotations = prev.quotations.map(q => {
        const filteredItems = q.items.filter(item => !(item.type === 'ITEM' && item.id === id));
        return {
          ...q,
          items: filteredItems,
          totalAmount: calculateQuotationTotal(filteredItems, q.discount)
        };
      });
      const newEvents = prev.events.map(e => ({
        ...e,
        items: e.items.filter(ai => ai.itemId !== id)
      }));

      return {
        ...prev,
        inventory: newInventory,
        packages: newPackages,
        quotations: newQuotations,
        events: newEvents
      };
    });
    addLog(`Đã xóa thiết bị: ${itemToDelete.name}`, 'SUCCESS');
  };

  const handleRestockItem = (id: string, qty: number) => {
    let itemName = '';
    setAppState(prev => ({
      ...prev,
      inventory: prev.inventory.map(i => {
        if (i.id === id) {
          itemName = i.name;
          return { ...i, totalQuantity: i.totalQuantity + qty, availableQuantity: i.availableQuantity + qty }
        }
        return i;
      })
    }));
    addLog(`Nhập thêm ${qty} chiếc "${itemName}" vào kho.`, 'INFO');
  };

  const handleItemStatusChange = (id: string, action: string, qty: number, note: string) => {
    let itemName = '';
    setAppState(prev => {
      const inventory = prev.inventory.map(item => {
        if (item.id !== id) return item;
        itemName = item.name;
        let { availableQuantity, maintenanceQuantity, brokenQuantity, lostQuantity, totalQuantity } = item;
        const safeQty = Math.min(qty, availableQuantity);

        if (action === 'TO_MAINTENANCE') { availableQuantity -= safeQty; maintenanceQuantity += safeQty; }
        else if (action === 'TO_BROKEN') { availableQuantity -= safeQty; brokenQuantity += safeQty; }
        else if (action === 'TO_LOST') { availableQuantity -= safeQty; lostQuantity += safeQty; }
        else if (action === 'FIXED') {
          if (maintenanceQuantity >= qty) maintenanceQuantity -= qty;
          else if (brokenQuantity >= qty) brokenQuantity -= qty;
          availableQuantity += qty;
        } else if (action === 'DISPOSE') {
          totalQuantity -= qty;
          brokenQuantity = Math.max(0, brokenQuantity - qty);
        }
        return { ...item, availableQuantity, maintenanceQuantity, brokenQuantity, lostQuantity, totalQuantity };
      });
      return { ...prev, inventory };
    });
    addLog(`Cập nhật trạng thái cho ${qty} "${itemName}": ${action}.`, 'INFO');
  };

  // --- Handlers cho Gói thiết bị ---
  const handleCreatePackage = (pkg: ComboPackage) => {
    setAppState(prev => ({ ...prev, packages: [...prev.packages, pkg] }));
    addLog(`Đã tạo gói combo mới: ${pkg.name}`, 'SUCCESS');
  };

  const handleUpdatePackage = (pkg: ComboPackage) => {
    setAppState(prev => ({
      ...prev,
      packages: prev.packages.map(p => p.id === pkg.id ? pkg : p)
    }));
    addLog(`Cập nhật gói combo: ${pkg.name}`, 'INFO');
  };

  const handleDeletePackage = (id: string) => {
    const pkgName = appState.packages.find(p => p.id === id)?.name || 'Không xác định';
    setAppState(prev => {
      const newPackages = prev.packages.filter(p => p.id !== id);
      const newQuotations = prev.quotations.map(q => {
        const filteredItems = q.items.filter(item => !(item.type === 'PACKAGE' && item.id === id));
        return {
          ...q,
          items: filteredItems,
          totalAmount: calculateQuotationTotal(filteredItems, q.discount)
        };
      });
      return {
        ...prev,
        packages: newPackages,
        quotations: newQuotations
      };
    });
    addLog(`Đã xóa gói combo: ${pkgName}`, 'SUCCESS');
  };

  // --- Handlers cho Nhân sự ---
  const handleAddEmployee = (emp: Employee) => {
    setAppState(prev => ({ ...prev, employees: [...prev.employees, emp] }));
    addLog(`Thêm nhân sự mới: ${emp.name}`, 'SUCCESS');
  };
  const handleUpdateEmployee = (emp: Employee) => {
    setAppState(prev => ({ ...prev, employees: prev.employees.map(e => e.id === emp.id ? emp : e) }));
    addLog(`Cập nhật thông tin nhân sự: ${emp.name}`, 'INFO');
  };
  const handleDeleteEmployee = (id: string) => {
    const empName = appState.employees.find(e => e.id === id)?.name || 'Không xác định';
    setAppState(prev => ({ ...prev, employees: prev.employees.filter(e => e.id !== id) }));
    addLog(`Đã xóa nhân sự: ${empName}`, 'SUCCESS');
  };
  
  // --- Handlers cho Báo giá ---
  const handleCreateQuotation = (q: Quotation) => { 
    setAppState(prev => ({ ...prev, quotations: [...prev.quotations, q] })); 
    addLog(`Tạo báo giá mới ${q.id} cho ${q.clientName}.`, 'SUCCESS');
    setActiveTab('quotations'); 
  };
  const handleDeleteQuotation = (id: string) => {
    setAppState(prev => ({ ...prev, quotations: prev.quotations.filter(q => q.id !== id) }));
    addLog(`Đã xóa báo giá ${id}.`, 'SUCCESS');
  };
  const handleUpdateQuotationStatus = (id: string, status: Quotation['status']) => {
    setAppState(prev => ({ ...prev, quotations: prev.quotations.map(q => q.id === id ? { ...q, status } : q) }));
    addLog(`Cập nhật trạng thái báo giá ${id} thành ${status}.`, 'INFO');
  };

  // --- Handlers cho Sự kiện (Full Logic) ---
  const handleCreateEvent = (event: Event) => {
    setAppState(prev => ({ ...prev, events: [...prev.events, event] }));
    addLog(`Tạo sự kiện mới: "${event.name}"`, 'SUCCESS');
  };
  
  const handleExportToEvent = (eventId: string, itemId: string, qty: number) => {
    let itemName = '', eventName = '';
    setAppState(prev => {
      const item = prev.inventory.find(i => i.id === itemId);
      const event = prev.events.find(e => e.id === eventId);
      if (!item || !event) return prev;
      
      itemName = item.name;
      eventName = event.name;

      const updatedInventory = prev.inventory.map(i => i.id === itemId ? { ...i, availableQuantity: i.availableQuantity - qty, inUseQuantity: i.inUseQuantity + qty } : i);
      
      const updatedEvents = prev.events.map(e => {
        if (e.id === eventId) {
          const itemIdx = e.items.findIndex(ai => ai.itemId === itemId);
          let newItems = [...e.items];
          if (itemIdx > -1) newItems[itemIdx] = { ...newItems[itemIdx], quantity: newItems[itemIdx].quantity + qty };
          else newItems.push({ itemId, quantity: qty, returnedQuantity: 0 });
          return { ...e, items: newItems };
        }
        return e;
      });
      return { ...prev, inventory: updatedInventory, events: updatedEvents };
    });
    addLog(`Xuất ${qty} x "${itemName}" cho sự kiện "${eventName}".`, 'INFO');
  };

  const handleExportPackageToEvent = (eventId: string, packageId: string, qty: number) => {
    const pkg = appState.packages.find(p => p.id === packageId);
    const event = appState.events.find(e => e.id === eventId);
    if (!pkg || !event) return;
    
    setAppState(prev => {
      let currentInventory = [...prev.inventory];
      let currentEvents = [...prev.events];
      const eventIndex = currentEvents.findIndex(e => e.id === eventId);
      if (eventIndex === -1) return prev;

      let eventItems = [...currentEvents[eventIndex].items];
      pkg.items.forEach(pkgItem => {
        const totalQtyNeeded = pkgItem.quantity * qty;
        const invIdx = currentInventory.findIndex(i => i.id === pkgItem.itemId);
        
        if (invIdx > -1) {
          currentInventory[invIdx] = {
            ...currentInventory[invIdx],
            availableQuantity: currentInventory[invIdx].availableQuantity - totalQtyNeeded,
            inUseQuantity: currentInventory[invIdx].inUseQuantity + totalQtyNeeded
          };
          const existInEventIdx = eventItems.findIndex(ei => ei.itemId === pkgItem.itemId);
          if (existInEventIdx > -1) {
            eventItems[existInEventIdx] = { ...eventItems[existInEventIdx], quantity: eventItems[existInEventIdx].quantity + totalQtyNeeded };
          } else {
            eventItems.push({ itemId: pkgItem.itemId, quantity: totalQtyNeeded, returnedQuantity: 0 });
          }
        }
      });
      currentEvents[eventIndex] = { ...currentEvents[eventIndex], items: eventItems };
      return { ...prev, inventory: currentInventory, events: currentEvents };
    });
    addLog(`Xuất ${qty} x Gói "${pkg.name}" cho sự kiện "${event.name}".`, 'INFO');
  };

  const handleReturnFromEvent = (eventId: string, itemId: string, qty: number) => {
    const item = appState.inventory.find(i => i.id === itemId);
    const event = appState.events.find(e => e.id === eventId);
    if (!item || !event) return;
    setAppState(prev => ({
      ...prev,
      inventory: prev.inventory.map(i => i.id === itemId ? { ...i, availableQuantity: i.availableQuantity + qty, inUseQuantity: i.inUseQuantity - qty } : i),
      events: prev.events.map(e => e.id === eventId ? { ...e, items: e.items.map(ai => ai.itemId === itemId ? { ...ai, returnedQuantity: ai.returnedQuantity + qty } : ai) } : e)
    }));
    addLog(`Nhận lại ${qty} x "${item.name}" từ sự kiện "${event.name}".`, 'INFO');
  };

  const handleAssignStaff = (eventId: string, staffData: EventStaffAllocation) => {
    setAppState(prev => ({
      ...prev,
      events: prev.events.map(e => e.id !== eventId ? e : { ...e, staff: [...(e.staff || []), staffData] })
    }));
  };

  const handleRemoveStaff = (eventId: string, employeeId: string) => {
    setAppState(prev => ({
      ...prev,
      events: prev.events.map(e => e.id !== eventId ? e : { ...e, staff: (e.staff || []).filter(s => s.employeeId !== employeeId) })
    }));
  };

  const handleAddExpense = (eventId: string, expense: EventExpense) => {
    setAppState(prev => ({
      ...prev,
      events: prev.events.map(e => e.id !== eventId ? e : { ...e, expenses: [...(e.expenses || []), expense] })
    }));
  };

  const handleRemoveExpense = (eventId: string, expenseId: string) => {
    setAppState(prev => ({
      ...prev,
      events: prev.events.map(e => e.id !== eventId ? e : { ...e, expenses: (e.expenses || []).filter(exp => exp.id !== expenseId) })
    }));
  };

  const handleLinkQuotation = (eventId: string, quotationId: string) => {
    setAppState(prev => ({
      ...prev,
      events: prev.events.map(e => e.id === eventId ? { ...e, quotationId: quotationId || undefined } : e)
    }));
  };

  const handleSyncQuotation = (eventId: string, quotationId: string) => {
    setAppState(prev => {
      const quote = prev.quotations.find(q => q.id === quotationId);
      const targetEvent = prev.events.find(e => e.id === eventId);
      if (!quote || !targetEvent) return prev;

      let inventory = [...prev.inventory];
      let eventItemsMap = new Map(targetEvent.items.map(item => [item.itemId, {...item}]));

      const processItem = (itemId: string, qty: number) => {
        const invIdx = inventory.findIndex(i => i.id === itemId);
        if (invIdx === -1) return;
        
        inventory[invIdx] = { ...inventory[invIdx], availableQuantity: inventory[invIdx].availableQuantity - qty, inUseQuantity: inventory[invIdx].inUseQuantity + qty };
        
        if (eventItemsMap.has(itemId)) {
          const existing = eventItemsMap.get(itemId)!;
          existing.quantity += qty;
        } else {
          eventItemsMap.set(itemId, { itemId, quantity: qty, returnedQuantity: 0 });
        }
      };

      quote.items.forEach(qItem => {
        if (qItem.type === 'ITEM') {
          processItem(qItem.id, qItem.quantity);
        } else if (qItem.type === 'PACKAGE') {
          const pkg = prev.packages.find(p => p.id === qItem.id);
          pkg?.items.forEach(pkgItem => processItem(pkgItem.itemId, pkgItem.quantity * qItem.quantity));
        }
      });

      const updatedEvents = prev.events.map(e => e.id === eventId ? {...e, items: Array.from(eventItemsMap.values())} : e);

      addLog(`Đồng bộ thiết bị từ báo giá ${quotationId} vào sự kiện "${targetEvent.name}".`, 'SUCCESS');
      return { ...prev, inventory, events: updatedEvents };
    });
  };

  const handleFinalizeOrder = (eventId: string) => {
    const event = appState.events.find(e => e.id === eventId);
    if (!event) return;
    setAppState(prev => ({
      ...prev,
      events: prev.events.map(e => e.id === eventId ? { ...e, isOrderCreated: true } : e)
    }));
    addLog(`Đã chốt đơn và tạo phiếu xuất kho cho sự kiện "${event.name}".`, 'SUCCESS');
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab} logs={appState.logs}>
      {activeTab === 'dashboard' && <Dashboard appState={appState} />}
      {activeTab === 'inventory' && (
        <InventoryManager 
          inventory={appState.inventory} 
          onUpdateInventory={handleUpdateInventory} 
          onAddNewItem={handleAddNewItem} 
          onBulkImport={handleBulkImport}
          onRestockItem={handleRestockItem} 
          onDeleteItem={handleDeleteItem} 
          onStatusChange={handleItemStatusChange} 
        />
      )}
      {activeTab === 'packages' && (
        <PackageManager 
          packages={appState.packages} 
          inventory={appState.inventory} 
          onCreatePackage={handleCreatePackage} 
          onUpdatePackage={handleUpdatePackage} 
          onDeletePackage={handleDeletePackage} 
        />
      )}
      {activeTab === 'employees' && (
        <EmployeeManager 
          employees={appState.employees} 
          onAddEmployee={handleAddEmployee} 
          onUpdateEmployee={handleUpdateEmployee} 
          onDeleteEmployee={handleDeleteEmployee} 
        />
      )}
      {activeTab === 'quotations' && (
        <QuotationManager 
          quotations={appState.quotations} 
          packages={appState.packages} 
          inventory={appState.inventory} 
          onCreateQuotation={handleCreateQuotation} 
          onDeleteQuotation={handleDeleteQuotation} 
          onUpdateStatus={handleUpdateQuotationStatus} 
        />
      )}
      {activeTab === 'events' && (
        <EventManager 
          events={appState.events} 
          inventory={appState.inventory} 
          packages={appState.packages} 
          employees={appState.employees} 
          quotations={appState.quotations}
          onExportToEvent={handleExportToEvent} 
          onExportPackageToEvent={handleExportPackageToEvent}
          onSyncQuotation={handleSyncQuotation}
          onReturnFromEvent={handleReturnFromEvent} 
          onCreateEvent={handleCreateEvent} 
          onAssignStaff={handleAssignStaff}
          onRemoveStaff={handleRemoveStaff}
          onAddExpense={handleAddExpense}
          onRemoveExpense={handleRemoveExpense}
          onLinkQuotation={handleLinkQuotation}
          onFinalizeOrder={handleFinalizeOrder}
        />
      )}
      
      <div className="fixed bottom-6 right-6 z-40">
        {!isChatOpen && (
          <button onClick={() => setIsChatOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-110 flex items-center justify-center">
            <MessageSquare size={24} />
          </button>
        )}
      </div>
      <AIChat appState={appState} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </Layout>
  );
};

export default App;
