import { useState, useCallback } from "react";
import { saasService } from "@/services/saasService";

export const useRateLimit = () => {
  const [rateLimited, setRateLimited] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);

  const checkLimit = useCallback(async (identifier: string): Promise<boolean> => {
    const result = await saasService.checkRateLimit(identifier);
    setAttemptsRemaining(result.attempts_remaining);
    if (!result.allowed) {
      setRateLimited(true);
      setRetryAfter(result.retry_after_seconds);
      // Auto-clear after retry period
      setTimeout(() => {
        setRateLimited(false);
        setRetryAfter(0);
      }, result.retry_after_seconds * 1000);
      return false;
    }
    return true;
  }, []);

  const recordAttempt = useCallback(async (identifier: string, success: boolean) => {
    await saasService.recordLoginAttempt(identifier, success);
    if (success) {
      setRateLimited(false);
      setRetryAfter(0);
    }
  }, []);

  return { rateLimited, retryAfter, attemptsRemaining, checkLimit, recordAttempt };
};
