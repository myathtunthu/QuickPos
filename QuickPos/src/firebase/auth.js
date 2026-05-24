import { 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  updateProfile 
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from './config';

/**
 * Authentication Wrapper Service
 */

export const registerTenantUser = async (email, password, name, tenantId, role = 'staff') => {
  try {
    // Note: Creating a user here signs them in. In a real admin panel, 
    // you would use Firebase Admin SDK via Cloud Functions to create users without changing the current session.
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await updateProfile(user, { displayName: name });

    // Store custom claims/roles in Firestore
    await setDoc(doc(db, 'pos_users', user.uid), {
      email: user.email,
      name,
      tenantId,
      role,
      status: 'active',
      createdAt: new Date()
    });

    return user;
  } catch (error) {
    throw error;
  }
};

export const resetUserPassword = async (email) => {
  return sendPasswordResetEmail(auth, email);
};
