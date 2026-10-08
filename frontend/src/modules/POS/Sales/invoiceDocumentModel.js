const EMPTY_VALUE = ''

const invoiceCurrencyFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== ''
}

function readPath(source, path) {
  if (!isRecord(source)) return undefined

  return String(path)
    .split('.')
    .reduce((value, key) => (isRecord(value) ? value[key] : undefined), source)
}

function firstValue(sources, paths, fallback = EMPTY_VALUE) {
  const sourceList = Array.isArray(sources) ? sources : [sources]

  for (const source of sourceList) {
    for (const path of paths) {
      const value = readPath(source, path)
      if (hasValue(value)) return value
    }
  }

  return fallback
}

function textValue(sources, paths, fallback = EMPTY_VALUE) {
  const value = firstValue(sources, paths, fallback)
  return hasValue(value) ? String(value).trim() : EMPTY_VALUE
}

function numericValue(sources, paths) {
  const value = firstValue(sources, paths, undefined)
  const parsed = Number(value)

  return {
    found: hasValue(value) && Number.isFinite(parsed),
    value: Number.isFinite(parsed) ? parsed : 0,
  }
}

function normalizeAddress(value) {
  if (!hasValue(value)) return EMPTY_VALUE

  if (Array.isArray(value)) {
    return value.map(normalizeAddress).filter(Boolean).join('\n')
  }

  if (!isRecord(value)) {
    return String(value)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n')
  }

  const street = [
    textValue(value, ['addressLine', 'AddressLine', 'addressLine1', 'AddressLine1', 'street', 'Street']),
    textValue(value, ['addressLine2', 'AddressLine2', 'landmark', 'Landmark']),
  ].filter(Boolean)
  const locality = [
    textValue(value, ['city', 'City']),
    textValue(value, ['state', 'State']),
    textValue(value, ['pincode', 'Pincode', 'postalCode', 'PostalCode', 'zipCode', 'ZipCode']),
  ].filter(Boolean).join(', ')
  const country = textValue(value, ['country', 'Country'])

  return [...street, locality, country].filter(Boolean).join('\n')
}

function findTypedAddress(customer, type) {
  const addresses = firstValue(customer, ['addresses', 'Addresses'], [])
  if (!Array.isArray(addresses)) return EMPTY_VALUE

  const normalizedType = type.toLowerCase()
  const match = addresses.find((address) => {
    const addressType = textValue(address, ['addressType', 'AddressType', 'type', 'Type'])
      .toLowerCase()
    return addressType.includes(normalizedType)
  })

  return normalizeAddress(match)
}

function buildPartyDetails(invoice, customer) {
  const billingAddress =
    normalizeAddress(firstValue(invoice, [
      'billingAddress',
      'BillingAddress',
      'customerBillingAddress',
      'CustomerBillingAddress',
      'billToAddress',
      'BillToAddress',
    ])) ||
    findTypedAddress(customer, 'billing') ||
    normalizeAddress(firstValue(customer, ['address', 'Address']))

  const shippingAddress =
    normalizeAddress(firstValue(invoice, [
      'shippingAddress',
      'ShippingAddress',
      'customerShippingAddress',
      'CustomerShippingAddress',
      'shipToAddress',
      'ShipToAddress',
    ])) ||
    findTypedAddress(customer, 'shipping')

  return {
    name: textValue(invoice, [
      'customerName',
      'CustomerName',
      'customer.name',
      'Customer.Name',
    ]) || textValue(customer, [
      'name',
      'Name',
    ]),
    companyName: textValue(invoice, [
      'customerCompanyName',
      'CustomerCompanyName',
      'customer.companyName',
      'Customer.CompanyName',
    ]) || textValue(customer, [
      'companyName',
      'CompanyName',
      'company',
      'Company',
    ]),
    email: textValue(invoice, [
      'customerEmail',
      'CustomerEmail',
      'customer.email',
      'Customer.Email',
    ]) || textValue(customer, [
      'email',
      'Email',
    ]),
    phone: textValue(invoice, [
      'customerPhone',
      'CustomerPhone',
      'customer.phone',
      'Customer.Phone',
    ]) || textValue(customer, [
      'phone',
      'Phone',
      'mobile',
      'Mobile',
    ]),
    gstNumber: textValue(invoice, [
      'customerGstin',
      'CustomerGstin',
      'customerGstNumber',
      'CustomerGstNumber',
      'customer.gstNumber',
      'Customer.GstNumber',
    ]) || textValue(customer, [
      'gstin',
      'GSTIN',
      'gstNumber',
      'GSTNumber',
      'taxNumber',
      'TaxNumber',
    ]),
    billingAddress,
    shippingAddress,
  }
}

