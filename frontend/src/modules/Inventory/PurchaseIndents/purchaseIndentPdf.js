import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import {
  formatPurchaseIndentCurrency,
  getPurchaseIndentPdfFilename,
} from './purchaseIndentDocumentModel.js'

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
  if (!value) return '-'

  try {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      const [year, month, day] = value.slice(0, 10).split('-').map(Number)
      return pdfDateFormatter.format(new Date(year, month - 1, day))
    }

    return pdfDateFormatter.format(new Date(value))
  } catch {
    return '-'
  }
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

function drawLogo(doc, model, imageData, x, y) {
  if (imageData) {
    try {
      doc.addImage(imageData, x, y, 16, 16, undefined, 'FAST')
      return
    } catch {
      // Fall through to company initials when an image cannot be rendered.
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

function getStatusColors(status) {
  const normalizedStatus = String(status || '').toLowerCase()

  if (normalizedStatus.includes('reject') || normalizedStatus.includes('cancel')) {
    return {
      border: COLORS.dangerBorder,
      fill: COLORS.dangerSoft,
      text: COLORS.danger,
    }
  }

  if (normalizedStatus.includes('approved') || normalizedStatus.includes('converted') || normalizedStatus.includes('ordered')) {
    return {
      border: COLORS.successBorder,
      fill: COLORS.successSoft,
      text: COLORS.success,
    }
  }

  return {
    border: COLORS.warningBorder,
    fill: COLORS.warningSoft,
    text: COLORS.warning,
  }
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
  doc.text('INTERNAL PURCHASE REQUISITION', PAGE_WIDTH - PAGE_MARGIN, PAGE_MARGIN + 1, { align: 'right' })
  doc.setTextColor(...COLORS.ink)
  doc.setFontSize(17)
  doc.text('PURCHASE INDENT', PAGE_WIDTH - PAGE_MARGIN, PAGE_MARGIN + 9, { align: 'right' })

  const statusLabel = String(model.status || 'Pending').toUpperCase()
  const statusWidth = Math.max(25, doc.getTextWidth(statusLabel) + 8)
  const statusX = PAGE_WIDTH - PAGE_MARGIN - statusWidth
  const statusColors = getStatusColors(model.status)
  doc.setDrawColor(...statusColors.border)
  doc.setFillColor(...statusColors.fill)
  doc.roundedRect(statusX, PAGE_MARGIN + 12, statusWidth, 7, 3.5, 3.5, 'FD')
  doc.setTextColor(...statusColors.text)
  doc.setFontSize(6.5)
  doc.text(statusLabel, statusX + (statusWidth / 2), PAGE_MARGIN + 16.6, { align: 'center' })

  doc.setDrawColor(...COLORS.primary)
  doc.setLineWidth(0.55)
  doc.line(PAGE_MARGIN, 43, PAGE_WIDTH - PAGE_MARGIN, 43)

  return 48
}

function drawMetadata(doc, model, y) {
  const fields = [
    ['INDENT NUMBER', model.indentNumber],
    model.indentDate ? ['REQUEST DATE', formatPdfDate(model.indentDate)] : null,
    model.requiredDate ? ['REQUIRED DATE', formatPdfDate(model.requiredDate)] : null,
    ['PRIORITY', model.priority || '-'],
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
    doc.text(splitLines(doc, value, fieldWidth - 6).slice(0, 1), x + 3, y + 9.5)
  })

  return y + 19
}

function getSupplierLines(supplier) {
  const displayName = supplier.companyName || supplier.name || ''
  const contactPerson = supplier.name && supplier.name !== supplier.companyName ? supplier.name : ''

  return [
    displayName ? `Name: ${displayName}` : '',
    contactPerson ? `Contact: ${contactPerson}` : '',
    supplier.gstNumber ? `GSTIN: ${supplier.gstNumber}` : '',
    supplier.phone ? `Phone: ${supplier.phone}` : '',
    supplier.email ? `Email: ${supplier.email}` : '',
    supplier.address ? `Address: ${supplier.address}` : '',
  ].filter(Boolean)
}

function drawInformationBox(doc, title, lines, x, y, width, height) {
  doc.setDrawColor(...COLORS.border)
  doc.roundedRect(x, y, width, height, 1.5, 1.5, 'S')
  doc.setTextColor(...COLORS.primary)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.text(title.toUpperCase(), x + 3, y + 5)

  const wrappedLines = lines
    .flatMap((line) => splitLines(doc, line, width - 6))
    .slice(0, 7)

  doc.setTextColor(...COLORS.ink)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.8)
  doc.text(wrappedLines.length > 0 ? wrappedLines : ['Details unavailable'], x + 3, y + 10)
}

function drawIndentParties(doc, model, y) {
  const supplierLines = getSupplierLines(model.supplier)
  const indentLines = [
    model.department || 'Department not assigned',
    model.requestedBy ? `Requested by: ${model.requestedBy}` : '',
    model.requiredDate ? `Required by: ${formatPdfDate(model.requiredDate)}` : '',
    model.reference ? `Reference: ${model.reference}` : '',
  ].filter(Boolean)
  const gap = 4
  const width = (CONTENT_WIDTH - gap) / 2
  const maxLineCount = Math.max(supplierLines.length, indentLines.length)
  const height = Math.max(23, Math.min(34, 12 + (maxLineCount * 3.5)))

  drawInformationBox(doc, 'Supplier', supplierLines, PAGE_MARGIN, y, width, height)
  drawInformationBox(doc, 'Indent Information', indentLines, PAGE_MARGIN + width + gap, y, width, height)

  return y + height + 5
}

function itemCurrency(available, value) {
  return available ? formatPurchaseIndentCurrency(value) : '-'
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
      'AVAILABLE',
      'QTY',
      'UNIT',
      'RATE',
      'AMOUNT',
      'REQUIRED DATE',
    ]],
    body: model.items.map((item) => [
      String(item.serialNumber),
      item.notes ? `${item.productName || '-'}\nJustification: ${item.notes}` : item.productName || '-',
      item.sku || '-',
      item.availableStock === '' ? '-' : String(item.availableStock),
      (Number(item.quantity) || 0).toLocaleString('en-IN'),
      item.unit || '-',
      itemCurrency(item.hasUnitPrice, item.unitPrice),
      itemCurrency(item.hasAmount, item.amount),
      formatPdfDate(item.requiredDate),
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 5.7,
      cellPadding: { top: 2.2, right: 1.2, bottom: 2.2, left: 1.2 },
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
      fontSize: 5.1,
      lineColor: COLORS.primary,
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: COLORS.surface,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 38, fontStyle: 'bold' },
      2: { cellWidth: 18 },
      3: { cellWidth: 15, halign: 'right' },
      4: { cellWidth: 13, halign: 'right' },
      5: { cellWidth: 12 },
      6: { cellWidth: 21, halign: 'right' },
      7: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
      8: { cellWidth: 36 },
    },
  })

  return doc.lastAutoTable.finalY
}

