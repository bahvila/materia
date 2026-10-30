import { sitePath } from '../../lib/sitePaths'
import { LegacyButton } from '../ui/LegacyButton'
import { CloseModalButton, ConfirmationModal } from '../ui/LegacyModal'
import { callLegacy } from '../../legacy/legacyBridge'

const freeBenefits = [
  [true, 'Simulados gabaritados'],
  [true, '1 simulado por mês'],
  [false, 'Simulados personalizados'],
  [false, 'Questões comentadas'],
  [false, 'Acesso completo a todos os materiais da plataforma'],
  [false, '1 Cupom de 100% off para apostila após cada renovação'],
]

const premiumBenefits = [
  [true, 'Simulados gabaritados'],
  [true, 'Simulados ilimitados'],
  [true, 'Simulados personalizados'],
  [true, 'Questões comentadas'],
  [true, 'Acesso completo a todos os materiais da plataforma'],
  [true, '1 Cupom de 100% off para apostila após cada renovação'],
]

function BenefitList({ title, benefits, premium = false }) {
  return (
    <div className="col-plano">
      <h3 style={premium ? { fontFamily: "'Cinzel', serif", color: '#382922' } : undefined}>{title}</h3>
      {benefits.map(([enabled, text]) => (
        <div className="item-beneficio" key={text}>
          <span className={`quad-check ${enabled ? 'verde' : 'vermelho'}`}>{enabled ? '✔' : '✖'}</span>
          {text}
        </div>
      ))}
    </div>
  )
}

export function PremiumModal() {
  return (
    <div className="modal-caixa-premium">
      <CloseModalButton modalId="modal-premium" style={{ top: 18, right: 18, height: 32, padding: '0 12px' }} />
      <div className="grid-premium-layout">
        <div className="cartao-duplo-planos">
          <BenefitList title="Free" benefits={freeBenefits} />
          <BenefitList title="PREMIUM" benefits={premiumBenefits} premium />
        </div>
        <div className="coluna-direita-assinatura">
          <img className="premium-marca-imagem" src={sitePath('/assets/íconemateriapremium.png')} alt="Matéria Premium" />
          <div className="preco-gigante">R$ 24,<small>99</small></div>
          <LegacyButton className="btn-dourado-assinar" onLegacyClick="abrirCheckoutPagamento" legacyArgs={['Assinatura Matéria Premium', '24,99', 'premium']}>ASSINE AGORA</LegacyButton>
        </div>
      </div>
    </div>
  )
}

export function SimulationConfigModal() {
  return (
    <div className="modal-marrom-padrao">
      <CloseModalButton modalId="modal-config-simulado" style={{ top: 18, right: 18, height: 32, padding: '0 12px' }} />
      <h2 id="titulo-config-modal" style={{ textAlign: 'center', margin: 0, fontSize: 28 }}>Simulado X</h2>
      <div className="grid-modos-simulado">
        <div className="card-branco-modo">
          <div>
            <h3>Modo Banca</h3>
            <p style={{ fontSize: 14, fontWeight: 500 }}>Simula as condições reais de um concurso.</p>
            <ul style={{ fontSize: 14, lineHeight: 1.9, paddingLeft: 20 }}>
              <li id="txt-banca-questoes"><strong>20 Questões</strong> aleatórias</li>
              <li id="txt-banca-tempo">Tempo de <strong>60 min</strong></li>
              <li>Gabarito oculto</li>
            </ul>
          </div>
          <LegacyButton className="btn-marrom" style={{ width: '100%', justifyContent: 'center', marginTop: 20 }} onLegacyClick="iniciarExecucaoSimulado" legacyArgs={['banca']}>INICIAR</LegacyButton>
        </div>
        <div className="card-branco-modo">
          <div>
            <h3>Personalizado</h3>
            <label className="modal-field-label" htmlFor="cfg-qtd-questoes">Quantidade de questões</label>
            <input className="modal-number-input" type="number" id="cfg-qtd-questoes" defaultValue="10" min="1" max="50" />
            <label className="modal-field-label" htmlFor="cfg-tempo-prova">Tempo de prova (minutos)</label>
            <input className="modal-number-input" type="number" id="cfg-tempo-prova" defaultValue="10" min="0" />
            <label className="modal-checkbox-label">
              <span>Gabarito instantâneo</span>
              <input type="checkbox" id="cfg-gabarito-imediato" defaultChecked />
            </label>
          </div>
          <LegacyButton className="btn-marrom" style={{ width: '100%', justifyContent: 'center', marginTop: 20 }} onLegacyClick="iniciarExecucaoSimulado" legacyArgs={['personalizado']}>INICIAR</LegacyButton>
        </div>
      </div>
    </div>
  )
}

