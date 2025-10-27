/**
 * Centralized Error Handling Utility for ERP System
 * Provides standardized error display, logging, and reporting
 */

import { toast } from 'sonner';

export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NETWORK = 'NETWORK',
  DATABASE = 'DATABASE',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  SYSTEM = 'SYSTEM',
  UNKNOWN = 'UNKNOWN',
}

export interface StandardError {
  code: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  details?: any;
  timestamp: string;
  context?: string;
  action?: string; // Suggested action for the user
}

/**
 * Parse and categorize errors from various sources
 */
export function parseError(error: any, context?: string): StandardError {
  const timestamp = new Date().toISOString();

  // Handle Supabase errors
  if (error?.code && error?.message) {
    return {
      code: error.code,
      message: error.message,
      category: categorizeSupabaseError(error.code),
      severity: determineSeverity(error),
      details: error.details || error.hint,
      timestamp,
      context,
      action: getSuggestedAction(error.code),
    };
  }

  // Handle API/Network errors
  if (error?.response) {
    const status = error.response.status;
    return {
      code: `HTTP_${status}`,
      message: error.response.data?.message || error.message || 'Network error occurred',
      category: categorizeHttpError(status),
      severity: status >= 500 ? ErrorSeverity.CRITICAL : ErrorSeverity.ERROR,
      details: error.response.data,
      timestamp,
      context,
      action: getHttpErrorAction(status),
    };
  }

  // Handle validation errors
  if (error?.name === 'ValidationError' || error?.errors) {
    return {
      code: 'VALIDATION_ERROR',
      message: 'Please check the form for errors',
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.WARNING,
      details: error.errors || error.message,
      timestamp,
      context,
      action: 'Review and correct the highlighted fields',
    };
  }

  // Handle generic JavaScript errors
  if (error instanceof Error) {
    return {
      code: error.name || 'UNKNOWN_ERROR',
      message: error.message || 'An unexpected error occurred',
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.ERROR,
      details: error.stack,
      timestamp,
      context,
      action: 'Please try again or contact support if the issue persists',
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      code: 'STRING_ERROR',
      message: error,
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.ERROR,
      timestamp,
      context,
      action: 'Please try again',
    };
  }

  // Fallback for unknown error types
  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
    category: ErrorCategory.UNKNOWN,
    severity: ErrorSeverity.ERROR,
    details: JSON.stringify(error),
    timestamp,
    context,
    action: 'Please refresh the page and try again',
  };
}

/**
 * Categorize Supabase error codes
 */
function categorizeSupabaseError(code: string): ErrorCategory {
  if (code.startsWith('PGRST')) {
    // PostgREST errors (API layer)
    if (code === 'PGRST301') return ErrorCategory.AUTHORIZATION;
    return ErrorCategory.DATABASE;
  }
  
  if (code.startsWith('23')) {
    // PostgreSQL constraint violations
    return ErrorCategory.VALIDATION;
  }
  
  if (code.startsWith('42')) {
    // PostgreSQL syntax errors
    return ErrorCategory.SYSTEM;
  }
  
  if (code === '08006' || code === '08001') {
    // Connection errors
    return ErrorCategory.NETWORK;
  }
  
  return ErrorCategory.DATABASE;
}

/**
 * Categorize HTTP status codes
 */
function categorizeHttpError(status: number): ErrorCategory {
  if (status === 401) return ErrorCategory.AUTHENTICATION;
  if (status === 403) return ErrorCategory.AUTHORIZATION;
  if (status === 404) return ErrorCategory.NETWORK;
  if (status === 422) return ErrorCategory.VALIDATION;
  if (status >= 500) return ErrorCategory.SYSTEM;
  return ErrorCategory.NETWORK;
}

/**
 * Determine error severity
 */
function determineSeverity(error: any): ErrorSeverity {
  // Critical: Data loss, system down
  if (error.code?.startsWith('XX')) return ErrorSeverity.CRITICAL;
  
  // Error: Operation failed but system operational
  if (error.code?.startsWith('P0') || error.code?.startsWith('23')) {
    return ErrorSeverity.ERROR;
  }
  
  // Warning: Validation, deprecated features
  if (error.code === '01000' || error.hint?.includes('deprecated')) {
    return ErrorSeverity.WARNING;
  }
  
  return ErrorSeverity.ERROR;
}

/**
 * Get suggested action for common error codes
 */
function getSuggestedAction(code: string): string {
  const actions: Record<string, string> = {
    '23505': 'This record already exists. Please use a different value.',
    '23503': 'Cannot delete this record as it is referenced by other data.',
    '23502': 'Required field is missing. Please fill in all required fields.',
    'PGRST301': 'You do not have permission to perform this action.',
    '42P01': 'Database configuration error. Please contact system administrator.',
  };
  
  return actions[code] || 'Please try again or contact support if the issue persists.';
}

/**
 * Get action for HTTP errors
 */
function getHttpErrorAction(status: number): string {
  const actions: Record<number, string> = {
    400: 'Please check your input and try again.',
    401: 'Please log in again to continue.',
    403: 'You do not have permission to perform this action.',
    404: 'The requested resource was not found.',
    422: 'Please correct the validation errors and try again.',
    429: 'Too many requests. Please wait a moment and try again.',
    500: 'Server error. Please try again later.',
    503: 'Service temporarily unavailable. Please try again later.',
  };
  
  return actions[status] || 'Please try again later.';
}

/**
 * Display error using toast notification
 */
