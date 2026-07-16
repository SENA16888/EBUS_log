
import React, { useState, useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { SalesManager } from './components/SalesManager';
import { Dashboard } from './components/Dashboard';
import { InventoryManager } from './components/InventoryManager';
import { StocktakeManager } from './components/StocktakeManager';
import { EventManager } from './components/EventManager';
import { PackageManager } from './components/PackageManager';
import { EmployeeManager } from './components/EmployeeManager';
import { QuotationManager } from './components/QuotationManager';
import { AIChat } from './components/AIChat';
import { Elearning } from './components/Elearning';
import { AdminLogPage } from './components/AdminLogPage';
import { EinsteinHouseOS } from './components/EinsteinHouseOS';
import { EducationContentManager } from './components/EducationContentManager';
import { InteractiveDeviceManager } from './components/InteractiveDeviceManager';
import { AppState, InventoryItem, Event, EventStatus, Transaction, TransactionType, ComboPackage, Employee, Quotation, EventStaffAllocation, EventStaffRegistration, EventExpense, EventAdvanceRequest, LogEntry, ChecklistDirection, ChecklistStatus, ChecklistSignature, EventChecklist, LearningAttempt, LearningProfile, AccessPermission, UserAccount, LearningTrack, InventoryReceipt, InventoryReceiptItem, ActiveSession, PayrollAdjustment, InventoryAuditSession, InventoryAuditItem, InventoryAuditBaseline, EducationActivity, EducationLessonLink, InteractiveDeviceProfile, HouseOperationInstance } from './types';
import { MOCK_INVENTORY, MOCK_EVENTS, MOCK_TRANSACTIONS, MOCK_PACKAGES, MOCK_EMPLOYEES, MOCK_LEARNING_TRACKS, MOCK_CAREER_RANKS, DEFAULT_USER_ACCOUNTS, MOCK_INVENTORY_RECEIPTS, MOCK_EDUCATION_ACTIVITIES, MOCK_INTERACTIVE_DEVICES } from './constants';
import { MessageSquare } from 'lucide-react';
import { ensureCollectionModelInitialized, initializeAuth, loadCollectionState, subscribeToCollectionState, subscribeToSessions, setSessionOnline, setSessionOffline, syncCollectionStateDiff, saveLearningUserState, subscribeToLearningUserState, deleteLearningUserState, subscribeToLearningUsers } from './services/firebaseService';
import { ensureInventoryBarcodes, ensureItemBarcode, findDuplicateBarcodeItem, findItemByBarcode, generateBarcode, normalizeBarcode } from './services/barcodeService';
import { normalizeChecklist } from './services/checklistService';
import { ACCESS_PERMISSION_VERSION, getDefaultPermissionsForRole, hasPermission, normalizePermissionsForRole, normalizePhone } from './services/accessControl';
import { AccessManager } from './components/AccessManager';
import { LoginModal } from './components/LoginModal';

const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getEventStaffSessions = (staff?: Pick<EventStaffAllocation, 'session' | 'sessions'>) => {
  if (!staff) return [];
  if (staff.sessions && staff.sessions.length > 0) return staff.sessions;
  return staff.session ? [staff.session] : [];
};

const getEventStaffAllocationKey = (staff: EventStaffAllocation, index?: number) =>
  staff.id || staff.autoKey || `${staff.employeeId}-${staff.shiftDate || 'no-date'}-${getEventStaffSessions(staff).join('-') || staff.session || 'no-session'}-${index ?? 0}`;

type AppTab = 'dashboard' | 'inventory' | 'stocktake' | 'events' | 'education' | 'interactiveDevices' | 'packages' | 'employees' | 'quotations' | 'sales' | 'elearning' | 'logs';

const PRIMARY_CONTENT_PROGRAM_ID = 'primary-content-program';

const EVENT_PROFILE_DEFAULT_TIMES: Record<'MORNING' | 'AFTERNOON' | 'EVENING', { start: string; end: string }> = {
  MORNING: { start: '08:00', end: '11:00' },
  AFTERNOON: { start: '13:00', end: '16:00' },
  EVENING: { start: '19:00', end: '21:00' }
};

const getEventScheduleForPublicProgram = (event: Event) => {
  if (event.schedule && event.schedule.length > 0) return event.schedule;
  if (event.startDate) return [{ date: event.startDate, sessions: event.session ? [event.session] : ['MORNING' as const] }];
  return [];
};

const getPublicProgramEvent = (event: Event, programId?: string): Event => {
  if (!programId) return event;
  const defaultSchedule = getEventScheduleForPublicProgram(event);
  const defaultDate = defaultSchedule[0]?.date || event.startDate || new Date().toISOString().slice(0, 10);
  const defaultSessions = defaultSchedule[0]?.sessions || (event.session ? [event.session] : ['MORNING' as const]);

  if (programId === PRIMARY_CONTENT_PROGRAM_ID) {
    const meta = event.primaryContentProgram || {};
    const date = meta.date || defaultDate;
    const sessions = meta.sessions && meta.sessions.length > 0 ? meta.sessions : defaultSessions;
    return {
      ...event,
      startDate: date,
      endDate: date,
      session: sessions[0],
      schedule: [{ date, sessions }],
      layout: event.layout,
      houseOperation: event.houseOperation
    };
  }

  const program = (event.contentPrograms || []).find(item => item.id === programId);
  if (!program) return event;
  const date = program.date || defaultDate;
  const sessions = program.sessions && program.sessions.length > 0 ? program.sessions : defaultSessions;
  return {
    ...event,
    startDate: date,
    endDate: date,
    session: sessions[0],
    schedule: [{ date, sessions }],
    layout: program.layout,
    houseOperation: program.houseOperation
  };
};

const getPublicEventPrimaryDate = (event: Event) =>
  event.schedule?.[0]?.date || event.startDate || event.endDate || '';

const getPublicScopedProgramEvents = (event: Event, activeProgramId?: string): Event[] => {
  const defaultSchedule = getEventScheduleForPublicProgram(event);
  const defaultDate = defaultSchedule[0]?.date || event.startDate || new Date().toISOString().slice(0, 10);
  const defaultSessions = defaultSchedule[0]?.sessions || (event.session ? [event.session] : ['MORNING' as const]);
  const programs = [
    {
      id: PRIMARY_CONTENT_PROGRAM_ID,
      name: event.primaryContentProgram?.name || 'Chương trình chính',
      date: event.primaryContentProgram?.date || defaultDate,
      sessions: event.primaryContentProgram?.sessions && event.primaryContentProgram.sessions.length > 0
        ? event.primaryContentProgram.sessions
        : defaultSessions,
      layout: event.layout,
      houseOperation: event.houseOperation,
      isPrimary: true
    },
    ...(event.contentPrograms || []).map(program => ({
      id: program.id,
      name: program.name,
      date: program.date || defaultDate,
      sessions: program.sessions && program.sessions.length > 0 ? program.sessions : defaultSessions,
      layout: program.layout,
      houseOperation: program.houseOperation,
      isPrimary: false
    }))
  ];
  const rootProgramId = activeProgramId || PRIMARY_CONTENT_PROGRAM_ID;
  return programs.map(program => ({
    ...event,
    id: program.id === rootProgramId ? event.id : `${event.id}::${program.id}`,
    name: program.isPrimary ? event.name : `${event.name} • ${program.name}`,
    startDate: program.date,
    endDate: program.date,
    session: program.sessions[0],
    schedule: [{ date: program.date, sessions: program.sessions }],
    layout: program.layout,
    houseOperation: program.houseOperation,
    contentPrograms: undefined,
    primaryContentProgram: undefined
  }));
};

const getPublicLiveEvents = (events: Event[], publicEvent: Event, sourceEvent: Event, programId?: string) => {
  if ((publicEvent.organizationVenue || 'EH') !== 'EH') return [publicEvent];
  const publicDate = getPublicEventPrimaryDate(publicEvent);
  return events
    .flatMap(event => getPublicScopedProgramEvents(event, event.id === sourceEvent.id ? (programId || PRIMARY_CONTENT_PROGRAM_ID) : undefined))
    .filter(event => (event.organizationVenue || 'EH') === 'EH' && getPublicEventPrimaryDate(event) === publicDate);
};

const dedupeTextList = (values: string[]) =>
  Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));