function buildCompanyDetails(invoice, companyProfile) {
  const embeddedCompany = firstValue(invoice, [
    'companyDetails',
    'CompanyDetails',
    'seller',
    'Seller',
    'issuer',
    'Issuer',
    'business',
    'Business',
    'organization',
    'Organization',
  ], {})
  const sources = [companyProfile, embeddedCompany]

  return {
    name: textValue(sources, [
      'companyName',
      'CompanyName',
      'businessName',
      'BusinessName',
      'sellerName',
      'SellerName',
      'issuerName',
      'IssuerName',
      'name',
      'Name',
    ]) || textValue(invoice, [
      'companyName',
      'CompanyName',
      'businessName',
      'BusinessName',
      'sellerName',
      'SellerName',
      'issuerName',
      'IssuerName',
    ]),
    logoUrl: textValue(sources, [
      'companyLogo',
      'CompanyLogo',
      'logoUrl',
      'LogoUrl',
      'logo',
      'Logo',
      'imageUrl',
      'ImageUrl',
    ]) || textValue(invoice, [
      'companyLogo',
      'CompanyLogo',
      'companyLogoUrl',
      'CompanyLogoUrl',
      'sellerLogoUrl',
      'SellerLogoUrl',
    ]),
    address: normalizeAddress(firstValue(sources, [
      'companyAddress',
      'CompanyAddress',
      'businessAddress',
      'BusinessAddress',
      'sellerAddress',
      'SellerAddress',
      'address',
      'Address',
    ])) || normalizeAddress(firstValue(invoice, [
      'companyAddress',
      'CompanyAddress',
      'businessAddress',
      'BusinessAddress',
      'sellerAddress',
      'SellerAddress',
    ])),
    gstNumber: textValue(sources, [
      'companyGstin',
      'CompanyGstin',
      'companyGstNumber',
      'CompanyGstNumber',
      'gstin',
      'GSTIN',
      'gstNumber',
      'GSTNumber',
      'taxNumber',
      'TaxNumber',
    ]) || textValue(invoice, [
      'companyGstin',
      'CompanyGstin',
      'companyGstNumber',
      'CompanyGstNumber',
      'sellerGstin',
      'SellerGstin',
    ]),
    phone: textValue(sources, [
      'companyPhone',
      'CompanyPhone',
      'phoneNumber',
      'PhoneNumber',
      'phone',
      'Phone',
    ]) || textValue(invoice, [
      'companyPhone',
      'CompanyPhone',
      'sellerPhone',
      'SellerPhone',
    ]),
    email: textValue(sources, [
      'companyEmail',
      'CompanyEmail',
      'emailAddress',
      'EmailAddress',
      'email',
      'Email',
    ]) || textValue(invoice, [
      'companyEmail',
      'CompanyEmail',
      'sellerEmail',
      'SellerEmail',
    ]),
  }
}

function buildLineItem(item, index) {
  const quantity = numericValue(item, ['quantity', 'Quantity', 'qty', 'Qty']).value || 1
  const discountPercent = numericValue(item, [
    'discountPercent',
    'DiscountPercent',
    'discountPercentage',
    'DiscountPercentage',
    'discount',
    'Discount',
  ]).value
  const rawTaxPercent = numericValue(item, [
    'taxPercent',
    'TaxPercent',
    'taxPercentage',
    'TaxPercentage',
    'taxRate',
    'TaxRate',
    'gstRate',
    'GstRate',
    'tax',
    'Tax',
  ]).value

  const taxPercent = rawTaxPercent

  const rawUnitPriceSource = numericValue(item, ['unitPrice', 'UnitPrice'])
  const rawPriceSource = numericValue(item, ['price', 'Price', 'salePrice', 'SalePrice', 'rate', 'Rate'])
  const suppliedTotalSource = numericValue(item, [
    'total',
    'Total',
    'lineTotal',
    'LineTotal',
    'amount',
    'Amount',
    'netAmount',
    'NetAmount',
  ])

  let unitPrice = 0
  if (rawUnitPriceSource.found && rawUnitPriceSource.value > 0) {
    unitPrice = rawUnitPriceSource.value
  } else if (rawPriceSource.found && rawPriceSource.value > 0) {
    unitPrice = rawPriceSource.value
  } else if (suppliedTotalSource.found && suppliedTotalSource.value > 0 && quantity > 0) {
    unitPrice = suppliedTotalSource.value / quantity
  }

  const gross = quantity * unitPrice
  const discountAmountSource = numericValue(item, [
    'discountAmount',
    'DiscountAmount',
    'lineDiscount',
    'LineDiscount',
  ])
  const discountAmount = discountAmountSource.found
    ? discountAmountSource.value
    : gross * (discountPercent / 100)
  const taxableAmount = Math.max(0, gross - discountAmount)
  const taxAmountSource = numericValue(item, [
    'taxAmount',
    'TaxAmount',
    'gstAmount',
    'GstAmount',
    'lineTax',
    'LineTax',
  ])
  const taxAmount = taxAmountSource.found
    ? taxAmountSource.value
    : taxableAmount * (taxPercent / 100)
  const calculatedTotal = taxableAmount + taxAmount

  return {
    id: textValue(item, ['id', 'Id', 'invoiceItemId', 'InvoiceItemId']) || `line-${index + 1}`,
    serialNumber: index + 1,
    productName: textValue(item, [
      'productName',
      'ProductName',
      'name',
      'Name',
      'product.name',
      'Product.Name',
    ]),
    sku: textValue(item, [
      'productSku',
      'ProductSku',
      'sku',
      'Sku',
      'SKU',
      'product.sku',
      'Product.SKU',
      'hsn',
      'HSN',
      'hsnCode',
      'HsnCode',
    ]),
    quantity,
    unit: textValue(item, [
      'unit',
      'Unit',
      'unitName',
      'UnitName',
      'uom',
      'Uom',
      'UOM',
      'product.unit',
      'Product.Unit',
    ]),
    unitPrice,
    discountPercent,
    discountAmount,
    taxPercent,
    taxAmount,
    total: suppliedTotalSource.found && (suppliedTotalSource.value !== 0 || gross === 0)
      ? suppliedTotalSource.value
      : calculatedTotal,
  }
}

