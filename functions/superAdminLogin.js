const functions = require('firebase-functions');
const admin = require('firebase-admin');
const speakeasy = require('speakeasy');

// Rate limiting
const loginAttempts = {};
function checkRateLimit(email) {
  const now = Date.now();
  if (!loginAttempts[email]) loginAttempts[email] = [];
  loginAttempts[email] = loginAttempts[email].filter(time => now - time < 15 * 60 * 1000);
  if (loginAttempts[email].length >= 5) return false;
  loginAttempts[email].push(now);
  return true;
}

exports.superAdminLogin = functions.https.onCall(async (data, context) => {
  const { email, password, totpToken } = data;
  if (!checkRateLimit(email)) {
    throw new functions.https.HttpsError('resource-exhausted', 'Too many login attempts. Try again in 15 minutes.');
  }
  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    const userDoc = await admin.firestore().collection('pos_users').doc(userRecord.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'superadmin') {
      throw new functions.https.HttpsError('permission-denied', 'Not authorized');
    }
    if (userDoc.data().twoFactorEnabled) {
      if (!totpToken) return { requiresTwoFactor: true };
      const isValid = speakeasy.totp.verify({
        secret: userDoc.data().totpSecret,
        encoding: 'base32',
        token: totpToken,
        window: 2
      });
      if (!isValid) throw new functions.https.HttpsError('unauthenticated', 'Invalid 2FA token');
    }
    const customToken = await admin.auth().createCustomToken(userRecord.uid, { role: 'superadmin' });
    const sessionToken = require('crypto').randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 30 * 60 * 1000;
    await admin.firestore().collection('admin_sessions').add({
      uid: userRecord.uid,
      email,
      sessionToken,
      expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ipAddress: context.rawRequest.ip,
      userAgent: context.rawRequest.headers['user-agent']
    });
    await admin.firestore().collection('audit_logs').add({
      action: 'SUPERADMIN_LOGIN_SUCCESS',
      uid: userRecord.uid,
      email,
      ipAddress: context.rawRequest.ip,
      userAgent: context.rawRequest.headers['user-agent'],
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { token: customToken, sessionToken, expiresAt };
  } catch (error) {
    await admin.firestore().collection('audit_logs').add({
      action: 'SUPERADMIN_LOGIN_FAILED',
      email,
      error: error.message,
      ipAddress: context.rawRequest.ip,
      userAgent: context.rawRequest.headers['user-agent'],
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    throw error;
  }
});

exports.enableTwoFactor = functions.https.onCall(async (data, context) => {
  if (context.auth?.token?.role !== 'superadmin') throw new functions.https.HttpsError('permission-denied', 'Only super admin');
  const secret = speakeasy.generateSecret({ name: `QuickPOS SuperAdmin (${context.auth.token.email})`, issuer: 'QuickPOS' });
  return { secret: secret.base32, qrCode: secret.otpauth_url };
});

exports.verifyAndSaveTwoFactor = functions.https.onCall(async (data, context) => {
  const { totpToken, secret } = data;
  if (context.auth?.token?.role !== 'superadmin') throw new functions.https.HttpsError('permission-denied', 'Only super admin');
  const isValid = speakeasy.totp.verify({ secret, encoding: 'base32', token: totpToken, window: 2 });
  if (!isValid) throw new functions.https.HttpsError('invalid-argument', 'Invalid token');
  await admin.firestore().collection('pos_users').doc(context.auth.uid).update({ twoFactorEnabled: true, totpSecret: secret });
  return { success: true };
});
