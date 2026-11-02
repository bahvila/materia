import { readFile } from 'node:fs/promises'
import { createHmac } from 'node:crypto'
import assert from 'node:assert/strict'

async function env(path) {
  return Object.fromEntries((await readFile(new URL(path,import.meta.url),'utf8')).replace(/^\uFEFF/,'').split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => [line.slice(0,line.indexOf('=')),line.slice(line.indexOf('=')+1)]))
}
const frontend = await env('../.env.local')
const backend = await env('../supabase/.env.stripe.local')
const base = frontend.VITE_SUPABASE_URL
const key = frontend.VITE_SUPABASE_PUBLISHABLE_KEY
const headers = { apikey:key, 'Content-Type':'application/json' }
for (const table of ['apostilas','simulados']) {
  const response = await fetch(`${base}/rest/v1/${table}?select=id,titulo&limit=1`,{ headers })
  assert.equal(response.status,200,`${table} public catalog`)
}
for (const [table,column] of [['apostilas','pdf_path'],['simulados','questoes']]) {
  const response = await fetch(`${base}/rest/v1/${table}?select=${column}&limit=1`,{ headers })
  assert.ok([401,403].includes(response.status),`${column} must be private`)
}
const plans = await fetch(`${base}/rest/v1/plans?slug=eq.materia-premium&select=preco_centavos`,{ headers }).then(response => response.json())
assert.equal(plans[0]?.preco_centavos,2499)
for (const name of ['stripe-checkout','stripe-portal']) {
  const response = await fetch(`${base}/functions/v1/${name}`,{ method:'POST',headers,body:JSON.stringify({ tipo:'premium' }) })
  assert.equal(response.status,400,`${name} must require authenticated user`)
}
const webhook = `${base}/functions/v1/stripe-webhook`
const invalid = await fetch(webhook,{ method:'POST',headers:{'Content-Type':'application/json'},body:'{}' })
assert.equal(invalid.status,400,'unsigned webhook must fail')
const body = JSON.stringify({ id:'evt_materia_signature_probe',type:'checkout.session.completed',data:{object:{id:'cs_test_materia_nonexistent_signature_probe'}} })
const timestamp = Math.floor(Date.now()/1000)
const signature = createHmac('sha256',backend.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest('hex')
const signed = await fetch(webhook,{method:'POST',headers:{'Content-Type':'application/json','stripe-signature':`t=${timestamp},v1=${signature}`},body})
assert.equal(signed.status,500,'signed event accepted but nonexistent Stripe session must not be acknowledged')
console.log('Remote checks passed: public catalogs, protected PDFs/questions, premium price, authentication, webhook signature and failed-payment retry response.')
