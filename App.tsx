
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { SalesManager } from './components/SalesManager';
import { Dashboard } from './components/Dashboard';
import { InventoryManager } from './components/InventoryManager';
import { EventManager } from './components/EventManager';
import { PackageManager } from './components/PackageManager';
import { EmployeeManager } from './components/EmployeeManager';
import { QuotationManager } from './components/QuotationManager';
import { AIChat } from './components/AIChat';
import { AppState, InventoryItem, Event, EventStatus, Transaction, TransactionType, ComboPackage, Employee, Quotation, EventStaffAllocation, EventExpense, EventAdvanceRequest, LogEntry, ChecklistDirection, ChecklistStatus, ChecklistSignature, EventChecklist } from './types';
import { MOCK_INVENTORY, MOCK_EVENTS, MOCK_TRANSACTIONS, MOCK_PACKAGES, MOCK_EMPLOYEES } from './constants';
import { MessageSquare } from 'lucide-react';
import { saveAppState, loadAppState, initializeAuth } from './services/firebaseService';
import { ensureInventoryBarcodes, ensureItemBarcode, findDuplicateBarcodeItem, findItemByBarcode } from './services/barcodeService';
import { normalizeChecklist } from './services/checklistService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'events' | 'packages' | 'employees' | 'quotations' | 'sales'>('dashboard');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [appState, setAppState] = useState<AppState>(() => {
    return {
      inventory: ensureInventoryBarcodes(MOCK_INVENTORY),
      events: MOCK_EVENTS,
      transactions: MOCK_TRANSACTIONS,
      packages: MOCK_PACKAGES,
      employees: MOCK_EMPLOYEES,
      saleItems: [],
      saleOrders: [],
      quotations: [],
      logs: []
    };
  });

  const withDefaults = (state: AppState): AppState => ({
    ...state,
    inventory: ensureInventoryBarcodes(state.inventory || []),
    events: (state.events || []).map(ev => ({
      ...ev,
      items: ev.items || [],
      advanceRequests: ev.advanceRequests || [],
      checklist: normalizeChecklist(ev.checklist),
      timeline: ev.timeline || []
    }))
  });

  // Tải dữ liệu từ Firebase khi component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        await initializeAuth();
        
        const firebaseState = await loadAppState();
        if (firebaseState) {
          setAppState(withDefaults(firebaseState));
        } else {
          // Nếu Firebase trống, lưu dữ liệu mặc định
          await saveAppState(withDefaults(appState));
        }
      } catch (error) {
        console.error('Failed to load data from Firebase:', error);
        // Fallback to localStorage
        try {
          const raw = localStorage.getItem('ebus_app_state');
          if (raw) {
            setAppState(withDefaults(JSON.parse(raw) as AppState));
          }
        } catch (err) {
          console.warn('Failed to parse stored app state', err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Lưu dữ liệu vào cả localStorage và Firebase ngay sau khi có thay đổi
  useEffect(() => {
    if (isLoading) return; // Không lưu khi đang tải

    const saveData = async () => {
      try {
        // Lưu vào localStorage (backup)
        localStorage.setItem('ebus_app_state', JSON.stringify(appState));
        localStorage.setItem('ebus_last_update', new Date().toISOString());
        
        // Lưu vào Firebase ngay để tránh mất dữ liệu khi reload
        await saveAppState(appState);
      } catch (err) {
        console.warn('Failed to persist app state:', err);
      }
    };

    void saveData();
  }, [appState, isLoading]);

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

  const handleChecklistScan = (payload: { eventId: string; barcode: string; direction: ChecklistDirection; status?: ChecklistStatus; quantity?: number; note?: string }) => {
    const quantity = Math.max(1, Math.round(payload.quantity || 1));
    setAppState(prev => {
      const eventIndex = prev.events.findIndex(e => e.id === payload.eventId);
      if (eventIndex === -1) return prev;
      const targetEvent = prev.events[eventIndex];
      const inventoryItem = findItemByBarcode(prev.inventory, payload.barcode);
      const timestamp = new Date().toISOString();

      // Nếu không tìm thấy mã, chỉ log thiếu
      if (!inventoryItem) {
        const checklist = normalizeChecklist(targetEvent.checklist);
        const missingLog = {
          id: `scan-${Date.now()}`,
          barcode: payload.barcode,
          direction: payload.direction,
          status: 'MISSING' as ChecklistStatus,
          quantity,
          timestamp,
          note: payload.note || 'Không tìm thấy mã trong kho'
        };
        const updatedEvents = [...prev.events];
        updatedEvents[eventIndex] = {
          ...targetEvent,
          checklist: { ...checklist, logs: [missingLog, ...checklist.logs].slice(0, 50) }
        };
        return { ...prev, events: updatedEvents };
      }

      const checklist = normalizeChecklist(targetEvent.checklist);
      let appliedQty = quantity;
      let updatedInventory = prev.inventory;
      const updatedItems = [...targetEvent.items];
      const existingItemIndex = updatedItems.findIndex(i => i.itemId === inventoryItem.id);
      if (existingItemIndex === -1) {
        updatedItems.push({ itemId: inventoryItem.id, quantity: 0, returnedQuantity: 0 });
      }

      let newChecklist: EventChecklist = { ...checklist };

      if (payload.direction === 'OUT') {
        newChecklist = {
          ...newChecklist,
          outbound: {
            ...newChecklist.outbound,
            [inventoryItem.id]: (newChecklist.outbound[inventoryItem.id] || 0) + appliedQty
          }
        };
      } else {
        const status = payload.status || 'OK';
        const allocationIndex = updatedItems.findIndex(i => i.itemId === inventoryItem.id);
        const allocation = allocationIndex > -1 ? updatedItems[allocationIndex] : { itemId: inventoryItem.id, quantity: 0, returnedQuantity: 0 };
        const remaining = Math.max(0, (allocation.quantity || 0) - (allocation.returnedQuantity || 0));
        appliedQty = remaining > 0 ? Math.min(quantity, remaining) : quantity;

        newChecklist = {
          ...newChecklist,
          inbound: {
            ...newChecklist.inbound,
            [inventoryItem.id]: (newChecklist.inbound[inventoryItem.id] || 0) + appliedQty
          }
        };

        if (payload.note) {
          newChecklist.notes = { ...newChecklist.notes, [inventoryItem.id]: payload.note };
        }
        if (status === 'DAMAGED') {
          newChecklist.damaged = { ...newChecklist.damaged, [inventoryItem.id]: (newChecklist.damaged[inventoryItem.id] || 0) + appliedQty };
        }
        if (status === 'LOST') {
          newChecklist.lost = { ...newChecklist.lost, [inventoryItem.id]: (newChecklist.lost[inventoryItem.id] || 0) + appliedQty };
        }

        // cập nhật số lượng trả và tồn kho
        updatedInventory = prev.inventory.map(inv => {
          if (inv.id !== inventoryItem.id) return inv;
          if (status === 'DAMAGED') {
            return {
              ...inv,
              brokenQuantity: inv.brokenQuantity + appliedQty,
              inUseQuantity: Math.max(0, inv.inUseQuantity - appliedQty)
            };
          }
          if (status === 'LOST') {
            return {
              ...inv,
              lostQuantity: inv.lostQuantity + appliedQty,
              inUseQuantity: Math.max(0, inv.inUseQuantity - appliedQty)
            };
          }
          return {
            ...inv,
            availableQuantity: inv.availableQuantity + appliedQty,
            inUseQuantity: Math.max(0, inv.inUseQuantity - appliedQty)
          };
        });

        if (allocationIndex > -1) {
          const currentAllocation = updatedItems[allocationIndex];
          updatedItems[allocationIndex] = {
            ...currentAllocation,
            returnedQuantity: (currentAllocation.returnedQuantity || 0) + appliedQty
          };
        }
      }

      newChecklist = {
        ...newChecklist,
        logs: [
          {
            id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            itemId: inventoryItem.id,
            itemName: inventoryItem.name,
            barcode: inventoryItem.barcode,
            direction: payload.direction,
            status: payload.direction === 'OUT' ? 'OK' : (payload.status || 'OK'),
            quantity: appliedQty,
            note: payload.note,
            timestamp
          },
          ...newChecklist.logs
        ].slice(0, 50)
      };

      const updatedEvents = [...prev.events];
      updatedEvents[eventIndex] = {
        ...targetEvent,
        items: updatedItems,
        checklist: newChecklist
      };

      return { ...prev, events: updatedEvents, inventory: updatedInventory };
    });

    const actionLabel = payload.direction === 'OUT' ? 'quét đi' : (payload.status === 'DAMAGED' ? 'báo hỏng' : payload.status === 'LOST' ? 'báo mất' : 'quét về');
    addLog(`Checklist: ${actionLabel} ${quantity} x ${payload.barcode}`, 'INFO');
  };

  const handleUpdateChecklistNote = (eventId: string, itemId: string, note: string) => {
    setAppState(prev => ({
      ...prev,
      events: prev.events.map(ev => {
        if (ev.id !== eventId) return ev;
        const checklist = normalizeChecklist(ev.checklist);
        const nextNotes = { ...checklist.notes };
        if (note.trim()) nextNotes[itemId] = note.trim(); else delete nextNotes[itemId];
        return { ...ev, checklist: { ...checklist, notes: nextNotes } };
      })
    }));
  };

  const handleSaveChecklistSignature = (eventId: string, payload: { direction: ChecklistDirection; manager?: ChecklistSignature; operator?: ChecklistSignature; note?: string; itemsSnapshot?: { itemId: string; name?: string; orderQty: number; scannedOut: number; scannedIn: number; damaged: number; lost: number; missing: number; }[]; createSlip?: boolean }) => {
    let slipGenerated = false;
    setAppState(prev => {
      const event = prev.events.find(ev => ev.id === eventId);
      if (!event) return prev;
      const checklist = normalizeChecklist(event.checklist);
      const key = payload.direction === 'OUT' ? 'outbound' : 'inbound';
      const existingPair = checklist.signatures?.[key] || {};
      const existingSlips = (checklist.slips || []).filter(s => s.direction === payload.direction);

      const snapshot = (payload.itemsSnapshot && payload.itemsSnapshot.length > 0)
        ? payload.itemsSnapshot
        : (() => {
            const ids = new Set<string>();
            event.items.forEach(it => ids.add(it.itemId));
            Object.keys(checklist.outbound || {}).forEach(id => ids.add(id));
            Object.keys(checklist.inbound || {}).forEach(id => ids.add(id));
            return Array.from(ids).map(id => {
              const inv = prev.inventory.find(i => i.id === id);
              const alloc = event.items.find(ai => ai.itemId === id);
              return {
                itemId: id,
                name: inv?.name,
                orderQty: alloc?.quantity || 0,
                scannedOut: checklist.outbound[id] || 0,
                scannedIn: checklist.inbound[id] || 0,
                damaged: checklist.damaged[id] || 0,
                lost: checklist.lost[id] || 0,
                missing: Math.max(0, (alloc?.quantity || 0) - (checklist.inbound[id] || 0) - (checklist.lost[id] || 0))
              };
            });
          })();

      const outboundTotals = new Map<string, number>();
      (checklist.slips || []).filter(s => s.direction === 'OUT').forEach(slip => {
        slip.items.forEach(it => {
          outboundTotals.set(it.itemId, (outboundTotals.get(it.itemId) || 0) + it.scannedOut);
        });
      });

      const inboundTotals = new Map<string, number>();
      (checklist.slips || []).filter(s => s.direction === 'IN').forEach(slip => {
        slip.items.forEach(it => {
          inboundTotals.set(it.itemId, (inboundTotals.get(it.itemId) || 0) + it.scannedIn);
        });
      });

      const slipItems = snapshot.reduce<typeof snapshot>((acc, item) => {
        if (payload.direction === 'OUT') {
          const baseline = outboundTotals.get(item.itemId) || 0;
          const delta = item.scannedOut - baseline;
          if (delta > 0) {
            acc.push({
              ...item,
              scannedOut: delta,
              scannedIn: 0,
              missing: Math.max(0, item.orderQty - (baseline + delta) - item.lost)
            });
          }
        } else {
          const totalOutbound = outboundTotals.get(item.itemId) || 0;
          const baselineInbound = inboundTotals.get(item.itemId) || 0;
          const remainingOut = Math.max(0, totalOutbound - baselineInbound);
          const currentInbound = item.scannedIn;
          const deltaIn = Math.min(remainingOut, currentInbound - baselineInbound);
          if (deltaIn > 0) {
            acc.push({
              ...item,
              scannedOut: totalOutbound, // show total outbound on return slip for context
              scannedIn: deltaIn,
              missing: Math.max(0, item.orderQty - totalOutbound - item.lost)
            });
          }
        }
        return acc;
      }, []);

      const nextEvents = prev.events.map(ev => {
        if (ev.id !== eventId) return ev;
        const nextSignatures = {
          ...(checklist.signatures || {}),
          [key]: {
            manager: payload.manager || existingPair.manager,
            operator: payload.operator || existingPair.operator,
            note: payload.note ?? existingPair.note,
            direction: payload.direction
          }
        };
        const canCreateSlip = payload.createSlip && nextSignatures[key].manager && nextSignatures[key].operator && slipItems.length > 0;
        const nextSlipNo = canCreateSlip ? existingSlips.length + 1 : undefined;
        const slips = canCreateSlip
          ? [
              {
                id: `SLIP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                slipNo: nextSlipNo,
                direction: payload.direction,
                createdAt: new Date().toISOString(),
                manager: nextSignatures[key].manager,
                operator: nextSignatures[key].operator,
                note: payload.note ?? existingPair.note,
                items: slipItems
              },
              ...(checklist.slips || [])
            ]
          : checklist.slips || [];
        if (canCreateSlip) slipGenerated = true;
        return { ...ev, checklist: { ...checklist, signatures: nextSignatures, slips } };
      });

      const targetPair = nextEvents.find(e => e.id === eventId)?.checklist?.signatures?.[key];
      const shouldUpdateInventory = payload.createSlip && targetPair?.manager && targetPair?.operator && slipItems.length > 0;

      const updatedInventory = shouldUpdateInventory
        ? prev.inventory.map(inv => {
            const itemSnap = slipItems.find(s => s.itemId === inv.id);
            if (!itemSnap) return inv;
            const qty = payload.direction === 'OUT' ? itemSnap.scannedOut : itemSnap.scannedIn;
            if (!qty || qty <= 0) return inv;
            const nextUsage = payload.direction === 'OUT' ? (inv.usageCount || 0) + qty : inv.usageCount || 0;
            if (payload.direction === 'OUT') {
              return {
                ...inv,
                availableQuantity: inv.availableQuantity - qty,
                inUseQuantity: inv.inUseQuantity + qty,
                usageCount: nextUsage
              };
            }
            return {
              ...inv,
              availableQuantity: inv.availableQuantity + qty,
              inUseQuantity: Math.max(0, inv.inUseQuantity - qty),
              usageCount: nextUsage
            };
          })
        : prev.inventory;

      return { ...prev, inventory: updatedInventory, events: nextEvents };
    });
    addLog(`Checklist: đã lưu chữ ký ${payload.direction === 'OUT' ? 'hàng đi' : 'hàng về'} cho sự kiện ${eventId}.`, 'INFO');
    if (slipGenerated) {
      addLog(`Checklist: tạo phiếu ${payload.direction === 'OUT' ? 'xuất kho' : 'trả kho'} (hai chữ ký) và cập nhật kho.`, 'SUCCESS');
    }
  };

  // --- Handlers cho Kho hàng ---
  const handleUpdateInventory = (updatedItem: InventoryItem) => {
    const itemWithBarcode = ensureItemBarcode(updatedItem);
    let duplicateOwner = '';
    setAppState(prev => {
      const duplicate = findDuplicateBarcodeItem(prev.inventory, itemWithBarcode.barcode, itemWithBarcode.id);
      if (duplicate) {
        duplicateOwner = duplicate.name;
        return prev;
      }
      return {
        ...prev,
        inventory: prev.inventory.map(i => i.id === itemWithBarcode.id ? itemWithBarcode : i),
        saleItems: (prev.saleItems || []).map(s => s.id === `SALE-${itemWithBarcode.id}` ? {
          ...s,
          name: itemWithBarcode.name,
          category: itemWithBarcode.category,
          description: itemWithBarcode.description,
          images: itemWithBarcode.imageUrl ? [itemWithBarcode.imageUrl] : s.images,
          price: Number(itemWithBarcode.rentalPrice) || s.price,
          link: itemWithBarcode.purchaseLink || s.link,
          barcode: s.barcode || itemWithBarcode.barcode || itemWithBarcode.id
        } : s)
      };
    });
    if (duplicateOwner) {
      alert(`Không thể lưu vì mã barcode đã được dùng cho "${duplicateOwner}".`);
      addLog(`Cập nhật thiết bị thất bại do trùng barcode với "${duplicateOwner}".`, 'WARNING');
      return;
    }
    addLog(`Cập nhật thông tin thiết bị: ${itemWithBarcode.name}`, 'INFO');
  };

  const handleAddNewItem = (item: InventoryItem) => {
    const itemWithBarcode = ensureItemBarcode(item);
    let duplicateOwner = '';
    let added = false;
    setAppState(prev => {
      const duplicate = findDuplicateBarcodeItem(prev.inventory, itemWithBarcode.barcode, itemWithBarcode.id);
      if (duplicate) {
        duplicateOwner = duplicate.name;
        return prev;
      }
      const exists = prev.inventory.some(i => i.id === itemWithBarcode.id);
      added = !exists;
      const newInventory = exists ? prev.inventory : [...prev.inventory, itemWithBarcode];
      return { ...prev, inventory: newInventory };
    });
    if (duplicateOwner) {
      alert(`Mã barcode "${itemWithBarcode.barcode}" đã thuộc về "${duplicateOwner}". Không thể thêm thiết bị mới.`);
      addLog(`Thêm thiết bị thất bại do trùng barcode với "${duplicateOwner}".`, 'WARNING');
      return;
    }
    if (added) {
      addLog(`Đã thêm thiết bị mới: ${itemWithBarcode.name}`, 'SUCCESS');
    }
  };
  
  const handleBulkImport = (items: InventoryItem[]) => {
    setAppState(prev => {
      let currentInv = [...prev.inventory];
      items.forEach((incomingItem, idx) => {
        const newItem = ensureItemBarcode(incomingItem, `-bulk-${idx}`);
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
    let itemName = 'Không xác định';
    setAppState(prev => {
      const itemToDelete = prev.inventory.find(i => i.id === id);
      if (!itemToDelete) return prev;
      itemName = itemToDelete.name;

      if (itemToDelete.inUseQuantity > 0) {
        alert(`CẢNH BÁO: Không thể xóa "${itemToDelete.name}"!\n\nLý do: Đang có ${itemToDelete.inUseQuantity} chiếc đang được sử dụng tại sự kiện.\nVui lòng thu hồi thiết bị về kho trước khi xóa.`);
        addLog(`Xóa thất bại: "${itemName}" đang được sử dụng.`, 'WARNING');
        return prev;
      }

      const newInventory = prev.inventory.filter(i => i.id !== id);
      const newSaleItems = (prev.saleItems || []).filter(s => s.id !== `SALE-${id}`);
      addLog(`Đã xóa thiết bị: ${itemName}`, 'SUCCESS');
      return {
        ...prev,
        inventory: newInventory,
        saleItems: newSaleItems
      };
    });
  };

  // --- Handlers for Sale Orders ---
  const handleCreateSaleOrder = (order: any) => {
    const existed = (appState.saleOrders || []).some(o => o.id === order.id);
    setAppState(prev => {
      const currentOrders = [...(prev.saleOrders || [])];
      const existingIndex = currentOrders.findIndex(o => o.id === order.id);
      if (existingIndex >= 0) {
        currentOrders[existingIndex] = order;
        return { ...prev, saleOrders: currentOrders };
      }
      return { ...prev, saleOrders: [...currentOrders, order] };
    });
    addLog(`${existed ? 'Cập nhật' : 'Tạo'} phiếu bán hàng: ${order.id} cho ${order.customerName}`, 'SUCCESS');
  };

  const handleCreateSaleReturn = (ret: any) => {
    setAppState(prev => ({ ...prev, saleOrders: [...(prev.saleOrders || []), ret] }));
    addLog(`Tạo đơn trả kho: ${ret.id} (liên quan ${ret.relatedOrderId})`, 'INFO');
  };

  const handleToggleEventItemDone = (eventId: string, itemId: string, done: boolean) => {
    setAppState(prev => ({
      ...prev,
      events: prev.events.map(e => e.id !== eventId ? e : { ...e, items: e.items.map(it => it.itemId === itemId ? { ...it, done } : it) })
    }));
  };

  const handleToggleEventStaffDone = (eventId: string, employeeId: string, done: boolean) => {
    setAppState(prev => ({
      ...prev,
      events: prev.events.map(e => e.id !== eventId ? e : { ...e, staff: (e.staff || []).map(s => s.employeeId === employeeId ? { ...s, done } : s) })
    }));
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
    let appliedQty = 0;
    setAppState(prev => {
      const inventory = prev.inventory.map(item => {
        if (item.id !== id) return item;
        itemName = item.name;
        let { availableQuantity, maintenanceQuantity, brokenQuantity, lostQuantity, totalQuantity } = item;

        const maxForAction = action === 'FIXED'
          ? brokenQuantity
          : action === 'DISPOSE'
            ? availableQuantity + brokenQuantity
            : availableQuantity;
        const appliedQtyLocal = Math.min(qty, maxForAction);
        appliedQty = appliedQtyLocal;

        if (action === 'TO_MAINTENANCE') {
          availableQuantity -= appliedQtyLocal;
          maintenanceQuantity += appliedQtyLocal;
        } else if (action === 'TO_BROKEN') {
          availableQuantity -= appliedQtyLocal;
          brokenQuantity += appliedQtyLocal;
        } else if (action === 'TO_LOST') {
          availableQuantity -= appliedQtyLocal;
          lostQuantity += appliedQtyLocal;
        } else if (action === 'FIXED') {
          brokenQuantity -= appliedQtyLocal;
          availableQuantity += appliedQtyLocal;
        } else if (action === 'DISPOSE') {
          const disposeFromAvailable = Math.min(appliedQtyLocal, availableQuantity);
          const disposeFromBroken = appliedQtyLocal - disposeFromAvailable;
          availableQuantity -= disposeFromAvailable;
          brokenQuantity = Math.max(0, brokenQuantity - disposeFromBroken);
          totalQuantity = Math.max(0, totalQuantity - appliedQtyLocal);
        }
        return { ...item, availableQuantity, maintenanceQuantity, brokenQuantity, lostQuantity, totalQuantity };
      });
      return { ...prev, inventory };
    });
    addLog(`Cập nhật trạng thái cho ${appliedQty || qty} "${itemName}": ${action}.`, 'INFO');
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
      return {
        ...prev,
        packages: newPackages
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

  // --- Handlers cho Hàng bán sự kiện ---
  const handleCreateSaleItem = (item: any) => {
    setAppState(prev => ({ ...prev, saleItems: [...(prev.saleItems || []), item] }));
    addLog(`Đã thêm hàng bán: ${item.name}`, 'SUCCESS');
  };
  const handleUpdateSaleItem = (item: any) => {
    setAppState(prev => ({ ...prev, saleItems: (prev.saleItems || []).map(s => s.id === item.id ? item : s) }));
    addLog(`Cập nhật hàng bán: ${item.name}`, 'INFO');
  };
  const handleDeleteSaleItem = (id: string) => {
    const name = appState.saleItems?.find(s => s.id === id)?.name || 'Không xác định';
    setAppState(prev => ({ ...prev, saleItems: (prev.saleItems || []).filter(s => s.id !== id) }));
    addLog(`Đã xóa hàng bán: ${name}`, 'SUCCESS');
  };

  // Helper to save state immediately for critical event operations
  const saveEventStateImmediate = async (newState: AppState) => {
    try {
      await saveAppState(newState);
      console.log('Event state saved immediately to Firestore');
    } catch (err) {
      console.error('Failed to save event state immediately:', err);
    }
  };

  // --- Handlers cho Sự kiện (Full Logic) ---
  const handleCreateEvent = (event: Event) => {
    const eventWithChecklist: Event = { ...event, checklist: normalizeChecklist(event.checklist) };
    const newState = { ...appState, events: [...appState.events, eventWithChecklist] };
    setAppState(newState);
    saveEventStateImmediate(newState); // Save immediately
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
      return { ...prev, events: updatedEvents };
    });
    addLog(`Thêm ${qty} x "${itemName}" vào order sự kiện "${eventName}".`, 'INFO');
  };

  const handleExportPackageToEvent = (eventId: string, packageId: string, qty: number) => {
    const pkg = appState.packages.find(p => p.id === packageId);
    const event = appState.events.find(e => e.id === eventId);
    if (!pkg || !event) return;
    
    setAppState(prev => {
      let currentEvents = [...prev.events];
      const eventIndex = currentEvents.findIndex(e => e.id === eventId);
      if (eventIndex === -1) return prev;

      let eventItems = [...currentEvents[eventIndex].items];
      pkg.items.forEach(pkgItem => {
        const totalQtyNeeded = pkgItem.quantity * qty;
        const existInEventIdx = eventItems.findIndex(ei => ei.itemId === pkgItem.itemId);
        if (existInEventIdx > -1) {
          eventItems[existInEventIdx] = { ...eventItems[existInEventIdx], quantity: eventItems[existInEventIdx].quantity + totalQtyNeeded };
        } else {
          eventItems.push({ itemId: pkgItem.itemId, quantity: totalQtyNeeded, returnedQuantity: 0 });
        }
      });
      currentEvents[eventIndex] = { ...currentEvents[eventIndex], items: eventItems };
      return { ...prev, events: currentEvents };
    });
    addLog(`Thêm ${qty} x Gói "${pkg.name}" vào order sự kiện "${event.name}".`, 'INFO');
  };

  const handleReturnFromEvent = (eventId: string, itemId: string, qty: number) => {
    // Manual returns are now handled via checklist scans; keep no-op to avoid affecting inventory.
    console.warn('handleReturnFromEvent is deprecated; use checklist scans for stock movements.');
  };

  const handleUpdateEventItemQuantity = (eventId: string, itemId: string, nextQty: number) => {
    let itemName = '';
    let eventName = '';
    let previousQty = 0;
    let targetQty = 0;
    let changed = false;

    setAppState(prev => {
      const event = prev.events.find(e => e.id === eventId);
      const inventoryItem = prev.inventory.find(inv => inv.id === itemId);
      if (!event || !inventoryItem) return prev;

      const allocation = event.items.find(ai => ai.itemId === itemId);
      if (!allocation) return prev;

      const minQty = allocation.returnedQuantity || 0;
      const numericQty = Number.isFinite(nextQty) ? nextQty : 0;
      const parsedQty = Math.max(0, Math.round(numericQty));
      const safeQty = Math.max(minQty, parsedQty);

      if (safeQty === allocation.quantity) return prev;

      changed = true;
      itemName = inventoryItem.name;
      eventName = event.name;
      previousQty = allocation.quantity;
      targetQty = safeQty;

      const delta = safeQty - allocation.quantity;

      const events = prev.events.map(ev => {
        if (ev.id !== eventId) return ev;
        return {
          ...ev,
          items: ev.items.map(it => it.itemId === itemId ? { ...it, quantity: safeQty } : it)
        };
      });

      return { ...prev, events };
    });

    if (changed) {
      addLog(`Điều chỉnh số lượng "${itemName}" trong sự kiện "${eventName}" từ ${previousQty} -> ${targetQty}.`, 'INFO');
    }
  };

  const handleRemoveEventItems = (eventId: string, itemIds: string[]) => {
    setAppState(prev => {
      const event = prev.events.find(e => e.id === eventId);
      if (!event) return prev;
      const idSet = new Set(itemIds);

      const updatedEvents = prev.events.map(e => e.id !== eventId ? e : { ...e, items: e.items.filter(ai => !idSet.has(ai.itemId)) });
      return { ...prev, events: updatedEvents };
    });
    const eventName = appState.events.find(e => e.id === eventId)?.name || '';
    addLog(`Xóa ${itemIds.length} thiết bị khỏi order sự kiện "${eventName}".`, 'INFO');
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

  const handleAddAdvanceRequest = (eventId: string, request: EventAdvanceRequest) => {
    setAppState(prev => ({
      ...prev,
      events: prev.events.map(e => e.id !== eventId ? e : { ...e, advanceRequests: [...(e.advanceRequests || []), request] })
    }));
  };

  const handleRemoveAdvanceRequest = (eventId: string, requestId: string) => {
    setAppState(prev => ({
      ...prev,
      events: prev.events.map(e => e.id !== eventId ? e : { ...e, advanceRequests: (e.advanceRequests || []).filter(req => req.id !== requestId) })
    }));
  };

  const handleLinkQuotation = (eventId: string, quotationId: string) => {
    setAppState(prev => ({
      ...prev,
      events: prev.events.map(e => e.id === eventId ? { ...e, quotationId: quotationId || undefined } : e)
    }));
  };

  const handleUpdateEvent = (eventId: string, updates: Partial<Event>) => {
    setAppState(prev => ({
      ...prev,
      events: prev.events.map(e => e.id === eventId ? { ...e, ...updates } : e)
    }));
  };

  const handleLinkSaleOrderToEvent = (eventId: string, saleOrderId: string, link: boolean) => {
    setAppState(prev => {
      const event = prev.events.find(e => e.id === eventId);
      if (!event) return prev;
      const saleOrders = prev.saleOrders || [];
      const updatedSaleOrders = saleOrders.map(order => {
        if (order.id !== saleOrderId) return order;
        return link ? { ...order, eventId, eventName: event.name } : { ...order, eventId: undefined, eventName: undefined };
      });
      const currentIds = new Set(event.saleOrderIds || []);
      if (link) currentIds.add(saleOrderId); else currentIds.delete(saleOrderId);
      const updatedEvents = prev.events.map(e => e.id === eventId ? { ...e, saleOrderIds: Array.from(currentIds) } : e);
      return { ...prev, saleOrders: updatedSaleOrders, events: updatedEvents };
    });
  };

  const handleSyncQuotation = (eventId: string, quotationId: string) => {
    setAppState(prev => {
      const quote = prev.quotations.find(q => q.id === quotationId);
      const targetEvent = prev.events.find(e => e.id === eventId);
      if (!quote || !targetEvent) return prev;

      const existingMap = new Map(targetEvent.items.map(item => [item.itemId, { ...item }]));
      const targetMap = new Map<string, number>();

      const addTargetQty = (itemId: string, qty: number) => {
        targetMap.set(itemId, (targetMap.get(itemId) || 0) + qty);
      };

      quote.items.forEach(qItem => {
        if (qItem.type === 'ITEM') {
          addTargetQty(qItem.id, qItem.quantity);
        } else if (qItem.type === 'PACKAGE') {
          const pkg = prev.packages.find(p => p.id === qItem.id);
          pkg?.items.forEach(pkgItem => addTargetQty(pkgItem.itemId, pkgItem.quantity * qItem.quantity));
        }
      });

      const updatedItems: typeof targetEvent.items = [];

      // Keep non-quotation items unchanged
      targetEvent.items.forEach(item => {
        if (!targetMap.has(item.itemId)) {
          updatedItems.push(item);
        }
      });

      // Apply target quantities for quotation items
      targetMap.forEach((targetQty, itemId) => {
        const existing = existingMap.get(itemId);
        const returnedQuantity = Math.min(existing?.returnedQuantity || 0, targetQty);
        updatedItems.push({
          itemId,
          quantity: targetQty,
          returnedQuantity,
          done: existing?.done
        });
      });

      const updatedEvents = prev.events.map(e => e.id === eventId ? { ...e, items: updatedItems } : e);

      addLog(`Đồng bộ thiết bị từ báo giá ${quotationId} vào sự kiện "${targetEvent.name}" (ghi đè số lượng theo báo giá, giữ lại thiết bị ngoài báo giá).`, 'SUCCESS');
      return { ...prev, events: updatedEvents };
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
          events={appState.events}
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
      {activeTab === 'sales' && (
        <SalesManager
          saleItems={appState.saleItems || []}
          events={appState.events}
          onAddSaleItem={handleCreateSaleItem}
          onUpdateSaleItem={handleUpdateSaleItem}
          onDeleteSaleItem={handleDeleteSaleItem}
          onCreateSaleOrder={handleCreateSaleOrder}
          saleOrders={appState.saleOrders || []}
          onCreateSaleReturn={handleCreateSaleReturn}
        />
      )}
      {activeTab === 'events' && (
        <EventManager 
          events={appState.events} 
          inventory={appState.inventory} 
          packages={appState.packages} 
          employees={appState.employees} 
          quotations={appState.quotations}
          saleOrders={appState.saleOrders || []}
          onExportToEvent={handleExportToEvent} 
          onExportPackageToEvent={handleExportPackageToEvent}
          onSyncQuotation={handleSyncQuotation}
          onReturnFromEvent={handleReturnFromEvent} 
          onUpdateEventItemQuantity={handleUpdateEventItemQuantity}
          onRemoveEventItems={handleRemoveEventItems}
          onCreateEvent={handleCreateEvent} 
          onAssignStaff={handleAssignStaff}
          onRemoveStaff={handleRemoveStaff}
          onAddExpense={handleAddExpense}
          onRemoveExpense={handleRemoveExpense}
          onAddAdvanceRequest={handleAddAdvanceRequest}
          onRemoveAdvanceRequest={handleRemoveAdvanceRequest}
          onLinkQuotation={handleLinkQuotation}
          onFinalizeOrder={handleFinalizeOrder}
          onToggleItemDone={handleToggleEventItemDone}
          onToggleStaffDone={handleToggleEventStaffDone}
          onUpdateEvent={handleUpdateEvent}
          onLinkSaleOrder={handleLinkSaleOrderToEvent}
          onChecklistScan={handleChecklistScan}
          onUpdateChecklistNote={handleUpdateChecklistNote}
          onSaveChecklistSignature={handleSaveChecklistSignature}
        />
      )}
      
      <div className="fixed right-4 md:right-6 bottom-24 md:bottom-6 z-40">
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
