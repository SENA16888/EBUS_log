import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, deleteDoc, onSnapshot, Unsubscribe, runTransaction, writeBatch } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { AppState, LogEntry } from '../types';

// Helper to safely get environment variables (same pattern as geminiService)
const getEnvVar = (key: string): string | undefined => {
  return (import.meta as { env?: Record<string, string | undefined> }).env?.[key];
};

// ⚠️ Thay thế với thông tin Firebase của bạn (tìm trong Firebase Console)
const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY') || 'AIzaSyDummyKeyForTesting',
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN') || 'ebus-log.firebaseapp.com',
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID') || 'ebus-log',
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET') || 'ebus-log.appspot.com',
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID') || '123456789',
  appId: getEnvVar('VITE_FIREBASE_APP_ID') || '1:123456789:web:abcdef1234567890',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

type PersistedActor = {
  id?: string;
  name?: string;
  role?: string;
  phone?: string;
};

export const PERSISTED_STATE_KEYS = [
  'inventory',
  'events',
  'transactions',
  'packages',
  'employees',
  'quotations',
  'saleItems',
  'saleOrders',
  'logs',
  'inventoryReceipts',
  'learningTracks',
  'careerRanks',
  'userAccounts',
  'payrollAdjustments'
] as const;

export type PersistedStateKey = typeof PERSISTED_STATE_KEYS[number];

const PERSISTED_COLLECTIONS: Record<PersistedStateKey, string> = {
  inventory: 'inventoryItems',
  events: 'events',
  transactions: 'transactions',
  packages: 'packages',
  employees: 'employees',
  quotations: 'quotations',
  saleItems: 'saleItems',
  saleOrders: 'saleOrders',
  logs: 'auditLogs',
  inventoryReceipts: 'inventoryReceipts',
  learningTracks: 'learningTracks',
  careerRanks: 'careerRanks',
  userAccounts: 'userAccounts',
  payrollAdjustments: 'payrollAdjustments'
};

const COLLECTION_MODEL_META_PATH = ['systemMeta', 'collectionModel'] as const;

// Convert state to Firestore-safe JSON (removes undefined, serializes Date)
const serializeForFirestore = (input: any) => {
  try {
    return JSON.parse(JSON.stringify(input, (_key, value) => {
      if (value === undefined) return null;
      if (value instanceof Date) return value.toISOString();
      return value;
    }));
  } catch (err) {
    console.warn('serializeForFirestore failed, returning original object', err);
    return input;
  }
};

const stripSyncMeta = (input: any) => {
  if (Array.isArray(input)) {
    return input.map(stripSyncMeta);
  }
  if (input instanceof Date) {
    return input.toISOString();
  }
  if (input && typeof input === 'object') {
    const next: Record<string, any> = {};
    Object.entries(input).forEach(([key, value]) => {
      if (key === 'version' || key === 'updatedAt' || key === 'updatedBy') return;
      next[key] = stripSyncMeta(value);
    });
    return next;
  }
  return input;
};

const isSameEntityContent = (left: any, right: any) =>
  JSON.stringify(serializeForFirestore(stripSyncMeta(left))) === JSON.stringify(serializeForFirestore(stripSyncMeta(right)));

const getCollectionName = (key: PersistedStateKey) => PERSISTED_COLLECTIONS[key];

const getCollectionDocRef = (key: PersistedStateKey, id: string) => doc(db, getCollectionName(key), id);

const hydratePersistedRecord = <T>(key: PersistedStateKey, id: string, raw: Record<string, any>): T => {
  const withId = { id, ...raw } as Record<string, any>;
  if (key === 'logs') {
    return {
      ...withId,
      timestamp: withId.timestamp ? new Date(withId.timestamp) : new Date()
    } as T;
  }
  return withId as T;
};

