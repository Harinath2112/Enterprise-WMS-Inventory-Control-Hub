import {
  AlertCircle,
  CheckCircle2,
  CloudOff,
  Inbox,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  WifiOff,
} from 'lucide-react'
import './StateBlock.css'

const iconMap = {
  empty: Inbox,
  error: AlertCircle,
  loading: LoaderCircle,
  offline: WifiOff,
  permission: ShieldAlert,
  retry: RefreshCw,
  server: CloudOff,
  success: CheckCircle2,
}

export default function StateBlock({
  type = 'empty',
  title,
  message,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  diagnostics,
  compact = false,
  className = '',
}) {
  const Icon = iconMap[type] ?? iconMap.empty
  const isPageError = ['error', 'offline', 'server'].includes(type)

  return (
    <section className={`state-block state-block--${type} ${isPageError ? 'page-error-banner' : ''} ${compact ? 'state-block--compact' : ''} ${className}`.trim()} role={type === 'loading' ? 'status' : 'alert'}>
      <div className="state-block__icon" aria-hidden="true">
        <Icon size={compact ? 18 : 22} className={type === 'loading' ? 'animate-spin' : ''} />
      </div>
      <div className="state-block__body">
        <h2>{title || ((type === 'server' || type === 'offline') ? 'We could not load this workspace' : '')}</h2>
        {message ? <p>{message}</p> : null}
        {diagnostics ? <small>{diagnostics}</small> : null}
        {actionLabel || secondaryActionLabel ? (
          <div className="state-block__actions">
            {actionLabel ? (
              <button type="button" className="button button-primary" onClick={onAction}>
                {type === 'loading' ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                {actionLabel}
              </button>
            ) : null}
            {secondaryActionLabel ? (
              <button type="button" className="button button-secondary" onClick={onSecondaryAction}>
                {secondaryActionLabel}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