function ensureSpace(doc, y, requiredHeight) {
  if (y + requiredHeight <= PAGE_HEIGHT - 16) return y
  doc.addPage()
  return PAGE_MARGIN
}

function drawSummary(doc, model, startY) {
  const y = ensureSpace(doc, startY + 5, 31)
  const leftWidth = 80
  const rightWidth = 78
  const rightX = PAGE_WIDTH - PAGE_MARGIN - rightWidth

  doc.setDrawColor(...COLORS.border)
  doc.roundedRect(PAGE_MARGIN, y, leftWidth, 26, 1.5, 1.5, 'S')
  doc.setTextColor(...COLORS.primary)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.text('REQUISITION SUMMARY', PAGE_MARGIN + 3, y + 5)

  const overviewColumns = [
    ['TOTAL ITEMS', (Number(model.summary.itemCount) || 0).toLocaleString('en-IN')],
    ['TOTAL QUANTITY', (Number(model.summary.totalQuantity) || 0).toLocaleString('en-IN')],
  ]
  overviewColumns.forEach(([label, value], index) => {
    const x = PAGE_MARGIN + 3 + (index * 38)
    doc.setTextColor(...COLORS.muted)
    doc.setFontSize(5.5)
    doc.text(label, x, y + 12)
    doc.setTextColor(...COLORS.ink)
    doc.setFontSize(7.5)
    doc.text(value, x, y + 18)
  })

  doc.setFillColor(...COLORS.primary)
  doc.roundedRect(rightX, y, rightWidth, 26, 1.5, 1.5, 'F')
  doc.setTextColor(...COLORS.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('Estimated Value', rightX + 6, y + 15)
  doc.text(
    model.summary.hasEstimatedValue
      ? formatPurchaseIndentCurrency(model.summary.estimatedValue)
      : '-',
    rightX + rightWidth - 6,
    y + 15,
    { align: 'right' },
  )

  return y + 26
}

function drawApprovalActivity(doc, model, startY) {
  const y = ensureSpace(doc, startY + 7, 31)
  const activities = model.approvalActivity
  const columnWidth = CONTENT_WIDTH / activities.length

  doc.setTextColor(...COLORS.primary)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.text('APPROVAL ACTIVITY', PAGE_MARGIN, y + 5)
  doc.setDrawColor(...COLORS.border)
  doc.roundedRect(PAGE_MARGIN, y + 8, CONTENT_WIDTH, 21, 1.5, 1.5, 'S')

  activities.forEach((activity, index) => {
    const x = PAGE_MARGIN + (columnWidth * index)
    if (index > 0) doc.line(x, y + 8, x, y + 29)

    doc.setTextColor(...COLORS.muted)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.4)
    doc.text(activity.label.toUpperCase(), x + 2.5, y + 13)
    doc.setTextColor(...COLORS.ink)
    doc.setFontSize(6.1)
    doc.text(splitLines(doc, activity.person || '-', columnWidth - 5).slice(0, 2), x + 2.5, y + 18)
    doc.setTextColor(...COLORS.muted)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.3)
    doc.text(formatPdfDate(activity.date), x + 2.5, y + 26)
  })

  return y + 29
}

