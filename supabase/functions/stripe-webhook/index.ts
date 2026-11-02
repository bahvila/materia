import Stripe from 'npm:stripe@18.5.0';
import { stripe, db, check, syncSubscription } from '../_shared/stripe.ts';

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status:405 });
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), req.headers.get('stripe-signature') || '', Deno.env.get('STRIPE_WEBHOOK_SECRET')!, undefined, Stripe.createSubtleCryptoProvider());
  } catch { return new Response('Invalid signature', { status:400 }); }
  try {
    const { data: processed } = check(await db.from('payment_webhook_events').select('status').eq('provider','stripe').eq('provider_event_id',event.id).maybeSingle());
    if (processed?.status === 'processed') return Response.json({ received:true });
    if (['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)) {
      const session = await stripe.checkout.sessions.retrieve((event.data.object as Stripe.Checkout.Session).id);
      if (session.metadata?.application === 'materia' && session.payment_status === 'paid') {
        const { data: order } = check(await db.from('stripe_checkout_orders').select('*').eq('id',session.metadata.order_id).single());
        if (order!.user_id !== session.client_reference_id) throw new Error('User mismatch');
        let refunded = false;
        if (session.payment_intent) {
          const intent = await stripe.paymentIntents.retrieve(String(session.payment_intent), { expand:['latest_charge'] });
          const charge = intent.latest_charge as Stripe.Charge | null;
          refunded = Boolean(charge?.refunded);
        }
        check(await db.rpc('fulfill_stripe_order',{ order_uuid:order!.id,session_id:session.id,intent_id:session.payment_intent ? String(session.payment_intent) : null,amount:session.amount_total,currency_code:session.currency,refund:refunded }));
        if (session.subscription) await syncSubscription(String(session.subscription));
      }
    } else if (event.type.startsWith('customer.subscription.')) {
      await syncSubscription((event.data.object as Stripe.Subscription).id);
    } else if (['invoice.paid','invoice.payment_failed'].includes(event.type)) {
      const invoice = event.data.object as Stripe.Invoice;
      const subscription = invoice.parent?.subscription_details?.subscription;
      if (subscription) await syncSubscription(String(subscription));
    } else if (event.type === 'charge.refunded') {
      const charge = await stripe.charges.retrieve((event.data.object as Stripe.Charge).id);
      if (charge.refunded && charge.payment_intent) {
        const { data: order } = check(await db.from('stripe_checkout_orders').select('*').eq('payment_intent_id',String(charge.payment_intent)).maybeSingle());
        if (order) check(await db.rpc('fulfill_stripe_order',{ order_uuid:order.id,session_id:order.checkout_session_id,intent_id:String(charge.payment_intent),amount:order.total_centavos,currency_code:order.currency,refund:true }));
      }
    }
    check(await db.from('payment_webhook_events').upsert({ provider:'stripe',provider_event_id:event.id,event_type:event.type,payload:event,status:'processed',processed_at:new Date().toISOString() },{ onConflict:'provider,provider_event_id' }));
    return Response.json({ received:true });
  } catch {
    // Non-2xx instructs Stripe to retry. Never acknowledge a failed grant.
    console.error('Stripe event processing failed',event.id,event.type);
    return new Response('Processing failed', { status:500 });
  }
});
