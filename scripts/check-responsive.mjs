import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'
const browser = await chromium.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true })
const page = await browser.newPage()
const failures = []
async function check(label) {
  const overflow = await page.evaluate(() => ({ width: innerWidth, actual: document.documentElement.scrollWidth, offenders: [...document.querySelectorAll('body *')].filter(e => { const r=e.getBoundingClientRect(); return r.width && (r.right > innerWidth+1 || r.left < -1) && getComputedStyle(e).position !== 'absolute' }).slice(0,6).map(e=>e.className) }))
  if (overflow.actual > overflow.width+1) failures.push({label,...overflow})
}
for (const [width,height] of [[320,740],[375,812],[768,1024],[1024,768],[1440,900],[667,375]]) {
  await page.setViewportSize({width,height})
  await page.goto('http://127.0.0.1:4173/inicio')
  await page.waitForSelector('.header-left nav')
  await check(`portal ${width}`)
  for (const modal of ['modal-auth','modal-premium','modal-config-simulado','modal-pagamento']) {
    await page.evaluate(id=>document.getElementById(id).classList.add('active'),modal)
    await check(`${modal} ${width}`)
    await page.evaluate(id=>document.getElementById(id).classList.remove('active'),modal)
  }
  for (const view of ['sub-detalhe', 'sim-view-prova', 'sim-view-resultado']) {
    await page.evaluate(id => {
      document.querySelectorAll('.tab-content, .subview-apostila, .view-simulado').forEach(e => e.classList.remove('active'))
      const element = document.getElementById(id)
      element?.classList.add('active')
      element?.closest('.tab-content')?.classList.add('active')
    }, view)
    await check(`${view} ${width}`)
  }
  await page.setContent('<style>'+readFileSync('public/legacy/admin.css','utf8')+'</style>'+readFileSync('public/legacy/admin.html','utf8'))
  for (const section of ['apostilas','simulados','cupons']) {
    await page.evaluate(section=>document.querySelectorAll('.admin-page').forEach(e=>e.classList.toggle('active',e.id===`admin-page-${section}`)),section)
    await check(`admin ${section} ${width}`)
  }
}
console.log(JSON.stringify(failures,null,2))
await browser.close()
if (failures.length) process.exitCode=1

