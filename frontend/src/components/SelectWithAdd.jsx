import { Plus } from 'lucide-react'
import { useState } from 'react'
import SearchableSelect from './SearchableSelect'
import SelectWithAddPanel from './SelectWithAddPanel'
import { getInitialDraft, normalizeAddLabel } from './selectWithAddUtils'
import './SelectWithAdd.css'

import { renderFormLabel } from '../utils/labelUtils'

export default function SelectWithAdd(props) {
  const {
    id,
    name,
    label,
    icon,
    value,
    onChange,
    onBlur,
    options,
    placeholder,
    error,
    showError,
    onAddOption,
    addLabel = 'Add New',
    addTitle = 'Quick Add',
    addFields = [],
    disabled = false,
  } = props

  const SelectIcon = icon
  const buttonLabel = normalizeAddLabel(addLabel)
  const [isAdding, setIsAdding] = useState(false)
  const [draft, setDraft] = useState(() => getInitialDraft(addFields))

  const isAddDisabled = addFields.some(
    (field) =>
      field.required !== false && !String(draft[field.name] ?? '').trim(),
  )

  function resetDraft() {
    setDraft(getInitialDraft(addFields))
  }

  function handleDraftChange(event) {
    const { name: fieldName, value: fieldValue } = event.target
    setDraft((currentValue) => ({
      ...currentValue,
      [fieldName]: fieldValue,
    }))
  }

  function handleToggleAdd() {
    if (isAdding) {
      resetDraft()
    }

    setIsAdding((currentValue) => !currentValue)
  }

  async function handleQuickAdd() {
    if (!onAddOption || isAddDisabled) {
      return
    }

    const nextOption = await onAddOption(draft)

    if (!nextOption?.id) {
      return
    }

    onChange({
      target: {
        name,
        value: nextOption.id,
      },
    })

    resetDraft()
    setIsAdding(false)
  }

  return (
    <div className="field">
      <label htmlFor={id}>{renderFormLabel(label)}</label>

      <div className="select-add">
        <div className="select-add__control">
          <SearchableSelect
            id={id}
            name={name}
            label={label}
            hideLabel
            icon={SelectIcon}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            options={options}
            placeholder={placeholder}
            error={error}
            showError={showError}
            disabled={disabled}
          />
        </div>

        {onAddOption ? (
          <button
            type="button"
            className={`button button-secondary select-add__trigger ${isAdding ? 'is-active' : ''}`}
            onClick={handleToggleAdd}
            disabled={disabled}
          >
            <Plus size={16} />
            {buttonLabel}
          </button>
        ) : null}
      </div>

      {isAdding ? (
        <SelectWithAddPanel
          id={id}
          addTitle={addTitle}
          addFields={addFields}
          draft={draft}
          isAddDisabled={isAddDisabled}
          onDraftChange={handleDraftChange}
          onSave={handleQuickAdd}
          onCancel={handleToggleAdd}
        />
      ) : null}
    </div>
  )
}
