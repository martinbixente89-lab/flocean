/**
 * Supabase Edge Function — Stripe Webhook
 *
 * Deploy with:
 *   supabase functions deploy stripe-webhook --no-verify-jwt
 *
 * Set env vars in Supabase dashboard:
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!  // service role bypasses RLS
);

const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

serve(async (req) => {
  // Verify webhook signature
  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('No signature', { status: 400 });

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    await handleEvent(event);
    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error handling event:', err);
    return new Response('Internal server error', { status: 500 });
  }
});

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    // ── New checkout completed ──────────────────────────────────
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.supabase_user_id;
      if (!userId) throw new Error('Missing supabase_user_id in session metadata');

      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string
      );

      await upsertSubscription(userId, subscription, session.customer as string);
      break;
    }

    // ── Invoice paid (renewal) ──────────────────────────────────
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
      const userId = sub.metadata?.supabase_user_id;
      if (userId) await upsertSubscription(userId, sub, invoice.customer as string);
      break;
    }

    // ── Subscription updated ────────────────────────────────────
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.supabase_user_id;
      if (userId) await upsertSubscription(userId, sub, sub.customer as string);
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
}

async function upsertSubscription(
  userId: string,
  subscription: Stripe.Subscription,
  customerId: string
) {
  const isPremium =
    subscription.status === 'active' || subscription.status === 'trialing';

  const { error } = await supabase
    .from('user_subscriptions')
    .upsert(
      {
        user_id: userId,
        plan: isPremium ? 'premium' : 'free',
        status: subscription.status as string,
        current_period_end: new Date(
          subscription.current_period_end * 1000
        ).toISOString(),
        provider: 'stripe',
        provider_customer_id: customerId,
        provider_subscription_id: subscription.id,
      },
      { onConflict: 'user_id' }
    );

  if (error) throw error;
  console.log(`Updated subscription for user ${userId}: ${subscription.status}`);
}
