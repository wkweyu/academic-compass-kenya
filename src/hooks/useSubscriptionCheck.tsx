import { useState, useEffect } from "react";
import { saasService, SubscriptionStatus } from "@/services/saasService";
import { useAuth } from "@/hooks/useAuth";

export const useSubscriptionCheck = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    saasService.checkSubscription().then((result) => {
      if (!cancelled) {
        setSubscription(result);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [user]);

  const isExpired = subscription ? !subscription.is_valid : false;
  const isNearExpiry = subscription ? subscription.days_remaining <= 7 && subscription.days_remaining > 0 : false;

  return { subscription, loading, isExpired, isNearExpiry };
};
