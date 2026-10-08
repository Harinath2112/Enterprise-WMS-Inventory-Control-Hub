/**
 * AuditLogsMobileFeed.jsx
 *
 * Mobile-only card feed for the Audit Logs page.
 * Replaces the desktop DataTable on narrow viewports
 * (controlled via CSS: the table card is hidden and this feed is shown).
 *
 * Extracted from ResourceCenter.jsx so that audit-log-specific
 * rendering logic has a dedicated, maintainable home.
 *
 * Props:
 *   rows      {Array}   - Normalised audit log rows from the API
 *   isLoading {boolean} - Whether the parent is still fetching rows
 */

import { useEffect, useMemo, useState } from 'react'
import { Activity, CalendarDays, Database, Hash, UserRound } from 'lucide-react'
import { readResourceValue } from '../../../api/resourceApi'
import { validateSearchQuery } from '../../../utils/searchValidationUtils'
import { formatDate } from '../../../utils/helpers'

const AUDIT_MOBILE_PAGE_SIZE = 10

// ── Audit-row helpers (used only by this component) ──────────────────────────

function getAuditActionTone(action) {
  const normalizedAction = String(action ?? '').trim().toLowerCase()

  if (['delete', 'deleted', 'remove', 'removed', 'archive', 'archived'].some((v) => normalizedAction.includes(v))) {
    return 'danger'
  }
  if (['create', 'created', 'add', 'added', 'insert'].some((v) => normalizedAction.includes(v))) {
    return 'success'
  }
  if (['update', 'updated', 'edit', 'edited', 'modify', 'modified'].some((v) => normalizedAction.includes(v))) {
    return 'info'
  }
  if (['login', 'auth', 'access'].some((v) => normalizedAction.includes(v))) {
    return 'neutral'
  }
  return 'default'
}

function formatStatusLabel(value) {
  const rawValue = String(value ?? '').trim()
  if (!rawValue) return 'Not set'
  if (/^opening$/i.test(rawValue) || /^opening[_\-\s]+stock$/i.test(rawValue)) return 'Opening Stock'
  return rawValue
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function getAuditActionLabel(row) {
  return formatStatusLabel(readResourceValue(row, 'action', 'Activity'))
}

function getAuditRowId(row) {
  return readResourceValue(
    row,
    'auditLogId',
    readResourceValue(row, 'auditId', readResourceValue(row, 'id', readResourceValue(row, 'recordId', 'audit-row'))),
  )
}

function getAuditDescription(row) {
  return readResourceValue(row, 'description', '') || 'System activity recorded by the IMS audit service.'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AuditLogsMobileFeed({ rows, isLoading }) {
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')

  const normalizedQuery = query.trim().toLowerCase()

  const filteredRows = useMemo(() => {
    if (!normalizedQuery) return rows
    return rows.filter((row) =>
      [
        readResourceValue(row, 'action', ''),
        readResourceValue(row, 'module', ''),
        readResourceValue(row, 'tableName', ''),
        readResourceValue(row, 'recordId', ''),
        readResourceValue(row, 'userId', ''),
        readResourceValue(row, 'description', ''),
      ].some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery)),
    )
  }, [normalizedQuery, rows])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / AUDIT_MOBILE_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const startIndex = filteredRows.length === 0 ? 0 : (safePage - 1) * AUDIT_MOBILE_PAGE_SIZE
  const endIndex = Math.min(startIndex + AUDIT_MOBILE_PAGE_SIZE, filteredRows.length)
  const pageRows = filteredRows.slice(startIndex, endIndex)

  useEffect(() => { setPage(1) }, [normalizedQuery, rows])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  // Loading skeleton
  if (isLoading && rows.length === 0) {
    return (
      <div className="resource-center__audit-feed" role="status" aria-live="polite">
        {Array.from({ length: 5 }).map((_, index) => (
          <div className="resource-center__audit-card is-loading" key={index}>
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>
    )
  }

  // Empty state
  if (rows.length === 0) {
    return (
      <div className="resource-center__audit-feed">
        <div className="resource-center__audit-empty">
          <Activity size={20} />
          <strong>No audit activity found</strong>
          <span>Operational activity will appear here after the API returns audit records.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="resource-center__audit-feed" aria-label="Audit activity feed">
      <label className="resource-center__audit-search">
        <span>Search audit activity</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by action, module, user, or date"
        />
      </label>

      {filteredRows.length === 0 ? (
        (() => {
          const validation = validateSearchQuery(query)
          if (validation.isInvalid) {
            return (
              <div className="resource-center__audit-empty resource-center__audit-empty--invalid">
                <Activity size={20} />
                <strong>Invalid search term</strong>
                <span>Please enter a valid search term (e.g., action, user, module, date).</span>
              </div>
            )
          }

          return (
            <div className="resource-center__audit-empty">
              <Activity size={20} />
              <strong>No matching activity</strong>
              <span>Please check your search term or adjust filters to review a broader range.</span>
            </div>
          )
        })()
      ) : null}

      {filteredRows.length > 0 ? (
        <div className="resource-center__audit-list">
          {pageRows.map((row) => {
            const action = readResourceValue(row, 'action', 'Activity')
            const tone = getAuditActionTone(action)
            const timestamp = readResourceValue(row, 'createdAt', '')
            const moduleName = readResourceValue(row, 'module', 'System')
            const tableName = readResourceValue(row, 'tableName', 'Not set')
            const userId = readResourceValue(row, 'userId', 'System')
            const recordId = readResourceValue(row, 'recordId', 'Not set')

            return (
              <article className="resource-center__audit-card" key={getAuditRowId(row)}>
                <header className="resource-center__audit-card-header">
                  <span className={`resource-center__audit-action resource-center__audit-action--${tone}`}>
                    <Activity size={14} />
                    {getAuditActionLabel(row)}
                  </span>
                  <time dateTime={timestamp ? String(timestamp) : undefined}>
                    <CalendarDays size={13} />
                    {timestamp ? formatDate(timestamp) : 'Time not set'}
                  </time>
                </header>

                <p className="resource-center__audit-description">{getAuditDescription(row)}</p>

                <footer className="resource-center__audit-meta" aria-label="Audit metadata">
                  <span title={`Module: ${moduleName}`}>
                    <Hash size={13} />
                    {moduleName}
                  </span>
                  <span title={`Table: ${tableName}`}>
                    <Database size={13} />
                    {tableName}
                  </span>
                  <span title={`User: ${userId}`}>
                    <UserRound size={13} />
                    {userId}
                  </span>
                  <span title={`Record ID: ${recordId}`}>
                    ID {recordId}
                  </span>
                </footer>
              </article>
            )
          })}
        </div>
      ) : null}

      {filteredRows.length > 0 ? (
        <div className="resource-center__audit-pagination">
          <span>
            Showing {startIndex + 1}–{endIndex} of {filteredRows.length}
          </span>
          <div>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setPage((v) => Math.max(1, v - 1))}
              disabled={safePage === 1}
            >
              Prev
            </button>
            <strong>Page {safePage}</strong>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setPage((v) => Math.min(totalPages, v + 1))}
              disabled={safePage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
