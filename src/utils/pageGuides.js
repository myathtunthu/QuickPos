import inventoryUserGuide from '../../docs/UserGuide/Inventory.md?raw';
import posUserGuide from '../../docs/UserGuide/POS.md?raw';

const tr = (t, key, fallback) => t(key, fallback);

const MARKDOWN_GUIDES = {
  inventory: {
    markdown: inventoryUserGuide,
    sourcePath: 'docs/UserGuide/Inventory.md',
  },
  entry: {
    markdown: posUserGuide,
    sourcePath: 'docs/UserGuide/POS.md',
  },
};

function normalisePage(pathname) {
  const path = pathname || '/dashboard';
  const page = path.split('/').filter(Boolean)[0] || 'dashboard';
  if (page === 'suppliers') return 'customers';
  return page;
}

function extractMarkdownTitle(markdown, fallback) {
  const titleLine = String(markdown || '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('# '));

  return titleLine ? titleLine.replace(/^#\s+/, '').trim() : fallback;
}

function extractMarkdownDescription(markdown, fallback = '') {
  const lines = String(markdown || '').split('\n');
  for (const line of lines) {
    const clean = line.trim();
    if (!clean || clean.startsWith('#') || clean.startsWith('- ') || /^\d+\./.test(clean)) continue;
    return clean.length > 180 ? `${clean.slice(0, 177)}...` : clean;
  }
  return fallback;
}

function buildMarkdownGuide(page, t) {
  const doc = MARKDOWN_GUIDES[page];
  if (!doc?.markdown) return null;

  const title = extractMarkdownTitle(doc.markdown, tr(t, `guide${page}Title`, 'Page guide'));
  const description = extractMarkdownDescription(doc.markdown, tr(t, `guide${page}Desc`, ''));

  return {
    title,
    description,
    markdown: doc.markdown,
    sourcePath: doc.sourcePath,
    isMarkdownGuide: true,
  };
}

function buildFallbackGuide(page, t) {
  const guides = {
    dashboard: {
      title: tr(t, 'guideDashboardTitle', 'Dashboard guide'),
      description: tr(t, 'guideDashboardDesc', 'Use this page to understand today’s business health quickly.'),
      steps: [
        { title: tr(t, 'guideDashboardKpiTitle', 'Read the 4 main numbers first'), body: tr(t, 'guideDashboardKpiBody', 'Today sales, profit, stock value, and customer credit show the current health of the shop. Check these before opening reports.') },
        { title: tr(t, 'guideDashboardAlertTitle', 'Check alerts'), body: tr(t, 'guideDashboardAlertBody', 'Low stock, unpaid credit, negative cash flow, and slow sales are shown as action items. Fix warning cards before they become serious problems.') },
        { title: tr(t, 'guideDashboardChartTitle', 'Use the trend chart'), body: tr(t, 'guideDashboardChartBody', 'The 7-day chart compares sales, profit, and expenses. If expenses go above sales or profit keeps falling, review pricing and costs.') },
        { title: tr(t, 'guideDashboardActionsTitle', 'Use quick actions'), body: tr(t, 'guideDashboardActionsBody', 'Start a sale, add stock, create a product, or review records directly from the dashboard.') },
      ],
      tips: [tr(t, 'guideDashboardTip1', 'Dashboard is for quick decisions; Reports is for deep analysis.'), tr(t, 'guideDashboardTip2', 'If numbers look wrong, check Records first for incorrect vouchers.')],
    },
    records: {
      title: tr(t, 'guideRecordsTitle', 'Records guide'),
      description: tr(t, 'guideRecordsDesc', 'Use Records to find vouchers, print receipts, and audit daily transactions.'),
      steps: [
        { title: tr(t, 'guideRecordsSearchTitle', 'Search vouchers'), body: tr(t, 'guideRecordsSearchBody', 'Search by voucher number, customer, supplier, product, or payment type. Use date range to narrow results.') },
        { title: tr(t, 'guideRecordsFilterTitle', 'Filter transaction type'), body: tr(t, 'guideRecordsFilterBody', 'Use All, Sale, Purchase, and Expense tabs to view only the records you need.') },
        { title: tr(t, 'guideRecordsPrintTitle', 'Open and print'), body: tr(t, 'guideRecordsPrintBody', 'Tap a voucher to view details. Use print when the customer needs another receipt.') },
        { title: tr(t, 'guideRecordsAuditTitle', 'Audit mistakes'), body: tr(t, 'guideRecordsAuditBody', 'If dashboard numbers look wrong, check Records for duplicate or incorrect transactions first.') },
      ],
      tips: [tr(t, 'guideRecordsTip1', 'Records is for transaction history, not analytics.'), tr(t, 'guideRecordsTip2', 'Use Reports for profit, cash flow, and top product analysis.')],
    },
    reports: {
      title: tr(t, 'guideReportsTitle', 'Reports guide'),
      description: tr(t, 'guideReportsDesc', 'Use Reports for profit, cash flow, product ranking, and business decisions.'),
      steps: [
        { title: tr(t, 'guideReportsDateTitle', 'Choose date range'), body: tr(t, 'guideReportsDateBody', 'Select start and end dates before exporting or comparing performance.') },
        { title: tr(t, 'guideReportsProfitTitle', 'Read profit'), body: tr(t, 'guideReportsProfitBody', 'Revenue minus product cost and expenses becomes net profit. If profit is low, check discounts, cost prices, and expenses.') },
        { title: tr(t, 'guideReportsProductTitle', 'Top products'), body: tr(t, 'guideReportsProductBody', 'Top products show what sells best. Use this to decide what to restock or promote.') },
        { title: tr(t, 'guideReportsExportTitle', 'Export CSV'), body: tr(t, 'guideReportsExportBody', 'Use CSV export for Excel, accountant review, or monthly backup.') },
      ],
      tips: [tr(t, 'guideReportsTip1', 'Reports is for analysis; Records is for voucher lookup.'), tr(t, 'guideReportsTip2', 'Profit accuracy depends on correct product cost prices.')],
    },
    customers: {
      title: tr(t, 'guidePeopleTitle', 'People guide'),
      description: tr(t, 'guidePeopleDesc', 'Use Customers and Suppliers to manage credit and payments.'),
      steps: [
        { title: tr(t, 'guidePeopleCustomerTitle', 'Customer credit'), body: tr(t, 'guidePeopleCustomerBody', 'Customer debt increases when a sale is saved as credit. Record payments when the customer pays back.') },
        { title: tr(t, 'guidePeopleSupplierTitle', 'Supplier payable'), body: tr(t, 'guidePeopleSupplierBody', 'Supplier payable increases when a purchase is not fully paid. Record payments when you pay the supplier.') },
        { title: tr(t, 'guidePeopleHistoryTitle', 'Ledger history'), body: tr(t, 'guidePeopleHistoryBody', 'Open a person to review payment history and remaining balance.') },
      ],
      tips: [tr(t, 'guidePeopleTip1', 'Do not delete people with active credit balance.'), tr(t, 'guidePeopleTip2', 'Always enter phone number for credit customers.')],
    },
    settings: {
      title: tr(t, 'guideSettingsTitle', 'Settings guide'),
      description: tr(t, 'guideSettingsDesc', 'Use Settings to configure shop profile, language, backup, and account options.'),
      steps: [
        { title: tr(t, 'guideSettingsProfileTitle', 'Business profile'), body: tr(t, 'guideSettingsProfileBody', 'Set shop name, logo, phone, and address. These details appear on receipts.') },
        { title: tr(t, 'guideSettingsBackupTitle', 'Backup'), body: tr(t, 'guideSettingsBackupBody', 'Configure backup settings and Telegram alerts if available. Test backup after changing settings.') },
        { title: tr(t, 'guideSettingsPasswordTitle', 'Password'), body: tr(t, 'guideSettingsPasswordBody', 'Change passwords regularly and use strong passwords for admin accounts.') },
      ],
      tips: [tr(t, 'guideSettingsTip1', 'Only admins should access Settings.'), tr(t, 'guideSettingsTip2', 'Keep receipt information short and accurate.')],
    },
    admin: {
      title: tr(t, 'guideAdminTitle', 'Admin guide'),
      description: tr(t, 'guideAdminDesc', 'Use Admin to create staff accounts and control permissions.'),
      steps: [
        { title: tr(t, 'guideAdminUserTitle', 'Create staff'), body: tr(t, 'guideAdminUserBody', 'Create one account per staff member. Do not share admin accounts.') },
        { title: tr(t, 'guideAdminPermissionTitle', 'Set permissions'), body: tr(t, 'guideAdminPermissionBody', 'Give only the permissions each staff member needs: sales, stock, records, reports, or payments.') },
        { title: tr(t, 'guideAdminDisableTitle', 'Disable access'), body: tr(t, 'guideAdminDisableBody', 'Disable accounts immediately when a staff member leaves.') },
      ],
      tips: [tr(t, 'guideAdminTip1', 'Keep owner/admin accounts limited.'), tr(t, 'guideAdminTip2', 'Review permissions regularly.')],
    },
  };

  return guides[page] || guides.dashboard;
}

export function getPageGuide(pathname, t) {
  const page = normalisePage(pathname);
  return buildMarkdownGuide(page, t) || buildFallbackGuide(page, t);
}