const sortPersistedRecords = <T>(key: PersistedStateKey, rows: T[]): T[] => {
  if (key === 'logs') {
    return [...rows].sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
  if (key === 'inventoryReceipts') {
    return [...rows].sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }
  return rows;
};

const buildVersionedRecord = (entity: any, actor?: PersistedActor | null, nextVersion = 1) => {
  const base = serializeForFirestore(stripSyncMeta(entity));
  return {
    ...base,
    version: nextVersion,
    updatedAt: new Date().toISOString(),
    updatedBy: actor || null
  };
};

type VersionedWriteResult<T> =
  | { status: 'saved'; doc: T }
  | { status: 'deleted' }
  | { status: 'conflict'; remoteDoc?: T };

const writeVersionedRecord = async <T extends { id: string }>(
  key: PersistedStateKey,
  entity: T,
  expectedVersion: number,
  actor?: PersistedActor | null
): Promise<VersionedWriteResult<T>> => {
  await initializeAuth();
  const ref = getCollectionDocRef(key, entity.id);
  try {
    const saved = await runTransaction(db, async transaction => {
      const snap = await transaction.get(ref);
      const remoteVersion = snap.exists() ? Number((snap.data() as any).version || 0) : 0;

      if (!snap.exists()) {
        if (expectedVersion > 0) {
          const err = new Error('VERSION_CONFLICT');
          (err as any).remoteDoc = undefined;
          throw err;
        }
        const nextDoc = buildVersionedRecord(entity, actor, 1);
        transaction.set(ref, nextDoc);
        return hydratePersistedRecord<T>(key, entity.id, nextDoc);
      }

      if (remoteVersion !== expectedVersion) {
        const err = new Error('VERSION_CONFLICT');
        (err as any).remoteDoc = hydratePersistedRecord<T>(key, entity.id, snap.data() as Record<string, any>);
        throw err;
      }

      const nextDoc = buildVersionedRecord(entity, actor, remoteVersion + 1);
      transaction.set(ref, nextDoc);
      return hydratePersistedRecord<T>(key, entity.id, nextDoc);
    });
    return { status: 'saved', doc: saved };
  } catch (error) {
    if ((error as Error).message === 'VERSION_CONFLICT') {
      return { status: 'conflict', remoteDoc: (error as any).remoteDoc };
    }
    throw error;
  }
};

const deleteVersionedRecord = async <T extends { id: string }>(
  key: PersistedStateKey,
  entity: T,
  expectedVersion: number
): Promise<VersionedWriteResult<T>> => {
  await initializeAuth();
  const ref = getCollectionDocRef(key, entity.id);
  try {
    const result = await runTransaction(db, async transaction => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) return { status: 'deleted' } as const;

      const remoteVersion = Number((snap.data() as any).version || 0);
      if (remoteVersion !== expectedVersion) {
        const err = new Error('VERSION_CONFLICT');
        (err as any).remoteDoc = hydratePersistedRecord<T>(key, entity.id, snap.data() as Record<string, any>);
        throw err;
      }

      transaction.delete(ref);
      return { status: 'deleted' } as const;
    });
    return result;
  } catch (error) {
    if ((error as Error).message === 'VERSION_CONFLICT') {
      return { status: 'conflict', remoteDoc: (error as any).remoteDoc };
    }
    throw error;
  }
};

const toPersistableState = (state: AppState): Partial<AppState> => {
  const next: Partial<AppState> = {};
  PERSISTED_STATE_KEYS.forEach(key => {
    (next as any)[key] = Array.isArray((state as any)[key]) ? (state as any)[key] : [];
  });
  return next;
};

const mergePersistedState = (base: Partial<AppState>, patch: Partial<AppState>): Partial<AppState> => ({
  ...base,
  ...patch
});

// Hàm để đảm bảo người dùng được xác thực (Anonymous Auth)
export const initializeAuth = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log('Firebase auth: user signed in', { uid: user.uid, isAnonymous: user.isAnonymous });
        resolve();
      } else {
        try {
          const cred = await signInAnonymously(auth);
          console.log('Firebase auth: signed in anonymously', { uid: cred.user.uid });
          resolve();
        } catch (error) {
          console.error('Auth initialization error:', error);
          reject(error);
        }
      }
      unsubscribe();
    });
  });
};