function buildAdditionalCharges(invoice) {
  const rows = []
  const rawCharges = firstValue(invoice, ['additionalChargeItems', 'AdditionalChargeItems', 'charges', 'Charges'], [])
  let hasDetailedCharges = false

  if (Array.isArray(rawCharges)) {
    rawCharges.forEach((charge, index) => {
      const amount = numericValue(charge, ['amount', 'Amount', 'value', 'Value'])
      if (!amount.found || amount.value === 0) return

      rows.push({
        key: textValue(charge, ['id', 'Id']) || `charge-${index + 1}`,
        label: textValue(charge, ['name', 'Name', 'label', 'Label', 'chargeType', 'ChargeType']) || 'Additional Charges',
        amount: amount.value,
      })
      hasDetailedCharges = true
    })
  }

  const knownCharges = [
    {
      key: 'shipping',
      label: 'Shipping Charges',
      paths: ['shippingCharges', 'ShippingCharges', 'shippingCharge', 'ShippingCharge', 'freightCharges', 'FreightCharges'],
    },
    {
      key: 'handling',
      label: 'Handling Charges',
      paths: ['handlingCharges', 'HandlingCharges', 'handlingCharge', 'HandlingCharge'],
    },
    {
      key: 'other',
      label: 'Other Charges',
      paths: ['otherCharges', 'OtherCharges', 'additionalCharges', 'AdditionalCharges'],
    },
    {
      key: 'round-off',
      label: 'Round Off',
      paths: ['roundOff', 'RoundOff', 'roundingAmount', 'RoundingAmount'],
    },
  ]

  knownCharges.forEach(({ key, label, paths }) => {
    if (key === 'other' && hasDetailedCharges) return
    const amount = numericValue(invoice, paths)
    if (amount.found && amount.value !== 0 && !rows.some((row) => row.key === key)) {
      rows.push({ key, label, amount: amount.value })
    }
  })

  return rows
}

function normalizeTerms(value) {
  if (!hasValue(value)) return []

  const values = Array.isArray(value) ? value : String(value).split(/\r?\n/)
  return values
    .map((term) => (isRecord(term) ? textValue(term, ['text', 'Text', 'value', 'Value', 'description', 'Description']) : String(term).trim()))
    .filter(Boolean)
}

function resolveStatus(invoice, total, paid, balance) {
  const suppliedStatus = textValue(invoice, ['status', 'Status', 'paymentStatus', 'PaymentStatus'])
  const normalized = suppliedStatus.toLowerCase()

  if (normalized.includes('partial')) return 'Partially Paid'
  if (normalized.includes('unpaid')) return 'Unpaid'
  if (normalized.includes('paid')) return 'Paid'
  if (paid > 0 && balance > 0) return 'Partially Paid'
  if (total > 0 && balance <= 0) return 'Paid'
  return 'Unpaid'
}

