export const siteBase = import.meta.env.BASE_URL

export function sitePath(path = '') {
  return `${siteBase}${path.replace(/^\//, '')}`
}

export function localPath(pathname) {
  const prefix = siteBase.replace(/\/$/, '')
  return prefix && (pathname === prefix || pathname.startsWith(`${prefix}/`))
    ? pathname.slice(prefix.length) || '/'
    : pathname
}
