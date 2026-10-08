function number(value) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
}

function text(value, fallback = '') {
    return value == null || value === '' ? fallback : String(value)
}

function toDate(value) {
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
}

function daysBetween(fromDate, toDateValue = new Date()) {
    const from = toDate(fromDate)
    const to = toDateValue instanceof Date ? toDateValue : toDate(toDateValue)
    if (!from || !to) return 0
    return Math.max(0, Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)))
}

function getProductName(product) {
    return text(product.name || product.productName || product.title || product.product, 'Unknown Product')
}

function getProductSku(product, index = 0) {
    return text(product.sku || product.code || product.productCode || product.itemCode, `SKU-${index + 1}`)
}

function getProductCategory(product) {
    return text(product.category || product.categoryName || product.type, 'General')
}

function getCustomerName(row) {
    return text(row.customer || row.customerName || row.name || row.company, 'Walk-in Customer')
}

function getSupplierName(row) {
    return text(row.supplier || row.supplierName || row.name || row.company, 'Default Supplier')
}

function getWarehouseName(row, warehouses = []) {
    if (row.warehouse || row.warehouseName || row.location) {
        return text(row.warehouse || row.warehouseName || row.location)
    }

    if (row.warehouseId) {
        const found = warehouses.find((w) => String(w.id || w.warehouseId).toLowerCase() === String(row.warehouseId).toLowerCase())
        if (found) return text(found.name || found.warehouseName)
    }

    return ''
}

function getProductStock(product, stock) {
    const productId = product.id || product.productId
    const productName = getProductName(product)

    const stockRows = stock.filter((item) => {
        return (
            item.productId === productId ||
            item.id === productId ||
            item.product === productName ||
            item.productName === productName ||
            item.name === productName
        )
    })

    if (!stockRows.length) {
        return number(
            product.availableQuantity ||
            product.availableStock ||
            product.quantity ||
            product.stock ||
            product.currentStock ||
            0,
        )
    }

    return stockRows.reduce((total, item) => {
        return total + number(
            item.availableQuantity ||
            item.availableStock ||
            item.quantity ||
            item.currentStock ||
            item.stock ||
            0,
        )
    }, 0)
}

function getProductCost(product) {
    return number(
        product.costPrice ||
        product.purchasePrice ||
        product.unitCost ||
        product.buyingPrice ||
        product.averageCost ||
        product.price ||
        0,
    )
}

function getProductSalePrice(product) {
    return number(product.sellingPrice || product.salePrice || product.mrp || product.price || 0)
}

function getRowTotal(row) {
    return number(row.totalAmount || row.grandTotal || row.amount || row.total || row.netAmount || row.value)
}

function getRowDate(row) {
    return row.orderDate || row.invoiceDate || row.billDate || row.date || row.createdAt || ''
}

function getLineItems(row) {
    const items = row.items || row.products || row.orderItems || row.lines || []
    return Array.isArray(items) ? items : []
}

function normalizeProducts(products = [], stock = []) {
    if (products.length) return products

    return stock.map((item, index) => ({
        id: item.productId || item.id || index + 1,
        name: item.product || item.productName || item.name || `Product ${index + 1}`,
        sku: item.sku || item.code || `SKU-${index + 1}`,
        category: item.category || item.categoryName || 'General',
        warehouse: item.warehouse || item.warehouseName,
        availableQuantity: item.availableQuantity || item.quantity || item.availableStock || item.stock,
        costPrice: item.costPrice || item.averageCost || item.price || 0,
        minimumStock: item.minimumStock || item.reorderLevel || item.lowStockLimit || 10,
    }))
}

function groupByName(rows, getName) {
    const map = new Map()

    rows.forEach((row) => {
        const name = getName(row)
        const current = map.get(name) || []
        current.push(row)
        map.set(name, current)
    })

    return map
}

function getAgingStatus(dateValue) {
    const age = daysBetween(dateValue)

    if (age <= 30) return '0-30 Days'
    if (age <= 60) return '31-60 Days'
    if (age <= 90) return '61-90 Days'
    return 'Above 90 Days'
}

