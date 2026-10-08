import {
  BarChart3,
  Bell,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileText,
  GitBranch,
  History,
  LayoutDashboard,
  Layers3,
  Package,
  PackageCheck,
  ReceiptText,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
  ShoppingCart,
  Settings,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react'

export const PERMISSION_OPTIONS = [
  { key: 'dashboard', label: 'Dashboard', actions: ['view'], icon: LayoutDashboard },
  {
    key: 'products',
    label: 'Products',
    actions: ['view', 'create', 'edit', 'delete'],
    icon: Package,
  },
  {
    key: 'categories',
    label: 'Categories',
    actions: ['view', 'create', 'edit', 'delete'],
    icon: Boxes,
  },
  {
    key: 'subCategories',
    label: 'SubCategories',
    actions: ['view', 'create', 'edit', 'delete'],
    icon: Layers3,
  },
  {
    key: 'brands',
    label: 'Brands',
    actions: ['view', 'create', 'edit', 'delete'],
    icon: Package,
  },
  {
    key: 'units',
    label: 'Units',
    actions: ['view', 'create', 'edit', 'delete'],
    icon: ClipboardList,
  },
  {
    key: 'productAttributes',
    label: 'Attributes',
    actions: ['view', 'create', 'edit', 'delete'],
    icon: SlidersHorizontal,
  },
  {
    key: 'productVariants',
    label: 'Product Variants',
    actions: ['view', 'create', 'edit', 'delete'],
    icon: GitBranch,
  },
  { key: 'stock', label: 'Stock', actions: ['view', 'create', 'edit', 'delete'], icon: Boxes },
  {
    key: 'stockMovements',
    label: 'Stock Movements',
    actions: ['view', 'create', 'edit', 'delete'],
    icon: Package,
  },
  {
    key: 'stockLedger',
    label: 'Stock Ledger',
    actions: ['view', 'create', 'edit', 'delete'],
    icon: History,
  },
  {
    key: 'stockAdjustments',
    label: 'Stock Adjustments',
    actions: ['view', 'create', 'edit', 'delete'],
    icon: ClipboardList,
  },
  {
    key: 'stockTransfers',
    label: 'Stock Transfers',
    actions: ['view', 'create', 'edit', 'delete'],
    icon: Truck,
  },
  {
    key: 'goodsReceipts',
    label: 'Goods Receipts',
    actions: ['view', 'create', 'delete'],
    icon: PackageCheck,
  },
  {
    key: 'purchaseIndents',
    label: 'Purchase Indent',
    actions: ['view', 'create', 'edit', 'delete'],
    icon: FileText,
  },
  {
    key: 'purchases',
    label: 'Purchases',
    actions: ['view', 'create', 'delete'],
    icon: ReceiptText,
  },
  {
    key: 'sales',
    label: 'Sales',
    actions: ['view', 'create', 'delete'],
    icon: ShoppingCart,
  },
  {
    key: 'inventoryAudit',
    label: 'Inventory Audit',
    actions: ['view', 'create', 'edit', 'delete'],
    icon: ClipboardList,
  },
  {
    key: 'barcode',
    label: 'Barcode / QR',
    actions: ['view', 'create'],
    icon: ScanLine,
  },
  {
    key: 'suppliers',
    label: 'Suppliers',
    actions: ['view', 'create', 'edit', 'delete'],
    icon: Truck,
  },
  {
    key: 'customers',
    label: 'Customers',
    actions: ['view', 'create', 'edit', 'delete'],
    icon: Users,
  },
  {
    key: 'customerPayments',
    label: 'Customer Payments',
    actions: ['view', 'create', 'delete'],
    icon: CreditCard,
  },
  {
    key: 'supplierPayments',
    label: 'Supplier Payments',
    actions: ['view', 'create', 'delete'],
    icon: CreditCard,
  },
  {
    key: 'warehouses',
    label: 'Warehouses',
    actions: ['view', 'create', 'edit', 'delete'],
    icon: Warehouse,
  },
  { key: 'reports', label: 'Reports', actions: ['view'], icon: BarChart3 },
  {
    key: 'notifications',
    label: 'Notifications',
    actions: ['view', 'create'],
    icon: Bell,
  },
  {
    key: 'accounting',
    label: 'Accounting',
    actions: ['view', 'create'],
    icon: FileText,
  },
  {
    key: 'salesReturns',
    label: 'Sales Returns',
    actions: ['view', 'create', 'edit', 'delete'],
    icon: RotateCcw,
  },

  { key: 'purchaseReturns', label: 'Purchase Returns', actions: ['view', 'create', 'edit', 'delete'], icon: RotateCcw },

  {
    key: 'users',
    label: 'Users',
    actions: ['view', 'create', 'edit', 'delete'],
    icon: Users,
  },
  {
    key: 'roles',
    label: 'Roles',
    actions: ['view', 'create', 'edit', 'delete'],
    icon: ShieldCheck,
  },
  {
    key: 'auditLogs',
    label: 'Audit Logs',
    actions: ['view'],
    icon: History,
  },
  {
    key: 'systemSettings',
    label: 'Settings',
    actions: ['view', 'edit'],
    icon: Settings,
  },
]

export const NAV_ITEMS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    category: 'dashboard',
  },
  {
    key: 'categories',
    label: 'Categories',
    path: '/inventory/categories',
    icon: Boxes,
    category: 'masters',
  },
  {
    key: 'subCategories',
    label: 'SubCategories',
    path: '/inventory/subcategories',
    icon: Layers3,
    category: 'masters',
  },
  {
    key: 'brands',
    label: 'Brands',
    path: '/inventory/brands',
    icon: Package,
    category: 'masters',
  },
  {
    key: 'products',
    label: 'Products',
    path: '/inventory/products',
    icon: Package,
    category: 'masters',
  },
  {
    key: 'productAttributes',
    label: 'Attributes',
    path: '/inventory/attributes',
    icon: SlidersHorizontal,
    category: 'masters',
  },
  {
    key: 'productVariants',
    label: 'Product Variants',
    path: '/inventory/product-variants',
    icon: GitBranch,
    category: 'masters',
  },
  {
    key: 'units',
    label: 'Units',
    path: '/inventory/units',
    icon: ClipboardList,
    category: 'masters',
  },
  {
    key: 'suppliers',
    label: 'Suppliers',
    path: '/people/suppliers',
    icon: Truck,
    category: 'masters',
  },
  {
    key: 'customers',
    label: 'Customers',
    path: '/people/customers',
    icon: Users,
    category: 'masters',
  },
  {
    key: 'purchaseIndents',
    label: 'Purchase Indent',
    path: '/inventory/purchase-indents',
    icon: FileText,
    category: 'inventory',
  },
  {
    key: 'purchases',
    label: 'Purchase Order',
    path: '/inventory/purchases',
    icon: ReceiptText,
    category: 'inventory',
  },
  {
    key: 'goodsReceipts',
    label: 'Goods Receipt',
    path: '/inventory/goods-receipts',
    icon: PackageCheck,
    category: 'inventory',
  },
  {
    key: 'stock',
    label: 'Stock',
    path: '/inventory/stock',
    icon: Boxes,
    category: 'inventory',
    children: [
      { key: 'stock', label: 'Stock Register', path: '/inventory/stock?tab=stock' },
      { key: 'stockMovements', label: 'Stock Movements', path: '/inventory/stock?tab=stockMovements' },
      { key: 'stockLedger', label: 'Stock Ledger', path: '/inventory/stock?tab=stockLedger' },
      { key: 'stockAdjustments', label: 'Stock Adjustments', path: '/inventory/stock?tab=stockAdjustments' },
      { key: 'stockTransfers', label: 'Stock Transfers', path: '/inventory/stock?tab=stockTransfers' },
      { key: 'stockAudits', label: 'Stock Audits', path: '/inventory/stock?tab=stockAudits' },
    ],
  },
  {
    key: 'sales',
    label: 'Sales',
    path: '/pos/sales',
    aliases: ['/inventory/sales'],
    icon: ShoppingCart,
    category: 'pos',
  },
  {
    key: 'salesReturns',
    label: 'Sales Returns',
    path: '/pos/returns',
    aliases: ['/pos/returns/returns', '/returns', '/extra/returns/returns', '/extra/returns'],
    icon: RotateCcw,
    category: 'pos',
  },
  {
    key: 'inventoryAudit',
    label: 'Inventory Audit',
    path: '/inventory/audit',
    icon: ClipboardList,
    category: 'inventory',
  },
  {
    key: 'barcode',
    label: 'Barcode',
    path: '/inventory/barcode',
    icon: ScanLine,
    category: 'inventory',
  },
  {
    key: 'customerPayments',
    label: 'Customer Payments',
    path: '/people/customer-payments',
    icon: CreditCard,
    category: 'billing',
  },
  {
    key: 'supplierPayments',
    label: 'Supplier Payments',
    path: '/people/supplier-payments',
    icon: CreditCard,
    category: 'billing',
  },
  {
    key: 'purchaseReturns',
    label: 'Purchase Returns',
    path: '/inventory/purchase-returns',
    icon: RotateCcw,
    category: 'inventory',
  },

  {
    key: 'warehouses',
    label: 'Warehouses',
    path: '/management/warehouses',
    aliases: ['/warehouses'],
    icon: Warehouse,
    category: 'management',
  },
  {
    key: 'reports',
    label: 'Reports',
    path: '/management/reports',
    aliases: ['/reports'],
    icon: BarChart3,
    category: 'management',
  },
  {
    key: 'notifications',
    label: 'Notifications',
    path: '/management/notifications',
    aliases: ['/notifications'],
    icon: Bell,
    category: 'management',
  },
  {
    key: 'accounting',
    label: 'Accounting',
    path: '/management/accounting',
    aliases: ['/accounting'],
    icon: FileText,
    category: 'management',
  },
  {
    key: 'users',
    label: 'Users',
    path: '/administration/users',
    aliases: ['/users'],
    icon: Users,
    category: 'admin',
  },
  {
    key: 'roles',
    label: 'Roles',
    path: '/administration/roles',
    aliases: ['/roles'],
    icon: ShieldCheck,
    category: 'admin',
  },
  {
    key: 'auditLogs',
    label: 'Audit Logs',
    path: '/administration/audit-logs',
    aliases: ['/audit-logs'],
    icon: History,
    category: 'admin',
  },
  {
    key: 'systemSettings',
    label: 'Settings',
    path: '/administration/settings',
    aliases: ['/settings'],
    icon: Settings,
    category: 'admin',
  },
]

