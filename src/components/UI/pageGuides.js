export const PAGE_GUIDE_MAP = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/entry': 'entry',
  '/inventory': 'inventory',
  '/records': 'records',
  '/reports': 'reports',
  '/customers': 'customers',
  '/suppliers': 'suppliers',
  '/settings': 'settings',
  '/admin': 'admin',
  '/super-admin': 'superAdmin',
  '/superadmin': 'superAdmin',
};

export function getGuidePageKey(pathname = '') {
  const clean = pathname.replace(/\/$/, '') || '/';
  return PAGE_GUIDE_MAP[clean] || null;
}

export function getGuideConfig(t, pageKey) {
  if (!pageKey) return null;

  const title = t(`guide_${pageKey}_title`, t('guide_title', 'Page Guide'));
  const subtitle = t(`guide_${pageKey}_subtitle`, '');
  const steps = [];

  for (let i = 1; i <= 8; i += 1) {
    const titleKey = `guide_${pageKey}_step${i}_title`;
    const bodyKey = `guide_${pageKey}_step${i}_body`;
    const stepTitle = t(titleKey, '');
    const stepBody = t(bodyKey, '');
    if (stepTitle && stepTitle !== titleKey) {
      steps.push({ title: stepTitle, body: stepBody === bodyKey ? '' : stepBody });
    }
  }

  if (!steps.length) return null;
  return { title, subtitle, steps };
}
