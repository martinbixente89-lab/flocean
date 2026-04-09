# 🎯 Flocean Premium — Guide d'intégration

## Architecture

```
Stripe Checkout → Edge Function webhook → user_subscriptions (Supabase)
                                              ↓
                              RLS protège les features backend
                                              ↓
                           Frontend lit le statut (lecture seule)
```

---

## 1. Appliquer la migration SQL

Dans le dashboard Supabase → SQL Editor, exécute :
```
supabase/migrations/001_user_subscriptions.sql
```

Ou via CLI :
```bash
npx supabase db push
```

---

## 2. Déployer la Edge Function webhook

```bash
npx supabase functions deploy stripe-webhook --no-verify-jwt
```

> `--no-verify-jwt` est **obligatoire** : Stripe n'envoie pas de JWT Supabase.

### Variables d'environnement à configurer

Dans Supabase Dashboard → Edge Functions → stripe-webhook → Secrets :

| Variable | Valeur |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` (ou `sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (depuis Stripe Dashboard) |

---

## 3. Configurer le Webhook dans Stripe

1. Stripe Dashboard → Webhooks → Add endpoint
2. URL : `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
3. Events à écouter :
   - `checkout.session.completed`
   - `invoice.paid`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

---

## 4. Checkout Stripe — passer le user_id en metadata

Lors de la création de ta session Stripe Checkout côté serveur, ajoute la metadata :

```ts
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  customer_email: user.email,
  line_items: [{ price: 'price_XXXX', quantity: 1 }],
  success_url: `${YOUR_DOMAIN}/dashboard?upgraded=1`,
  cancel_url: `${YOUR_DOMAIN}/upgrade`,
  metadata: {
    supabase_user_id: user.id,  // <-- clé indispensable
  },
  subscription_data: {
    metadata: {
      supabase_user_id: user.id,  // aussi sur la subscription pour les renewals
    },
  },
});
```

---

## 5. Utiliser dans le frontend

### Hook React
```tsx
import { useSubscription } from '@/lib/subscription'

function MyComponent() {
  const { isPremium, plan, status, loading } = useSubscription(supabase)

  if (loading) return <Spinner />
  return isPremium ? <PremiumView /> : <FreeView />
}
```

### Gate (wrapper)
```tsx
import { PremiumGate } from '@/components/PremiumGate'

<PremiumGate supabase={supabase}>
  <FeatureAccesFocus />
</PremiumGate>
```

### Badge dans le menu
```tsx
import { PremiumBadge } from '@/components/PremiumBadge'

<nav>
  <span>{user.name}</span>
  <PremiumBadge supabase={supabase} />
</nav>
```

---

## 6. Protéger une feature côté backend (RLS)

Pour une table premium (ex: `focus_sessions_advanced`) :

```sql
CREATE POLICY "premium_only"
  ON public.focus_sessions_advanced
  FOR ALL
  USING (
    public.is_premium(auth.uid())
  );
```

L'utilisateur ne peut accéder à la table que si `is_premium()` retourne `true`.

---

## Checklist de déploiement

- [ ] Migration SQL appliquée
- [ ] Edge Function déployée avec `--no-verify-jwt`
- [ ] `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` configurés dans Supabase
- [ ] Webhook Stripe pointant vers l'URL Supabase
- [ ] Metadata `supabase_user_id` passée dans le Checkout
- [ ] Tester avec `stripe trigger checkout.session.completed`
