function getStatusClass(status) {
  const normalized = String(status || 'active')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')

  if (['active', 'completed', 'good'].includes(normalized)) {
    return 'status-active'
  }

  if (['blocked', 'disabled', 'archived', 'inactive'].includes(normalized)) {
    return 'status-inactive'
  }

  if (['pending', 'prospect'].includes(normalized)) {
    return 'status-pending'
  }

  return 'status-info'
}

export default function StatusBadge({
  status,
  onClick,
  onDoubleClick,
  onKeyDown,
  disabled = false,
  title,
}) {
  const label = status || 'Active'
  const isInteractive = Boolean(onClick || onDoubleClick || onKeyDown)
  const className = `status-badge ${getStatusClass(label)}${isInteractive ? ' status-badge--button' : ''}`

  if (isInteractive) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
        disabled={disabled}
        title={title || `Update status: ${label}`}
        aria-label={title || `Update customer status from ${label}`}
        data-row-click-ignore="true"
      >
        {label}
      </button>
    )
  }

  return (
    <span className={className}>
      {label}
    </span>
  )
}
