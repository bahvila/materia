import { readFile, appendFile, writeFile } from 'node:fs/promises'

// Test-mode provisioning only. Secrets are read from an ignored server env file.
const envPath = new URL('../supabase/.env.stripe.local', import.meta.url)
let contents = await readFile(envPath, 'utf8')
const env = Object.fromEntries(contents.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => [line.slice(0,line.indexOf('=')),line.slice(line.indexOf('=')+1)]))
if (!env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) throw new Error('Only Stripe test keys are accepted')
const ref = (await readFile(new URL('../supabase/.temp/project-ref', import.meta.url),'utf8')).trim()
const url = `https://${ref}.supabase.co/functions/v1/stripe-webhook`
async function stripe(path, data) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: data ? 'POST' : 'GET',
    headers: { Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`, ...(data ? { 'Content-Type':'application/x-www-form-urlencoded' } : {}) },
    body: data ? new URLSearchParams(data) : undefined,
  })
  const result = await response.json()
  if (!response.ok) throw new Error(`Stripe ${response.status}: ${result.error?.message || 'Request failed'}`)
  return result
}
const endpoints = await stripe('webhook_endpoints?limit=100')
const existing = endpoints.data.find(endpoint => endpoint.url === url && endpoint.metadata?.application === 'materia')
const events = ['checkout.session.completed','checkout.session.async_payment_succeeded','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','customer.subscription.paused','customer.subscription.resumed','invoice.paid','invoice.payment_failed','charge.refunded']
if (!existing) {
  const data = { url,'metadata[application]':'materia',api_version:'2025-08-27.basil' }
  events.forEach((event,index) => { data[`enabled_events[${index}]`] = event })
  const endpoint = await stripe('webhook_endpoints',data)
  contents = contents.replace(/^STRIPE_WEBHOOK_SECRET=.*\r?\n?/m,'')
  await writeFile(envPath,contents.trimEnd() + `\nSTRIPE_WEBHOOK_SECRET=${endpoint.secret}\n`,'utf8')
  console.log('Test webhook created and signing secret saved to ignored backend environment file.')
} else {
  if (!env.STRIPE_WEBHOOK_SECRET) throw new Error('Webhook already exists; add its signing secret to supabase/.env.stripe.local from Stripe Workbench.')
  console.log('Existing test webhook reused.')
}
const configurations = await stripe('billing_portal/configurations?limit=100')
let configuration = configurations.data.find(item => item.metadata?.application === 'materia')
if (!configuration) {
  configuration = await stripe('billing_portal/configurations',{
    'metadata[application]':'materia',
    'business_profile[headline]':'Gerencie sua assinatura Matéria Premium',
    'features[invoice_history][enabled]':'true',
    'features[payment_method_update][enabled]':'true',
    'features[subscription_cancel][enabled]':'true',
    'features[subscription_cancel][mode]':'at_period_end',
  })
}
contents = (await readFile(envPath,'utf8')).replace(/^STRIPE_PORTAL_CONFIGURATION_ID=.*\r?\n?/m,'')
await writeFile(envPath,contents.trimEnd() + `\nSTRIPE_PORTAL_CONFIGURATION_ID=${configuration.id}\n`,'utf8')
// The publishable key is unnecessary for hosted Checkout; browsers use the session URL.
await appendFile(new URL('../supabase/.temp/stripe-provisioned',import.meta.url),`${new Date().toISOString()} test webhook configured\n`)
console.log('Stripe test billing portal configured.')
