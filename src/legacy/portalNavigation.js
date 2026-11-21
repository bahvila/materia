import { currentRoute, routeUrl } from './hashedRoutes'
import { siteBase } from '../lib/sitePaths'

export const portalRoutes = {
  inicio: '/inicio',
  simulados: '/simulados',
  historico: '/historico',
  biblioteca: '/biblioteca',
  apostila: '/apostila',
  administrador: '/administrador/simulados',
}

const portalTitles = {
  inicio: 'Matéria',
  simulados: 'Simulados online para a ANAC | Matéria',
  historico: 'Histórico de simulados | Matéria',
  biblioteca: 'Biblioteca | Matéria',
  apostila: 'Apostilas | Matéria',
  administrador: 'Administrador | Matéria',
}

export function sectionFromPath(pathname = currentRoute()) {
  const path = pathname.split('#')[0].replace(/\/+$/, '') || '/'
  const acceptedRoutes = {
    '/': 'simulados',
    '/inicio': 'inicio',
    '/simulado': 'simulados',
    '/simulados': 'simulados',
    '/historico': 'historico',
    '/apostila': 'apostila',
    '/biblioteca': 'biblioteca',
    '/administrador': 'administrador',
  }
  if (path.startsWith('/administrador/')) return 'administrador'
  return acceptedRoutes[path] || 'inicio'
}

export function navigatePortal(section, { container = document, historyMode = 'push' } = {}) {
  const requestedTarget = portalRoutes[section] ? section : 'inicio'
  const target = requestedTarget === 'administrador' && window.portalAdminAuthorized !== true ? 'inicio' : requestedTarget
  container.querySelectorAll('.tab-content').forEach((tab) => tab.classList.remove('active'))
  container.querySelectorAll('.nav-btn').forEach((button) => button.classList.remove('active'))
  container.querySelector(`#${target === 'historico' ? 'simulados' : target}`)?.classList.add('active')
  container.querySelector(`.nav-btn[data-section="${target}"]`)?.classList.add('active')
  container.querySelector('#popover-cupons')?.classList.remove('active')
  container.querySelector('#popover-usuario')?.classList.remove('active')

  if (target === 'administrador') {
    const frame = container.querySelector('#admin-legacy-frame')
    const adminSection = currentRoute().match(/^\/administrador\/(simulados|cupons|tags)/)?.[1] || 'simulados'
    const frameSource = routeUrl(`/admin?section=${adminSection}`)
    if (frame && !frame.src) frame.src = frameSource
    else if (frame?.contentWindow?.navegarAdmin) frame.contentWindow.navegarAdmin(adminSection, false)
  }

  if (target === 'apostila') {
    container.querySelectorAll('.subview-apostila').forEach((view) => view.classList.remove('active'))
    container.querySelector('#sub-catalogo')?.classList.add('active')
    window.restaurarApostilaPeloHash?.()
  }
  if (target === 'simulados' || target === 'historico') {
    container.querySelectorAll('.view-simulado').forEach((view) => view.classList.remove('active'))
    if (target === 'historico') {
      container.querySelector('#sim-view-historico')?.classList.add('active')
      window.abrirTelaHistorico?.()
    } else {
      container.querySelector('#sim-view-lobby')?.classList.add('active')
      window.voltarParaLobbySimulado?.()
    }
  }
  if (target === 'biblioteca') window.renderizarBibliotecaAluno?.()

  document.title = portalTitles[target]
  const destinationPath = target === 'administrador'
    ? `/administrador/${currentRoute().match(/^\/administrador\/(simulados|cupons|tags)/)?.[1] || 'simulados'}`
    : portalRoutes[target]
  const readerRoute = currentRoute()
  const path = historyMode === 'none' && target === 'apostila' && readerRoute.includes('#leitor/') ? readerRoute : destinationPath
  const url = new URL(path === '/simulados' ? siteBase : routeUrl(path), window.location.origin)
  if (historyMode === 'none') url.search = window.location.search
  const destination = url.pathname + url.search + url.hash
  if (requestedTarget !== target && window.portalAdminAuthorized === undefined) {
    const pendingUrl = routeUrl(currentRoute())
    if (window.location.pathname + window.location.search + window.location.hash !== pendingUrl) {
      window.history.replaceState(window.history.state, '', pendingUrl)
    }
    return
  }
  if (window.location.pathname + window.location.search + window.location.hash !== destination) {
    window.history[historyMode === 'push' ? 'pushState' : 'replaceState']({ separador: target }, '', destination)
  }
}