export function buildInvoiceDocumentModel(invoice = {}, options = {}) {
  const customer = options.customer || {}
  const companyProfile = options.companyProfile || {}
  const rawItems = Array.isArray(invoice.items)
    ? invoice.items.map(buildLineItem)
    : []

  const headerTotalSource = numericValue(invoice, [
    'totalAmount',
    'TotalAmount',
    'grandTotal',
    'GrandTotal',
    'netAmount',
    'NetAmount',
  ])

  // Filter phantom/extra items if invoice header total explicitly specifies a total matching a subset
  let items = rawItems
  if (headerTotalSource.found && headerTotalSource.value > 0 && rawItems.length > 1) {
    const sumAll = rawItems.reduce((s, item) => s + item.total, 0)
    if (Math.abs(sumAll - headerTotalSource.value) > 0.05) {
      const exactMatch = rawItems.filter((item) => Math.abs(item.total - headerTotalSource.value) < 0.05)
      if (exactMatch.length > 0) {
        items = exactMatch.map((it, idx) => ({ ...it, serialNumber: idx + 1 }))
      }
    }
  }

  const additionalCharges = buildAdditionalCharges(invoice)
  const lineSubtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
  const lineDiscount = items.reduce((sum, item) => sum + item.discountAmount, 0)
  const lineTax = items.reduce((sum, item) => sum + item.taxAmount, 0)
  const chargeTotal = additionalCharges.reduce((sum, charge) => sum + charge.amount, 0)
  const calculatedGrandTotal = lineSubtotal - lineDiscount + lineTax + chargeTotal

  const subtotal = lineSubtotal
  const discount = lineDiscount
  const tax = lineTax
  const grandTotal = headerTotalSource.found && headerTotalSource.value > 0 && Math.abs(headerTotalSource.value - calculatedGrandTotal) < 0.05
    ? headerTotalSource.value
    : (headerTotalSource.found && headerTotalSource.value > 0 && items.length === 1 ? headerTotalSource.value : calculatedGrandTotal)

  const paidSource = numericValue(invoice, ['paidAmount', 'PaidAmount', 'amountPaid', 'AmountPaid'])
  const paidAmount = paidSource.value
  const balanceSource = numericValue(invoice, [
    'balanceAmount',
    'BalanceAmount',
    'balanceDue',
    'BalanceDue',
    'amountDue',
    'AmountDue',
    'outstandingAmount',
    'OutstandingAmount',
  ])
  const balanceAmount = balanceSource.found
    ? balanceSource.value
    : Math.max(0, grandTotal - paidAmount)
  const invoiceNumber = textValue(invoice, [
    'invoiceNumber',
    'InvoiceNumber',
    'invoiceNo',
    'InvoiceNo',
    'number',
    'Number',
  ]) || textValue(invoice, ['invoiceId', 'InvoiceId', 'id', 'Id'])

  return {
    id: textValue(invoice, ['invoiceId', 'InvoiceId', 'id', 'Id']),
    invoiceNumber,
    invoiceDate: textValue(invoice, ['invoiceDate', 'InvoiceDate', 'date', 'Date']),
    dueDate: textValue(invoice, ['dueDate', 'DueDate']),
    paymentStatus: resolveStatus(invoice, grandTotal, paidAmount, balanceAmount),
    reference: textValue(invoice, ['referenceNumber', 'ReferenceNumber', 'reference', 'Reference']),
    company: buildCompanyDetails(invoice, companyProfile),
    customer: buildPartyDetails(invoice, customer),
    items,
    summary: {
      subtotal,
      discount,
      tax,
      additionalCharges,
      paidAmount,
      balanceAmount,
      grandTotal,
    },
    paymentTerms: textValue(invoice, ['paymentTerms', 'PaymentTerms', 'paymentTerm', 'PaymentTerm']),
    terms: normalizeTerms(firstValue(invoice, [
      'termsAndConditions',
      'TermsAndConditions',
      'terms',
      'Terms',
      'invoiceTerms',
      'InvoiceTerms',
    ])),
    notes: textValue(invoice, ['notes', 'Notes', 'remarks', 'Remarks']),
    authorizedBy: textValue(invoice, [
      'authorizedBy',
      'AuthorizedBy',
      'authorizedSignatory',
      'AuthorizedSignatory',
      'approvedBy',
      'ApprovedBy',
    ]),
    signatureUrl: textValue(invoice, [
      'signatureUrl',
      'SignatureUrl',
      'authorizedSignatureUrl',
      'AuthorizedSignatureUrl',
    ]),
  }
}

export function validateInvoiceDocumentModel(model) {
  if (!model?.invoiceNumber) {
    return 'Invoice number is unavailable. The invoice was not generated.'
  }

  if (!Array.isArray(model.items) || model.items.length === 0) {
    return 'Invoice item details are unavailable. The invoice was not generated.'
  }

  return EMPTY_VALUE
}

export function formatInvoiceCurrency(value) {
  const amount = Number(value)
  return `INR ${invoiceCurrencyFormatter.format(Number.isFinite(amount) ? amount : 0)}`
}