const extractEhRoomsFromEvents = (events: Event[]) =>
  dedupeTextList(events
    .filter(event => (event.organizationVenue || 'EH') === 'EH')
    .flatMap(event => [
      ...(event.houseOperation?.rooms || []),
      ...(event.houseOperation?.stations || []).map(station => station.room).filter(Boolean) as string[],
      ...(event.contentPrograms || []).flatMap(program => [
        ...(program.houseOperation?.rooms || []),
        ...(program.houseOperation?.stations || []).map(station => station.room).filter(Boolean) as string[]
      ])
    ]));

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

const normalizeInventoryLifecycle = (item: InventoryItem): InventoryItem => {
  const lifecycle = item.lifecycle === 'CONSUMABLE' ? 'CONSUMABLE' : 'DEPRECIATION';
  const maxUsage = lifecycle === 'DEPRECIATION'
    ? (typeof item.maxUsage === 'number' && item.maxUsage > 0 ? item.maxUsage : 10)
    : undefined;
  const consumableUnit = lifecycle === 'CONSUMABLE' ? (item.consumableUnit || 'cái') : undefined;
  return { ...item, lifecycle, maxUsage, consumableUnit };
};

const hasLegacyHouseOperationAgenda = (operation?: HouseOperationInstance | null): boolean => {
  if (!operation) return false;
  const legacy = operation as HouseOperationInstance & { timeline?: HouseOperationInstance['agenda'] };
  return Array.isArray(legacy.timeline);
};

const normalizeHouseOperationAgenda = (operation?: HouseOperationInstance | null): HouseOperationInstance | undefined => {
  if (!operation) return undefined;
  const legacy = operation as HouseOperationInstance & { timeline?: HouseOperationInstance['agenda'] };
  const { timeline: _legacyTimeline, ...rest } = legacy;
  const currentAgenda = Array.isArray(legacy.agenda) ? legacy.agenda : undefined;
  const legacyAgenda = Array.isArray(legacy.timeline) ? legacy.timeline : undefined;
  return {
    ...rest,
    templateVersion: legacy.templateVersion || 1,
    createdAt: legacy.createdAt || new Date().toISOString(),
    stations: Array.isArray(legacy.stations) ? legacy.stations : [],
    agenda: currentAgenda && (currentAgenda.length > 0 || !legacyAgenda)
      ? currentAgenda
      : (legacyAgenda || []),
    rotations: Array.isArray(legacy.rotations) ? legacy.rotations : [],
    tasks: Array.isArray(legacy.tasks) ? legacy.tasks : [],
    incidents: Array.isArray(legacy.incidents) ? legacy.incidents : [],
    mediaTasks: Array.isArray(legacy.mediaTasks) ? legacy.mediaTasks : [],
    feedback: Array.isArray(legacy.feedback) ? legacy.feedback : []
  };
};

const hasLegacyHouseOperationAgendaInState = (state: Partial<AppState>): boolean =>
  (state.events || []).some(event => hasLegacyHouseOperationAgenda(event.houseOperation));

const normalizeInteractiveDeviceAgendaCopy = (device: InteractiveDeviceProfile): InteractiveDeviceProfile => ({
  ...device,
  eventRules: (device.eventRules || []).map(rule => ({
    ...rule,
    title: (rule.title || '').replace(/timeline sự kiện/g, 'agenda sự kiện')
  }))
});

const hasLegacyInteractiveDeviceAgendaCopy = (device?: InteractiveDeviceProfile | null): boolean =>
  (device?.eventRules || []).some(rule => (rule.title || '').includes('timeline sự kiện'));

const hasLegacyInteractiveDeviceAgendaCopyInState = (state: Partial<AppState>): boolean =>
  (state.interactiveDevices || []).some(hasLegacyInteractiveDeviceAgendaCopy);

const buildAgendaMigrationBaseline = (normalizedState: AppState, rawState: Partial<AppState>): AppState => {
  const rawEventMap = new Map((rawState.events || []).map(event => [event.id, event]));
  const rawDeviceMap = new Map((rawState.interactiveDevices || []).map(device => [device.id, device]));
  return {
    ...normalizedState,
    events: normalizedState.events.map(event => {
      const rawEvent = rawEventMap.get(event.id);
      if (!hasLegacyHouseOperationAgenda(rawEvent?.houseOperation)) return event;
      return {
        ...event,
        houseOperation: rawEvent?.houseOperation
      };
    }),
    interactiveDevices: (normalizedState.interactiveDevices || []).map(device => {
      const rawDevice = rawDeviceMap.get(device.id);
      return hasLegacyInteractiveDeviceAgendaCopy(rawDevice) && rawDevice ? rawDevice : device;
    })
  };
};

const stripLearningUserData = (state: AppState): AppState => ({
  ...state,
  learningProfiles: [],
  learningAttempts: []
});

const createInitialAppState = (): AppState => ({
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
  inventoryAudits: [],
  learningTracks: MOCK_LEARNING_TRACKS,
  learningProfiles: [],
  learningAttempts: [],
  careerRanks: MOCK_CAREER_RANKS,
  userAccounts: DEFAULT_USER_ACCOUNTS,
  payrollAdjustments: [],
  educationActivities: MOCK_EDUCATION_ACTIVITIES,
  interactiveDevices: MOCK_INTERACTIVE_DEVICES,
  ehRooms: []
});

