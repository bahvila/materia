import { useCallback, useEffect, useRef, useState } from 'react'
import { installSystemConfirmBridge, SYSTEM_CONFIRM_EVENT } from '../../lib/systemConfirm'

export function SystemConfirmProvider() {
  const [dialog, setDialog] = useState(null)
  const confirmButtonRef = useRef(null)

  const finish = useCallback((accepted) => {
    if (!dialog) return
    dialog.resolve(accepted)
    setDialog(null)
  }, [dialog])

  useEffect(() => {
    installSystemConfirmBridge()
    const openDialog = ({ detail }) => setDialog(detail)
    window.addEventListener(SYSTEM_CONFIRM_EVENT, openDialog)
    return () => window.removeEventListener(SYSTEM_CONFIRM_EVENT, openDialog)
  }, [])

  useEffect(() => {
    if (!dialog) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    confirmButtonRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') finish(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [dialog, finish])

  if (!dialog) return null

  return (
    <div className="materia-confirm-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) finish(false)
    }}>
      <section className="materia-confirm" role="alertdialog" aria-modal="true" aria-labelledby="materia-confirm-title" aria-describedby="materia-confirm-message">
        <div className={`materia-confirm__mark materia-confirm__mark--${dialog.tone}`} aria-hidden="true">!</div>
        <div className="materia-confirm__content">
          <h2 id="materia-confirm-title">{dialog.title}</h2>
          <p id="materia-confirm-message">{dialog.message}</p>
        </div>
        <div className="materia-confirm__actions">
          <button type="button" className="materia-confirm__cancel" onClick={() => finish(false)}>{dialog.cancelLabel}</button>
          <button ref={confirmButtonRef} type="button" className={`materia-confirm__accept materia-confirm__accept--${dialog.tone}`} onClick={() => finish(true)}>{dialog.confirmLabel}</button>
        </div>
      </section>
    </div>
  )
}
