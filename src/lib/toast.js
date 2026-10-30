export const TOAST_EVENT = 'materia:toast'
export const TOAST_DURATION = { success: 4500, error: 7000, warning: 6000, info: 5000 }
export const TOAST_TITLE = { success: 'Tudo certo', error: 'Algo deu errado', warning: 'Atenção', info: 'Informação' }

let nextToastId = 0

export function showToast(type, message, options = {}) {
  const normalizedType = TOAST_TITLE[type] ? type : 'info'
  const detail = {
    id: ++nextToastId,
    type: normalizedType,
    message: String(message || ''),
    title: options.title || TOAST_TITLE[normalizedType],
    duration: options.duration ?? TOAST_DURATION[normalizedType],
  }
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail }))
  return detail.id
}

export function installToastBridge() {
  window.mostrarToast = showToast
  window.toastSucesso = (message, options) => showToast('success', message, options)
  window.toastErro = (message, options) => showToast('error', message, options)
  window.toastAviso = (message, options) => showToast('warning', message, options)
  window.toastInfo = (message, options) => showToast('info', message, options)
}
