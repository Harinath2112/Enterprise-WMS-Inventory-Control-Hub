import { useEffect, useState } from 'react'
import {
  createSupplierPayment,
  deleteSupplierPayment,
  getSupplierPayments,
} from '../../api/businessApi'
import { getSuppliers } from '../../api/suppliersApi'
import SupplierPaymentModule from './SupplierPaymentModule'

export default function SupplierPayments({ suppliers: propSuppliers }) {
  const [liveSuppliers, setLiveSuppliers] = useState(propSuppliers || [])

  useEffect(() => {
    getSuppliers().then((res) => {
      if (res?.success && Array.isArray(res?.data) && res.data.length > 0) {
        setLiveSuppliers(res.data)
      }
    }).catch(() => {})
  }, [])

  const suppliersList = liveSuppliers?.length ? liveSuppliers : propSuppliers

  return (
    <SupplierPaymentModule
      suppliers={suppliersList}
      fetchPayments={getSupplierPayments}
      createPayment={createSupplierPayment}
      deletePayment={deleteSupplierPayment}
    />
  )
}
