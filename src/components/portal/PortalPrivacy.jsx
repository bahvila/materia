import { useState } from 'react'
import { sitePath } from '../../lib/sitePaths'

const storageKey = 'materia.aviso-privacidade'

export function PortalPrivacy() {
  const [visible, setVisible] = useState(() => {
    try { return localStorage.getItem(storageKey) !== 'lido' }
    catch { return true }
  })
  const policyUrl = sitePath('privacidade.html')

  function dismiss() {
    try { localStorage.setItem(storageKey, 'lido') }
    catch { /* The notice can still be dismissed for the current visit. */ }
    setVisible(false)
  }

  return (
    <footer className="portal-privacy">
      <a href={policyUrl}>Privacidade e cookies</a>
      {visible && (
        <div className="portal-privacy-notice" aria-label="Aviso de privacidade">
          <p>Usamos armazenamento no navegador para manter sua sessão e lembrar este aviso. <a href={policyUrl}>Saiba mais</a></p>
          <button type="button" className="btn-header-entrar" onClick={dismiss}>Entendi</button>
        </div>
      )}
    </footer>
  )
}
