import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import "./LoginHistory.css";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '').replace(/\/api$/, '');
const FALLBACK_USER_ID = 1;

const historyText = {
  english: {
    title: "Login History",
    subtitle: "View your account login activity",
    dateTime: "Date & Time",
    device: "Device",
    ip: "IP Address",
    location: "Location",
    status: "Status",
    current: "Current",
    success: "Success",
    failed: "Failed",
    close: "Close",
    loading: "Loading login history...",
    empty: "No login history found.",
    error: "Unable to load login history.",
    unauthorized: "Unauthorized. Please login again.",
    networkError:
      "Unable to connect to server. Please check API/ngrok and try again.",
  },
  telugu: {
    title: "లాగిన్ హిస్టరీ",
    subtitle: "మీ అకౌంట్ లాగిన్ యాక్టివిటీని చూడండి",
    dateTime: "తేదీ & సమయం",
    device: "డివైస్",
    ip: "IP అడ్రస్",
    location: "లొకేషన్",
    status: "స్థితి",
    current: "ప్రస్తుత",
    success: "విజయవంతం",
    failed: "విఫలం",
    close: "మూసివేయండి",
    loading: "లాగిన్ హిస్టరీ లోడ్ అవుతోంది...",
    empty: "లాగిన్ హిస్టరీ దొరకలేదు.",
    error: "లాగిన్ హిస్టరీ లోడ్ కాలేదు.",
    unauthorized: "అనధికార ప్రవేశం. దయచేసి మళ్లీ లాగిన్ అవ్వండి.",
    networkError:
      "సర్వర్‌కు కనెక్ట్ కాలేదు. API/ngrok చెక్ చేసి మళ్లీ ప్రయత్నించండి.",
  },
  hindi: {
    title: "Login History",
    subtitle: "अपनी account login activity देखें",
    dateTime: "Date & Time",
    device: "Device",
    ip: "IP Address",
    location: "Location",
    status: "Status",
    current: "Current",
    success: "Success",
    failed: "Failed",
    close: "Close",
    loading: "Loading login history...",
    empty: "No login history found.",
    error: "Unable to load login history.",
    unauthorized: "Unauthorized. Please login again.",
    networkError:
      "Unable to connect to server. Please check API/ngrok and try again.",
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

function getStoredValue(storage, key) {
  try {
    return storage.getItem(key) || "";
  } catch {
    return "";
  }
}

function getTokenFromObject(value) {
  const parsedValue = parseJson(value);

  return cleanToken(
    parsedValue?.token ||
    parsedValue?.authToken ||
    parsedValue?.accessToken ||
    parsedValue?.jwtToken ||
    parsedValue?.bearerToken ||
    parsedValue?.access_token ||
    parsedValue?.data?.token ||
    parsedValue?.data?.authToken ||
    parsedValue?.data?.accessToken ||
    parsedValue?.data?.jwtToken ||
    parsedValue?.data?.access_token ||
    parsedValue?.user?.token ||
    parsedValue?.user?.authToken ||
    parsedValue?.user?.accessToken ||
    ""
  );
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

function getAuthToken() {
  const directKeys = [
    "token",
    "authToken",
    "accessToken",
    "jwtToken",
    "bearerToken",
    "access_token",
    "ims-auth-token",
    "imsToken",
    "imsAdminToken",
    "adminToken",
  ];

  const objectKeys = [
    "user",
    "authUser",
    "imsUser",
    "imsAdminUser",
    "loginUser",
    "currentUser",
    "ims-current-user",
    "adminUser",
    "auth",
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
  const directKeys = ["userId", "adminId", "currentUserId", "imsUserId"];

  for (const key of directKeys) {
    const localId = getStoredValue(localStorage, key);
    if (localId) return localId;

    const sessionId = getStoredValue(sessionStorage, key);
    if (sessionId) return sessionId;
  }

  const objectKeys = [
    "user",
    "authUser",
    "imsUser",
    "imsAdminUser",
    "loginUser",
    "currentUser",
    "ims-current-user",
    "adminUser",
    "auth",
  ];

  for (const key of objectKeys) {
    const localUserId = getUserIdFromObject(getStoredValue(localStorage, key));
    if (localUserId) return localUserId;

    const sessionUserId = getUserIdFromObject(
      getStoredValue(sessionStorage, key)
    );
    if (sessionUserId) return sessionUserId;
  }

  return FALLBACK_USER_ID;
}

function getApiHeaders() {
  const token = getAuthToken();

  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getLoginHistoryApiUrl(userId) {
  return `${API_BASE_URL}/api/LoginHistory/${userId}`;
}

async function getApiErrorMessage(response, fallbackMessage, unauthorizedText) {
  if (response.status === 401) {
    return unauthorizedText;
  }

  try {
    const data = await response.json();

    if (typeof data === "string") return data;
    if (data?.message) return data.message;
    if (data?.error) return data.error;
    if (data?.title) return data.title;

    return fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

function formatDateTime(value) {
  if (!value) {
    return {
      date: "-",
      time: "-",
    };
  }

  const dateObject = new Date(value);

  if (Number.isNaN(dateObject.getTime())) {
    return {
      date: String(value),
      time: "",
    };
  }

  return {
    date: dateObject.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    time: dateObject.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function normalizeHistoryResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.loginHistory)) return data.loginHistory;
  if (Array.isArray(data?.history)) return data.history;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.records)) return data.records;

  if (data && typeof data === "object") return [data];

  return [];
}

function mapHistoryItem(item, index) {
  const loginDate =
    item.loginDate ||
    item.loginTime ||
    item.dateTime ||
    item.createdAt ||
    item.loginAt ||
    item.timeStamp ||
    item.timestamp;

  const formatted = formatDateTime(loginDate);

  const status =
    item.status ||
    item.loginStatus ||
    item.result ||
    (item.isSuccess === false ? "Failed" : "Success");

  return {
    id: item.id || item.loginHistoryId || item.historyId || index + 1,
    date: formatted.date,
    time: formatted.time,
    device:
      item.device ||
      item.deviceName ||
      item.browser ||
      item.userAgent ||
      "Unknown Device",
    ip: item.ipAddress || item.ip || item.clientIp || item.ipaddress || "-",
    location:
      item.location || item.city || item.country || item.loginLocation || "-",
    status,
  };
}

function LoginHistory({ settingsData, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  const lang = settingsData?.language || "english";
  const h = historyText[lang] || historyText.english;

  const userId = useMemo(() => getCurrentUserId(), []);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  useEffect(() => {
    async function fetchLoginHistory() {
      try {
        setLoading(true);
        setApiError("");

        const response = await fetch(getLoginHistoryApiUrl(userId), {
          method: "GET",
          headers: getApiHeaders(),
        });

        if (!response.ok) {
          throw new Error(
            await getApiErrorMessage(response, h.error, h.unauthorized)
          );
        }

        let data = null;

        try {
          data = await response.json();
        } catch {
          data = [];
        }

        const normalizedData = normalizeHistoryResponse(data);
        const mappedHistory = normalizedData.map(mapHistoryItem);

        setHistory(mappedHistory);
      } catch (error) {
        console.error("Login history error:", error);

        setHistory([]);

        if (error?.message === "Failed to fetch") {
          setApiError(h.networkError);
        } else {
          setApiError(error.message || h.error);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchLoginHistory();
  }, [userId, h.error, h.unauthorized, h.networkError]);

  const getStatusLabel = (status) => {
    const normalizedStatus = String(status || "").toLowerCase();

    if (normalizedStatus === "current") return h.current;
    if (
      normalizedStatus === "failed" ||
      normalizedStatus === "failure" ||
      normalizedStatus === "false"
    ) {
      return h.failed;
    }

    return h.success;
  };

  const getStatusClass = (status) => {
    const normalizedStatus = String(status || "").toLowerCase();

    if (normalizedStatus === "current") return "history-current";

    if (
      normalizedStatus === "failed" ||
      normalizedStatus === "failure" ||
      normalizedStatus === "false"
    ) {
      return "history-failed";
    }

    return "history-success";
  };

  return (
    <div className="login-history-overlay" onClick={onClose}>
      <div
        className="login-history-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="login-history-header">
          <div>
            <h2>{h.title}</h2>
            <p>{h.subtitle}</p>
          </div>

          <button className="login-history-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>

        <div className="login-history-content">
          {loading && (
            <div className="login-history-message">{h.loading}</div>
          )}

          {apiError && <div className="login-history-error page-error-banner" role="alert">{apiError}</div>}

          {!loading && !apiError && history.length === 0 && (
            <div className="login-history-message">{h.empty}</div>
          )}

          {!loading && !apiError && history.length > 0 && (
            <div className="login-history-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{h.dateTime}</th>
                    <th>{h.device}</th>
                    <th>{h.ip}</th>
                    <th>{h.location}</th>
                    <th>{h.status}</th>
                  </tr>
                </thead>

                <tbody>
                  {history.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.date}</strong>
                        <span>{item.time}</span>
                      </td>

                      <td>{item.device}</td>
                      <td>{item.ip}</td>
                      <td>{item.location}</td>

                      <td>
                        <span className={getStatusClass(item.status)}>
                          {getStatusLabel(item.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="login-history-actions">
          <button className="login-history-close-action" onClick={onClose}>
            {h.close}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LoginHistory;
