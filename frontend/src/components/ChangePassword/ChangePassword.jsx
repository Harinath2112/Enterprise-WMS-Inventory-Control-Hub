import { useEffect, useState } from "react";
import { Eye, EyeOff, X } from "lucide-react";
import { isPasswordReused, recordPasswordHistory } from "../../validators/passwordValidator";
import "./ChangePassword.css";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '').replace(/\/api$/, '');
const FALLBACK_USER_ID = 1;

function getChangePasswordApiUrl(userId) {
  return `${API_BASE_URL}/api/auth/change-password/${userId || FALLBACK_USER_ID}`;
}

const passwordText = {
  english: {
    title: "Change Password",
    subtitle: "Update your account password",
    currentPassword: "Current Password",
    newPassword: "New Password",
    confirmPassword: "Confirm New Password",
    currentPlaceholder: "Enter current password",
    newPlaceholder: "Enter new password",
    confirmPlaceholder: "Confirm new password",
    requirements: "Password Requirements:",
    rule1: "Minimum 8 characters",
    rule2: "Include uppercase and lowercase letters",
    rule3: "Include at least one number",
    rule4: "Include at least one special character",
    cancel: "Cancel",
    update: "Update Password",
    updating: "Updating...",
    success: "Password updated successfully",
    failed: "Password update failed. Please check current password.",
    unauthorized: "Unauthorized. Please login again.",
    currentRequired: "Current password is required",
    newRequired: "New password is required",
    minLength: "Password must be minimum 8 characters",
    uppercase: "Password must include uppercase letter",
    lowercase: "Password must include lowercase letter",
    number: "Password must include number",
    special: "Password must include special character",
    confirmRequired: "Confirm password is required",
    mismatch: "Passwords do not match",
  },
  telugu: {
    title: "పాస్‌వర్డ్ మార్చండి",
    subtitle: "మీ అకౌంట్ పాస్‌వర్డ్‌ను అప్‌డేట్ చేయండి",
    currentPassword: "ప్రస్తుత పాస్‌వర్డ్",
    newPassword: "కొత్త పాస్‌వర్డ్",
    confirmPassword: "కొత్త పాస్‌వర్డ్ నిర్ధారించండి",
    currentPlaceholder: "ప్రస్తుత పాస్‌వర్డ్ ఇవ్వండి",
    newPlaceholder: "కొత్త పాస్‌వర్డ్ ఇవ్వండి",
    confirmPlaceholder: "కొత్త పాస్‌వర్డ్ నిర్ధారించండి",
    requirements: "పాస్‌వర్డ్ అవసరాలు:",
    rule1: "కనీసం 8 అక్షరాలు",
    rule2: "పెద్ద మరియు చిన్న అక్షరాలు ఉండాలి",
    rule3: "కనీసం ఒక నంబర్ ఉండాలి",
    rule4: "కనీసం ఒక స్పెషల్ క్యారెక్టర్ ఉండాలి",
    cancel: "రద్దు",
    update: "పాస్‌వర్డ్ అప్‌డేట్ చేయండి",
    updating: "అప్‌డేట్ అవుతోంది...",
    success: "పాస్‌వర్డ్ విజయవంతంగా అప్‌డేట్ అయింది",
    failed: "పాస్‌వర్డ్ అప్‌డేట్ కాలేదు. ప్రస్తుత పాస్‌వర్డ్ చెక్ చేయండి.",
    unauthorized: "అనధికార ప్రవేశం. దయచేసి మళ్లీ లాగిన్ అవ్వండి.",
    currentRequired: "ప్రస్తుత పాస్‌వర్డ్ అవసరం",
    newRequired: "కొత్త పాస్‌వర్డ్ అవసరం",
    minLength: "పాస్‌వర్డ్ కనీసం 8 అక్షరాలు ఉండాలి",
    uppercase: "పాస్‌వర్డ్‌లో పెద్ద అక్షరం ఉండాలి",
    lowercase: "పాస్‌వర్డ్‌లో చిన్న అక్షరం ఉండాలి",
    number: "పాస్‌వర్డ్‌లో నంబర్ ఉండాలి",
    special: "పాస్‌వర్డ్‌లో స్పెషల్ క్యారెక్టర్ ఉండాలి",
    confirmRequired: "కన్ఫర్మ్ పాస్‌వర్డ్ అవసరం",
    mismatch: "పాస్‌వర్డ్‌లు మ్యాచ్ కావడం లేదు",
  },
  hindi: {
    title: "Change Password",
    subtitle: "अपना account password update करें",
    currentPassword: "Current Password",
    newPassword: "New Password",
    confirmPassword: "Confirm New Password",
    currentPlaceholder: "Current password enter करें",
    newPlaceholder: "New password enter करें",
    confirmPlaceholder: "New password confirm करें",
    requirements: "Password Requirements:",
    rule1: "Minimum 8 characters",
    rule2: "Uppercase और lowercase letters include करें",
    rule3: "At least one number include करें",
    rule4: "At least one special character include करें",
    cancel: "Cancel",
    update: "Update Password",
    updating: "Updating...",
    success: "Password updated successfully",
    failed: "Password update failed. Please check current password.",
    unauthorized: "Unauthorized. Please login again.",
    currentRequired: "Current password required है",
    newRequired: "New password required है",
    minLength: "Password minimum 8 characters होना चाहिए",
    uppercase: "Password में uppercase letter होना चाहिए",
    lowercase: "Password में lowercase letter होना चाहिए",
    number: "Password में number होना चाहिए",
    special: "Password में special character होना चाहिए",
    confirmRequired: "Confirm password required है",
    mismatch: "Passwords match नहीं हो रहे",
  },
};

