import { ChevronDown } from 'lucide-react'
import SidebarItem from './SidebarItem'

export default function SidebarSection({
  sectionKey,
  title,
  items,
  isOpen,
  isCollapsed,
  onToggle,
}) {
  if (items.length === 0 && sectionKey !== 'pos') {
    return null
  }

  const sectionItemsId = `sidebar-section-${sectionKey}`
  const isExpanded = isOpen || isCollapsed

  return (
    <section className="app-sidebar__section" aria-label={title}>
      <button
        type="button"
        className="app-sidebar__section-button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={sectionItemsId}
        title={isCollapsed ? title : undefined}
        data-tooltip={title}
        data-sidebar-focusable="true"
        data-sidebar-section-button="true"
        data-sidebar-section-key={sectionKey}
        data-sidebar-section-open={String(isOpen)}
      >
        <span className="app-sidebar__section-label">{String(title).toUpperCase()}</span>
        <ChevronDown
          size={14}
          className={`app-sidebar__section-chevron ${isExpanded ? 'is-open' : ''}`}
          aria-hidden="true"
        />
      </button>

      <div
        id={sectionItemsId}
        className={`app-sidebar__section-items ${isExpanded ? 'is-open' : ''}`}
        aria-hidden={!isExpanded}
        role="group"
        aria-label={`${title} modules`}
      >
        {items.map((item) => (
          <SidebarItem key={item.path} item={item} isCollapsed={isCollapsed} />
        ))}
      </div>
    </section>
  )
}
