import { localPath, siteBase } from '../lib/sitePaths'

// Stable route identifiers keep links valid across reloads and builds.
const hashes = {
  "/inicio": "a0c4ea6670ac009ae31b57487fc1c6f021b69383b74b77a5b93670398b78b559",
  "/apostila": "2df623e580bf7456b4fd54ba457b7c720734206ff9493ce9a0d6d53ec5fa289a",
  "/simulados": "dafc1d0cb673478ddeb47017dffb37ab8b32df99d7cd8c57748bbd9460d9c1ba",
  "/biblioteca": "49291ef7c73676f7088cab50786f1bb053b4cc6e3d089b786b603c0bab192d15",
  "/administrador/apostilas": "517a675fd46066810b8f6b1a6a51f794e8ed261b94fefd1bc33302f7ef8fa007",
  "/administrador/simulados": "b3915f368c618a355940c6c4e45b0d05f2ec8adc1f6b13f85acfbabf022f0784",
  "/administrador/cupons": "36b25277bb0e54c0ddad903dad431edcb74654deda485540f9095d649a731c7d",
  "/administrador/tags": "d14eedf037c01e95bdfd97ca902eee6b08aabf9bcbd340ecfb72151f202f8347",
  "/admin": "419a772b9a350cef8e3bd345492b930f39ba25b603727a8febf56043123237f6",
  "/admin?section=apostilas": "bfe990ac920aed25740b0a8afd395987a1a84953d4ea11c4f689543b7ffaead5",
  "/admin?section=simulados": "8b9ad45091d762dbe1afcd65a9cb083628550767b564b6173d6d61c320ca03ab",
  "/admin?section=cupons": "2c2c091e876f63e8ef0c677ac4c3661081a0eeee0530e9ff5f0021d27ca2954a",
  "/admin?section=tags": "2633add16b8c3e2fa77df6e590adfc2955f2a5e9a9a07925cab689d92a3fda63"
}

export function routeUrl(path) {
  const reader = path.match(/^\/apostila#leitor\/([a-f0-9]{64})$/)
  if (reader) return siteBase + '#' + reader[1]
  return siteBase + '#' + (hashes[path] || hashes['/inicio'])
}

export function currentRoute() {
  const hash = window.location.hash.slice(1)
  const known = Object.keys(hashes).find(path => hashes[path] === hash)
  if (known) return known
  if (/^[a-f0-9]{64}$/.test(hash)) return '/apostila#leitor/' + hash
  const path = localPath(window.location.pathname)
  return path + (path === '/admin' ? window.location.search : '') + (window.location.hash.startsWith('#leitor/') ? window.location.hash : '')
}

window.portalRouteUrl = routeUrl
window.portalCurrentRoute = currentRoute
