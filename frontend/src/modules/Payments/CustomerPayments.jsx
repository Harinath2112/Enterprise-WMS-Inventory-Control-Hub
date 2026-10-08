import { useEffect, useState } from 'react'
import {
  createCustomerPayment,
  deleteCustomerPayment,
  getCustomerPayments,
  updateCustomerPayment,
} from '../../api/businessApi'
import { getCustomers } from '../../api/customersApi'
import CustomerPaymentModule from './PaymentModule'

export default function CustomerPayments({ customers: propCustomers }) {
  const [liveCustomers, setLiveCustomers] = useState(propCustomers || [])

  useEffect(() => {
    getCustomers().then((res) => {
      if (res?.success && Array.isArray(res?.data) && res.data.length > 0) {
        setLiveCustomers(res.data)
      }
    }).catch(() => {})
  }, [])

  const customersList = liveCustomers?.length ? liveCustomers : propCustomers

  return (
    <CustomerPaymentModule
      customers={customersList}
      fetchPayments={getCustomerPayments}
      createPayment={createCustomerPayment}
      updatePayment={updateCustomerPayment}
      deletePayment={deleteCustomerPayment}
    />
  )
}