const buildLearningProfileForUser = (
  account: UserAccount,
  employees: Employee[],
  existing?: Partial<LearningProfile> | null
): LearningProfile => {
  const linkedEmployee = account.linkedEmployeeId
    ? employees.find(employee => employee.id === account.linkedEmployeeId)
    : undefined;

  return {
    id: existing?.id || `learning-user-${account.id}`,
    name: existing?.name || linkedEmployee?.name || account.name,
    employeeId: existing?.employeeId || linkedEmployee?.id || account.linkedEmployeeId,
    userAccountId: account.id,
    userName: account.name,
    tenureMonths: existing?.tenureMonths ?? 0,
    eventsAttended: existing?.eventsAttended ?? 0,
    scenarioScore: existing?.scenarioScore ?? 0,
    roleHistory: existing?.roleHistory && existing.roleHistory.length > 0
      ? existing.roleHistory
      : [linkedEmployee?.role || account.role],
    badges: existing?.badges || [],
    currentRank: existing?.currentRank,
    completedLessons: existing?.completedLessons || [],
    preferredTracks: existing?.preferredTracks || [],
    progress: existing?.progress || {},
    certificates: existing?.certificates || [],
    totalScore: existing?.totalScore ?? 0,
    rankId: existing?.rankId ?? null,
    retakePermissions: existing?.retakePermissions || {}
  };
};

