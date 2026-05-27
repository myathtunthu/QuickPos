import { useEffect } from 'react';

export function useKeyboardShortcuts(handlers) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl/Cmd + S = Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handlers.onSave?.();
      }
      // Ctrl/Cmd + N = New/Clear
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handlers.onNew?.();
      }
      // F1 = Search
      if (e.key === 'F1') {
        e.preventDefault();
        handlers.onSearch?.();
      }
      // F2 = Barcode
      if (e.key === 'F2') {
        e.preventDefault();
        handlers.onBarcode?.();
      }
      // F3 = Hold
      if (e.key === 'F3') {
        e.preventDefault();
        handlers.onHold?.();
      }
      // Escape = Clear cart
      if (e.key === 'Escape') {
        handlers.onClear?.();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
