
import React, { useState, useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { SalesManager } from './components/SalesManager';
import { Dashboard } from './components/Dashboard';
import { InventoryManager } from './components/InventoryManager';
import { EventManager } from './components/EventManager';
import { PackageManager } from './components/PackageManager';
import { EmployeeManager } from './components/EmployeeManager';
import { QuotationManager } from './components/QuotationManager';
import { AIChat } from './components/AIChat';
import { Elearning } from './components/Elearning';
import { AdminLogPage } from './components/AdminLogPage';
import { AppState, InventoryItem, Event, EventStatus, Transaction, TransactionType, ComboPackage, Employee, Quotation, EventStaffAllocation, EventExpense, EventAdvanceRequest, LogEntry, ChecklistDirection, ChecklistStatus, ChecklistSignature, EventChecklist, LearningAttempt, LearningProfile, AccessPermission, UserAccount, LearningTrack, InventoryReceipt, InventoryReceiptItem, ActiveSession, PayrollAdjustment } from './types';
import { MOCK_INVENTORY, MOCK_EVENTS, MOCK_TRANSACTIONS, MOCK_PACKAGES, MOCK_EMPLOYEES, MOCK_LEARNING_TRACKS, MOCK_LEARNING_PROFILES, MOCK_CAREER_RANKS, DEFAULT_USER_ACCOUNTS, MOCK_INVENTORY_RECEIPTS } from './constants';
import { MessageSquare } from 'lucide-react';
import { saveAppState, loadAppState, initializeAuth, subscribeToAppState, subscribeToSessions, setSessionOnline, setSessionOffline } from './services/firebaseService';
import { ensureInventoryBarcodes, ensureItemBarcode, findDuplicateBarcodeItem, findItemByBarcode, generateBarcode, normalizeBarcode } from './services/barcodeService';
import { normalizeChecklist } from './services/checklistService';
import { getDefaultPermissionsForRole, hasPermission, normalizePhone } from './services/accessControl';
import { AccessManager } from './components/AccessManager';
import { LoginModal } from './components/LoginModal';

const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getSessionId = () => {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const existing = sessionStorage.getItem('ebus_session_id');
      if (existing) return existing;
      const created = generateId('sess');
      sessionStorage.setItem('ebus_session_id', created);
      return created;
    }
  } catch (err) {
    console.warn('Failed to read sessionStorage for session id', err);
  }
  return generateId('sess');
};

