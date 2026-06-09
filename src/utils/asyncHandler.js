import logger from './logger';
import { MESSAGES } from '../constants/app';

const getUserMessage = (error) => {
  if (!error) return MESSAGES.ERROR_OCCURRED;
  if (typeof error === 'string') return error;
  return error.userMessage || error.message || MESSAGES.ERROR_OCCURRED;
};

export const asyncHandler = (fn, onError) => {
  if (typeof fn !== 'function') {
    throw new TypeError('asyncHandler requires a function.');
  }

  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      logger.error('Async Function Error:', error);
      if (typeof onError === 'function') onError(error);
      throw error;
    }
  };
};

export const executeAsync = async (fn, setLoading, showToast) => {
  if (typeof fn !== 'function') {
    const error = new TypeError('executeAsync requires a function.');
    logger.error('ExecuteAsync Failed:', error);
    return null;
  }

  if (typeof setLoading === 'function') setLoading(true);

  try {
    return await fn();
  } catch (error) {
    logger.error('ExecuteAsync Failed:', error);
    const message = getUserMessage(error);

    if (typeof showToast === 'function') {
      showToast(message, 'error');
    } else if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(`Error: ${message}`);
    }

    return null;
  } finally {
    if (typeof setLoading === 'function') setLoading(false);
  }
};
