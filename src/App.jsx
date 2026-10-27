import { LegacyPage } from './legacy/LegacyPage'

export default function App() {
  const isAdmin = window.location.pathname === '/admin' || window.location.pathname === '/paineldecontrole.html'
  return <LegacyPage page={isAdmin ? 'admin' : 'portal'} />
}
