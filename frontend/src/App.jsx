import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { getCustomers } from './api/customersApi'
import { getProductCatalog, normalizeProduct } from './api/productApi'
import { getStockMovements, getStockRegister, STOCK_DATA_UPDATED_EVENT, invalidateStockCache } from './api/stockApi'
import { getSuppliers } from './api/suppliersApi'
import { getWarehouses } from './api/warehousesApi'
import { getUsers } from './api/usersApi.js'
import { getRolesWithPermissions, ROLES_UPDATED_EVENT } from './api/rolesApi'
import AppNetworkStatus from './components/common/AppNetworkStatus'
import ToastViewport from './components/common/ToastViewport'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useResponsiveTableLabels } from './hooks/useResponsiveTableLabels'
import AppRoutes from './routes/AppRoutes'
import ThemeToggle from './theme/ThemeToggle'
import {
  adjustStockQuantity,
  buildInitialState,
  buildInvoiceEntry,
  createId,
  createTransactionInvoice,
  getPasswordError,
  getStockQuantity,
  getToday,
  normalizeEmail,
  setProductStockQuantity,
  syncProductsWithStock,
  upsertById,
} from './utils/helpers'

const PRODUCT_CATALOG_UPDATED_EVENT = 'ims:product-catalog-updated'

const initialData = buildInitialState({
  products: [],
  customers: [],
  suppliers: [],
  users: [],
  roles: [],
  stock: [],
})

function toNumber(value) {
  const parsedValue = Number(value)
  return Number.isFinite(parsedValue) ? parsedValue : 0
}

function getSafeState(currentValue, users, roles) {
  return {
    ...initialData,
    ...(currentValue?.products ? currentValue : {}),
    users,
    roles,
  }
}

function finalizeState(nextState) {
  return {
    ...nextState,
    products: syncProductsWithStock(
      nextState.products,
      nextState.stock,
      nextState.warehouses,
    ),
  }
}

function createQuickEmail(prefix) {
  return `${prefix.toLowerCase()}@ims.local`
}

function createQuickSku(value) {
  const cleanValue = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return cleanValue || createId('SKU')
}

function buildStockFromProducts(products, warehouses, currentStock) {
  if (!products.length) {
    return currentStock
  }

  return products.map((product) => {
    const existingStock = currentStock.find(
      (item) => String(item.productId) === String(product.id),
    )
    const warehouse =
      warehouses.find((item) => String(item.id) === String(product.warehouseId)) ??
      warehouses[0] ??
      null

    return {
      id: existingStock?.id ?? `STK-${product.id}`,
      productId: product.id,
      productName: product.name,
      productImage: product.image || product.imageUrl || '',
      sku: product.sku,
      warehouseId: product.warehouseId || warehouse?.id || '',
      warehouseName: product.warehouseName || warehouse?.name || '',
      availableQty: Number(product.stock) || 0,
      reservedQty: Number(existingStock?.reservedQty) || 0,
      reorderLevel: Number(product.reorderLevel) || 0,
      lastUpdated: product.updatedAt || product.createdAt || getToday(),
    }
  })
}

function ApiDataBootstrap({ onDataLoaded }) {
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined
    }

    let isMounted = true

    async function loadApiData(event) {
      const isStockEvent = event?.type === STOCK_DATA_UPDATED_EVENT
      if (isStockEvent) {
        invalidateStockCache()
      }
      // Only fetch if explicitly triggered by update events or if caller needs sync
      const results = await Promise.allSettled([
        getProductCatalog(),
        getSuppliers(),
        getWarehouses(),
        getCustomers(),
        getStockRegister(isStockEvent ? { force: true } : undefined),
        getStockMovements(isStockEvent ? { force: true } : undefined),
        getUsers(),
        getRolesWithPermissions(),
      ])

      const getVal = (res, fallback = null) =>
        res.status === 'fulfilled' && res.value?.success ? res.value.data ?? [] : fallback

      if (!isMounted) {
        return
      }

      onDataLoaded({
        products: getVal(results[0]),
        suppliers: getVal(results[1]),
        warehouses: getVal(results[2]),
        customers: getVal(results[3]),
        stock: getVal(results[4]),
        stockMovements: getVal(results[5]),
        users: getVal(results[6], []),
        roles: getVal(results[7]),
      })
    }

    // Eagerly fetch live API data on boot so app starts with real backend database state
    loadApiData()

    window.addEventListener(PRODUCT_CATALOG_UPDATED_EVENT, loadApiData)
    window.addEventListener(STOCK_DATA_UPDATED_EVENT, loadApiData)
    window.addEventListener(ROLES_UPDATED_EVENT, loadApiData)

    return () => {
      isMounted = false
      window.removeEventListener(PRODUCT_CATALOG_UPDATED_EVENT, loadApiData)
      window.removeEventListener(STOCK_DATA_UPDATED_EVENT, loadApiData)
      window.removeEventListener(ROLES_UPDATED_EVENT, loadApiData)
    }
  }, [isAuthenticated, onDataLoaded])

  return null
}

