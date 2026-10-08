import {
  Bell,
  Boxes,
  ClipboardList,
  FileClock,
  FileText,
  GitBranch,
  History,
  Layers3,
  PackageCheck,
  PackageSearch,
  ReceiptText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  Users,
} from 'lucide-react'
import { API_ENDPOINTS } from '../../../api/endpoints'
import { getToday } from '../../../utils/helpers'
import { getGoodsReceiptNumber } from './goodsReceiptHelpers'

function getPurchaseOrderQuantity(item) {
  if (!item) return 0
  const qtyKeys = ['quantity', 'Quantity', 'qty', 'Qty', 'orderedQuantity', 'OrderedQuantity', 'poQuantity', 'PoQuantity', 'poQty', 'PoQty']
  for (const key of qtyKeys) {
    const val = item[key]
    if (val !== undefined && val !== null && val !== '') {
      const num = Number(val)
      if (Number.isFinite(num) && num > 0) {
        return num
      }
    }
  }
  const items = item.lineItems || item.items || item.products || item.orderItems || item.lines || []
  if (Array.isArray(items) && items.length > 0) {
    const pId = item.productId || item.ProductId
    const vId = item.variantId || item.VariantId
    let matchedItem = null
    if (pId || vId) {
      matchedItem = items.find(line => {
        const linePId = line.productId || line.ProductId
        const lineVId = line.variantId || line.VariantId
        if (pId && linePId && String(pId) === String(linePId)) {
          if (vId && lineVId) {
            return String(vId) === String(lineVId)
          }
          return true
        }
        return false
      })
    }
    if (!matchedItem && items.length === 1) {
      matchedItem = items[0]
    }
    if (matchedItem) {
      for (const key of qtyKeys) {
        const val = matchedItem[key]
        if (val !== undefined && val !== null && val !== '') {
          const num = Number(val)
          if (Number.isFinite(num) && num > 0) {
            return num
          }
        }
      }
    }
    return items.reduce((sum, line) => {
      let qty = 0
      for (const key of qtyKeys) {
        const val = line[key]
        if (val !== undefined && val !== null && val !== '') {
          const num = Number(val)
          if (Number.isFinite(num)) {
            qty = num
            break
          }
        }
      }
      return sum + qty
    }, 0)
  }
  return 0
}

function getPOId(item) {
  return item.poId || item.PoId || item.id || item.Id || ''
}

const activeStatusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const documentStatusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'posted', label: 'Posted' },
  { value: 'cancelled', label: 'Cancelled' },
]

const stockAuditStatusOptions = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Posted', label: 'Posted' },
  { value: 'Cancelled', label: 'Cancelled' },
]

const notificationTypes = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
  { value: 'success', label: 'Success' },
]

const readOnlyTimestamps = [
  { key: 'createdAt', label: 'Created Date', format: 'date' },
  { key: 'updatedAt', label: 'Updated', format: 'date' },
]

const stockIdentityFields = [
  { name: 'productId', label: 'Product ID', type: 'number', required: true, min: 1 },
  { name: 'variantId', label: 'Variant ID', type: 'number', min: 1 },
  { name: 'warehouseId', label: 'Warehouse ID', type: 'number', required: true, min: 1 },
]

const stockQuantityColumns = [
  { key: 'productName', label: 'Product Name', sortable: true },
  { key: 'warehouseName', label: 'Warehouse Name', sortable: true },
  { key: 'variantName', label: 'Variant Name', sortable: true },
]

