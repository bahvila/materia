export const portalRoutes = {
  inicio: '/inicio',
  apostila: '/apostila',
  simulados: '/simulados',
  biblioteca: '/biblioteca',
}

const portalTitles = {
  inicio: 'Matéria',
  apostila: 'Apostila | Matéria',
  simulados: 'Simulados | Matéria',
  biblioteca: 'Biblioteca | Matéria',
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
  }
  return acceptedRoutes[path] || 'inicio'
}

export function navigatePortal(section, { container = document, historyMode = 'push' } = {}) {
  const target = portalRoutes[section] ? section : 'inicio'
  container.querySelectorAll('.tab-content').forEach((tab) => tab.classList.remove('active'))
  container.querySelectorAll('.nav-btn').forEach((button) => button.classList.remove('active'))
  container.querySelector(`#${target}`)?.classList.add('active')
  container.querySelector(`.nav-btn[data-section="${target}"]`)?.classList.add('active')
  container.querySelector('#popover-cupons')?.classList.remove('active')

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
  const destination = portalRoutes[target]
  if (historyMode !== 'none' && window.location.pathname !== destination) {
    window.history[historyMode === 'replace' ? 'replaceState' : 'pushState']({ separador: target }, '', destination)
  }
}
