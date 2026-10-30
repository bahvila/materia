export const SYSTEM_CONFIRM_EVENT = 'materia:confirm'

let nextConfirmId = 0

export function requestSystemConfirm(options = {}) {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent(SYSTEM_CONFIRM_EVENT, {
      detail: {
        id: ++nextConfirmId,
        title: options.title || 'Confirmar ação',
        message: options.message || 'Deseja continuar?',
        confirmLabel: options.confirmLabel || 'Confirmar',
        cancelLabel: options.cancelLabel || 'Cancelar',
        tone: options.tone || 'default',
        resolve,
      },
    }))
  })
}

export function installSystemConfirmBridge() {
  window.confirmarAcao = (options) => {
    try {
      if (window.parent !== window && typeof window.parent.confirmarAcao === 'function') {
        return window.parent.confirmarAcao(options)
      }
    } catch (error) {
      console.warn('Não foi possível abrir a confirmação na janela principal:', error)
    }
    return requestSystemConfirm(options)
  }
}
