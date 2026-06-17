import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase/config';

const functions = getFunctions(app);

const callFunction = async (name, payload = {}) => {
  const callable = httpsCallable(functions, name);
  const result = await callable(payload);
  return result.data;
};

export const createTenantBackup = (payload = {}) => callFunction('createTenantBackup', payload);
export const listTenantBackups = (payload = {}) => callFunction('listTenantBackups', payload);
export const createBackupDownloadUrl = (payload = {}) => callFunction('createBackupDownloadUrl', payload);
export const restoreTenantBackup = (payload = {}) => callFunction('restoreTenantBackup', payload);

export const formatBackupSize = (sizeBytes = 0) => {
  const size = Number(sizeBytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`;
};
