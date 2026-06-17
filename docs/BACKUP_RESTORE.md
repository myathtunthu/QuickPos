# QuickPOS Backup / Restore Runbook

## Purpose

This production phase adds tenant-wise Firestore backup and restore through Firebase Cloud Functions. Live POS data remains in Firestore. Backups are stored as JSON snapshots in Firebase Storage under:

```text
tenant-backups/{tenantId}/{YYYY-MM-DD}/{backupId}.json
```

Firestore keeps metadata in:

```text
tenant_backups/{backupId}
```

## What is backed up

- `pos_settings`
- `pos_users`
- `pos_products`
- `pos_customers`
- `pos_suppliers`
- `pos_records`
- `pos_drafts`
- `pos_audit_logs`
- `audit_logs` with tenant metadata

## Deploy

```bash
npm install
cd functions
npm install
cd ..
firebase deploy --only functions,firestore
```

## Manual backup

Go to Settings → Production Backup / Restore → Backup Now.

## Scheduled backup

`scheduledTenantBackups` runs daily at 02:15 Asia/Yangon for every tenant in `pos_settings`, unless:

```js
backupDisabled: true
```

## Restore warning

Restore overwrites documents contained in the selected backup. Always download the current backup first before restore.

## Capacity limits in this implementation

- Backup limit per tenant snapshot: 250,000 documents
- Restore write limit per request: 250,000 documents
- For larger tenants, use Firestore managed exports or BigQuery/archive pipeline.

## Security model

- Callable functions require Firebase Auth.
- Tenant admins can only backup/restore their own tenant.
- Super Admin can target any tenant.
- Client cannot write `tenant_backups` directly.
