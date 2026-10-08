import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { formatInvoiceCurrency } from './invoiceDocumentModel.js'

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const PAGE_MARGIN = 12
const CONTENT_WIDTH = PAGE_WIDTH - (PAGE_MARGIN * 2)
const COLORS = {
  primary: [5, 150, 105],
  primarySoft: [204, 251, 241],
  ink: [15, 23, 42],
  muted: [148, 163, 184],
  border: [226, 232, 240],
  borderLight: [241, 245, 249],
  surface: [248, 250, 252],
  success: [22, 163, 74],
  successSoft: [240, 253, 244],
  successBorder: [187, 247, 208],
  warning: [217, 119, 6],
  warningSoft: [255, 247, 237],
  warningBorder: [254, 215, 170],
  danger: [220, 38, 38],
  dangerSoft: [254, 242, 242],
  dangerBorder: [254, 202, 202],
  white: [255, 255, 255],
}

const pdfDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
})

function formatPdfDate(value) {
  if (!value) return ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number)
    return pdfDateFormatter.format(new Date(year, month - 1, day))
  }
  return pdfDateFormatter.format(new Date(value))
}

function safeFilename(value) {
  const cleanValue = String(value || 'invoice')
    .trim()
    .split('')
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('')
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '-')

  return `${cleanValue || 'invoice'}.pdf`
}

function getInitials(value) {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Unable to read the company logo.'))
    reader.readAsDataURL(blob)
  })
}

async function loadImageData(url) {
  if (!url) return ''
  if (url.startsWith('data:')) return url

  try {
    const response = await fetch(url, { credentials: 'include' })
    if (!response.ok) return ''
    return await readBlobAsDataUrl(await response.blob())
  } catch {
    return ''
  }
}

function splitLines(doc, value, maxWidth) {
  if (!value) return []
  return String(value)
    .split(/\r?\n/)
    .flatMap((line) => doc.splitTextToSize(line, maxWidth))
    .filter(Boolean)
}

function formatSummaryCurrency(value) {
  const amount = Number(value) || 0
  return amount < 0
    ? `- ${formatInvoiceCurrency(Math.abs(amount))}`
    : formatInvoiceCurrency(amount)
}

function drawLogo(doc, model, imageData, x, y) {
  if (imageData) {
    try {
      doc.addImage(imageData, x, y, 16, 16, undefined, 'FAST')
      return
    } catch {
      // Fall through to the API-backed company initials.
    }
  }

  const initials = getInitials(model.company.name)
  if (!initials) return

  doc.setFillColor(...COLORS.primary)
  doc.roundedRect(x, y, 16, 16, 2, 2, 'F')
  doc.setTextColor(...COLORS.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text(initials, x + 8, y + 9.8, { align: 'center' })
}

function drawHeader(doc, model, imageData) {
  const logoOffset = model.company.logoUrl || model.company.name ? 20 : 0
  drawLogo(doc, model, imageData, PAGE_MARGIN, PAGE_MARGIN)

  const companyX = PAGE_MARGIN + logoOffset
  const companyWidth = 96 - logoOffset
  let companyY = PAGE_MARGIN + 3

  if (model.company.name) {
    doc.setTextColor(...COLORS.ink)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    const nameLines = splitLines(doc, model.company.name, companyWidth)
    doc.text(nameLines.slice(0, 2), companyX, companyY)
    companyY += Math.min(nameLines.length, 2) * 5
  }

  doc.setTextColor(...COLORS.muted)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.8)
  const companyLines = [
    ...splitLines(doc, model.company.address, companyWidth),
    model.company.gstNumber ? `GSTIN: ${model.company.gstNumber}` : '',
    model.company.phone ? `Phone: ${model.company.phone}` : '',
    model.company.email ? `Email: ${model.company.email}` : '',
  ].filter(Boolean).slice(0, 6)
  if (companyLines.length > 0) {
    doc.text(companyLines, companyX, companyY)
  }

  doc.setTextColor(...COLORS.muted)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.text('ORIGINAL FOR RECIPIENT', PAGE_WIDTH - PAGE_MARGIN, PAGE_MARGIN + 1, { align: 'right' })
  doc.setTextColor(...COLORS.ink)
  doc.setFontSize(18)
  doc.text('TAX INVOICE', PAGE_WIDTH - PAGE_MARGIN, PAGE_MARGIN + 9, { align: 'right' })

  const statusWidth = Math.max(25, doc.getTextWidth(model.paymentStatus.toUpperCase()) + 8)
  const statusX = PAGE_WIDTH - PAGE_MARGIN - statusWidth
  const normalizedStatus = model.paymentStatus.toLowerCase()
  const statusColors = normalizedStatus.includes('partial')
    ? {
        border: COLORS.warningBorder,
        fill: COLORS.warningSoft,
        text: COLORS.warning,
      }
    : normalizedStatus.includes('unpaid')
      ? {
          border: COLORS.dangerBorder,
          fill: COLORS.dangerSoft,
          text: COLORS.danger,
        }
      : {
          border: COLORS.successBorder,
          fill: COLORS.successSoft,
          text: COLORS.success,
        }
  doc.setDrawColor(...statusColors.border)
  doc.setFillColor(...statusColors.fill)
  doc.roundedRect(statusX, PAGE_MARGIN + 12, statusWidth, 7, 3.5, 3.5, 'FD')
  doc.setTextColor(...statusColors.text)
  doc.setFontSize(6.5)
  doc.text(model.paymentStatus.toUpperCase(), statusX + (statusWidth / 2), PAGE_MARGIN + 16.6, { align: 'center' })

  doc.setDrawColor(...COLORS.primary)
  doc.setLineWidth(0.55)
  doc.line(PAGE_MARGIN, 43, PAGE_WIDTH - PAGE_MARGIN, 43)

  return 48
}