function getMonthKey(value) {
    const date = toDate(value)
    if (!date) return 'Unknown'

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')

    return `${year}-${month}`
}

function getMonthLabel(monthKey) {
    if (monthKey === 'Unknown') return 'Unknown'

    const date = new Date(`${monthKey}-01`)

    return date.toLocaleString('en-US', {
        month: 'short',
        year: 'numeric',
    })
}

function salesByProduct(sales = []) {
    const map = new Map()

    sales.forEach((sale) => {
        const items = getLineItems(sale)

        if (!items.length) {
            const productName = sale.product || sale.productName || sale.item || 'General Sales'
            const current = map.get(productName) || {
                productName,
                sku: sale.sku || '-',
                unitsSold: 0,
                salesValue: 0,
                lastSoldDate: '',
            }

            const quantity = number(sale.quantity || sale.qty || 1)
            const total = getRowTotal(sale)

            map.set(productName, {
                ...current,
                unitsSold: current.unitsSold + quantity,
                salesValue: current.salesValue + total,
                lastSoldDate: getRowDate(sale) || current.lastSoldDate,
            })

            return
        }

        items.forEach((item) => {
            const productName = item.productName || item.product || item.name || 'Unknown Product'
            const current = map.get(productName) || {
                productName,
                sku: item.sku || item.code || '-',
                unitsSold: 0,
                salesValue: 0,
                lastSoldDate: '',
            }

            const quantity = number(item.quantity || item.qty || 1)
            const total =
                number(item.total || item.totalAmount || item.amount || item.price) ||
                quantity * number(item.price || item.sellingPrice)

            map.set(productName, {
                ...current,
                unitsSold: current.unitsSold + quantity,
                salesValue: current.salesValue + total,
                lastSoldDate: getRowDate(sale) || current.lastSoldDate,
            })
        })
    })

    return [...map.values()]
}

export function buildInventoryValuationReport({ products = [], stock = [], warehouses = [] }) {
    return normalizeProducts(products, stock).map((product, index) => {
        const quantityAvailable = getProductStock(product, stock)
        const averageCost = getProductCost(product)
        const stockRow = stock.find((s) => (s.productId || s.id) === (product.id || product.productId))

        return {
            id: product.id || product.productId || index + 1,
            productName: getProductName(product),
            sku: getProductSku(product, index),
            category: getProductCategory(product),
            warehouseId: product.warehouseId || stockRow?.warehouseId || '',
            warehouse: product.warehouse || product.warehouseName || stockRow?.warehouseName || stockRow?.warehouse || getWarehouseName(product, warehouses),
            quantityAvailable,
            averageCost,
            totalStockValue: quantityAvailable * averageCost,
            lastPurchaseDate: product.lastPurchaseDate || product.createdAt || product.updatedAt || '',
        }
    })
}

export function buildLowStockReport({ products = [], stock = [], warehouses = [] }) {
    return normalizeProducts(products, stock).map((product, index) => {
        const availableStock = getProductStock(product, stock)
        const minimumStockLevel = number(
            product.minimumStock || product.minStock || product.reorderLevel || product.lowStockLimit || 10,
        )
        const reorderQuantity = number(product.reorderQuantity || product.reorderQty || minimumStockLevel * 2)

        let status = 'Healthy'

        if (availableStock <= minimumStockLevel) status = 'Critical'
        else if (availableStock <= minimumStockLevel + 5) status = 'Warning'

        const stockRow = stock.find((s) => (s.productId || s.id) === (product.id || product.productId))

        return {
            id: product.id || product.productId || index + 1,
            productName: getProductName(product),
            sku: getProductSku(product, index),
            category: getProductCategory(product),
            availableStock,
            minimumStockLevel,
            reorderQuantity,
            warehouseId: product.warehouseId || stockRow?.warehouseId || '',
            warehouse: product.warehouse || product.warehouseName || stockRow?.warehouseName || stockRow?.warehouse || getWarehouseName(product, warehouses),
            status,
        }
    })
}