const getDeviceId = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      const existing = localStorage.getItem('ebus_device_id');
      if (existing) return existing;
      const created = generateId('dev');
      localStorage.setItem('ebus_device_id', created);
      return created;
    }
  } catch (err) {
    console.warn('Failed to read localStorage for device id', err);
  }
  return generateId('dev');
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'events' | 'packages' | 'employees' | 'quotations' | 'sales' | 'elearning' | 'logs'>('dashboard');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccessOpen, setIsAccessOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(() => {
    return localStorage.getItem('ebus_current_user') || '';
  });
  
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
      logs: [],
      inventoryReceipts: MOCK_INVENTORY_RECEIPTS,
      learningTracks: MOCK_LEARNING_TRACKS,
      learningProfiles: MOCK_LEARNING_PROFILES,
      learningAttempts: [],
      careerRanks: MOCK_CAREER_RANKS,
      userAccounts: DEFAULT_USER_ACCOUNTS,
      payrollAdjustments: []
    };
  });
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const initialLastUpdate = typeof localStorage !== 'undefined' ? localStorage.getItem('ebus_last_update') : null;
  const lastSyncedAtRef = useRef<number>(initialLastUpdate ? new Date(initialLastUpdate).getTime() : 0);
  const isApplyingRemoteRef = useRef(false);
  const pendingRemoteTimestampRef = useRef<string | null>(initialLastUpdate);
  const sessionIdRef = useRef<string>(getSessionId());
  const deviceIdRef = useRef<string>(getDeviceId());
  const presenceIntervalRef = useRef<number | undefined>(undefined);

  const withDefaults = (state: AppState): AppState => {
    const baseAccounts = state.userAccounts && state.userAccounts.length > 0 ? state.userAccounts : DEFAULT_USER_ACCOUNTS;
    const normalizedAccounts = baseAccounts.map(acc => {
      const role = acc.role || 'STAFF';
      return {
        ...acc,
        role,
        permissions: acc.permissions && acc.permissions.length > 0 ? acc.permissions : getDefaultPermissionsForRole(role),
        isActive: acc.isActive !== false
      };
    });
    const normalizedLogs = (state.logs || []).map(log => ({
      ...log,
      timestamp: log?.timestamp ? (log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp)) : new Date()
    }));
    return {
      ...state,
      inventory: ensureInventoryBarcodes(state.inventory || []),
      events: (state.events || []).map(ev => ({
        ...ev,
        items: ev.items || [],
        advanceRequests: ev.advanceRequests || [],
        advancePaidAmount: ev.advancePaidAmount ?? 0,
        advancePaidDate: ev.advancePaidDate || '',
        advancePaidConfirmed: ev.advancePaidConfirmed ?? false,
        advanceRefundedConfirmed: ev.advanceRefundedConfirmed ?? false,
        paymentCompleted: ev.paymentCompleted ?? false,
        advanceSkipped: ev.advanceSkipped ?? false,
        eventProfile: ev.eventProfile || {
          code: ev.startDate ? `EB-${ev.startDate.replace(/-/g, '')}-${String(Math.floor(Math.random() * 900 + 100))}` : `EB-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 900 + 100))}`,
          organization: ev.client,
          programSession: ev.session,
        },
        checklist: normalizeChecklist(ev.checklist),
        timeline: ev.timeline || []
      })),
      learningTracks: state.learningTracks || MOCK_LEARNING_TRACKS,
      learningProfiles: state.learningProfiles || MOCK_LEARNING_PROFILES,
      learningAttempts: state.learningAttempts || [],
      careerRanks: state.careerRanks || MOCK_CAREER_RANKS,
      inventoryReceipts: state.inventoryReceipts || [],
      logs: normalizedLogs,
      userAccounts: normalizedAccounts,
      payrollAdjustments: state.payrollAdjustments || []
    };
  };

  const currentUser = appState.userAccounts?.find(user => user.id === currentUserId) || null;
  const can = (permission: AccessPermission) => hasPermission(currentUser, permission);
  const isAdmin = currentUser?.role === 'ADMIN';
  const canViewLogs = currentUser?.role === 'ADMIN';
  const isElearningAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER';
  const canViewEmployees = currentUser?.role !== 'STAFF';

  useEffect(() => {
    if (activeTab === 'logs' && !canViewLogs) {
      setActiveTab('dashboard');
    }
  }, [activeTab, canViewLogs]);

  useEffect(() => {
    if (activeTab === 'employees' && !canViewEmployees) {
      setActiveTab('dashboard');
    }
  }, [activeTab, canViewEmployees]);

  useEffect(() => {
    if (currentUserId) {
      localStorage.setItem('ebus_current_user', currentUserId);
    } else {
      localStorage.removeItem('ebus_current_user');
    }
  }, [currentUserId]);

  useEffect(() => {
    if (currentUserId && !currentUser) {
      setCurrentUserId('');
    }
  }, [currentUserId, currentUser]);

  // Tải dữ liệu từ Firebase khi component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        await initializeAuth();
        
        const firebaseState = await loadAppState();
        if (firebaseState) {
          const remoteTimestamp = (firebaseState as any).lastUpdated || null;
          if (remoteTimestamp) {
            lastSyncedAtRef.current = new Date(remoteTimestamp).getTime();
            pendingRemoteTimestampRef.current = remoteTimestamp;
          }
          isApplyingRemoteRef.current = true;
          setAppState(withDefaults(firebaseState));
        } else {
          // Nếu Firebase trống, lưu dữ liệu mặc định
          const now = new Date().toISOString();
          lastSyncedAtRef.current = new Date(now).getTime();
          pendingRemoteTimestampRef.current = now;
          isApplyingRemoteRef.current = true;
          await saveAppState(withDefaults(appState), now);
        }
      } catch (error) {
        console.error('Failed to load data from Firebase:', error);
        // Fallback to localStorage
        try {
          const raw = localStorage.getItem('ebus_app_state');
          if (raw) {
            const savedTimestamp = localStorage.getItem('ebus_last_update');
            if (savedTimestamp) {
              lastSyncedAtRef.current = new Date(savedTimestamp).getTime();
              pendingRemoteTimestampRef.current = savedTimestamp;
            }
            isApplyingRemoteRef.current = true;
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

  // Lắng nghe thay đổi real-time từ Firebase để đồng bộ giữa các tab/thiet bi
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const startRealtimeSync = async () => {
      try {
        await initializeAuth();
        unsubscribe = subscribeToAppState((data) => {
          if (!data) return;
          const remoteTimestamp = (data as any).lastUpdated || null;
          const remoteTime = remoteTimestamp ? new Date(remoteTimestamp).getTime() : 0;
          const localTime = lastSyncedAtRef.current;

          if (remoteTime && remoteTime <= localTime) return;

          if (remoteTime) {
            lastSyncedAtRef.current = remoteTime;
            pendingRemoteTimestampRef.current = remoteTimestamp;
          } else {
            lastSyncedAtRef.current = Date.now();
            pendingRemoteTimestampRef.current = null;
          }
          isApplyingRemoteRef.current = true;
          setAppState(withDefaults(data));
        });
      } catch (err) {
        console.error('Failed to start realtime sync:', err);
      }
    };

    void startRealtimeSync();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Lắng nghe các phiên đăng nhập (presence) để admin xem ai đang online
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    const startPresenceListener = async () => {
      try {
        await initializeAuth();
        unsubscribe = subscribeToSessions((sessions) => {
          const normalized: ActiveSession[] = (sessions || []).map((s: any) => ({
            id: s.id,
            userId: s.userId || 'unknown',
            userName: s.userName || 'Chua ro',
            role: s.role || 'STAFF',
            phone: s.phone,
            deviceId: s.deviceId,
            lastSeen: s.lastSeen || new Date().toISOString(),
            online: s.online !== false
          }));
          setActiveSessions(normalized);
        });
      } catch (err) {
        console.error('Failed to start presence listener:', err);
      }
    };
    void startPresenceListener();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Lưu dữ liệu vào cả localStorage và Firebase ngay sau khi có thay đổi
  useEffect(() => {
    if (isLoading) return; // Không lưu khi đang tải

    const saveData = async () => {
      const timestamp = pendingRemoteTimestampRef.current || new Date().toISOString();
      try {
        // Lưu vào localStorage (backup)
        localStorage.setItem('ebus_app_state', JSON.stringify(appState));
        localStorage.setItem('ebus_last_update', timestamp);
        lastSyncedAtRef.current = new Date(timestamp).getTime();

        if (isApplyingRemoteRef.current) {
          isApplyingRemoteRef.current = false;
          pendingRemoteTimestampRef.current = null;
          return;
        }
        
        // Lưu vào Firebase ngay để tránh mất dữ liệu khi reload
        await saveAppState(appState, timestamp);
      } catch (err) {
        console.warn('Failed to persist app state:', err);
      } finally {
        if (isApplyingRemoteRef.current) {
          isApplyingRemoteRef.current = false;
        }
        pendingRemoteTimestampRef.current = null;
      }
    };

    void saveData();
  }, [appState, isLoading]);

  // Duy tri heartbeat presence cho tai khoan dang dang nhap
  useEffect(() => {
    if (presenceIntervalRef.current) {
      clearInterval(presenceIntervalRef.current);
      presenceIntervalRef.current = undefined;
    }

    if (!currentUser) {
      void pushSessionOffline();
      return;
    }

    const sendOnline = () => {
      void pushSessionOnline(currentUser);
    };

    sendOnline();
    presenceIntervalRef.current = window.setInterval(sendOnline, 20000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        sendOnline();
      }
    };

    window.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
        presenceIntervalRef.current = undefined;
      }
      window.removeEventListener('visibilitychange', handleVisibility);
      void pushSessionOffline();
    };
  }, [currentUser?.id]);

  useEffect(() => {
    const handleUnload = () => {
      void pushSessionOffline();
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  const resolveActor = (override?: UserAccount | null) => {
    const actor = override ?? currentUser;
    if (!actor) return undefined;
    return {
      id: actor.id,
      name: actor.name,
      role: actor.role,
      phone: actor.phone
    };
  };

  const addLog = (message: string, type: LogEntry['type'] = 'INFO', actorOverride?: UserAccount | null) => {
    const newLog: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date(),
      message,
      type,
      actor: resolveActor(actorOverride)
    };
    setAppState(prev => ({
      ...prev,
      logs: [newLog, ...(prev.logs || [])].slice(0, 300), // Giữ lại 300 log gần nhất
    }));
  };

  const pushSessionOnline = async (account: UserAccount) => {
    try {
      await setSessionOnline(sessionIdRef.current, {
        userId: account.id,
        userName: account.name,
        role: account.role,
        phone: account.phone,
        deviceId: deviceIdRef.current
      });
    } catch (err) {
      console.warn('Failed to update presence online', err);
    }
  };

  const pushSessionOffline = async () => {
    try {
      await setSessionOffline(sessionIdRef.current);
    } catch (err) {
      console.warn('Failed to update presence offline', err);
    }
  };

  const handleLoginByPhone = (phone: string) => {
    const normalized = normalizePhone(phone);
    const account = (appState.userAccounts || []).find(u => normalizePhone(u.phone) === normalized && u.isActive !== false);
    if (!account) {
      alert('Khong tim thay tai khoan phu hop. Lien he admin de cap quyen.');
      return false;
    }
    setCurrentUserId(account.id);
    addLog(`Dang nhap thanh cong: ${account.name}`, 'SUCCESS', account);
    void pushSessionOnline(account);
    return true;
  };

  const handleLogout = () => {
    setCurrentUserId('');
    addLog('Dang xuat khoi he thong', 'INFO');
    void pushSessionOffline();
  };

  const handleUpsertAccount = (account: UserAccount) => {
    setAppState(prev => {
      const accounts = prev.userAccounts || [];
      const exists = accounts.some(a => a.id === account.id);
      const next = exists ? accounts.map(a => a.id === account.id ? account : a) : [...accounts, account];
      return { ...prev, userAccounts: next };
    });
    addLog(`Cap nhat tai khoan: ${account.name}`, 'SUCCESS');
  };

  const handleDeleteAccount = (accountId: string) => {
    if (currentUser && currentUser.id === accountId) {
      alert('Khong the xoa tai khoan dang dang nhap.');
      return;
    }
    setAppState(prev => ({
      ...prev,
      userAccounts: (prev.userAccounts || []).filter(a => a.id !== accountId)
    }));
    addLog(`Da xoa tai khoan ${accountId}`, 'WARNING');
  };

  const guard = <T extends (...args: any[]) => void>(permission: AccessPermission, action: T): T => {
    return ((...args: any[]) => {
      if (!can(permission)) {
        alert('Ban khong co quyen thuc hien thao tac nay.');
        return;
      }
      return action(...args);
    }) as T;
  };

  const handleSubmitLearningAttempt = (attempt: LearningAttempt) => {
    setAppState(prev => {
      const prevAttempts = prev.learningAttempts || [];
      const filtered = prevAttempts.filter(a => !(a.learnerId === attempt.learnerId && a.lessonId === attempt.lessonId && a.questionId === attempt.questionId));
      const updatedAttempts = [attempt, ...filtered].slice(0, 200);
      return { ...prev, learningAttempts: updatedAttempts };
    });
    addLog(`Học viên ${attempt.learnerId} nộp câu hỏi ${attempt.questionId} (điểm ${attempt.score}/10)`, 'INFO');
  };

  const handleUpsertLearningProfile = (profile: LearningProfile) => {
    setAppState(prev => {
      const currentProfiles = prev.learningProfiles || [];
      const exists = currentProfiles.some(p => p.id === profile.id);
      const updatedProfiles = exists
        ? currentProfiles.map(p => p.id === profile.id ? profile : p)
        : [...currentProfiles, profile];
      return { ...prev, learningProfiles: updatedProfiles };
    });
    addLog(`Cập nhật hồ sơ Elearning cho ${profile.name}`, 'SUCCESS');
  };

  const handleUpdateLearningTracks = (updatedTracks: LearningTrack[]) => {
    setAppState(prev => ({ ...prev, learningTracks: updatedTracks }));
    addLog('Cập nhật nội dung Elearning (khóa học/bài/ câu hỏi)', 'SUCCESS');
  };

  const handleDeleteLearningProfile = (profileId: string) => {
    setAppState(prev => {
      const filteredProfiles = (prev.learningProfiles || []).filter(p => p.id !== profileId);
      const filteredAttempts = (prev.learningAttempts || []).filter(a => a.learnerId !== profileId);
      return { ...prev, learningProfiles: filteredProfiles, learningAttempts: filteredAttempts };
    });
    addLog(`Đã xóa hồ sơ Elearning ${profileId}`, 'WARNING');
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

  const handleCreateReceipt = (payload: { source: string; note?: string; items: InventoryReceiptItem[] }) => {
    if (!isAdmin) {
      alert('Chỉ ADMIN được phép tạo phiếu nhập kho.');
      return;
    }
    const source = payload.source.trim();
    if (!source) {
      alert('Vui lòng nhập nguồn gốc (link, NCC, mô tả...).');
      return;
    }

    const sanitizedItems = (payload.items || []).map(item => {
      const quantity = Math.max(1, Math.round(item.quantity || 0));
      const mode: InventoryReceiptItem['mode'] = item.mode === 'EXISTING' ? 'EXISTING' : item.mode === 'PLANNED' ? 'PLANNED' : 'NEW';
      return {
        ...item,
        mode,
        quantity,
        name: (item.name || '').trim(),
        category: (item.category || 'Khác').trim() || 'Khác',
        barcode: normalizeBarcode(item.barcode || ''),
        location: (item.location || 'Kho tổng').trim(),
        description: item.description?.trim(),
        purchaseLink: item.purchaseLink?.trim(),
        productionNote: item.productionNote?.trim(),
        plannedEta: item.plannedEta?.trim()
      };
    }).filter(item => {
      if (item.mode === 'PLANNED') return !!item.name;
      return item.quantity > 0 && (item.mode === 'EXISTING' ? !!item.itemId : !!item.name);
    });

    if (!sanitizedItems.length) {
      alert('Vui lòng thêm ít nhất 1 thiết bị vào phiếu.');
      return;
    }

    let error = '';
    let createdReceipt: InventoryReceipt | null = null;

    setAppState(prev => {
      let nextInventory = [...prev.inventory];
      const receiptItems: InventoryReceiptItem[] = [];

      sanitizedItems.forEach((item, idx) => {
        if (error) return;
        const quantity = item.quantity || 1;
        if (item.mode === 'EXISTING' && item.itemId) {
          const foundIdx = nextInventory.findIndex(inv => inv.id === item.itemId);
          if (foundIdx === -1) {
            error = `Không tìm thấy thiết bị cho dòng ${idx + 1}.`;
            return;
          }
          const target = nextInventory[foundIdx];
          const updated: InventoryItem = {
            ...target,
            totalQuantity: target.totalQuantity + quantity,
            availableQuantity: target.availableQuantity + quantity,
            location: item.location || target.location,
            purchaseLink: item.purchaseLink || target.purchaseLink,
            rentalPrice: typeof item.rentalPrice === 'number' ? item.rentalPrice : target.rentalPrice,
            minStock: typeof item.minStock === 'number' ? item.minStock : target.minStock,
            productionNote: item.productionNote || target.productionNote,
            description: item.description || target.description,
            imageUrl: item.imageUrl || target.imageUrl,
            category: item.category || target.category
          };
          nextInventory[foundIdx] = updated;
          receiptItems.push({
            ...item,
            mode: 'EXISTING',
            itemId: target.id,
            name: target.name,
            category: updated.category,
            quantity,
            barcode: target.barcode || item.barcode
          });
        } else if (item.mode === 'PLANNED') {
          const name = item.name.trim();
          if (!name) {
            error = `Thiếu tên thiết bị ở dòng ${idx + 1}.`;
            return;
          }
          const category = item.category || 'Khác';
          const finalBarcode = item.barcode || generateBarcode(name || category);
          const duplicate = findDuplicateBarcodeItem(nextInventory, finalBarcode);
          if (duplicate) {
            error = `Mã barcode ${finalBarcode} đã thuộc về "${duplicate.name}".`;
            return;
          }
          const plannedItem: InventoryItem = {
            id: `ITEM-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
            barcode: finalBarcode,
            name,
            category,
            description: item.description || '',
            location: item.location || 'Kho tổng',
            totalQuantity: 0,
            availableQuantity: 0,
            inUseQuantity: 0,
            maintenanceQuantity: 0,
            brokenQuantity: 0,
            lostQuantity: 0,
            usageCount: 0,
            imageUrl: item.imageUrl || 'https://picsum.photos/200/200',
            rentalPrice: Number.isFinite(item.rentalPrice) ? Number(item.rentalPrice) : 0,
            purchaseLink: item.purchaseLink || '',
            minStock: Number.isFinite(item.minStock) ? Number(item.minStock) : 5,
            productionNote: item.productionNote || '',
            plannedPurchase: true,
            plannedQuantity: item.quantity || 0,
            plannedEta: item.plannedEta || ''
          };
          nextInventory.push(plannedItem);
          receiptItems.push({
            ...item,
            mode: 'PLANNED',
            itemId: plannedItem.id,
            name: plannedItem.name,
            category: plannedItem.category,
            quantity: item.quantity || 0,
            barcode: plannedItem.barcode
          });
        } else {
          const name = item.name.trim();
          if (!name) {
            error = `Thiếu tên thiết bị ở dòng ${idx + 1}.`;
            return;
          }
          const category = item.category || 'Khác';
          const finalBarcode = item.barcode || generateBarcode(name || category);
          const duplicate = findDuplicateBarcodeItem(nextInventory, finalBarcode);
          if (duplicate) {
            error = `Mã barcode ${finalBarcode} đã thuộc về "${duplicate.name}".`;
            return;
          }
          const newItem: InventoryItem = {
            id: `ITEM-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
            barcode: finalBarcode,
            name,
            category,
            description: item.description || '',
            location: item.location || 'Kho tổng',
            totalQuantity: quantity,
            availableQuantity: quantity,
            inUseQuantity: 0,
            maintenanceQuantity: 0,
            brokenQuantity: 0,
            lostQuantity: 0,
            usageCount: 0,
            imageUrl: item.imageUrl || 'https://picsum.photos/200/200',
            rentalPrice: Number.isFinite(item.rentalPrice) ? Number(item.rentalPrice) : 0,
            purchaseLink: item.purchaseLink || '',
            minStock: Number.isFinite(item.minStock) ? Number(item.minStock) : 5,
            productionNote: item.productionNote || '',
            plannedPurchase: false,
            plannedQuantity: 0,
            plannedEta: ''
          };
          nextInventory.push(newItem);
          receiptItems.push({
            ...item,
            mode: 'NEW',
            itemId: newItem.id,
            name: newItem.name,
            category: newItem.category,
            quantity,
            barcode: newItem.barcode
          });
        }
      });

      if (error) return prev;

      const receipt: InventoryReceipt = {
        id: `RC-${Date.now()}`,
        code: `PNK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
        createdAt: new Date().toISOString(),
        source,
        note: payload.note?.trim(),
        createdBy: resolveActor(),
        items: receiptItems
      };
      createdReceipt = receipt;

      return {
        ...prev,
        inventory: nextInventory,
        inventoryReceipts: [receipt, ...(prev.inventoryReceipts || [])].slice(0, 80)
      };
    });

    if (error) {
      alert(error);
      return;
    }
    if (createdReceipt) {
      addLog(`Tạo phiếu nhập kho ${createdReceipt.code} (${createdReceipt.items.length} dòng) • Nguồn: ${createdReceipt.source}`, 'SUCCESS');
    }
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

  const handleDeleteSaleOrder = (orderId: string) => {
    setAppState(prev => {
      const target = (prev.saleOrders || []).find(o => o.id === orderId);
      if (!target) return prev;
      const remaining = (prev.saleOrders || []).filter(o => o.id !== orderId && o.relatedOrderId !== orderId);
      return { ...prev, saleOrders: remaining };
    });
    addLog(`Đã xóa đơn bán hàng: ${orderId}`, 'WARNING');
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
  const handleUpsertPayrollAdjustment = (payload: { employeeId: string; month: string; bonusAmount: number; note?: string }) => {
    const safeMonth = payload.month || new Date().toISOString().slice(0, 7);
    const cleanAmount = Math.max(0, Number(payload.bonusAmount) || 0);
    const cleanNote = payload.note?.trim() || '';
    setAppState(prev => {
      const list = prev.payrollAdjustments || [];
      const idx = list.findIndex(adj => adj.employeeId === payload.employeeId && adj.month === safeMonth);
      const baseId = idx >= 0 ? list[idx].id : `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const normalized: PayrollAdjustment = {
        id: baseId,
        employeeId: payload.employeeId,
        month: safeMonth,
        bonusAmount: cleanAmount,
        note: cleanNote
      };
      const next = [...list];
      if (cleanAmount === 0 && !cleanNote) {
        if (idx >= 0) next.splice(idx, 1);
        return { ...prev, payrollAdjustments: next };
      }
      if (idx >= 0) {
        next[idx] = { ...next[idx], ...normalized };
      } else {
        next.push(normalized);
      }
      return { ...prev, payrollAdjustments: next };
    });
    const empName = appState.employees.find(e => e.id === payload.employeeId)?.name || 'Nhân sự';
    const actionLabel = cleanAmount === 0 && !cleanNote ? 'Xóa' : 'Cập nhật';
    addLog(`${actionLabel} thưởng tháng ${safeMonth} cho ${empName}: ${cleanAmount.toLocaleString()}đ${cleanNote ? ` • ${cleanNote}` : ''}`, 'INFO');
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
    const timestamp = new Date().toISOString();
    try {
      lastSyncedAtRef.current = new Date(timestamp).getTime();
      pendingRemoteTimestampRef.current = timestamp;
      isApplyingRemoteRef.current = true;
      await saveAppState(newState, timestamp);
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

  const handleDeleteEvent = (eventId: string) => {
    if (!isAdmin) {
      alert('Chỉ ADMIN được phép xóa sự kiện.');
      return;
    }

    let deletedName = '';
    let nextState: AppState | null = null;

    setAppState(prev => {
      const target = prev.events.find(e => e.id === eventId);
      if (!target) return prev;
      deletedName = target.name;

      const cleanedSaleOrders = (prev.saleOrders || []).map(order => {
        if (order.eventId !== eventId && order.groupId !== eventId) return order;
        return {
          ...order,
          eventId: order.eventId === eventId ? undefined : order.eventId,
          eventName: order.eventId === eventId ? undefined : order.eventName,
          groupType: order.groupType === 'EVENT' && order.groupId === eventId ? 'CUSTOMER' : order.groupType,
          groupId: order.groupId === eventId ? undefined : order.groupId,
          groupName: order.groupId === eventId ? (order.customerName || order.groupName) : order.groupName
        };
      });

      nextState = {
        ...prev,
        events: prev.events.filter(e => e.id !== eventId),
        saleOrders: cleanedSaleOrders
      };
      return nextState;
    });

    if (nextState) {
      saveEventStateImmediate(nextState);
      addLog(`ADMIN xóa sự kiện: "${deletedName}"`, 'WARNING');
    }
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
    <>
    <Layout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      logs={appState.logs}
      currentUser={currentUser}
      canManageAccess={can('ACCESS_MANAGE')}
      canViewLogs={canViewLogs}
      canViewEmployees={canViewEmployees}
      onOpenAccess={() => setIsAccessOpen(true)}
      onLogout={handleLogout}
    >
      {activeTab === 'dashboard' && <Dashboard appState={appState} />}
      {activeTab === 'inventory' && (
        <InventoryManager 
          inventory={appState.inventory} 
          onUpdateInventory={guard('INVENTORY_EDIT', handleUpdateInventory)} 
          onAddNewItem={guard('INVENTORY_EDIT', handleAddNewItem)} 
          onDeleteItem={guard('INVENTORY_DELETE', handleDeleteItem)} 
          onStatusChange={guard('INVENTORY_EDIT', handleItemStatusChange)}
          receipts={appState.inventoryReceipts || []}
          onCreateReceipt={guard('INVENTORY_EDIT', handleCreateReceipt)}
          canCreateReceipt={isAdmin}
          canEdit={can('INVENTORY_EDIT')}
          canDelete={can('INVENTORY_DELETE')}
        />
      )}
      {activeTab === 'packages' && (
        <PackageManager 
          packages={appState.packages} 
          inventory={appState.inventory} 
          onCreatePackage={guard('PACKAGES_EDIT', handleCreatePackage)} 
          onUpdatePackage={guard('PACKAGES_EDIT', handleUpdatePackage)} 
          onDeletePackage={guard('PACKAGES_DELETE', handleDeletePackage)}
          canEdit={can('PACKAGES_EDIT')}
          canDelete={can('PACKAGES_DELETE')}
        />
      )}
      {activeTab === 'employees' && (
        <EmployeeManager 
          employees={appState.employees} 
          events={appState.events}
          payrollAdjustments={appState.payrollAdjustments || []}
          onUpsertPayrollAdjustment={guard('EMPLOYEES_EDIT', handleUpsertPayrollAdjustment)}
          canAdjustPayroll={can('EMPLOYEES_EDIT')}
          onAddEmployee={guard('EMPLOYEES_EDIT', handleAddEmployee)} 
          onUpdateEmployee={guard('EMPLOYEES_EDIT', handleUpdateEmployee)} 
          onDeleteEmployee={guard('EMPLOYEES_DELETE', handleDeleteEmployee)}
          canEdit={can('EMPLOYEES_EDIT')}
          canDelete={can('EMPLOYEES_DELETE')}
        />
      )}
      {activeTab === 'quotations' && (
        <QuotationManager 
          quotations={appState.quotations} 
          packages={appState.packages} 
          inventory={appState.inventory} 
          onCreateQuotation={guard('QUOTATIONS_EDIT', handleCreateQuotation)} 
          onDeleteQuotation={guard('QUOTATIONS_DELETE', handleDeleteQuotation)} 
          onUpdateStatus={guard('QUOTATIONS_EDIT', handleUpdateQuotationStatus)}
          canEdit={can('QUOTATIONS_EDIT')}
          canDelete={can('QUOTATIONS_DELETE')}
        />
      )}
      {activeTab === 'sales' && (
        <SalesManager
          saleItems={appState.saleItems || []}
          events={appState.events}
          onAddSaleItem={guard('SALES_EDIT', handleCreateSaleItem)}
          onUpdateSaleItem={guard('SALES_EDIT', handleUpdateSaleItem)}
          onDeleteSaleItem={guard('SALES_DELETE', handleDeleteSaleItem)}
          onCreateSaleOrder={guard('SALES_EDIT', handleCreateSaleOrder)}
          onDeleteSaleOrder={guard('SALES_DELETE', handleDeleteSaleOrder)}
          saleOrders={appState.saleOrders || []}
          onCreateSaleReturn={guard('SALES_EDIT', handleCreateSaleReturn)}
          canEdit={can('SALES_EDIT')}
          canDelete={can('SALES_DELETE')}
        />
      )}
      {activeTab === 'elearning' && (
        <Elearning
          tracks={appState.learningTracks || []}
          profiles={appState.learningProfiles || []}
          attempts={appState.learningAttempts || []}
          ranks={appState.careerRanks || []}
          employees={appState.employees}
          events={appState.events}
          onSubmitAttempt={guard('ELEARNING_EDIT', handleSubmitLearningAttempt)}
          onUpsertProfile={guard('ELEARNING_EDIT', handleUpsertLearningProfile)}
          onUpdateTracks={guard('ELEARNING_EDIT', handleUpdateLearningTracks)}
          onDeleteProfile={guard('ELEARNING_EDIT', handleDeleteLearningProfile)}
          canEdit={can('ELEARNING_EDIT')}
          isAdminView={isElearningAdmin}
          currentEmployeeId={currentUser?.linkedEmployeeId}
        />
      )}
      {activeTab === 'logs' && canViewLogs && (
        <AdminLogPage logs={appState.logs} accounts={appState.userAccounts || []} activeSessions={activeSessions} />
      )}
      {activeTab === 'events' && (
        <EventManager 
          events={appState.events} 
          inventory={appState.inventory} 
          packages={appState.packages} 
          employees={appState.employees} 
          quotations={appState.quotations}
          saleOrders={appState.saleOrders || []}
          canEdit={can('EVENTS_EDIT')}
          isAdmin={currentUser?.role === 'ADMIN'}
          onExportToEvent={guard('EVENTS_EDIT', handleExportToEvent)} 
          onExportPackageToEvent={guard('EVENTS_EDIT', handleExportPackageToEvent)}
          onSyncQuotation={guard('EVENTS_EDIT', handleSyncQuotation)}
          onReturnFromEvent={guard('EVENTS_EDIT', handleReturnFromEvent)} 
          onUpdateEventItemQuantity={guard('EVENTS_EDIT', handleUpdateEventItemQuantity)}
          onRemoveEventItems={guard('EVENTS_EDIT', handleRemoveEventItems)}
          onCreateEvent={guard('EVENTS_EDIT', handleCreateEvent)} 
          onDeleteEvent={isAdmin ? guard('EVENTS_DELETE', handleDeleteEvent) : undefined}
          onAssignStaff={guard('EVENTS_EDIT', handleAssignStaff)}
          onRemoveStaff={guard('EVENTS_EDIT', handleRemoveStaff)}
          onAddExpense={guard('EVENTS_EDIT', handleAddExpense)}
          onRemoveExpense={guard('EVENTS_EDIT', handleRemoveExpense)}
          onAddAdvanceRequest={guard('EVENTS_EDIT', handleAddAdvanceRequest)}
          onRemoveAdvanceRequest={guard('EVENTS_EDIT', handleRemoveAdvanceRequest)}
          onLinkQuotation={guard('EVENTS_EDIT', handleLinkQuotation)}
          onFinalizeOrder={guard('EVENTS_EDIT', handleFinalizeOrder)}
          onToggleItemDone={guard('EVENTS_EDIT', handleToggleEventItemDone)}
          onToggleStaffDone={guard('EVENTS_EDIT', handleToggleEventStaffDone)}
          onUpdateEvent={guard('EVENTS_EDIT', handleUpdateEvent)}
          onLinkSaleOrder={guard('EVENTS_EDIT', handleLinkSaleOrderToEvent)}
          onChecklistScan={guard('EVENTS_EDIT', handleChecklistScan)}
          onUpdateChecklistNote={guard('EVENTS_EDIT', handleUpdateChecklistNote)}
          onSaveChecklistSignature={guard('EVENTS_EDIT', handleSaveChecklistSignature)}
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
    <LoginModal
      isOpen={!currentUser}
      accounts={appState.userAccounts || []}
      onLogin={handleLoginByPhone}
    />
    <AccessManager
      isOpen={isAccessOpen && can('ACCESS_MANAGE')}
      accounts={appState.userAccounts || []}
      employees={appState.employees}
      currentUserId={currentUser?.id}
      onClose={() => setIsAccessOpen(false)}
      onUpsertAccount={handleUpsertAccount}
      onDeleteAccount={handleDeleteAccount}
    />
    </>
  );
};

export default App;
