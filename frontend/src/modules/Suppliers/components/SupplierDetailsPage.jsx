import { ArrowLeft, Building2, CreditCard, Landmark, Mail, Phone, Truck } from 'lucide-react'
import { useMemo, useState, useEffect } from 'react'
import { StatusBadge } from '../../../components/erp'
import { getPurchaseOrders } from '../../../api/businessApi'
import { formatCreditLimit, formatCurrency, formatDate } from '../../../utils/helpers'
import {
  formatEmpty,
  formatCategory,
  formatLastPurchase,
  formatNullableCurrency,
  formatPaymentMethod,
  formatStatus,
  getStatusBadgeType,
} from '../supplierFormatters'
import SupplierDocumentsTab from './SupplierDocumentsTab'
import SupplierPaymentsTab from './SupplierPaymentsTab'
import SupplierPerformanceTab from './SupplierPerformanceTab'
import SupplierPurchaseHistoryTab from './SupplierPurchaseHistoryTab'

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'purchaseHistory', label: 'Purchase History' },
  { id: 'paymentHistory', label: 'Payment History' },
  { id: 'performance', label: 'Performance' },
  { id: 'documents', label: 'Documents' },
]

function DetailCard({ icon: Icon, label, value, helper }) {
  return (
    <div className="supplier-detail-card">
      <div className="supplier-detail-card__icon">{Icon ? <Icon size={17} /> : null}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {helper ? <p>{helper}</p> : null}
      </div>
    </div>
  )
}

