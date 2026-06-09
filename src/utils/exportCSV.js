const CSV_INJECTION_PREFIX = /^[=+\-@\t\r]/;

const sanitizeFileName = (filename = 'export') => {
  const safeName = String(filename || 'export').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return safeName || 'export';
};

const normaliseCell = (value) => {
  if (value === null || value === undefined) return '';

  let text;
  if (value instanceof Date) {
    text = value.toISOString();
  } else if (typeof value === 'object') {
    text = JSON.stringify(value);
  } else {
    text = String(value);
  }

  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // CSV injection protection for Excel/Sheets formula execution.
  if (CSV_INJECTION_PREFIX.test(text)) text = `'${text}`;

  const escaped = text.replace(/"/g, '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
};

export const buildCSVContent = (data, explicitHeaders = null) => {
  if (!Array.isArray(data) || data.length === 0) return '';

  const headers = Array.isArray(explicitHeaders) && explicitHeaders.length > 0
    ? explicitHeaders
    : Array.from(data.reduce((set, row) => {
        Object.keys(row || {}).forEach((key) => set.add(key));
        return set;
      }, new Set()));

  const rows = [
    headers.map(normaliseCell).join(','),
    ...data.map((row) => headers.map((header) => normaliseCell(row?.[header])).join(',')),
  ];

  return rows.join('\n');
};

export const exportToCSV = (data, filename = 'export', headers = null) => {
  if (!Array.isArray(data) || data.length === 0) {
    window.alert?.('Export ထုတ်ရန် မှတ်တမ်း မရှိပါ!');
    return false;
  }

  const csvContent = buildCSVContent(data, headers);
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toISOString().split('T')[0];

  link.href = url;
  link.rel = 'noopener noreferrer';
  link.setAttribute('download', `${sanitizeFileName(filename)}_${date}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
  return true;
};
