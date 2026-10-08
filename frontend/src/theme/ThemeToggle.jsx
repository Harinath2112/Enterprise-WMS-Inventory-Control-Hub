import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { getStoredTheme, setTheme } from './theme'
import './theme.css'

export default function ThemeToggle({ floating = false }) {
  const [theme, setLocal] = useState(() => document.documentElement.dataset.theme || getStoredTheme())

  useEffect(() => {
    const sync = (e) => setLocal(e.detail)
    window.addEventListener('ims-theme-change', sync)
    return () => window.removeEventListener('ims-theme-change', sync)
  }, [])

  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      className={`theme-toggle ${floating ? 'theme-toggle--floating' : ''}`}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={() => setTheme(next)}
    >
      <span className="theme-toggle__icon theme-toggle__icon--sun"><Sun size={17} /></span>
      <span className="theme-toggle__icon theme-toggle__icon--moon"><Moon size={17} /></span>
    </button>
  )
}
