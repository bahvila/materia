import Stripe from 'npm:stripe@18.5.0';
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

export const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { httpClient: Stripe.createFetchHttpClient() });
export const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
export const siteUrl = () => Deno.env.get('SITE_URL')!.replace(/\/$/, '');
// Keep aligned with src/legacy/hashedRoutes.js (GitHub Pages has no path fallback).
export const routes = {
  biblioteca:'49291ef7c73676f7088cab50786f1bb053b4cc6e3d089b786b603c0bab192d15',
  simulados:'dafc1d0cb673478ddeb47017dffb37ab8b32df99d7cd8c57748bbd9460d9c1ba',
  apostila:'2df623e580bf7456b4fd54ba457b7c720734206ff9493ce9a0d6d53ec5fa289a',
  inicio:'a0c4ea6670ac009ae31b57487fc1c6f021b69383b74b77a5b93670398b78b559',
};
export function check<T extends { error: unknown }>(result: T): T { if (result.error) throw result.error; return result; }
export function cors(req: Request) {
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') || new URL(siteUrl()).origin).split(',').map(s => s.trim());
  const origin = req.headers.get('origin') || '';
  return { 'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0], 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };
}
export async function userFor(req: Request) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer /i, '');
  if (!token) throw new Error('Entre na sua conta para continuar.');
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user || data.user.is_anonymous) throw new Error('Sessão inválida. Entre novamente.');
  return data.user;
}
export async function syncSubscription(id: string) {
  const sub = await stripe.subscriptions.retrieve(id);
  const { data: customer } = check(await db.from('payment_customers').select('user_id').eq('provider', 'stripe').eq('provider_customer_id', String(sub.customer)).maybeSingle());
  const userId = customer?.user_id || sub.metadata.user_id;
  const planId = sub.metadata.plan_id;
  if (!userId || !planId || sub.metadata.application !== 'materia') return;
  const { data: plan } = check(await db.from('plans').select('id').eq('id', planId).eq('slug', 'materia-premium').single());
  const periods = sub.items.data;
  const end = Math.min(...periods.map(item => item.current_period_end));
  const start = Math.min(...periods.map(item => item.current_period_start));
  check(await db.from('subscriptions').upsert({ user_id: userId, plan_id: plan!.id, provider: 'stripe', provider_subscription_id: sub.id, provider_customer_id: String(sub.customer), status: sub.status,
    current_period_start: new Date(start * 1000).toISOString(), current_period_end: new Date(end * 1000).toISOString(), cancel_at_period_end: sub.cancel_at_period_end,
    canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null, updated_at: new Date().toISOString(),
  }, { onConflict: 'provider,provider_subscription_id' }));
}
