const isDev = Boolean(import.meta?.env?.DEV);

const redact = (value) => {
  if (!value || typeof value !== 'object') return value;

  const secretKeys = ['password', 'passwordRaw', 'token', 'secret', 'apiKey', 'authorization'];
  const seen = new WeakSet();

  const scrub = (input) => {
    if (!input || typeof input !== 'object') return input;
    if (seen.has(input)) return '[Circular]';
    seen.add(input);

    if (Array.isArray(input)) return input.map(scrub);

    return Object.fromEntries(
      Object.entries(input).map(([key, item]) => [
        key,
        secretKeys.some((secret) => key.toLowerCase().includes(secret.toLowerCase())) ? '[REDACTED]' : scrub(item),
      ])
    );
  };

  return scrub(value);
};

const logger = {
  log: (message, data = '') => {
    if (isDev) console.log(`[LOG] ${message}`, redact(data));
  },

  error: (message, error = '') => {
    const safeError = error instanceof Error
      ? { name: error.name, message: error.message, code: error.code, stack: isDev ? error.stack : undefined }
      : redact(error);

    if (isDev) {
      console.error(`[ERROR] ${message}`, safeError);
    } else {
      console.error(`[ERROR] ${message}`, safeError?.message || safeError || 'Unexpected error');
    }
  },

  warn: (message, data = '') => {
    if (isDev) console.warn(`[WARN] ${message}`, redact(data));
  },

  debug: (message, data = '') => {
    if (isDev) console.debug(`[DEBUG] ${message}`, redact(data));
  },
};

export default logger;
