import {
  BarChart3,
  Boxes,
  Eye,
  EyeOff,
  LineChart,
  LockKeyhole,
  LogIn,
  Mail,
  PackageCheck,
  Phone,
  ShieldCheck,
  ShoppingCart,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import loginLeftPanel from '../../assets/auth/login-left-panel.png'
import {
  getEmailError,
  sanitizeEmailInput,
} from '../../validators/emailValidator'
import { getAuthErrorMessage } from './authCopy'
import './Auth.css'
 
const REMEMBER_ME_STORAGE_KEY = 'ims_remember_me_identifier'

import { renderFormLabel } from '../../utils/labelUtils'

export default function Login({ onLoginSuccess, isSwitchMode = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const verificationMessage = location.state?.verificationMessage || ''
  const verificationNotice = location.state?.verificationNotice || ''
 
  const [rememberMe, setRememberMe] = useState(() => {
    if (typeof window === 'undefined') return false
    return Boolean(window.localStorage.getItem(REMEMBER_ME_STORAGE_KEY))
  })

  const [formData, setFormData] = useState(() => {
    const savedIdentifier = typeof window !== 'undefined'
      ? window.localStorage.getItem(REMEMBER_ME_STORAGE_KEY) || ''
      : ''
    return {
      email: location.state?.email || savedIdentifier,
      password: '',
    }
  })
  const [touched, setTouched] = useState({
    email: false,
    password: false,
  })
  const [serverFieldErrors, setServerFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Compute validation errors dynamically
  const identifier = formData.email.trim()
  const isPhone = /^[0-9+\s-()]+$/.test(identifier) && identifier.replace(/\D/g, '').length >= 7
  let emailError = ''
  if (!identifier) {
    emailError = 'Email address or phone number is required.'
  } else if (!isPhone) {
    emailError = getEmailError(identifier, { required: true })
  } else {
    const digitsOnly = identifier.replace(/\D/g, '')
    if (digitsOnly.length < 10) {
      emailError = 'Please enter a valid 10-digit phone number.'
    }
  }

  const passwordError = formData.password ? '' : 'Password is required.'

  const emailDisplayError = serverFieldErrors.email || (touched.email && emailError)
  const passwordDisplayError = serverFieldErrors.password || (touched.password && passwordError)

  const isFormValid = !emailError && !passwordError
 
  function handleChange(event) {
    const { name, value } = event.target
    setError('')
    setServerFieldErrors((prev) => ({ ...prev, [name]: '' }))
    setTouched((prev) => ({ ...prev, [name]: true }))
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  function handleBlur(event) {
    const { name } = event.target
    setTouched((prev) => ({ ...prev, [name]: true }))
  }
 
  async function handleSubmit(event) {
    event.preventDefault()
    if (loading) return
    setError('')
    setServerFieldErrors({})
    setTouched({ email: true, password: true })

    if (!isFormValid) {
      setError(emailError || passwordError || 'Enter your credentials to login.')
      return
    }
 
    try {
      setLoading(true)

      if (rememberMe && typeof window !== 'undefined') {
        window.localStorage.setItem(REMEMBER_ME_STORAGE_KEY, identifier)
      } else if (typeof window !== 'undefined') {
        window.localStorage.removeItem(REMEMBER_ME_STORAGE_KEY)
      }

      const result = await login({
        emailOrPhone: identifier,
        password: formData.password,
        rememberMe,
      })
 
      if (!result?.success) {
        const msg = result?.message || ''
        const lowerMsg = msg.toLowerCase()
        const fieldErrorMap = {}
        if (lowerMsg.includes('email') || lowerMsg.includes('user') || lowerMsg.includes('identifier')) {
          fieldErrorMap.email = msg
        } else if (lowerMsg.includes('password') || lowerMsg.includes('credential')) {
          fieldErrorMap.password = msg
        }
        setServerFieldErrors(fieldErrorMap)

        setError(getAuthErrorMessage(result?.message, 'Check your credentials and password.'))
        return
      }
 
      navigate('/dashboard', { replace: true })
    } catch {
      setError('Unable to connect to the server.')
    } finally {
      setLoading(false)
    }
  }return (
    <div
      className="auth-wrapper auth-wrapper--login"
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
          <div className="auth-login-lock" aria-hidden="true"><LockKeyhole size={30} /></div>
          <h2>Welcome Back!</h2>
          <p className="sub">Login to access your IMS dashboard</p>
 
          {verificationMessage ? (
            <div className="success-box" role="status">
              {verificationMessage}
            </div>
          ) : null}
          {verificationNotice ? (
            <div className="notice-box" role="status">
              {verificationNotice}
            </div>
          ) : null}
          {error ? <div className="error-box">{error}</div> : null}
 
          <form onSubmit={handleSubmit} noValidate>
            <label className="auth-login-label" htmlFor="login-identifier">{renderFormLabel('Email or Phone Number *')}</label>
            <div className={`input-box ${emailDisplayError ? 'input-box--error' : ''}`}>
              {/^[0-9+\s-()]+$/.test(formData.email) ? (
                <Phone size={16} />
              ) : (
                <Mail size={16} />
              )}
              <input
                id="login-identifier"
                type="text"
                name="email"
                placeholder="Enter your email or phone number"
                value={formData.email}
                onChange={handleChange}
                onBlur={handleBlur}
                autoComplete="username"
                required
              />
            </div>
            {emailDisplayError && (
              <span className="field-error-text field-error">{emailDisplayError}</span>
            )}

            <label className="auth-login-label" htmlFor="login-password">{renderFormLabel('Password *')}</label>
            <div className={`input-box ${passwordDisplayError ? 'input-box--error' : ''}`}>
              <LockKeyhole size={16} />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                onBlur={handleBlur}
                autoComplete="current-password"
                required
              />
              {formData.password ? (
                <button
                  type="button"
                  className="auth-login-password-toggle"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowPassword((current) => !current)
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <Eye size={17} /> : <EyeOff size={17} />}
                </button>
              ) : null}
            </div>
            {passwordDisplayError && (
              <span className="field-error-text field-error">{passwordDisplayError}</span>
            )}

            <div className="auth-login-options-row">
              <label className="auth-login-remember" htmlFor="login-remember-me">
                <input
                  id="login-remember-me"
                  type="checkbox"
                  name="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>
              <Link to="/forgot-password">Forgot password?</Link>
            </div>

            <button type="submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>

            <div className="auth-login-divider">
              <span>or</span>
            </div>

            <div className="auth-login-signup-prompt">
              <span>Don't have an account?</span>
              <Link to="/register">Create Account</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
