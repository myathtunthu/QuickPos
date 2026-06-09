import { useEffect, useMemo, useRef } from 'react';

const isEditableTarget = (target) => {
  const tagName = target?.tagName?.toLowerCase();
  return Boolean(
    target?.isContentEditable ||
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select'
  );
};

const normalizeHandlers = (handlers = {}) => ({
  onSave: handlers.onSave,
  onNew: handlers.onNew,
  onSearch: handlers.onSearch,
  onBarcode: handlers.onBarcode,
  onHold: handlers.onHold,
  onClear: handlers.onClear,
});

export function useKeyboardShortcuts(handlers = {}, options = {}) {
  const handlersRef = useRef(normalizeHandlers(handlers));
  const allowInInputs = Boolean(options.allowInInputs);
  const enabled = options.enabled !== false;

  useEffect(() => {
    handlersRef.current = normalizeHandlers(handlers);
  }, [handlers]);

  const shortcuts = useMemo(() => [
    { key: 's', ctrl: true, action: 'onSave' },
    { key: 'n', ctrl: true, action: 'onNew' },
    { key: 'F1', action: 'onSearch' },
    { key: 'F2', action: 'onBarcode' },
    { key: 'F3', action: 'onHold' },
    { key: 'Escape', action: 'onClear', allowEditable: false },
  ], []);

  useEffect(() => {
    if (!enabled) return undefined;

    const handleKeyDown = (event) => {
      if (!allowInInputs && isEditableTarget(event.target)) return;

      const shortcut = shortcuts.find((item) => {
        const keyMatches = event.key === item.key || event.key.toLowerCase() === item.key;
        const ctrlMatches = item.ctrl ? (event.ctrlKey || event.metaKey) : true;
        return keyMatches && ctrlMatches;
      });

      if (!shortcut) return;
      const handler = handlersRef.current[shortcut.action];
      if (typeof handler !== 'function') return;

      event.preventDefault();
      handler(event);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allowInInputs, enabled, shortcuts]);
}

export default useKeyboardShortcuts;
