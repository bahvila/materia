export function callLegacy(functionName, ...args) {
  const handler = window[functionName]
  if (typeof handler === 'function') return handler(...args)
  console.error(`Função legada indisponível: ${functionName}`)
}

