import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import LoadingFallback from '../components/common/LoadingFallback'
import MainLayout from '../layouts/MainLayout'
import { useAuth } from '../hooks/useAuth'
import ProtectedRoute from './ProtectedRoute'

function lazyWithPreload(importer) {
  let importPromise
  const load = () => {
    importPromise ||= importer()
    return importPromise
  }
  const Component = lazy(load)
  Component.preload = load
  return Component
}

function RouteSuspense({ children }) {
  return (
    <Suspense fallback={<LoadingFallback label="Opening module..." />}>
      {children}
    </Suspense>
  )
}

function withRouteSuspense(element) {
  return <RouteSuspense>{element}</RouteSuspense>
}

const ForgotPassword = lazyWithPreload(() => import('../modules/Auth/ForgotPassword'))
const Landing = lazyWithPreload(() => import('../modules/Landing/Landing'))
const Login = lazyWithPreload(() => import('../modules/Auth/Login'))
const Register = lazyWithPreload(() => import('../modules/Auth/Register'))
const ResetPassword = lazyWithPreload(() => import('../modules/Auth/ResetPassword'))
const VerifyOTP = lazyWithPreload(() => import('../modules/Auth/VerifyOTP'))
const VerifyEmail = lazyWithPreload(() => import('../modules/Auth/VerifyEmail'))
const Barcode = lazyWithPreload(() => import('../modules/Inventory/Barcode/Barcode'))
const Brands = lazyWithPreload(() => import('../modules/Inventory/Brands/Brands'))
const Attributes = lazyWithPreload(() => import('../modules/Inventory/Attributes/Attributes'))
const Audit = lazyWithPreload(() => import('../modules/Inventory/Audit/Audit'))
const SubCategories = lazyWithPreload(() => import('../modules/Inventory/SubCategories/SubCategories'))
const ProductVariants = lazyWithPreload(() => import('../modules/Inventory/ProductVariants/ProductVariants'))
const Categories = lazyWithPreload(() => import('../modules/Inventory/Categories/Categories'))
const Customers = lazyWithPreload(() => import('../modules/Customers/Customers'))
const CustomerPayments = lazyWithPreload(() => import('../modules/Payments/CustomerPayments'))
const Dashboard = lazyWithPreload(() => import('../modules/Dashboard/Dashboard'))
const Products = lazyWithPreload(() => import('../modules/Inventory/Products/Products'))
const GoodsReceipts = lazyWithPreload(() => import('../modules/Inventory/GoodsReceipts/GoodsReceipts'))
const Stock = lazyWithPreload(() => import('../modules/Inventory/Stock/Stock'))
const Purchases = lazyWithPreload(() => import('../modules/Inventory/Purchases/Purchases'))
const PurchaseIndents = lazyWithPreload(() => import('../modules/Inventory/PurchaseIndents/PurchaseIndents'))
const CreatePurchaseIndent = lazyWithPreload(() => import('../modules/Inventory/PurchaseIndents/CreatePurchaseIndent'))
const PurchaseReturns = lazyWithPreload(() => import('../modules/Inventory/PurchaseReturns/PurchaseReturns'))
const CreatePurchaseReturn = lazyWithPreload(() => import('../modules/Inventory/PurchaseReturns/CreatePurchaseReturn'))
const PurchaseReturnDetails = lazyWithPreload(() => import('../modules/Inventory/PurchaseReturns/PurchaseReturnDetails'))
const Reports = lazyWithPreload(() => import('../modules/Reports/Reports'))
const Notifications = lazyWithPreload(() => import('../modules/Notifications/Notifications'))
const Invoices = lazyWithPreload(() => import('../modules/Accounting/Invoices/Invoices'))
const SalesReturns = lazyWithPreload(() => import('../modules/POS/SalesReturns/SalesReturns'))
const CreateSalesReturn = lazyWithPreload(() => import('../modules/POS/SalesReturns/CreateSalesReturn'))
const SalesReturnDetails = lazyWithPreload(() => import('../modules/POS/SalesReturns/SalesReturnDetails'))
const Sales = lazyWithPreload(() => import('../modules/POS/Sales/Sales'))
const CreateInvoice = lazyWithPreload(() => import('../modules/POS/Sales/CreateInvoice'))
const Suppliers = lazyWithPreload(() => import('../modules/Suppliers/Suppliers'))
const SupplierPayments = lazyWithPreload(() => import('../modules/Payments/SupplierPayments'))
const Units = lazyWithPreload(() => import('../modules/Inventory/Units/Units'))
const Warehouses = lazyWithPreload(() => import('../modules/Warehouses/Warehouses'))


const AdminUsers = lazyWithPreload(() => import('../modules/Administration/Users/Users'))
const AdminRoles = lazyWithPreload(() => import('../modules/Administration/Roles/Roles'))
const AdminAuditLogs = lazyWithPreload(() => import('../modules/Administration/AuditLogs/AuditLogs'))
const AdminSettingsPage = lazyWithPreload(() => import('../modules/Administration/AdminSettings/AdminSettings'))