export const loadCollectionState = async (): Promise<Partial<AppState>> => {
  await initializeAuth();
  const entries = await Promise.all(
    PERSISTED_STATE_KEYS.map(async key => {
      const snap = await getDocs(collection(db, getCollectionName(key)));
      const rows = snap.docs.map(docSnap => hydratePersistedRecord<any>(key, docSnap.id, docSnap.data() as Record<string, any>));
      return [key, sortPersistedRecords(key, rows)] as const;
    })
  );

  return entries.reduce((acc, [key, rows]) => {
    (acc as any)[key] = rows;
    return acc;
  }, {} as Partial<AppState>);
};

export const subscribeToCollectionState = (
  key: PersistedStateKey,
  onChange: (rows: any[]) => void
): Unsubscribe => {
  const colRef = collection(db, getCollectionName(key));
  return onSnapshot(colRef, snap => {
    const rows = snap.docs.map(docSnap => hydratePersistedRecord<any>(key, docSnap.id, docSnap.data() as Record<string, any>));
    onChange(sortPersistedRecords(key, rows));
  }, err => {
    console.error(`Realtime listener error for ${key}:`, err);
  });
};

export const ensureCollectionModelInitialized = async (
  seedState: AppState,
  actor?: PersistedActor | null
): Promise<'collections' | 'migrated-legacy' | 'seeded-defaults'> => {
  await initializeAuth();

  const metaRef = doc(db, ...COLLECTION_MODEL_META_PATH);
  const metaSnap = await getDoc(metaRef);
  if (metaSnap.exists()) {
    return 'collections';
  }

  const existingCollectionState = await loadCollectionState();
  const hasExistingDocs = PERSISTED_STATE_KEYS.some(key => ((existingCollectionState as any)[key] || []).length > 0);
  if (hasExistingDocs) {
    await setDoc(metaRef, {
      initialized: true,
      migratedAt: new Date().toISOString(),
      source: 'existing-collections',
      updatedBy: actor || null
    }, { merge: true });
    return 'collections';
  }

  const legacyState = await loadAppState();
  const sourceState = legacyState
    ? { ...seedState, ...legacyState, learningProfiles: [], learningAttempts: [] }
    : seedState;
  const persistable = toPersistableState(sourceState);
  const batch = writeBatch(db);

  PERSISTED_STATE_KEYS.forEach(key => {
    const records = ((persistable as any)[key] || []) as Array<{ id: string }>;
    records.forEach(record => {
      const nextDoc = buildVersionedRecord(record, actor, 1);
      batch.set(getCollectionDocRef(key, record.id), nextDoc, { merge: true });
    });
  });

  batch.set(metaRef, {
    initialized: true,
    migratedAt: new Date().toISOString(),
    source: legacyState ? 'legacy-app-state' : 'seed-defaults',
    updatedBy: actor || null
  }, { merge: true });
  await batch.commit();
  return legacyState ? 'migrated-legacy' : 'seeded-defaults';
};

type PersistConflict = {
  key: PersistedStateKey;
  id: string;
};

