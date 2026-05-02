# Standardized Error Handling - Usage Examples

## Overview
This ERP system uses a centralized error handling system that provides consistent error display, logging, and user feedback.

## Basic Usage

### 1. In React Components

```typescript
import { showError, showSuccess } from '@/utils/errorHandler';
import { useMutation } from '@tanstack/react-query';

function MyComponent() {
  const createMutation = useMutation({
    mutationFn: createStudent,
    onSuccess: () => {
      showSuccess('Student Created', 'The student record has been successfully created.');
    },
    onError: (error) => {
      // Automatically categorizes and displays appropriate error message
      showError(error, 'Create Student');
    },
  });
}
```

### 2. In Service Functions

```typescript
import { showError, parseError } from '@/utils/errorHandler';

export const studentService = {
  async createStudent(data: Student) {
    try {
      const result = await supabase.from('students').insert(data);
      
      if (result.error) {
        throw result.error;
      }
      
      return result.data;
    } catch (error) {
      // Log the structured error
      const standardError = parseError(error, 'studentService.createStudent');
      console.error('Structured error:', standardError);
      
      // Rethrow to be handled by the component
      throw error;
    }
  },
};
```

### 3. With Operation-Specific Messages

```typescript
import { showError, getOperationErrorMessage } from '@/utils/errorHandler';

async function handleDelete(id: string) {
  try {
    await deleteStudent(id);
    showSuccess('Student Deleted', 'The student record has been removed.');
  } catch (error) {
    // Gets context-aware error message
    const message = getOperationErrorMessage('student', error);
    showError(error, 'Delete Student');
  }
}
```

### 4. Different Notification Types

```typescript
import { showSuccess, showWarning, showInfo, showError } from '@/utils/errorHandler';

// Success notification
showSuccess('Operation Successful', 'The data has been saved.');

// Warning notification (for non-critical issues)
showWarning('Data Incomplete', 'Some optional fields are empty.');

// Info notification
showInfo('Processing', 'Your request is being processed.');

// Error notification (automatically categorized)
showError(error, 'Submit Form');
```

## Error Categories

The system automatically categorizes errors into:

- **VALIDATION**: Form/input validation errors
- **AUTHENTICATION**: Login/session errors
- **AUTHORIZATION**: Permission errors
- **NETWORK**: Connection/API errors
- **DATABASE**: Data integrity/constraint errors
- **BUSINESS_LOGIC**: Business rule violations
- **SYSTEM**: Server/system errors
- **UNKNOWN**: Uncategorized errors

## Error Severities

- **CRITICAL**: System down, data loss (10s display)
- **ERROR**: Operation failed (6s display)
- **WARNING**: Non-critical issues (4s display)
- **INFO**: Informational messages (3s display)

## Best Practices

1. **Always provide context**: Include what operation failed
   ```typescript
   showError(error, 'Create Student Form');
   ```

2. **Use operation-specific helpers**: Get better user messages
   ```typescript
   const message = getOperationErrorMessage('student', error);
   ```

3. **Let the system handle categorization**: Don't manually check error types
   ```typescript
   // ❌ Bad
   if (error.code === 'PGRST301') {
     toast.error('Permission denied');
   }
   
   // ✅ Good
   showError(error, 'Update Student');
   ```

4. **Log structured errors**: Use parseError for debugging
   ```typescript
   const standardError = parseError(error, 'context');
   console.error('Structured:', standardError);
   ```

5. **Provide success feedback**: Always confirm successful operations
   ```typescript
   showSuccess('Student Updated', 'Changes have been saved successfully.');
   ```

## Migration Guide

### Old Pattern (Inconsistent)
```typescript
try {
  await createStudent(data);
  toast({ title: 'Success', description: 'Student created' });
} catch (error) {
  console.error(error);
  toast({ title: 'Error', description: 'Failed to create student', variant: 'destructive' });
}
```

### New Pattern (Standardized)
```typescript
try {
  await createStudent(data);
  showSuccess('Student Created', 'The student record has been successfully created.');
} catch (error) {
  showError(error, 'Create Student');
}
```

## Error Boundary Usage

Wrap your application or routes with ErrorBoundary:

```typescript
import ErrorBoundary from '@/components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <YourApp />
    </ErrorBoundary>
  );
}
```

## Testing Error Handling

```typescript
// Simulate errors in development
try {
  throw new Error('Test error');
} catch (error) {
  showError(error, 'Test Context');
}

// Simulate validation error
showError({ 
  name: 'ValidationError', 
  errors: { email: 'Invalid email' } 
}, 'Form Validation');

// Simulate network error
showError({ 
  response: { 
    status: 500, 
    data: { message: 'Server error' } 
  } 
}, 'API Call');
```