function cleanToken(token) {
  if (!token) return "";

  const value = String(token).trim();

  if (value.toLowerCase().startsWith("bearer ")) {
    return value.slice(7).trim();
  }

  return value;
}

function parseJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function getUserIdFromObject(value) {
  const parsedValue = parseJson(value);

  return (
    parsedValue?.id ||
    parsedValue?.userId ||
    parsedValue?.userID ||
    parsedValue?.adminId ||
    parsedValue?.data?.id ||
    parsedValue?.data?.userId ||
    parsedValue?.data?.userID ||
    parsedValue?.data?.adminId ||
    parsedValue?.user?.id ||
    parsedValue?.user?.userId ||
    parsedValue?.profile?.id ||
    parsedValue?.profile?.userId ||
    ""
  );
}

function getTokenFromObject(value) {
  try {
    if (!value) return "";

    const parsedValue = JSON.parse(value);

    return cleanToken(
      parsedValue?.token ||
      parsedValue?.authToken ||
      parsedValue?.accessToken ||
      parsedValue?.jwtToken ||
      parsedValue?.bearerToken ||
      parsedValue?.data?.token ||
      parsedValue?.data?.authToken ||
      parsedValue?.data?.accessToken ||
      parsedValue?.data?.jwtToken ||
      ""
    );
  } catch {
    return "";
  }
}

function getStoredValue(storage, key) {
  try {
    return storage.getItem(key) || "";
  } catch {
    return "";
  }
}

function getAuthToken() {
  const directKeys = [
    "token",
    "authToken",
    "accessToken",
    "jwtToken",
    "bearerToken",
    "ims-auth-token",
    "imsToken",
  ];

  const objectKeys = [
    "user",
    "authUser",
    "imsUser",
    "imsAdminUser",
    "loginUser",
    "currentUser",
    "ims-current-user",
  ];

  for (const key of directKeys) {
    const localToken = cleanToken(getStoredValue(localStorage, key));
    if (localToken) return localToken;

    const sessionToken = cleanToken(getStoredValue(sessionStorage, key));
    if (sessionToken) return sessionToken;
  }

  for (const key of objectKeys) {
    const localToken = getTokenFromObject(getStoredValue(localStorage, key));
    if (localToken) return localToken;

    const sessionToken = getTokenFromObject(getStoredValue(sessionStorage, key));
    if (sessionToken) return sessionToken;
  }

  return "";
}

function getCurrentUserId() {
  const objectKeys = [
    "user",
    "authUser",
    "imsUser",
    "imsAdminUser",
    "loginUser",
    "currentUser",
    "ims-current-user",
  ];

  for (const key of objectKeys) {
    const localUserId = getUserIdFromObject(getStoredValue(localStorage, key));
    if (localUserId) return localUserId;

    const sessionUserId = getUserIdFromObject(getStoredValue(sessionStorage, key));
    if (sessionUserId) return sessionUserId;
  }

  return FALLBACK_USER_ID;
}

