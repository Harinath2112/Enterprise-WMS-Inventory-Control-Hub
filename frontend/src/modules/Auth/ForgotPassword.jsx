import {
  BarChart3,
  Boxes,
  KeyRound,
  LineChart,
  Mail,
  PackageCheck,
  Send,
  ShieldCheck,
  ShoppingCart,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from '../../api/apiClient'
import { API_ENDPOINTS } from '../../api/endpoints'
import loginLeftPanel from '../../assets/auth/login-left-panel.png'
import {
  emailInputProps,
  getEmailError,
  sanitizeEmailInput,
} from '../../validators/emailValidator'
import { getAuthErrorMessage } from './authCopy'
import './Auth.css'

import { renderFormLabel } from '../../utils/labelUtils'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('Enter your work email.')
      return
    }

    const emailError = getEmailError(email, { required: true })
    if (emailError) {
      setError(emailError)
      return
    }

    try {
      setLoading(true)
      const result = await apiRequest(API_ENDPOINTS.auth.forgotPassword, {
        method: 'POST',
        body: { email: sanitizeEmailInput(email) },
      })

      if (!result.success) {
        setError(getAuthErrorMessage(result.error, 'We could not send a code. Try again.'))
        return
      }

      navigate('/verify-otp', {
        state: {
          email: sanitizeEmailInput(email),
          message: 'A verification code has been sent to your email.',
        },
      })
    } catch {
      setError('Unable to connect to the server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="auth-wrapper auth-wrapper--login auth-wrapper--forgot"
      style={{ '--auth-login-left-panel': `url(${loginLeftPanel})` }}
    >
      <div className="auth-left-panel">
        <div className="auth-login-brand">
          <span className="auth-login-brand__mark" aria-hidden="true"><Boxes size={30} /></span>
          <strong>IMS</strong>
          <span className="auth-login-brand__divider" aria-hidden="true" />
          <span>Inventory<br /><em>Management System</em></span>
        </div>

        <div className="auth-login-message">
          <h1>Smart <span>Inventory.</span><br />Better Control.<br />Stronger Business.</h1>
          <i aria-hidden="true" />
          <p>IMS helps you manage stock, track transactions, and streamline operations efficiently in one place.</p>
        </div>

        <div className="auth-login-visual" aria-hidden="true">
          <div className="auth-login-dashboard">
            <div className="auth-login-dashboard__bar"><span /><span /><span /></div>
            <div className="auth-login-dashboard__stats"><b>Stock</b><b>Sales</b><b>Orders</b></div>
            <LineChart size={104} />
          </div>
          <div className="auth-login-visual__tile auth-login-visual__tile--stock"><PackageCheck /><span>Stock<br />Management</span></div>
          <div className="auth-login-visual__tile auth-login-visual__tile--sales"><BarChart3 /><span>Sales<br />Management</span></div>
          <div className="auth-login-visual__tile auth-login-visual__tile--purchase"><ShoppingCart /><span>Purchase<br />Management</span></div>
        </div>

        <div className="features auth-login-features">
          <div><PackageCheck size={17} /> Real-time Tracking</div>
          <div><ShieldCheck size={17} /> Secure &amp; Reliable</div>
          <div><BarChart3 size={17} /> Insightful Reports</div>
        </div>
      </div>

      <div className="auth-right-panel">
        <div className="login-card">
          <div className="auth-login-lock" aria-hidden="true"><KeyRound size={29} /></div>
          <h2>Forgot Password?</h2>
          <p className="sub">Enter your email address to receive a reset code</p>

          {error ? <div className="error-box">{error}</div> : null}

          <form onSubmit={handleSubmit}>
            <label className="auth-login-label" htmlFor="forgot-email">{renderFormLabel('Email Address *')}</label>
            <div className="input-box">
              <Mail size={16} />
              <input
                id="forgot-email"
                {...emailInputProps}
                placeholder="Email address"
                value={email}
                onChange={(event) => {
                  setError('')
                  setEmail(sanitizeEmailInput(event.target.value))
                }}
              />
            </div>

            <div className="links auth-forgot-login-link">
              <Link to="/login">Back to login</Link>
            </div>

            <button type="submit" disabled={loading}>
              <Send size={18} />
              {loading ? 'Sending...' : 'Send code'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
