import React from 'react';
import { AlertCircle } from 'lucide-react';
import logger from '../utils/logger';
import { translations } from '../utils/translations';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service here
    logger.error('Error caught by ErrorBoundary', error);
    console.error('Error Details:', errorInfo);
  }

  render() {
    const lang = localStorage.getItem('nexpos_language') || 'mm';
    const dictionary = translations[lang] || translations.mm || translations.en || {};
    const t = (key, fallback) => dictionary[key] || translations.en?.[key] || fallback || key;

    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#080c14] flex items-center justify-center p-4">
          <div className="bg-rose-950/30 border border-rose-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4 border-b border-rose-500/20 pb-4">
              <AlertCircle className="text-rose-500" size={32} />
              <h1 className="text-xl font-black text-rose-200">{t('runtimeErrorTitle', 'Something went wrong!')}</h1>
            </div>
            
            <p className="text-rose-200/70 text-sm mb-6 bg-black/40 p-4 rounded-xl border border-rose-500/10 font-mono overflow-auto max-h-32">
              {this.state.error?.message || t('runtimeErrorFallback', 'An unexpected runtime error occurred.')}
            </p>
            
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 px-4 rounded-xl transition-all active:scale-95 shadow-lg shadow-rose-900/50"
            >
              {t('reloadApplication', 'Reload Application')}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
