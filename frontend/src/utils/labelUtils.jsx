import React from 'react'

export function renderFormLabel(label) {
  if (typeof label !== 'string' || !label.includes('*')) {
    return label
  }

  const parts = label.split('*')
  return (
    <>
      {parts[0]}
      <span className="required-asterisk" style={{ color: '#dc2626', fontWeight: 'bold', marginLeft: '2px' }}>
        *
      </span>
      {parts.slice(1).join('*')}
    </>
  )
}