function drawNotesAndSignature(doc, model, startY, signatureData) {
  const noteLines = [
    model.remarks ? `Remarks: ${model.remarks}` : '',
    ...model.terms,
  ].filter(Boolean)
  const wrappedNoteLines = noteLines.flatMap((line, index) => (
    splitLines(doc, `${index + 1}. ${line}`, 112)
  ))
  const sectionHeight = Math.max(30, 13 + (wrappedNoteLines.length * 3.5))
  const y = ensureSpace(doc, startY + 7, sectionHeight)

  if (wrappedNoteLines.length > 0) {
    doc.setTextColor(...COLORS.primary)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.text('NOTES AND TERMS', PAGE_MARGIN, y + 5)
    doc.setTextColor(...COLORS.muted)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.3)
    doc.text(wrappedNoteLines, PAGE_MARGIN, y + 10)
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
  doc.text(
    model.authorizedBy || 'Authorized Signatory',
    signatureX + (signatureWidth / 2),
    signatureLineY + 5,
    { align: 'center' },
  )
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
    doc.text(`Purchase Indent ${model.indentNumber}`, PAGE_MARGIN, PAGE_HEIGHT - 6)
    doc.text(`Page ${pageNumber} of ${pageCount}`, PAGE_WIDTH - PAGE_MARGIN, PAGE_HEIGHT - 6, { align: 'right' })
  }
}

export async function createProfessionalPurchaseIndentPdf(model) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
    putOnlyUsedFonts: true,
  })
  doc.setProperties({
    title: `Purchase Indent ${model.indentNumber}`,
    subject: 'Purchase Indent',
    creator: model.company.name || 'Inventory Management System',
  })

  const [logoData, signatureData] = await Promise.all([
    loadImageData(model.company.logoUrl),
    loadImageData(model.signatureUrl),
  ])
  let y = drawHeader(doc, model, logoData)
  y = drawMetadata(doc, model, y)
  y = drawIndentParties(doc, model, y)
  y = drawItemsTable(doc, model, y)
  y = drawSummary(doc, model, y)
  y = drawApprovalActivity(doc, model, y)
  drawNotesAndSignature(doc, model, y, signatureData)
  drawPageFooters(doc, model)

  return doc
}

export async function createPurchaseIndentPdfBlob(model) {
  const doc = await createProfessionalPurchaseIndentPdf(model)
  return doc.output('blob')
}

export async function downloadProfessionalPurchaseIndentPdf(model) {
  const doc = await createProfessionalPurchaseIndentPdf(model)
  doc.save(getPurchaseIndentPdfFilename(model))
}
