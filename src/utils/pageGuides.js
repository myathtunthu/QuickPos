import adminMm from '../../docs/mm/UserGuide/Admin.md?raw';
import adminEn from '../../docs/en/UserGuide/Admin.md?raw';
import adminZh from '../../docs/zh/UserGuide/Admin.md?raw';
import customersMm from '../../docs/mm/UserGuide/Customers.md?raw';
import customersEn from '../../docs/en/UserGuide/Customers.md?raw';
import customersZh from '../../docs/zh/UserGuide/Customers.md?raw';
import dashboardMm from '../../docs/mm/UserGuide/Dashboard.md?raw';
import dashboardEn from '../../docs/en/UserGuide/Dashboard.md?raw';
import dashboardZh from '../../docs/zh/UserGuide/Dashboard.md?raw';
import draftsMm from '../../docs/mm/UserGuide/Drafts.md?raw';
import draftsEn from '../../docs/en/UserGuide/Drafts.md?raw';
import draftsZh from '../../docs/zh/UserGuide/Drafts.md?raw';
import inventoryMm from '../../docs/mm/UserGuide/Inventory.md?raw';
import inventoryEn from '../../docs/en/UserGuide/Inventory.md?raw';
import inventoryZh from '../../docs/zh/UserGuide/Inventory.md?raw';
import ledgerMm from '../../docs/mm/UserGuide/Ledger.md?raw';
import ledgerEn from '../../docs/en/UserGuide/Ledger.md?raw';
import ledgerZh from '../../docs/zh/UserGuide/Ledger.md?raw';
import loginMm from '../../docs/mm/UserGuide/Login.md?raw';
import loginEn from '../../docs/en/UserGuide/Login.md?raw';
import loginZh from '../../docs/zh/UserGuide/Login.md?raw';
import pOSMm from '../../docs/mm/UserGuide/POS.md?raw';
import pOSEn from '../../docs/en/UserGuide/POS.md?raw';
import pOSZh from '../../docs/zh/UserGuide/POS.md?raw';
import recordsMm from '../../docs/mm/UserGuide/Records.md?raw';
import recordsEn from '../../docs/en/UserGuide/Records.md?raw';
import recordsZh from '../../docs/zh/UserGuide/Records.md?raw';
import reportsMm from '../../docs/mm/UserGuide/Reports.md?raw';
import reportsEn from '../../docs/en/UserGuide/Reports.md?raw';
import reportsZh from '../../docs/zh/UserGuide/Reports.md?raw';
import settingsMm from '../../docs/mm/UserGuide/Settings.md?raw';
import settingsEn from '../../docs/en/UserGuide/Settings.md?raw';
import settingsZh from '../../docs/zh/UserGuide/Settings.md?raw';
import superAdminMm from '../../docs/mm/UserGuide/SuperAdmin.md?raw';
import superAdminEn from '../../docs/en/UserGuide/SuperAdmin.md?raw';
import superAdminZh from '../../docs/zh/UserGuide/SuperAdmin.md?raw';
import suppliersMm from '../../docs/mm/UserGuide/Suppliers.md?raw';
import suppliersEn from '../../docs/en/UserGuide/Suppliers.md?raw';
import suppliersZh from '../../docs/zh/UserGuide/Suppliers.md?raw';

const SUPPORTED_GUIDE_LANGUAGES = ['mm', 'en', 'zh'];
const DEFAULT_GUIDE_LANGUAGE = 'mm';

const MARKDOWN_GUIDES = {
  dashboard: { mm: { markdown: dashboardMm }, en: { markdown: dashboardEn }, zh: { markdown: dashboardZh } },
  entry: { mm: { markdown: pOSMm }, en: { markdown: pOSEn }, zh: { markdown: pOSZh } },
  inventory: { mm: { markdown: inventoryMm }, en: { markdown: inventoryEn }, zh: { markdown: inventoryZh } },
  customers: { mm: { markdown: customersMm }, en: { markdown: customersEn }, zh: { markdown: customersZh } },
  suppliers: { mm: { markdown: suppliersMm }, en: { markdown: suppliersEn }, zh: { markdown: suppliersZh } },
  drafts: { mm: { markdown: draftsMm }, en: { markdown: draftsEn }, zh: { markdown: draftsZh } },
  ledger: { mm: { markdown: ledgerMm }, en: { markdown: ledgerEn }, zh: { markdown: ledgerZh } },
  records: { mm: { markdown: recordsMm }, en: { markdown: recordsEn }, zh: { markdown: recordsZh } },
  reports: { mm: { markdown: reportsMm }, en: { markdown: reportsEn }, zh: { markdown: reportsZh } },
  settings: { mm: { markdown: settingsMm }, en: { markdown: settingsEn }, zh: { markdown: settingsZh } },
  admin: { mm: { markdown: adminMm }, en: { markdown: adminEn }, zh: { markdown: adminZh } },
  login: { mm: { markdown: loginMm }, en: { markdown: loginEn }, zh: { markdown: loginZh } },
  mttadminacc: { mm: { markdown: superAdminMm }, en: { markdown: superAdminEn }, zh: { markdown: superAdminZh } },
  superadmin: { mm: { markdown: superAdminMm }, en: { markdown: superAdminEn }, zh: { markdown: superAdminZh } },
};

const PAGE_ALIASES = {
  '/': 'dashboard',
};

function normalisePage(pathname = '') {
  const cleanPath = String(pathname || '/').split('?')[0].split('#')[0];
  if (PAGE_ALIASES[cleanPath]) return PAGE_ALIASES[cleanPath];
  const page = cleanPath.split('/').filter(Boolean)[0] || 'dashboard';
  return page;
}

function normaliseLanguage(language) {
  return SUPPORTED_GUIDE_LANGUAGES.includes(language) ? language : DEFAULT_GUIDE_LANGUAGE;
}

function getMarkdownDoc(page, language) {
  const pageDocs = MARKDOWN_GUIDES[page] || MARKDOWN_GUIDES.dashboard;
  const safeLanguage = normaliseLanguage(language);
  return pageDocs[safeLanguage] || pageDocs[DEFAULT_GUIDE_LANGUAGE] || pageDocs.en || null;
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

export function getPageGuide(pathname, t = (_key, fallback) => fallback, language = DEFAULT_GUIDE_LANGUAGE) {
  const page = normalisePage(pathname);
  const doc = getMarkdownDoc(page, language);
  const markdown = doc?.markdown || '';
  const title = extractMarkdownTitle(markdown, t('guide', 'Guide'));
  const description = extractMarkdownDescription(markdown, '');

  return {
    title,
    description,
    markdown,
    language: normaliseLanguage(language),
    isMarkdownGuide: true,
    version: 'Guide Pack 1.0',
    updatedAt: '2026-06-10',
  };
}
