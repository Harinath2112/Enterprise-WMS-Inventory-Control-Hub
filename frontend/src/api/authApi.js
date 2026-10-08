import { apiRequest } from "./apiClient";
import { API_ENDPOINTS } from "./endpoints";

const emailVerificationRequests = new Map();

function requireText(value, message) {
  const normalizedValue = String(value ?? "").trim();

  if (!normalizedValue) {
    throw new Error(message);
  }

  return normalizedValue;
}

function getUserIdFromJwtToken() {
  try {
    const directKeys = ["ims-auth-token", "authToken", "token", "accessToken"];
    let rawToken = "";
    for (const key of directKeys) {
      const val = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (val) {
        rawToken = val;
        break;
      }
    }
    if (!rawToken) return null;
    let token = rawToken;
    try {
      const parsed = JSON.parse(rawToken);
      token = typeof parsed === "string" ? parsed : rawToken;
    } catch {
      token = rawToken;
    }
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const payload = JSON.parse(jsonPayload);
    const idVal =
      payload.nameid ||
      payload.sub ||
      payload.userId ||
      payload.userID ||
      payload.id ||
      payload.adminId ||
      payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
    const num = Number(idVal);
    return Number.isInteger(num) && num > 0 ? num : null;
  } catch {
    return null;
  }
}

export function resolveUserId(userCandidate) {
  if (typeof userCandidate === "number" && Number.isInteger(userCandidate) && userCandidate > 0) {
    return userCandidate;
  }

  const candidateId = Number(
    userCandidate?.id ??
    userCandidate?.userId ??
    userCandidate?.userID ??
    userCandidate?.adminId
  );
  if (Number.isInteger(candidateId) && candidateId > 0) {
    return candidateId;
  }

  const tokenUserId = getUserIdFromJwtToken();
  if (tokenUserId) {
    return tokenUserId;
  }

  try {
    const userKeys = ["ims-current-user", "user", "authUser", "currentUser"];
    for (const key of userKeys) {
      const rawUser = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        const storedId = Number(
          parsed?.id ?? parsed?.userId ?? parsed?.userID ?? parsed?.adminId
        );
        if (Number.isInteger(storedId) && storedId > 0) {
          return storedId;
        }
      }
    }
  } catch {
    // Ignore storage parse error
  }

  return 1;
}

function requireUserId(userId) {
  return resolveUserId(userId);
}

/**
 * 1. POST /api/auth/register
 */
export function registerAccount(userData) {
  return apiRequest(API_ENDPOINTS.auth.register, {
    method: "POST",
    body: userData,
  });
}

/**
 * 2. POST /api/auth/login
 */
export function loginUser(credentials) {
  return apiRequest(API_ENDPOINTS.auth.login, {
    method: "POST",
    body: credentials,
  });
}

/**
 * 3. POST /api/auth/refresh-token
 */
export function refreshAuthToken(refreshToken) {
  return apiRequest(API_ENDPOINTS.auth.refreshToken, {
    method: "POST",
    body: {
      refreshToken: requireText(refreshToken, "Refresh token is required."),
    },
  });
}

/**
 * 4. POST /api/auth/forgot-password
 */
export function requestForgotPassword(email) {
  return apiRequest(API_ENDPOINTS.auth.forgotPassword, {
    method: "POST",
    body: {
      email: requireText(email, "The email address is missing."),
    },
  });
}

/**
 * 5. PUT /api/auth/change-password/{userId}
 */
export function changePassword(userId, currentPassword, newPassword) {
  return apiRequest(API_ENDPOINTS.auth.changePassword(requireUserId(userId)), {
    method: "PUT",
    body: {
      currentPassword: requireText(currentPassword, "Current password is required."),
      newPassword: requireText(newPassword, "New password is required."),
    },
  });
}

/**
 * 6. GET /api/auth/verify-email
 */
export function verifyEmailAddress(token) {
  const normalizedToken = requireText(
    token,
    "The verification token is missing.",
  );
  const existingRequest = emailVerificationRequests.get(normalizedToken);

  if (existingRequest) {
    return existingRequest;
  }

  const request = apiRequest(API_ENDPOINTS.auth.verifyEmail, {
    method: "GET",
    query: {
      token: normalizedToken,
    },
  }).then((response) => {
    if (response.status === 0 || response.status >= 500) {
      emailVerificationRequests.delete(normalizedToken);
    }

    return response;
  });

  emailVerificationRequests.set(normalizedToken, request);
  return request;
}

/**
 * 7. POST /api/auth/logout/{userId}
 */
export async function logoutCurrentSession(userId) {
  try {
    const resolvedId = resolveUserId(userId);
    if (!resolvedId) {
      return { success: true, message: "Logged out locally." };
    }
    const result = await apiRequest(API_ENDPOINTS.auth.logout(resolvedId), {
      method: "POST",
    });

    if (!result.success && result.status === 404) {
      return await apiRequest(`/Profile/logout/${resolvedId}`, {
        method: "POST",
      });
    }

    return result;
  } catch (error) {
    return { success: false, error: error?.message || "Logout request failed." };
  }
}

/**
 * 8. POST /api/auth/logout-all-devices/{userId}
 */
export async function logoutAllDevices(userId) {
  try {
    const resolvedId = resolveUserId(userId);
    if (!resolvedId) {
      return { success: true, message: "Logged out locally." };
    }
    const result = await apiRequest(
      API_ENDPOINTS.auth.logoutAllDevices(resolvedId),
      {
        method: "POST",
      },
    );

    if (!result.success && result.status === 404) {
      return await apiRequest(`/Profile/logout-all-devices/${resolvedId}`, {
        method: "POST",
      });
    }

    return result;
  } catch (error) {
    return { success: false, error: error?.message || "Logout all devices failed." };
  }
}

/**
 * 9. POST /api/auth/reset-password
 */
export function resetPassword(resetData) {
  return apiRequest(API_ENDPOINTS.auth.resetPassword, {
    method: "POST",
    body: resetData,
  });
}

/**
 * 10. GET /api/auth/claims
 */
export function getAuthClaims() {
  return apiRequest(API_ENDPOINTS.auth.claims, {
    method: "GET",
  });
}

/**
 * 11. POST /api/auth/verify-otp
 */
export function verifyOtp(email, otp) {
  return apiRequest(API_ENDPOINTS.auth.verifyOtp, {
    method: "POST",
    body: {
      email: requireText(email, "The email address is missing."),
      otp: requireText(otp, "The OTP code is missing."),
    },
  });
}

/**
 * 11b. POST /api/auth/verify-email-otp
 */
export function verifyEmailOtp(email, otp) {
  return apiRequest(API_ENDPOINTS.auth.verifyEmailOtp, {
    method: "POST",
    body: {
      email: requireText(email, "The email address is missing."),
      otp: requireText(otp, "The OTP code is missing."),
    },
  });
}

/**
 * 12. POST /api/auth/resend-login-otp
 */
export function resendLoginOtp(email) {
  return apiRequest(API_ENDPOINTS.auth.resendLoginOtp, {
    method: "POST",
    body: {
      email: requireText(email, "The email address is missing."),
    },
  });
}

/**
 * 13. POST /api/auth/resend-verification
 */
export function resendVerificationEmail(email, options = {}) {
  return apiRequest(API_ENDPOINTS.auth.resendVerification, {
    method: "POST",
    body: {
      email: requireText(email, "The email address is missing."),
    },
    signal: options.signal,
  });
}

export function validateCurrentSession() {
  return apiRequest(API_ENDPOINTS.auth.session, {
    method: "GET",
    timeoutMs: 10000,
  });
}
