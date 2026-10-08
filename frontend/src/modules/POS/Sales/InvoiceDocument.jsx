import { formatDate } from '../../../utils/helpers'
import { formatInvoiceCurrency } from './invoiceDocumentModel'
import './InvoiceDocument.css'

function hasText(value) {
  return String(value ?? '').trim() !== ''
}

function CompanyLogo({ company }) {
  if (company.logoUrl) {
    return (
      <img
        className="invoice-document__logo"
        src={company.logoUrl}
        alt={`${company.name || 'Company'} logo`}
      />
    )
  }

  if (!company.name) return null

  const initials = company.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')

  return (
    <span className="invoice-document__logo invoice-document__logo--initials" aria-hidden="true">
      {initials}
    </span>
  )
}

function ContactLine({ label, value }) {
  if (!hasText(value)) return null
  return <p><strong>{label}:</strong> {value}</p>
}

function AddressBlock({ title, party, address, required = false }) {
  const hasDetails = [
    party.companyName,
    party.name,
    party.gstNumber,
    party.phone,
    party.email,
    address,
  ].some(hasText)

  if (!hasDetails && !required) return null

  return (
    <section className="invoice-document__address-block">
      <h2>{title}</h2>
      {!hasDetails ? <p>Details unavailable</p> : null}
      {party.companyName ? <p className="invoice-document__party-company">{party.companyName}</p> : null}
      {party.name && party.name !== party.companyName ? (
        <p className="invoice-document__party-name">{party.name}</p>
      ) : null}
      {address ? <p className="invoice-document__multiline">{address}</p> : null}
      <ContactLine label="GSTIN" value={party.gstNumber} />
      <ContactLine label="Phone" value={party.phone} />
      <ContactLine label="Email" value={party.email} />
    </section>
  )
}

function SummaryRow({ label, value, strong = false, negative = false }) {
  return (
    <div className={`invoice-document__summary-row${strong ? ' invoice-document__summary-row--strong' : ''}`}>
      <span>{label}</span>
      <span>{negative && value > 0 ? '- ' : ''}{formatInvoiceCurrency(value)}</span>
    </div>
  )
}

function RateAmount({ rate, amount }) {
  const showRate = Number(rate) !== 0

  return (
    <>
      <span>{formatInvoiceCurrency(amount)}</span>
      {showRate ? <small>{Number(rate).toLocaleString('en-IN')}%</small> : null}
    </>
  )
}

