import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
})

const page = await browser.newPage()
const events = []
page.on('console', (message) => events.push(`console:${message.type()}: ${message.text()}`))
page.on('pageerror', (error) => events.push(`pageerror: ${error.stack || error.message}`))
page.on('requestfailed', (request) => events.push(`requestfailed: ${request.url()} — ${request.failure()?.errorText}`))
page.on('response', (response) => {
  if (response.status() >= 400) events.push(`response:${response.status()}: ${response.url()}`)
})

const targetUrl = process.argv[2] || 'http://localhost:5173'
await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 10_000 })
await page.waitForTimeout(4_000)
console.log(`title: ${await page.title()}`)
console.log(`path: ${new URL(page.url()).pathname}`)
const activeTab = page.locator('.tab-content.active')
console.log(`active-tab: ${await activeTab.count() ? activeTab.first().getAttribute('id') : 'n/a'}`)
console.log(`root: ${(await page.locator('#root').innerText()).slice(0, 300)}`)
const apostilaCards = page.locator('#grid-catalogo-apostilas .card-apostila')
const apostilaCount = await apostilaCards.count()
console.log(`apostilas: ${apostilaCount}`)
if (apostilaCount > 0) {
  const title = (await apostilaCards.first().locator('h3').innerText()).trim()
  await page.locator('#input-busca-home').fill(title)
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  console.log(`busca: "${title}" → ${await apostilaCards.count()} resultado(s)`)
}
console.log(events.join('\n'))
await browser.close()
