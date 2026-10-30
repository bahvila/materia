import { currentRoute } from './legacy/hashedRoutes'
import { LegacyPage } from './legacy/LegacyPage'

export default function App() {
  const isAdmin = currentRoute().split('?')[0] === '/admin' || window.location.pathname === '/paineldecontrole.html'
  return <LegacyPage page={isAdmin ? 'admin' : 'portal'} />
}
