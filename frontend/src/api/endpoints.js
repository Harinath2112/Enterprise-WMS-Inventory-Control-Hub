export const API_ENDPOINTS = {
  auth: {
    login: "/auth/login",
    register: "/auth/register",
    refreshToken: "/auth/refresh-token",
    forgotPassword: "/auth/forgot-password",
    changePassword: (userId) => `/auth/change-password/${userId}`,
    verifyEmail: "/auth/verify-email",
    logout: (userId) => `/auth/logout/${userId}`,
    logoutAllDevices: (userId) =>
      `/auth/logout-all-devices/${userId}`,
    resetPassword: "/auth/reset-password",
    claims: "/auth/claims",
    verifyOtp: "/auth/verify-otp",
    verifyEmailOtp: "/auth/verify-email-otp",
    resendLoginOtp: "/auth/resend-login-otp",
    resendVerification: "/auth/resend-verification",
    session: "/Profile/me",
  },

  products: {
    list: "/products",
    create: "/products",
    createFull: "/products/full",
    byId: (id) => `/products/${id}`,
    uploadImage: (id) => `/products/upload-image/${id}`,
  },

  barcode: {
    list: "/Barcode",
    generate: "/Barcode/generate",
  },

  productVariants: {
    list: "/productvariants",
    byId: (id) => `/productvariants/${id}`,
    byProduct: (productId) => `/productvariants/${productId}`,
  },

  productAttributes: {
    list: "/attributes",
    byId: (id) => `/attributes/${id}`,
  },

  attributeValues: {
    list: "/attribute-values",
    byAttribute: (attributeId) =>
      `/attribute-values/attribute/${attributeId}`,
    byId: (id) => `/attribute-values/${id}`,
  },

  variantAttributes: {
    list: "/variant-attributes",
    byId: (id) => `/variant-attributes/${id}`,
    byVariant: (variantId) =>
      `/variant-attributes/variant/${variantId}`,
  },

  categories: {
    list: "/categories",
    create: "/categories",
    main: "/categories/main",
    sub: (parentId) => `/categories/sub/${parentId}`,
    byId: (id) => `/categories/${id}`,
  },

  subCategories: {
    list: "/SubCategories",
    byId: (id) => `/SubCategories/${id}`,
  },

  brands: {
    list: "/brands",
    create: "/brands",
    byId: (id) => `/brands/${id}`,
  },

  units: {
    list: "/units",
    create: "/units",
    byId: (id) => `/units/${id}`,
  },

  suppliers: {
    list: "/Suppliers",
    byId: (id) => `/Suppliers/${id}`,
    restore: (id) => `/Suppliers/${id}/restore`,
    ifsc: (ifscCode) =>
      `/Suppliers/ifsc/${encodeURIComponent(ifscCode)}`,
    documents: (supplierId) =>
      `/Suppliers/${supplierId}/documents`,
    uploadDocument: (supplierId) =>
      `/Suppliers/${supplierId}/documents/upload`,
    cleanupTempDocuments: (supplierId) =>
      `/Suppliers/${supplierId}/documents/temp`,
    downloadDocument: (documentId) =>
      `/Suppliers/documents/${documentId}/download`,
    deleteDocument: (documentId) =>
      `/Suppliers/documents/${documentId}`,
  },

  customers: {
    list: "/Customers",
    byId: (id) => `/Customers/${id}`,
    status: (id) => `/Customers/${id}/status`,
    summary: "/Customers/summary",
    history: (id) => `/Customers/${id}/history`,
  },

  dashboard: {
    summary: "/Dashboard/summary",
    lowStock: "/Dashboard/low-stock",
    recentSales: "/Dashboard/recent-sales",
    topProducts: "/Dashboard/top-products",
    monthlySales: "/Dashboard/monthly-sales",
    monthlyPurchases: "/Dashboard/monthly-purchases",
    recentActivities: "/Dashboard/recent-activities",
  },

  search: {
    global: "/search/global",
  },

  customerPayments: {
    list: "/CustomerPayments",
    byId: (id) => `/CustomerPayments/${id}`,
  },

  supplierPayments: {
    list: "/SupplierPayments",
    byId: (id) => `/SupplierPayments/${id}`,
  },

  purchaseOrders: {
    list: "/PurchaseOrders",
    byId: (id) => `/PurchaseOrders/${id}`,
    approve: (id) => `/PurchaseOrders/${id}/approve`,
    cancel: (id) => `/PurchaseOrders/${id}/cancel`,
  },

  goodsReceipts: {
    list: "/GoodsReceipts",
    byId: (id) => `/GoodsReceipts/${id}`,
    approve: (id) => `/GoodsReceipts/${id}/approve`,
    reverse: (id) => `/GoodsReceipts/${id}/reverse`,
    byPo: (poId) => `/GoodsReceipts/by-po/${poId}`,
    returnItems: (grnId) =>
      `/GoodsReceipts/${grnId}/return-items`,
  },

  invoices: {
    list: "/Invoices",
    byId: (id) => `/Invoices/${id}`,
    pdf: (id) => `/Invoices/${id}/pdf`,
    sendEmail: (id) => `/Invoices/${id}/send-email`,
  },

  notifications: {
    list: "/Notifications",
    unreadCount: "/Notifications/unread-count",
    read: (id) => `/Notifications/${id}/read`,
    byId: (id) => `/Notifications/${id}`,
  },

  auditLogs: {
    list: "/AuditLogs",
    byModule: (module) => `/AuditLogs/module/${module}`,
    byUser: (userId) => `/AuditLogs/user/${userId}`,
  },

  reports: {
    sales: "/Reports/sales",
    purchases: "/Reports/purchases",
    invoices: "/Reports/invoices",
    stock: "/Reports/stock",
    customerBalances: "/Reports/customer-balances",
    filtersWarehouses: "/Reports/filters/warehouses",
    filtersCategories: "/Reports/filters/categories",
    filtersProducts: "/Reports/filters/products",
    filtersCustomers: "/Reports/filters/customers",
    filtersSuppliers: "/Reports/filters/suppliers",
    transactionTrend: "/Reports/transaction-trend",
    stockAvailability: "/Reports/stock-availability",
    topCustomers: "/Reports/top-customers",
    topSuppliers: "/Reports/top-suppliers",
    customerOutstanding: "/Reports/customer-outstanding",
    supplierOutstanding: "/Reports/supplier-outstanding",
    inventoryValuation: "/Reports/inventory-valuation",
    lowStock: "/Reports/low-stock",
    fastMoving: "/Reports/fast-moving",
    slowMoving: "/Reports/slow-moving",
    profitability: "/Reports/profitability",
    gstTax: "/Reports/gst-tax",
    forecasting: "/Reports/forecasting",
    warehousePerformance: "/Reports/warehouse-performance",
    summary: "/Reports/summary",
    exportSales: "/Reports/export-sales",
    exportStock: "/Reports/export-stock",
    exportSalesPdf: "/Reports/export-sales-pdf",
    exportStockPdf: "/Reports/export-stock-pdf",
    returns: "/Reports/returns",
    exchanges: "/Reports/exchanges",
    damages: "/Reports/damages",
    creditNotes: "/Reports/credit-notes",
  },

  salesReturns: {
    list: "/SalesReturns",
    byId: (id) => `/SalesReturns/${id}`,
    customers: "/SalesReturns/customers",
    customerInvoices: (customerId) => `/SalesReturns/customers/${customerId}/invoices`,
    invoiceItems: (invoiceId) => `/SalesReturns/invoices/${invoiceId}/items`,
  },

  purchaseReturns: {
    suppliers: "/PurchaseReturns/suppliers",

    grns: "/PurchaseReturns/grns",

    grnItems: (grnId) =>
      `/PurchaseReturns/grn/${grnId}/items`,

    list: "/PurchaseReturns",

    create: "/PurchaseReturns",

    byId: (id) =>
      `/PurchaseReturns/${id}`,

    update: (id) =>
      `/PurchaseReturns/${id}`,

    delete: (id) =>
      `/PurchaseReturns/${id}`,
  },

  exchanges: {
    list: "/Exchanges",
    byId: (id) => `/Exchanges/${id}`,
    status: (id) => `/Exchanges/${id}/status`,
    moveNext: (id) => `/Exchanges/${id}/move-next`,
  },

  refunds: {
    list: "/Refunds",
    byId: (id) => `/Refunds/${id}`,
  },

  inspections: {
    list: "/Inspections",
    byId: (id) => `/Inspections/${id}`,
  },

  damages: {
    list: "/Damages",
    byId: (id) => `/Damages/${id}`,
  },

  damageInventory: {
    list: "/DamageInventory",
  },

  creditNotes: {
    list: "/CreditNotes",
    byId: (id) => `/CreditNotes/${id}`,
    consume: (id) => `/CreditNotes/${id}/consume`,
  },

  stock: {
    list: "/stock",
    byId: (id) => `/stock/${id}`,
  },

  stockAdjustments: {
    list: "/stock-adjustments",
    byId: (id) => `/stock-adjustments/${id}`,
  },

  stockAdjustmentItems: {
    list: "/stock-adjustment-items",
    byId: (id) => `/stock-adjustment-items/${id}`,
  },

  stockAudits: {
    list: "/stock-audits",
    byId: (id) => `/stock-audits/${id}`,
  },

  stockAuditItems: {
    list: "/stock-audit-items",
    byId: (id) => `/stock-audit-items/${id}`,
  },

  stockLedger: {
    list: "/stock-ledger",
    byId: (id) => `/stock-ledger/${id}`,
  },

  stockMovements: {
    list: "/stock-movements",
    byId: (id) => `/stock-movements/${id}`,
  },

  stockTransfers: {
    list: "/stock-transfers",
    byId: (id) => `/stock-transfers/${id}`,
  },

  stockTransferItems: {
    list: "/stock-transfer-items",
    byId: (id) => `/stock-transfer-items/${id}`,
  },

  warehouseStats: {
    list: "/warehouse-stats",
    fallback: "/Warehouses/summary",
  },

  warehouses: {
    list: "/Warehouses",
    byId: (id) => `/Warehouses/${id}`,
    details: (id) => `/warehouses/${id}/details`,
    products: (id) => `/Warehouses/${id}/products`,
    stockFromGrn: (grnId) =>
      `/Warehouses/stock/from-grn/${grnId}`,
  },

  bins: {
    list: "/Bins",
    byId: (id) => `/Bins/${id}`,
  },

  racks: {
    list: "/Racks",
    byId: (id) => `/Racks/${id}`,
  },

  binStocks: {
    list: "/bin-stocks",
  },

  binTransfers: {
    list: "/bin-transfers",
  },

  putawayStock: {
    list: "/putaway-stock",
  },

  users: {
    list: "/Users",
    byId: (id) => `/Users/${id}`,
  },

  roles: {
    list: "/Roles",
    byId: (id) => `/Roles/${id}`,
  },

  permissions: {
    roles: "/Permissions/roles",
    byRole: (roleId) =>
      `/Permissions/role/${roleId}`,
    update: "/Permissions/update",
  },

  systemSettings: {
    productRules: {
      get: "/product-rules",
      put: "/product-rules",
      reset: "/product-rules/reset",
    },

    purchaseRules: {
      get: "/purchase-goods-receipt",
      put: "/purchase-goods-receipt",
      reset: "/purchase-goods-receipt/reset",
    },

    salesRules: {
      get: "/sales-invoice",
      put: "/sales-invoice",
      reset: "/sales-invoice/reset",
    },

    returnRules: {
      get: "/return-refund",
      put: "/return-refund",
      reset: "/return-refund/reset",
    },

    taxRules: {
      get: "/tax-billing",
      put: "/tax-billing",
      reset: "/tax-billing/reset",
    },

    stockRules: {
      get: "/advanced-stock-control",
      put: "/advanced-stock-control",
      reset: "/advanced-stock-control/reset",
    },

    warehouseRules: {
      get: "/warehouse-bin-rack",
      put: "/warehouse-bin-rack",
      reset: "/warehouse-bin-rack/reset",
    },

    auditRules: {
      get: "/audit-log-rules",
      put: "/audit-log-rules",
      reset: "/audit-log-rules/reset",
    },

    reportRules: {
      get: "/report-export",
      put: "/report-export",
      reset: "/report-export/reset",
    },

    securityPolicy: {
      get: "/system-security-policy",
      put: "/system-security-policy",
      reset: "/system-security-policy/reset",
    },

    integrationSettings: {
      get: "/integration-settings",
      put: "/integration-settings",
      reset: "/integration-settings/reset",
    },
  },
};