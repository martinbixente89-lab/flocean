/**
 * PremiumBadge — affiche un badge si l'utilisateur est premium.
 * Usage: <PremiumBadge supabase={supabaseClient} />
 */

import { useSubscription } from '@/lib/subscription';
import { SupabaseClient } from '@supabase/supabase-js';

interface Props {
  supabase: SupabaseClient;
}

export function PremiumBadge({ supabase }: Props) {
  const { isPremium, loading } = useSubscription(supabase);

  if (loading) return null;
  if (!isPremium) return null;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 10px',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        background: 'linear-gradient(135deg, #f0c040 0%, #e09b10 100%)',
        color: '#3a2a00',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      ★ Premium
    </span>
  );
}
