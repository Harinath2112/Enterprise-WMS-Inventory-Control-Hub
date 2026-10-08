import {
  Bell,
  CalendarDays,
  FileText,
  Save,
  Tag,
  X,
} from 'lucide-react'
import { useState } from 'react'
import SearchableSelect from '../../../components/SearchableSelect'
import { getToday } from '../../../utils/helpers'

const initialForm = {
  title: '',
  type: 'Info',
  message: '',
  date: getToday(),
}

export default function NotificationForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState(initialForm)

  function handleChange(e) {
    const { name, value } = e.target
    setFormData((p) => ({ ...p, [name]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <div className="card">
      <h2 className="section-title">New Alert</h2>

      <form onSubmit={handleSubmit} className="form-grid">
        <div className="field">
          <label htmlFor="notification-title">Title</label>
          <div className="input-with-icon">
            <Tag size={16} />
            <input
              id="notification-title"
              name="title"
              value={formData.title}
              onChange={handleChange}
            />
          </div>
        </div>

        <SearchableSelect
          id="notification-type"
          name="type"
          label="Type"
          icon={Bell}
          value={formData.type}
          onChange={handleChange}
          options={['Info', 'Action', 'Critical']}
        />

        <div className="field">
          <label htmlFor="notification-date">Date</label>
          <div className="input-with-icon">
            <CalendarDays size={16} />
            <input
              id="notification-date"
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="field field--full">
          <label htmlFor="notification-message">Message</label>
          <div className="input-with-icon input-with-icon--textarea">
            <FileText size={16} />
            <textarea
              id="notification-message"
              name="message"
              value={formData.message}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="button-row field--full">
          <button type="submit" className="button button-primary">
            <Save size={16} />
            Save Alert
          </button>
          <button type="button" className="button button-cancel" onClick={onCancel}>
            <X size={16} />
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
