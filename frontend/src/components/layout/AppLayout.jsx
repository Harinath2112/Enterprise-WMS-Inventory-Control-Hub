import './AppLayout.css'

export default function AppLayout({
  children,
  className = '',
  isCollapsed = false,
  isDrawerOpen = false,
}) {
  return (
    <div
      className={[
        'app-shell',
        isCollapsed ? 'app-shell--collapsed' : '',
        isDrawerOpen ? 'app-shell--drawer-open' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  )
}
