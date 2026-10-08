import {
  BarChart3,
  Boxes,
  Eye,
  EyeOff,
  LineChart,
  LockKeyhole,
  Mail,
  PackageCheck,
  Phone,
  ShieldCheck,
  ShoppingCart,
  User,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../../api/apiClient";
import { API_ENDPOINTS } from "../../api/endpoints";
import loginLeftPanel from "../../assets/auth/login-left-panel.png";
import {
  emailInputProps,
  getEmailError,
  sanitizeEmailInput,
} from "../../validators/emailValidator";
import {
  getNameError,
  nameInputProps,
  sanitizeNameInput,
} from "../../validators/nameValidator";
import {
  getPhoneError,
  phoneInputProps,
  sanitizePhoneInput,
} from "../../validators/phoneValidator";
import { getPasswordError } from "../../validators/passwordValidator";
import "./Auth.css";

function getConfirmPasswordError(password, confirmPassword) {
  if (!confirmPassword) return "Confirm password is required.";
  if (password !== confirmPassword) return "Passwords do not match.";
  return "";
}

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
  });
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    phoneNumber: false,
    password: false,
    confirmPassword: false,
  });
  const [serverFieldErrors, setServerFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [wasSubmitted, setWasSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Compute field errors dynamically
  const nameError = getNameError(formData.name, { required: true, label: "Full Name" });
  const emailError = getEmailError(formData.email, { required: true, label: "Email address" });
  const phoneError = getPhoneError(formData.phoneNumber, "Mobile number");
  const passwordError = getPasswordError(formData.password);
  const confirmPasswordError = getConfirmPasswordError(formData.password, formData.confirmPassword);

  const isFormValid =
    formData.name.trim() !== "" &&
    formData.email.trim() !== "" &&
    formData.phoneNumber.trim() !== "" &&
    formData.password !== "" &&
    formData.confirmPassword !== "" &&
    !nameError &&
    !emailError &&
    !phoneError &&
    !passwordError &&
    !confirmPasswordError;

  function handleChange(event) {
    const { name, value } = event.target;
    setError("");
    setServerFieldErrors((prev) => ({ ...prev, [name]: "" }));
    setTouched((prev) => ({ ...prev, [name]: true }));
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "email"
          ? sanitizeEmailInput(value)
          : name === "phoneNumber"
            ? sanitizePhoneInput(value)
            : name === "name"
              ? sanitizeNameInput(value)
              : value,
    }));
  }

  function handleBlur(event) {
    const { name } = event.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setWasSubmitted(true);

    setTouched({
      name: true,
      email: true,
      phoneNumber: true,
      password: true,
      confirmPassword: true,
    });

    const clientErrors = [
      { field: 'Full Name', key: 'name', error: nameError },
      { field: 'Email Address', key: 'email', error: emailError },
      { field: 'Mobile Number', key: 'phoneNumber', error: phoneError },
      { field: 'Password', key: 'password', error: passwordError },
      { field: 'Confirm Password', key: 'confirmPassword', error: confirmPasswordError },
    ].filter(item => Boolean(item.error));

    if (!isFormValid || clientErrors.length > 0) {
      const fieldNames = clientErrors.map(item => item.field);

      setError(
        clientErrors.length === 1
          ? `Please fix ${clientErrors[0].field}: ${clientErrors[0].error}`
          : `Please check the highlighted fields: ${fieldNames.join(", ")}.`
      );

      const firstKey = clientErrors[0]?.key;
      const inputIdMap = {
        name: 'register-name',
        email: 'register-email',
        phoneNumber: 'register-phone',
        password: 'register-password',
        confirmPassword: 'register-confirm-password',
      };
      if (firstKey && inputIdMap[firstKey]) {
        document.getElementById(inputIdMap[firstKey])?.focus();
      }
      return;
    }

    try {
      setLoading(true);
      const result = await apiRequest(API_ENDPOINTS.auth.register, {
        method: "POST",
        body: {
          name: formData.name.trim(),
          email: sanitizeEmailInput(formData.email),
          phoneNumber: sanitizePhoneInput(formData.phoneNumber),
          password: formData.password,
          confirmPassword: formData.confirmPassword,
        },
      });

      if (!result.success) {
        const rawErrors = result.errors || {};
        const fieldErrorMap = {};
        const messages = [];

        if (typeof rawErrors === "object" && rawErrors !== null) {
          Object.entries(rawErrors).forEach(([key, val]) => {
            const msg = Array.isArray(val) ? val.join(" ") : String(val);
            if (!msg) return;

            const lowerKey = key.toLowerCase();
            let fieldLabel = key;
            if (lowerKey.includes("name")) { fieldErrorMap.name = msg; fieldLabel = "Full Name"; }
            else if (lowerKey.includes("email")) { fieldErrorMap.email = msg; fieldLabel = "Email Address"; }
            else if (lowerKey.includes("phone") || lowerKey.includes("mobile")) { fieldErrorMap.phoneNumber = msg; fieldLabel = "Mobile Number"; }
            else if (lowerKey.includes("confirmpassword")) { fieldErrorMap.confirmPassword = msg; fieldLabel = "Confirm Password"; }
            else if (lowerKey.includes("password")) { fieldErrorMap.password = msg; fieldLabel = "Password"; }

            messages.push(`${fieldLabel}: ${msg}`);
          });
        }

        const rawErrStr = String(result.error || result.message || '');
        const combinedErrorText = `${rawErrStr} ${messages.join(' ')}`.toLowerCase();
        const isDuplicateUser = result.status === 409 ||
          /already|exists|conflict|duplicate|registered/i.test(combinedErrorText);

        if (isDuplicateUser) {
          const isPhone = /phone|mobile/i.test(combinedErrorText);
          const duplicateMsg = isPhone
            ? "An account with this phone number already exists."
            : "An account with this email address already exists.";

          if (isPhone) {
            fieldErrorMap.phoneNumber = duplicateMsg;
          } else {
            fieldErrorMap.email = duplicateMsg;
          }

          setServerFieldErrors(fieldErrorMap);
          setError(duplicateMsg);
          return;
        }

        setServerFieldErrors(fieldErrorMap);

        let specificError = messages.join(" | ");

        if (!specificError) {
          if (/email/i.test(rawErrStr)) {
            specificError = "Email Address: Enter a valid email address.";
            setServerFieldErrors(prev => ({ ...prev, email: "Enter a valid email address." }));
          } else if (/phone|mobile/i.test(rawErrStr)) {
            specificError = "Mobile Number: Enter a valid 10-digit mobile number.";
            setServerFieldErrors(prev => ({ ...prev, phoneNumber: "Enter a valid 10-digit mobile number." }));
          } else if (/password/i.test(rawErrStr)) {
            specificError = "Password: Password does not meet security requirements.";
            setServerFieldErrors(prev => ({ ...prev, password: "Password does not meet security requirements." }));
          } else {
            specificError = rawErrStr ? `Registration Error: ${rawErrStr}` : "Account creation failed. Please check the highlighted fields.";
          }
        }

        setError(specificError);
        return;
      }

      const userEmail = sanitizeEmailInput(formData.email);
      try {
        localStorage.removeItem("ims-email-verification-completed");
      } catch {
        // Ignore localStorage cleanup failures in private browsing mode
      }

      navigate(
        `/verify-email?email=${encodeURIComponent(userEmail)}`,
        { replace: true },
      );
    } catch (err) {
      const msg = err?.message || ''
      if (/network|fetch|timeout|aborted|ERR_/i.test(msg)) {
        setError("Unable to connect to the server. Please check your internet connection and try again.")
      } else {
        setError("Something went wrong while creating your account. Please try again.")
      }
    } finally {
      setLoading(false);
    }
  }

  const hasInvalidPhoneStart =
    formData.phoneNumber.length > 0 && !/^[6-9]/.test(formData.phoneNumber);
  const phoneDisplayError =
    serverFieldErrors.phoneNumber ||
    ((touched.phoneNumber || hasInvalidPhoneStart || formData.phoneNumber.length >= 10 || wasSubmitted) &&
      phoneError);
  const nameDisplayError = serverFieldErrors.name || ((touched.name || wasSubmitted) && nameError);
  const emailDisplayError = serverFieldErrors.email || ((touched.email || wasSubmitted) && emailError);
  const passwordDisplayError = serverFieldErrors.password || ((touched.password || wasSubmitted) && passwordError);
  const confirmPasswordDisplayError = (touched.confirmPassword || wasSubmitted) && confirmPasswordError;

  return (
    <div
      className="auth-wrapper auth-wrapper--login auth-wrapper--register"
      style={{ "--auth-login-left-panel": `url(${loginLeftPanel})` }}
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
          <div className="auth-login-lock" aria-hidden="true">
            <UserPlus size={29} />
          </div>
          <h2>Create Account</h2>
          <p className="sub">Create your IMS workspace account</p>

          {error && (
            <div className="error-box auth-register-error is-visible" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="auth-register-form">
            <div className="register-field-group">
              <label className="auth-login-label" htmlFor="register-name">
                Full Name
              </label>
              <div className={`input-box ${nameDisplayError ? "input-box--error" : ""}`}>
                <User size={16} />
                <input
                  id="register-name"
                  {...nameInputProps}
                  name="name"
                  placeholder="Full name"
                  value={formData.name}
                  onChange={handleChange}
                  maxLength={50}
                  onBlur={handleBlur}
                  autoComplete="name"
                  aria-invalid={Boolean(nameDisplayError)}
                  aria-describedby={nameDisplayError ? "fullName-error" : undefined}
                />
              </div>
              {nameDisplayError && (
                <span id="fullName-error" className="field-error-text field-error" role="alert">{nameDisplayError}</span>
              )}
            </div>

            <div className="register-field-group">
              <label className="auth-login-label" htmlFor="register-email">
                Email Address
              </label>
              <div className={`input-box ${emailDisplayError ? "input-box--error" : ""}`}>
                <Mail size={16} />
                <input
                  id="register-email"
                  {...emailInputProps}
                  name="email"
                  placeholder="Email address"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  aria-invalid={Boolean(emailDisplayError)}
                  aria-describedby={emailDisplayError ? "email-error" : undefined}
                />
              </div>
              {emailDisplayError && (
                <span id="email-error" className="field-error-text field-error" role="alert">{emailDisplayError}</span>
              )}
            </div>

            <div className="register-field-group">
              <label className="auth-login-label" htmlFor="register-phone">
                Mobile Number
              </label>
              <div className={`input-box ${phoneDisplayError ? "input-box--error" : ""}`}>
                <Phone size={16} />
                <input
                  id="register-phone"
                  {...phoneInputProps}
                  name="phoneNumber"
                  placeholder="10-digit mobile number"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoComplete="tel"
                  aria-invalid={Boolean(phoneDisplayError)}
                  aria-describedby={phoneDisplayError ? "phoneNumber-error" : undefined}
                />
              </div>
              {phoneDisplayError && (
                <span id="phoneNumber-error" className="field-error-text field-error" role="alert">{phoneDisplayError}</span>
              )}
            </div>

            <div className="register-field-group">
              <label className="auth-login-label" htmlFor="register-password">
                Password
              </label>
              <div className={`input-box ${passwordDisplayError ? "input-box--error" : ""}`}>
                <LockKeyhole size={16} />
                <input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoComplete="new-password"
                  aria-invalid={Boolean(passwordDisplayError)}
                  aria-describedby={passwordDisplayError ? "password-error" : undefined}
                />
                {formData.password ? (
                  <button
                    type="button"
                    className="auth-login-password-toggle"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowPassword((current) => !current);
                    }}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? <Eye size={17} /> : <EyeOff size={17} />}
                  </button>
                ) : null}
              </div>
              {passwordDisplayError && (
                <span id="password-error" className="field-error-text field-error" role="alert">{passwordDisplayError}</span>
              )}
            </div>

            <div className="register-field-group">
              <label
                className="auth-login-label"
                htmlFor="register-confirm-password"
              >
                Confirm Password
              </label>
              <div className={`input-box ${confirmPasswordDisplayError ? "input-box--error" : ""}`}>
                <LockKeyhole size={16} />
                <input
                  id="register-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  placeholder="Confirm password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoComplete="new-password"
                  aria-invalid={Boolean(confirmPasswordDisplayError)}
                  aria-describedby={confirmPasswordDisplayError ? "confirmPassword-error" : undefined}
                />
                {formData.confirmPassword ? (
                  <button
                    type="button"
                    className="auth-login-password-toggle"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowConfirmPassword((current) => !current);
                    }}
                    aria-label={
                      showConfirmPassword ? "Hide password" : "Show password"
                    }
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <Eye size={17} /> : <EyeOff size={17} />}
                  </button>
                ) : null}
              </div>
              {confirmPasswordDisplayError && (
                <span id="confirmPassword-error" className="field-error-text field-error" role="alert">{confirmPasswordDisplayError}</span>
              )}
            </div>

            <div className="links auth-register-login-link">
              <span>Already have an account?</span>
              <Link to="/login">Login</Link>
            </div>

            <button type="submit" disabled={!isFormValid || loading}>
              <UserPlus size={18} />
              {loading ? "Creating..." : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
