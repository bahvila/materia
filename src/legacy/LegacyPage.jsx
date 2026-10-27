import { useEffect, useState } from 'react'

export function LegacyPage({ page }) {
  const [markup, setMarkup] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    let script
    let stylesheet

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
        setMarkup(html)

        requestAnimationFrame(() => {
          if (!active) return
          script = document.createElement('script')
          script.src = `/legacy/${page}.js`
          script.dataset.legacyPage = page
          document.body.appendChild(script)
        })
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Falha ao carregar a página')
      }
    }

    mountLegacyPage()
    return () => {
      active = false
      script?.remove()
      stylesheet?.remove()
    }
  }, [page])

  if (error) return <p style={{ padding: 24 }}>{error}</p>
  return <div dangerouslySetInnerHTML={{ __html: markup }} />
}
