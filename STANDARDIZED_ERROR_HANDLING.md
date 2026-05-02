# Standardized Error Handling System

## Overview

This ERP system now implements a comprehensive, standardized error handling system that ensures consistent error display, logging, and user feedback across all modules.

## What's New

### 1. Centralized Error Handler (`src/utils/errorHandler.ts`)

**Key Features:**
- Automatic error categorization (Validation, Authentication, Network, Database, etc.)
- Severity-based display (Critical, Error, Warning, Info)
- Context-aware error messages
- Structured error logging
- Operation-specific error messages

**Functions:**
- `showError(error, context)` - Display errors with automatic categorization
- `showSuccess(message, description)` - Display success notifications
- `showWarning(message, description)` - Display warnings
- `showInfo(message, description)` - Display info messages
- `parseError(error, context)` - Parse and structure errors
- `getOperationErrorMessage(operation, error)` - Get context-specific messages

### 2. Enhanced API Client (`src/api/client.ts`)

- All API errors are now wrapped in standardized `ApiError` objects
- Automatic error parsing and categorization
- Consistent error structure across all API calls

### 3. Error Boundary Component (`src/components/ErrorBoundary.tsx`)

- Catches React component errors
- Displays user-friendly error UI
- Provides recovery options (Try Again, Go Home)
- Shows detailed error info in development mode

### 4. Error Categories

```typescript
enum ErrorCategory {
  VALIDATION       // Form/input validation errors
  AUTHENTICATION   // Login/session errors  
  AUTHORIZATION    // Permission errors
  NETWORK          // Connection/API errors
  DATABASE         // Data integrity/constraint errors
  BUSINESS_LOGIC   // Business rule violations
  SYSTEM           // Server/system errors
  UNKNOWN          // Uncategorized errors
}
```

### 5. Error Severities

```typescript
enum ErrorSeverity {
  INFO      // Informational (3s display)
  WARNING   // Non-critical (4s display)
  ERROR     // Operation failed (6s display)
  CRITICAL  // System down, data loss (10s display)
}
```

## Usage Examples

### Before (Inconsistent)

```typescript
// Different approaches across the codebase
try {
  await createStudent(data);
  toast({ title: 'Success', description: 'Student created' });
} catch (error) {
  console.error(error);
  toast({ title: 'Error', description: 'Failed', variant: 'destructive' });
}

// Or
try {
  await updateClass(id, data);
  toast.success('Class updated');
} catch (error) {
  toast.error(error.message || 'Error updating class');
}

// Or
try {
  await deleteStream(id);
} catch (error) {
  console.error('Delete failed:', error);
  alert('Failed to delete');
}
```

### After (Standardized)

```typescript
import { showError, showSuccess } from '@/utils/errorHandler';

// In mutation handlers
const createMutation = useMutation({
  mutationFn: createStudent,
  onSuccess: () => {
    showSuccess('Student Created', 'The student record has been saved successfully.');
    queryClient.invalidateQueries({ queryKey: ['students'] });
  },
  onError: (error) => {
    showError(error, 'Create Student');
  },
});

// In async functions
async function handleDelete(id: string) {
  try {
    await deleteStream(id);
    showSuccess('Stream Deleted', 'The stream has been removed.');
  } catch (error) {
    showError(error, 'Delete Stream');
  }
}

// With operation-specific messages
try {
  await updateClass(id, data);
  showSuccess('Class Updated', 'Changes have been saved.');
} catch (error) {
  const message = getOperationErrorMessage('class', error);
  showError(error, 'Update Class');
}
```

## Migration Checklist

To update your code to use the new standardized error handling:

### For Component Files

1. **Import the helpers:**
   ```typescript
   import { showError, showSuccess } from '@/utils/errorHandler';
   ```

2. **Replace toast calls in mutations:**
   ```typescript
   // Old
   onError: (error) => {
     toast({ title: 'Error', description: error.message, variant: 'destructive' });
   }
   
   // New
   onError: (error) => {
     showError(error, 'Operation Context');
   }
   ```

3. **Replace success notifications:**
   ```typescript
   // Old
   toast({ title: 'Success', description: 'Saved!' });
   
   // New
   showSuccess('Operation Successful', 'The data has been saved.');
   ```

### For Service Files

1. **Let errors propagate naturally:**
   ```typescript
   // Don't catch and wrap - let the error propagate
   export async function createStudent(data) {
     const { data: result, error } = await supabase.from('students').insert(data);
     if (error) throw error; // Will be handled by component
     return result;
   }
   ```

2. **Add context in structured logging:**
   ```typescript
   import { parseError } from '@/utils/errorHandler';
   
   try {
     // operation
   } catch (error) {
     const standardError = parseError(error, 'serviceName.methodName');
     console.error('Structured error:', standardError);
     throw error; // Re-throw for component to handle
   }
   ```

## Benefits

1. **Consistency**: All errors displayed the same way across the entire application
2. **Better UX**: Users get clear, actionable error messages
3. **Easier Debugging**: Structured error logging with context
4. **Less Code**: No need to write custom error handling for each operation
5. **Automatic Categorization**: Errors are automatically categorized and displayed appropriately
6. **Professional**: ERP-grade error handling suitable for production use

## Error Display Examples

**Validation Error:**
```
⚠️ Warning
Unable to create student. Please check all required fields.
Review and correct the highlighted fields
```

**Permission Error:**
```
❌ Error
You don't have permission to delete this class.
Please contact your administrator for access.
```

**Network Error:**
```
❌ Error  
Network error while loading students.
Please check your connection and try again.
```

**Database Error:**
```
❌ Error
Failed to delete stream. It may be referenced by other records.
Please remove associated students first.
```

## Testing

Test the error handling by:

1. **Simulating errors in development:**
   ```typescript
   showError(new Error('Test error'), 'Test Context');
   ```

2. **Testing different error types:**
   ```typescript
   // Validation
   showError({ name: 'ValidationError', errors: { email: 'Invalid' } });
   
   // Network
   showError({ response: { status: 500 } });
   
   // Permission
   showError({ code: 'PGRST301' });
   ```

3. **Testing the Error Boundary:**
   - Throw an error in a component's render method
   - Verify the error UI displays correctly
   - Test the "Try Again" and "Go Home" actions

## Next Steps

To fully implement the standardized error handling across the application:

1. Update all mutation handlers in components to use `showError` and `showSuccess`
2. Replace direct toast calls with the new helpers
3. Remove custom error handling code that's now redundant
4. Add ErrorBoundary wrappers around critical sections if needed
5. Review and update any custom error messages for consistency

## Support

For questions or issues with the error handling system:
- Check the examples in `src/utils/errorHandling.example.md`
- Review the implementation in `src/utils/errorHandler.ts`
- Look at updated component examples for usage patterns
