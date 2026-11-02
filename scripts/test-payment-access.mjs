import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const db = new PGlite()
const sql = path => readFile(new URL(`../supabase/migrations/${path}`, import.meta.url), 'utf8')
await db.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
 create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant usage on schema storage to anon, authenticated;
 grant select on storage.objects to anon, authenticated;
`)
await db.exec((await sql('202610280001_initial_schema.sql')).replace('create extension if not exists pgcrypto;', ''))
await db.exec(await sql('202610280002_client_access.sql'))
await db.exec(`alter table public.simulados add column tags text[] not null default '{}'; grant all on all tables in schema public to anon, authenticated, service_role;`)
await db.exec(await sql('202611020001_stripe_access.sql'))
const user = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const ap = '33333333-3333-4333-8333-333333333333'
const sim = '44444444-4444-4444-8444-444444444444'
const order = '55555555-5555-4555-8555-555555555555'
const simOrder = '66666666-6666-4666-8666-666666666666'
await db.exec(`
 insert into auth.users values('${user}'),('${other}');
 insert into profiles(id) values('${user}'),('${other}');
 insert into apostilas(id,titulo,slug,status,pdf_path,preview_pdf_path,preco_centavos) values('${ap}','Apostila','apostila','publicado','private/full.pdf','preview/sample.pdf',1499);
 insert into simulados(id,titulo,slug,status,questoes,preco_centavos) values('${sim}','Simulado','simulado','publicado','[{"enunciado":"protegido"}]',999);
 insert into storage.objects(bucket_id,name) values('apostila-pdfs','private/full.pdf'),('apostila-pdfs','preview/sample.pdf');
 insert into stripe_checkout_orders(id,user_id,tipo,apostila_id,total_centavos,checkout_session_id) values('${order}','${user}','apostila','${ap}',1499,'cs_ap');
 insert into stripe_checkout_orders(id,user_id,tipo,simulado_id,total_centavos,checkout_session_id) values('${simOrder}','${user}','simulado','${sim}',999,'cs_sim');
`)
async function as(role, uid = '') {
  await db.exec(`reset role; set role ${role}; select set_config('test.uid','${uid}',false);`)
}
async function value(query) { return Object.values((await db.query(query)).rows[0])[0] }
async function denied(query) { await assert.rejects(db.query(query)) }
await as('anon')
assert.equal(await value('select count(*)::int from simulados'),1)
await denied('select questoes from simulados')
await denied('select pdf_path from apostilas')
await denied(`select get_simulado_questions('${sim}')`)
await as('authenticated',user)
assert.equal(await value('select has_premium_access()'),false)
await denied(`select get_simulado_questions('${sim}')`)
await denied(`select get_apostila_pdf('${ap}')`)
assert.equal(await value(`select get_apostila_pdf('${ap}',true)`),'preview/sample.pdf')
assert.equal(await value('select count(*)::int from storage.objects'),1)
await denied(`select fulfill_stripe_order('${order}','cs_ap','pi_ap',1499,'brl')`)
await denied(`insert into user_simulados(user_id,simulado_id) values('${user}','${sim}')`)
await denied('truncate user_simulados')
await denied('truncate stripe_checkout_orders cascade')
await denied(`insert into user_apostilas(user_id,apostila_id,origem) values('${user}','${ap}','forged')`)
await db.exec(`update profiles set metadata = '{"isPremium":true,"bibliotecaIds":["${ap}"]}' where id = '${user}'`)
assert.equal(await value('select has_premium_access()'),false)
await as('service_role')
await denied(`select fulfill_stripe_order('${order}','cs_ap','pi_ap',1,'brl')`)
await db.query(`select fulfill_stripe_order('${order}','cs_ap','pi_ap',1499,'brl')`)
await db.query(`select fulfill_stripe_order('${order}','cs_ap','pi_ap',1499,'brl')`)
await as('authenticated',user)
assert.equal(await value(`select get_apostila_pdf('${ap}')`),'private/full.pdf')
assert.equal(await value('select count(*)::int from user_apostilas'),1)
assert.equal(await value('select count(*)::int from storage.objects'),2)
await denied(`select get_simulado_questions('${sim}')`)
await as('authenticated',other)
await denied(`select get_apostila_pdf('${ap}')`)
assert.equal(await value('select count(*)::int from stripe_checkout_orders'),0)
await as('service_role')
await db.query(`select fulfill_stripe_order('${simOrder}','cs_sim','pi_sim',999,'brl')`)
await as('authenticated',user)
assert.equal((await value(`select get_simulado_questions('${sim}')`))[0].enunciado,'protegido')
await as('service_role')
await db.query(`select fulfill_stripe_order('${order}','cs_ap','pi_ap',1499,'brl',true)`)
await db.query(`select fulfill_stripe_order('${order}','cs_ap','pi_ap',1499,'brl')`)
await as('authenticated',user)
await denied(`select get_apostila_pdf('${ap}')`)
await as('service_role')
await db.query(`insert into subscriptions(user_id,plan_id,status,provider,provider_subscription_id,current_period_end) select '${other}',id,'active','stripe','sub_test',now()+interval '1 month' from plans where slug='materia-premium'`)
await as('authenticated',other)
assert.equal(await value('select has_premium_access()'),true)
assert.equal(await value(`select get_apostila_pdf('${ap}')`),'private/full.pdf')
assert.equal((await value(`select get_simulado_questions('${sim}')`)).length,1)
await as('service_role')
await db.exec(`update subscriptions set current_period_end = now()-interval '1 second' where provider_subscription_id='sub_test'`)
await as('authenticated',other)
assert.equal(await value('select has_premium_access()'),false)
await denied(`select get_simulado_questions('${sim}')`)
await as('service_role')
await db.exec(`update subscriptions set current_period_end = now()+interval '1 month', status='canceled' where provider_subscription_id='sub_test'`)
await as('authenticated',other)
assert.equal(await value('select has_premium_access()'),false)
await as('service_role')
await db.query(`select fulfill_stripe_order('${simOrder}','cs_sim','pi_sim',999,'brl',true)`)
await as('authenticated',user)
await denied(`select get_simulado_questions('${sim}')`)
await as('service_role')
await db.exec(`update profiles set tipo_usuario='admin' where id='${user}'; update simulados set status='rascunho' where id='${sim}';`)
await as('authenticated',user)
assert.equal((await value(`select get_simulado_questions('${sim}')`)).length,1)
assert.equal(await value(`select get_apostila_pdf('${ap}')`),'private/full.pdf')
await db.close()
console.log('Payment access tests passed: public catalog, private content, forged grants, purchases, isolation, idempotency, refunds, premium and expiry.')
