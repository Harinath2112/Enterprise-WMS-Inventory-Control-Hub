import {
  ArrowLeft,
  BarChart3,
  Clock3,
  Eye,
  FileText,
  LoaderCircle,
  Mail,
  Pencil,
  Phone,
  RefreshCw,
  ReceiptText,
  Trash2,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import StateBlock from '../../../components/common/StateBlock'
import { DataTable } from '../../../components/erp'
import { formatCreditLimit, formatCurrency } from '../../../utils/helpers'
import CustomerDetailCard from './CustomerDetailCard'
import StatusBadge from './StatusBadge'

function formatDate(value) {
  if (value === undefined || value === null || value === '') {
    return '-'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getDateSortValue(value) {
  if (value === undefined || value === null || value === '') {
    return 0
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function getTotalAmount(customer, history) {
  const historyTotal = history.reduce(
    (total, item) => total + Number(item.amount || 0),
    0,
  )

  return Number(customer?.totalPurchases || 0) || historyTotal
}

export default function CustomerDetailsPanel({
  customer,
  history,
  loading,
  historyLoading,
  canEdit,
  canDelete,
  onBack,
  onEdit,
  onDelete,
  onRefresh,
}) {
  const [activeTab, setActiveTab] = useState('overview')
  const transactionRows = history.filter((item) => item.isTransaction)
  const totalAmount = getTotalAmount(customer, history)
  const latestActivity = history[0]?.date || customer?.lastActivity
  const totalOrders =
    Number(customer?.totalOrders || 0) ||
    transactionRows.filter((item) => /sale|purchase|order/i.test(item.type)).length

  const historyColumns = [
    {
      key: 'date',
      label: 'Date',
      sortable: true,
      sortValue: (item) => getDateSortValue(item.date),
      render: (item) => formatDate(item.date),
    },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      render: (item) => item.type,
    },
    {
      key: 'description',
      label: 'Description',
      sortable: true,
      searchValue: (item) =>
        `${item.description} ${item.productName} ${item.type} ${item.status}`,
      render: (item) => (
        <div className="customers-page__table-stack">
          <strong>{item.productName || item.description}</strong>
          {item.productName ? <span>{item.description}</span> : null}
        </div>
      ),
    },
    {
      key: 'quantity',
      label: 'Quantity',
      sortable: true,
      sortValue: (item) => Number(item.quantity || 0),
      render: (item) => Number(item.quantity || 0),
    },
    {
      key: 'amount',
      label: 'Amount',
      sortable: true,
      sortValue: (item) => Number(item.amount || 0),
      render: (item) => formatCurrency(item.amount || 0),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (item) => <StatusBadge status={item.status} />,
    },
  ]
  const tabs = [
    { key: 'overview', label: 'Overview', icon: Users },
    { key: 'activity', label: 'Activity', icon: Clock3 },
    { key: 'transactions', label: 'Transactions', icon: ReceiptText },
    { key: 'notes', label: 'Notes', icon: FileText },
    { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  ]

  if (loading) {
    return (
      <section className="card customers-page__details-loading" role="status">
        <LoaderCircle size={18} className="animate-spin" />
        Loading customer details...
      </section>
    )
  }

  if (!customer) {
    return (
      <section className="card customers-page__details-empty">
        <div>
          <Eye size={24} />
          <h2 className="section-title">Customer Details</h2>
          <p className="helper-text">
            Select a customer from the directory to view profile and activity data.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="customers-page__details customers-workspace" aria-label="Customer details">
      <div className="customers-workspace__hero">
        <div className="customers-workspace__identity">
          <div className="customers-page__avatar customers-workspace__avatar">
            <Users size={22} />
          </div>
          <div className="customers-workspace__identity-copy">
            <div className="customers-workspace__title-row">
              <h2>{customer.name}</h2>
              <StatusBadge status={customer.status} />
            </div>
            <p>
              {customer.company || 'Individual'} - {customer.customerCode || customer.id}
            </p>
          </div>
        </div>

        <div className="customers-workspace__financial-strip" aria-label="Customer financial snapshot">
          <div>
            <span>Total value</span>
            <strong>{formatCurrency(totalAmount)}</strong>
          </div>
          <div>
            <span>Outstanding</span>
            <strong>{formatCurrency(customer.outstandingBalance || 0)}</strong>
          </div>
          <div>
            <span>Orders</span>
            <strong>{totalOrders}</strong>
          </div>
        </div>

        <div className="customers-page__detail-actions customers-workspace__actions">
          <button type="button" className="button button-secondary" onClick={onBack}>
            <ArrowLeft size={16} />
            Directory
          </button>
          <button type="button" className="button button-secondary" onClick={onRefresh}>
            <RefreshCw size={16} />
            Refresh
          </button>
          {canEdit ? (
            <button type="button" className="button" onClick={() => onEdit(customer)}>
              <Pencil size={16} />
              Edit
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              className="button button-danger"
              onClick={() => onDelete(customer)}
            >
              <Trash2 size={16} />
              Delete
            </button>
          ) : null}
        </div>
      </div>

      <div className="customers-workspace__body">
        <div className="customers-workspace__main">
          <div className="customers-workspace__tabs" role="tablist" aria-label="Customer workspace sections">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={`customers-workspace__tab ${isActive ? 'is-active' : ''}`}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <Icon size={15} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div className="card customers-workspace__panel">
            {activeTab === 'overview' ? (
              <div className="customers-workspace__overview">
                <div className="customers-page__detail-grid customers-workspace__kpis">
                  <CustomerDetailCard
                    label="Total Orders"
                    value={totalOrders}
                    helper="Orders or transaction rows returned by the API."
                  />
                  <CustomerDetailCard
                    label="Total Amount"
                    value={formatCurrency(totalAmount)}
                    helper="Customer purchase value reported by the API."
                  />
                  <CustomerDetailCard
                    label="Last Activity"
                    value={formatDate(latestActivity)}
                    helper="Most recent customer activity."
                  />
                  <CustomerDetailCard
                    label="Outstanding"
                    value={formatCurrency(customer.outstandingBalance || 0)}
                    helper="Outstanding balance on the customer profile."
                    status={Number(customer.outstandingBalance || 0) > 0 ? 'Pending' : 'Active'}
                  />
                </div>

                <div className="customers-workspace__overview-grid">
                  <section>
                    <h3>Operational Snapshot</h3>
                    <dl className="customers-workspace__compact-meta">
                      <div>
                        <dt>Customer class</dt>
                        <dd>{customer.company ? 'Business account' : 'Individual account'}</dd>
                      </div>
                      <div>
                        <dt>Tax profile</dt>
                        <dd>{customer.gstNumber || 'Not provided'}</dd>
                      </div>
                      <div>
                        <dt>Credit limit</dt>
                        <dd>
                          {customer.creditLimit !== undefined && customer.creditLimit !== null && customer.creditLimit !== ''
                            ? formatCreditLimit(customer.creditLimit, 'INR')
                            : 'Not set'}
                        </dd>
                      </div>
                      <div>
                        <dt>Account Number</dt>
                        <dd className="font-mono">
                          {customer.accountNumber ||
                            customer.accountNo ||
                            customer.bankAccounts?.[0]?.accountNumber ||
                            customer.bankDetails?.[0]?.accountNumber ||
                            'Not provided'}
                        </dd>
                      </div>
                      <div>
                        <dt>Last touch</dt>
                        <dd>{formatDate(latestActivity)}</dd>
                      </div>
                    </dl>
                  </section>

                  <section>
                    <h3>Recent Activity</h3>
                    {historyLoading ? (
                      <div className="customers-page__timeline-loading">Loading customer activity...</div>
                    ) : history.length === 0 ? (
                      <StateBlock
                        type="empty"
                        title="No recent activity"
                        message="Customer events will appear here once sales, payments, or profile changes are recorded."
                        compact
                        className="customers-page__empty-panel"
                      />
                    ) : (
                      <ol className="customers-page__timeline customers-workspace__mini-timeline">
                        {history.slice(0, 4).map((item) => (
                          <li key={item.id || `${item.type}-${item.date}`}>
                            <span className="customers-page__timeline-dot" />
                            <div>
                              <strong>{item.type}</strong>
                              <p>{item.description}</p>
                              <time>{formatDate(item.date)}</time>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                </div>
              </div>
            ) : null}

            {activeTab === 'activity' ? (
              <section className="customers-page__timeline-card customers-workspace__tab-section">
                <div className="customers-page__timeline-header">
                  <div>
                    <h2 className="section-title">Customer Activity</h2>
                    <p className="helper-text">Operational events returned by the history endpoint.</p>
                  </div>
                  {historyLoading ? <LoaderCircle size={18} className="animate-spin" /> : null}
                </div>

                {historyLoading ? (
                  <div className="customers-page__timeline-loading">Loading customer activity...</div>
                ) : history.length === 0 ? (
                  <StateBlock
                    type="empty"
                    title="No activity history"
                    message="There are no recorded events for this customer yet. New operational activity will be listed here."
                    compact
                    className="customers-page__empty-panel"
                  />
                ) : (
                  <ol className="customers-page__timeline">
                    {history.slice(0, 10).map((item) => (
                      <li key={item.id || `${item.type}-${item.date}`}>
                        <span className="customers-page__timeline-dot" />
                        <div>
                          <strong>{item.type}</strong>
                          <p>{item.description}</p>
                          <time>{formatDate(item.date)}</time>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            ) : null}

            {activeTab === 'transactions' ? (
              <div className="customers-workspace__history-table">
                <DataTable
                  title="Purchase / Sales History"
                  subtitle="Transactions are populated only from the live customer history response."
                  rows={transactionRows}
                  columns={historyColumns}
                  loading={historyLoading}
                  defaultPageSize={5}
                  defaultSortKey="date"
                  defaultSortDirection="desc"
                  searchPlaceholder="Search history"
                  emptyMessage="No customer transactions available."
                  showSubtitle
                />
              </div>
            ) : null}

            {activeTab === 'notes' ? (
              <section className="customers-workspace__notes customers-workspace__tab-section">
                <div>
                  <h2 className="section-title">Notes</h2>
                  <p className="helper-text">Internal customer context for sales and support workflows.</p>
                </div>
                {customer.notes ? (
                  <div className="customers-workspace__note-surface">
                    {customer.notes}
                  </div>
                ) : (
                  <StateBlock
                    type="empty"
                    title="No notes recorded"
                    message="Internal notes for sales, billing, or support teams will appear here when added."
                    compact
                    className="customers-page__empty-panel"
                  />
                )}
              </section>
            ) : null}

            {activeTab === 'analytics' ? (
              <section className="customers-workspace__analytics customers-workspace__tab-section">
                <div>
                  <h2 className="section-title">Analytics</h2>
                  <p className="helper-text">Compact customer performance indicators.</p>
                </div>
                <div className="customers-page__detail-grid customers-workspace__kpis">
                  <CustomerDetailCard label="Transaction Rows" value={transactionRows.length} />
                  <CustomerDetailCard label="Average Value" value={formatCurrency(totalOrders ? totalAmount / totalOrders : 0)} />
                  <CustomerDetailCard label="Open Balance" value={formatCurrency(customer.outstandingBalance || 0)} />
                  <CustomerDetailCard label="Last Activity" value={formatDate(latestActivity)} />
                </div>
              </section>
            ) : null}
          </div>
        </div>

        <aside className="card customers-page__profile-card customers-workspace__side-panel">
          <div className="customers-workspace__side-heading">
            <span>Customer Profile</span>
            <StatusBadge status={customer.status} />
          </div>

          <dl className="customers-page__profile-list customers-workspace__profile-list">
            <div>
              <dt>
                <Mail size={14} />
                Email
              </dt>
              <dd>{customer.email || 'Not provided'}</dd>
            </div>
            <div>
              <dt>
                <Phone size={14} />
                Phone
              </dt>
              <dd>{customer.phone || 'Not provided'}</dd>
            </div>
            <div>
              <dt>Company</dt>
              <dd>{customer.company || 'Individual'}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{customer.address || 'Address not set'}</dd>
            </div>
            <div>
              <dt>GST / Tax</dt>
              <dd>{customer.gstNumber || 'Not provided'}</dd>
            </div>
            <div>
              <dt>Account Number</dt>
              <dd className="font-mono">
                {customer.accountNumber ||
                  customer.accountNo ||
                  customer.bankAccounts?.[0]?.accountNumber ||
                  customer.bankDetails?.[0]?.accountNumber ||
                  'Not provided'}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  )
}
