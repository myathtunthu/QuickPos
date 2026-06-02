import logger from './logger';
import { MESSAGES } from '../constants/app';

/**
 * Wraps async functions with error handling (Try-Catch wrapper)
 * @param {Function} fn Async function to execute
 * @param {Function} onError Error callback fallback
 * @returns {Function} Wrapped function
 */
export const asyncHandler = (fn, onError) => {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      logger.error('Async Function Error:', error);
      if (onError) {
        onError(error);
      }
      throw error;
    }
  };
};

/**
 * Safe async executor with Loading State and Auto-Toast functionality
 * @param {Function} fn The async operation to perform
 * @param {Function} setLoading State setter for loading (e.g., setIsLoading)
 * @param {Function} showToast Function to show alert/toast
 */
export const executeAsync = async (fn, setLoading, showToast) => {
  if (setLoading) setLoading(true);
  try {
    const result = await fn();
    return result;
  } catch (error) {
    logger.error('ExecuteAsync Failed:', error);
    const message = error.message || MESSAGES.ERROR_OCCURRED;
    if (showToast) {
      showToast(message, 'error'); // If you have a toast component
    } else {
      alert(`Error: ${message}`); // Fallback to browser alert
    }
    return null;
  } finally {
    if (setLoading) setLoading(false);
  }
};
