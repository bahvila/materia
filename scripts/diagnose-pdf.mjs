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
  if (/\.pdf(?:\?|$)|pdf\.worker|firebasestorage/i.test(response.url())) {
    events.push(`response:${response.status()}: ${response.url()}`)
  }
})

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 10_000 })
await page.waitForTimeout(4_000)

const started = await page.evaluate(() => {
  window.mudarSeparador('apostila')
  const card = document.querySelector('#grid-catalogo-apostilas .card-apostila')
  if (!card) return false
  card.click()
  window.iniciarLeituraPDF(true)
  return true
})

await page.waitForTimeout(8_000)

const state = await page.evaluate(() => {
  const canvas = document.getElementById('pdf-render')
  const context = canvas.getContext('2d')
  const width = canvas.width
  const height = canvas.height
  let nonTransparent = 0
  let nonWhite = 0

  if (width && height) {
    const stepX = Math.max(1, Math.floor(width / 40))
    const stepY = Math.max(1, Math.floor(height / 40))
    for (let y = 0; y < height; y += stepY) {
      for (let x = 0; x < width; x += stepX) {
        const [r, g, b, a] = context.getImageData(x, y, 1, 1).data
        if (a > 0) nonTransparent += 1
        if (a > 0 && (r < 245 || g < 245 || b < 245)) nonWhite += 1
      }
    }
  }

  return {
    started: true,
    canvas: { width, height, cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight },
    pixels: { nonTransparent, nonWhite },
    pageNumber: document.getElementById('page-num')?.textContent,
    pageCount: document.getElementById('page-count')?.textContent,
  }
})

console.log(JSON.stringify({ started, state, events }, null, 2))
await browser.close()