function getNavPaths(item) {
  return [item.path, ...(item.aliases ?? [])]
}

export function isNavItemMatch(item, pathname = '') {
  const isDirectMatch = getNavPaths(item).some((path) =>
    pathname === path || pathname.startsWith(`${path}/`),
  )
  if (isDirectMatch) return true
  if (item.children) {
    return item.children.some((child) => {
      const childBasePath = child.path.split('?')[0]
      return pathname === childBasePath || pathname.startsWith(`${childBasePath}/`)
    })
  }
  return false
}

function resolveRole(role, roleList = []) {
  if (!role) return null

  if (typeof role === 'object' && role.permissions) {
    return role
  }

  const normalizedRole = String(role).toLowerCase()
  const matchedRole = roleList.find((item) => item.name.toLowerCase() === normalizedRole) ?? null

  return matchedRole
}

export function normalizePermissions(permissions = {}) {
  return PERMISSION_OPTIONS.reduce((result, moduleItem) => {
    result[moduleItem.key] = moduleItem.actions.filter((action) =>
      permissions[moduleItem.key]?.includes(action),
    )
    return result
  }, {})
}

export function canAccess(moduleKey, action, role, roleList = []) {
  const roleObject = resolveRole(role, roleList)
  if (!roleObject) return false

  const normalizedRoleName = String(roleObject.name || role || '').trim().toLowerCase()
  if (normalizedRoleName === 'admin') {
    return true
  }

  const actualKey = moduleKey === 'settings' ? 'systemSettings' : moduleKey

  if (
    ['purchaseIndents'].includes(actualKey) &&
    !Object.prototype.hasOwnProperty.call(roleObject.permissions ?? {}, actualKey)
  ) {
    return action === 'view'
  }

  return (
    roleObject.permissions?.[actualKey]?.includes(action) ??
    roleObject.permissions?.[moduleKey]?.includes(action) ??
    false
  )
}

export function getDefaultPath(role, roleList = []) {
  const allowedItem = NAV_ITEMS.find((item) =>
    canAccess(item.key, 'view', role, roleList),
  )

  return allowedItem?.path ?? '/login'
}

export function getPageTitle(pathname) {
  const matchedItem = NAV_ITEMS.find((item) =>
    isNavItemMatch(item, pathname),
  )
  return matchedItem?.label ?? 'Workspace'
}

export function getNavItem(pathname) {
  return NAV_ITEMS.find((item) =>
    isNavItemMatch(item, pathname),
  ) ?? null
}
