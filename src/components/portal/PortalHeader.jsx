import { LegacyButton } from '../ui/LegacyButton'
import { callLegacy } from '../../legacy/legacyBridge'
import { navigatePortal } from '../../legacy/portalNavigation'

const navigation = [
  ['inicio', 'Início'],
  ['apostila', 'Apostila'],
  ['simulados', 'Simulado'],
  ['biblioteca', 'Biblioteca'],
]

export function PortalHeader() {
  return (
    <>
      <div className="header-left">
        <img
          src="/assets/íconemateriamarrom.png"
          alt="MATÉRIA"
          className="logo-header"
          onClick={() => navigatePortal('inicio')}
        />
        <nav aria-label="Navegação principal">
          {navigation.map(([id, label]) => (
            <LegacyButton
              key={id}
              data-section={id}
              className={`nav-btn${id === 'inicio' ? ' active' : ''}`}
              onClick={() => navigatePortal(id)}
            >
              {label}
            </LegacyButton>
          ))}
        </nav>
      </div>

      <div className="header-right">
        <img
          id="btn-banner-premium"
          src="/assets/premium.png"
          alt="Matéria Premium"
          className="btn-img-premium"
          onClick={() => callLegacy('abrirModal', 'modal-premium')}
        />

        <div id="badge-voce-premium" className="pill-voce-premium" onClick={() => callLegacy('abrirModal', 'modal-premium')}>
          <img src="/assets/premium.png" alt="Você é Premium" />
        </div>

        <LegacyButton id="btn-cupom-topo" className="btn-header-cupom" title="Meus Cupons / Inserir Código" onLegacyClick="togglePopoverCupons">
          <img src="/assets/icone-cupom.png" alt="%" />
        </LegacyButton>

        <LegacyButton id="btn-entrar-topo" className="btn-header-entrar" onLegacyClick="abrirModal" legacyArgs={['modal-auth']}>Entrar</LegacyButton>

        <LegacyButton id="btn-usuario-topo" className="btn-header-usuario" style={{ display: 'none' }} onLegacyClick="logout">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z" /></svg>
          <span id="label-nome-usuario">USUÁRIO</span>
        </LegacyButton>

        <div id="popover-cupons" className="popover-cupons-header">
          <div className="abas-cupom-topo">
            <LegacyButton id="tab-btn-inserir" className="tab-cupom-btn active" onLegacyClick="alternarAbaCupom" legacyArgs={['inserir']}>inserir código</LegacyButton>
            <LegacyButton id="tab-btn-meus" className="tab-cupom-btn" onLegacyClick="alternarAbaCupom" legacyArgs={['meus']}>meus cupons</LegacyButton>
          </div>
          <div id="conteudo-cupom-inserir" className="caixa-interna-cupom">
            <input type="text" id="input-codigo-cupom" className="input-digitar-cupom" placeholder="Digitar" />
            <LegacyButton className="btn-amarelo-cupom" onLegacyClick="confirmarCodigoCupom">confirmar</LegacyButton>
          </div>
          <div id="conteudo-cupom-meus" className="caixa-interna-cupom" style={{ display: 'none', justifyContent: 'flex-start' }}>
            <div id="lista-meus-cupons-DOM" />
          </div>
        </div>
      </div>
    </>
  )
}