export function PaywallModal() {
  const switchModal = (target) => {
    callLegacy('fecharModal', 'modal-paywall')
    callLegacy(target)
  }
  return (
    <div className="modal-marrom-padrao modal-narrow modal-centered">
      <CloseModalButton modalId="modal-paywall" />
      <img src={sitePath('/assets/estrelas.png')} alt="" style={{ height: 42, marginBottom: 10 }} />
      <h2 style={{ margin: '0 0 10px' }}>Você concluiu as 20 páginas de teste!</h2>
      <p style={{ fontSize: 15, opacity: .9, lineHeight: 1.5, marginBottom: 25 }}>Para continuar a leitura das 119 páginas desta apostila, escolha como deseja desbloquear o material completo:</p>
      <div className="modal-action-stack">
        <LegacyButton className="btn-dourado-assinar modal-full-action" onClick={() => { callLegacy('fecharModal', 'modal-paywall'); callLegacy('abrirModal', 'modal-premium') }}>👑 Desbloquear Tudo com Matéria Premium (R$ 24,99)</LegacyButton>
        <LegacyButton className="btn-branco-acao" style={{ fontSize: 16 }} onClick={() => switchModal('fluxoClicarLerApostila')}>📘 Comprar Apenas Esta Apostila (R$ 14,99)</LegacyButton>
        <LegacyButton className="btn-verde-cupom" style={{ width: '100%', height: 46, fontWeight: 800, fontSize: 15, gap: 8 }} onClick={() => switchModal('fluxoUsarCupomNaApostila')}>🎟️ Usar Cupom de 100% de Desconto</LegacyButton>
      </div>
    </div>
  )
}

export function PaymentModal() {
  return (
    <div className="modal-marrom-padrao modal-payment modal-centered">
      <CloseModalButton modalId="modal-pagamento" />
      <h2 id="titulo-checkout-modal" style={{ margin: '0 0 8px' }}>Pagamento</h2>
      <p id="subtitulo-checkout-modal" style={{ fontSize: 14, opacity: .85, marginBottom: 20 }}>Assinatura ou pagamento único</p>
      <div className="card-branco-modo" style={{ textAlign: 'left', marginBottom: 20 }}>
        <div className="checkout-summary">
          <span id="item-checkout-nome">Apostila de Administração</span>
          <span id="item-checkout-valor">R$ 14,99</span>
        </div>
        <label className="checkout-label" htmlFor="forma-pagamento">Forma de Pagamento:</label>
        <select id="forma-pagamento" className="checkout-select">
          <option>PIX (Liberação Imediata)</option>
          <option>Cartão de Crédito</option>
        </select>
      </div>
      <LegacyButton className="btn-dourado-assinar modal-full-action" onLegacyClick="concluirPagamentoCheckout">Confirmar Pagamento</LegacyButton>
    </div>
  )
}

export function AuthModal() {
  return (
    <div className="modal-marrom-padrao modal-auth modal-centered">
      <CloseModalButton modalId="modal-auth" />
      <img className="auth-modal-logo" src={sitePath('/assets/logo-materia.png')} alt="Matéria" />
      <h3 className="auth-modal-title">Entrar na Plataforma</h3>
      <p id="aviso-acao-pendente" className="auth-modal-description">Entre para sincronizar simulados, cupons e sua biblioteca.</p>
      <div className="auth-modal-actions">
        <LegacyButton className="auth-action-button google-login-button" onLegacyClick="loginComGoogle">
          <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="" aria-hidden="true" />
          <span>Continuar com o Google</span>
        </LegacyButton>
        <LegacyButton className="auth-action-button guest-login-button" onLegacyClick="loginVisitanteRapido">
          <span>Continuar como Visitante</span>
        </LegacyButton>
      </div>
    </div>
  )
}

export function ProfileModal() {
  return (
    <div className="modal-marrom-padrao modal-profile">
      <CloseModalButton modalId="modal-profile" />
      <p className="profile-modal-eyebrow">Sua conta</p>
      <h3>Editar perfil</h3>
      <p className="profile-modal-description">Escolha como seu nome será exibido na plataforma.</p>
      <label className="profile-field-label" htmlFor="input-profile-name">Nome</label>
      <input id="input-profile-name" className="profile-name-input" type="text" maxLength="60" autoComplete="name" />
      <p id="profile-email" className="profile-email" />
      <LegacyButton className="profile-save-button" onLegacyClick="salvarPerfilUsuario">Salvar alterações</LegacyButton>
    </div>
  )
}

export function ConfirmAddModal() {
  return <ConfirmationModal modalId="modal-confirm-add" textId="texto-confirma-add" confirmLabel="SIM" onConfirm="confirmarAddSimulado">Adicionar simulado?</ConfirmationModal>
}

export function ConfirmRemoveSimulationModal() {
  return <ConfirmationModal modalId="modal-confirm-remove" textId="texto-confirma-remove" confirmLabel="SIM, REMOVER" onConfirm="confirmarRemoveSimulado">Remover simulado?</ConfirmationModal>
}

export function LogoutModal() {
  return <ConfirmationModal modalId="modal-confirm-logout" textId="texto-confirma-logout" cancelLabel="Cancelar" confirmLabel="Sair" cancelClassName="btn-texto-neutro" confirmClassName="btn-fundo-vermelho" onConfirm="confirmarLogout">Deseja sair da sua conta?</ConfirmationModal>
}

export function ConfirmCouponModal() {
  return <ConfirmationModal modalId="modal-confirm-cupom-apostila" textId="texto-confirma-cupom-apostila" confirmLabel="SIM, USAR CUPOM" onConfirm="confirmarResgateCupomNaApostila">Deseja usar seu cupom de 100% OFF para desbloquear esta apostila?</ConfirmationModal>
}
