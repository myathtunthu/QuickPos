const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch'); // node-fetch v2

admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket();
const FieldValue = admin.firestore.FieldValue;

const TENANT_COLLECTIONS = [
  { name: 'pos_settings', mode: 'docIdOrTenantId' },
  { name: 'pos_users', mode: 'tenantId' },
  { name: 'pos_products', mode: 'tenantId' },
  { name: 'pos_customers', mode: 'tenantId' },
  { name: 'pos_suppliers', mode: 'tenantId' },
  { name: 'pos_records', mode: 'tenantId' },
  { name: 'pos_drafts', mode: 'tenantId' },
  { name: 'pos_audit_logs', mode: 'tenantId' },
  { name: 'audit_logs', mode: 'tenantIdOptional' },
];

const RESTORE_COLLECTION_ALLOWLIST = new Set(TENANT_COLLECTIONS.map((item) => item.name));
const MAX_DOCS_PER_BACKUP = 250000;
const MAX_RESTORE_WRITES = 250000;

const toStartOfTodayYangon = () => {
  const now = new Date();
  const yangonNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Yangon' }));
  yangonNow.setHours(0, 0, 0, 0);
  return yangonNow;
};

const formatDatePart = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};

const escapeMarkdown = (value = '') => String(value).replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');

const normalizeRole = (role = '') => String(role).trim().toLowerCase();

const serializeFirestoreValue = (value) => {
  if (value == null) return value;

  if (value instanceof admin.firestore.Timestamp) {
    return { __quickposType: 'timestamp', value: value.toDate().toISOString() };
  }

  if (value instanceof admin.firestore.GeoPoint) {
    return { __quickposType: 'geopoint', latitude: value.latitude, longitude: value.longitude };
  }

  if (Array.isArray(value)) return value.map(serializeFirestoreValue);

  if (typeof value === 'object') {
    const result = {};
    Object.entries(value).forEach(([key, child]) => {
      result[key] = serializeFirestoreValue(child);
    });
    return result;
  }

  return value;
};

const deserializeFirestoreValue = (value) => {
  if (value == null) return value;

  if (Array.isArray(value)) return value.map(deserializeFirestoreValue);

  if (typeof value === 'object') {
    if (value.__quickposType === 'timestamp' && value.value) {
      return admin.firestore.Timestamp.fromDate(new Date(value.value));
    }

    if (value.__quickposType === 'geopoint') {
      return new admin.firestore.GeoPoint(Number(value.latitude), Number(value.longitude));
    }

    const result = {};
    Object.entries(value).forEach(([key, child]) => {
      result[key] = deserializeFirestoreValue(child);
    });
    return result;
  }

  return value;
};

const requireAuthenticatedUser = async (context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Login required.');
  }

  const userSnap = await db.collection('pos_users').doc(context.auth.uid).get();
  if (!userSnap.exists) {
    throw new functions.https.HttpsError('permission-denied', 'User profile not found.');
  }

  const profile = { id: userSnap.id, ...userSnap.data() };
  const role = normalizeRole(profile.role);
  const isSuperAdmin = role === 'superadmin' || role === 'super_admin';
  const isAdmin = role === 'admin' || role === 'owner' || isSuperAdmin;

  if (!isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Admin permission required.');
  }

  if (!isSuperAdmin && !profile.tenantId) {
    throw new functions.https.HttpsError('permission-denied', 'Tenant profile required.');
  }

  return { profile, isSuperAdmin, isAdmin };
};

const resolveTenantId = ({ requestedTenantId, profile, isSuperAdmin }) => {
  const tenantId = String(requestedTenantId || profile.tenantId || '').trim();

  if (!tenantId) {
    throw new functions.https.HttpsError('invalid-argument', 'tenantId is required.');
  }

  if (!isSuperAdmin && tenantId !== profile.tenantId) {
    throw new functions.https.HttpsError('permission-denied', 'You can only access your own tenant backup.');
  }

  return tenantId;
};

