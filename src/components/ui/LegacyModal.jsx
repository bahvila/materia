import { LegacyButton } from './LegacyButton'

export function CloseModalButton({ modalId, style }) {
  return (
    <LegacyButton
      className="btn-header-entrar"
      onLegacyClick="fecharModal"
      legacyArgs={[modalId]}
      aria-label="Fechar"
      style={{ position: 'absolute', top: 16, right: 16, height: 30, ...style }}
    >
      X
    </LegacyButton>
  )
}

export function ConfirmationModal({ textId, children, modalId, confirmLabel, onConfirm }) {
  return (
    <div className="modal-alerta-branca">
      <h3 id={textId} style={{ whiteSpace: 'pre-line' }}>{children}</h3>
      <div className="botoes-alerta">
        <LegacyButton className="btn-texto-vermelho" onLegacyClick="fecharModal" legacyArgs={[modalId]}>NÃO</LegacyButton>
        <LegacyButton className="btn-fundo-verde" onLegacyClick={onConfirm}>{confirmLabel}</LegacyButton>
      </div>
    </div>
  )
}