export const syncCollectionStateDiff = async (
  previousState: Partial<AppState>,
  nextState: Partial<AppState>,
  actor?: PersistedActor | null
): Promise<{
  nextState: Partial<AppState>;
  remoteOverrides: Partial<AppState>;
  conflicts: PersistConflict[];
}> => {
  const persistedNextState = mergePersistedState(previousState, nextState);
  const remoteOverrides: Partial<AppState> = {};
  const conflicts: PersistConflict[] = [];

  for (const key of PERSISTED_STATE_KEYS) {
    const previousRows = (((previousState as any)[key] || []) as any[]).map(row => ({ ...row }));
    const currentRows = (((nextState as any)[key] || []) as any[]).map(row => ({ ...row }));

    const previousById = new Map(previousRows.map(row => [row.id, row]));
    const currentById = new Map(currentRows.map(row => [row.id, row]));
    const nextRowsById = new Map(previousRows.map(row => [row.id, row]));

    for (const currentRow of currentRows) {
      const previousRow = previousById.get(currentRow.id);
      if (previousRow && isSameEntityContent(previousRow, currentRow)) {
        nextRowsById.set(currentRow.id, previousRow);
        continue;
      }

      const expectedVersion = previousRow ? Number(previousRow.version || 0) : 0;
      const writeResult = await writeVersionedRecord<any>(key, currentRow, expectedVersion, actor);

      if (writeResult.status === 'saved') {
        nextRowsById.set(currentRow.id, writeResult.doc);
        continue;
      }

      if (writeResult.status === 'conflict') {
        conflicts.push({ key, id: currentRow.id });
        if (writeResult.remoteDoc) {
          nextRowsById.set(currentRow.id, writeResult.remoteDoc);
        }
      }
    }

    for (const previousRow of previousRows) {
      if (currentById.has(previousRow.id)) continue;
      const deleteResult = await deleteVersionedRecord<any>(key, previousRow, Number(previousRow.version || 0));

      if (deleteResult.status === 'deleted') {
        nextRowsById.delete(previousRow.id);
        continue;
      }

      if (deleteResult.status === 'conflict') {
        conflicts.push({ key, id: previousRow.id });
        if (deleteResult.remoteDoc) {
          nextRowsById.set(previousRow.id, deleteResult.remoteDoc);
        }
      }
    }

    const finalizedRows = sortPersistedRecords(key, Array.from(nextRowsById.values()));
    (persistedNextState as any)[key] = finalizedRows;
    if (conflicts.some(conflict => conflict.key === key)) {
      (remoteOverrides as any)[key] = finalizedRows;
    }
  }

  return { nextState: persistedNextState, remoteOverrides, conflicts };
};

// Hàm lưu AppState lên Firebase
export const saveAppState = async (appState: any, lastUpdated?: string): Promise<string> => {
  try {
    await initializeAuth();
    const docRef = doc(db, 'appState', 'main');
    const timestamp = lastUpdated || new Date().toISOString();

    // Clean unsupported values before writing
    const safeState = serializeForFirestore(appState);

    console.log('Saving app state to Firestore', { eventsCount: Array.isArray(safeState.events) ? safeState.events.length : 0, transactionsCount: Array.isArray(safeState.transactions) ? safeState.transactions.length : 0 });

    await setDoc(docRef, {
      ...safeState,
      lastUpdated: timestamp,
    }, { merge: true });

    console.log('saveAppState: successfully wrote app state to Firestore', { lastUpdated: timestamp });
    return timestamp;
  } catch (error) {
    console.error('Error saving app state to Firebase:', error);
    throw error;
  }
};

// Hàm tải AppState từ Firebase
export const loadAppState = async (): Promise<any | null> => {
  try {
    await initializeAuth();
    const docRef = doc(db, 'appState', 'main');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      // Restore Date objects for logs (used in UI rendering)
      if (Array.isArray((data as any).logs)) {
        (data as any).logs = (data as any).logs.map((l: any) => ({
          ...l,
          timestamp: l?.timestamp ? new Date(l.timestamp) : new Date()
        }));
      }
      return data;
    }
    return null;
  } catch (error) {
    console.error('Error loading app state from Firebase:', error);
    return null;
  }
};

// Hàm đồng bộ hóa giữa localStorage và Firebase
export const syncAppState = async (localState: any): Promise<any> => {
  try {
    const firebaseState = await loadAppState();
    
    if (firebaseState) {
      // Nếu Firebase có dữ liệu, so sánh timestamps
      const localTime = new Date(localStorage.getItem('ebus_last_update') || 0).getTime();
      const firebaseTime = new Date(firebaseState.lastUpdated || 0).getTime();
      
      // Lấy dữ liệu mới nhất
      if (firebaseTime > localTime) {
        return firebaseState;
      }
    }
    
    // Lưu state hiện tại lên Firebase
    await saveAppState(localState);
    return localState;
  } catch (error) {
    console.error('Sync error:', error);
    return localState;
  }
};