function getApiHeaders() {
  const token = getAuthToken();

  return {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function ChangePassword({ settingsData, onClose }) {
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const [apiError, setApiError] = useState("");
  const [saving, setSaving] = useState(false);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const lang = settingsData?.language || "english";
  const p = passwordText[lang] || passwordText.english;

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, saving]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    const updatedData = {
      ...passwordData,
      [name]: value,
    };

    setPasswordData(updatedData);

    let confirmError = "";
    if (updatedData.confirmPassword) {
      if (updatedData.newPassword !== updatedData.confirmPassword) {
        confirmError = p.mismatch;
      }
    }

    setErrors((previousErrors) => ({
      ...previousErrors,
      [name]: "",
      confirmPassword:
        name === "newPassword" || name === "confirmPassword"
          ? confirmError
          : previousErrors.confirmPassword,
    }));

    setApiError("");
  };

  const validatePassword = () => {
    const newErrors = {};

    if (!passwordData.currentPassword) {
      newErrors.currentPassword = p.currentRequired;
    }

    if (!passwordData.newPassword) {
      newErrors.newPassword = p.newRequired;
    } else if (passwordData.newPassword.length < 8) {
      newErrors.newPassword = p.minLength;
    } else if (!/[A-Z]/.test(passwordData.newPassword)) {
      newErrors.newPassword = p.uppercase;
    } else if (!/[a-z]/.test(passwordData.newPassword)) {
      newErrors.newPassword = p.lowercase;
    } else if (!/[0-9]/.test(passwordData.newPassword)) {
      newErrors.newPassword = p.number;
    } else if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(passwordData.newPassword)) {
      newErrors.newPassword = p.special;
    } else if (
      isPasswordReused(passwordData.newPassword, {
        currentPassword: passwordData.currentPassword,
      })
    ) {
      newErrors.newPassword = "New password cannot be the same as the old password.";
    }

    if (!passwordData.confirmPassword) {
      newErrors.confirmPassword = p.confirmRequired;
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      newErrors.confirmPassword = p.mismatch;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getApiErrorMessage = async (response) => {
    if (response.status === 401) {
      return p.unauthorized;
    }

    try {
      const data = await response.json();

      if (typeof data === "string") return data;
      if (data?.message) return data.message;
      if (data?.error) return data.error;
      if (data?.title) return data.title;

      return p.failed;
    } catch {
      return p.failed;
    }
  };

  const handleUpdatePassword = async () => {
    if (!validatePassword()) return;

    try {
      setSaving(true);
      setApiError("");
      setSuccessMessage("");

      const payload = {
        userId: getCurrentUserId(),
        currentPassword: passwordData.currentPassword,
        oldPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
        confirmPassword: passwordData.confirmPassword,
      };

      const response = await fetch(getChangePasswordApiUrl(getCurrentUserId()), {
        method: "PUT",
        headers: getApiHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorMessage = await getApiErrorMessage(response);
        throw new Error(errorMessage);
      }

      setSuccessMessage(p.success);

      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setTimeout(() => {
        onClose();
      }, 900);
    } catch (error) {
      console.error("Change password error:", error);
      setApiError(error.message || p.failed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="password-overlay" onClick={!saving ? onClose : undefined}>
      <div
        className="password-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="password-header">
          <div>
            <h2>{p.title}</h2>
          </div>

          <button
            className="password-close-btn"
            onClick={onClose}
            disabled={saving}
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        <div className="password-body">
          <div className="password-form-section">
            {successMessage && (
              <div className="password-success-message">{successMessage}</div>
            )}

            {apiError && <div className="password-api-error page-error-banner" role="alert">{apiError}</div>}

            <div className="password-group">
              <label>{p.currentPassword}</label>
              <div className="password-input-wrapper">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  name="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handleChange}
                  placeholder={p.currentPlaceholder}
                  disabled={saving}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowCurrentPassword((prev) => !prev);
                  }}
                  aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                  disabled={saving}
                  tabIndex={-1}
                >
                  {showCurrentPassword ? <Eye size={17} /> : <EyeOff size={17} />}
                </button>
              </div>
              {errors.currentPassword && <small>{errors.currentPassword}</small>}
            </div>

            <div className="password-group">
              <label>{p.newPassword}</label>
              <div className="password-input-wrapper">
                <input
                  type={showNewPassword ? "text" : "password"}
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handleChange}
                  placeholder={p.newPlaceholder}
                  disabled={saving}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowNewPassword((prev) => {
                      const next = !prev;
                      setShowConfirmPassword(next);
                      return next;
                    });
                  }}
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                  disabled={saving}
                  tabIndex={-1}
                >
                  {showNewPassword ? <Eye size={17} /> : <EyeOff size={17} />}
                </button>
              </div>
              {errors.newPassword && <small>{errors.newPassword}</small>}
            </div>

            <div className="password-group">
              <label>{p.confirmPassword}</label>
              <div className="password-input-wrapper">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handleChange}
                  placeholder={p.confirmPlaceholder}
                  disabled={saving}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowConfirmPassword((prev) => !prev);
                  }}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  disabled={saving}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <Eye size={17} /> : <EyeOff size={17} />}
                </button>
              </div>
              {errors.confirmPassword && <small>{errors.confirmPassword}</small>}
            </div>
          </div>

          <div className="password-rules">
            <h4>{p.requirements}</h4>
            <p>
              <span>✓</span> {p.rule1}
            </p>
            <p>
              <span>✓</span> {p.rule2}
            </p>
            <p>
              <span>✓</span> {p.rule3}
            </p>
            <p>
              <span>✓</span> {p.rule4}
            </p>
          </div>
        </div>

        <div className="password-actions">
          <button
            className="password-update-btn"
            onClick={handleUpdatePassword}
            disabled={saving}
          >
            {saving ? p.updating : p.update}
          </button>

          <button className="button button-cancel password-cancel-btn"
            onClick={onClose}
            disabled={saving}
          >
            {p.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChangePassword;
