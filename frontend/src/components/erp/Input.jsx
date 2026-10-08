import './ERPComponents.css'
import { autoCapitalizeWords, shouldAutoCapitalizeField } from '../../validators/nameValidator'

export default function Input({ className = '', name, type, autoCapitalize, onChange, style, ...props }) {
  const isAutoCap = autoCapitalize === 'words' || (autoCapitalize !== 'off' && shouldAutoCapitalizeField(name, type))

  const handleInputChange = (event) => {
    if (!onChange) return

    if (isAutoCap && event?.target && typeof event.target.value === 'string' && event.target.value) {
      const originalValue = event.target.value
      const capitalizedValue = autoCapitalizeWords(originalValue)
      if (capitalizedValue !== originalValue) {
        event = {
          ...event,
          target: {
            ...event.target,
            name: event.target.name || name,
            value: capitalizedValue,
          },
        }
      }
    }

    onChange(event)
  }

  const hasValue = props.value !== undefined && props.value !== null && String(props.value).length > 0
  const computedStyle = isAutoCap && hasValue ? { textTransform: 'capitalize', ...style } : style

  return (
    <input
      className={`erp-input ${className}`.trim()}
      name={name}
      type={type}
      autoCapitalize={isAutoCap ? 'words' : 'off'}
      onChange={handleInputChange}
      style={computedStyle}
      {...props}
    />
  )
}
