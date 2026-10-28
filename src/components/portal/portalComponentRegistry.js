import {
  AuthModal,
  ConfirmAddModal,
  ConfirmCouponModal,
  ConfirmRemoveSimulationModal,
  LogoutModal,
  PaymentModal,
  PaywallModal,
  PremiumModal,
  ProfileModal,
  SimulationConfigModal,
} from './PortalModals'

export const portalModalComponents = {
  'modal-premium': PremiumModal,
  'modal-config-simulado': SimulationConfigModal,
  'modal-paywall': PaywallModal,
  'modal-pagamento': PaymentModal,
  'modal-auth': AuthModal,
  'modal-profile': ProfileModal,
  'modal-confirm-add': ConfirmAddModal,
  'modal-confirm-remove': ConfirmRemoveSimulationModal,
  'modal-confirm-logout': LogoutModal,
  'modal-confirm-cupom-apostila': ConfirmCouponModal,
}

