/**
 * subscription.ts — Frontend helper for reading premium status
 *
 * Usage:
 *   import { useSubscription, isPremiumUser } from '@/lib/subscription'
 *
 *   // React hook:
 *   const { isPremium, plan, status, loading } = useSubscription()
 *
 *   // One-shot check (outside React):
 *   const premium = await isPremiumUser(supabase)
 */

import { useEffect, useState } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

export interface Subscription {
  plan: 'free' | 'premium';
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired';
  current_period_end: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
}

export interface UseSubscriptionResult {
  subscription: Subscription | null;
  isPremium: boolean;
  plan: 'free' | 'premium';
  status: Subscription['status'] | null;
  loading: boolean;
  error: Error | null;
}

/**
 * React hook — subscribes to real-time changes.
 * Reads from user_subscriptions (RLS ensures only own row is visible).
 */
export function useSubscription(
  supabase: SupabaseClient
): UseSubscriptionResult {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from('user_subscriptions')
          .select('plan, status, current_period_end, provider_customer_id, provider_subscription_id')
          .eq('user_id', user.id)
          .single();

        if (fetchError) throw fetchError;
        setSubscription(data as Subscription);

        // Real-time: update UI if subscription changes (e.g., webhook fires)
        channel = supabase
          .channel(`subscription:${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'user_subscriptions',
              filter: `user_id=eq.${user.id}`,
            },
            (payload) => {
              setSubscription(payload.new as Subscription);
            }
          )
          .subscribe();
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase]);

  const isPremiumActive =
    subscription?.plan === 'premium' &&
    (subscription.status === 'active' || subscription.status === 'trialing') &&
    (subscription.current_period_end === null ||
      new Date(subscription.current_period_end) > new Date());

  return {
    subscription,
    isPremium: isPremiumActive,
    plan: subscription?.plan ?? 'free',
    status: subscription?.status ?? null,
    loading,
    error,
  };
}

/**
 * One-shot async check — use outside React components.
 */
export async function isPremiumUser(supabase: SupabaseClient): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from('user_subscriptions')
    .select('plan, status, current_period_end')
    .eq('user_id', user.id)
    .single();

  if (!data) return false;
  return (
    data.plan === 'premium' &&
    (data.status === 'active' || data.status === 'trialing') &&
    (data.current_period_end === null || new Date(data.current_period_end) > new Date())
  );
}
