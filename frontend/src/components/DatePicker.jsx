import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import InputField from './InputField'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function formatDisplayDate(value) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) {
    return String(value ?? '')
  }

  return `${match[3]}-${match[2]}-${match[1]}`
}

function parseDisplayDate(value) {
  const trimmedValue = String(value ?? '').trim()
  const isoMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (isoMatch) {
    return trimmedValue
  }

  const displayMatch = trimmedValue.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/)

  if (!displayMatch) {
    return ''
  }

  const [, day, month, year] = displayMatch
  const isoValue = `${year}-${month}-${day}`
  const parsedDate = new Date(`${isoValue}T00:00:00`)

  return Number.isNaN(parsedDate.getTime()) ? '' : isoValue
}

function parseIsoDate(value) {
  const parsedValue = parseDisplayDate(value)

  if (!parsedValue) {
    return null
  }

  const parsedDate = new Date(`${parsedValue}T00:00:00`)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

function toIsoDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getMonthLabel(date) {
  return date.toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

function getCalendarDays(viewDate) {
  const firstOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1)
  const lastOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0)
  const startDate = new Date(firstOfMonth)
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7
  const requiredCells = mondayOffset + lastOfMonth.getDate()
  const calendarLength = requiredCells > 35 ? 42 : 35
  startDate.setDate(firstOfMonth.getDate() - mondayOffset)

  return Array.from({ length: calendarLength }, (_, index) => {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + index)
    return date
  })
}

function isSameDay(firstDate, secondDate) {
  return Boolean(firstDate && secondDate) && toIsoDate(firstDate) === toIsoDate(secondDate)
}

export default function DatePicker(props) {
  const {
    value,
    onChange,
    onBlur,
    name,
    label,
    placeholder = 'DD-MM-YYYY',
    className = '',
    icon = CalendarDays,
    ...restProps
  } = props
  const wrapperRef = useRef(null)
  const popoverRef = useRef(null)
  const instanceIdRef = useRef(`datepicker-${Math.random().toString(36).substring(2, 9)}`)
  const [displayValue, setDisplayValue] = useState(() => formatDisplayDate(value))
  const [isOpen, setIsOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => parseIsoDate(value) || new Date())
  const [popoverStyle, setPopoverStyle] = useState({})
  const selectedDate = parseIsoDate(value)
  const today = new Date()

  useEffect(() => {
    setDisplayValue(formatDisplayDate(value))
    setViewDate(parseIsoDate(value) || new Date())
  }, [value])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    function updatePopoverPosition() {
      const rect = wrapperRef.current?.getBoundingClientRect()

      if (!rect) {
        return
      }

      const popoverWidth = 248
      const popoverHeight = 244
      const gutter = 10
      const left = Math.max(
        gutter,
        Math.min(rect.left, window.innerWidth - popoverWidth - gutter),
      )
      let top = rect.bottom + 7

      if (restProps.forceDownward === false && top + popoverHeight > window.innerHeight - gutter) {
        top = Math.max(gutter, rect.top - popoverHeight - 7)
      }

      setPopoverStyle({
        left: `${left}px`,
        top: `${top}px`,
      })
    }

    function handlePointerDown(event) {
      if (!wrapperRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    updatePopoverPosition()
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', updatePopoverPosition)
    window.addEventListener('scroll', updatePopoverPosition, true)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', updatePopoverPosition)
      window.removeEventListener('scroll', updatePopoverPosition, true)
    }
  }, [isOpen])

  function emitChange(nextValue) {
    onChange?.({
      target: {
        name,
        value: nextValue,
      },
    })
  }

  function handleChange(event) {
    const nextDisplayValue = event.target.value
    const parsedValue = parseDisplayDate(nextDisplayValue)
    setDisplayValue(nextDisplayValue)
    emitChange(parsedValue || nextDisplayValue)
  }

  function handleBlur() {
    const parsedValue = parseDisplayDate(displayValue)

    if (parsedValue) {
      setDisplayValue(formatDisplayDate(parsedValue))
      emitChange(parsedValue)
    }

    onBlur?.({
      target: {
        name,
        value: parsedValue || displayValue,
      },
    })
  }

  function openCalendar() {
    setViewDate(parseIsoDate(value) || new Date())
    window.dispatchEvent(new CustomEvent('ims:dropdown-opened', { detail: { id: instanceIdRef.current } }))
    setIsOpen(true)
  }

  function shiftMonth(offset) {
    setViewDate((currentDate) => new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1))
  }

  function selectDate(date) {
    const nextValue = toIsoDate(date)
    setDisplayValue(formatDisplayDate(nextValue))
    emitChange(nextValue)
    setIsOpen(false)
  }

  return (
    <div className={`date-picker-shell ${isOpen ? 'is-open' : ''}`} ref={wrapperRef}>
      <InputField
        icon={icon}
        onIconClick={openCalendar}
        iconLabel={`Open ${label || 'date'} calendar`}
        label={label}
        type="text"
        name={name}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={openCalendar}
        placeholder={placeholder}
        className={`date-picker-field ${className}`.trim()}
        {...restProps}
      />
      {isOpen ? (
        <div
          className="date-picker-popover"
          role="dialog"
          aria-label={`${label || 'Date'} calendar`}
          style={popoverStyle}
        >
          <div className="date-picker-popover__header">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              <ChevronLeft size={16} />
            </button>
            <span>
              <small>{label ? `${label} date` : 'Date'}</small>
              <strong>{getMonthLabel(viewDate)}</strong>
            </span>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="date-picker-popover__weekdays" aria-hidden="true">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="date-picker-popover__grid">
            {getCalendarDays(viewDate).map((date) => {
              const isoValue = toIsoDate(date)
              const isMuted = date.getMonth() !== viewDate.getMonth()
              const isSelected = isSameDay(date, selectedDate)
              const isToday = isSameDay(date, today)

              return (
                <button
                  key={isoValue}
                  type="button"
                  className={[
                    'date-picker-popover__day',
                    isMuted ? 'is-muted' : '',
                    isSelected ? 'is-selected' : '',
                    isToday ? 'is-today' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => selectDate(date)}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>
          <div className="date-picker-popover__footer">
            <button type="button" onClick={() => selectDate(today)}>Today</button>
            <button
              type="button"
              onClick={() => {
                setDisplayValue('')
                emitChange('')
                setIsOpen(false)
              }}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
