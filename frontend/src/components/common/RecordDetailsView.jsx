import React from 'react'
import FormModal from '../../layouts/FormModal'
import StatusBadge from '../erp/StatusBadge'
import './RecordDetailsView.css'

export default function RecordDetailsView({
  modalTitle,
  heroTitle,
  heroSubtitle,
  icon: Icon,
  status,
  fields = [],
  onClose,
}) {
  return (
    <FormModal
      title={modalTitle}
      onClose={onClose}
    >
      <div className="record-details-view">
        {/* Hero Card */}
        {(heroTitle || status) ? (
          <div className="record-details-hero">
            <div className="record-details-hero__left">
              {Icon ? (
                <div className="record-details-hero__icon">
                  <Icon size={20} />
                </div>
              ) : null}
              <div className="record-details-hero__info">
                {heroTitle ? <h3 className="record-details-hero__title">{heroTitle}</h3> : null}
                {heroSubtitle ? <p className="record-details-hero__subtitle">{heroSubtitle}</p> : null}
              </div>
            </div>
            {status ? (
              <div className="record-details-hero__right">
                <StatusBadge status={status}>{status}</StatusBadge>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Details Cards Grid */}
        <div className="record-details-grid">
          {fields.map((field, index) => {
            if (!field) return null
            const isFullWidth = field.fullWidth || Boolean(field.isDescription)
            return (
              <div
                key={field.key || field.label || index}
                className={`record-details-card ${isFullWidth ? 'record-details-card--full' : ''}`.trim()}
              >
                <span className="record-details-card__label">{field.label}</span>
                <div className="record-details-card__value">
                  {field.render ? field.render() : (field.value ?? '—')}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="record-details-footer">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </FormModal>
  )
}