export const RESOURCE_CONFIGS = {
  subCategories: {
    key: 'subCategories',
    permissionKey: 'subCategories',
    title: 'SubCategories',
    subtitle: 'Maintain second-level catalog groups linked to parent categories.',
    entityName: 'SubCategory',
    icon: Layers3,
    endpoint: API_ENDPOINTS.subCategories.list,
    byId: API_ENDPOINTS.subCategories.byId,
    idFields: ['subCategoryId'],
    referenceEndpoints: {
      categories: API_ENDPOINTS.categories.main,
    },
    referenceListKeys: {
      categories: 'categories',
    },
    fields: [
      {
        name: 'categoryId',
        label: 'Category *',
        type: 'searchableSelect',
        valueType: 'number',
        required: true,
        min: 1,
        optionsFrom: 'categories',
        optionValue: ['categoryId', 'id'],
        optionLabel: ['name', 'categoryName', 'title'],
        placeholder: 'Select category',
        searchPlaceholder: 'Search categories',
      },
      { name: 'status', label: 'Status', type: 'select', options: activeStatusOptions, defaultValue: 'active' },
      { name: 'name', label: 'SubCategory Name', required: true, minLength: 2 },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        placeholder: 'Optional operational notes',
        helperText: 'Optional internal operational note',
      },
    ],
    columns: [
      { key: 'name', label: 'SubCategory', sortable: true },
      { key: 'categoryName', label: 'Category', sortable: true },
      { key: 'status', label: 'Status', format: 'status', sortable: true },
      { key: 'createdAt', label: 'Created Date', format: 'date', sortable: true },
    ],
  },
  productAttributes: {
    key: 'productAttributes',
    permissionKey: 'productAttributes',
    title: 'Product Attributes',
    subtitle: 'Define reusable variant dimensions such as size, color, material, or batch.',
    entityName: 'Attribute',
    icon: SlidersHorizontal,
    endpoint: API_ENDPOINTS.productAttributes.list,
    byId: API_ENDPOINTS.productAttributes.byId,
    idFields: ['attributeId'],
    fields: [
      { name: 'name', label: 'Attribute', required: true, minLength: 2, placeholder: 'e.g. size, color, material' },
    ],
    columns: [
      { key: 'attributeId', label: 'ID', sortable: true },
      { key: 'name', label: 'Attribute', sortable: true },
    ],
  },
  productVariants: {
    key: 'productVariants',
    permissionKey: 'productVariants',
    title: 'Product Variants',
    subtitle: 'Create and maintain sellable product variants with SKU and price deltas.',
    entityName: 'Variant',
    icon: GitBranch,
    endpoint: API_ENDPOINTS.productVariants.list,
    byId: API_ENDPOINTS.productVariants.byId,
    createEndpoint: (payload) => API_ENDPOINTS.productVariants.byProduct(payload.productId),
    omitCreateFields: ['productId'],
    idFields: ['variantId', 'productVariantId'],
    fields: [
      { name: 'productId', label: 'Product ID', type: 'number', required: true, min: 1, createOnly: true },
      { name: 'variantName', label: 'Variant Name', required: true, minLength: 2 },
      { name: 'sku', label: 'SKU', required: true, minLength: 2, apiKey: 'SKU' },
      { name: 'priceDelta', label: 'Price Delta', type: 'currency', defaultValue: '0', createOnly: true },
      { name: 'stockDelta', label: 'Stock Delta', type: 'number', defaultValue: '0', createOnly: true },
      { name: 'price', label: 'Price', type: 'currency', editOnly: true },
      { name: 'costPrice', label: 'Cost Price', type: 'currency', editOnly: true },
    ],
    columns: [
      { key: 'variantId', label: 'Variant ID', sortable: true },
      { key: 'productId', label: 'Product ID', sortable: true },
      { key: 'variantName', label: 'Variant', sortable: true },
      { key: 'sku', label: 'SKU', sortable: true },
      { key: 'price', label: 'Price', format: 'currency', sortable: true },
      { key: 'costPrice', label: 'Cost', format: 'currency', sortable: true },
    ],
  },
  variantAttributes: {
    key: 'variantAttributes',
    permissionKey: 'productVariants',
    title: 'Variant Attribute Values',
    subtitle: 'Attach attribute values to variants for detailed variant composition.',
    entityName: 'Variant Attribute',
    icon: SlidersHorizontal,
    endpoint: API_ENDPOINTS.variantAttributes.list,
    byId: API_ENDPOINTS.variantAttributes.byId,
    createQuery: (payload) => ({ variantId: payload.variantId }),
    omitCreateFields: ['variantId'],
    canUpdate: false,
    idFields: ['id'],
    fields: [
      { name: 'variantId', label: 'Variant ID', type: 'number', required: true, min: 1 },
      { name: 'attributeId', label: 'Attribute ID', type: 'number', required: true, min: 1 },
      { name: 'valueId', label: 'Value ID', type: 'number', required: true, min: 1 },
    ],
    columns: [
      { key: 'variantId', label: 'Variant ID', sortable: true },
      { key: 'attributeId', label: 'Attribute ID', sortable: true },
      { key: 'valueId', label: 'Value ID', sortable: true },
    ],
  },
  goodsReceipts: {
    key: 'goodsReceipts',
    permissionKey: 'goodsReceipts',
    title: 'Goods Receipts',
    subtitle: 'Receive purchase order quantities into warehouse stock with audit-ready records.',
    entityName: 'Goods Receipt',
    icon: PackageCheck,
    endpoint: API_ENDPOINTS.goodsReceipts.list,
    byId: API_ENDPOINTS.goodsReceipts.byId,
    canUpdate: false,
    idFields: ['grnId', 'grId', 'receiptId', 'goodsReceiptId'],
    referenceEndpoints: {
      purchaseOrders: API_ENDPOINTS.purchaseOrders.list,
      productVariants: API_ENDPOINTS.productVariants.list,
      warehouses: API_ENDPOINTS.warehouses.list,
    },
    fields: [
      {
        name: 'poId',
        label: 'Purchase Order',
        type: 'select',
        required: true,
        optionsFrom: 'purchaseOrders',
        optionValue: ['poId', 'PoId', 'id', 'Id'],
        optionLabel: (item) => {
          const id = item.poId || item.PoId || item.id || item.Id || ''
          const num = item.poNumber || item.PoNumber || item.orderNumber || item.OrderNumber || `PO-${id}`
          const supplier = item.supplierName || item.SupplierName || item.supplier || item.Supplier || 'Supplier'
          const product = item.productName || item.ProductName || item.product || item.Product || ''
          return product ? `${num} - ${supplier} - ${product}` : `${num} - ${supplier}`
        },
        optionFilter: (item) => {
          const poId = getPOId(item)
          if (!poId) return false
          const status = String(
            item.status || item.Status || item.orderStatus || item.OrderStatus || ''
          ).toLowerCase().replace(/[_\s-]+/g, '')
          return !(status === 'cancelled' || status === 'canceled' || status === 'rejected')
        },
      },
      { name: 'supplierId', label: 'Supplier ID', type: 'hidden', valueType: 'number', required: true, min: 1 },
      { name: 'supplierName', label: 'Supplier', submit: false, readOnly: true },
      {
        name: 'warehouseId',
        label: 'Warehouse',
        type: 'select',
        valueType: 'number',
        required: true,
        min: 1,
        optionsFrom: 'warehouses',
        optionValue: ['warehouseId', 'id', 'Id', 'warehouseID'],
        optionLabel: ['name', 'Name', 'warehouseName', 'WarehouseName', 'warehouse'],
      },
      { name: 'productId', label: 'Product ID', type: 'hidden', valueType: 'number', required: true, min: 1 },
      { name: 'productName', label: 'Product', submit: false, readOnly: true },
      { name: 'variantId', label: 'Variant ID', type: 'hidden', valueType: 'number', min: 1 },
      { name: 'variantName', label: 'Variant', submit: false, readOnly: true },
      {
        name: 'quantityReceived',
        label: 'Quantity Received',
        type: 'number',
        required: true,
        min: 0.01,
        minMessage: 'Quantity Received must be greater than 0.',
        maxFrom: 'goodsReceiptRemainingQuantity',
        maxMessage: 'Quantity Received cannot exceed remaining PO quantity.',
      },
      { name: 'price', label: 'Unit Price', type: 'currency', required: true, min: 0, readOnly: false },
      { name: 'receiptDate', label: 'Receipt Date', type: 'date', required: true, defaultValue: getToday },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    columns: [
      {
        key: 'grnNumber',
        label: 'Receipt Number',
        sortable: false,
        render: (row) => getGoodsReceiptNumber(row),
        searchValue: (row) => getGoodsReceiptNumber(row),
        sortValue: (row) => getGoodsReceiptNumber(row),
      },
      { key: 'poNumber', label: 'PO Number', sortable: false },
      { key: 'supplierName', label: 'Supplier Name', sortable: false },
      { key: 'productName', label: 'Items', sortable: false },
      { key: 'quantityReceived', label: 'Received', sortable: false },
      { key: 'totalAmount', label: 'Price', format: 'currency', sortable: false },
      { key: 'receiptDate', label: 'Date', format: 'date', sortable: false },
    ],
  },
  stock: {
    key: 'stock',
    permissionKey: 'stock',
    title: 'Stock Register',
    subtitle: 'Live stock by product, variant, warehouse, available quantity, and reservations.',
    entityName: 'Stock',
    icon: Boxes,
    endpoint: API_ENDPOINTS.stock.list,
    byId: API_ENDPOINTS.stock.byId,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    statuslessRowsAreActive: true,
    idFields: ['stockId'],
    fields: [
      ...stockIdentityFields,
      { name: 'quantity', label: 'Quantity', type: 'number', required: true, min: 0 },
      { name: 'reservedQuantity', label: 'Reserved Quantity', type: 'number', defaultValue: '0', min: 0 },
    ],
    columns: [
      ...stockQuantityColumns,
      { key: 'quantity', label: 'On Hand', sortable: true },
      { key: 'availableQuantity', label: 'Available', sortable: true },
    ],
  },
  stockMovements: {
    key: 'stockMovements',
    permissionKey: 'stockMovements',
    title: 'Stock Movements',
    subtitle: 'Track stock ins, outs, sales, receipts, and manual inventory movement history.',
    entityName: 'Stock Movement',
    icon: PackageSearch,
    endpoint: API_ENDPOINTS.stockMovements.list,
    byId: API_ENDPOINTS.stockMovements.byId,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    statuslessRowsAreActive: true,
    idFields: ['movementId'],
    fields: [
      ...stockIdentityFields,
      {
        name: 'movementType',
        label: 'Movement Type',
        type: 'select',
        required: true,
        defaultValue: 'IN',
        options: [
          { value: 'IN', label: 'Stock In' },
          { value: 'OUT', label: 'Stock Out' },
          { value: 'SALE', label: 'Sale' },
          { value: 'PURCHASE', label: 'Purchase' },
          { value: 'ADJUSTMENT', label: 'Adjustment' },
          { value: 'TRANSFER', label: 'Transfer' },
          { value: 'OPENING', label: 'Opening Stock' },
        ],
      },
      { name: 'quantity', label: 'Quantity', type: 'number', required: true, min: 0.01 },
      { name: 'referenceId', label: 'Reference ID', type: 'number', min: 1 },
      { name: 'referenceType', label: 'Reference Type' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    columns: [
      ...stockQuantityColumns,
      { key: 'movementTypeLabel', label: 'Movement Type', format: 'status', sortable: true },
      { key: 'quantity', label: 'Quantity', sortable: true },
      { key: 'referenceDisplay', label: 'Reference', sortable: true },
      { key: 'createdAt', label: 'Created Date', format: 'date', sortable: true },
    ],
  },
  stockLedger: {
    key: 'stockLedger',
    permissionKey: 'stockLedger',
    title: 'Stock Ledger',
    subtitle: 'Audit the opening, change, and closing stock quantities for every transaction.',
    entityName: 'Ledger Entry',
    icon: History,
    endpoint: API_ENDPOINTS.stockLedger.list,
    byId: API_ENDPOINTS.stockLedger.byId,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    statuslessRowsAreActive: true,
    idFields: ['ledgerId'],
    fields: [
      ...stockIdentityFields,
      { name: 'openingQty', label: 'Opening Qty', type: 'number', required: true, min: 0 },
      { name: 'changeQty', label: 'Change Qty', type: 'number', required: true },
      { name: 'closingQty', label: 'Closing Qty', type: 'number', required: true, min: 0 },
      { name: 'transactionType', label: 'Transaction Type', required: true },
      { name: 'transactionId', label: 'Transaction ID', type: 'number', min: 1 },
    ],
    columns: [
      ...stockQuantityColumns,
      { key: 'openingQty', label: 'Opening', sortable: true },
      { key: 'changeQty', label: 'Change', sortable: true },
      { key: 'closingQty', label: 'Closing', sortable: true },
      { key: 'transactionDisplay', label: 'Transaction', sortable: true },
    ],
  },
  stockAdjustments: {
    key: 'stockAdjustments',
    permissionKey: 'stockAdjustments',
    title: 'Stock Adjustments',
    subtitle: 'Record controlled inventory corrections with reason and warehouse context.',
    entityName: 'Stock Adjustment',
    icon: ClipboardList,
    endpoint: API_ENDPOINTS.stockAdjustments.list,
    byId: API_ENDPOINTS.stockAdjustments.byId,
    idFields: ['adjustmentId'],
    referenceEndpoints: {
      warehouses: API_ENDPOINTS.warehouses.list,
    },
    referenceListKeys: {
      warehouses: 'warehouses',
    },
    fields: [
      {
        name: 'warehouseId',
        label: 'Warehouse *',
        type: 'searchableSelect',
        valueType: 'number',
        required: true,
        min: 1,
        optionsFrom: 'warehouses',
        optionValue: ['warehouseId', 'id'],
        optionLabel: ['name', 'warehouseName', 'title'],
        placeholder: 'Select warehouse',
        searchPlaceholder: 'Search warehouses',
      },
      {
        name: 'adjustmentType',
        label: 'Adjustment Type *',
        type: 'select',
        required: true,
        defaultValue: 'increase',
        options: [
          { value: 'increase', label: 'Increase' },
          { value: 'decrease', label: 'Decrease' },
          { value: 'recount', label: 'Recount' },
        ],
      },
      { name: 'reason', label: 'Reason *', type: 'textarea', required: true, minLength: 3 },
    ],
    columns: [
      {
        key: 'adjustmentId',
        label: 'Adjustment No.',
        sortable: true,
        render: (row) => {
          const id = row.adjustmentId;
          if (id === undefined || id === null || id === '') return '';
          return `SA-${String(id).padStart(6, '0')}`;
        }
      },
      {
        key: 'warehouseId',
        label: 'Warehouse',
        sortable: true,
        render: (row, referenceData) => {
          const id = row.warehouseId;
          const warehouses = referenceData?.warehouses ?? [];
          const warehouse = warehouses.find(w => String(w.id ?? w.warehouseId) === String(id));
          return warehouse ? warehouse.name : (row.warehouseName || `Warehouse ${id}`);
        }
      },
      { key: 'adjustmentType', label: 'Adjustment Type', format: 'status', sortable: true },
      { key: 'reason', label: 'Reason', sortable: true },
      { key: 'createdAt', label: 'Created On', format: 'date', sortable: true },
    ],
  },
  stockAdjustmentItems: {
    key: 'stockAdjustmentItems',
    permissionKey: 'stockAdjustments',
    title: 'Stock Adjustment Items',
    subtitle: 'Maintain item-level quantities attached to adjustment documents.',
    entityName: 'Adjustment Item',
    icon: ClipboardList,
    endpoint: API_ENDPOINTS.stockAdjustmentItems.list,
    byId: API_ENDPOINTS.stockAdjustmentItems.byId,
    idFields: ['adjustmentItemId', 'id'],
    referenceEndpoints: {
      stockAdjustments: API_ENDPOINTS.stockAdjustments.list,
      products: API_ENDPOINTS.products.list,
      productVariants: API_ENDPOINTS.productVariants.list,
    },
    referenceListKeys: {
      stockAdjustments: 'stockAdjustments',
      products: 'products',
      productVariants: 'productVariants',
    },
    fields: [
      {
        name: 'adjustmentId',
        label: 'Adjustment No. *',
        type: 'searchableSelect',
        valueType: 'number',
        required: true,
        min: 1,
        optionsFrom: 'stockAdjustments',
        optionValue: ['adjustmentId', 'id'],
        optionLabel: (item) => {
          const id = item.adjustmentId ?? item.id;
          if (id === undefined || id === null || id === '') return '';
          return `SA-${String(id).padStart(6, '0')}`;
        },
        placeholder: 'Select adjustment',
        searchPlaceholder: 'Search adjustments',
      },
      {
        name: 'productId',
        label: 'Product *',
        type: 'searchableSelect',
        valueType: 'number',
        required: true,
        min: 1,
        optionsFrom: 'products',
        optionValue: ['productId', 'id'],
        optionLabel: ['name', 'productName', 'title'],
        placeholder: 'Select product',
        searchPlaceholder: 'Search products',
      },
      {
        name: 'variantId',
        label: 'Variant',
        type: 'searchableSelect',
        valueType: 'number',
        optionsFrom: 'productVariants',
        optionValue: ['variantId', 'id'],
        optionLabel: (item) => item.variantName ? `${item.variantName} (${item.sku || ''})` : item.sku || 'Default',
        placeholder: 'Select variant',
        searchPlaceholder: 'Search variants',
      },
      { name: 'quantity', label: 'Quantity *', type: 'number', required: true, min: 0.01 },
    ],
    columns: [
      {
        key: 'adjustmentId',
        label: 'Adjustment No.',
        sortable: true,
        render: (row) => {
          const id = row.adjustmentId;
          if (id === undefined || id === null || id === '') return '';
          return `SA-${String(id).padStart(6, '0')}`;
        }
      },
      {
        key: 'productId',
        label: 'Product',
        sortable: true,
        render: (row, referenceData) => {
          const productId = row.productId;
          const products = referenceData?.products ?? [];
          const product = products.find(p => String(p.productId ?? p.id) === String(productId));
          return product ? product.name : (row.productName || `Product ${productId}`);
        }
      },
      {
        key: 'variantId',
        label: 'Variant',
        sortable: true,
        render: (row, referenceData) => {
          const variantId = row.variantId;
          if (!variantId) return '';
          const variants = referenceData?.productVariants ?? [];
          const variant = variants.find(v => String(v.variantId ?? v.id) === String(variantId));
          if (!variant) return `Variant ${variantId}`;
          return variant.variantName || 'Default';
        }
      },
      { key: 'quantity', label: 'Quantity', sortable: true },
    ],
  },
  stockTransfers: {
    key: 'stockTransfers',
    permissionKey: 'stockTransfers',
    title: 'Stock Transfers',
    subtitle: 'Move inventory between warehouses with status tracking.',
    entityName: 'Stock Transfer',
    icon: Truck,
    endpoint: API_ENDPOINTS.stockTransfers.list,
    byId: API_ENDPOINTS.stockTransfers.byId,
    idFields: ['transferId'],
    referenceEndpoints: {
      warehouses: API_ENDPOINTS.warehouses.list,
      products: API_ENDPOINTS.products.list,
    },
    referenceListKeys: {
      warehouses: 'warehouses',
      products: 'products',
    },
    fields: [
      {
        name: 'fromWarehouseId',
        label: 'From Warehouse *',
        type: 'searchableSelect',
        valueType: 'number',
        required: true,
        min: 1,
        optionsFrom: 'warehouses',
        optionValue: ['fromWarehouseId', 'id', 'warehouseId'],
        optionLabel: ['name', 'warehouseName', 'title'],
        placeholder: 'Select warehouse',
        searchPlaceholder: 'Search warehouses',
      },
      {
        name: 'toWarehouseId',
        label: 'To Warehouse *',
        type: 'searchableSelect',
        valueType: 'number',
        required: true,
        min: 1,
        optionsFrom: 'warehouses',
        optionValue: ['toWarehouseId', 'id', 'warehouseId'],
        optionLabel: ['name', 'warehouseName', 'title'],
        placeholder: 'Select warehouse',
        searchPlaceholder: 'Search warehouses',
      },
      {
        name: 'productId',
        label: 'Product *',
        type: 'searchableSelect',
        valueType: 'number',
        required: true,
        min: 1,
        optionsFrom: 'products',
        optionValue: ['productId', 'id'],
        optionLabel: ['name', 'productName', 'title'],
        placeholder: 'Select product',
        searchPlaceholder: 'Search products',
      },
      {
        name: 'quantity',
        label: 'Quantity *',
        type: 'number',
        required: true,
        min: 1,
        defaultValue: 1,
        placeholder: 'Enter quantity',
      },
      { name: 'transferDate', label: 'Transfer Date *', type: 'date', required: true, defaultValue: getToday },
      { name: 'status', label: 'Status *', type: 'select', options: documentStatusOptions, defaultValue: 'pending' },
    ],
    columns: [
      {
        key: 'transferId',
        label: 'Transfer No.',
        sortable: true,
        render: (row) => {
          const id = row.transferId;
          if (id === undefined || id === null || id === '') return '';
          return `TR-${String(id).padStart(6, '0')}`;
        }
      },
      {
        key: 'fromWarehouseId',
        label: 'From Warehouse',
        sortable: true,
        render: (row, referenceData) => {
          const id = row.fromWarehouseId ?? row.fromWarehouse?.id ?? row.sourceWarehouseId;
          const warehouses = referenceData?.warehouses ?? [];
          const warehouse = warehouses.find(w => String(w.id ?? w.warehouseId) === String(id));
          return warehouse ? warehouse.name : (row.fromWarehouseName || row.fromWarehouse?.name || `Warehouse ${id}`);
        }
      },
      {
        key: 'toWarehouseId',
        label: 'To Warehouse',
        sortable: true,
        render: (row, referenceData) => {
          const id = row.toWarehouseId ?? row.toWarehouse?.id ?? row.destinationWarehouseId;
          const warehouses = referenceData?.warehouses ?? [];
          const warehouse = warehouses.find(w => String(w.id ?? w.warehouseId) === String(id));
          return warehouse ? warehouse.name : (row.toWarehouseName || row.toWarehouse?.name || `Warehouse ${id}`);
        }
      },
      { key: 'transferDate', label: 'Transfer Date', format: 'date', sortable: true },
      { key: 'status', label: 'Status', format: 'status', sortable: true },
    ],
  },
  stockTransferItems: {
    key: 'stockTransferItems',
    permissionKey: 'stockTransfers',
    title: 'Stock Transfer Items',
    subtitle: 'Maintain product quantities attached to transfer documents.',
    entityName: 'Transfer Item',
    icon: Truck,
    endpoint: API_ENDPOINTS.stockTransferItems.list,
    byId: API_ENDPOINTS.stockTransferItems.byId,
    idFields: ['transferItemId', 'id'],
    referenceEndpoints: {
      stockTransfers: API_ENDPOINTS.stockTransfers.list,
      products: API_ENDPOINTS.products.list,
      productVariants: API_ENDPOINTS.productVariants.list,
    },
    referenceListKeys: {
      stockTransfers: 'stockTransfers',
      products: 'products',
      productVariants: 'productVariants',
    },
    fields: [
      {
        name: 'transferId',
        label: 'Transfer No. *',
        type: 'searchableSelect',
        valueType: 'number',
        required: true,
        min: 1,
        optionsFrom: 'stockTransfers',
        optionValue: ['transferId', 'id'],
        optionLabel: (item) => {
          const id = item.transferId ?? item.id;
          if (id === undefined || id === null || id === '') return '';
          return `TR-${String(id).padStart(6, '0')}`;
        },
        placeholder: 'Select transfer',
        searchPlaceholder: 'Search transfers',
      },
      {
        name: 'productId',
        label: 'Product *',
        type: 'searchableSelect',
        valueType: 'number',
        required: true,
        min: 1,
        optionsFrom: 'products',
        optionValue: ['productId', 'id'],
        optionLabel: ['name', 'productName', 'title'],
        placeholder: 'Select product',
        searchPlaceholder: 'Search products',
      },
      {
        name: 'variantId',
        label: 'Variant',
        type: 'searchableSelect',
        valueType: 'number',
        optionsFrom: 'productVariants',
        optionValue: ['variantId', 'id'],
        optionLabel: (item) => item.variantName ? `${item.variantName} (${item.sku || ''})` : item.sku || 'Default',
        placeholder: 'Select variant',
        searchPlaceholder: 'Search variants',
      },
      { name: 'quantity', label: 'Quantity *', type: 'number', required: true, min: 0.01 },
    ],
    columns: [
      {
        key: 'transferId',
        label: 'Transfer No.',
        sortable: true,
        render: (row) => {
          const id = row.transferId;
          if (id === undefined || id === null || id === '') return '';
          return `TR-${String(id).padStart(6, '0')}`;
        }
      },
      {
        key: 'productId',
        label: 'Product',
        sortable: true,
        render: (row, referenceData) => {
          const productId = row.productId
          const products = referenceData?.products ?? []
          const product = products.find(p => String(p.id ?? p.productId) === String(productId))
          return product ? product.name : (row.productName ?? `Product ${productId}`)
        },
      },
      {
        key: 'variantId',
        label: 'Variant',
        sortable: true,
        render: (row, referenceData) => {
          const variantId = row.variantId;
          if (!variantId) return '';
          const variants = referenceData?.productVariants ?? [];
          const variant = variants.find(v => String(v.variantId ?? v.id) === String(variantId));
          if (!variant) return `Variant ${variantId}`;
          return variant.variantName || 'Default';
        }
      },
      { key: 'quantity', label: 'Quantity', sortable: true },
    ],
  },
  stockAudits: {
    key: 'stockAudits',
    permissionKey: 'inventoryAudit',
    title: 'Stock Audits',
    subtitle: 'Plan and approve warehouse stock audits with accountable ownership.',
    entityName: 'Stock Audit',
    icon: FileClock,
    endpoint: API_ENDPOINTS.stockAudits.list,
    byId: API_ENDPOINTS.stockAudits.byId,
    forceDelete: true,
    idFields: ['auditId'],
    fields: [
      { name: 'warehouseId', label: 'Warehouse ID', type: 'number', required: true, min: 1 },
      { name: 'auditDate', label: 'Audit Date', type: 'date', required: true, defaultValue: getToday },
      {
        name: 'auditType',
        label: 'Audit Type',
        type: 'select',
        defaultValue: 'Cycle Count',
        options: [
          { value: 'Cycle Count', label: 'Cycle Count' },
          { value: 'Full Audit', label: 'Full Audit' },
          { value: 'Spot Check', label: 'Spot Check' },
        ],
      },
      { name: 'status', label: 'Status', type: 'select', options: stockAuditStatusOptions, defaultValue: 'Draft' },
      { name: 'createdBy', label: 'Created By', type: 'text' },
      { name: 'approvedBy', label: 'Approved By', type: 'text' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    columns: [
      {
        key: 'auditId',
        label: 'Audit No',
        sortable: true,
        render: (row) => row.auditNumber || row.auditNo || (row.auditId ? `AUD-${String(row.auditId).padStart(6, '0')}` : '-'),
      },
      { key: 'warehouseId', label: 'Warehouse ID', sortable: true },
      { key: 'auditDate', label: 'Audit Date', format: 'date', sortable: true },
      { key: 'auditType', label: 'Type', sortable: true },
      { key: 'status', label: 'Status', format: 'status', sortable: true },
    ],
  },
  stockAuditItems: {
    key: 'stockAuditItems',
    permissionKey: 'inventoryAudit',
    title: 'Stock Audit Items',
    subtitle: 'Compare system quantity against physical quantity for audited products.',
    entityName: 'Audit Item',
    icon: FileClock,
    endpoint: API_ENDPOINTS.stockAuditItems.list,
    byId: API_ENDPOINTS.stockAuditItems.byId,
    forceDelete: true,
    idFields: ['auditItemId', 'id'],
    referenceEndpoints: {
      stockAudits: API_ENDPOINTS.stockAudits.list,
      products: API_ENDPOINTS.products.list,
      productVariants: API_ENDPOINTS.productVariants.list,
      bins: API_ENDPOINTS.bins.list,
    },
    referenceListKeys: {
      stockAudits: 'stockAudits',
      products: 'products',
      productVariants: 'productVariants',
      bins: 'bins',
    },
    fields: [
      {
        name: 'auditId',
        label: 'Audit No *',
        type: 'searchableSelect',
        valueType: 'number',
        required: true,
        min: 1,
        optionsFrom: 'stockAudits',
        optionValue: ['auditId', 'id'],
        optionLabel: (item) => item.auditNumber || item.auditNo || (item.auditId ? `AUD-${String(item.auditId).padStart(6, '0')}` : `Audit #${item.auditId || item.id}`),
        placeholder: 'Select Audit No',
        searchPlaceholder: 'Search audit numbers',
      },
      {
        name: 'productId',
        label: 'Product Name *',
        type: 'searchableSelect',
        valueType: 'number',
        required: true,
        min: 1,
        optionsFrom: 'products',
        optionValue: ['productId', 'id'],
        optionLabel: ['name', 'productName', 'title'],
        placeholder: 'Select product',
        searchPlaceholder: 'Search products',
      },
      {
        name: 'variantId',
        label: 'Variant Name',
        type: 'searchableSelect',
        valueType: 'number',
        optionsFrom: 'productVariants',
        optionValue: ['variantId', 'id'],
        optionLabel: (item) => item.variantName ? `${item.variantName} (${item.sku || ''})` : (item.sku || `Variant #${item.variantId || item.id}`),
        placeholder: 'Select variant',
        searchPlaceholder: 'Search variants',
      },
      {
        name: 'binId',
        label: 'Bin Code *',
        type: 'searchableSelect',
        valueType: 'number',
        required: true,
        min: 1,
        optionsFrom: 'bins',
        optionValue: ['binId', 'id'],
        optionLabel: ['binCode', 'code', 'name', 'binName'],
        placeholder: 'Select bin code',
        searchPlaceholder: 'Search bin codes',
      },
      { name: 'systemQuantity', label: 'System Quantity *', type: 'number', required: true, min: 0 },
      { name: 'physicalQuantity', label: 'Physical Quantity *', type: 'number', required: true, min: 0 },
    ],
    columns: [
      {
        key: 'auditId',
        label: 'Audit No',
        sortable: true,
        render: (row, referenceData) => {
          const aId = row.auditId ?? row.audit_id;
          const audits = referenceData?.stockAudits ?? [];
          const audit = audits.find(a => String(a.id ?? a.auditId) === String(aId));
          return audit?.auditNumber || audit?.auditNo || row.auditNumber || row.auditNo || (aId ? `AUD-${String(aId).padStart(6, '0')}` : '-');
        }
      },
      {
        key: 'productId',
        label: 'Product Name',
        sortable: true,
        render: (row, referenceData) => {
          const pId = row.productId ?? row.product_id;
          const products = referenceData?.products ?? [];
          const product = products.find(p => String(p.id ?? p.productId) === String(pId));
          return product?.name || product?.productName || row.productName || row.product?.name || (pId ? `Product #${pId}` : '-');
        }
      },
      {
        key: 'variantId',
        label: 'Variant Name',
        sortable: true,
        render: (row, referenceData) => {
          const vId = row.variantId ?? row.variant_id;
          const variants = referenceData?.productVariants ?? [];
          const variant = variants.find(v => String(v.id ?? v.variantId) === String(vId));
          return variant?.variantName || row.variantName || (vId ? `Variant #${vId}` : '-');
        }
      },
      {
        key: 'binId',
        label: 'Bin Code',
        sortable: true,
        render: (row, referenceData) => {
          const bId = row.binId ?? row.bin_id;
          const bins = referenceData?.bins ?? [];
          const bin = bins.find(b => String(b.id ?? b.binId) === String(bId));
          return bin?.binCode || bin?.code || row.binCode || (bId ? `Bin #${bId}` : '-');
        }
      },
      { key: 'systemQuantity', label: 'System Qty', sortable: true },
      { key: 'physicalQuantity', label: 'Physical Qty', sortable: true },
    ],
  },
  invoices: {
    key: 'invoices',
    permissionKey: 'accounting',
    title: 'Invoices',
    subtitle: 'Create invoices, download PDFs, send email copies, and track balances from the live API.',
    entityName: 'Invoice',
    icon: ReceiptText,
    endpoint: API_ENDPOINTS.invoices.list,
    byId: API_ENDPOINTS.invoices.byId,
    canUpdate: false,
    idFields: ['invoiceId'],
    fields: [
      { name: 'soId', label: 'Sales Order ID', type: 'number', min: 1 },
      { name: 'customerId', label: 'Customer ID', type: 'number', required: true, min: 1 },
      { name: 'invoiceDate', label: 'Invoice Date', type: 'date', required: true, defaultValue: getToday },
      { name: 'dueDate', label: 'Due Date', type: 'date', defaultValue: getToday },
      { name: 'paidAmount', label: 'Paid Amount', type: 'currency', defaultValue: '0', min: 0 },
      { name: 'items', label: 'Invoice Items', type: 'lineItems', required: true },
    ],
    columns: [
      { key: 'invoiceNumber', label: 'Invoice', sortable: true },
      { key: 'customerName', label: 'Customer', sortable: true },
      { key: 'invoiceDate', label: 'Invoice Date', format: 'date', sortable: true },
      { key: 'dueDate', label: 'Due Date', format: 'date', sortable: true },
      { key: 'totalAmount', label: 'Total', format: 'currency', sortable: true },
      { key: 'paidAmount', label: 'Paid', format: 'currency', sortable: true },
      { key: 'balanceAmount', label: 'Balance', format: 'currency', sortable: true },
      { key: 'status', label: 'Status', format: 'status', sortable: true },
    ],
    rowActions: [
      {
        key: 'pdf',
        label: 'PDF',
        type: 'download',
        endpoint: (row, id) => API_ENDPOINTS.invoices.pdf(id),
        filename: (row, id) => `${row.invoiceNumber || `invoice-${id}`}.pdf`,
      },
      {
        key: 'email',
        label: 'Email',
        type: 'post',
        endpoint: (row, id) => API_ENDPOINTS.invoices.sendEmail(id),
        successMessage: 'Invoice email sent successfully.',
      },
    ],
  },
  notifications: {
    key: 'notifications',
    permissionKey: 'notifications',
    title: 'Notifications',
    subtitle: 'Manage live operational alerts, unread status, and notification cleanup.',
    entityName: 'Notification',
    icon: Bell,
    endpoint: API_ENDPOINTS.notifications.list,
    byId: API_ENDPOINTS.notifications.byId,
    canUpdate: false,
    idFields: ['notificationId'],
    metricEndpoint: API_ENDPOINTS.notifications.unreadCount,
    fields: [
      { name: 'title', label: 'Title', required: true, minLength: 2 },
      { name: 'message', label: 'Message', type: 'textarea', required: true, minLength: 3 },
      { name: 'type', label: 'Type', type: 'select', options: notificationTypes, defaultValue: 'info' },
      { name: 'isRead', label: 'Read', type: 'checkbox', defaultValue: false },
    ],
    columns: [
      { key: 'title', label: 'Title', sortable: true },
      { key: 'type', label: 'Type', format: 'status', sortable: true },
      { key: 'message', label: 'Message', sortable: true },
      { key: 'isRead', label: 'Read', format: 'boolean', sortable: true },
      { key: 'createdAt', label: 'Created Date', format: 'date', sortable: true },
    ],
    rowActions: [
      {
        key: 'read',
        label: 'Mark Read',
        type: 'put',
        endpoint: (row, id) => API_ENDPOINTS.notifications.read(id),
        shouldShow: (row) => !row.isRead,
        successMessage: 'Notification marked as read.',
      },
    ],
  },
  auditLogs: {
    key: 'auditLogs',
    permissionKey: 'auditLogs',
    title: 'Activity Feed',
    subtitle: 'Review the latest ERP activity across products, customers, suppliers, invoices, payments and inventory.',
    entityName: 'Activity',
    icon: History,
    endpoint: API_ENDPOINTS.auditLogs.list,
    defaultQuery: { pageSize: 50 },
    idFields: ['auditLogId', 'auditId', 'id'],
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    fields: [],
    columns: [
      { key: 'action', label: 'Action', sortable: true },
      { key: 'module', label: 'Module', sortable: true },
      { key: 'tableName', label: 'Table', sortable: true },
      { key: 'recordId', label: 'Record ID', sortable: true },
      { key: 'userId', label: 'User ID', sortable: true },
      { key: 'description', label: 'Description', sortable: true },
      { key: 'createdAt', label: 'Created Date', format: 'date', sortable: true },
    ],
  },
  users: {
    key: 'users',
    permissionKey: 'users',
    title: 'Users',
    subtitle: 'Manage backend users and account activation state.',
    entityName: 'User',
    icon: Users,
    endpoint: API_ENDPOINTS.users.list,
    byId: API_ENDPOINTS.users.byId,
    idFields: ['id'],
    fields: [
      { name: 'name', label: 'Name', required: true, minLength: 2 },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'passwordHash', label: 'Password', type: 'password', requiredOnCreate: true },
      { name: 'role', label: 'Role', type: 'select', defaultValue: 'User', options: [
        { value: 'Admin', label: 'Admin' },
        { value: 'Manager', label: 'Manager' },
        { value: 'Staff', label: 'Staff' },
        { value: 'User', label: 'User' },
      ] },
      { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
    ],
    columns: [
      {
        key: 'sNo',
        label: 'S.No',
        sortable: false,
        width: '60px',
        className: 'resource-center__cell-sno',
        render: (row, referenceData, index, sNo) => sNo ?? (index != null ? index + 1 : '-'),
      },
      { key: 'name', label: 'Name', sortable: true },
      { key: 'email', label: 'Email', sortable: true },
      {
        key: 'role',
        label: 'Role',
        sortable: true,
        className: 'resource-center__cell-role',
        render: (row) => {
          const roleValue = readResourceValue(row, 'role')
          return String(roleValue).toLowerCase() === 'user' ? 'New Employee' : roleValue
        },
      },
      { key: 'isActive', label: 'Status', format: 'boolean', sortable: true },
    ],
  },
  roles: {
    key: 'roles',
    permissionKey: 'roles',
    title: 'Roles',
    subtitle: 'Maintain backend role records used by users and authorization workflows.',
    entityName: 'Role',
    icon: ShieldCheck,
    endpoint: API_ENDPOINTS.roles.list,
    byId: API_ENDPOINTS.roles.byId,
    idFields: ['roleId'],
    fields: [
      { name: 'roleName', label: 'Role Name', required: true, minLength: 2 },
      { name: 'description', label: 'Description', type: 'textarea' },
    ],
    columns: [
      { key: 'roleName', label: 'Role', sortable: true },
      { key: 'description', label: 'Description', sortable: true },
      { key: 'createdAt', label: 'Created Date', format: 'date', sortable: true },
    ],
  },
  purchaseIndents: {
    key: 'purchaseIndents',
    permissionKey: 'purchaseIndents',
    title: 'Purchase Indents',
    subtitle: 'Manage purchase requisitions and stock top-up requests.',
    entityName: 'Purchase Indent',
    icon: FileText,
    endpoint: '/purchase-indents',
    byId: (id) => `/purchase-indents/${id}`,
    idFields: ['indentId'],
    referenceEndpoints: {
      products: API_ENDPOINTS.products.list,
    },
    fields: [
      { name: 'indentNumber', label: 'Indent Number', readOnly: true, submit: false },
      {
        name: 'productId',
        label: 'Product',
        type: 'select',
        required: true,
        valueType: 'number',
        optionsFrom: 'products',
        optionValue: 'id',
        optionLabel: 'name',
      },
      {
        name: 'quantity',
        label: 'Quantity Requested',
        type: 'number',
        required: true,
        min: 1,
      },
      {
        name: 'priority',
        label: 'Priority',
        type: 'select',
        required: true,
        defaultValue: 'Medium',
        options: [
          { value: 'Low', label: 'Low' },
          { value: 'Medium', label: 'Medium' },
          { value: 'High', label: 'High' },
        ],
      },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        required: true,
        defaultValue: 'Pending',
        options: [
          { value: 'Pending', label: 'Pending' },
          { value: 'Approved', label: 'Approved' },
          { value: 'Rejected', label: 'Rejected' },
          { value: 'Ordered', label: 'Ordered' },
        ],
      },
      { name: 'indentDate', label: 'Request Date', type: 'date', required: true, defaultValue: getToday },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    columns: [
      { key: 'indentNumber', label: 'Indent Number', sortable: true },
      { key: 'productName', label: 'Product', sortable: true },
      { key: 'quantity', label: 'Quantity', sortable: true },
      { key: 'priority', label: 'Priority', format: 'status', sortable: true },
      { key: 'status', label: 'Status', format: 'status', sortable: true },
      { key: 'indentDate', label: 'Date', format: 'date', sortable: true },
      { key: 'createdBy', label: 'Requested By', sortable: true },
    ],
  },
}

export const RESOURCE_HUBS = {
  catalogExtensions: ['subCategories', 'productAttributes', 'productVariants', 'variantAttributes'],
  stockOperations: [
    'stock',
    'stockMovements',
    'stockLedger',
    'stockAdjustments',
    'stockAdjustmentItems',
    'stockTransfers',
    'stockTransferItems',
    'stockAudits',
    'stockAuditItems',
  ],
  receiving: ['goodsReceipts'],
  accounting: ['invoices'],
  administration: ['users', 'roles', 'auditLogs', 'systemSettings'],
}

export const READ_ONLY_COLUMNS = readOnlyTimestamps
