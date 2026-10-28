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

export function ConfirmationModal({ textId, children, modalId, confirmLabel, cancelLabel = 'NÃO', cancelClassName = 'btn-texto-vermelho', confirmClassName = 'btn-fundo-verde', onConfirm }) {
  return (
    <div className="modal-alerta-branca">
      <h3 id={textId} style={{ whiteSpace: 'pre-line' }}>{children}</h3>
      <div className="botoes-alerta">
        <LegacyButton className={cancelClassName} onLegacyClick="fecharModal" legacyArgs={[modalId]}>{cancelLabel}</LegacyButton>
        <LegacyButton className={confirmClassName} onLegacyClick={onConfirm}>{confirmLabel}</LegacyButton>
      </div>
    </div>
  )
}