const collectionQueryForTenant = (collectionName, mode, tenantId) => {
  const ref = db.collection(collectionName);

  if (mode === 'docIdOrTenantId') {
    return { directDoc: ref.doc(tenantId), fallbackQuery: ref.where('tenantId', '==', tenantId) };
  }

  if (mode === 'tenantIdOptional') {
    return ref.where('tenantId', 'in', [tenantId, `tenant:${tenantId}`]);
  }

  return ref.where('tenantId', '==', tenantId);
};

const readTenantCollection = async ({ collectionName, mode, tenantId }) => {
  const querySource = collectionQueryForTenant(collectionName, mode, tenantId);

  if (querySource.directDoc) {
    const directSnap = await querySource.directDoc.get();
    if (directSnap.exists) {
      return [{ id: directSnap.id, data: serializeFirestoreValue(directSnap.data()) }];
    }

    const fallbackSnap = await querySource.fallbackQuery.get();
    return fallbackSnap.docs.map((doc) => ({ id: doc.id, data: serializeFirestoreValue(doc.data()) }));
  }

  const snap = await querySource.get();
  return snap.docs.map((doc) => ({ id: doc.id, data: serializeFirestoreValue(doc.data()) }));
};

const createTenantBackupInternal = async ({ tenantId, requestedBy = null, reason = 'manual' }) => {
  const startedAt = new Date();
  const datePart = formatDatePart(startedAt);
  const backupId = `${tenantId}_${startedAt.toISOString().replace(/[:.]/g, '-')}`;
  const storagePath = `tenant-backups/${tenantId}/${datePart}/${backupId}.json`;
  const backupRef = db.collection('tenant_backups').doc(backupId);

  const metadata = {
    tenantId,
    status: 'running',
    reason,
    storagePath,
    requestedBy: requestedBy || null,
    createdAt: FieldValue.serverTimestamp(),
    completedAt: null,
    collectionCounts: {},
    totalDocuments: 0,
    sizeBytes: 0,
    version: 1,
  };

  await backupRef.set(metadata);

  try {
    const payload = {
      app: 'QuickPOS',
      version: 1,
      tenantId,
      generatedAt: startedAt.toISOString(),
      reason,
      collections: {},
    };

    let totalDocuments = 0;
    const collectionCounts = {};

    for (const collectionDef of TENANT_COLLECTIONS) {
      const docs = await readTenantCollection({
        collectionName: collectionDef.name,
        mode: collectionDef.mode,
        tenantId,
      });

      totalDocuments += docs.length;
      if (totalDocuments > MAX_DOCS_PER_BACKUP) {
        throw new Error(`Backup document limit exceeded (${MAX_DOCS_PER_BACKUP}). Use scheduled export/archive strategy.`);
      }

      collectionCounts[collectionDef.name] = docs.length;
      payload.collections[collectionDef.name] = docs;
    }

    const json = JSON.stringify(payload);
    const file = bucket.file(storagePath);
    await file.save(json, {
      resumable: false,
      contentType: 'application/json',
      metadata: {
        cacheControl: 'private, max-age=0, no-transform',
        metadata: {
          tenantId,
          backupId,
          reason,
        },
      },
    });

    await backupRef.set({
      status: 'completed',
      collectionCounts,
      totalDocuments,
      sizeBytes: Buffer.byteLength(json, 'utf8'),
      completedAt: FieldValue.serverTimestamp(),
      error: FieldValue.delete(),
    }, { merge: true });

    await db.collection('audit_logs').add({
      action: 'TENANT_BACKUP_CREATED',
      tenantId,
      backupId,
      requestedBy: requestedBy || 'system',
      reason,
      totalDocuments,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { backupId, tenantId, storagePath, totalDocuments, collectionCounts };
  } catch (error) {
    await backupRef.set({
      status: 'failed',
      error: error.message,
      completedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    throw error;
  }
};

exports.createTenantBackup = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data = {}, context) => {
    const { profile, isSuperAdmin } = await requireAuthenticatedUser(context);
    const tenantId = resolveTenantId({ requestedTenantId: data.tenantId, profile, isSuperAdmin });

    try {
      return await createTenantBackupInternal({
        tenantId,
        requestedBy: context.auth.uid,
        reason: data.reason || 'manual',
      });
    } catch (error) {
      console.error('createTenantBackup failed', { tenantId, error });
      throw new functions.https.HttpsError('internal', error.message || 'Backup failed.');
    }
  });

exports.listTenantBackups = functions.https.onCall(async (data = {}, context) => {
  const { profile, isSuperAdmin } = await requireAuthenticatedUser(context);
  const tenantId = resolveTenantId({ requestedTenantId: data.tenantId, profile, isSuperAdmin });
  const limit = Math.min(Math.max(Number(data.limit) || 20, 1), 50);

  const snap = await db.collection('tenant_backups')
    .where('tenantId', '==', tenantId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return {
    tenantId,
    backups: snap.docs.map((doc) => {
      const backup = doc.data();
      return {
        id: doc.id,
        status: backup.status || 'unknown',
        reason: backup.reason || '',
        totalDocuments: backup.totalDocuments || 0,
        sizeBytes: backup.sizeBytes || 0,
        collectionCounts: backup.collectionCounts || {},
        createdAt: backup.createdAt?.toDate?.()?.toISOString?.() || null,
        completedAt: backup.completedAt?.toDate?.()?.toISOString?.() || null,
        error: backup.error || null,
      };
    }),
  };
});

exports.createBackupDownloadUrl = functions.https.onCall(async (data = {}, context) => {
  const { profile, isSuperAdmin } = await requireAuthenticatedUser(context);
  const backupId = String(data.backupId || '').trim();

  if (!backupId) {
    throw new functions.https.HttpsError('invalid-argument', 'backupId is required.');
  }

  const backupSnap = await db.collection('tenant_backups').doc(backupId).get();
  if (!backupSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Backup not found.');
  }

  const backup = backupSnap.data();
  resolveTenantId({ requestedTenantId: backup.tenantId, profile, isSuperAdmin });

  if (backup.status !== 'completed' || !backup.storagePath) {
    throw new functions.https.HttpsError('failed-precondition', 'Backup is not ready.');
  }

  const [url] = await bucket.file(backup.storagePath).getSignedUrl({
    action: 'read',
    expires: Date.now() + 10 * 60 * 1000,
  });

  await db.collection('audit_logs').add({
    action: 'TENANT_BACKUP_DOWNLOAD_URL_CREATED',
    tenantId: backup.tenantId,
    backupId,
    requestedBy: context.auth.uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { url, expiresInSeconds: 600 };
});

exports.restoreTenantBackup = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data = {}, context) => {
    const { profile, isSuperAdmin } = await requireAuthenticatedUser(context);
    const backupId = String(data.backupId || '').trim();
    const confirmation = String(data.confirmation || '').trim();

    if (!backupId) {
      throw new functions.https.HttpsError('invalid-argument', 'backupId is required.');
    }

    if (confirmation !== 'RESTORE') {
      throw new functions.https.HttpsError('failed-precondition', 'Type RESTORE to confirm.');
    }

    const backupSnap = await db.collection('tenant_backups').doc(backupId).get();
    if (!backupSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Backup not found.');
    }

    const backup = backupSnap.data();
    const tenantId = resolveTenantId({ requestedTenantId: backup.tenantId, profile, isSuperAdmin });

    if (backup.status !== 'completed' || !backup.storagePath) {
      throw new functions.https.HttpsError('failed-precondition', 'Backup is not ready.');
    }

    const [buffer] = await bucket.file(backup.storagePath).download();
    const payload = JSON.parse(buffer.toString('utf8'));

    if (payload.tenantId !== tenantId || !payload.collections) {
      throw new functions.https.HttpsError('failed-precondition', 'Backup tenant mismatch.');
    }

    let totalWrites = 0;
    let batch = db.batch();
    const restoredCounts = {};

    const commitBatch = async () => {
      await batch.commit();
      batch = db.batch();
    };

    for (const [collectionName, docs] of Object.entries(payload.collections)) {
      if (!RESTORE_COLLECTION_ALLOWLIST.has(collectionName) || !Array.isArray(docs)) continue;

      restoredCounts[collectionName] = 0;

      for (const item of docs) {
        if (!item?.id || typeof item.data !== 'object') continue;

        const dataToRestore = deserializeFirestoreValue(item.data);
        if (collectionName !== 'pos_settings') {
          dataToRestore.tenantId = tenantId;
        }

        batch.set(db.collection(collectionName).doc(item.id), {
          ...dataToRestore,
          restoredAt: FieldValue.serverTimestamp(),
          restoredFromBackupId: backupId,
        }, { merge: false });

        restoredCounts[collectionName] += 1;
        totalWrites += 1;

        if (totalWrites > MAX_RESTORE_WRITES) {
          throw new functions.https.HttpsError('resource-exhausted', `Restore write limit exceeded (${MAX_RESTORE_WRITES}).`);
        }

        if (totalWrites % 450 === 0) {
          await commitBatch();
        }
      }
    }

    if (totalWrites % 450 !== 0) {
      await commitBatch();
    }

    await db.collection('audit_logs').add({
      action: 'TENANT_BACKUP_RESTORED',
      tenantId,
      backupId,
      requestedBy: context.auth.uid,
      totalWrites,
      restoredCounts,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { tenantId, backupId, totalWrites, restoredCounts };
  });

exports.scheduledTenantBackups = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .pubsub.schedule('15 2 * * *')
  .timeZone('Asia/Yangon')
  .onRun(async () => {
    const tenantsSnap = await db.collection('pos_settings').get();

    for (const tenantDoc of tenantsSnap.docs) {
      const tenantId = tenantDoc.id;
      const settings = tenantDoc.data() || {};
      if (settings.backupDisabled === true) continue;

      try {
        await createTenantBackupInternal({ tenantId, requestedBy: 'system', reason: 'scheduled_daily' });
      } catch (error) {
        console.error('scheduledTenantBackups failed for tenant', tenantId, error);
      }
    }

    return null;
  });

/**
 * Scheduled Cloud Function (Runs every day at 11:59 PM Myanmar time)
 * Sends each tenant's daily sale summary to its configured Telegram chat.
 */
exports.dailyTelegramBackup = functions.pubsub
  .schedule('59 23 * * *')
  .timeZone('Asia/Yangon')
  .onRun(async () => {
    try {
      const today = toStartOfTodayYangon();
      const todayISO = today.toISOString().slice(0, 10);

      const tenantsSnap = await db
        .collection('pos_settings')
        .where('telegramBackup', '==', true)
        .get();

      if (tenantsSnap.empty) return null;

      for (const tenantDoc of tenantsSnap.docs) {
        const tenantId = tenantDoc.id;
        const settings = tenantDoc.data();

        const botToken = settings.botToken || settings.tgToken;
        const chatId = settings.chatId || settings.tgChatId;

        if (!botToken || !chatId) continue;

        const salesSnap = await db
          .collection('pos_records')
          .where('tenantId', '==', tenantId)
          .where('type', 'in', ['Sale', 'sale'])
          .where('date', '==', todayISO)
          .get();

        let dailyTotal = 0;
        salesSnap.forEach((doc) => {
          dailyTotal += Number(doc.data().amount || doc.data().total || 0);
        });

        const shopName = escapeMarkdown(settings.shopName || settings.storeName || tenantId);
        const message = [
          '📊 *QuickPOS Daily Summary*',
          `🏢 Store: ${shopName}`,
          `📅 Date: ${escapeMarkdown(todayISO)}`,
          '',
          `💰 Total Revenue: *${dailyTotal.toLocaleString()} MMK*`,
          `🧾 Transactions: ${salesSnap.size}`,
          '',
          '_Automated backup generated by QuickPOS\._',
        ].join('\n');

        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'MarkdownV2',
          }),
        });

        if (!response.ok) {
          const body = await response.text();
          console.error(`Telegram backup failed for ${tenantId}:`, body);
        }
      }

      console.log('Daily Telegram backup executed successfully');
      return null;
    } catch (error) {
      console.error('Telegram backup failed:', error);
      return null;
    }
  });