function SupplierDetailsOverview({ supplier = {}, purchases = [], payments = [] }) {
  const currentSupplier = supplier || {}
  const primaryContact = Array.isArray(currentSupplier.contacts)
    ? currentSupplier.contacts.find((contact) => contact?.isPrimary) || currentSupplier.contacts[0]
    : null
  const primaryBank = useMemo(() => {
    if (Array.isArray(currentSupplier.bankAccounts) && currentSupplier.bankAccounts.length > 0) {
      return currentSupplier.bankAccounts.find((acc) => acc?.isPrimary) || currentSupplier.bankAccounts[0]
    }
    if (Array.isArray(currentSupplier.bankDetails) && currentSupplier.bankDetails.length > 0) {
      return currentSupplier.bankDetails.find((acc) => acc?.isPrimary) || currentSupplier.bankDetails[0]
    }
    if (currentSupplier.bankDetails && typeof currentSupplier.bankDetails === 'object') {
      return currentSupplier.bankDetails
    }
    if (currentSupplier.bankName || currentSupplier.accountNumber || currentSupplier.ifscCode || currentSupplier.accountName) {
      return {
        bankName: currentSupplier.bankName || currentSupplier.bank || '',
        accountNumber: currentSupplier.accountNumber || currentSupplier.bankAccountNumber || '',
        accountName: currentSupplier.accountName || '',
        ifscCode: currentSupplier.ifscCode || currentSupplier.ifsc || '',
        branch: currentSupplier.branch || currentSupplier.bankBranch || '',
        upiId: currentSupplier.upiId || '',
      }
    }
    return null
  }, [currentSupplier])

  const paymentTerms = currentSupplier.paymentTerm || currentSupplier.paymentTermsProfile || {}

  const bankSummary = useMemo(() => {
    const bankName = String(primaryBank?.bankName ?? '').trim()
    const accountNumber = String(primaryBank?.accountNumber ?? '').trim()
    const accountName = String(primaryBank?.accountName ?? '').trim()
    const ifscCode = String(primaryBank?.ifscCode ?? '').trim().toUpperCase()
    const branch = String(primaryBank?.branch ?? '').trim()
    const upiId = String(primaryBank?.upiId ?? '').trim()

    const rawPaymentMethod = paymentTerms.preferredPaymentMethod || currentSupplier.preferredPaymentMethod || currentSupplier.paymentMethod || ''
    const formattedPaymentMethod = formatPaymentMethod(rawPaymentMethod)

    const hasAccountDetails = Boolean(bankName || accountNumber || ifscCode || accountName || upiId)

    if (hasAccountDetails) {
      let value = ''
      if (bankName && accountNumber) {
        value = `${bankName} • A/C ${accountNumber}`
      } else if (bankName) {
        value = bankName
      } else if (accountNumber) {
        value = `A/C ${accountNumber}`
      } else if (upiId) {
        value = `UPI: ${upiId}`
      } else if (accountName) {
        value = accountName
      } else if (ifscCode) {
        value = `IFSC: ${ifscCode}`
      }

      const helperParts = []
      if (accountName && value !== accountName) {
        helperParts.push(`A/C Name: ${accountName}`)
      }
      if (ifscCode && !value.includes(ifscCode)) {
        helperParts.push(`IFSC: ${ifscCode}`)
      }
      if (branch && !value.includes(branch)) {
        helperParts.push(`Branch: ${branch}`)
      }
      if (formattedPaymentMethod && helperParts.length === 0) {
        helperParts.push(formattedPaymentMethod)
      }

      return {
        value,
        helper: helperParts.join(' • ') || formattedPaymentMethod || 'Bank Account',
      }
    }

    if (formattedPaymentMethod) {
      return {
        value: formattedPaymentMethod,
        helper: 'Account details not provided',
      }
    }

    return {
      value: 'Not provided',
      helper: 'No bank details or payment method',
    }
  }, [primaryBank, paymentTerms, currentSupplier])

  const computedTotalPurchases = useMemo(() => {
    if (!currentSupplier || !Array.isArray(purchases) || purchases.length === 0) return 0
    return purchases.reduce((sum, p) => sum + (Number(p?.totalAmount ?? p?.TotalAmount ?? p?.amount ?? p?.grandTotal ?? 0) || 0), 0)
  }, [purchases, currentSupplier])

  const computedLastPurchaseDate = useMemo(() => {
    if (Array.isArray(purchases) && purchases.length > 0) {
      const dates = purchases
        .map((p) => p?.orderDate || p?.createdAt || p?.createdDate || p?.date)
        .filter(Boolean)
        .sort((a, b) => new Date(b) - new Date(a))
      if (dates.length > 0) return dates[0]
    }
    return null
  }, [purchases])

  const computedOutstandingPayable = useMemo(() => {
    if (!currentSupplier || !Array.isArray(purchases) || purchases.length === 0) return 0
    const rawOutstanding = currentSupplier.outstandingPayable ?? currentSupplier.outstandingAmount ?? currentSupplier.outstandingBalance ?? currentSupplier.balanceAmount ?? currentSupplier.outstanding ?? currentSupplier.balance
    if (rawOutstanding != null && !isNaN(Number(rawOutstanding)) && Number(rawOutstanding) > 0) {
      return Number(rawOutstanding)
    }
    const totalPurchases = purchases.reduce((sum, p) => sum + (Number(p?.totalAmount ?? p?.TotalAmount ?? p?.amount ?? p?.grandTotal ?? 0) || 0), 0)
    const totalPaid = Array.isArray(payments) && payments.length > 0
      ? payments.reduce((sum, pay) => sum + (Number(pay?.amount ?? pay?.Amount ?? pay?.paidAmount ?? 0) || 0), 0)
      : purchases.reduce((sum, p) => sum + (Number(p?.paidAmount ?? p?.PaidAmount ?? p?.totalPaid ?? 0) || 0), 0)
    return Math.max(0, totalPurchases - totalPaid)
  }, [purchases, payments, currentSupplier])

  return (
    <div className="supplier-details__overview">
      <div className="card supplier-profile-card">
        <div>
          <span>{formatEmpty(currentSupplier.supplierCode)}</span>
          <h2>{formatEmpty(currentSupplier.name)}</h2>
          <p>{formatEmpty(currentSupplier.companyName)}</p>
        </div>
        <StatusBadge type={getStatusBadgeType(currentSupplier.status)}>
          {formatStatus(currentSupplier.status)}
        </StatusBadge>
      </div>

      <div className="supplier-detail-grid">
        <DetailCard icon={CreditCard} label="Outstanding Payable" value={formatNullableCurrency(formatCurrency, computedOutstandingPayable)} helper={Array.isArray(purchases) && purchases.length > 0 ? "API-reported open payable" : "No open payables"} />
        <DetailCard icon={Truck} label="Total Purchases" value={formatNullableCurrency(formatCurrency, computedTotalPurchases)} helper={`${Array.isArray(purchases) ? purchases.length : 0} purchase order records`} />
        <DetailCard icon={Building2} label="Last Purchase" value={formatLastPurchase(computedLastPurchaseDate, formatDate)} helper={formatCategory(currentSupplier.category)} />
        <DetailCard label="Primary Contact" value={formatEmpty(primaryContact?.name || currentSupplier.contact)} helper={formatEmpty(primaryContact?.phone || currentSupplier.phone)} />
        <DetailCard icon={Mail} label="Email" value={formatEmpty(currentSupplier.email || primaryContact?.email)} helper="Supplier communication" />
        <DetailCard icon={Landmark} label="Bank Summary" value={bankSummary.value} helper={bankSummary.helper} />
      </div>

      <div className="card supplier-details__terms">
        <h3>Payment Controls</h3>
        <div>
          <span>Credit Days</span>
          <strong>{formatEmpty(paymentTerms.creditDays)}</strong>
        </div>
        <div>
          <span>Credit Limit</span>
          <strong>
            {paymentTerms.creditLimit !== undefined && paymentTerms.creditLimit !== null && paymentTerms.creditLimit !== ''
              ? formatCreditLimit(paymentTerms.creditLimit, paymentTerms.currency || currentSupplier.currency || 'INR')
              : '-'}
          </strong>
        </div>
        <div>
          <span>Preferred Method</span>
          <strong>{formatEmpty(formatPaymentMethod(paymentTerms.preferredPaymentMethod))}</strong>
        </div>
        <div>
          <span>GST / PAN</span>
          <strong>{formatEmpty([currentSupplier.gstNumber || currentSupplier.gstin || currentSupplier.gst, currentSupplier.panNumber || currentSupplier.pan].filter(Boolean).join(' / '))}</strong>
        </div>
      </div>
    </div>
  )
}

