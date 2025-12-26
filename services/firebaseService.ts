import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, where, deleteDoc, updateDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';

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

// Hàm lưu AppState lên Firebase
export const saveAppState = async (appState: any): Promise<void> => {
  try {
    await initializeAuth();
    const docRef = doc(db, 'appState', 'main');

    // Clean unsupported values before writing
    const safeState = serializeForFirestore(appState);

    console.log('Saving app state to Firestore', { eventsCount: Array.isArray(safeState.events) ? safeState.events.length : 0, transactionsCount: Array.isArray(safeState.transactions) ? safeState.transactions.length : 0 });

    await setDoc(docRef, {
      ...safeState,
      lastUpdated: new Date().toISOString(),
    }, { merge: true });

    console.log('saveAppState: successfully wrote app state to Firestore');
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
