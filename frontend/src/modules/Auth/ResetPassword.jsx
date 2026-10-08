import {
  BarChart3,
  Boxes,
  Eye,
  EyeOff,
  LineChart,
  LockKeyhole,
  PackageCheck,
  ShieldCheck,
  ShoppingCart,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { apiRequest } from '../../api/apiClient'
import { API_ENDPOINTS } from '../../api/endpoints'
import loginLeftPanel from '../../assets/auth/login-left-panel.png'
import { getAuthErrorMessage } from './authCopy'
import { getPasswordError, isPasswordReused, recordPasswordHistory } from '../../validators/passwordValidator'
import './Auth.css'

import { renderFormLabel } from '../../utils/labelUtils'

export default function ResetPassword() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email || ''
  const [otp, setOtp] = useState(location.state?.otp || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [touched, setTouched] = useState({
    otp: false,
    password: false,
    confirmPassword: false,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Compute dynamic validation errors
  let otpError = ''
  if (!otp) {
    otpError = 'Verification code is required.'
  } else if (!/^\d{6}$/.test(otp)) {
    otpError = 'Enter the 6-digit code.'
  }

  const passwordError = getPasswordError(password, {
    email,
    oldPassword: location.state?.oldPassword,
    previousPasswords: [
      location.state?.oldPassword,
      location.state?.currentPassword,
    ].filter(Boolean),
  })

  let confirmPasswordError = ''
  if (!confirmPassword) {
    confirmPasswordError = 'Confirm password is required.'
  } else if (password !== confirmPassword) {
    confirmPasswordError = 'Passwords do not match.'
  }

  const otpDisplayError = touched.otp && otpError
  const passwordDisplayError = touched.password && passwordError
  const confirmPasswordDisplayError = touched.confirmPassword && confirmPasswordError

  const isFormValid = !otpError && !passwordError && !confirmPasswordError

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setTouched({ otp: true, password: true, confirmPassword: true })

    if (!email) {
      setError('Your reset session expired. Request a new code.')
      return
    }

    if (isPasswordReused(password, { email, oldPassword: location.state?.oldPassword })) {
      setError('New password cannot be the same as the old password.')
      return
    }

    if (!isFormValid) {
      setError(otpError || passwordError || confirmPasswordError || 'Complete all fields.')
      return
    }

    try {
      setLoading(true)
      const result = await apiRequest(API_ENDPOINTS.auth.resetPassword, {
        method: 'POST',
        body: {
          email,
          otp,
          newPassword: password,
        },
      })

      if (!result.success) {
        setError(getAuthErrorMessage(result.error, 'We could not update your password. Try again.'))
        return
      }

      recordPasswordHistory(email, password)
      navigate('/login', { replace: true })
    } catch {
      setError('Unable to connect to the server.')
    } finally {
      setLoading(false)
    }
  }

  return (
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
          <h2>Reset Password</h2>
          <p className="sub">Enter your verification code and new password</p>

          {error ? <div className="error-box">{error}</div> : null}

          <form onSubmit={handleSubmit} autoComplete="off">
            <label className="auth-login-label" htmlFor="reset-otp">{renderFormLabel('Verification Code *')}</label>
            <div className={`input-box ${otpDisplayError ? 'input-box--error' : ''}`}>
              <ShieldCheck size={16} />
              <input
                id="reset-otp"
                type="text"
                placeholder="6-digit code"
                value={otp}
                onChange={(event) => {
                  setError('')
                  setOtp(event.target.value.replace(/\D/g, ''))
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, otp: true }))}
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
              />
            </div>
            {otpDisplayError && (
              <span className="field-error-text field-error">{otpDisplayError}</span>
            )}

            <label className="auth-login-label" htmlFor="reset-password">{renderFormLabel('New Password *')}</label>
            <div className={`input-box ${passwordDisplayError ? 'input-box--error' : ''}`}>
              <LockKeyhole size={16} />
              <input
                id="reset-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="New password"
                value={password}
                onChange={(event) => {
                  setError('')
                  setPassword(event.target.value)
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="auth-login-password-toggle"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setShowPassword((prev) => {
                    const next = !prev
                    setShowConfirmPassword(next)
                    return next
                  })
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <Eye size={17} /> : <EyeOff size={17} />}
              </button>
            </div>
            {passwordDisplayError && (
              <span className="field-error-text field-error">{passwordDisplayError}</span>
            )}

            <label className="auth-login-label" htmlFor="reset-confirm-password">{renderFormLabel('Confirm Password *')}</label>
            <div className={`input-box ${confirmPasswordDisplayError ? 'input-box--error' : ''}`}>
              <LockKeyhole size={16} />
              <input
                id="reset-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(event) => {
                  setError('')
                  setConfirmPassword(event.target.value)
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, confirmPassword: true }))}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="auth-login-password-toggle"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setShowConfirmPassword((prev) => {
                    const next = !prev
                    setShowPassword(next)
                    return next
                  })
                }}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showConfirmPassword ? <Eye size={17} /> : <EyeOff size={17} />}
              </button>
            </div>
            {confirmPasswordDisplayError && (
              <span className="field-error-text field-error">{confirmPasswordDisplayError}</span>
            )}

            <div className="links" style={{ marginBottom: '1rem' }}>
              <Link to="/login">Back to login</Link>
            </div>

            <button type="submit" disabled={loading}>
              <LockKeyhole size={18} />
              {loading ? 'Updating...' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