const App: React.FC = () => {
  console.log('App is rendering');
  console.log('localStorage available:', typeof localStorage !== 'undefined');
  console.log('sessionStorage available:', typeof sessionStorage !== 'undefined');
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccessOpen, setIsAccessOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(() => {
    return localStorage.getItem('ebus_current_user') || '';
  });
  
  const [appState, setAppState] = useState<AppState>(() => createInitialAppState());
  const [learningProfilesState, setLearningProfilesState] = useState<LearningProfile[]>([]);
  const [learningAttemptsState, setLearningAttemptsState] = useState<LearningAttempt[]>([]);
  const [learningTeamProfilesState, setLearningTeamProfilesState] = useState<LearningProfile[]>([]);
  const [learningTeamAttemptsState, setLearningTeamAttemptsState] = useState<LearningAttempt[]>([]);
  const [learningLeaderboardProfiles, setLearningLeaderboardProfiles] = useState<LearningProfile[]>([]);
  const [elearningOpenRequest, setElearningOpenRequest] = useState<{ trackId: string; lessonId: string; nonce: number } | undefined>(undefined);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const publicLiveEventId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('ehLive') || ''
    : '';
  const publicLiveProgramId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('ehProgram') || ''
    : '';
  const isPublicLiveMode = !!publicLiveEventId;
  const isApplyingRemoteRef = useRef(false);
  const lastPersistedStateRef = useRef<AppState>(stripLearningUserData(createInitialAppState()));
  const lastConflictNoticeRef = useRef<string>('');
  const sessionIdRef = useRef<string>(getSessionId());
  const deviceIdRef = useRef<string>(getDeviceId());
  const presenceIntervalRef = useRef<number | undefined>(undefined);
  const persistInFlightRef = useRef(false);
  const pendingPersistStateRef = useRef<AppState | null>(null);
  const persistDebounceRef = useRef<number | undefined>(undefined);

  const withDefaults = (state: AppState): AppState => {
    const baseAccounts = state.userAccounts && state.userAccounts.length > 0 ? state.userAccounts : DEFAULT_USER_ACCOUNTS;
    const normalizedAccounts = baseAccounts.map(acc => {
      const role = acc.role || 'STAFF';
      return {
        ...acc,
        role,
        permissions:
          acc.permissions && acc.permissions.length > 0
            ? normalizePermissionsForRole(role, acc.permissions, acc.permissionsVersion)
            : getDefaultPermissionsForRole(role),
        permissionsVersion: ACCESS_PERMISSION_VERSION,
        isActive: acc.isActive !== false
      };
    });
    const normalizedLogs = (state.logs || []).map(log => ({
      ...log,
      timestamp: log?.timestamp ? (log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp)) : new Date()
    }));
    const normalizedInventory = ensureInventoryBarcodes(state.inventory || []).map(normalizeInventoryLifecycle);
    return {
      ...state,
      inventory: normalizedInventory,
      events: (state.events || []).map(ev => {
        const houseOperation = normalizeHouseOperationAgenda(ev.houseOperation);
        const schedule = Array.isArray(ev.schedule) ? ev.schedule : [];
        const defaultSession = (ev.eventProfile?.programSession || schedule[0]?.sessions?.[0] || ev.session || 'MORNING') as 'MORNING' | 'AFTERNOON' | 'EVENING';
        const defaultTimeRange = EVENT_PROFILE_DEFAULT_TIMES[defaultSession] || EVENT_PROFILE_DEFAULT_TIMES.MORNING;
        return {
          ...ev,
          items: ev.items || [],
          staffRegistrations: ev.staffRegistrations || [],
          advanceRequests: ev.advanceRequests || [],
          advancePaidAmount: ev.advancePaidAmount ?? 0,
          advancePaidDate: ev.advancePaidDate || '',
          advancePaidConfirmed: ev.advancePaidConfirmed ?? false,
          advanceRefundedConfirmed: ev.advanceRefundedConfirmed ?? false,
          paymentCompleted: ev.paymentCompleted ?? false,
          advanceSkipped: ev.advanceSkipped ?? false,
          eventProfile: {
            ...(ev.eventProfile || {}),
            code: ev.startDate ? `EB-${ev.startDate.replace(/-/g, '')}-${String(Math.floor(Math.random() * 900 + 100))}` : `EB-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 900 + 100))}`,
            ...(ev.eventProfile?.code ? { code: ev.eventProfile.code } : {}),
            organization: ev.eventProfile?.organization || ev.client,
            programSession: defaultSession,
            programTimeStart: ev.eventProfile?.programTimeStart || defaultTimeRange.start,
            programTimeEnd: ev.eventProfile?.programTimeEnd || defaultTimeRange.end,
            addressDetail: ev.eventProfile?.addressDetail || ev.location,
          },
          checklist: normalizeChecklist(ev.checklist),
          timeline: ev.timeline || [],
          ...(houseOperation ? { houseOperation } : {})
        };
      }),
      learningTracks: state.learningTracks || MOCK_LEARNING_TRACKS,
      learningProfiles: [],
      learningAttempts: [],
      careerRanks: state.careerRanks || MOCK_CAREER_RANKS,
      inventoryReceipts: state.inventoryReceipts || [],
      inventoryAudits: state.inventoryAudits || [],
      logs: normalizedLogs,
      userAccounts: normalizedAccounts,
      payrollAdjustments: state.payrollAdjustments || [],
      educationActivities: state.educationActivities && state.educationActivities.length > 0 ? state.educationActivities : MOCK_EDUCATION_ACTIVITIES,
      interactiveDevices: (state.interactiveDevices && state.interactiveDevices.length > 0 ? state.interactiveDevices : MOCK_INTERACTIVE_DEVICES)
        .map(normalizeInteractiveDeviceAgendaCopy),
      ehRooms: Array.isArray(state.ehRooms) ? dedupeTextList(state.ehRooms) : extractEhRoomsFromEvents(state.events || [])
    };
  };

  const currentUser = appState.userAccounts?.find(user => user.id === currentUserId) || null;
  const can = (permission: AccessPermission) => hasPermission(currentUser, permission);
  const isAdmin = currentUser?.role === 'ADMIN';
  const currentEmployeeId = currentUser
    ? (currentUser.linkedEmployeeId || appState.employees.find(emp => normalizePhone(emp.phone) === normalizePhone(currentUser.phone))?.id)
    : undefined;
  const canViewLogs = can('LOGS_VIEW');
  const canViewDashboard = can('DASHBOARD_VIEW');
  const canViewInventory = can('INVENTORY_VIEW');
  const canViewStocktake = canViewInventory;
  const canViewPackages = can('PACKAGES_VIEW');
  const canViewQuotations = can('QUOTATIONS_VIEW');
  const canViewSales = can('SALES_VIEW');
  const canViewEvents = can('EVENTS_VIEW');
  const canViewElearning = can('ELEARNING_VIEW');
  const canViewEducation = can('EDUCATION_VIEW');
  const canViewInteractiveDevices = can('INTERACTIVE_DEVICES_VIEW');
  const canViewEmployeeDirectory = can('EMPLOYEES_VIEW');
  const canViewEmployees = canViewEmployeeDirectory || Boolean(currentEmployeeId);
  const isElearningAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER';
  const firstAccessibleTab: AppTab =
    (canViewDashboard && 'dashboard') ||
    (canViewEvents && 'events') ||
    (canViewEducation && 'education') ||
    (canViewInteractiveDevices && 'interactiveDevices') ||
    (canViewInventory && 'inventory') ||
    (canViewStocktake && 'stocktake') ||
    (canViewPackages && 'packages') ||
    (canViewQuotations && 'quotations') ||
    (canViewSales && 'sales') ||
    (canViewEmployees && 'employees') ||
    (canViewElearning && 'elearning') ||
    (canViewLogs && 'logs') ||
    'dashboard';

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (!currentUser) {
      setLearningProfilesState([]);
      setLearningAttemptsState([]);
      return;
    }

    const startLearningSync = async () => {
      try {
        await initializeAuth();
        unsubscribe = subscribeToLearningUserState(currentUser.id, (data) => {
          const nextProfile = buildLearningProfileForUser(currentUser, appState.employees, data?.profile || null);
          const nextAttempts = Array.isArray(data?.attempts) ? data.attempts : [];

          setLearningProfilesState([nextProfile]);
          setLearningAttemptsState(nextAttempts);
        });
      } catch (error) {
        console.error('Failed to subscribe learning user state:', error);
        setLearningProfilesState([buildLearningProfileForUser(currentUser, appState.employees)]);
        setLearningAttemptsState([]);
      }
    };

    void startLearningSync();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser?.id, currentUser?.name, currentUser?.linkedEmployeeId, appState.employees]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const startLearningUsersSync = async () => {
      try {
        await initializeAuth();
        unsubscribe = subscribeToLearningUsers((users) => {
          const nextProfiles = (users || [])
            .map((entry: any) => {
              const attempts = Array.isArray(entry?.attempts) ? entry.attempts : [];
              const profile = entry?.profile || {};
              const totalScore = typeof profile.totalScore === 'number'
                ? profile.totalScore
                : attempts.reduce((sum: number, item: LearningAttempt) => sum + (item.score || 0), 0);

              return {
                ...profile,
                id: profile.id || `learning-user-${entry.userId || entry.id}`,
                userAccountId: profile.userAccountId || entry.userId || entry.id,
                userName: profile.userName || entry.userName || profile.name || 'Người dùng',
                name: profile.name || entry.userName || 'Người dùng',
                totalScore
              } as LearningProfile;
            })
            .filter(profile => profile.name || profile.userName);

          const nextAttempts = (users || []).flatMap((entry: any) =>
            Array.isArray(entry?.attempts) ? entry.attempts : []
          );

          setLearningTeamProfilesState(nextProfiles);
          setLearningTeamAttemptsState(nextAttempts);
          setLearningLeaderboardProfiles(nextProfiles);
        });
      } catch (error) {
        console.error('Failed to subscribe learning users:', error);
        setLearningTeamProfilesState([]);
        setLearningTeamAttemptsState([]);
        setLearningLeaderboardProfiles([]);
      }
    };

    void startLearningUsersSync();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    const tabAccessMap: Record<AppTab, boolean> = {
      dashboard: canViewDashboard,
      inventory: canViewInventory,
      stocktake: canViewStocktake,
      events: canViewEvents,
      education: canViewEducation,
      interactiveDevices: canViewInteractiveDevices,
      packages: canViewPackages,
      employees: canViewEmployees,
      quotations: canViewQuotations,
      sales: canViewSales,
      elearning: canViewElearning,
      logs: canViewLogs
    };

    if (!tabAccessMap[activeTab] && activeTab !== firstAccessibleTab) {
      setActiveTab(firstAccessibleTab);
    }
  }, [
    activeTab,
    canViewDashboard,
    canViewEmployees,
    canViewInventory,
    canViewStocktake,
    canViewEvents,
    canViewEducation,
    canViewInteractiveDevices,
    canViewPackages,
    canViewQuotations,
    canViewSales,
    canViewElearning,
    canViewLogs,
    firstAccessibleTab
  ]);

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

  // Khởi tạo mô hình dữ liệu mới theo collection.
  // Dữ liệu vận hành chỉ tải một lần khi mở app để tránh snapshot realtime cũ ghi đè thao tác đang nhập.
  // Elearning vẫn có realtime riêng theo user ở các effect phía trên.
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        setIsLoading(true);
        await initializeAuth();

        const seedState = stripLearningUserData(withDefaults(createInitialAppState()));
        await ensureCollectionModelInitialized(seedState);

        const collectionState = await loadCollectionState();
        if (cancelled) return;

        const loadedState = {
          ...seedState,
          ...collectionState
        } as AppState;
        const shouldMigrateAgenda = hasLegacyHouseOperationAgendaInState(collectionState)
          || hasLegacyInteractiveDeviceAgendaCopyInState(collectionState);
        const nextState = withDefaults(loadedState);
        const persistedNextState = stripLearningUserData(nextState);

        isApplyingRemoteRef.current = !shouldMigrateAgenda;
        lastPersistedStateRef.current = shouldMigrateAgenda
          ? stripLearningUserData(buildAgendaMigrationBaseline(nextState, collectionState))
          : persistedNextState;
        setAppState(nextState);
      } catch (error) {
        console.error('Failed to load collection-based data from Firebase:', error);
        try {
          const raw = localStorage.getItem('ebus_app_state');
          if (raw) {
            const rawState = JSON.parse(raw) as AppState;
            const parsed = withDefaults(rawState);
            const shouldMigrateAgenda = hasLegacyHouseOperationAgendaInState(rawState)
              || hasLegacyInteractiveDeviceAgendaCopyInState(rawState);
            isApplyingRemoteRef.current = !shouldMigrateAgenda;
            lastPersistedStateRef.current = shouldMigrateAgenda
              ? stripLearningUserData(buildAgendaMigrationBaseline(parsed, rawState))
              : stripLearningUserData(parsed);
            setAppState(parsed);
          }
        } catch (err) {
          console.warn('Failed to parse stored app state', err);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      cancelled = true;
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

  // Máy phát thanh cần nhận lịch LIVE mới ngay cả khi đã mở sẵn phiên đăng nhập.
  // Chỉ realtime collection events trong tab Thiết bị tương tác để không ảnh hưởng các màn đang nhập liệu.
  useEffect(() => {
    if (activeTab !== 'interactiveDevices' || isPublicLiveMode) return;

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    const startEventsListener = async () => {
      try {
        await initializeAuth();
        if (cancelled) return;
        unsubscribe = subscribeToCollectionState('events', (events) => {
          isApplyingRemoteRef.current = true;
          setAppState(prev => {
            const nextState = withDefaults({ ...prev, events } as AppState);
            lastPersistedStateRef.current = stripLearningUserData(nextState);
            return nextState;
          });
        });
      } catch (err) {
        console.error('Failed to subscribe events for broadcast refresh:', err);
      }
    };

    void startEventsListener();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [activeTab, isPublicLiveMode]);

  // Lưu dữ liệu theo từng collection để tránh ghi đè toàn bộ appState.
  // Gom các thay đổi nhanh và lưu tuần tự để chính phiên hiện tại không tự tạo conflict.
  useEffect(() => {
    if (isLoading) return;

    const flushPersistQueue = async () => {
      if (persistInFlightRef.current) return;
      persistInFlightRef.current = true;
      try {
        while (pendingPersistStateRef.current) {
          const persistentAppState = pendingPersistStateRef.current;
          pendingPersistStateRef.current = null;
          let shouldKeepRemoteFlag = false;
          try {
            const result = await syncCollectionStateDiff(
              lastPersistedStateRef.current,
              persistentAppState,
              resolveActor()
            );
            lastPersistedStateRef.current = stripLearningUserData(withDefaults({
              ...persistentAppState,
              ...result.nextState
            } as AppState));

            if (result.conflicts.length > 0 && Object.keys(result.remoteOverrides).length > 0) {
              const notice = result.conflicts.map(conflict => `${conflict.key}:${conflict.id}`).join(', ');
              if (lastConflictNoticeRef.current !== notice) {
                lastConflictNoticeRef.current = notice;
                alert('Một số dữ liệu đã được người khác cập nhật trước bạn. Hệ thống đã nạp lại bản mới nhất để tránh ghi đè.');
              }
              isApplyingRemoteRef.current = true;
              shouldKeepRemoteFlag = true;
              setAppState(prev => withDefaults({ ...prev, ...result.remoteOverrides } as AppState));
            } else {
              lastConflictNoticeRef.current = '';
            }
          } catch (err) {
            console.warn('Failed to persist app state:', err);
          } finally {
            if (isApplyingRemoteRef.current && !shouldKeepRemoteFlag) {
              isApplyingRemoteRef.current = false;
            }
          }
        }
      } finally {
        persistInFlightRef.current = false;
        if (pendingPersistStateRef.current) {
          void flushPersistQueue();
        }
      }
    };

    const timestamp = new Date().toISOString();
    const persistentAppState = stripLearningUserData(withDefaults(appState));
    try {
      localStorage.setItem('ebus_app_state', JSON.stringify(persistentAppState));
      localStorage.setItem('ebus_last_update', timestamp);

      if (isApplyingRemoteRef.current) {
        isApplyingRemoteRef.current = false;
        return;
      }

      pendingPersistStateRef.current = persistentAppState;
      if (persistDebounceRef.current) {
        window.clearTimeout(persistDebounceRef.current);
      }
      persistDebounceRef.current = window.setTimeout(() => {
        void flushPersistQueue();
      }, 250);
    } catch (err) {
      console.warn('Failed to persist app state:', err);
    }

    return () => {
      if (persistDebounceRef.current) {
        window.clearTimeout(persistDebounceRef.current);
        persistDebounceRef.current = undefined;
      }
    };
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

  const persistLearningUserData = async (profile: LearningProfile, attempts: LearningAttempt[]) => {
    if (!currentUser) return;
    const normalizedProfile = buildLearningProfileForUser(currentUser, appState.employees, {
      ...profile,
      totalScore: attempts.reduce((sum, item) => sum + item.score, 0)
    });

    await saveLearningUserState(currentUser.id, {
      userName: currentUser.name,
      profile: normalizedProfile,
      attempts
    });
  };

  const handleSubmitLearningAttempts = (submittedAttempts: LearningAttempt[], profile: LearningProfile) => {
    if (!currentUser || submittedAttempts.length === 0) return;

    const normalizedProfile = buildLearningProfileForUser(currentUser, appState.employees, profile);
    setLearningProfilesState([normalizedProfile]);
    setLearningAttemptsState(prev => {
      const submittedKeys = new Set(
        submittedAttempts.map(attempt => `${attempt.learnerId}::${attempt.lessonId}::${attempt.questionId}`)
      );
      const filtered = prev.filter(a => !submittedKeys.has(`${a.learnerId}::${a.lessonId}::${a.questionId}`));
      const updatedAttempts = [...submittedAttempts, ...filtered];
      void persistLearningUserData(normalizedProfile, updatedAttempts);

      return updatedAttempts;
    });
    addLog(
      `Học viên ${submittedAttempts[0].learnerId} nộp bài ${submittedAttempts[0].lessonId} (${submittedAttempts.length} câu hỏi)`,
      'INFO'
    );
  };

  const handleUpsertLearningProfile = (profile: LearningProfile) => {
    if (!currentUser) return;
    const normalizedProfile = buildLearningProfileForUser(currentUser, appState.employees, profile);
    setLearningProfilesState([normalizedProfile]);
    void persistLearningUserData(normalizedProfile, learningAttemptsState);
    addLog(`Cập nhật hồ sơ Elearning cho ${profile.name}`, 'SUCCESS');
  };

  const handleUpdateLearningTracks = (updatedTracks: LearningTrack[]) => {
    setAppState(prev => ({ ...prev, learningTracks: updatedTracks }));
    addLog('Cập nhật nội dung Elearning (khóa học/bài/ câu hỏi)', 'SUCCESS');
  };

  const handleUpdateEducationActivities = (activities: EducationActivity[]) => {
    setAppState(prev => ({ ...prev, educationActivities: activities }));
    addLog(`Cập nhật thư viện nội dung giáo dục (${activities.length} hoạt động)`, 'INFO');
  };

  const handleUpdateInteractiveDevices = (devices: InteractiveDeviceProfile[]) => {
    setAppState(prev => ({ ...prev, interactiveDevices: devices }));
    addLog('Cập nhật cấu hình Thiết bị tương tác / phát thanh trung tâm', 'INFO');
  };

  const handleUpdateEhRooms = (rooms: string[]) => {
    setAppState(prev => ({ ...prev, ehRooms: dedupeTextList(rooms) }));
    addLog(`Cập nhật danh sách phòng/khu vực EH dùng chung (${rooms.length} phòng)`, 'INFO');
  };

  const handleOpenEducationLesson = (link: EducationLessonLink) => {
    setElearningOpenRequest({ ...link, nonce: Date.now() });
    setActiveTab('elearning');
  };

  const handleDeleteLearningProfile = (profileId: string) => {
    if (!currentUser) return;
    if (learningProfilesState[0]?.id !== profileId) return;
    setLearningProfilesState([]);
    setLearningAttemptsState([]);
    void deleteLearningUserState(currentUser.id);
    addLog(`Đã xóa hồ sơ Elearning ${profileId}`, 'WARNING');
  };

  const handleGrantLearningRetake = async (targetUserId: string, lessonId: string) => {
    if (!currentUser || currentUser.role !== 'ADMIN') return;

    const targetAccount = (appState.userAccounts || []).find(account => account.id === targetUserId);
    if (!targetAccount) {
      alert('Không tìm thấy tài khoản nhân sự để cấp quyền làm lại.');
      return;
    }

    const existingProfile =
      learningTeamProfilesState.find(profile => profile.userAccountId === targetUserId || profile.id === `learning-user-${targetUserId}`) ||
      null;
    const baseProfile = buildLearningProfileForUser(targetAccount, appState.employees, existingProfile);
    const targetAttempts = learningTeamAttemptsState.filter(attempt => attempt.learnerId === baseProfile.id);
    const currentAllowance = baseProfile.retakePermissions?.[lessonId] || 0;
    const updatedProfile = buildLearningProfileForUser(targetAccount, appState.employees, {
      ...baseProfile,
      retakePermissions: {
        ...(baseProfile.retakePermissions || {}),
        [lessonId]: currentAllowance + 1
      }
    });

    try {
      await saveLearningUserState(targetUserId, {
        userName: targetAccount.name,
        profile: updatedProfile,
        attempts: targetAttempts
      });

      setLearningTeamProfilesState(prev => {
        const exists = prev.some(profile => profile.userAccountId === targetUserId || profile.id === updatedProfile.id);
        if (!exists) return [...prev, updatedProfile];
        return prev.map(profile =>
          profile.userAccountId === targetUserId || profile.id === updatedProfile.id
            ? updatedProfile
            : profile
        );
      });

      if (currentUser.id === targetUserId) {
        setLearningProfilesState([updatedProfile]);
      }

      addLog(`ADMIN cấp quyền làm lại bài kiểm tra ${lessonId} cho ${targetAccount.name}`, 'SUCCESS');
    } catch (error) {
      console.error('Failed to grant learning retake permission:', error);
      alert('Không thể cấp quyền làm lại lúc này. Vui lòng thử lại.');
    }
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
            const lifecycle = inv.lifecycle === 'CONSUMABLE' ? 'CONSUMABLE' : 'DEPRECIATION';
            const nextUsage = payload.direction === 'OUT'
              ? (lifecycle === 'DEPRECIATION' ? (inv.usageCount || 0) + qty : inv.usageCount || 0)
              : inv.usageCount || 0;
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
    const itemWithBarcode = normalizeInventoryLifecycle(ensureItemBarcode(updatedItem));
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
    const itemWithBarcode = normalizeInventoryLifecycle(ensureItemBarcode(item));
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
      const mode: InventoryReceiptItem['mode'] = item.mode === 'EXISTING' ? 'EXISTING' : item.mode === 'PLANNED' ? 'PLANNED' : 'NEW';
      const quantity = Math.max(mode === 'PLANNED' ? 0 : 1, Math.round(item.quantity || 0));
      const lifecycle = item.lifecycle === 'CONSUMABLE' ? 'CONSUMABLE' : 'DEPRECIATION';
      const consumableUnit = (item.consumableUnit || '').trim();
      const maxUsage = lifecycle === 'DEPRECIATION' ? Number(item.maxUsage) || 0 : undefined;
      return {
        ...item,
        mode,
        quantity,
        lifecycle,
        consumableUnit: consumableUnit || undefined,
        maxUsage: lifecycle === 'DEPRECIATION' ? maxUsage : undefined,
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
        const lifecycle = item.lifecycle === 'CONSUMABLE' ? 'CONSUMABLE' : 'DEPRECIATION';
        const consumableUnit = (item.consumableUnit || '').trim();
        const maxUsage = lifecycle === 'DEPRECIATION' ? Math.max(0, Math.round(item.maxUsage || 0)) : undefined;

        if (lifecycle === 'DEPRECIATION' && (!maxUsage || maxUsage <= 0)) {
          error = `Thiếu số lần sử dụng tối đa cho dòng ${idx + 1}.`;
          return;
        }
        if (lifecycle === 'CONSUMABLE' && !consumableUnit) {
          error = `Thiếu đơn vị tính cho dòng ${idx + 1}.`;
          return;
        }

        if (item.mode === 'EXISTING' && item.itemId) {
          const foundIdx = nextInventory.findIndex(inv => inv.id === item.itemId);
          if (foundIdx === -1) {
            error = `Không tìm thấy thiết bị cho dòng ${idx + 1}.`;
            return;
          }
          const target = nextInventory[foundIdx];
          const mergedLifecycle = target.lifecycle || lifecycle;
          const resolvedMaxUsage = mergedLifecycle === 'DEPRECIATION'
            ? (typeof target.maxUsage === 'number' && target.maxUsage > 0 ? target.maxUsage : maxUsage)
            : undefined;
          const resolvedUnit = mergedLifecycle === 'CONSUMABLE'
            ? (target.consumableUnit || consumableUnit || undefined)
            : undefined;
          const updated: InventoryItem = normalizeInventoryLifecycle({
            ...target,
            lifecycle: mergedLifecycle,
            consumableUnit: resolvedUnit,
            maxUsage: resolvedMaxUsage,
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
          });
          nextInventory[foundIdx] = updated;
          receiptItems.push({
            ...item,
            mode: 'EXISTING',
            lifecycle: mergedLifecycle,
            consumableUnit: resolvedUnit,
            maxUsage: resolvedMaxUsage,
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
          const plannedItem: InventoryItem = normalizeInventoryLifecycle({
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
            plannedEta: item.plannedEta || '',
            lifecycle,
            consumableUnit: lifecycle === 'CONSUMABLE' ? consumableUnit : undefined,
            maxUsage: lifecycle === 'DEPRECIATION' ? maxUsage : undefined
          });
          nextInventory.push(plannedItem);
          receiptItems.push({
            ...item,
            mode: 'PLANNED',
            lifecycle,
            consumableUnit: plannedItem.consumableUnit,
            maxUsage: plannedItem.maxUsage,
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
          const newItem: InventoryItem = normalizeInventoryLifecycle({
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
            plannedEta: '',
            lifecycle,
            consumableUnit: lifecycle === 'CONSUMABLE' ? consumableUnit : undefined,
            maxUsage: lifecycle === 'DEPRECIATION' ? maxUsage : undefined
          });
          nextInventory.push(newItem);
          receiptItems.push({
            ...item,
            mode: 'NEW',
            lifecycle,
            consumableUnit: newItem.consumableUnit,
            maxUsage: newItem.maxUsage,
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

  const handleSaveInventoryAudit = (payload: {
    title: string;
    baseline: InventoryAuditBaseline;
    note?: string;
    items: InventoryAuditItem[];
    unknownBarcodes?: string[];
    summary: InventoryAuditSession['summary'];
  }) => {
    const countedItems = (payload.items || []).filter(item => item.countedQuantity !== null);
    if (countedItems.length === 0) {
      alert('Vui lòng kiểm ít nhất 1 mã hàng trước khi lưu phiên.');
      return;
    }

    const audit: InventoryAuditSession = {
      id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: `KK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      title: payload.title.trim() || `Kiểm kho ${new Date().toLocaleDateString('vi-VN')}`,
      baseline: payload.baseline,
      note: payload.note?.trim(),
      createdBy: resolveActor(),
      items: payload.items,
      unknownBarcodes: payload.unknownBarcodes || [],
      summary: payload.summary
    };

    setAppState(prev => ({
      ...prev,
      inventoryAudits: [audit, ...(prev.inventoryAudits || [])].slice(0, 120)
    }));
    addLog(`Lưu phiên kiểm kho ${audit.code}: ${audit.summary.countedItems}/${audit.summary.totalItems} mã, ${audit.summary.varianceItems} mã lệch.`, audit.summary.varianceItems > 0 ? 'WARNING' : 'SUCCESS');
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

  const handleSyncDoneItemsToChecklist = (eventId: string) => {
    let eventName = '';
    let syncedCount = 0;

    setAppState(prev => {
      const event = prev.events.find(e => e.id === eventId);
      if (!event) return prev;

      const doneItems = event.items.filter(item => item.done && item.quantity > 0);
      if (doneItems.length === 0) return prev;

      eventName = event.name;
      const checklist = normalizeChecklist(event.checklist);
      const outbound = { ...checklist.outbound };
      const timestamp = new Date().toISOString();
      const logs = [...checklist.logs];

      doneItems.forEach(allocation => {
        const targetQty = Math.max(0, Math.round(allocation.quantity || 0));
        if (targetQty <= 0 || outbound[allocation.itemId] === targetQty) return;

        const inventoryItem = prev.inventory.find(item => item.id === allocation.itemId);
        outbound[allocation.itemId] = targetQty;
        syncedCount += 1;
        logs.unshift({
          id: `sync-done-${Date.now()}-${allocation.itemId}-${Math.random().toString(36).slice(2, 6)}`,
          itemId: allocation.itemId,
          itemName: inventoryItem?.name,
          barcode: inventoryItem?.barcode,
          direction: 'OUT',
          status: 'OK',
          quantity: targetQty,
          note: 'Đồng bộ từ tick Đã xong trong Order Thiết Bị',
          timestamp
        });
      });

      if (syncedCount === 0) return prev;

      return {
        ...prev,
        events: prev.events.map(e => e.id !== eventId ? e : {
          ...e,
          checklist: {
            ...checklist,
            outbound,
            logs: logs.slice(0, 50)
          }
        })
      };
    });

    if (syncedCount > 0) {
      addLog(`Đồng bộ ${syncedCount} thiết bị đã tick xong sang Checklist Barcode cho sự kiện "${eventName}".`, 'INFO');
    }
  };

  const handleToggleEventStaffDone = (eventId: string, employeeId: string, done: boolean, staffKey?: string) => {
    setAppState(prev => ({
      ...prev,
      events: prev.events.map(e => e.id !== eventId ? e : {
        ...e,
        staff: (e.staff || []).map((s, index) => {
          const fallbackKey = getEventStaffAllocationKey(s, index);
          const keyMatch = staffKey ? s.id === staffKey || s.autoKey === staffKey || fallbackKey === staffKey : false;
          const legacyMatch = !staffKey && s.employeeId === employeeId;
          return keyMatch || legacyMatch ? { ...s, done } : s;
        })
      })
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

  // --- Handlers cho Sự kiện (Full Logic) ---
  const handleCreateEvent = (event: Event) => {
    const eventWithChecklist: Event = { ...event, checklist: normalizeChecklist(event.checklist) };
    setAppState(prev => ({ ...prev, events: [...prev.events, eventWithChecklist] }));
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

  const handleRegisterEventStaff = (eventId: string, action: 'REGISTER' | 'CANCEL') => {
    if (!currentUser) {
      alert('Vui lòng đăng nhập để đăng ký sự kiện.');
      return;
    }
    const employeeId = currentEmployeeId;
    const employee = employeeId ? appState.employees.find(emp => emp.id === employeeId) : undefined;
    if (!employeeId || !employee) {
      alert('Tài khoản của bạn chưa được liên kết với hồ sơ nhân sự. Vui lòng báo ADMIN cập nhật liên kết nhân sự.');
      return;
    }

    const timestamp = new Date().toISOString();
    setAppState(prev => ({
      ...prev,
      events: prev.events.map(event => {
        if (event.id !== eventId) return event;
        const registrations = event.staffRegistrations || [];
        const existing = registrations.find(item => item.employeeId === employeeId || item.userId === currentUser.id);
        if (action === 'CANCEL') {
          return {
            ...event,
            staffRegistrations: registrations.filter(item => item.employeeId !== employeeId && item.userId !== currentUser.id)
          };
        }

        const registration: EventStaffRegistration = {
          id: existing?.id || `event-staff-reg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          employeeId,
          userId: currentUser.id,
          name: employee.name || currentUser.name,
          role: employee.role,
          phone: employee.phone || currentUser.phone,
          note: existing?.note,
          status: 'REGISTERED',
          createdAt: existing?.createdAt || timestamp,
          updatedAt: timestamp
        };

        return {
          ...event,
          staffRegistrations: existing
            ? registrations.map(item => item.id === existing.id ? registration : item)
            : [...registrations, registration]
        };
      })
    }));
    addLog(`${action === 'REGISTER' ? 'Đăng ký' : 'Hủy đăng ký'} nhân sự sự kiện ${eventId}: ${employee.name}`, action === 'REGISTER' ? 'SUCCESS' : 'INFO');
  };

  const handleRemoveStaff = (eventId: string, employeeId: string, staffKey?: string) => {
    setAppState(prev => ({
      ...prev,
      events: prev.events.map(e => e.id !== eventId ? e : {
        ...e,
        staff: (e.staff || []).filter((s, index) => {
          const fallbackKey = getEventStaffAllocationKey(s, index);
          const keyMatch = staffKey ? s.id === staffKey || s.autoKey === staffKey || fallbackKey === staffKey : false;
          const legacyMatch = !staffKey && s.employeeId === employeeId;
          return !(keyMatch || legacyMatch);
        })
      })
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

  if (isPublicLiveMode) {
    const publicSourceEvent = appState.events.find(event => event.id === publicLiveEventId);
    const publicEvent = publicSourceEvent ? getPublicProgramEvent(publicSourceEvent, publicLiveProgramId) : undefined;
    const publicLiveEvents = publicSourceEvent && publicEvent
      ? getPublicLiveEvents(appState.events, publicEvent, publicSourceEvent, publicLiveProgramId)
      : [];
    return (
      <div className="min-h-screen bg-slate-50 p-3 md:p-4">
        {isLoading ? (
          <div className="min-h-[70vh] flex items-center justify-center text-slate-600 font-bold">Đang tải LIVE...</div>
        ) : publicEvent ? (
          <EinsteinHouseOS
            events={publicLiveEvents.length > 0 ? publicLiveEvents : [publicEvent]}
          inventory={appState.inventory}
          employees={appState.employees}
          packages={appState.packages}
          sharedEhRooms={appState.ehRooms || []}
          educationActivities={appState.educationActivities || []}
          canEdit={false}
          liveOnly
          publicMode
            initialEventId={publicLiveEventId}
          liveProgramId={publicLiveProgramId || undefined}
          onUpdateEvent={() => undefined}
          onUpdateSharedEhRooms={() => undefined}
          />
        ) : (
          <div className="min-h-[70vh] flex items-center justify-center">
            <div className="bg-white border border-slate-200 rounded-lg p-6 text-center">
              <h1 className="text-xl font-black text-slate-900">Không tìm thấy LIVE</h1>
              <p className="mt-2 text-sm text-slate-500">Link sự kiện không tồn tại hoặc dữ liệu chưa được cấp quyền xem.</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
    <Layout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      logs={appState.logs}
      currentUser={currentUser}
      canManageAccess={can('ACCESS_MANAGE')}
      canViewLogs={canViewLogs}
      canViewDashboard={canViewDashboard}
      canViewInventory={canViewInventory}
      canViewStocktake={canViewStocktake}
      canViewPackages={canViewPackages}
      canViewQuotations={canViewQuotations}
      canViewSales={canViewSales}
      canViewEvents={canViewEvents}
      canViewEducation={canViewEducation}
      canViewInteractiveDevices={canViewInteractiveDevices}
      canViewElearning={canViewElearning}
      canViewEmployees={canViewEmployees}
      onOpenAccess={() => setIsAccessOpen(true)}
      onLogout={handleLogout}
    >
      {activeTab === 'dashboard' && canViewDashboard && <Dashboard appState={appState} />}
      {activeTab === 'inventory' && canViewInventory && (
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
          isAdmin={isAdmin}
        />
      )}
      {activeTab === 'stocktake' && canViewStocktake && (
        <StocktakeManager
          inventory={appState.inventory}
          audits={appState.inventoryAudits || []}
          onSaveAudit={guard('INVENTORY_EDIT', handleSaveInventoryAudit)}
          canEdit={can('INVENTORY_EDIT')}
        />
      )}
      {activeTab === 'packages' && canViewPackages && (
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
      {activeTab === 'employees' && canViewEmployees && (
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
          currentEmployeeId={currentEmployeeId}
          selfServiceOnly={!canViewEmployeeDirectory}
        />
      )}
      {activeTab === 'quotations' && canViewQuotations && (
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
      {activeTab === 'sales' && canViewSales && (
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
      {activeTab === 'education' && canViewEducation && (
        <EducationContentManager
          activities={appState.educationActivities || []}
          inventory={appState.inventory}
          packages={appState.packages}
          learningTracks={appState.learningTracks || []}
          canEdit={can('EDUCATION_EDIT')}
          onUpdateActivities={guard('EDUCATION_EDIT', handleUpdateEducationActivities)}
          onOpenLesson={handleOpenEducationLesson}
        />
      )}
      {activeTab === 'interactiveDevices' && canViewInteractiveDevices && (
        <InteractiveDeviceManager
          devices={appState.interactiveDevices || []}
          events={appState.events}
          canEdit={can('INTERACTIVE_DEVICES_EDIT')}
          onUpdateDevices={guard('INTERACTIVE_DEVICES_EDIT', handleUpdateInteractiveDevices)}
        />
      )}
      {activeTab === 'elearning' && canViewElearning && (
        <Elearning
          tracks={appState.learningTracks || []}
          profiles={learningProfilesState}
          attempts={learningAttemptsState}
          accounts={appState.userAccounts || []}
          teamProfiles={learningTeamProfilesState}
          teamAttempts={learningTeamAttemptsState}
          leaderboardProfiles={learningLeaderboardProfiles}
          ranks={appState.careerRanks || []}
          employees={appState.employees}
          events={appState.events}
          onSubmitAttempts={guard('ELEARNING_EDIT', handleSubmitLearningAttempts)}
          onUpsertProfile={guard('ELEARNING_EDIT', handleUpsertLearningProfile)}
          onUpdateTracks={guard('ELEARNING_EDIT', handleUpdateLearningTracks)}
          onDeleteProfile={guard('ELEARNING_EDIT', handleDeleteLearningProfile)}
          onGrantRetake={handleGrantLearningRetake}
          canEdit={can('ELEARNING_EDIT')}
          isAdminView={isElearningAdmin}
          canViewTeamProgress={isElearningAdmin}
          canManageRetakes={currentUser?.role === 'ADMIN'}
          currentUserId={currentUser?.id}
          currentUserName={currentUser?.name}
          currentEmployeeId={currentEmployeeId}
          openLessonRequest={elearningOpenRequest}
        />
      )}
      {activeTab === 'logs' && canViewLogs && (
        <AdminLogPage logs={appState.logs} accounts={appState.userAccounts || []} activeSessions={activeSessions} />
      )}
      {activeTab === 'events' && canViewEvents && (
        <EventManager
          events={appState.events}
          inventory={appState.inventory}
          packages={appState.packages}
          employees={appState.employees}
          quotations={appState.quotations}
          saleOrders={appState.saleOrders || []}
          sharedEhRooms={appState.ehRooms || []}
          educationActivities={appState.educationActivities || []}
          learningTracks={appState.learningTracks || []}
          currentUserId={currentUser?.id}
          currentUserName={currentUser?.name}
          currentEmployeeId={currentEmployeeId}
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
          onSyncDoneItemsToChecklist={guard('EVENTS_EDIT', handleSyncDoneItemsToChecklist)}
          onToggleStaffDone={guard('EVENTS_EDIT', handleToggleEventStaffDone)}
          onUpdateEvent={guard('EVENTS_EDIT', handleUpdateEvent)}
          onUpdateSharedEhRooms={guard('EVENTS_EDIT', handleUpdateEhRooms)}
          onRegisterStaff={handleRegisterEventStaff}
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
    
    {isLoading && !currentUser && (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: '#2563eb', zIndex: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', color: 'white', textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid white', borderTop: '4px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <div>
            <p style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Vui lòng chờ...</p>
            <p style={{ fontSize: '14px', margin: '4px 0 0 0' }}>Đang tải dữ liệu từ hệ thống</p>
          </div>
        </div>
      </div>
    )}
    
    <LoginModal
      isOpen={!currentUser}
      isLoading={isLoading}
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
