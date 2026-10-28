import {
  AuthModal,
  ConfirmAddModal,
  ConfirmCouponModal,
  ConfirmRemoveSimulationModal,
  PaymentModal,
  PaywallModal,
  PremiumModal,
  SimulationConfigModal,
} from './PortalModals'

export const portalModalComponents = {
  'modal-premium': PremiumModal,
  'modal-config-simulado': SimulationConfigModal,
  'modal-paywall': PaywallModal,
  'modal-pagamento': PaymentModal,
  'modal-auth': AuthModal,
  'modal-confirm-add': ConfirmAddModal,
  'modal-confirm-remove': ConfirmRemoveSimulationModal,
  'modal-confirm-cupom-apostila': ConfirmCouponModal,
}

