import { useEffect, useState } from 'react';

const normalizeDelay = (delay) => {
  const value = Number(delay);
  if (!Number.isFinite(value) || value < 0) return 300;
  return Math.min(value, 60_000);
};

export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const safeDelay = normalizeDelay(delay);

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setDebouncedValue(value);
    }, safeDelay);

    return () => window.clearTimeout(handler);
  }, [value, safeDelay]);

  return debouncedValue;
}

export default useDebounce;
