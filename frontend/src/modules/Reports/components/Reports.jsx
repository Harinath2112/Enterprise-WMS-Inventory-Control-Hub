import {
  formatCurrency,
  getLowStockProducts,
  getMonthlyTransactionData,
} from '../../../utils/helpers'
import { BarChart3 } from 'lucide-react'
import PageHeader from '../../../components/common/PageHeader'

import StatsCards from './StatsCards'
import TransactionChart from './TransactionChart'
import LowStockTable from './LowStockTable'

import './Reports.css'

export default function Reports({ data }) {
  const lowStockProducts = getLowStockProducts(data.products)

  const reportData = getMonthlyTransactionData(
    data.purchases,
    data.sales,
  )

  const purchaseValue = data.purchases.reduce(
    (total, item) => total + Number(item.total || 0),
    0,
  )

  const salesValue = data.sales.reduce(
    (total, item) => total + Number(item.total || 0),
    0,
  )

  const statsData = {
    purchaseValue,
    salesValue,
    lowStockCount: lowStockProducts.length,
    warehouseCount: data.warehouses.length,
  }

  return (
    <div className="page reports-page">
      <PageHeader
        icon={BarChart3}
        title="Reports"
        description="Review summary figures and stock alerts."
      />

      <StatsCards stats={statsData} formatCurrency={formatCurrency} />

      <div className="reports-grid">
        <TransactionChart reportData={reportData} />

        <LowStockTable lowStockProducts={lowStockProducts} />
      </div>
    </div>
  )
}
