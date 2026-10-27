import { callLegacy } from '../../legacy/legacyBridge'

export function LegacyButton({ onLegacyClick, legacyArgs = [], onClick, children, ...props }) {
  const handleClick = onClick || (() => callLegacy(onLegacyClick, ...legacyArgs))
  return <button type="button" onClick={handleClick} {...props}>{children}</button>
}
