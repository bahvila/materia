import { useEffect, useState } from 'react'
import { installToastBridge, TOAST_EVENT } from '../../lib/toast'
import './toast.css'

const ICON = { success: '✓', error: '!', warning: '!', info: 'i' }

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (toast.duration === 0) return undefined
    const timer = window.setTimeout(() => onClose(toast.id), toast.duration)
    return () => window.clearTimeout(timer)
  }, [toast, onClose])

  return (
    <article
      className={`materia-toast materia-toast--${toast.type}`}
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
    >
      <span className="materia-toast__icon" aria-hidden="true">{ICON[toast.type]}</span>
      <div className="materia-toast__content">
        <strong>{toast.title}</strong>
        <p>{toast.message}</p>
      </div>
      <button className="materia-toast__close" type="button" onClick={() => onClose(toast.id)} aria-label="Fechar aviso">×</button>
      {toast.duration > 0 && <span className="materia-toast__timer" style={{ animationDuration: `${toast.duration}ms` }} />}
    </article>
  )
}

export function ToastProvider() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    installToastBridge()
    const receiveToast = ({ detail }) => {
      setToasts((current) => {
        const duplicate = current.some((toast) => toast.type === detail.type && toast.message === detail.message)
        return duplicate ? current : [...current.slice(-3), detail]
      })
    }
    window.addEventListener(TOAST_EVENT, receiveToast)
    return () => window.removeEventListener(TOAST_EVENT, receiveToast)
  }, [])

  const closeToast = (id) => setToasts((current) => current.filter((toast) => toast.id !== id))

  return (
    <aside className="materia-toast-region" aria-label="Notificações">
      {toasts.map((toast) => <Toast key={toast.id} toast={toast} onClose={closeToast} />)}
    </aside>
  )
}
