/**
 * PremiumGate — affiche son children uniquement si l'user est premium.
 * Sinon, affiche un fallback (upgrade CTA par défaut).
 *
 * Usage:
 *   <PremiumGate supabase={supabase}>
 *     <FeaturePremium />
 *   </PremiumGate>
 *
 *   <PremiumGate supabase={supabase} fallback={<MonCTA />}>
 *     <FeaturePremium />
 *   </PremiumGate>
 */

import { ReactNode } from 'react';
import { useSubscription } from '@/lib/subscription';
import { SupabaseClient } from '@supabase/supabase-js';

interface Props {
  supabase: SupabaseClient;
  children: ReactNode;
  fallback?: ReactNode;
}

const DefaultUpgradeCTA = () => (
  <div
    style={{
      padding: '24px',
      borderRadius: '12px',
      border: '1px solid #e0c96e',
      background: '#fdf9ec',
      textAlign: 'center',
      color: '#5a4000',
    }}
  >
    <p style={{ fontWeight: 600, marginBottom: '8px' }}>✦ Fonctionnalité Premium</p>
    <p style={{ fontSize: '0.875rem', marginBottom: '16px', color: '#8a6500' }}>
      Passe à Flocean Premium pour débloquer cette fonctionnalité.
    </p>
    <a
      href="/upgrade"
      style={{
        display: 'inline-block',
        padding: '8px 20px',
        borderRadius: '9999px',
        background: '#e09b10',
        color: '#fff',
        fontWeight: 600,
        textDecoration: 'none',
        fontSize: '0.875rem',
      }}
    >
      Passer Premium
    </a>
  </div>
);

export function PremiumGate({ supabase, children, fallback }: Props) {
  const { isPremium, loading } = useSubscription(supabase);

  if (loading) return null;
  if (!isPremium) return <>{fallback ?? <DefaultUpgradeCTA />}</>;
  return <>{children}</>;
}
