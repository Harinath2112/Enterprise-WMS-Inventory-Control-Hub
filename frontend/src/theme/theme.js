const KEY = 'ims-theme'

export function getStoredTheme() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'dark' || saved === 'light') return saved
  } catch { /* storage unavailable */ }
  return 'dark' // dark is the default look; the toggle lets people switch to light
}

export function applyTheme(theme) {
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0a0720' : '#6c5ce7')
}

export function initTheme() {
  applyTheme(getStoredTheme())
}

export function setTheme(theme) {
  try { localStorage.setItem(KEY, theme) } catch { /* ignore */ }
  applyTheme(theme)
  window.dispatchEvent(new CustomEvent('ims-theme-change', { detail: theme }))
}
