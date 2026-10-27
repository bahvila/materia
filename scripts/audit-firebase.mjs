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

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 10_000 })
await page.waitForTimeout(3_000)

const report = await page.evaluate(async () => {
  const firestore = window.firebase.firestore()
  const results = []

  async function check(label, operation) {
    try {
      const detail = await operation()
      results.push({ label, status: 'ok', detail })
    } catch (error) {
      results.push({
        label,
        status: 'error',
        code: error?.code || null,
        message: error?.message || String(error),
      })
    }
  }

  let simulados = []

  await check('apostilas:list', async () => {
    const snapshot = await firestore.collection('apostilas').limit(20).get()
    return { count: snapshot.size, ids: snapshot.docs.map((doc) => doc.id) }
  })

  await check('simulados_info:list', async () => {
    const snapshot = await firestore.collection('simulados_info').limit(20).get()
    simulados = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    return { count: snapshot.size, ids: snapshot.docs.map((doc) => doc.id) }
  })

  await check('cupons_sistema:list', async () => {
    const snapshot = await firestore.collection('cupons_sistema').limit(5).get()
    return { count: snapshot.size, ids: snapshot.docs.map((doc) => doc.id) }
  })

  for (const simulado of simulados) {
    const collectionId = simulado.colecaoQuestoes || simulado.id
    await check(`questoes:${collectionId}`, async () => {
      const direct = await firestore.collection(collectionId).limit(1).get()
      if (!direct.empty) return { source: collectionId, countAtLeast: 1 }

      const fallback = await firestore.collection('questoes')
        .where('simuladoId', '==', simulado.id)
        .limit(1)
        .get()
      return { source: 'questoes', countAtLeast: fallback.empty ? 0 : 1 }
    })
  }

  await check('auth:configuration', async () => ({
    initialized: Boolean(window.firebase.auth()),
    signedIn: Boolean(window.firebase.auth().currentUser),
    authDomain: window.firebase.app().options.authDomain,
  }))

  return results
})

console.log(JSON.stringify({ report, runtimeErrors }, null, 2))
await browser.close()
