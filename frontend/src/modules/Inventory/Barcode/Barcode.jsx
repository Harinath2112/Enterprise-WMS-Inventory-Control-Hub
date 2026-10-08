import { Plus, ScanLine } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import PageHeader from '../../../components/common/PageHeader'
import StateBlock from '../../../components/common/StateBlock'
import { getRequiredError, getToday } from '../../../utils/helpers'
import BarcodeForm from './components/BarcodeForm'
import BarcodeTable from './components/BarcodeTable'
import { getPreviewValue } from './utils/preview'
import { getBarcodes, generateBarcode } from '../../../api/barcodeApi'
import './Barcode.css'

const initialForm = {
  productId: '',
  codeType: 'Barcode',
  date: getToday(),
}

export default function Barcode({
  products = [],
  onQuickAddProduct,
}) {
  const { hasPermission } = useAuth()
  const [barcodes, setBarcodes] = useState([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formData, setFormData] = useState(initialForm)
  const [touched, setTouched] = useState({})
  const [message, setMessage] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const canCreate = hasPermission('barcode', 'create')

  const errors = {
    productId: getRequiredError(formData.productId, 'Product'),
    date: getRequiredError(formData.date, 'Date'),
  }
  const selectedProduct = products.find((item) => String(item.id) === String(formData.productId)) ?? null
  const livePreviewValue = getPreviewValue(selectedProduct, formData.codeType)

  async function loadBarcodes() {
    setIsLoading(true)
    setErrorMessage('')
    try {
      const response = await getBarcodes(products)
      if (response.success) {
        setBarcodes(response.data)
      } else {
        setErrorMessage(response.error || 'Failed to load barcodes.')
      }
    } catch (err) {
      setErrorMessage('An unexpected error occurred while loading barcodes.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadBarcodes()
  }, [products])

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null)
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [message])

  function handleChange(event) {
    const { name, value } = event.target
    setFormData((currentValue) => ({ ...currentValue, [name]: value }))
  }

  function handleBlur(event) {
    const { name } = event.target
    setTouched((currentValue) => ({ ...currentValue, [name]: true }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setTouched({ productId: true, date: true })

    if (Object.values(errors).some(Boolean)) {
      return
    }

    setIsSaving(true)
    setMessage(null)

    try {
      const response = await generateBarcode(formData.productId, products)

      if (response.success) {
        setBarcodes((current) => [response.data, ...current])
        setFormData(initialForm)
        setTouched({})
        setIsFormOpen(false)
        setMessage({
          success: true,
          message: `${formData.codeType} generated successfully.`,
        })
      } else {
        setMessage({
          success: false,
          message: response.error || 'Failed to generate code.',
        })
      }
    } catch (err) {
      setMessage({
        success: false,
        message: 'An unexpected error occurred while generating code.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  function handleQuickAddProduct(values) {
    const result = onQuickAddProduct(values)
    setMessage(result)
    return result.success ? result.item : null
  }

  function handleCancel() {
    setFormData(initialForm)
    setTouched({})
    setIsFormOpen(false)
  }

  return (
    <div className="page barcode-page">
      <PageHeader
        icon={ScanLine}
        title="Barcode / QR"
        description=""
        actions={
          canCreate ? (
            <button
              type="button"
              className="button button-primary"
              onClick={() => setIsFormOpen((currentValue) => !currentValue)}
            >
              <Plus size={16} />
              Add Code
            </button>
          ) : null
        }
      />

      {message ? (
        <div
          className={`message-box ${
            message.success ? 'message-box--success' : 'message-box--error'
          }`}
        >
          {message.message}
        </div>
      ) : null}

      {isFormOpen ? (
        <BarcodeForm
          formData={formData}
          touched={touched}
          errors={errors}
          products={products}
          livePreviewValue={livePreviewValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onQuickAddProduct={handleQuickAddProduct}
          isSaving={isSaving}
        />
      ) : null}

      {isLoading ? (
        <StateBlock
          type="loading"
          title="Loading Barcodes"
          message="Fetching dynamic barcodes from the backend..."
        />
      ) : errorMessage ? (
        <StateBlock
          type="error"
          title="Failed to Load Barcodes"
          message={errorMessage}
          actionLabel="Retry"
          onAction={loadBarcodes}
        />
      ) : (
        <BarcodeTable barcodes={barcodes} />
      )}
    </div>
  )
}
