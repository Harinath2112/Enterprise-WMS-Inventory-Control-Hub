import StateBlock from '../common/StateBlock'

export default function EmptyState({
  title = 'No records found',
  message = 'Try adjusting filters or create a new record when you are ready.',
  actionLabel,
  onAction,
  className = '',
  compact = true,
}) {
  return (
    <StateBlock
      type="empty"
      title={title}
      message={message}
      actionLabel={actionLabel}
      onAction={onAction}
      compact={compact}
      className={className}
    />
  )
}
