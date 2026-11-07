import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/firebaseConfig';

export const LOCAL_GUEST_UID = 'local_guest';
export const GUEST_SESSION_KEY = '@budget_tracker_guest_session';

export type UserSubcollection =
  | 'transactions'
  | 'installments'
  | 'subscriptions'
  | 'recurringIncomes';

const getGuestStorageKey = (subcollection: UserSubcollection) =>
  `@budget_tracker_guest_collection_${subcollection}`;

export const isGuestUser = (user: any): boolean => {
  if (!user) return false;
  return Boolean(user.isAnonymous || user.uid === LOCAL_GUEST_UID);
};

export const createLocalGuestUser = (): any => ({
  uid: LOCAL_GUEST_UID,
  email: null,
  displayName: null,
  isAnonymous: true,
});

// In-memory listeners per guest subcollection for instant 0ms reactive UI updates
type GuestListener = () => void;
const guestListeners: Record<UserSubcollection, Set<GuestListener>> = {
  transactions: new Set(),
  installments: new Set(),
  subscriptions: new Set(),
  recurringIncomes: new Set(),
};

const notifyGuestListeners = (subcollection: UserSubcollection) => {
  guestListeners[subcollection].forEach((listener) => {
    try {
      listener();
    } catch {}
  });
};

const DATE_FIELDS = new Set(['date', 'lastAdded', 'lastCharged', 'createdAt']);

const serializeForStorage = (data: Record<string, any>): Record<string, any> => {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val === undefined) continue;
    if (val && typeof val.toDate === 'function') {
      result[key] = { __isTimestamp: true, iso: val.toDate().toISOString() };
    } else if (val instanceof Date) {
      result[key] = { __isTimestamp: true, iso: val.toISOString() };
    } else {
      result[key] = val;
    }
  }
  return result;
};

const makeTimestampLike = (iso: string) => {
  const d = new Date(iso);
  return {
    toDate: () => d,
    toMillis: () => d.getTime(),
    seconds: Math.floor(d.getTime() / 1000),
    nanoseconds: 0,
  };
};

const hydrateFromStorage = (raw: Record<string, any>): Record<string, any> => {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (val && typeof val === 'object' && val.__isTimestamp && typeof val.iso === 'string') {
      result[key] = makeTimestampLike(val.iso);
    } else if (DATE_FIELDS.has(key) && typeof val === 'string') {
      result[key] = makeTimestampLike(val);
    } else {
      result[key] = val;
    }
  }
  return result;
};

interface StoredGuestItem {
  id: string;
  data: Record<string, any>;
}