function drawMetadata(doc, model, y) {
  const fields = [
    ['INVOICE NUMBER', model.invoiceNumber],
    model.invoiceDate ? ['INVOICE DATE', formatPdfDate(model.invoiceDate)] : null,
    model.dueDate ? ['DUE DATE', formatPdfDate(model.dueDate)] : null,
    model.reference ? ['REFERENCE', model.reference] : null,
  ].filter(Boolean)
  const fieldWidth = CONTENT_WIDTH / fields.length

  doc.setDrawColor(...COLORS.border)
  doc.setFillColor(...COLORS.primarySoft)
  doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 14, 1.5, 1.5, 'FD')

  fields.forEach(([label, value], index) => {
    const x = PAGE_MARGIN + (fieldWidth * index)
    if (index > 0) doc.line(x, y, x, y + 14)

    doc.setTextColor(...COLORS.muted)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.8)
    doc.text(label, x + 3, y + 4.5)
    doc.setTextColor(...COLORS.ink)
    doc.setFontSize(7.5)
    const valueLines = splitLines(doc, value, fieldWidth - 6)
    doc.text(valueLines.slice(0, 1), x + 3, y + 9.5)
  })

  return y + 19
}

function getPartyLines(party, address) {
  return [
    party.companyName,
    party.name && party.name !== party.companyName ? party.name : '',
    address,
    party.gstNumber ? `GSTIN: ${party.gstNumber}` : '',
    party.phone ? `Phone: ${party.phone}` : '',
    party.email ? `Email: ${party.email}` : '',
  ].filter(Boolean)
}

function drawAddressBox(doc, title, party, address, x, y, width, height) {
  doc.setDrawColor(...COLORS.border)
  doc.roundedRect(x, y, width, height, 1.5, 1.5, 'S')
  doc.setTextColor(...COLORS.primary)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.text(title.toUpperCase(), x + 3, y + 5)

  const lines = getPartyLines(party, address)
    .flatMap((line) => splitLines(doc, line, width - 6))
    .slice(0, 7)

  doc.setTextColor(...COLORS.ink)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.8)
  doc.text(lines.length > 0 ? lines : ['Details unavailable'], x + 3, y + 10)
}

function drawAddresses(doc, model, y) {
  const hasShipping = Boolean(model.customer.shippingAddress)
  const gap = 4
  const width = hasShipping ? (CONTENT_WIDTH - gap) / 2 : CONTENT_WIDTH
  const billingLines = getPartyLines(model.customer, model.customer.billingAddress).length
  const shippingLines = getPartyLines(model.customer, model.customer.shippingAddress).length
  const height = Math.max(23, Math.min(34, 12 + (Math.max(billingLines, shippingLines) * 3.5)))

  drawAddressBox(doc, 'Bill To', model.customer, model.customer.billingAddress, PAGE_MARGIN, y, width, height)
  if (hasShipping) {
    drawAddressBox(
      doc,
      'Ship To',
      model.customer,
      model.customer.shippingAddress,
      PAGE_MARGIN + width + gap,
      y,
      width,
      height,
    )
  }

  return y + height + 5
}

