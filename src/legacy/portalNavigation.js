import { currentRoute, routeUrl } from './hashedRoutes'

export const portalRoutes = {
  inicio: '/inicio',
  simulados: '/simulados',
  administrador: '/administrador/simulados',
}

const portalTitles = {
  inicio: 'Matéria',
  simulados: 'Simulados | Matéria',
  administrador: 'Administrador | Matéria',
}

export function sectionFromPath(pathname = currentRoute()) {
  const path = pathname.split('#')[0].replace(/\/+$/, '') || '/'
  const acceptedRoutes = {
    '/': 'inicio',
    '/inicio': 'inicio',
    '/simulado': 'simulados',
    '/simulados': 'simulados',
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
  container.querySelector(`#${target}`)?.classList.add('active')
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
  if (target === 'simulados') {
    container.querySelectorAll('.view-simulado').forEach((view) => view.classList.remove('active'))
    container.querySelector('#sim-view-catalogo')?.classList.add('active')
  }
  if (target === 'biblioteca') window.renderizarBibliotecaAluno?.()

  document.title = portalTitles[target]
  const destinationPath = target === 'administrador'
    ? `/administrador/${currentRoute().match(/^\/administrador\/(simulados|cupons|tags)/)?.[1] || 'simulados'}`
    : portalRoutes[target]
  const readerRoute = currentRoute()
  const destination = routeUrl(historyMode === 'none' && target === 'apostila' && readerRoute.includes('#leitor/') ? readerRoute : destinationPath)
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