// Subscribe to realtime updates for appState/main
export const subscribeToAppState = (onChange: (data: any | null) => void): Unsubscribe => {
  const docRef = doc(db, 'appState', 'main');
  const unsub = onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      onChange(snap.data());
    } else {
      onChange(null);
    }
  }, (err) => {
    console.error('Realtime listener error:', err);
  });
  return unsub;
};

// -------- Presence (active sessions) ----------
type SessionPayload = {
  userId: string;
  userName: string;
  role: string;
  phone?: string;
  deviceId?: string;
};

export const setSessionOnline = async (sessionId: string, payload: SessionPayload): Promise<string | null> => {
  try {
    await initializeAuth();
    const ref = doc(db, 'activeSessions', sessionId);
    const lastSeen = new Date().toISOString();
    await setDoc(ref, { ...payload, lastSeen, online: true }, { merge: true });
    return lastSeen;
  } catch (err) {
    console.error('Failed to set session online', err);
    return null;
  }
};

export const setSessionOffline = async (sessionId: string): Promise<string | null> => {
  try {
    await initializeAuth();
    const ref = doc(db, 'activeSessions', sessionId);
    const lastSeen = new Date().toISOString();
    await setDoc(ref, { lastSeen, online: false }, { merge: true });
    return lastSeen;
  } catch (err) {
    console.error('Failed to set session offline', err);
    return null;
  }
};

export const subscribeToSessions = (onChange: (sessions: any[]) => void): Unsubscribe => {
  const colRef = collection(db, 'activeSessions');
  return onSnapshot(colRef, (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    onChange(data);
  }, (err) => {
    console.error('Presence listener error:', err);
  });
};

// -------- Learning user state ----------
const getLearningUserDocRef = (userId: string) => doc(db, 'learningUsers', userId);

export const loadLearningUserState = async (userId: string): Promise<any | null> => {
  try {
    await initializeAuth();
    const docSnap = await getDoc(getLearningUserDocRef(userId));
    return docSnap.exists() ? docSnap.data() : null;
  } catch (error) {
    console.error('Error loading learning user state from Firebase:', error);
    return null;
  }
};

export const saveLearningUserState = async (
  userId: string,
  payload: {
    userName?: string;
    profile: any;
    attempts: any[];
  }
): Promise<string> => {
  try {
    await initializeAuth();
    const timestamp = new Date().toISOString();
    const safePayload = serializeForFirestore(payload);

    await setDoc(getLearningUserDocRef(userId), {
      ...safePayload,
      userId,
      updatedAt: timestamp
    }, { merge: true });

    return timestamp;
  } catch (error) {
    console.error('Error saving learning user state to Firebase:', error);
    throw error;
  }
};

export const subscribeToLearningUserState = (
  userId: string,
  onChange: (data: any | null) => void
): Unsubscribe => {
  return onSnapshot(getLearningUserDocRef(userId), (snap) => {
    if (snap.exists()) {
      onChange(snap.data());
    } else {
      onChange(null);
    }
  }, (err) => {
    console.error('Learning user listener error:', err);
  });
};

export const deleteLearningUserState = async (userId: string): Promise<void> => {
  try {
    await initializeAuth();
    await deleteDoc(getLearningUserDocRef(userId));
  } catch (error) {
    console.error('Error deleting learning user state from Firebase:', error);
    throw error;
  }
};

export const subscribeToLearningUsers = (
  onChange: (users: any[]) => void
): Unsubscribe => {
  const colRef = collection(db, 'learningUsers');
  return onSnapshot(colRef, (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    onChange(data);
  }, (err) => {
    console.error('Learning users listener error:', err);
  });
};