function percentageText(rate) {
  return Number(rate) === 0 ? '' : `\n${Number(rate).toLocaleString('en-IN')}%`
}

function drawItemsTable(doc, model, startY) {
  autoTable(doc, {
    startY,
    margin: { top: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 15, left: PAGE_MARGIN },
    tableWidth: CONTENT_WIDTH,
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    pageBreak: 'auto',
    theme: 'grid',
    head: [[
      'S.NO.',
      'PRODUCT NAME',
      'SKU',
      'QTY',
      'UNIT',
      'UNIT PRICE',
      'DISCOUNT',
      'TAX',
      'TOTAL',
    ]],
    body: model.items.map((item) => [
      String(item.serialNumber),
      item.productName || '-',
      item.sku || '-',
      item.quantity.toLocaleString('en-IN'),
      item.unit || '-',
      formatInvoiceCurrency(item.unitPrice),
      `${formatInvoiceCurrency(item.discountAmount)}${percentageText(item.discountPercent)}`,
      `${formatInvoiceCurrency(item.taxAmount)}${percentageText(item.taxPercent)}`,
      formatInvoiceCurrency(item.total),
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 5.8,
      cellPadding: { top: 2.2, right: 1.3, bottom: 2.2, left: 1.3 },
      lineColor: COLORS.border,
      lineWidth: 0.15,
      textColor: COLORS.ink,
      overflow: 'linebreak',
      valign: 'top',
    },
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 5.3,
      lineColor: COLORS.primary,
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: COLORS.surface,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 39, fontStyle: 'bold' },
      2: { cellWidth: 19 },
      3: { cellWidth: 13, halign: 'right' },
      4: { cellWidth: 12 },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 25, halign: 'right' },
      7: { cellWidth: 22, halign: 'right' },
      8: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
    },
  })

  return doc.lastAutoTable.finalY
}

function ensureSpace(doc, y, requiredHeight) {
  if (y + requiredHeight <= PAGE_HEIGHT - 16) return y
  doc.addPage()
  return PAGE_MARGIN
}

