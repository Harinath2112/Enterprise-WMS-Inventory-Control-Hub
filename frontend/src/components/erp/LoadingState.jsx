import StateBlock from '../common/StateBlock'

export default function LoadingState({
  title = 'Loading records...',
  message = 'Please wait while IMS prepares the latest data.',
  compact = true,
  className = '',
}) {
  return (
    <StateBlock
      type="loading"
      title={title}
      message={message}
      compact={compact}
      className={className}
    />
  )
}
