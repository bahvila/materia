import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { PortalHeader } from '../components/portal/PortalHeader'
import { portalModalComponents } from '../components/portal/portalComponentRegistry'
import { navigatePortal, sectionFromPath } from './portalNavigation'
import { installSupabaseFirebaseAdapter } from '../lib/supabaseFirebaseAdapter'
import { ToastProvider } from '../components/feedback/ToastProvider'
import { installToastBridge } from '../lib/toast'
import { SystemConfirmProvider } from '../components/feedback/SystemConfirmProvider'
import { installSystemConfirmBridge } from '../lib/systemConfirm'

function mountPortalComponents(container) {
  const roots = []
  const mount = (element, Component) => {
    if (!element) return
    const root = createRoot(element)
    roots.push(root)
    flushSync(() => root.render(<Component />))
  }

  mount(container.querySelector('header'), PortalHeader)
  Object.entries(portalModalComponents).forEach(([id, Component]) => {
    mount(container.querySelector(`#${id}`), Component)
  })

  return roots
}

export function LegacyPage({ page }) {
  const [markup, setMarkup] = useState('')
  const [error, setError] = useState('')
  const containerRef = useRef(null)

  useEffect(() => {
    let active = true
    let script
    let stylesheet
    let componentRoots = []

    async function mountLegacyPage() {
      try {
        const response = await fetch(`/legacy/${page}.html`)
        if (!response.ok) throw new Error(`Falha ao carregar ${page}.html`)
        const html = await response.text()
        if (!active) return

        stylesheet = document.createElement('link')
        stylesheet.rel = 'stylesheet'
        stylesheet.href = `/legacy/${page}.css`
        stylesheet.dataset.legacyPage = page
        document.head.appendChild(stylesheet)
        flushSync(() => setMarkup(html))

        requestAnimationFrame(() => {
          if (!active) return
          installToastBridge()
          installSystemConfirmBridge()
          installSupabaseFirebaseAdapter()
          if (page === 'portal' && containerRef.current) {
            componentRoots = mountPortalComponents(containerRef.current)
            const initialSection = sectionFromPath()
            navigatePortal(initialSection, {
              container: containerRef.current,
              historyMode: window.location.pathname === `/inicio` || window.location.pathname === `/${initialSection}` ? 'none' : 'replace',
            })
            window.mudarSeparador = (section, updateAddress = true) => navigatePortal(section, {
              container: containerRef.current,
              historyMode: updateAddress ? 'push' : 'none',
            })
          }
          script = document.createElement('script')
          script.src = `/legacy/${page}.js`
          script.dataset.legacyPage = page
          script.onload = () => {
            if (page === 'portal') {
              window.mudarSeparador = (section, updateAddress = true) => navigatePortal(section, {
                container: containerRef.current,
                historyMode: updateAddress ? 'push' : 'none',
              })
              navigatePortal(sectionFromPath(), { container: containerRef.current, historyMode: 'none' })
              if (window.firebase) {
                window.carregarApostilasDoFirebase?.()
                window.carregarSimuladosDoFirebase?.()
              }
            }
          }
          document.body.appendChild(script)
        })
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Falha ao carregar a página')
      }
    }

    mountLegacyPage()
    const handleHistoryNavigation = () => {
      if (page === 'portal' && containerRef.current) {
        navigatePortal(sectionFromPath(), { container: containerRef.current, historyMode: 'none' })
      }
    }
    window.addEventListener('popstate', handleHistoryNavigation)
    return () => {
      active = false
      window.removeEventListener('popstate', handleHistoryNavigation)
      script?.remove()
      componentRoots.forEach((root) => root.unmount())
      stylesheet?.remove()
    }
  }, [page])

  if (error) return <p style={{ padding: 24 }}>{error}</p>
  return (
    <>
      <ToastProvider />
      <SystemConfirmProvider />
      <div ref={containerRef} dangerouslySetInnerHTML={{ __html: markup }} />
    </>
  )
}
