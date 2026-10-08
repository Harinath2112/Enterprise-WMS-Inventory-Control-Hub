import {
  AlertTriangle,
  Download,
  Eye,
  FileText,
  LoaderCircle,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { showToast } from '../../../components/common/toast'
import {
  deleteSupplierDocument,
  downloadSupplierDocument,
  getSupplierDocuments,
  uploadSupplierDocument,
} from '../../../api/suppliersApi'
import {
  getSupplierDocumentTypeLabel,
  normalizeSupplierDocumentType,
  SUPPLIER_DOCUMENT_TYPE_OPTIONS,
  SUPPLIER_DOCUMENT_TYPES,
  SUPPLIER_SINGLE_DOCUMENT_TYPES,
} from '../supplierDocumentTypes'
import { SupplierSection } from './SupplierFormSections'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png']
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const FILE_REQUIREMENTS_TEXT = 'PDF, JPG, JPEG, PNG \u2022 Max 10 MB'
const PRIMARY_DOCUMENT_OPTIONS = SUPPLIER_DOCUMENT_TYPE_OPTIONS.filter(({ value }) => (
  SUPPLIER_SINGLE_DOCUMENT_TYPES.includes(normalizeSupplierDocumentType(value))
))
const OTHER_DOCUMENT_OPTION = SUPPLIER_DOCUMENT_TYPE_OPTIONS.find(({ value }) => (
  normalizeSupplierDocumentType(value) === SUPPLIER_DOCUMENT_TYPES.OTHER
))

function getDocumentId(document) {
  return String(document?.documentId || document?.id || document?.supplierDocumentId || '')
}

function getDocumentType(document) {
  return normalizeSupplierDocumentType(document?.documentType || document?.type)
}

function getDocumentDisplayName(document) {
  return document?.displayName || document?.fileName || document?.originalFileName || document?.name || 'Supplier document'
}

function getDocumentFileName(document) {
  return document?.fileName || document?.displayName || document?.originalFileName || document?.name || 'supplier-document'
}

function getDocumentUploadedBy(document) {
  return document?.uploadedBy || document?.uploadedByName || document?.createdBy || 'Not captured'
}

function formatFileSize(size) {
  const bytes = Number(size || 0)

  if (!bytes) return 'Size unavailable'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatUploadedAt(value) {
  if (!value) return 'Time unavailable'

  // Ensure the string is treated as UTC.
  // The backend stores DateTime.UtcNow; if the Z/offset is missing from the
  // serialized string, browsers interpret it as local time — which causes the
  // displayed timestamp to be off by the UTC offset (e.g. 5h 30m for IST).
  let rawValue = String(value)
  if (!/Z$|[+-]\d{2}:\d{2}$/.test(rawValue)) {
    rawValue = `${rawValue}Z`
  }

  const date = new Date(rawValue)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function previewBlob(blob) {
  const url = URL.createObjectURL(blob)
  const previewWindow = window.open(url, '_blank', 'noopener,noreferrer')

  window.setTimeout(() => URL.revokeObjectURL(url), 60000)

  return Boolean(previewWindow)
}

function validateFile(file) {
  if (!file) return 'Select a PDF, JPG, JPEG, or PNG file.'

  const extension = file.name.split('.').pop()?.toLowerCase() || ''

  if (!ALLOWED_EXTENSIONS.includes(extension) || (file.type && !ALLOWED_MIME_TYPES.includes(file.type))) {
    return 'Invalid file type. Upload a PDF, JPG, JPEG, or PNG document.'
  }

  if (file.size > MAX_FILE_SIZE) {
    return 'File too large. Maximum upload size is 10 MB.'
  }

  return ''
}

function buildDocumentsByType(documents) {
  return SUPPLIER_DOCUMENT_TYPE_OPTIONS.reduce((result, { value }) => {
    const type = normalizeSupplierDocumentType(value)
    const documentsForType = documents.filter((document) => getDocumentType(document) === type)
    const stagedDocuments = documentsForType.filter((document) => document?.isTemporary)
    result[type] = SUPPLIER_SINGLE_DOCUMENT_TYPES.includes(type) && stagedDocuments.length > 0
      ? stagedDocuments
      : documentsForType
    return result
  }, {})
}

export default function SupplierDocumentsTab({
  supplierId,
  documents = [],
  readOnly = false,
  onDocumentsChange,
}) {
  const [documentList, setDocumentList] = useState(documents)
  const [uploadStateByType, setUploadStateByType] = useState({})
  const [errorByType, setErrorByType] = useState({})
  const [lastUploadByType, setLastUploadByType] = useState({})
  const [replaceTargetByType, setReplaceTargetByType] = useState({})
  const [dragType, setDragType] = useState('')
  const [refreshError, setRefreshError] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [previewingId, setPreviewingId] = useState('')
  const [downloadingId, setDownloadingId] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [replaceConfirmation, setReplaceConfirmation] = useState(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState(null)
  const inputIdPrefix = useId()

  useEffect(() => {
    setDocumentList(documents)
  }, [documents])

  useEffect(() => {
    if (!replaceConfirmation && !deleteConfirmation) return undefined

    function handleConfirmationKeyDown(event) {
      if (event.key !== 'Escape') return
      setReplaceConfirmation(null)
      setDeleteConfirmation(null)
    }

    window.addEventListener('keydown', handleConfirmationKeyDown)
    return () => window.removeEventListener('keydown', handleConfirmationKeyDown)
  }, [deleteConfirmation, replaceConfirmation])

  const documentsByType = useMemo(() => buildDocumentsByType(documentList), [documentList])

  const refreshDocuments = useCallback(async () => {
    if (!supplierId) return []

    setIsRefreshing(true)
    setRefreshError('')

    try {
      const response = await getSupplierDocuments(supplierId)

      if (!response.success) {
        throw new Error(response.error || response.message || 'Supplier documents could not be refreshed.')
      }

      const nextDocuments = Array.isArray(response.data) ? response.data : []
      setDocumentList(nextDocuments)
      return nextDocuments
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Supplier documents could not be refreshed.'
      setRefreshError(message)
      throw error
    } finally {
      setIsRefreshing(false)
    }
  }, [supplierId])

  useEffect(() => {
    if (!supplierId) return
    refreshDocuments().catch(() => {})
  }, [refreshDocuments, supplierId])

  function clearInput(type) {
    const input = document.getElementById(`${inputIdPrefix}-supplier-doc-${type}`)
    if (input) {
      input.value = ''
    }
  }

  function openPicker(type, replaceTarget = null) {
    if (replaceTarget) {
      setReplaceTargetByType((currentValue) => ({ ...currentValue, [type]: replaceTarget }))
    } else {
      setReplaceTargetByType((currentValue) => {
        const nextValue = { ...currentValue }
        delete nextValue[type]
        return nextValue
      })
    }

    window.setTimeout(() => {
      document.getElementById(`${inputIdPrefix}-supplier-doc-${type}`)?.click()
    }, 0)
  }

  function requestUpload(type, file) {
    if (uploadStateByType[type]?.isUploading) return

    const validationMessage = validateFile(file)

    if (validationMessage) {
      setErrorByType((currentValue) => ({ ...currentValue, [type]: validationMessage }))
      clearInput(type)
      return
    }

    handleUpload(type, file)
  }

  async function handleUpload(type, file) {
    // Always remember the selected file first so the filename can be shown in errors or state.
    setLastUploadByType((currentValue) => ({ ...currentValue, [type]: file }))

    setErrorByType((currentValue) => {
      const nextValue = { ...currentValue }
      delete nextValue[type]
      return nextValue
    })

    if (!supplierId) {
      const normalizedType = normalizeSupplierDocumentType(type)
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
      const stagedDocument = {
        id: tempId,
        supplierDocumentId: tempId,
        documentId: tempId,
        documentType: normalizedType,
        type: normalizedType,
        fileName: file.name,
        originalFileName: file.name,
        displayName: file.name,
        fileSize: file.size,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        status: 'Staged for upload',
        isTemporary: true,
        file,
      }

      setDocumentList((currentList) => {
        let nextList
        if (SUPPLIER_SINGLE_DOCUMENT_TYPES.includes(normalizedType)) {
          nextList = [
            ...currentList.filter((doc) => getDocumentType(doc) !== normalizedType),
            stagedDocument,
          ]
        } else {
          nextList = [...currentList, stagedDocument]
        }
        onDocumentsChange?.(nextList)
        return nextList
      })

      showToast({
        type: 'success',
        title: 'Supplier Documents',
        message: `${getSupplierDocumentTypeLabel(type)} attached. Save supplier to finalize upload.`,
      })
      clearInput(type)
      return
    }

    setUploadStateByType((currentValue) => ({
      ...currentValue,
      [type]: { isUploading: true, progress: 3, fileName: file.name },
    }))

    try {
      const response = await uploadSupplierDocument(supplierId, {
        documentType: normalizeSupplierDocumentType(type),
        file,
        onProgress: (progress) => {
          setUploadStateByType((currentValue) => ({
            ...currentValue,
            [type]: { isUploading: true, progress: Math.max(3, progress), fileName: file.name },
          }))
        },
      })

      if (!response.success) {
        throw new Error(response.error || response.message || 'Upload failed. Please retry.')
      }

      const replaceTarget = replaceTargetByType[type]
      const replaceTargetId = getDocumentId(replaceTarget)

      if (replaceTargetId && !SUPPLIER_SINGLE_DOCUMENT_TYPES.includes(type)) {
        const deleteResponse = await deleteSupplierDocument(replaceTargetId)

        if (!deleteResponse.success) {
          throw new Error(deleteResponse.error || deleteResponse.message || 'Replacement uploaded, but the previous document could not be removed.')
        }
      }

      setUploadStateByType((currentValue) => ({
        ...currentValue,
        [type]: { isUploading: true, progress: 100, fileName: file.name },
      }))
      const nextDocuments = await refreshDocuments()
      onDocumentsChange?.(nextDocuments)
      setReplaceTargetByType((currentValue) => {
        const nextValue = { ...currentValue }
        delete nextValue[type]
        return nextValue
      })
      showToast({
        type: 'success',
        title: 'Supplier Documents',
        message: `${getSupplierDocumentTypeLabel(type)} staged. Save supplier to finalize.`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network error. Upload failed.'
      setErrorByType((currentValue) => ({ ...currentValue, [type]: message }))
      showToast({
        type: 'error',
        title: 'Supplier Documents',
        message,
      })
    } finally {
      setUploadStateByType((currentValue) => ({
        ...currentValue,
        [type]: { isUploading: false, progress: 0, fileName: '' },
      }))
      clearInput(type)
    }
  }

  async function handlePreview(document) {
    const documentId = getDocumentId(document)
    if (!documentId) return

    if (document?.file instanceof File || document?.file instanceof Blob) {
      if (!previewBlob(document.file)) {
        showToast({
          type: 'warning',
          title: 'Supplier Documents',
          message: 'Preview was blocked by the browser. Use Download to open the file.',
        })
      }
      return
    }

    setPreviewingId(documentId)

    try {
      const response = await downloadSupplierDocument(documentId, getDocumentFileName(document))

      if (!response.success) {
        throw new Error(response.error || 'Document preview failed.')
      }

      if (!previewBlob(response.blob)) {
        showToast({
          type: 'warning',
          title: 'Supplier Documents',
          message: 'Preview was blocked by the browser. Use Download to open the file.',
        })
      }
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Supplier Documents',
        message: error instanceof Error ? error.message : 'Document preview failed.',
      })
    } finally {
      setPreviewingId('')
    }
  }

  async function handleDownload(document) {
    const documentId = getDocumentId(document)
    if (!documentId) return

    if (document?.file instanceof File || document?.file instanceof Blob) {
      saveBlob(document.file, getDocumentFileName(document))
      return
    }

    setDownloadingId(documentId)

    try {
      const response = await downloadSupplierDocument(documentId, getDocumentFileName(document))

      if (!response.success) {
        throw new Error(response.error || 'Document download failed.')
      }

      saveBlob(response.blob, response.filename)
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Supplier Documents',
        message: error instanceof Error ? error.message : 'Document download failed.',
      })
    } finally {
      setDownloadingId('')
    }
  }

  async function handleDelete(document) {
    const documentId = getDocumentId(document)
    if (!documentId) return

    const isStagedOrTemp = Boolean(document?.file instanceof File || document?.isTemporary || String(documentId).startsWith('temp-') || !supplierId)

    if (isStagedOrTemp) {
      const nextDocuments = documentList.filter((item) => getDocumentId(item) !== documentId)
      setDocumentList(nextDocuments)
      onDocumentsChange?.(nextDocuments)
      showToast({
        type: 'success',
        title: 'Supplier Documents',
        message: 'Document removed.',
      })
      return
    }

    const previousDocuments = documentList
    const nextDocuments = documentList.filter((item) => getDocumentId(item) !== documentId)
    setDocumentList(nextDocuments)
    onDocumentsChange?.(nextDocuments)
    setDeletingId(documentId)

    try {
      const response = await deleteSupplierDocument(documentId)

      if (!response.success) {
        throw new Error(response.error || response.message || 'Document delete failed.')
      }

      const refreshedDocuments = await refreshDocuments()
      onDocumentsChange?.(refreshedDocuments)
      showToast({
        type: 'success',
        title: 'Supplier Documents',
        message: 'Document deleted.',
      })
    } catch (error) {
      setDocumentList(previousDocuments)
      onDocumentsChange?.(previousDocuments)
      showToast({
        type: 'error',
        title: 'Supplier Documents',
        message: error instanceof Error ? error.message : 'Document delete failed.',
      })
    } finally {
      setDeletingId('')
    }
  }

  function handleDrop(type, event) {
    event.preventDefault()
    setDragType('')

    if (readOnly || uploadStateByType[type]?.isUploading) return
    requestUpload(type, event.dataTransfer.files?.[0])
  }

  function renderActionButton({ kind = 'secondary', icon, label, title, onClick, disabled }) {
    return (
      <button
        type="button"
        className={`supplier-doc-action supplier-doc-action--${kind}`}
        onClick={onClick}
        disabled={disabled}
        title={title || label}
      >
        {icon}
        <span>{label}</span>
      </button>
    )
  }

  function renderUploadedFile(document, type, index = 0) {
    const documentId = getDocumentId(document)
    const isPreviewing = previewingId === documentId
    const isDownloading = downloadingId === documentId
    const isDeleting = deletingId === documentId
    const isUploading = Boolean(uploadStateByType[type]?.isUploading)
    const isBusy = isPreviewing || isDownloading || isDeleting || isUploading
    const filename = getDocumentDisplayName(document)

    return (
      <div className="supplier-doc-uploaded-file" key={documentId || `${type}-${index}`}>
        <div className="supplier-doc-file-icon">
          <FileText size={15} />
        </div>
        <div className="supplier-doc-file-main">
          <div className="supplier-doc-file-heading">
            <strong className="supplier-doc-file-name" title={filename}>{filename}</strong>
          </div>
          <div className="supplier-doc-row-meta" title={`Uploaded by ${getDocumentUploadedBy(document)}`}>
            {formatUploadedAt(document.uploadedAt)} <span aria-hidden="true">{'\u2022'}</span> {formatFileSize(document.fileSize)}
          </div>
        </div>
        <div className="supplier-doc-actions">
          {renderActionButton({
            kind: 'primary',
            icon: isPreviewing ? <LoaderCircle size={15} className="animate-spin" /> : <Eye size={15} />,
            label: 'Preview',
            onClick: () => handlePreview(document),
            disabled: !documentId || isBusy,
          })}
          {renderActionButton({
            kind: 'secondary',
            icon: isDownloading ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} />,
            label: 'Download',
            onClick: () => handleDownload(document),
            disabled: !documentId || isBusy,
          })}
          {!readOnly ? (
            <>
              {renderActionButton({
                kind: 'neutral',
                icon: <Upload size={14} />,
                label: 'Replace',
                onClick: () => setReplaceConfirmation({ type, document }),
                disabled: !documentId || isBusy,
              })}
              {renderActionButton({
                kind: 'danger',
                icon: isDeleting ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />,
                label: 'Delete',
                onClick: () => setDeleteConfirmation({ type, document }),
                disabled: !documentId || isBusy,
              })}
            </>
          ) : null}
        </div>
      </div>
    )
  }

  function renderCardContent(type, documentsForType) {
    const uploadState = uploadStateByType[type] || {}
    const isUploading = Boolean(uploadState.isUploading)
    const progress = Number(uploadState.progress || 0)
    const error = errorByType[type]
    const hasDocuments = documentsForType.length > 0

    if (isUploading) {
      return (
        <div className="supplier-doc-state supplier-doc-state--uploading">
          <strong>{uploadState.fileName || 'Uploading document'}</strong>
          <p>Staging document</p>
          <div className="supplier-doc-progress">
            <span style={{ width: `${progress}%` }} />
          </div>
          <span>{progress}% complete</span>
        </div>
      )
    }

    if (error) {
      const selectedFile = lastUploadByType[type]
      return (
        <div className="supplier-doc-state supplier-doc-state--error">
          <strong>Upload needs attention</strong>
          {selectedFile ? (
            <p className="supplier-doc-selected-filename" title={selectedFile.name}>
              <FileText size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              {selectedFile.name}
            </p>
          ) : null}
          <p>{error}</p>
          <div className="supplier-doc-state-actions">
            {selectedFile ? renderActionButton({
              kind: 'primary',
              icon: <RotateCcw size={15} />,
              label: 'Retry',
              onClick: () => requestUpload(type, selectedFile),
            }) : null}
            {!readOnly ? renderActionButton({
              kind: 'neutral',
              icon: <Upload size={15} />,
              label: 'Choose File',
              onClick: () => openPicker(type),
            }) : null}
          </div>
        </div>
      )
    }

    if (hasDocuments) {
      const visibleDocuments = documentsForType
      const isOther = type === SUPPLIER_DOCUMENT_TYPES.OTHER

      return (
        <div className="supplier-doc-uploaded-stack">
          {visibleDocuments.map((document, index) => renderUploadedFile(document, type, index))}
          {isOther && !readOnly ? (
            <button
              type="button"
              className="supplier-doc-empty-upload"
              onClick={() => openPicker(type)}
              style={{ marginTop: '8px', alignSelf: 'flex-start' }}
            >
              <Upload size={15} />
              Upload Document
            </button>
          ) : null}
        </div>
      )
    }

    const isEmptyOther = type === SUPPLIER_DOCUMENT_TYPES.OTHER
    return (
      <div className="supplier-doc-state supplier-doc-state--empty">
        <p>{isEmptyOther ? 'No supporting attachments on file' : 'Compliance document not on file'}</p>
        <div className="supplier-doc-requirements">
          <span>{FILE_REQUIREMENTS_TEXT}</span>
        </div>
        {!readOnly ? (
          <button type="button" className="supplier-doc-empty-upload" onClick={() => openPicker(type)}>
            <Upload size={15} />
            Upload Document
          </button>
        ) : null}
      </div>
    )
  }

  function renderOtherDocumentsManager() {
    const type = SUPPLIER_DOCUMENT_TYPES.OTHER
    const label = OTHER_DOCUMENT_OPTION?.label || getSupplierDocumentTypeLabel(type)
    const documentsForType = documentsByType[type] || []
    const uploadState = uploadStateByType[type] || {}
    const isUploading = Boolean(uploadState.isUploading)
    const state = isUploading
      ? 'uploading'
      : errorByType[type]
        ? 'error'
        : documentsForType.length > 0
          ? 'uploaded'
          : 'empty'

    return (
      <article
        className={`supplier-doc-card supplier-doc-card--${state} ${dragType === type ? 'is-drag-active' : ''}`.trim()}
        onDragOver={(event) => {
          event.preventDefault()
          setDragType(type)
        }}
        onDragLeave={() => setDragType('')}
        onDrop={(event) => handleDrop(type, event)}
      >
        <input
          id={`${inputIdPrefix}-supplier-doc-${type}`}
          type="file"
          className="supplier-document-input"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={(event) => requestUpload(type, event.target.files?.[0])}
          disabled={uploadStateByType[type]?.isUploading}
        />
        <div className="supplier-doc-card-header">
          <div className="supplier-doc-card-icon">
            <FileText size={15} />
          </div>
          <div className="supplier-doc-card-title">
            <strong>{label}</strong>
          </div>
        </div>

        <div className="supplier-doc-card-body">
          {renderCardContent(type, documentsForType)}
        </div>
      </article>
    )
  }

  return (
    <SupplierSection
      title="Documents"
      className="supplier-documents-section"
      actions={(
        <button type="button" className="button button-secondary supplier-document-refresh" onClick={refreshDocuments} disabled={isRefreshing || !supplierId}>
          {isRefreshing ? <LoaderCircle size={15} className="animate-spin" /> : <RotateCcw size={15} />}
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      )}
    >
      {refreshError ? (
        <div className="supplier-document-alert page-error-banner" role="alert">
          <AlertTriangle size={16} />
          <span>{refreshError}</span>
          <button type="button" className="button button-secondary" onClick={refreshDocuments} disabled={isRefreshing}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="supplier-doc-layout">
        <div className="supplier-doc-primary-grid">
          {PRIMARY_DOCUMENT_OPTIONS.map(({ value, label }) => {
            const type = normalizeSupplierDocumentType(value)
            const documentsForType = documentsByType[type] || []
            const state = uploadStateByType[type]?.isUploading
              ? 'uploading'
              : errorByType[type]
                ? 'error'
                : documentsForType.length > 0
                  ? 'uploaded'
                  : 'empty'

            return (
              <article
                key={type}
                className={`supplier-doc-card supplier-doc-card--${state} ${dragType === type ? 'is-drag-active' : ''}`.trim()}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragType(type)
                }}
                onDragLeave={() => setDragType('')}
                onDrop={(event) => handleDrop(type, event)}
              >
                <input
                  id={`${inputIdPrefix}-supplier-doc-${type}`}
                  type="file"
                  className="supplier-document-input"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  onChange={(event) => requestUpload(type, event.target.files?.[0])}
                  disabled={uploadStateByType[type]?.isUploading}
                />
                <div className="supplier-doc-card-header">
                  <div className="supplier-doc-card-icon">
                    <FileText size={15} />
                  </div>
                  <div className="supplier-doc-card-title">
                    <strong>{label}</strong>
                  </div>
                </div>
                <div className="supplier-doc-card-body">
                  {renderCardContent(type, documentsForType)}
                </div>
              </article>
            )
          })}
        </div>

        {renderOtherDocumentsManager()}
      </div>

      {replaceConfirmation ? (
        <div className="supplier-document-confirm-backdrop" role="presentation">
          <div className="supplier-document-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="supplier-document-replace-title">
            <div className="supplier-document-confirm-dialog__icon">
              <Upload size={18} />
            </div>
            <div>
              <strong id="supplier-document-replace-title">Replace Document?</strong>
              <p>Uploading a new file will replace the current document and archive the previous version.</p>
            </div>
            <div className="supplier-document-confirm-dialog__actions">
              <button type="button" className="button button-secondary button-cancel" onClick={() => setReplaceConfirmation(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={() => {
                  const target = replaceConfirmation
                  setReplaceConfirmation(null)
                  openPicker(target.type, target.document)
                }}
              >
                Choose New File
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirmation ? (
        <div className="supplier-document-confirm-backdrop" role="presentation">
          <div className="supplier-document-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="supplier-document-delete-title">
            <div className="supplier-document-confirm-dialog__icon supplier-document-confirm-dialog__icon--danger">
              <Trash2 size={18} />
            </div>
            <div>
              <strong id="supplier-document-delete-title">Delete Document?</strong>
              <p>This permanently removes the document from the supplier record, database, and document storage.</p>
            </div>
            <div className="supplier-document-confirm-dialog__actions">
              <button type="button" className="button button-secondary button-cancel" onClick={() => setDeleteConfirmation(null)} disabled={Boolean(deletingId)}>
                Cancel
              </button>
              <button
                type="button"
                className="button button-danger"
                onClick={() => {
                  const target = deleteConfirmation.document
                  setDeleteConfirmation(null)
                  handleDelete(target)
                }}
                disabled={Boolean(deletingId)}
              >
                Delete Document
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </SupplierSection>
  )
}
