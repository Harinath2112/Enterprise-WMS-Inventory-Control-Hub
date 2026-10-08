import {
  BarChart3,
  Boxes,
  LineChart,
  LoaderCircle,
  MailPlus,
  MailWarning,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import loginLeftPanel from "../../assets/auth/login-left-panel.png";
import {
  resendLoginOtp,
  resendVerificationEmail,
  verifyEmailAddress,
  verifyOtp,
  verifyEmailOtp,
} from "../../api/authApi";
import {
  getEmailError,
  sanitizeEmailInput,
} from "../../validators/emailValidator";
import { getAuthErrorMessage } from "./authCopy";
import {
  announceEmailVerificationCompleted,
  EMAIL_VERIFICATION_COMPLETED_EVENT,
  EMAIL_VERIFICATION_COMPLETED_KEY,
  isEmailAlreadyVerifiedMessage,
  parseEmailVerificationCompletion,
} from "./emailVerification";
import "./Auth.css";

function isConsumedVerificationLink(response) {
  const message = `${response?.message || ""} ${response?.error || ""}`.toLowerCase();

  if (message.includes("expired")) {
    return false;
  }

  if (response?.status === 404 || response?.status === 410) {
    return true;
  }

  return (
    response?.status === 400 &&
    /(invalid verification token|verification token.*invalid|token.*(?:used|consumed)|not found)/i.test(
      message,
    )
  );
}

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token =
    (searchParams.get("token") || searchParams.get("Token"))?.trim() || "";
  const initialEmail = sanitizeEmailInput(
    searchParams.get("email") ||
      searchParams.get("Email") ||
      (typeof window !== "undefined" ? sessionStorage.getItem("ims_verify_email") : "") ||
      "",
  );
  const [userEmail, setUserEmail] = useState(initialEmail);
  const [state, setState] = useState({
    status: "loading",
    message: "Preparing email verification...",
    retryable: false,
  });
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const [resendState, setResendState] = useState({
    status: "idle",
    message: "",
  });
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const targetEmail = userEmail || initialEmail;
    if (targetEmail && typeof window !== "undefined") {
      try {
        sessionStorage.setItem("ims_verify_email", targetEmail);
      } catch {}
    }
  }, [initialEmail, userEmail]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const redirectToLogin = useCallback(
    ({ confirmed = false, message = "", notice = "" } = {}) => {
      navigate("/login", {
        replace: true,
        state: {
          email: userEmail || initialEmail,
          ...(confirmed
            ? {
                verificationMessage:
                  message ||
                  "Your email has been verified. You can now sign in.",
              }
            : {}),
          ...(notice ? { verificationNotice: notice } : {}),
        },
      });
    },
    [initialEmail, navigate, userEmail],
  );

  useEffect(() => {
    if (!token) {
      setState(
        userEmail || initialEmail
          ? {
              status: "pending",
              message: `We sent a verification code to ${userEmail || initialEmail}. Enter the code below to verify.`,
              retryable: false,
            }
          : {
              status: "error",
              message: "The verification token or email is missing.",
              retryable: false,
            },
      );
      return;
    }

    let isActive = true;

    async function verify() {
      setState({
        status: "loading",
        message: "Verifying your email address...",
        retryable: false,
      });

      const response = await verifyEmailAddress(token);

      if (!isActive) {
        return;
      }

      const responseMessage = response.message || response.error || "";
      if (
        response.success ||
        isEmailAlreadyVerifiedMessage(responseMessage)
      ) {
        announceEmailVerificationCompleted(userEmail || initialEmail);
        redirectToLogin({
          confirmed: true,
          message: response.success ? response.message : "",
        });
        return;
      }

      if (isConsumedVerificationLink(response)) {
        redirectToLogin({
          notice:
            "This verification link has already been used or is no longer active. Sign in to continue.",
        });
        return;
      }

      setState({
        status: "error",
        message:
          response.message ||
          response.error ||
          "Unable to verify this email address.",
        retryable: response.status === 0,
      });
    }

    void verify();
    return () => {
      isActive = false;
    };
  }, [initialEmail, redirectToLogin, token, userEmail, verificationAttempt]);

  useEffect(() => {
    const targetEmail = userEmail || initialEmail;
    if (token || !targetEmail) {
      return undefined;
    }

    let isRedirecting = false;

    const redirectOnce = (options) => {
      if (isRedirecting) {
        return;
      }

      isRedirecting = true;
      redirectToLogin(options);
    };

    const handleCompletion = (value) => {
      const completion = parseEmailVerificationCompletion(value);
      if (!completion) {
        return;
      }

      if (
        completion.email &&
        completion.email !== targetEmail.toLowerCase()
      ) {
        return;
      }

      redirectOnce({ confirmed: true });
    };

    const handleStorage = (event) => {
      if (event.key === EMAIL_VERIFICATION_COMPLETED_KEY && event.newValue) {
        handleCompletion(event.newValue);
      }
    };

    const handleVerificationEvent = (event) => {
      handleCompletion(event.detail);
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(
      EMAIL_VERIFICATION_COMPLETED_EVENT,
      handleVerificationEvent,
    );

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        EMAIL_VERIFICATION_COMPLETED_EVENT,
        handleVerificationEvent,
      );
    };
  }, [initialEmail, redirectToLogin, token, userEmail]);

  async function handleVerifyOtpSubmit(event) {
    event.preventDefault();
    if (otpLoading) return;
    setOtpError("");

    const code = otpCode.trim();
    if (!code) {
      setOtpError("Enter the verification code.");
      return;
    }

    const currentEmail = sanitizeEmailInput(userEmail || initialEmail).toLowerCase().trim();

    try {
      setOtpLoading(true);
      
      // Call POST /api/auth/verify-email-otp
      const response = await verifyEmailOtp(currentEmail, code);

      const responseMessage = response.message || response.error || "";

      if (response.success || isEmailAlreadyVerifiedMessage(responseMessage)) {
        announceEmailVerificationCompleted(currentEmail);
        redirectToLogin({
          confirmed: true,
          message: response.success ? response.message : "Your email has been verified. You can now sign in.",
        });
        return;
      }

      setOtpError(
        response.message ||
        response.error ||
        "Invalid verification token or code. Please check and try again."
      );
    } catch {
      setOtpError("Unable to verify code. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleResend() {
    if (resendState.status === "loading" || cooldown > 0) return;
    const targetEmail = sanitizeEmailInput(userEmail || initialEmail).toLowerCase().trim();
    const emailError = getEmailError(targetEmail, { required: true });
    if (emailError) {
      setResendState({
        status: "error",
        message: emailError,
      });
      return;
    }

    setResendState({
      status: "loading",
      message: "",
    });

    let response = await resendVerificationEmail(targetEmail);

    if (!response.success) {
      const loginOtpResp = await resendLoginOtp(targetEmail);
      if (loginOtpResp.success) {
        response = loginOtpResp;
      }
    }

    if (!response.success) {
      setResendState({
        status: "error",
        message: getAuthErrorMessage(
          response.error || response.message,
          "Unable to resend verification code. Please try again.",
        ),
      });
      return;
    }

    setOtpCode("");
    setCooldown(30);
    setResendState({
      status: "success",
      message: "Verification code resent successfully.",
    });
  }

  const isPending = state.status === "pending";
  const canResend = Boolean(userEmail || initialEmail) && state.status !== "loading";

  return (
    <div
      className="auth-wrapper auth-wrapper--login"
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
            {state.status === "loading" || otpLoading ? (
              <LoaderCircle className="animate-spin" size={30} />
            ) : isPending ? (
              <ShieldCheck size={30} />
            ) : (
              <MailWarning size={30} />
            )}
          </div>

          <h2>
            {isPending
              ? "Verify Your Account"
              : state.status === "loading"
                ? "Verifying Email"
                : "Verification Unavailable"}
          </h2>
          <p className="sub">
            {state.message}
          </p>

          {isPending && (
            <form onSubmit={handleVerifyOtpSubmit} style={{ width: "100%" }} autoComplete="off">
              {otpError && <div className="error-box is-visible" style={{ marginBottom: "1rem" }}>{otpError}</div>}
              
              <label className="auth-login-label" htmlFor="verify-otp-input">
                Verification Code
              </label>
              <div className="input-box" style={{ marginBottom: "1.25rem" }}>
                <ShieldCheck size={16} />
                <input
                  id="verify-otp-input"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  disabled={otpLoading}
                  autoFocus
                />
              </div>

              <button type="submit" disabled={otpLoading || !otpCode.trim()} style={{ width: "100%", marginBottom: "1rem" }}>
                <ShieldCheck size={18} />
                {otpLoading ? "Verifying..." : "Verify & Continue"}
              </button>
            </form>
          )}

          {state.status === "error" && token && state.retryable ? (
            <div className="verify-email-card__resend">
              <button
                type="button"
                onClick={() =>
                  setVerificationAttempt((currentAttempt) => currentAttempt + 1)
                }
              >
                <RefreshCw size={17} />
                Try verification again
              </button>
              <div className="links" style={{ marginTop: "1rem" }}>
                <Link to="/login">Back to sign in</Link>
              </div>
            </div>
          ) : canResend ? (
            <div className="verify-email-card__resend">
              {resendState.message ? (
                <p
                  className={
                    resendState.status === "success"
                      ? "success-box"
                      : "error-box"
                  }
                  role={
                    resendState.status === "error" ? "alert" : "status"
                  }
                >
                  {resendState.message}
                </p>
              ) : null}
              <button
                type="button"
                onClick={handleResend}
                disabled={resendState.status === "loading" || cooldown > 0}
              >
                {resendState.status === "loading" ? (
                  <LoaderCircle className="animate-spin" size={17} />
                ) : (
                  <MailPlus size={17} />
                )}
                {resendState.status === "loading"
                  ? "Sending..."
                  : cooldown > 0
                    ? `Resend available in ${cooldown}s`
                    : "Resend verification code"}
              </button>
              <div className="links" style={{ marginTop: "1rem" }}>
                <Link to="/login">Back to sign in</Link>
              </div>
            </div>
          ) : state.status !== "loading" ? (
            <div className="links" style={{ marginTop: "1rem" }}>
              <Link to="/login">Back to sign in</Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