const readGuestItems = async (subcollection: UserSubcollection): Promise<StoredGuestItem[]> => {
  try {
    const raw = await AsyncStorage.getItem(getGuestStorageKey(subcollection));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeGuestItems = async (
  subcollection: UserSubcollection,
  items: StoredGuestItem[]
): Promise<void> => {
  await AsyncStorage.setItem(getGuestStorageKey(subcollection), JSON.stringify(items));
  notifyGuestListeners(subcollection);
};

export interface VirtualDocSnap {
  id: string;
  data: () => Record<string, any>;
}

export interface VirtualQuerySnapshot {
  docs: VirtualDocSnap[];
  forEach: (cb: (doc: VirtualDocSnap) => void) => void;
}

const buildVirtualSnapshot = (
  items: StoredGuestItem[],
  orderByDateDesc?: boolean
): VirtualQuerySnapshot => {
  const hydratedDocs: VirtualDocSnap[] = items.map((item) => {
    const hydrated = hydrateFromStorage(item.data);
    return {
      id: item.id,
      data: () => hydrated,
    };
  });

  if (orderByDateDesc) {
    hydratedDocs.sort((a, b) => {
      const aDate = a.data().date?.toDate ? a.data().date.toDate().getTime() : 0;
      const bDate = b.data().date?.toDate ? b.data().date.toDate().getTime() : 0;
      return bDate - aDate;
    });
  }

  return {
    docs: hydratedDocs,
    forEach: (cb) => hydratedDocs.forEach(cb),
  };
};

export const getUserDocs = async (
  user: any,
  subcollection: UserSubcollection,
  options?: { orderByDateDesc?: boolean }
): Promise<VirtualQuerySnapshot> => {
  if (isGuestUser(user)) {
    const items = await readGuestItems(subcollection);
    return buildVirtualSnapshot(items, options?.orderByDateDesc);
  }

  const colRef = collection(db, 'users', user.uid, subcollection);
  const q = options?.orderByDateDesc ? query(colRef, orderBy('date', 'desc')) : query(colRef);
  const snap = await getDocs(q);
  return snap as unknown as VirtualQuerySnapshot;
};

export const subscribeUserCollection = (
  user: any,
  subcollection: UserSubcollection,
  onNext: (snapshot: VirtualQuerySnapshot) => void,
  options?: { orderByDateDesc?: boolean },
  onError?: (error: any) => void
): (() => void) => {
  if (isGuestUser(user)) {
    let active = true;
    const emitCurrent = async () => {
      try {
        const items = await readGuestItems(subcollection);
        if (active) {
          onNext(buildVirtualSnapshot(items, options?.orderByDateDesc));
        }
      } catch (err) {
        if (active && onError) onError(err);
      }
    };

    emitCurrent();
    const listener: GuestListener = () => {
      emitCurrent();
    };
    guestListeners[subcollection].add(listener);

    return () => {
      active = false;
      guestListeners[subcollection].delete(listener);
    };
  }

  const colRef = collection(db, 'users', user.uid, subcollection);
  const q = options?.orderByDateDesc ? query(colRef, orderBy('date', 'desc')) : query(colRef);
  return onSnapshot(
    q,
    (snap) => onNext(snap as unknown as VirtualQuerySnapshot),
    (err) => {
      if (onError) onError(err);
    }
  );
};

export const addUserDoc = async (
  user: any,
  subcollection: UserSubcollection,
  data: Record<string, any>
): Promise<{ id: string }> => {
  if (isGuestUser(user)) {
    const items = await readGuestItems(subcollection);
    const newId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const serialized = serializeForStorage(data);
    items.push({ id: newId, data: serialized });
    await writeGuestItems(subcollection, items);
    return { id: newId };
  }

  const docRef = await addDoc(collection(db, 'users', user.uid, subcollection), data);
  return { id: docRef.id };
};

export const updateUserDoc = async (
  user: any,
  subcollection: UserSubcollection,
  docId: string,
  updates: Record<string, any>
): Promise<void> => {
  if (isGuestUser(user)) {
    const items = await readGuestItems(subcollection);
    const serializedUpdates = serializeForStorage(updates);
    const nextItems = items.map((item) =>
      item.id === docId ? { ...item, data: { ...item.data, ...serializedUpdates } } : item
    );
    await writeGuestItems(subcollection, nextItems);
    return;
  }

  await updateDoc(doc(db, 'users', user.uid, subcollection, docId), updates);
};

export const deleteUserDoc = async (
  user: any,
  subcollection: UserSubcollection,
  docId: string
): Promise<void> => {
  if (isGuestUser(user)) {
    const items = await readGuestItems(subcollection);
    const nextItems = items.filter((item) => item.id !== docId);
    await writeGuestItems(subcollection, nextItems);
    return;
  }

  await deleteDoc(doc(db, 'users', user.uid, subcollection, docId));
};

export const clearAllGuestData = async (): Promise<void> => {
  const subcollections: UserSubcollection[] = [
    'transactions',
    'installments',
    'subscriptions',
    'recurringIncomes',
  ];
  await Promise.all([
    ...subcollections.map((sub) => AsyncStorage.removeItem(getGuestStorageKey(sub))),
    AsyncStorage.removeItem(GUEST_SESSION_KEY),
    AsyncStorage.removeItem(`@budget_tracker_cached_transactions_${LOCAL_GUEST_UID}`),
  ]);
  subcollections.forEach(notifyGuestListeners);
};

/**
 * Migrates any local guest data from AsyncStorage to the newly registered Firebase user's Firestore collections.
 */
export const migrateGuestDataToCloud = async (targetUid: string): Promise<void> => {
  const subcollections: UserSubcollection[] = [
    'transactions',
    'installments',
    'subscriptions',
    'recurringIncomes',
  ];

  for (const sub of subcollections) {
    try {
      const items = await readGuestItems(sub);
      if (items.length === 0) continue;

      for (const item of items) {
        const hydrated = hydrateFromStorage(item.data);
        const firestorePayload: Record<string, any> = {};
        for (const [k, v] of Object.entries(hydrated)) {
          if (v && typeof v.toDate === 'function') {
            firestorePayload[k] = Timestamp.fromDate(v.toDate());
          } else {
            firestorePayload[k] = v;
          }
        }
        await addDoc(collection(db, 'users', targetUid, sub), firestorePayload);
      }

      await AsyncStorage.removeItem(getGuestStorageKey(sub));
    } catch (err) {
      console.warn(`Error migrating guest ${sub} to cloud:`, err);
    }
  }

  await AsyncStorage.removeItem(GUEST_SESSION_KEY).catch(() => {});
};