export default function InvoiceDocument({ model, printRoot = false }) {
  const { company, customer, summary } = model
  const hasCompanyContact = company.address || company.gstNumber || company.phone || company.email
  const hasTerms = model.paymentTerms || model.terms.length > 0 || model.notes
  const hasShippingAddress = Boolean(customer.shippingAddress)

  return (
    <article
      className={`invoice-document${printRoot ? ' invoice-document--print-root' : ''}`}
      aria-label={`Tax invoice ${model.invoiceNumber}`}
    >
      <header className="invoice-document__header">
        <div className="invoice-document__brand">
          <CompanyLogo company={company} />
          {(company.name || hasCompanyContact) ? (
            <div className="invoice-document__company-details">
              {company.name ? <h1>{company.name}</h1> : null}
              {company.address ? <p className="invoice-document__multiline">{company.address}</p> : null}
              <div className="invoice-document__company-contact">
                <ContactLine label="GSTIN" value={company.gstNumber} />
                <ContactLine label="Phone" value={company.phone} />
                <ContactLine label="Email" value={company.email} />
              </div>
            </div>
          ) : null}
        </div>

        <div className="invoice-document__title-block">
          <p className="invoice-document__eyebrow">Original for recipient</p>
          <h2>TAX INVOICE</h2>
          <span className={`invoice-document__status invoice-document__status--${model.paymentStatus.toLowerCase().replace(/\s+/g, '-')}`}>
            {model.paymentStatus}
          </span>
        </div>
      </header>

      <section className="invoice-document__meta" aria-label="Invoice information">
        <div>
          <span>Invoice Number</span>
          <strong>{model.invoiceNumber}</strong>
        </div>
        {model.invoiceDate ? (
          <div>
            <span>Invoice Date</span>
            <strong>{formatDate(model.invoiceDate)}</strong>
          </div>
        ) : null}
        {model.dueDate ? (
          <div>
            <span>Due Date</span>
            <strong>{formatDate(model.dueDate)}</strong>
          </div>
        ) : null}
        {model.reference ? (
          <div>
            <span>Reference</span>
            <strong>{model.reference}</strong>
          </div>
        ) : null}
      </section>

      <div className={`invoice-document__addresses${hasShippingAddress ? '' : ' invoice-document__addresses--single'}`}>
        <AddressBlock title="Bill To" party={customer} address={customer.billingAddress} required />
        {hasShippingAddress ? (
          <AddressBlock title="Ship To" party={customer} address={customer.shippingAddress} />
        ) : null}
      </div>

      <div className="invoice-document__items-wrap">
        <table className="invoice-document__items">
          <colgroup>
            <col className="invoice-document__col-serial" />
            <col className="invoice-document__col-product" />
            <col className="invoice-document__col-sku" />
            <col className="invoice-document__col-quantity" />
            <col className="invoice-document__col-unit" />
            <col className="invoice-document__col-price" />
            <col className="invoice-document__col-discount" />
            <col className="invoice-document__col-tax" />
            <col className="invoice-document__col-total" />
          </colgroup>
          <thead>
            <tr>
              <th className="invoice-document__center">S.No.</th>
              <th>Product Name</th>
              <th>SKU</th>
              <th className="invoice-document__numeric">Quantity</th>
              <th>Unit</th>
              <th className="invoice-document__numeric">Unit Price</th>
              <th className="invoice-document__numeric">Discount</th>
              <th className="invoice-document__numeric">Tax</th>
              <th className="invoice-document__numeric">Total</th>
            </tr>
          </thead>
          <tbody>
            {model.items.map((item) => (
              <tr key={item.id}>
                <td className="invoice-document__center">{item.serialNumber}</td>
                <td className="invoice-document__product-name">{item.productName || '-'}</td>
                <td>{item.sku || '-'}</td>
                <td className="invoice-document__numeric">{item.quantity.toLocaleString('en-IN')}</td>
                <td>{item.unit || '-'}</td>
                <td className="invoice-document__numeric">{formatInvoiceCurrency(item.unitPrice)}</td>
                <td className="invoice-document__numeric invoice-document__rate-amount">
                  <RateAmount rate={item.discountPercent} amount={item.discountAmount} />
                </td>
                <td className="invoice-document__numeric invoice-document__rate-amount">
                  <RateAmount rate={item.taxPercent} amount={item.taxAmount} />
                </td>
                <td className="invoice-document__numeric invoice-document__line-total">
                  {formatInvoiceCurrency(item.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="invoice-document__closing">
        <section className="invoice-document__payment-overview">
          <h2>Payment Summary</h2>
          <div className="invoice-document__payment-cards">
            <div>
              <span>Amount Paid</span>
              <strong>{formatInvoiceCurrency(summary.paidAmount)}</strong>
            </div>
            <div>
              <span>Balance Amount</span>
              <strong>{formatInvoiceCurrency(summary.balanceAmount)}</strong>
            </div>
          </div>
        </section>

        <section className="invoice-document__summary" aria-label="Invoice totals">
          <SummaryRow label="Subtotal" value={summary.subtotal} />
          <SummaryRow label="Discount" value={summary.discount} negative />
          <SummaryRow label="Tax / GST" value={summary.tax} />
          {summary.additionalCharges.map((charge) => (
            <SummaryRow key={charge.key} label={charge.label} value={charge.amount} />
          ))}
          <SummaryRow label="Amount Paid" value={summary.paidAmount} />
          <SummaryRow label="Balance Amount" value={summary.balanceAmount} />
          <SummaryRow label="Grand Total" value={summary.grandTotal} strong />
        </section>
      </div>

      <footer className="invoice-document__footer">
        {hasTerms ? (
          <section className="invoice-document__terms">
            <h2>Terms and Conditions</h2>
            {model.paymentTerms ? <p><strong>Payment terms:</strong> {model.paymentTerms}</p> : null}
            {model.terms.length > 0 ? (
              <ol>
                {model.terms.map((term, index) => <li key={`${term}-${index}`}>{term}</li>)}
              </ol>
            ) : null}
            {model.notes ? <p><strong>Notes:</strong> {model.notes}</p> : null}
          </section>
        ) : <div />}

        <section className="invoice-document__signature">
          {model.signatureUrl ? (
            <img src={model.signatureUrl} alt="Authorized signature" />
          ) : <span className="invoice-document__signature-space" aria-hidden="true" />}
          <span className="invoice-document__signature-line" />
          <strong>{model.authorizedBy || 'Authorized Signatory'}</strong>
          {company.name ? <small>For {company.name}</small> : null}
        </section>
      </footer>
    </article>
  )
}