export function buildFastMovingReport({ products = [], stock = [], sales = [], warehouses = [] }) {
    const productSales = salesByProduct(sales)
    const normalizedProducts = normalizeProducts(products, stock)

    return productSales
        .map((item, index) => {
            const product = normalizedProducts.find((row) => getProductName(row) === item.productName) || {}
            const stockRow = stock.find((s) => (s.productId || s.id) === (product.id || product.productId))
            const stockLeft = getProductStock(product, stock)

            return {
                id: index + 1,
                productName: item.productName,
                sku: item.sku || getProductSku(product, index),
                unitsSold: item.unitsSold,
                salesValue: item.salesValue,
                stockLeft,
                warehouseId: product.warehouseId || stockRow?.warehouseId || '',
                warehouse: product.warehouse || product.warehouseName || stockRow?.warehouseName || stockRow?.warehouse || getWarehouseName(product, warehouses),
                movementStatus: item.unitsSold >= 10 ? 'Fast' : 'Watch',
            }
        })
        .sort((first, second) => second.unitsSold - first.unitsSold)
}

export function buildSlowMovingReport({ products = [], stock = [], sales = [], warehouses = [] }) {
    const productSales = salesByProduct(sales)
    const salesMap = new Map(productSales.map((item) => [item.productName, item]))

    return normalizeProducts(products, stock)
        .map((product, index) => {
            const productName = getProductName(product)
            const sold = salesMap.get(productName)
            const lastSoldDate = sold?.lastSoldDate || ''
            const stockAvailable = getProductStock(product, stock)
            const stockValue = stockAvailable * getProductCost(product)
            const daysSinceLastSale = lastSoldDate ? daysBetween(lastSoldDate) : 999
            const stockRow = stock.find((s) => (s.productId || s.id) === (product.id || product.productId))

            return {
                id: product.id || index + 1,
                productName,
                sku: getProductSku(product, index),
                lastSoldDate,
                stockAvailable,
                daysSinceLastSale,
                stockValue,
                warehouseId: product.warehouseId || stockRow?.warehouseId || '',
                warehouse: product.warehouse || product.warehouseName || stockRow?.warehouseName || stockRow?.warehouse || getWarehouseName(product, warehouses),
                movementStatus: daysSinceLastSale > 90 ? 'Slow' : 'Watch',
            }
        })
        .sort((first, second) => second.daysSinceLastSale - first.daysSinceLastSale)
}

export function buildTopCustomersReport({ sales = [], customers = [] }) {
    const grouped = groupByName(sales, getCustomerName)

    const rows = [...grouped.entries()].map(([customerName, customerSales], index) => {
        const customer = customers.find((row) => getCustomerName(row) === customerName) || {}
        const totalSalesValue = customerSales.reduce((total, row) => total + getRowTotal(row), 0)
        const lastPurchaseDate = customerSales.map(getRowDate).filter(Boolean).sort().at(-1) || ''
        const whId = customerSales.find(s => s.warehouseId)?.warehouseId || ''
        const whName = customerSales.find(s => s.warehouse || s.warehouseName)?.warehouse || customerSales.find(s => s.warehouse || s.warehouseName)?.warehouseName || ''

        return {
            id: index + 1,
            customerName,
            totalOrders: customerSales.length,
            totalSalesValue,
            outstandingAmount: number(
                customer.outstandingBalance || customer.balance || customer.balanceAmount || customer.dueAmount,
            ),
            lastPurchaseDate,
            warehouseId: whId,
            warehouse: whName,
        }
    })

    return rows.sort((first, second) => second.totalSalesValue - first.totalSalesValue)
}

