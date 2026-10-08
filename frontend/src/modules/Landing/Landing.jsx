import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, BarChart3, Boxes, Check, ChevronDown, Menu, PackageCheck,
  ScanBarcode, ShieldCheck, ShoppingCart, Warehouse, X,
} from 'lucide-react'
import ThemeToggle from '../../theme/ThemeToggle'
import './Landing.css'

const FEATURES = [
  { icon: PackageCheck, title: 'Real-time stock control', text: 'Track every license, subscription and service SKU across locations with live quantities and reorder alerts.' },
  { icon: ShoppingCart, title: 'Purchase to payment', text: 'Indents, purchase orders, goods receipts and returns in one connected, auditable workflow.' },
  { icon: BarChart3, title: 'Insightful reports', text: 'Dashboards and exportable reports for sales, purchases, stock movement and supplier performance.' },
  { icon: ScanBarcode, title: 'Barcodes and variants', text: 'Generate barcodes, manage plans and editions as variants, and move stock with confidence.' },
  { icon: Warehouse, title: 'Warehouses and bins', text: 'Model warehouses, racks and bins; transfer, put away and audit stock without spreadsheets.' },
  { icon: ShieldCheck, title: 'Roles and audit trail', text: 'Granular permissions and a complete activity log so every change has an owner.' },
]

const STEPS = [
  ['Set up', 'Add products, suppliers, customers and warehouses.'],
  ['Operate', 'Raise purchases, receive goods, invoice customers.'],
  ['Understand', 'Watch live dashboards and export reports.'],
]

const PLANS = [
  { name: 'Starter', note: 'For small teams', items: ['Core inventory', 'Basic reports', '[Placeholder feature]'] },
  { name: 'Business', note: 'Most popular', items: ['Everything in Starter', 'Purchasing and invoicing', '[Placeholder feature]'], hot: true },
  { name: 'Enterprise', note: 'For larger orgs', items: ['Everything in Business', 'Advanced roles and audit', '[Placeholder feature]'] },
]

const FAQ = [
  ['What does IMS manage?', 'Products, stock, purchasing, sales invoices, returns, suppliers, customers, warehouses and reports in one system.'],
  ['How is pricing structured?', 'Pricing details are placeholders for now. Add your real plans here before launch.'],
  ['Can I control who sees what?', 'Yes. Role-based permissions and an audit log let you control and review access.'],
]

function useReveal() {
  const ref = useRef(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return undefined
    const items = root.querySelectorAll('[data-reveal]')
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-in'))
      return undefined
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target) }
      })
    }, { root, threshold: 0.12 })
    items.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
  return ref
}

export default function Landing() {
  const ref = useReveal()
  const [menu, setMenu] = useState(false)
  const [open, setOpen] = useState(0)
  const go = () => setMenu(false)

  return (
    <div className="lp" ref={ref}>
      <header className="lp-nav">
        <a className="lp-logo" href="#top"><span><Boxes size={20} /></span>IMS</a>
        <nav className={`lp-links ${menu ? 'is-open' : ''}`}>
          <a href="#features" onClick={go}>Features</a>
          <a href="#how" onClick={go}>How it works</a>
          <a href="#pricing" onClick={go}>Pricing</a>
          <a href="#faq" onClick={go}>FAQ</a>
          <Link className="lp-btn lp-btn--ghost lp-only-mobile" to="/login">Sign in</Link>
        </nav>
        <div className="lp-actions">
          <ThemeToggle />
          <Link className="lp-btn lp-btn--ghost" to="/login">Sign in</Link>
          <Link className="lp-btn lp-btn--solid" to="/register">Get started</Link>
          <button className="lp-burger" type="button" aria-label="Toggle menu" onClick={() => setMenu(!menu)}>
            {menu ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      <main id="top">
        <section className="lp-hero">
          <div className="lp-hero__copy">
            <span className="lp-pill">Inventory Management System</span>
            <h1>Run inventory, purchasing and sales from <em>one calm place.</em></h1>
            <p>IMS gives software and technology companies a clear, auditable view of every product, supplier and order — without the spreadsheet sprawl.</p>
            <div className="lp-cta">
              <Link className="lp-btn lp-btn--solid lp-btn--lg" to="/register">Get started <ArrowRight size={18} /></Link>
              <Link className="lp-btn lp-btn--outline lp-btn--lg" to="/login">Sign in</Link>
            </div>
          </div>
          <div className="lp-mock" aria-hidden="true">
            <div className="lp-mock__bar"><i /><i /><i /></div>
            <div className="lp-mock__stats">
              <div><small>Products</small><b>128</b></div>
              <div><small>Orders</small><b>46</b></div>
              <div><small>Low stock</small><b>7</b></div>
            </div>
            <div className="lp-mock__chart">
              {[38, 56, 44, 70, 52, 84, 66, 92].map((h, i) => <span key={i} style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }} />)}
            </div>
            <div className="lp-mock__rows"><span /><span /><span /></div>
          </div>
        </section>

        <section className="lp-sec" id="features">
          <div className="lp-head" data-reveal><h2>Everything you need to stay in control</h2><p>Purpose-built modules that work together out of the box.</p></div>
          <div className="lp-grid">
            {FEATURES.map(({ icon: Icon, title, text }, i) => (
              <article className="lp-card" data-reveal style={{ transitionDelay: `${i * 60}ms` }} key={title}>
                <span className="lp-card__icon"><Icon size={22} /></span>
                <h3>{title}</h3><p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-sec lp-sec--dark" id="how">
          <div className="lp-head" data-reveal><h2>Up and running in three steps</h2></div>
          <ol className="lp-steps">
            {STEPS.map(([t, d], i) => (
              <li data-reveal style={{ transitionDelay: `${i * 90}ms` }} key={t}><b>{i + 1}</b><h3>{t}</h3><p>{d}</p></li>
            ))}
          </ol>
        </section>

        <section className="lp-sec" id="pricing">
          <div className="lp-head" data-reveal><h2>Simple plans</h2><p>Placeholder pricing — replace with your real plans.</p></div>
          <div className="lp-grid lp-grid--3">
            {PLANS.map((p, i) => (
              <article className={`lp-card lp-plan ${p.hot ? 'is-hot' : ''}`} data-reveal style={{ transitionDelay: `${i * 80}ms` }} key={p.name}>
                <small>{p.note}</small><h3>{p.name}</h3>
                <div className="lp-plan__price">[Price]</div>
                <ul>{p.items.map((it) => <li key={it}><Check size={16} />{it}</li>)}</ul>
                <Link className={`lp-btn ${p.hot ? 'lp-btn--solid' : 'lp-btn--outline'}`} to="/register">Choose {p.name}</Link>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-sec lp-sec--narrow" id="faq">
          <div className="lp-head" data-reveal><h2>Frequently asked questions</h2></div>
          {FAQ.map(([q, a], i) => (
            <div className={`lp-faq ${open === i ? 'is-open' : ''}`} key={q}>
              <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
                {q}<ChevronDown size={18} />
              </button>
              <p>{a}</p>
            </div>
          ))}
        </section>

        <section className="lp-final" data-reveal>
          <h2>Ready to bring order to your inventory?</h2>
          <Link className="lp-btn lp-btn--solid lp-btn--lg" to="/register">Get started <ArrowRight size={18} /></Link>
        </section>
      </main>

      <footer className="lp-foot">
        <span className="lp-logo"><span><Boxes size={18} /></span>IMS</span>
        <span>hello@yourcompany.com · +00 000 000 0000 · [Company address]</span>
        <span>© {new Date().getFullYear()} IMS. All rights reserved.</span>
      </footer>
    </div>
  )
}
