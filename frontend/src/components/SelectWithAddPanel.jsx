import { Check, X } from 'lucide-react'
import SearchableSelect from './SearchableSelect'

export default function SelectWithAddPanel({
  id,
  addTitle,
  addFields,
  draft,
  isAddDisabled,
  onDraftChange,
  onSave,
  onCancel,
}) {
  return (
    <div className="select-add__panel">
      <div className="select-add__panel-header">
        <strong>{addTitle}</strong>
        <button className="button button-cancel select-add__icon-button"
          type="button"
          onClick={onCancel}
        >
          <X size={14} />
        </button>
      </div>

      <div className="select-add__panel-grid">
        {addFields.map((field, index) =>
          field.type === 'select' ? (
            <SearchableSelect
              key={field.name}
              id={`${id}-${field.name}`}
              name={field.name}
              label={field.label}
              value={draft[field.name]}
              onChange={onDraftChange}
              options={field.options}
              placeholder={field.placeholder}
            />
          ) : (
            <div className="field" key={field.name}>
              <label htmlFor={`${id}-${field.name}`}>{field.label}</label>
              <input
                id={`${id}-${field.name}`}
                name={field.name}
                type={field.type ?? 'text'}
                value={draft[field.name]}
                onChange={onDraftChange}
                placeholder={field.placeholder}
                autoComplete="off"
                autoFocus={index === 0}
              />
            </div>
          ),
        )}
      </div>

      <div className="button-row">
        <button
          type="button"
          className="button button-primary"
          onClick={onSave}
          disabled={isAddDisabled}
        >
          <Check size={16} />
          Save
        </button>
        <button type="button" className="button button-cancel" onClick={onCancel}>
          <X size={16} />
          Cancel
        </button>
      </div>
    </div>
  )
}