export function buildTopSuppliersReport({ purchases = [], suppliers = [] }) {
    const grouped = groupByName(purchases, getSupplierName)

    const rows = [...grouped.entries()].map(([supplierName, supplierPurchases], index) => {
        const supplier = suppliers.find((row) => getSupplierName(row) === supplierName) || {}
        const purchaseValue = supplierPurchases.reduce((total, row) => total + getRowTotal(row), 0)
        const lastPurchaseDate = supplierPurchases.map(getRowDate).filter(Boolean).sort().at(-1) || ''
        const whId = supplierPurchases.find(p => p.warehouseId)?.warehouseId || ''
        const whName = supplierPurchases.find(p => p.warehouse || p.warehouseName)?.warehouse || supplierPurchases.find(p => p.warehouse || p.warehouseName)?.warehouseName || ''

        return {
            id: index + 1,
            supplierName,
            totalPurchases: supplierPurchases.length,
            purchaseValue,
            outstandingPayable: number(
                supplier.outstandingBalance || supplier.balance || supplier.balanceAmount || supplier.dueAmount,
            ),
            lastPurchaseDate,
            warehouseId: whId,
            warehouse: whName,
        }
    })

    return rows.sort((first, second) => second.purchaseValue - first.purchaseValue)
}

export function buildProfitabilityReport({ products = [], stock = [], sales = [], warehouses = [] }) {
    const productSales = salesByProduct(sales)
    const normalizedProducts = normalizeProducts(products, stock)

    return productSales.map((item, index) => {
        const product = normalizedProducts.find((row) => getProductName(row) === item.productName) || {}
        const stockRow = stock.find((s) => (s.productId || s.id) === (product.id || product.productId))
        const costValue = item.unitsSold * getProductCost(product)
        const salesValue = item.salesValue || item.unitsSold * getProductSalePrice(product)
        const grossProfit = salesValue - costValue
        const profitMargin = salesValue ? (grossProfit / salesValue) * 100 : 0

        return {
            id: index + 1,
            productName: item.productName,
            salesValue,
            costValue,
            grossProfit,
            profitMargin,
            warehouseId: product.warehouseId || stockRow?.warehouseId || '',
            warehouse: product.warehouse || product.warehouseName || stockRow?.warehouseName || stockRow?.warehouse || getWarehouseName(product, warehouses),
            status: profitMargin >= 25 ? 'Healthy' : profitMargin >= 10 ? 'Watch' : 'Critical',
        }
    })
}

export function buildCustomerOutstandingReport({ invoices = [], accountingInvoices = [], customers = [] }) {
    const rows = (accountingInvoices.length ? accountingInvoices : invoices).map((invoice, index) => {
        const invoiceAmount = number(invoice.invoiceAmount || invoice.totalAmount || invoice.amount || invoice.total)
        const paidAmount = number(invoice.paidAmount || invoice.paid || 0)
        const balanceAmount = number(invoice.balanceAmount || invoice.balance || invoiceAmount - paidAmount)
        const invoiceDate = invoice.invoiceDate || invoice.date || invoice.createdAt || ''
        const dueDate = invoice.dueDate || invoiceDate

        return {
            id: invoice.id || index + 1,
            customerName: getCustomerName(invoice) || customers[index]?.name || 'Customer',
            invoiceNumber: invoice.invoiceNumber || invoice.number || `INV-${index + 1}`,
            invoiceDate,
            dueDate,
            invoiceAmount,
            paidAmount,
            balanceAmount,
            warehouseId: invoice.warehouseId || '',
            warehouse: invoice.warehouse || invoice.warehouseName || invoice.location || '',
            agingStatus: getAgingStatus(dueDate),
        }
    })

    if (rows.length) return rows

    return customers.map((customer, index) => ({
        id: customer.id || index + 1,
        customerName: getCustomerName(customer),
        invoiceNumber: `BAL-${index + 1}`,
        invoiceDate: '',
        dueDate: '',
        invoiceAmount: number(customer.creditLimit || customer.totalAmount || customer.balance),
        paidAmount: 0,
        balanceAmount: number(customer.outstandingBalance || customer.balance || customer.balanceAmount || customer.dueAmount),
        warehouseId: customer.warehouseId || '',
        warehouse: customer.warehouse || customer.warehouseName || customer.location || '',
        agingStatus: '0-30 Days',
    }))
}