export default function SupplierDetailsPage({
  supplier = {},
  purchases = [],
  payments = [],
  initialTab = 'overview',
  onBack,
  onDocumentsChange,
}) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const currentSupplier = supplier || {}
  const [internalPurchases, setInternalPurchases] = useState([])

  useEffect(() => {
    let isMounted = true
    if (!purchases || purchases.length === 0) {
      getPurchaseOrders()
        .then((res) => {
          if (!isMounted) return
          const poData = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : [])
          if (poData.length > 0) {
            const targetId = String(currentSupplier.id || currentSupplier.supplierId || '').trim().toLowerCase()
            const targetCode = String(currentSupplier.supplierCode || currentSupplier.code || '').trim().toLowerCase()
            const targetName = String(currentSupplier.name || '').trim().toLowerCase()
            const targetCompany = String(currentSupplier.companyName || '').trim().toLowerCase()
            const cleanTargetName = targetName.replace(/[^a-z0-9]/g, '')
            const cleanTargetCompany = targetCompany.replace(/[^a-z0-9]/g, '')

            const matched = poData.filter((item) => {
              const itemSupId = String(item.supplierId || item.SupplierId || item.supplier_id || '').trim().toLowerCase()
              const itemSupCode = String(item.supplierCode || item.SupplierCode || item.code || '').trim().toLowerCase()
              const itemSupName = String(item.supplierName || item.SupplierName || item.supplier || '').trim().toLowerCase()
              const cleanItemSupName = itemSupName.replace(/[^a-z0-9]/g, '')

              const matchId = Boolean(targetId && targetId !== '0' && (itemSupId === targetId || itemSupCode === targetId))
              const matchCode = Boolean(targetCode && (itemSupId === targetCode || itemSupCode === targetCode))
              const matchName = Boolean(
                (targetName && itemSupName && (itemSupName === targetName || itemSupName.includes(targetName) || targetName.includes(itemSupName))) ||
                (targetCompany && itemSupName && (itemSupName === targetCompany || itemSupName.includes(targetCompany) || targetCompany.includes(itemSupName))) ||
                (cleanTargetName && cleanItemSupName && (cleanTargetName === cleanItemSupName || cleanItemSupName.includes(cleanTargetName) || cleanTargetName.includes(cleanItemSupName))) ||
                (cleanTargetCompany && cleanItemSupName && (cleanTargetCompany === cleanItemSupName || cleanItemSupName.includes(cleanTargetCompany) || cleanTargetCompany.includes(cleanItemSupName)))
              )
              return matchId || matchCode || matchName
            })
            setInternalPurchases(matched)
          }
        })
        .catch(() => {})
    }
    return () => { isMounted = false }
  }, [purchases, currentSupplier])

  const effectivePurchases = useMemo(() => {
    return Array.isArray(purchases) && purchases.length > 0 ? purchases : internalPurchases
  }, [purchases, internalPurchases])

  const performance = useMemo(() => {
    const apiPerf = currentSupplier.performance || currentSupplier.Performance || {}
    const totalOrdersFromApi = apiPerf.totalOrders ?? apiPerf.TotalOrders

    const poList = Array.isArray(purchases) && purchases.length > 0 ? purchases : internalPurchases
    const poCount = poList.length

    const hasPurchaseHistorySignal = Boolean(
      poCount > 0 ||
      currentSupplier.lastPurchaseDate ||
      (currentSupplier.totalPurchaseAmount != null && Number(currentSupplier.totalPurchaseAmount) > 0) ||
      (currentSupplier.purchases != null && Number(currentSupplier.purchases) > 0)
    )

    if (totalOrdersFromApi != null && totalOrdersFromApi !== '' && Number(totalOrdersFromApi) > 0) {
      return {
        totalOrders: Number(totalOrdersFromApi),
        onTimeDeliveries: Number(apiPerf.onTimeDeliveries ?? apiPerf.OnTimeDeliveries ?? Number(totalOrdersFromApi)),
        delayedDeliveries: Number(apiPerf.delayedDeliveries ?? apiPerf.DelayedDeliveries ?? 0),
        vendorRating: apiPerf.vendorRating || apiPerf.VendorRating || apiPerf.rating || '5',
        lastSupplyDate: apiPerf.lastSupplyDate || apiPerf.LastSupplyDate || currentSupplier.lastPurchaseDate || null,
        returnPercentage: apiPerf.returnPercentage ?? apiPerf.ReturnPercentage ?? 0,
        ...apiPerf,
      }
    }

    if (poCount > 0) {
      const completedOrReceived = poList.filter((p) => {
        const st = String(p?.status || p?.orderStatus || p?.Status || '').toLowerCase()
        return ['completed', 'received', 'delivered', 'fulfilled', 'closed', 'ordered', 'approved'].includes(st)
      }).length

      const delayedCount = poList.filter((p) => {
        const st = String(p?.status || p?.orderStatus || p?.Status || '').toLowerCase()
        return ['delayed', 'overdue', 'cancelled', 'late'].includes(st)
      }).length

      const onTimeDeliveries = Math.max(0, completedOrReceived - delayedCount)
      const onTimeRate = poCount > 0 ? Math.round((onTimeDeliveries / poCount) * 100) : 100

      const sortedDates = poList
        .map((p) => p?.orderDate || p?.receivedDate || p?.createdAt || p?.createdDate || p?.date)
        .filter(Boolean)
        .sort((a, b) => new Date(b) - new Date(a))

      const lastSupplyDate = sortedDates[0] || currentSupplier.lastPurchaseDate || null

      let calculatedRating = '5'
      if (onTimeRate < 50) calculatedRating = '2.5'
      else if (onTimeRate < 75) calculatedRating = '3.5'
      else if (onTimeRate < 90) calculatedRating = '4.2'
      else if (onTimeRate < 100) calculatedRating = '4.8'

      return {
        totalOrders: poCount,
        onTimeDeliveries,
        delayedDeliveries: delayedCount,
        vendorRating: apiPerf.vendorRating || apiPerf.rating || calculatedRating,
        lastSupplyDate: apiPerf.lastSupplyDate || lastSupplyDate,
        returnPercentage: apiPerf.returnPercentage ?? 0,
        ...apiPerf,
      }
    }

    if (hasPurchaseHistorySignal) {
      return {
        totalOrders: 1,
        onTimeDeliveries: 1,
        delayedDeliveries: 0,
        vendorRating: apiPerf.vendorRating || apiPerf.rating || '5',
        lastSupplyDate: currentSupplier.lastPurchaseDate || apiPerf.lastSupplyDate || null,
        returnPercentage: apiPerf.returnPercentage ?? 0,
        ...apiPerf,
      }
    }

    return {
      totalOrders: 0,
      onTimeDeliveries: 0,
      delayedDeliveries: 0,
      vendorRating: apiPerf.vendorRating || apiPerf.rating || '5',
      lastSupplyDate: null,
      returnPercentage: 0,
      ...apiPerf,
    }
  }, [currentSupplier, purchases, internalPurchases])

  if (!supplier || (!supplier.id && !supplier.supplierId && !supplier.name)) {
    return null
  }

  return (
    <div className="supplier-details">
      <div className="supplier-details__header">
        <div>
          <h2>{formatEmpty(currentSupplier.name)}</h2>
          <p>Supplier operational workspace with procurement, payment, and performance context.</p>
        </div>
        <button type="button" className="button button-primary" onClick={onBack}>
          <ArrowLeft size={16} />
          Back to Suppliers
        </button>
      </div>

      <div className="card supplier-details__tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? 'is-active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' ? <SupplierDetailsOverview supplier={currentSupplier} purchases={effectivePurchases} payments={payments} /> : null}
      {activeTab === 'purchaseHistory' ? <SupplierPurchaseHistoryTab purchases={effectivePurchases} /> : null}
      {activeTab === 'paymentHistory' ? <SupplierPaymentsTab payments={payments} /> : null}
      {activeTab === 'performance' ? <SupplierPerformanceTab performance={performance} supplier={currentSupplier} purchases={effectivePurchases} /> : null}
      {activeTab === 'documents' ? (
        <SupplierDocumentsTab
          supplierId={currentSupplier.id || currentSupplier.supplierId}
          documents={currentSupplier.documents || []}
          onDocumentsChange={onDocumentsChange}
        />
      ) : null}
    </div>
  )
}
