import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  runTransaction,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './config';

// Generic CRUD helpers
export const createDocument = (col, data) =>
  addDoc(collection(db, col), { ...data, createdAt: serverTimestamp() });

export const setDocument = (path, data, merge = true) =>
  setDoc(doc(db, path), data, { merge });

export const getDocument = async (path) => {
  const snap = await getDoc(doc(db, path));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const updateDocument = (path, data) =>
  updateDoc(doc(db, path), data);

export const deleteDocument = (path) =>
  deleteDoc(doc(db, path));

export const getCollection = async (col, ...queryConstraints) => {
  const q = query(collection(db, col), ...queryConstraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const runTransactionAsync = async (updateFunction) =>
  runTransaction(db, updateFunction);

export const createBatch = () => writeBatch(db);

export const batchCommit = (batch) => batch.commit();

export const batchSet = (batch, path, data) =>
  batch.set(doc(db, path), data);

export const batchUpdate = (batch, path, data) =>
  batch.update(doc(db, path), data);

export const batchDelete = (batch, path) =>
  batch.delete(doc(db, path));

// Real-time subscriptions
export const onCollectionSnapshot = (col, callback, ...queryConstraints) => {
  const q = query(collection(db, col), ...queryConstraints);
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(data);
  });
};