export function showError(error: any, context?: string): void {
  const standardError = parseError(error, context);
  
  // Log to console for debugging (can be disabled in production)
  console.error(`[${standardError.category}] ${standardError.code}:`, {
    message: standardError.message,
    details: standardError.details,
    context: standardError.context,
    timestamp: standardError.timestamp,
  });

  // Display user-friendly message
  const displayMessage = `${standardError.message}${standardError.action ? `\n${standardError.action}` : ''}`;
  
  switch (standardError.severity) {
    case ErrorSeverity.CRITICAL:
      toast.error('Critical Error', {
        description: displayMessage,
        duration: 10000,
      });
      break;
    case ErrorSeverity.ERROR:
      toast.error('Error', {
        description: displayMessage,
        duration: 6000,
      });
      break;
    case ErrorSeverity.WARNING:
      toast.warning('Warning', {
        description: displayMessage,
        duration: 4000,
      });
      break;
    case ErrorSeverity.INFO:
      toast.info('Notice', {
        description: displayMessage,
        duration: 3000,
      });
      break;
  }
}

/**
 * Display success message
 */
export function showSuccess(message: string, description?: string): void {
  toast.success(message, {
    description,
    duration: 3000,
  });
}

/**
 * Display info message
 */
export function showInfo(message: string, description?: string): void {
  toast.info(message, {
    description,
    duration: 3000,
  });
}

/**
 * Display warning message
 */
export function showWarning(message: string, description?: string): void {
  toast.warning(message, {
    description,
    duration: 4000,
  });
}

/**
 * Get user-friendly error message for specific operations
 */
export function getOperationErrorMessage(operation: string, error: any): string {
  const standardError = parseError(error);
  
  const operationMessages: Record<string, Partial<Record<ErrorCategory, string>>> = {
    create: {
      [ErrorCategory.VALIDATION]: `Unable to create ${operation}. Please check all required fields.`,
      [ErrorCategory.DATABASE]: `Failed to save ${operation}. The record may already exist.`,
      [ErrorCategory.AUTHORIZATION]: `You don't have permission to create ${operation}.`,
      [ErrorCategory.AUTHENTICATION]: `Please log in to create ${operation}.`,
      [ErrorCategory.NETWORK]: `Network error while creating ${operation}. Please check your connection.`,
      [ErrorCategory.BUSINESS_LOGIC]: `Business rule validation failed for ${operation}.`,
      [ErrorCategory.SYSTEM]: `System error while creating ${operation}. Please contact support.`,
      [ErrorCategory.UNKNOWN]: `Failed to create ${operation}. Please try again.`,
    },
    update: {
      [ErrorCategory.VALIDATION]: `Unable to update ${operation}. Please check your inputs.`,
      [ErrorCategory.DATABASE]: `Failed to update ${operation}. The record may have been deleted.`,
      [ErrorCategory.AUTHORIZATION]: `You don't have permission to update ${operation}.`,
      [ErrorCategory.AUTHENTICATION]: `Please log in to update ${operation}.`,
      [ErrorCategory.NETWORK]: `Network error while updating ${operation}. Please check your connection.`,
      [ErrorCategory.BUSINESS_LOGIC]: `Business rule validation failed for ${operation}.`,
      [ErrorCategory.SYSTEM]: `System error while updating ${operation}. Please contact support.`,
      [ErrorCategory.UNKNOWN]: `Failed to update ${operation}. Please try again.`,
    },
    delete: {
      [ErrorCategory.VALIDATION]: `Cannot delete ${operation}. It may be in use elsewhere.`,
      [ErrorCategory.DATABASE]: `Failed to delete ${operation}. It may be referenced by other records.`,
      [ErrorCategory.AUTHORIZATION]: `You don't have permission to delete ${operation}.`,
      [ErrorCategory.AUTHENTICATION]: `Please log in to delete ${operation}.`,
      [ErrorCategory.NETWORK]: `Network error while deleting ${operation}. Please check your connection.`,
      [ErrorCategory.BUSINESS_LOGIC]: `Business rule prevents deletion of ${operation}.`,
      [ErrorCategory.SYSTEM]: `System error while deleting ${operation}. Please contact support.`,
      [ErrorCategory.UNKNOWN]: `Failed to delete ${operation}. Please try again.`,
    },
    fetch: {
      [ErrorCategory.VALIDATION]: `Invalid request parameters for ${operation}.`,
      [ErrorCategory.DATABASE]: `Failed to retrieve ${operation}. The data may not exist.`,
      [ErrorCategory.AUTHORIZATION]: `You don't have permission to view ${operation}.`,
      [ErrorCategory.AUTHENTICATION]: `Please log in to view ${operation}.`,
      [ErrorCategory.NETWORK]: `Network error while loading ${operation}. Please check your connection.`,
      [ErrorCategory.BUSINESS_LOGIC]: `Cannot retrieve ${operation} due to business rules.`,
      [ErrorCategory.SYSTEM]: `System error while loading ${operation}. Please contact support.`,
      [ErrorCategory.UNKNOWN]: `Failed to load ${operation}. Please try again.`,
    },
  };
  
  const messages = operationMessages[operation.toLowerCase()] || operationMessages.fetch;
  return messages[standardError.category] || standardError.message;
}

/**
 * Error boundary error handler
 */
export function handleBoundaryError(error: Error, errorInfo: React.ErrorInfo): void {
  console.error('Error Boundary caught an error:', error, errorInfo);
  
  // In production, you might want to send this to an error reporting service
  showError(error, 'Application Error Boundary');
}