const PRELOAD_AFTER_AUTH = [
  Dashboard,
  Products,
  Categories,
  Brands,
  Units,
  Purchases,
  PurchaseIndents,
  CreatePurchaseIndent,
  Sales,
  CreateInvoice,
  Suppliers,
  Customers,
  CustomerPayments,
  SupplierPayments,
  Warehouses,
  Reports,
  Barcode,
]

export default function AppRoutes({ data, actions }) {
  const { isAuthenticated } = useAuth()
  useEffect(() => {
    if (!isAuthenticated || typeof window === 'undefined') {
      return undefined
    }

    const preloadModules = () => {
      PRELOAD_AFTER_AUTH.forEach((Component) => {
        Component.preload?.().catch(() => {})
      })
    }

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(preloadModules, { timeout: 1500 })
      return () => window.cancelIdleCallback(idleId)
    }

    const timeoutId = window.setTimeout(preloadModules, 150)
    return () => window.clearTimeout(timeoutId)
  }, [isAuthenticated])

  const warehousesElement = withRouteSuspense(
    <Warehouses
      warehouses={data.warehouses}
      products={data.products}
      stock={data.stock}
      onSaveWarehouse={actions.saveWarehouse}
      onDeleteWarehouse={actions.deleteWarehouse}
      onSaveStockMovement={actions.saveStockMovement}
    />,
  )
  const reportsElement = withRouteSuspense(<Reports data={data} />)
  const notificationsElement = withRouteSuspense(<Notifications />)
  const accountingElement = withRouteSuspense(<Invoices />)

  const usersElement = withRouteSuspense(<AdminUsers />)
  const rolesElement = withRouteSuspense(<AdminRoles />)
  const auditLogsElement = withRouteSuspense(<AdminAuditLogs />)
  const settingsElement = withRouteSuspense(<AdminSettingsPage />)

  return (
    <Routes>
      <Route
        path="/"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : withRouteSuspense(<Landing />)}
      />
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : withRouteSuspense(<Login />)}
      />
      <Route
        path="/register"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : withRouteSuspense(<Register />)}
      />
      <Route
        path="/forgot-password"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : withRouteSuspense(<ForgotPassword />)}
      />
      <Route
        path="/verify-otp"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : withRouteSuspense(<VerifyOTP />)}
      />
      <Route
        path="/reset-password"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : withRouteSuspense(<ResetPassword />)}
      />
      <Route path="/verify-email" element={withRouteSuspense(<VerifyEmail />)} />

      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={withRouteSuspense(<Dashboard data={data} />)} />

          <Route
            path="/inventory/products/:productId?"
            element={withRouteSuspense(
              <Products
                products={data.products}
                suppliers={data.suppliers}
                warehouses={data.warehouses}
                onSaveProduct={actions.saveProduct}
                onDeleteProduct={actions.deleteProduct}
                onQuickAddSupplier={actions.quickAddSupplier}
                onQuickAddWarehouse={actions.quickAddWarehouse}
              />,
            )}
          />
          <Route path="/inventory/categories" element={withRouteSuspense(<Categories />)} />
          <Route path="/inventory/subcategories" element={withRouteSuspense(<SubCategories />)} />
          <Route path="/inventory/brands" element={withRouteSuspense(<Brands />)} />
          <Route path="/inventory/units" element={withRouteSuspense(<Units />)} />
          <Route path="/inventory/attributes" element={withRouteSuspense(<Attributes />)} />
          <Route path="/inventory/product-variants" element={withRouteSuspense(<ProductVariants />)} />
          <Route path="/inventory/stock" element={withRouteSuspense(<Stock />)} />
          <Route
            path="/inventory/purchase-indents"
            element={withRouteSuspense(
              <PurchaseIndents
                products={data.products}
                users={data.users}
                suppliers={data.suppliers}
              />,
            )}
          />
          <Route
            path="/inventory/purchase-indents/create"
            element={withRouteSuspense(
              <CreatePurchaseIndent
                suppliers={data.suppliers}
                products={data.products}
                users={data.users}
              />,
            )}
          />
          <Route path="/inventory/goods-receipts" element={withRouteSuspense(<GoodsReceipts />)} />
          <Route path="/inventory/purchase-returns" element={withRouteSuspense(<PurchaseReturns data={data} actions={actions} />)} />
          <Route path="/inventory/purchase-returns/create" element={withRouteSuspense(<CreatePurchaseReturn data={data} actions={actions} onSavePurchaseReturn={actions?.savePurchaseReturn} />)} />
          <Route path="/inventory/purchase-returns/edit/:id" element={withRouteSuspense(<CreatePurchaseReturn mode="edit" data={data} actions={actions} onSavePurchaseReturn={actions?.savePurchaseReturn} />)} />
          <Route path="/inventory/purchase-returns/:id" element={withRouteSuspense(<PurchaseReturnDetails data={data} actions={actions} />)} />
          <Route
            path="/inventory/purchases/:purchaseOrderId?"
            element={withRouteSuspense(
              <Purchases
                purchases={data.purchases}
                products={data.products}
                suppliers={data.suppliers}
                warehouses={data.warehouses}
                onSavePurchase={actions.savePurchase}
                onDeletePurchase={actions.deletePurchase}
                onQuickAddSupplier={actions.quickAddSupplier}
                onQuickAddProduct={actions.quickAddProduct}
                onQuickAddWarehouse={actions.quickAddWarehouse}
              />,
            )}
          />
          
          {/* POS Routes */}
          <Route
            path="/pos/sales"
            element={withRouteSuspense(
              <Sales
                sales={data.sales}
                products={data.products}
                customers={data.customers}
                warehouses={data.warehouses}
                onSaveSale={actions.saveSale}
                onDeleteSale={actions.deleteSale}
                onQuickAddCustomer={actions.quickAddCustomer}
                onQuickAddProduct={actions.quickAddProduct}
                onQuickAddWarehouse={actions.quickAddWarehouse}
              />,
            )}
          />
          <Route
            path="/pos/sales/create"
            element={withRouteSuspense(
              <CreateInvoice
                customers={data.customers}
                products={data.products}
              />,
            )}
          />
          <Route path="/inventory/sales" element={<Navigate to="/pos/sales" replace />} />
          <Route path="/inventory/sales/create" element={<Navigate to="/pos/sales/create" replace />} />

          <Route path="/pos/returns" element={withRouteSuspense(<SalesReturns data={data} actions={actions} />)} />
          <Route path="/pos/returns/create" element={withRouteSuspense(<CreateSalesReturn data={data} actions={actions} onSaveSalesReturn={actions?.saveSalesReturn} />)} />
          <Route path="/pos/returns/edit/:id" element={withRouteSuspense(<CreateSalesReturn mode="edit" data={data} actions={actions} onSaveSalesReturn={actions?.saveSalesReturn} />)} />
          <Route path="/pos/returns/:id" element={withRouteSuspense(<SalesReturnDetails data={data} actions={actions} />)} />
          <Route path="/pos/returns/returns" element={<Navigate to="/pos/returns" replace />} />
          <Route path="/extra/returns/*" element={<Navigate to="/pos/returns" replace />} />
          <Route path="/returns" element={<Navigate to="/pos/returns" replace />} />

          <Route
            path="/inventory/audit"
            element={withRouteSuspense(<Audit />)}
          />
          <Route
            path="/inventory/barcode"
            element={withRouteSuspense(
              <Barcode
                products={data.products}
                onQuickAddProduct={actions.quickAddProduct}
              />,
            )}
          />

          <Route
            path="/people/suppliers/:supplierId?"
            element={withRouteSuspense(
              <Suppliers
                suppliers={data.suppliers}
                purchases={data.purchases}
                onSaveSupplier={actions.saveSupplier}
                onDeleteSupplier={actions.deleteSupplier}
              />,
            )}
          />
          <Route
            path="/people/customers"
            element={withRouteSuspense(
              <Customers
                customers={data.customers}
                sales={data.sales}
                onSaveCustomer={actions.saveCustomer}
                onDeleteCustomer={actions.deleteCustomer}
              />,
            )}
          />
          <Route
            path="/people/customers/:customerId"
            element={withRouteSuspense(
              <Customers
                customers={data.customers}
                sales={data.sales}
                onSaveCustomer={actions.saveCustomer}
                onDeleteCustomer={actions.deleteCustomer}
              />,
            )}
          />
          <Route
            path="/people/customer-payments"
            element={withRouteSuspense(<CustomerPayments customers={data.customers} />)}
          />
          <Route
            path="/people/supplier-payments"
            element={withRouteSuspense(<SupplierPayments suppliers={data.suppliers} />)}
          />



          <Route path="/management/warehouses" element={warehousesElement} />
          <Route path="/warehouses" element={warehousesElement} />
          <Route path="/management/reports" element={reportsElement} />
          <Route path="/reports" element={reportsElement} />
          <Route path="/management/notifications" element={notificationsElement} />
          <Route path="/notifications" element={notificationsElement} />
          <Route path="/management/accounting/:invoiceId?" element={accountingElement} />
          <Route path="/accounting/:invoiceId?" element={accountingElement} />

          <Route path="/administration/users" element={usersElement} />
          <Route path="/users" element={usersElement} />
          <Route path="/administration/roles" element={rolesElement} />
          <Route path="/roles" element={rolesElement} />
          <Route path="/administration/audit-logs" element={auditLogsElement} />
          <Route path="/audit-logs" element={auditLogsElement} />
          <Route path="/administration/settings" element={settingsElement} />
          <Route path="/settings" element={settingsElement} />
        </Route>
      </Route>

      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />}
      />
    </Routes>
  )
}
