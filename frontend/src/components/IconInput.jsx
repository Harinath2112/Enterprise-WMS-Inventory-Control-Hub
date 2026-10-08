export default function IconInput({
  label,
  icon: Icon,
  error,
  children,
  className = '',
}) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>

      <div className="input-with-icon">
        {Icon ? <Icon size={18} /> : null}
        {children}
      </div>

      {error ? <span className="field-error">{error}</span> : null}
    </label>
  )
}
