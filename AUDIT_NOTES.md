# SuperAdmin subscription/tenant management phase

Source checked: latest uploaded `QuickPos-main Source.zip`.

Modified file:
- `src/pages/SuperAdminPage.jsx`

Added:
- Tenant health summary
- Expiring soon filter
- Payment / invoice status summary
- Per-tenant payment status dropdown
- Audit log search
- Login activity history panel from `audit_logs`
- Expiry shortcut dropdowns for new tenant creation
- Expiry shortcut dropdowns for existing tenant renewal
- Bulk expiry shortcut dropdown

Expiry shortcuts:
- 3 Days
- 7 Days
- 1 Month
- 3 Months
- 6 Months
- 1 Year

Rules:
- Auto Login / impersonation function was not changed.
- Existing passwordRaw display was not removed because user previously requested auto-login/impersonation not be touched.

Validation:
- JSX syntax checked using TypeScript transpile parser.
- Full production build was not run because dependencies are not installed in this environment.
