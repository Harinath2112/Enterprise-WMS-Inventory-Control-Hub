import StateBlock from './StateBlock'

export default function LoadingFallback({ label = 'Loading...' }) {
  return (
    <div className="route-loader">
      <StateBlock
        type="loading"
        title={label}
        message="Preparing your workspace with the latest operational data."
        compact
      />
    </div>
  )
}