function drawPaymentAndTotals(doc, model, startY) {
  const totalRows = [
    ['Subtotal', model.summary.subtotal],
    ['Discount', -Math.abs(model.summary.discount)],
    ['Tax / GST', model.summary.tax],
    ...model.summary.additionalCharges.map((charge) => [charge.label, charge.amount]),
    ['Amount Paid', model.summary.paidAmount],
    ['Balance Amount', model.summary.balanceAmount],
  ]
  const rowHeight = 6
  const totalsHeight = (totalRows.length * rowHeight) + 10
  const y = ensureSpace(doc, startY + 5, Math.max(26, totalsHeight))
  const leftWidth = 80
  const rightWidth = 78
  const rightX = PAGE_WIDTH - PAGE_MARGIN - rightWidth

  doc.setDrawColor(...COLORS.border)
  doc.roundedRect(PAGE_MARGIN, y, leftWidth, 26, 1.5, 1.5, 'S')
  doc.setTextColor(...COLORS.primary)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.text('PAYMENT SUMMARY', PAGE_MARGIN + 3, y + 5)

  const paymentColumns = [
    ['AMOUNT PAID', formatInvoiceCurrency(model.summary.paidAmount)],
    ['BALANCE AMOUNT', formatInvoiceCurrency(model.summary.balanceAmount)],
  ]
  paymentColumns.forEach(([label, value], index) => {
    const x = PAGE_MARGIN + 3 + (index * 38)
    doc.setTextColor(...COLORS.muted)
    doc.setFontSize(5.5)
    doc.text(label, x, y + 12)
    doc.setTextColor(...COLORS.ink)
    doc.setFontSize(7.5)
    doc.text(value, x, y + 18)
  })

  doc.setDrawColor(...COLORS.border)
  doc.roundedRect(rightX, y, rightWidth, totalsHeight, 1.5, 1.5, 'S')

  totalRows.forEach(([label, value], index) => {
    const rowY = y + 4.5 + (index * rowHeight)
    if (index > 0) doc.line(rightX, rowY - 3.5, rightX + rightWidth, rowY - 3.5)
    doc.setTextColor(...COLORS.muted)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.text(label, rightX + 3, rowY)
    doc.setTextColor(...COLORS.ink)
    doc.setFont('helvetica', 'bold')
    doc.text(formatSummaryCurrency(value), rightX + rightWidth - 3, rowY, { align: 'right' })
  })

  const grandY = y + (totalRows.length * rowHeight)
  doc.setFillColor(...COLORS.primary)
  doc.roundedRect(rightX, grandY, rightWidth, 10, 1.5, 1.5, 'F')
  doc.setTextColor(...COLORS.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.text('Grand Total', rightX + 3, grandY + 6.3)
  doc.text(
    formatInvoiceCurrency(model.summary.grandTotal),
    rightX + rightWidth - 3,
    grandY + 6.3,
    { align: 'right' },
  )

  return Math.max(y + 26, grandY + 10)
}

function drawTermsAndSignature(doc, model, startY, signatureData) {
  const termLines = [
    model.paymentTerms ? `Payment terms: ${model.paymentTerms}` : '',
    ...model.terms,
    model.notes ? `Notes: ${model.notes}` : '',
  ].filter(Boolean)
  const termTextLines = termLines.flatMap((line, index) => (
    splitLines(doc, `${index + 1}. ${line}`, 112)
  ))
  const sectionHeight = Math.max(30, 13 + (termTextLines.length * 3.5))
  const y = ensureSpace(doc, startY + 7, sectionHeight)

  if (termTextLines.length > 0) {
    doc.setTextColor(...COLORS.primary)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.text('TERMS AND CONDITIONS', PAGE_MARGIN, y + 5)
    doc.setTextColor(...COLORS.muted)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.3)
    doc.text(termTextLines, PAGE_MARGIN, y + 10)
  }

  const signatureWidth = 55
  const signatureX = PAGE_WIDTH - PAGE_MARGIN - signatureWidth
  const signatureLineY = y + sectionHeight - 11
  if (signatureData) {
    try {
      doc.addImage(
        signatureData,
        signatureX + ((signatureWidth - 30) / 2),
        signatureLineY - 12,
        30,
        10,
        undefined,
        'FAST',
      )
    } catch {
      // Keep the signature line when an optional image cannot be rendered.
    }
  }
  doc.setDrawColor(...COLORS.muted)
  doc.line(signatureX, signatureLineY, signatureX + signatureWidth, signatureLineY)
  doc.setTextColor(...COLORS.ink)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.8)
  doc.text(model.authorizedBy || 'Authorized Signatory', signatureX + (signatureWidth / 2), signatureLineY + 5, { align: 'center' })
  if (model.company.name) {
    doc.setTextColor(...COLORS.muted)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.8)
    doc.text(`For ${model.company.name}`, signatureX + (signatureWidth / 2), signatureLineY + 9, { align: 'center' })
  }
}

function drawPageFooters(doc, model) {
  const pageCount = doc.getNumberOfPages()

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber)
    doc.setDrawColor(...COLORS.border)
    doc.setLineWidth(0.2)
    doc.line(PAGE_MARGIN, PAGE_HEIGHT - 10, PAGE_WIDTH - PAGE_MARGIN, PAGE_HEIGHT - 10)
    doc.setTextColor(...COLORS.muted)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.8)
    doc.text(`Invoice ${model.invoiceNumber}`, PAGE_MARGIN, PAGE_HEIGHT - 6)
    doc.text(`Page ${pageNumber} of ${pageCount}`, PAGE_WIDTH - PAGE_MARGIN, PAGE_HEIGHT - 6, { align: 'right' })
  }
}

export async function createProfessionalInvoicePdf(model) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
    putOnlyUsedFonts: true,
  })
  doc.setProperties({
    title: `Tax Invoice ${model.invoiceNumber}`,
    subject: 'Tax Invoice',
    creator: model.company.name || 'Invoice System',
  })

  const [logoData, signatureData] = await Promise.all([
    loadImageData(model.company.logoUrl),
    loadImageData(model.signatureUrl),
  ])
  let y = drawHeader(doc, model, logoData)
  y = drawMetadata(doc, model, y)
  y = drawAddresses(doc, model, y)
  y = drawItemsTable(doc, model, y)
  y = drawPaymentAndTotals(doc, model, y)
  drawTermsAndSignature(doc, model, y, signatureData)
  drawPageFooters(doc, model)

  return doc
}

export async function downloadProfessionalInvoicePdf(model) {
  const doc = await createProfessionalInvoicePdf(model)
  doc.save(safeFilename(model.invoiceNumber))
}