function buildSystemNotification({
  title,
  message,
  date = getToday(),
  type = 'Info',
}) {
  return {
    id: createId('NTF'),
    title,
    type,
    message,
    source: 'System',
    date,
  }
}

function App() {
  useResponsiveTableLabels()

  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])

  const [data, setData] = useLocalStorage('ims-frontend-data', initialData)
  const appData = finalizeState(getSafeState(data, users, roles))

  function updateData(updater) {
    setData((currentValue) =>
      finalizeState(updater(getSafeState(currentValue, users, roles))),
    )
  }

  const actions = {
    saveProduct: (values, editingId = null) => {
      updateData((currentValue) => {
        const supplier =
          currentValue.suppliers.find((item) => item.id === values.supplierId) ?? null
        const warehouse =
          currentValue.warehouses.find((item) => item.id === values.warehouseId) ??
          null

        const nextProductId = editingId ?? createId('PRD')
        const nextProduct = {
          id: nextProductId,
          productId: values.productId?.trim() || nextProductId,
          name: values.name.trim(),
          sku: values.sku.trim().toUpperCase(),
          barcode: values.barcode?.trim() || '',
          description: values.description?.trim() || '',
          category: values.category.trim(),
          brand: values.brand?.trim() || '',
          supplierId: supplier?.id ?? '',
          supplierName: supplier?.name ?? '',
          price: toNumber(values.price),
          cost: toNumber(values.cost),
          stock: toNumber(values.stock),
          unit: values.unit.trim(),
          reorderLevel: toNumber(values.reorderLevel),
          variantSize: values.variantSize?.trim() || '',
          variantColor: values.variantColor?.trim() || '',
          image: values.image || '',
          warehouseId: warehouse?.id ?? '',
          warehouseName: warehouse?.name ?? '',
          status: values.status === 'inactive' || values.status === 'Inactive'
            ? 'Inactive'
            : 'Active',
          createdAt: values.createdAt || getToday(),
          updatedAt: values.updatedAt || '',
        }

        const nextProducts = upsertById(currentValue.products, nextProduct)
        const nextStock = setProductStockQuantity({
          stock: currentValue.stock,
          products: nextProducts,
          warehouses: currentValue.warehouses,
          productId: nextProduct.id,
          quantity: nextProduct.stock,
          warehouseId: nextProduct.warehouseId,
          date: getToday(),
        })

        return {
          ...currentValue,
          products: nextProducts,
          stock: nextStock,
        }
      })

      return {
        success: true,
        message: editingId ? 'Product updated successfully.' : 'Product added successfully.',
      }
    },

    quickAddProduct: (values = {}) => {
      let result = {
        success: true,
        message: 'Product added successfully.',
        item: null,
      }

      updateData((currentValue) => {
        const supplier =
          currentValue.suppliers.find((item) => item.id === values.supplierId) ??
          currentValue.suppliers[0] ??
          null
        const warehouse =
          currentValue.warehouses.find((item) => item.id === values.warehouseId) ??
          currentValue.warehouses[0] ??
          null
        const nextProduct = {
          id: createId('PRD'),
          productId: createId('PRD'),
          name: values.name.trim(),
          sku: createQuickSku(values.sku || values.name),
          barcode: values.barcode?.trim() || '',
          description: values.description?.trim() || '',
          category: values.category?.trim() || 'General',
          brand: values.brand?.trim() || 'Generic',
          supplierId: supplier?.id ?? '',
          supplierName: supplier?.name ?? '',
          price: toNumber(values.price),
          cost: toNumber(values.cost),
          stock: 0,
          unit: values.unit?.trim() || 'pcs',
          reorderLevel: 0,
          variantSize: values.variantSize?.trim() || '',
          variantColor: values.variantColor?.trim() || '',
          image: values.image || '',
          warehouseId: warehouse?.id ?? '',
          warehouseName: warehouse?.name ?? '',
          status: 'Active',
          createdAt: getToday(),
          updatedAt: '',
        }

        result.item = nextProduct

        return {
          ...currentValue,
          products: [nextProduct, ...currentValue.products],
          stock: setProductStockQuantity({
            stock: currentValue.stock,
            products: [nextProduct, ...currentValue.products],
            warehouses: currentValue.warehouses,
            productId: nextProduct.id,
            quantity: 0,
            warehouseId: nextProduct.warehouseId,
            date: getToday(),
          }),
        }
      })

      return result
    },

    deleteProduct: (productId) => {
      updateData((currentValue) => ({
        ...currentValue,
        products: currentValue.products.filter((item) => item.id !== productId),
        stock: currentValue.stock.filter((item) => item.productId !== productId),
        accountingInvoices: currentValue.accountingInvoices.filter(
          (item) => item.productId !== productId,
        ),
        barcodes: currentValue.barcodes.filter((item) => item.productId !== productId),
        returns: currentValue.returns.filter((item) => item.productId !== productId),
        inventoryAudits: currentValue.inventoryAudits.filter(
          (item) => item.productId !== productId,
        ),
      }))
    },

    saveStockMovement: (values) => {
      let result = { success: true, message: 'Stock updated successfully.' }

      updateData((currentValue) => {
        const quantityChange =
          values.type === 'out' ? -toNumber(values.quantity) : toNumber(values.quantity)

        const stockResponse = adjustStockQuantity({
          stock: currentValue.stock,
          products: currentValue.products,
          warehouses: currentValue.warehouses,
          productId: values.productId,
          quantityChange,
          warehouseId: values.warehouseId,
          date: values.date,
        })

        if (!stockResponse.success) {
          result = stockResponse
          return currentValue
        }

        const product = currentValue.products.find(
          (item) => item.id === values.productId,
        )
        const warehouse = currentValue.warehouses.find(
          (item) => item.id === values.warehouseId,
        )

        const movement = {
          id: createId('MOV'),
          productId: values.productId,
          productName: product?.name ?? '',
          productImage: product?.image || product?.imageUrl || '',
          sku: product?.sku || '',
          warehouseId: values.warehouseId,
          warehouseName: warehouse?.name ?? '',
          type: values.type,
          quantity: toNumber(values.quantity),
          date: values.date,
          notes: values.notes.trim(),
        }

        return {
          ...currentValue,
          stock: stockResponse.stock,
          stockMovements: [movement, ...currentValue.stockMovements],
        }
      })

      return result
    },

    savePurchase: (values) => {
      let result = { success: true, message: 'Purchase entry added successfully.' }

      updateData((currentValue) => {
        const product = currentValue.products.find(
          (item) => item.id === values.productId,
        )
        const supplier = currentValue.suppliers.find(
          (item) => item.id === values.supplierId,
        )
        const warehouse = currentValue.warehouses.find(
          (item) => item.id === values.warehouseId,
        )

        if (!product || !supplier || !warehouse) {
          result = {
            success: false,
            message: 'Choose a supplier, product, and warehouse.',
          }
          return currentValue
        }

        let nextStock = currentValue.stock

        const quantityToReceive =
          values.status === 'Received'
            ? toNumber(values.quantity)
            : toNumber(values.receivedQty)

        if (quantityToReceive > 0) {
          const stockResponse = adjustStockQuantity({
            stock: currentValue.stock,
            products: currentValue.products,
            warehouses: currentValue.warehouses,
            productId: values.productId,
            quantityChange: quantityToReceive,
            warehouseId: values.warehouseId,
            date: values.date,
          })

          if (!stockResponse.success) {
            result = stockResponse
            return currentValue
          }

          nextStock = stockResponse.stock
        }

        const nextPurchase = {
          id: createId('PUR'),
          supplierId: values.supplierId,
          supplierName: supplier.name,
          productId: values.productId,
          productName: product.name,
          warehouseId: values.warehouseId,
          warehouseName: warehouse.name,
          quantity: toNumber(values.quantity),
          receivedQty: quantityToReceive,
          unitCost: toNumber(values.unitCost),
          total: toNumber(values.quantity) * toNumber(values.unitCost),
          date: values.date,
          status: values.status,
          notes: values.notes.trim(),
        }

        return {
          ...currentValue,
          purchases: [nextPurchase, ...currentValue.purchases],
          stock: nextStock,
          accountingInvoices: [
            createTransactionInvoice(nextPurchase, 'Purchases'),
            ...currentValue.accountingInvoices,
          ],
          notifications: [
            buildSystemNotification({
              title: 'New purchase recorded',
              message: `${product.name} purchase added for ${supplier.name}.`,
              date: values.date,
            }),
            ...currentValue.notifications,
          ],
        }
      })

      return result
    },

    deletePurchase: (purchaseId) => {
      let result = { success: true }

      updateData((currentValue) => {
        const purchase = currentValue.purchases.find((item) => item.id === purchaseId)

        if (!purchase) {
          return currentValue
        }

        let nextStock = currentValue.stock

        const quantityToReverse =
          purchase.status === 'Received'
            ? toNumber(purchase.quantity)
            : toNumber(purchase.receivedQty)

        if (quantityToReverse > 0) {
          const stockResponse = adjustStockQuantity({
            stock: currentValue.stock,
            products: currentValue.products,
            warehouses: currentValue.warehouses,
            productId: purchase.productId,
            quantityChange: -quantityToReverse,
            warehouseId: purchase.warehouseId,
            date: getToday(),
          })

          if (!stockResponse.success) {
            result = {
              success: false,
              message:
                'This purchase cannot be removed because the received quantity has already been used.',
            }
            return currentValue
          }

          nextStock = stockResponse.stock
        }

        return {
          ...currentValue,
          purchases: currentValue.purchases.filter((item) => item.id !== purchaseId),
          stock: nextStock,
          accountingInvoices: currentValue.accountingInvoices.filter(
            (item) => item.referenceId !== purchaseId,
          ),
        }
      })

      return result
    },

    saveSale: (values) => {
      let result = { success: true, message: 'Sale entry added successfully.' }

      updateData((currentValue) => {
        const product = currentValue.products.find(
          (item) => item.id === values.productId,
        )
        const customer = currentValue.customers.find(
          (item) => item.id === values.customerId,
        )
        const warehouse = currentValue.warehouses.find(
          (item) => item.id === values.warehouseId,
        )

        if (!product || !customer || !warehouse) {
          result = {
            success: false,
            message: 'Choose a customer, product, and warehouse.',
          }
          return currentValue
        }

        const stockResponse = adjustStockQuantity({
          stock: currentValue.stock,
          products: currentValue.products,
          warehouses: currentValue.warehouses,
          productId: values.productId,
          quantityChange: -toNumber(values.quantity),
          warehouseId: values.warehouseId,
          date: values.date,
        })

        if (!stockResponse.success) {
          result = stockResponse
          return currentValue
        }

        const nextSale = {
          id: createId('SAL'),
          customerId: values.customerId,
          customerName: customer.name,
          productId: values.productId,
          productName: product.name,
          warehouseId: values.warehouseId,
          warehouseName: warehouse.name,
          quantity: toNumber(values.quantity),
          unitPrice: toNumber(values.unitPrice),
          total: toNumber(values.quantity) * toNumber(values.unitPrice),
          date: values.date,
          status: values.status,
          notes: values.notes.trim(),
        }

        return {
          ...currentValue,
          sales: [nextSale, ...currentValue.sales],
          stock: stockResponse.stock,
          accountingInvoices: [
            createTransactionInvoice(nextSale, 'Sales'),
            ...currentValue.accountingInvoices,
          ],
          notifications: [
            buildSystemNotification({
              title: 'New sale recorded',
              message: `${product.name} sold to ${customer.name}.`,
              date: values.date,
              type: 'Action',
            }),
            ...currentValue.notifications,
          ],
        }
      })

      return result
    },

    deleteSale: (saleId) => {
      updateData((currentValue) => {
        const sale = currentValue.sales.find((item) => item.id === saleId)

        if (!sale) {
          return currentValue
        }

        const stockResponse = adjustStockQuantity({
          stock: currentValue.stock,
          products: currentValue.products,
          warehouses: currentValue.warehouses,
          productId: sale.productId,
          quantityChange: toNumber(sale.quantity),
          warehouseId: sale.warehouseId,
          date: getToday(),
        })

        return {
          ...currentValue,
          sales: currentValue.sales.filter((item) => item.id !== saleId),
          stock: stockResponse.success ? stockResponse.stock : currentValue.stock,
          accountingInvoices: currentValue.accountingInvoices.filter(
            (item) => item.referenceId !== saleId,
          ),
        }
      })
    },

    saveSupplier: (values, editingId = null) => {
      updateData((currentValue) => ({
        ...currentValue,
        suppliers: upsertById(currentValue.suppliers, {
          id: editingId ?? createId('SUP'),
          name: values.name.trim(),
          contact: values.contact.trim(),
          email: values.email.trim().toLowerCase(),
          phone: values.phone.trim(),
          category: values.category.trim(),
          addressLine1: values.addressLine1?.trim() || '',
          addressLine2: values.addressLine2?.trim() || '',
          city: values.city?.trim() || '',
          state: values.state?.trim() || '',
          postalCode: values.postalCode?.trim() || '',
          paymentTerms: values.paymentTerms?.trim() || 'Net 30',
          creditDays: toNumber(values.creditDays),
          secondaryContact: values.secondaryContact?.trim() || '',
        }),
      }))
    },

    quickAddSupplier: (values = {}) => {
      const supplierId = createId('SUP')
      const nextSupplier = {
        id: supplierId,
        name: values.name.trim(),
        contact: values.contact?.trim() || values.name.trim(),
        email: normalizeEmail(values.email || createQuickEmail(supplierId)),
        phone: values.phone?.trim() || '0000000000',
        category: values.category?.trim() || 'General',
        addressLine1: values.addressLine1?.trim() || '',
        addressLine2: values.addressLine2?.trim() || '',
        city: values.city?.trim() || '',
        state: values.state?.trim() || '',
        postalCode: values.postalCode?.trim() || '',
        paymentTerms: values.paymentTerms?.trim() || 'Net 30',
        creditDays: toNumber(values.creditDays),
        secondaryContact: values.secondaryContact?.trim() || '',
      }

      updateData((currentValue) => ({
        ...currentValue,
        suppliers: [nextSupplier, ...currentValue.suppliers],
      }))

      return {
        success: true,
        message: 'Supplier added successfully.',
        item: nextSupplier,
      }
    },

    deleteSupplier: (supplierId) => {
      let result = { success: true }

      updateData((currentValue) => {
        const linkedProducts = currentValue.products.some(
          (item) => item.supplierId === supplierId,
        )

        if (linkedProducts) {
          result = {
            success: false,
            message: 'This supplier is linked to one or more products.',
          }
          return currentValue
        }

        return {
          ...currentValue,
          suppliers: currentValue.suppliers.filter((item) => item.id !== supplierId),
        }
      })

      return result
    },

    saveCustomer: (values, editingId = null) => {
      updateData((currentValue) => ({
        ...currentValue,
        customers: upsertById(currentValue.customers, {
          id: editingId ?? createId('CUS'),
          name: values.name.trim(),
          company: values.company.trim(),
          email: values.email.trim().toLowerCase(),
          phone: values.phone.trim(),
          city: values.city.trim(),
          creditLimit: toNumber(values.creditLimit),
          balance: toNumber(values.balance),
        }),
      }))
    },

    quickAddCustomer: (values = {}) => {
      const customerId = createId('CUS')
      const nextCustomer = {
        id: customerId,
        name: values.name.trim(),
        company: values.company?.trim() || values.name.trim(),
        email: normalizeEmail(values.email || createQuickEmail(customerId)),
        phone: values.phone?.trim() || '0000000000',
        city: values.city?.trim() || 'TBD',
        creditLimit: toNumber(values.creditLimit),
        balance: toNumber(values.balance),
      }

      updateData((currentValue) => ({
        ...currentValue,
        customers: [nextCustomer, ...currentValue.customers],
      }))

      return {
        success: true,
        message: 'Customer added successfully.',
        item: nextCustomer,
      }
    },

    deleteCustomer: (customerId) => {
      let result = { success: true }

      updateData((currentValue) => {
        const linkedSales = currentValue.sales.some(
          (item) => item.customerId === customerId,
        )

        if (linkedSales) {
          result = {
            success: false,
            message: 'This customer already has sales records.',
          }
          return currentValue
        }

        return {
          ...currentValue,
          customers: currentValue.customers.filter((item) => item.id !== customerId),
        }
      })

      return result
    },

    saveWarehouse: (values, editingId = null) => {
      updateData((currentValue) => ({
        ...currentValue,
        warehouses: upsertById(currentValue.warehouses, {
          id: editingId ?? createId('WH'),
          name: values.name.trim(),
          location: values.location.trim(),
          manager: values.manager.trim(),
          status: values.status?.trim() || 'Active',
          createdDate: values.createdDate || getToday(),
          rackCount: toNumber(values.rackCount),
          binCount: toNumber(values.binCount),
        }),
      }))
    },

    quickAddWarehouse: (values = {}) => {
      const nextWarehouse = {
        id: createId('WH'),
        name: values.name.trim(),
        location: values.location?.trim() || 'New Location',
        manager: values.manager?.trim() || 'Auto Assigned',
        status: values.status?.trim() || 'Active',
        createdDate: values.createdDate || getToday(),
        rackCount: toNumber(values.rackCount),
        binCount: toNumber(values.binCount),
      }

      updateData((currentValue) => ({
        ...currentValue,
        warehouses: [nextWarehouse, ...currentValue.warehouses],
      }))

      return {
        success: true,
        message: 'Warehouse added successfully.',
        item: nextWarehouse,
      }
    },

    deleteWarehouse: (warehouseId) => {
      let result = { success: true }

      updateData((currentValue) => {
        const linkedStock = currentValue.stock.some(
          (item) => item.warehouseId === warehouseId,
        )

        if (linkedStock) {
          result = {
            success: false,
            message: 'This warehouse is still linked to stock items.',
          }
          return currentValue
        }

        return {
          ...currentValue,
          warehouses: currentValue.warehouses.filter((item) => item.id !== warehouseId),
        }
      })

      return result
    },

    saveInventoryAudit: (values) => {
      let result = { success: true, message: 'Audit entry saved successfully.' }

      updateData((currentValue) => {
        const product = currentValue.products.find(
          (item) => item.id === values.productId,
        )
        const warehouse = currentValue.warehouses.find(
          (item) => item.id === values.warehouseId,
        )

        if (!product || !warehouse) {
          result = {
            success: false,
            message: 'Choose a product and warehouse for the audit.',
          }
          return currentValue
        }

        const systemQty = getStockQuantity(
          currentValue.stock,
          values.productId,
          values.warehouseId,
        )
        const actualQty = toNumber(values.actualQty)
        const difference = actualQty - systemQty
        const nextAudit = {
          id: createId('AUD'),
          warehouseId: values.warehouseId,
          warehouseName: warehouse.name,
          productId: values.productId,
          productName: product.name,
          systemQty,
          actualQty,
          difference,
          date: values.date,
          notes: values.notes.trim(),
        }

        return {
          ...currentValue,
          inventoryAudits: [nextAudit, ...currentValue.inventoryAudits],
          notifications:
            difference === 0
              ? currentValue.notifications
              : [
                  buildSystemNotification({
                    title: 'Audit variance detected',
                    message: `${product.name} has a variance of ${difference} units in ${warehouse.name}.`,
                    date: values.date,
                    type: difference < 0 ? 'Critical' : 'Action',
                  }),
                  ...currentValue.notifications,
                ],
        }
      })

      return result
    },

    saveBarcode: (values) => {
      let result = { success: true, message: 'Code generated successfully.' }

      updateData((currentValue) => {
        const product = currentValue.products.find(
          (item) => item.id === values.productId,
        )

        if (!product) {
          result = {
            success: false,
            message: 'Choose a product to generate a code.',
          }
          return currentValue
        }

        const codeValue =
          values.codeType === 'QR Code'
            ? `QR:${product.id}:${product.sku || createQuickSku(product.name)}`
            : `${product.sku || createQuickSku(product.name)}-${createId('BAR').split('-').at(-1)}`

        const nextBarcode = {
          id: createId('BAR'),
          productId: values.productId,
          productName: product.name,
          codeType: values.codeType,
          value: codeValue,
          preview:
            values.codeType === 'QR Code'
              ? `[ QR ] ${product.name}`
              : `|||| ${product.sku || createQuickSku(product.name)} ||||`,
          date: values.date,
        }

        result = {
          success: true,
          message: `${values.codeType} generated successfully.`,
        }

        return {
          ...currentValue,
          barcodes: [nextBarcode, ...currentValue.barcodes],
        }
      })

      return result
    },

    saveNotification: (values) => {
      updateData((currentValue) => ({
        ...currentValue,
        notifications: [
          {
            id: createId('NTF'),
            title: values.title.trim(),
            type: values.type,
            message: values.message.trim(),
            source: 'Manual',
            date: values.date,
          },
          ...currentValue.notifications,
        ],
      }))

      return {
        success: true,
        message: 'Alert added successfully.',
      }
    },

    saveInvoice: (values) => {
      let result = { success: true, message: 'Invoice created successfully.' }

      updateData((currentValue) => {
        const isSalesInvoice = values.invoiceType === 'Sales'
        const party = isSalesInvoice
          ? currentValue.customers.find((item) => item.id === values.partyId)
          : currentValue.suppliers.find((item) => item.id === values.partyId)
        const product = currentValue.products.find(
          (item) => item.id === values.productId,
        )
        const warehouse = currentValue.warehouses.find(
          (item) => item.id === values.warehouseId,
        )

        if (!party || !product || !warehouse) {
          result = {
            success: false,
            message: 'Choose a party, product, and warehouse to create the invoice.',
          }
          return currentValue
        }

        const nextInvoice = buildInvoiceEntry({
          invoiceType: values.invoiceType,
          partyId: values.partyId,
          partyName: party.name,
          productId: values.productId,
          productName: product.name,
          warehouseId: values.warehouseId,
          warehouseName: warehouse.name,
          quantity: values.quantity,
          amount: values.amount,
          date: values.date,
          status: 'Draft',
        })

        return {
          ...currentValue,
          accountingInvoices: [nextInvoice, ...currentValue.accountingInvoices],
        }
      })

      return result
    },

    saveReturn: (values) => {
      let result = { success: true, message: 'Entry saved successfully.' }

      updateData((currentValue) => {
        const product = currentValue.products.find(
          (item) => item.id === values.productId,
        )
        const warehouse = currentValue.warehouses.find(
          (item) => item.id === values.warehouseId,
        )

        if (!product || !warehouse) {
          result = {
            success: false,
            message: 'Choose a product and warehouse to continue.',
          }
          return currentValue
        }

        const quantityChange =
          values.entryType === 'Return'
            ? toNumber(values.quantity)
            : -toNumber(values.quantity)

        const stockResponse = adjustStockQuantity({
          stock: currentValue.stock,
          products: currentValue.products,
          warehouses: currentValue.warehouses,
          productId: values.productId,
          quantityChange,
          warehouseId: values.warehouseId,
          date: values.date,
        })

        if (!stockResponse.success) {
          result = stockResponse
          return currentValue
        }

        const nextReturn = {
          id: createId('RTN'),
          entryType: values.entryType,
          productId: values.productId,
          productName: product.name,
          warehouseId: values.warehouseId,
          warehouseName: warehouse.name,
          quantity: toNumber(values.quantity),
          date: values.date,
          reason: values.reason.trim(),
        }

        return {
          ...currentValue,
          stock: stockResponse.stock,
          returns: [nextReturn, ...currentValue.returns],
          notifications: [
            buildSystemNotification({
              title:
                values.entryType === 'Damage'
                  ? 'Damage recorded'
                  : 'Return processed',
              message: `${product.name} ${values.entryType.toLowerCase()} entry was added in ${warehouse.name}.`,
              date: values.date,
              type: values.entryType === 'Damage' ? 'Critical' : 'Action',
            }),
            ...currentValue.notifications,
          ],
        }
      })

      return result
    },

    savePurchaseReturn: (values) => {
      let result = { success: true, message: 'Purchase return created successfully.' }

      updateData((currentValue) => {
        const supplier = currentValue.suppliers?.find(
          (item) => String(item.id) === String(values.supplierId || values.supplier_id),
        )
        const existingReturns = currentValue.purchaseReturns || []
        let returnId = values.id || values.returnId
        if (!returnId) {
          const maxNum = existingReturns.reduce((max, r) => {
            const match = String(r.id || r.returnId || '').match(/\d+/)
            const num = match ? parseInt(match[0], 10) : 0
            return Math.max(max, num)
          }, 1000)
          returnId = `PRR-${maxNum + 1}`
        }

        const nextPurchaseReturn = {
          id: returnId,
          returnId,
          supplierId: values.supplierId || values.supplier_id,
          supplierName: supplier?.name || values.supplierName || 'Supplier',
          grnId: values.grnId || values.grn_id,
          grnNumber: values.grnNumber || (values.grnId ? `GRN-${values.grnId}` : '-'),
          returnDate: values.returnDate || values.return_date || getToday(),
          totalAmount: Number(values.totalAmount || values.total_amount || 0),
          reason: values.reason || '',
          items: values.items || [],
          createdAt: getToday(),
        }

        return {
          ...currentValue,
          purchaseReturns: [nextPurchaseReturn, ...existingReturns.filter((r) => String(r.id) !== String(returnId))],
        }
      })

      return result
    },

    deletePurchaseReturn: (returnId) => {
      let result = { success: true, message: 'Purchase return deleted.' }
      updateData((currentValue) => ({
        ...currentValue,
        purchaseReturns: (currentValue.purchaseReturns || []).filter(
          (item) => String(item.id) !== String(returnId) && String(item.returnId) !== String(returnId),
        ),
      }))
      return result
    },

    saveSalesReturn: (values) => {
      let result = { success: true, message: 'Sales return created successfully.' }

      updateData((currentValue) => {
        const customer = currentValue.customers?.find(
          (item) => String(item.id) === String(values.customerId || values.customer_id),
        )
        const existingReturns = currentValue.salesReturns || []
        let returnId = values.id || values.returnId
        if (!returnId) {
          const maxNum = existingReturns.reduce((max, r) => {
            const match = String(r.id || r.returnId || '').match(/\d+/)
            const num = match ? parseInt(match[0], 10) : 0
            return Math.max(max, num)
          }, 1000)
          returnId = `SRR-${maxNum + 1}`
        }

        const nextSalesReturn = {
          id: returnId,
          returnId,
          customerId: values.customerId || values.customer_id,
          customerName: customer?.name || values.customerName || 'Customer',
          invoiceId: values.invoiceId || values.invoice_id,
          invoiceNumber: values.invoiceNumber || (values.invoiceId ? `SINV-${values.invoiceId}` : '-'),
          returnDate: values.returnDate || values.return_date || getToday(),
          totalAmount: Number(values.totalAmount || values.total_amount || 0),
          reason: values.reason || '',
          items: values.items || [],
          createdAt: getToday(),
        }

        return {
          ...currentValue,
          salesReturns: [nextSalesReturn, ...existingReturns.filter((r) => String(r.id) !== String(returnId))],
        }
      })

      return result
    },

    deleteSalesReturn: (returnId) => {
      let result = { success: true, message: 'Sales return deleted.' }
      updateData((currentValue) => ({
        ...currentValue,
        salesReturns: (currentValue.salesReturns || []).filter(
          (item) => String(item.id) !== String(returnId) && String(item.returnId) !== String(returnId),
        ),
      }))
      return result
    },

    saveUser: (values, editingId = null) => {
      let result = { success: true, message: 'User saved successfully.' }

      updateData((currentValue) => {
        const emailExists = currentValue.users.some(
          (item) =>
            item.email.toLowerCase() === values.email.trim().toLowerCase() &&
            item.id !== editingId,
        )

        if (emailExists) {
          result = {
            success: false,
            message: 'This email is already assigned to another user.',
          }
          return currentValue
        }

        const currentUser = currentValue.users.find((item) => item.id === editingId)
        const passwordError = getPasswordError(values.password, {
          required: !editingId,
        })

        if (passwordError) {
          result = {
            success: false,
            message: passwordError,
          }
          return currentValue
        }

        const nextUsers = upsertById(currentValue.users, {
          id: editingId ?? createId('USR'),
          name: values.name.trim(),
          email: normalizeEmail(values.email),
          password: values.password || currentUser?.password || 'Admin123',
          role: values.role,
        })

        setUsers(nextUsers)

        return {
          ...currentValue,
          users: nextUsers,
        }
      })

      return result
    },

    deleteUser: (userId) => {
      let result = { success: true }

      updateData((currentValue) => {
        const user = currentValue.users.find((item) => item.id === userId)
        const adminCount = currentValue.users.filter(
          (item) => item.role === 'Admin',
        ).length

        if (user?.role === 'Admin' && adminCount === 1) {
          result = {
            success: false,
            message: 'At least one admin user must remain in the system.',
          }
          return currentValue
        }

        const nextUsers = currentValue.users.filter((item) => item.id !== userId)
        setUsers(nextUsers)

        return {
          ...currentValue,
          users: nextUsers,
        }
      })

      return result
    },

  }

  const handleApiDataLoaded = useCallback((payload) => {
    const nextUsers = Array.isArray(payload.users) ? payload.users : []
    const nextRoles = Array.isArray(payload.roles) ? payload.roles : []

    setUsers(nextUsers)
    setRoles(nextRoles)

    setData((currentValue) => {
      const safeValue = getSafeState(currentValue, nextUsers, nextRoles)
      const nextSuppliers = Array.isArray(payload.suppliers)
        ? payload.suppliers
        : safeValue.suppliers
      const nextWarehouses = Array.isArray(payload.warehouses)
        ? payload.warehouses
        : safeValue.warehouses
      const nextCustomers = Array.isArray(payload.customers)
        ? payload.customers
        : safeValue.customers
      const nextProducts = Array.isArray(payload.products)
        ? payload.products.map((product) =>
            normalizeProduct(product, {
              suppliers: nextSuppliers,
              warehouses: nextWarehouses,
            }),
          )
        : safeValue.products
      const nextStock = Array.isArray(payload.stock)
        ? payload.stock
        : Array.isArray(payload.products)
          ? buildStockFromProducts(nextProducts, nextWarehouses, safeValue.stock)
          : safeValue.stock
      const nextStockMovements = Array.isArray(payload.stockMovements)
        ? payload.stockMovements
        : safeValue.stockMovements

      return finalizeState({
        ...safeValue,
        products: nextProducts,
        customers: nextCustomers,
        suppliers: nextSuppliers,
        warehouses: nextWarehouses,
        users: nextUsers,
        roles: nextRoles,
        stock: nextStock,
        stockMovements: nextStockMovements,
      })
    })
  }, [setData])

  return (
    <AuthProvider roles={roles}>
      <ApiDataBootstrap onDataLoaded={handleApiDataLoaded} />
      <BrowserRouter unstable_useTransitions={false}>
        <AppRoutes data={appData} actions={actions} />
        <AppNetworkStatus />
        <ToastViewport />
        <ThemeToggle floating />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
