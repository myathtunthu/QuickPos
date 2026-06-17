# Production Security Phase 1

Source checked: latest uploaded `QuickPos-main Source.zip`.

## Changed files
- `src/firebase/config.js`
- `src/context/AuthContext.jsx`
- `src/pages/SuperAdminPage.jsx`
- `firestore.rules`
- `firestore.indexes.json`

## Fixes
1. Secondary Firebase Auth now uses in-memory persistence.
   - Prevents admin/staff creation sessions from persisting in browser storage.

2. Tenant expiry is now enforced on login.
   - `AuthContext` blocks expired non-superadmin accounts using `expiryAt` or `expiryDate`.

3. New and renewed tenants now write `expiryAt` timestamp.
   - Firestore rules can compare `expiryAt` against `request.time`.
   - Existing `expiryDate` string is kept for UI compatibility.

4. Firestore rules now block expired tenant users when `expiryAt` exists.
   - Super admin remains unaffected.

5. Audit log read/write rules are tenant-scoped for admins.
   - Super admin can still read globally.

6. Firestore indexes expanded for known tenant/date queries.
   - `pos_records tenantId + createdAt`
   - `pos_records tenantId + timestamp`
   - `pos_drafts tenantId + createdAt`
   - `audit_logs tenantId + timestamp`
   - `pos_expenses tenantId + timestamp`

## Not changed
- Auto login / impersonation features were not modified.
- `passwordRaw` was not removed because it is currently tied to the existing impersonation flow.

## Verification
- `npm run build` could not be completed in this environment because `vite` is not installed (`node_modules` missing).