export function buildSupplierOutstandingReport({ purchases = [], suppliers = [] }) {
    const rows = purchases.map((purchase, index) => {
        const billAmount = getRowTotal(purchase)
        const paidAmount = number(
            purchase.paidAmount || purchase.paid || (String(purchase.status).toLowerCase() === 'paid' ? billAmount : 0),
        )
        const balanceAmount = number(purchase.balanceAmount || purchase.balance || billAmount - paidAmount)
        const billDate = purchase.billDate || purchase.orderDate || purchase.date || purchase.createdAt || ''
        const dueDate = purchase.dueDate || billDate

        return {
            id: purchase.id || index + 1,
            supplierName: getSupplierName(purchase),
            billNumber: purchase.billNumber || purchase.poNumber || purchase.number || `BILL-${index + 1}`,
            billDate,
            dueDate,
            billAmount,
            paidAmount,
            balanceAmount,
            warehouseId: purchase.warehouseId || '',
            warehouse: purchase.warehouse || purchase.warehouseName || purchase.location || '',
            agingStatus: getAgingStatus(dueDate),
        }
    })

    if (rows.length) return rows

    return suppliers.map((supplier, index) => ({
        id: supplier.id || index + 1,
        supplierName: getSupplierName(supplier),
        billNumber: `PAY-${index + 1}`,
        billDate: '',
        dueDate: '',
        invoiceAmount: number(supplier.totalAmount || supplier.balance),
        paidAmount: 0,
        balanceAmount: number(supplier.outstandingBalance || supplier.balance || supplier.balanceAmount || supplier.dueAmount),
        warehouseId: supplier.warehouseId || '',
        warehouse: supplier.warehouse || supplier.warehouseName || supplier.location || '',
        agingStatus: '0-30 Days',
    }))
}

export function buildGstReport({ sales = [], purchases = [] }) {
    const rows = new Map()

    function ensure(month) {
        if (!rows.has(month)) {
            rows.set(month, {
                id: month,
                month: getMonthLabel(month),
                taxableSales: 0,
                outputGst: 0,
                taxablePurchases: 0,
                inputGst: 0,
                netGstPayable: 0,
            })
        }

        return rows.get(month)
    }

    sales.forEach((sale) => {
        const month = getMonthKey(getRowDate(sale))
        const row = ensure(month)
        const taxable = getRowTotal(sale)

        row.taxableSales += taxable
        row.outputGst += number(sale.gst || sale.taxAmount || taxable * 0.18)
    })

    purchases.forEach((purchase) => {
        const month = getMonthKey(getRowDate(purchase))
        const row = ensure(month)
        const taxable = getRowTotal(purchase)

        row.taxablePurchases += taxable
        row.inputGst += number(purchase.gst || purchase.taxAmount || taxable * 0.18)
    })

    return [...rows.values()]
        .map((row) => ({
            ...row,
            netGstPayable: row.outputGst - row.inputGst,
        }))
        .sort((first, second) => first.id.localeCompare(second.id))
}

export function buildWarehousePerformanceReport({
    products = [],
    stock = [],
    warehouses = [],
    sales = [],
    purchases = [],
    returns = [],
}) {
    const inventory = buildInventoryValuationReport({ products, stock, warehouses })
    const lowStock = buildLowStockReport({ products, stock, warehouses })

    const warehouseNames = [
        ...new Set([
            ...warehouses.map((item) => item.name || item.warehouseName).filter(Boolean),
            ...inventory.map((item) => item.warehouse).filter(Boolean),
            'Main Warehouse',
        ]),
    ]

    return warehouseNames.map((warehouseName, index) => {
        const inventoryRows = inventory.filter((item) => item.warehouse === warehouseName || (!item.warehouse && index === 0))

        return {
            id: index + 1,
            warehouseName,
            stockValue: inventoryRows.reduce((total, item) => total + number(item.totalStockValue), 0),
            totalProducts: inventoryRows.length,
            lowStockItems: lowStock.filter((item) => item.warehouse === warehouseName && item.status !== 'Healthy').length,
            damagedItems: returns.filter(
                (item) => getWarehouseName(item) === warehouseName && String(item.status || item.reason).toLowerCase().includes('damage'),
            ).length,
            salesDispatches: sales.filter((item) => getWarehouseName(item) === warehouseName).length,
            purchaseReceipts: purchases.filter((item) => getWarehouseName(item) === warehouseName).length,
        }
    })
}

