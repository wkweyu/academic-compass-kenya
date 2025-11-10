# Biometric Attendance API

This document provides instructions on how to use the biometric attendance API endpoint.

## Endpoint

`POST /api/attendance/biometric/`

## Description

This endpoint is used to record student attendance from a biometric device. It accepts a `student_id` and a `timestamp` and will either create a new attendance record (check-in) or update an existing one with a checkout time.

**Note:** This API is designed to be generic and should work with any biometric device that can be configured to send a `POST` request with the specified JSON payload to a given URL.

## Authentication

This endpoint requires token-based authentication. The `Authorization` header should be set to `Bearer <your_access_token>`.

## Request Body

The request body must be a JSON object with the following fields:

| Field         | Type     | Description                                     |
|---------------|----------|-------------------------------------------------|
| `student_id`  | `string` | The ID of the student.                          |
| `timestamp`   | `string` | The ISO 8601 formatted timestamp of the event.  |

**Example:**

```json
{
    "student_id": "12345",
    "timestamp": "2023-10-27T08:30:00Z"
}
```

## Responses

### Success

*   **Code:** `201 Created` (for a new check-in) or `200 OK` (for a checkout)
*   **Content:**
    ```json
    {
        "message": "Attendance recorded successfully"
    }
    ```

### Error

*   **Code:** `400 Bad Request`
    *   **Content:** If `student_id` or `timestamp` are missing or the timestamp is invalid.
        ```json
        {
            "error": "student_id and timestamp are required"
        }
        ```
*   **Code:** `404 Not Found`
    *   **Content:** If the `student_id` does not exist.
        ```json
        {
            "error": "Student not found"
        }
        ```
