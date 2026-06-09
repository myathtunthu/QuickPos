import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';

const assertNonEmptyString = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
};

const buildDocRef = (path) => {
  assertNonEmptyString(path, 'Document path');
  return doc(db, path);
};

const buildCollectionRef = (collectionName) => {
  assertNonEmptyString(collectionName, 'Collection name');
  return collection(db, collectionName);
};

const removeUndefinedValues = (data = {}) => Object.fromEntries(
  Object.entries(data).filter(([, value]) => value !== undefined)
);

export const withTenant = (tenantId, data = {}) => {
  assertNonEmptyString(String(tenantId || ''), 'Tenant ID');
  return {
    ...removeUndefinedValues(data),
    tenantId: String(tenantId).trim(),
  };
};

export const withCreateTimestamps = (data = {}) => ({
  ...removeUndefinedValues(data),
  createdAt: data.createdAt || serverTimestamp(),
  updatedAt: serverTimestamp(),
});

export const withUpdateTimestamp = (data = {}) => ({
  ...removeUndefinedValues(data),
  updatedAt: serverTimestamp(),
});

// Generic CRUD helpers
export const createDocument = (collectionName, data) => addDoc(
  buildCollectionRef(collectionName),
  withCreateTimestamps(data)
);

export const setDocument = (path, data, merge = true) => setDoc(
  buildDocRef(path),
  withUpdateTimestamp(data),
  { merge }
);

export const getDocument = async (path) => {
  const snap = await getDoc(buildDocRef(path));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const updateDocument = (path, data) => updateDoc(
  buildDocRef(path),
  withUpdateTimestamp(data)
);

export const deleteDocument = (path) => deleteDoc(buildDocRef(path));

export const getCollection = async (collectionName, ...queryConstraints) => {
  const q = query(buildCollectionRef(collectionName), ...queryConstraints);
  const snap = await getDocs(q);
  return snap.docs.map((documentSnapshot) => ({
    id: documentSnapshot.id,
    ...documentSnapshot.data(),
  }));
};

export const runTransactionAsync = async (updateFunction) => runTransaction(db, updateFunction);

export const createBatch = () => writeBatch(db);

export const batchCommit = (batch) => batch.commit();

export const batchSet = (batch, path, data, options = undefined) => {
  const ref = buildDocRef(path);
  const safeData = withUpdateTimestamp(data);

  if (options) {
    return batch.set(ref, safeData, options);
  }

  return batch.set(ref, safeData);
};

export const batchUpdate = (batch, path, data) => batch.update(
  buildDocRef(path),
  withUpdateTimestamp(data)
);

export const batchDelete = (batch, path) => batch.delete(buildDocRef(path));

// Real-time subscriptions
export const onCollectionSnapshot = (
  collectionName,
  callback,
  ...queryConstraints
) => {
  if (typeof callback !== 'function') {
    throw new Error('Snapshot callback must be a function');
  }

  const q = query(buildCollectionRef(collectionName), ...queryConstraints);

  return onSnapshot(
    q,
    (snap) => {
      const data = snap.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data(),
      }));
      callback(data);
    },
    (error) => {
      console.error(`[Firestore] Snapshot listener failed for ${collectionName}.`, error);
      callback([], error);
    }
  );
};

export { serverTimestamp };
