export const portalRoutes = {
  inicio: '/inicio',
  apostila: '/apostila',
  simulados: '/simulados',
  biblioteca: '/biblioteca',
  administrador: '/administrador/apostilas',
}

const portalTitles = {
  inicio: 'Matéria',
  apostila: 'Apostila | Matéria',
  simulados: 'Simulados | Matéria',
  biblioteca: 'Biblioteca | Matéria',
  administrador: 'Administrador | Matéria',
}

export function sectionFromPath(pathname = window.location.pathname) {
  const path = pathname.replace(/\/+$/, '') || '/'
  const acceptedRoutes = {
    '/': 'inicio',
    '/inicio': 'inicio',
    '/apostila': 'apostila',
    '/apostilas': 'apostila',
    '/simulado': 'simulados',
    '/simulados': 'simulados',
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
  container.querySelector(`#${target}`)?.classList.add('active')
  container.querySelector(`.nav-btn[data-section="${target}"]`)?.classList.add('active')
  container.querySelector('#popover-cupons')?.classList.remove('active')
  container.querySelector('#popover-usuario')?.classList.remove('active')

  if (target === 'administrador') {
    const frame = container.querySelector('#admin-legacy-frame')
    const adminSection = window.location.pathname.match(/^\/administrador\/(apostilas|simulados|cupons)/)?.[1] || 'apostilas'
    const frameSource = `/admin?section=${adminSection}`
    if (frame && !frame.src) frame.src = frameSource
    else if (frame?.contentWindow?.navegarAdmin) frame.contentWindow.navegarAdmin(adminSection, false)
  }

  if (target === 'apostila') {
    container.querySelectorAll('.subview-apostila').forEach((view) => view.classList.remove('active'))
    container.querySelector('#sub-catalogo')?.classList.add('active')
  }
  if (target === 'simulados') {
    container.querySelectorAll('.view-simulado').forEach((view) => view.classList.remove('active'))
    container.querySelector('#sim-view-lobby')?.classList.add('active')
  }
  if (target === 'biblioteca') window.renderizarBibliotecaAluno?.()

  document.title = portalTitles[target]
  const destination = target === 'administrador'
    ? `/administrador/${window.location.pathname.match(/^\/administrador\/(apostilas|simulados|cupons)/)?.[1] || 'apostilas'}`
    : portalRoutes[target]
  if (requestedTarget !== target && window.location.pathname !== destination) {
    window.history.replaceState({ separador: target }, '', destination)
  } else if (historyMode !== 'none' && window.location.pathname !== destination) {
    window.history[historyMode === 'replace' ? 'replaceState' : 'pushState']({ separador: target }, '', destination)
  }
}
