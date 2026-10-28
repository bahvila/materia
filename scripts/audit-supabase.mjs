import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
})

const page = await browser.newPage()
const runtimeErrors = []
page.on('pageerror', (error) => runtimeErrors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') runtimeErrors.push(message.text())
})

await page.goto(process.argv[2] || 'http://localhost:5173/inicio', {
  waitUntil: 'domcontentloaded',
  timeout: 15_000,
})
await page.waitForTimeout(3_000)

const report = await page.evaluate(async () => {
  if (!window.supabase) return { configured: false, tables: [] }
  const tables = [
    ['plans', 'id'],
    ['apostilas', 'id,capa_path,pdf_path'],
    ['simulados', 'id,questoes'],
    ['profiles', 'id,metadata'],
    ['subscriptions', 'id'],
    ['attempts', 'id,respostas'],
  ]
  const results = []
  for (const [table, columns] of tables) {
    const { data, error } = await window.supabase.from(table).select(columns).limit(1)
    results.push({
      table,
      status: error ? 'error' : 'ok',
      count: data?.length || 0,
      code: error?.code || null,
      message: error?.message || null,
    })
  }
  const { data: authData } = await window.supabase.auth.getSession()
  return {
    configured: true,
    signedIn: Boolean(authData.session),
    tables: results,
  }
})

console.log(JSON.stringify({ report, runtimeErrors }, null, 2))
await browser.close()