export function buildScheduledReports() {
    return [
        {
            id: 1,
            reportName: 'Daily Sales Summary',
            frequency: 'Daily',
            recipients: 'management@ims.com',
            format: 'PDF',
            status: 'Enabled',
        },
        {
            id: 2,
            reportName: 'Weekly Inventory Valuation',
            frequency: 'Weekly',
            recipients: 'inventory@ims.com',
            format: 'Excel',
            status: 'Enabled',
        },
        {
            id: 3,
            reportName: 'Monthly GST Filing Support',
            frequency: 'Monthly',
            recipients: 'accounts@ims.com',
            format: 'Excel',
            status: 'Disabled',
        },
    ]
}

export function buildForecastingReport({ products = [], stock = [], sales = [] }) {
    const fastMoving = buildFastMovingReport({ products, stock, sales })
    const lowStock = buildLowStockReport({ products, stock })

    const reorderCandidates = lowStock.filter((item) => item.status !== 'Healthy')

    return [
        {
            id: 1,
            insight: 'Expected Sales Trend',
            prediction: fastMoving[0]?.productName
                ? `${fastMoving[0].productName} is expected to continue leading sales.`
                : 'Sales trend will improve after more transactions.',
            priority: 'Medium',
            status: 'Watch',
        },
        {
            id: 2,
            insight: 'Expected Stock Shortage',
            prediction: reorderCandidates[0]?.productName
                ? `${reorderCandidates[0].productName} may face shortage soon.`
                : 'No major shortage predicted.',
            priority: reorderCandidates.length ? 'High' : 'Low',
            status: reorderCandidates.length ? 'Critical' : 'Healthy',
        },
        {
            id: 3,
            insight: 'Reorder Prediction',
            prediction: reorderCandidates.length ? `${reorderCandidates.length} items need reorder planning.` : 'Reorder levels are stable.',
            priority: reorderCandidates.length ? 'High' : 'Low',
            status: reorderCandidates.length ? 'Action Needed' : 'Healthy',
        },
        {
            id: 4,
            insight: 'Slow-moving Stock Warning',
            prediction: 'Review slow-moving items and plan discounts or supplier returns.',
            priority: 'Medium',
            status: 'Watch',
        },
    ]
}

export function buildReportsSummary({ products = [], stock = [], sales = [], purchases = [], customers = [], suppliers = [] }) {
    const inventoryValuation = buildInventoryValuationReport({ products, stock })
    const lowStockReport = buildLowStockReport({ products, stock })
    const fastMoving = buildFastMovingReport({ products, stock, sales })

    const totalInventoryValue = inventoryValuation.reduce((total, item) => total + number(item.totalStockValue), 0)
    const lowStockItems = lowStockReport.filter((item) => item.status === 'Critical' || item.status === 'Warning').length
    const totalSales = sales.reduce((total, item) => total + getRowTotal(item), 0)
    const totalPurchases = purchases.reduce((total, item) => total + getRowTotal(item), 0)
    const outstandingReceivables = customers.reduce(
        (total, item) => total + number(item.outstandingBalance || item.balance || item.balanceAmount || item.dueAmount),
        0,
    )
    const outstandingPayables = suppliers.reduce(
        (total, item) => total + number(item.outstandingBalance || item.balance || item.balanceAmount || item.dueAmount),
        0,
    )
    const grossProfit = totalSales - totalPurchases

    return {
        totalSales,
        totalPurchases,
        totalInventoryValue,
        lowStockItems,
        outstandingReceivables,
        outstandingPayables,
        grossProfit,
        topSellingItem: fastMoving[0]?.productName || 'No sales yet',
    }
}