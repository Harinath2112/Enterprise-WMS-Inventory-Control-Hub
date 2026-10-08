import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import "./AdminProfile.css";

import EditProfile from "../EditProfile/EditProfile";
import ChangePassword from "../ChangePassword/ChangePassword";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '').replace(/\/api$/, '');
const DEFAULT_USER_ID = 1;

const PROFILE_ME_API = `${API_BASE_URL}/api/Profile/me`;
const CLAIMS_API = `${API_BASE_URL}/api/auth/claims`;
const getCurrentSessionApi = (userId) =>
  `${API_BASE_URL}/api/LoginHistory/current-session/${userId || DEFAULT_USER_ID}`;
const PROFILE_PHOTO_STORAGE_KEY = "imsAdminProfilePhoto";

const getProfileByIdApi = (userId) =>
  `${API_BASE_URL}/api/Profile/${userId || DEFAULT_USER_ID}`;
const getDeletePhotoApi = (userId) =>
  `${API_BASE_URL}/api/Profile/photo/${userId || DEFAULT_USER_ID}`;
const getChangePasswordApi = (userId) =>
  `${API_BASE_URL}/api/auth/change-password/${userId || DEFAULT_USER_ID}`;

const profileText = {
  english: {
    title: "Admin Profile",
    subtitle: "View and manage your account information",
    accountInfo: "Account Information",
    securityInfo: "Security & Claims",
    fullName: "Full Name",
    email: "Email Address",
    phone: "Phone Number",
    employeeId: "Employee ID",
    department: "Department",
    role: "Role",
    warehouse: "Warehouse",
    lastLogin: "Last Login",
    status: "Account Status",
    permissions: "Permissions",
    claims: "Claims",
    editProfile: "✎ Edit Profile",
    changePassword: "🔒 Change Password",
    logoutAll: "⏻ Logout from all devices",
    loading: "Loading profile...",
    error: "Unable to load profile details.",
    loggingOut: "Logging out all devices...",
    logoutSuccess: "Logged out from all devices successfully.",
    logoutFailed: "Unable to logout all devices.",
    currentPassword: "Current Password",
    newPassword: "New Password",
    confirmPassword: "Confirm Password",
    savePassword: "Update Password",
    cancel: "Cancel",
    passwordMismatch: "New password and confirm password do not match.",
    passwordSuccess: "Password changed successfully.",
    passwordFailed: "Unable to change password.",
  },
  telugu: {
    title: "అడ్మిన్ ప్రొఫైల్",
    subtitle: "మీ అకౌంట్ సమాచారాన్ని చూడండి మరియు నిర్వహించండి",
    accountInfo: "అకౌంట్ సమాచారం",
    securityInfo: "సెక్యూరిటీ & క్లెయిమ్స్",
    fullName: "పూర్తి పేరు",
    email: "ఇమెయిల్ అడ్రస్",
    phone: "ఫోన్ నంబర్",
    employeeId: "ఎంప్లాయీ ID",
    department: "డిపార్ట్‌మెంట్",
    role: "రోల్",
    warehouse: "వేర్‌హౌస్",
    lastLogin: "చివరి లాగిన్",
    status: "అకౌంట్ స్థితి",
    permissions: "పర్మిషన్స్",
    claims: "క్లెయిమ్స్",
    editProfile: "✎ ప్రొఫైల్ ఎడిట్ చేయండి",
    changePassword: "🔒 పాస్‌వర్డ్ మార్చండి",
    logoutAll: "⏻ అన్ని డివైస్‌ల నుండి లాగౌట్",
    loading: "ప్రొఫైల్ లోడ్ అవుతోంది...",
    error: "ప్రొఫైల్ వివరాలు లోడ్ కాలేదు.",
    loggingOut: "అన్ని డివైస్‌ల నుండి లాగౌట్ అవుతోంది...",
    logoutSuccess: "అన్ని డివైస్‌ల నుండి లాగౌట్ అయ్యింది.",
    logoutFailed: "అన్ని డివైస్‌ల నుండి లాగౌట్ కాలేదు.",
    currentPassword: "ప్రస్తుత పాస్‌వర్డ్",
    newPassword: "కొత్త పాస్‌వర్డ్",
    confirmPassword: "పాస్‌వర్డ్ నిర్ధారించండి",
    savePassword: "పాస్‌వర్డ్ అప్‌డేట్ చేయండి",
    cancel: "రద్దు",
    passwordMismatch: "కొత్త పాస్‌వర్డ్ మరియు కన్ఫర్మ్ పాస్‌వర్డ్ సరిపోలలేదు.",
    passwordSuccess: "పాస్‌వర్డ్ విజయవంతంగా మార్చబడింది.",
    passwordFailed: "పాస్‌వర్డ్ మార్చడం సాధ్యపడలేదు.",
  },
  hindi: {
    title: "एडमिन प्रोफाइल",
    subtitle: "अपनी account information देखें और manage करें",
    accountInfo: "Account Information",
    securityInfo: "Security & Claims",
    fullName: "पूरा नाम",
    email: "ईमेल एड्रेस",
    phone: "फोन नंबर",
    employeeId: "Employee ID",
    department: "Department",
    role: "Role",
    warehouse: "Warehouse",
    lastLogin: "Last Login",
    status: "Account Status",
    permissions: "Permissions",
    claims: "Claims",
    editProfile: "✎ Edit Profile",
    changePassword: "🔒 Change Password",
    logoutAll: "⏻ Logout from all devices",
    loading: "Loading profile...",
    error: "Unable to load profile details.",
    loggingOut: "Logging out all devices...",
    logoutSuccess: "Logged out from all devices successfully.",
    logoutFailed: "Unable to logout all devices.",
    currentPassword: "Current Password",
    newPassword: "New Password",
    confirmPassword: "Confirm Password",
    savePassword: "Update Password",
    cancel: "Cancel",
    passwordMismatch: "New password and confirm password do not match.",
    passwordSuccess: "Password changed successfully.",
    passwordFailed: "Unable to change password.",
  },
};

const getStoredValue = (storage, key) => {
  try {
    return storage.getItem(key) || "";
  } catch {
    return "";
  }
};

const safeJsonParse = (value) => {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

const decodeJwtPayload = (token = "") => {
  try {
    const payload = token.split(".")?.[1];
    if (!payload) return null;

    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decodedPayload = atob(
      normalizedPayload.padEnd(
        normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
        "=",
      ),
    );

    return JSON.parse(decodedPayload);
  } catch {
    return null;
  }
};

const getTokenFromObject = (value) => {
  const parsedValue = safeJsonParse(value);

  if (!parsedValue) return "";

  return (
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
};

const getUserIdFromObject = (value) => {
  const parsedValue = safeJsonParse(value);

  if (!parsedValue) return "";

  return (
    parsedValue?.userId ||
    parsedValue?.id ||
    parsedValue?.uid ||
    parsedValue?.data?.userId ||
    parsedValue?.data?.id ||
    parsedValue?.user?.userId ||
    parsedValue?.user?.id ||
    ""
  );
};

const getAuthToken = () => {
  const directKeys = [
    "ims-auth-token",
    "token",
    "authToken",
    "accessToken",
    "jwtToken",
    "bearerToken",
  ];
  const objectKeys = [
    "user",
    "authUser",
    "imsUser",
    "imsAdminUser",
    "loginUser",
    "currentUser",
  ];

  for (const key of directKeys) {
    const localToken = getStoredValue(localStorage, key);
    if (localToken) return localToken;

    const sessionToken = getStoredValue(sessionStorage, key);
    if (sessionToken) return sessionToken;
  }

  for (const key of objectKeys) {
    const localToken = getTokenFromObject(getStoredValue(localStorage, key));
    if (localToken) return localToken;

    const sessionToken = getTokenFromObject(
      getStoredValue(sessionStorage, key),
    );
    if (sessionToken) return sessionToken;
  }

  return "";
};

const getStoredUserId = () => {
  const directKeys = ["userId", "id", "currentUserId", "imsUserId"];
  const objectKeys = [
    "user",
    "authUser",
    "imsUser",
    "imsAdminUser",
    "loginUser",
    "currentUser",
  ];

  for (const key of directKeys) {
    const localUserId = getStoredValue(localStorage, key);
    if (localUserId) return localUserId;

    const sessionUserId = getStoredValue(sessionStorage, key);
    if (sessionUserId) return sessionUserId;
  }

  for (const key of objectKeys) {
    const localUserId = getUserIdFromObject(getStoredValue(localStorage, key));
    if (localUserId) return localUserId;

    const sessionUserId = getUserIdFromObject(
      getStoredValue(sessionStorage, key),
    );
    if (sessionUserId) return sessionUserId;
  }

  const tokenPayload = decodeJwtPayload(getAuthToken());

  return (
    tokenPayload?.userId ||
    tokenPayload?.id ||
    tokenPayload?.sub ||
    tokenPayload?.nameid ||
    tokenPayload?.[
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
    ] ||
    ""
  );
};

const getApiHeaders = () => {
  const token = getAuthToken();

  console.log("TOKEN =", token);

  return {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

async function getApiErrorMessage(response, fallbackMessage) {
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

async function requestJson(
  url,
  options = {},
  fallbackMessage = "Request failed.",
) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getApiHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, fallbackMessage));
  }

  if (response.status === 204) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getStoredProfilePhoto() {
  try {
    return localStorage.getItem(PROFILE_PHOTO_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function saveStoredProfilePhoto(photoUrl) {
  try {
    if (photoUrl) {
      localStorage.setItem(PROFILE_PHOTO_STORAGE_KEY, photoUrl);
    }
  } catch {
    // ignore storage errors
  }
}

function clearStoredProfilePhoto() {
  try {
    localStorage.removeItem(PROFILE_PHOTO_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

function normalizePhotoUrl(photoUrl = "") {
  if (!photoUrl) return "";

  if (
    photoUrl.startsWith("data:") ||
    photoUrl.startsWith("blob:") ||
    photoUrl.startsWith("http://") ||
    photoUrl.startsWith("https://")
  ) {
    return photoUrl;
  }

  if (photoUrl.startsWith("/")) {
    return `${API_BASE_URL}${photoUrl}`;
  }

  return `${API_BASE_URL}/${photoUrl}`;
}

function getAnyProfilePhoto(profile = {}) {
  return normalizePhotoUrl(
    profile?.profilePhoto ||
      profile?.profileImage ||
      profile?.photo ||
      profile?.avatar ||
      profile?.photoUrl ||
      profile?.imageUrl ||
      "",
  );
}

function buildProfileWithPhoto(profile = {}, photoUrl = "") {
  return {
    ...profile,
    profilePhoto: photoUrl,
    profileImage: photoUrl,
    photo: photoUrl,
    avatar: photoUrl,
  };
}

function getFinalProfilePhoto(profile = {}, fallbackProfile = {}) {
  return (
    getAnyProfilePhoto(profile) ||
    getAnyProfilePhoto(fallbackProfile) ||
    getStoredProfilePhoto() ||
    ""
  );
}

function getImageSrc(photoUrl, version) {
  if (!photoUrl) return "";

  if (photoUrl.startsWith("data:") || photoUrl.startsWith("blob:")) {
    return photoUrl;
  }

  return `${photoUrl}${photoUrl.includes("?") ? "&" : "?"}v=${version}`;
}

function formatDateTime(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDeviceName(deviceInfo = "") {
  if (!deviceInfo) return "-";

  if (deviceInfo.includes("Windows")) return "Windows PC";

  if (deviceInfo.includes("Android")) return "Android Phone";

  if (deviceInfo.includes("iPhone")) return "iPhone";

  if (deviceInfo.includes("Mac")) return "Mac";

  return deviceInfo;
}

function normalizeArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === "string") {
    return value
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function mapClaimsToUi(claims = {}) {
  const tokenClaims = decodeJwtPayload(getAuthToken()) || {};
  const source = {
    ...tokenClaims,
    ...(claims || {}),
    ...(claims?.data || {}),
    ...(claims?.user || {}),
  };

  const roleClaim =
    source?.role ||
    source?.roles ||
    source?.roleName ||
    source?.Role ||
    source?.["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ||
    source?.["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role"] ||
    "";

  const permissions = [
    ...normalizeArray(source?.permissions),
    ...normalizeArray(source?.permission),
    ...normalizeArray(source?.Permissions),
  ];

  const roles = normalizeArray(roleClaim);

  return {
    raw: claims || {},
    userId:
      source?.userId ||
      source?.id ||
      source?.sub ||
      source?.nameid ||
      source?.[
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
      ] ||
      "",
    role: roles[0] || roleClaim || "",
    roles,
    permissions: [...new Set(permissions)],
    email: source?.email || source?.Email || source?.unique_name || "",
    name:
      source?.name ||
      source?.Name ||
      source?.userName ||
      source?.UserName ||
      "",
  };
}

function resolveUserId(profile = {}, claims = {}) {
  return (
    profile?.id ||
    profile?.userId ||
    claims?.userId ||
    getStoredUserId() ||
    DEFAULT_USER_ID
  );
}

function mapApiProfileToUi(apiProfile = {}, fallbackProfile = {}, claims = {}) {
  const finalPhoto = getFinalProfilePhoto(apiProfile, fallbackProfile);
  const roleFromClaims = claims?.role || claims?.roles?.[0] || "";
  const nameFromClaims = claims?.name || "";
  const emailFromClaims = claims?.email || "";

  return {
    id:
      apiProfile?.id ||
      apiProfile?.userId ||
      fallbackProfile?.id ||
      fallbackProfile?.userId ||
      claims?.userId ||
      DEFAULT_USER_ID,
    fullName:
      apiProfile?.name ||
      apiProfile?.fullName ||
      apiProfile?.userName ||
      fallbackProfile?.fullName ||
      fallbackProfile?.name ||
      nameFromClaims ||
      "IMS Admin",
    email: apiProfile?.email || fallbackProfile?.email || emailFromClaims || "",
    phone:
      apiProfile?.phoneNumber ||
      apiProfile?.phone ||
      fallbackProfile?.phone ||
      "",
    employeeId:
      apiProfile?.employeeId ||
      apiProfile?.employeeID ||
      fallbackProfile?.employeeId ||
      "",
    department: apiProfile?.department || fallbackProfile?.department || "",
    role:
      apiProfile?.role ||
      apiProfile?.roleName ||
      roleFromClaims ||
      fallbackProfile?.role ||
      "Admin",
    warehouse:
      apiProfile?.warehouse ||
      apiProfile?.warehouseName ||
      fallbackProfile?.warehouse ||
      "",
    profilePhoto: finalPhoto,
    profileImage: finalPhoto,
    photo: finalPhoto,
    avatar: finalPhoto,
    status: apiProfile?.isActive === false ? "Inactive" : "Active",
    isActive: apiProfile?.isActive !== false,
    permissions: claims?.permissions || fallbackProfile?.permissions || [],
    roles: claims?.roles || [],
    lastLogin: formatDateTime(
      apiProfile?.lastLogin ||
        apiProfile?.lastLoginAt ||
        apiProfile?.lastLoginDate ||
        fallbackProfile?.lastLogin,
    ),
  };
}

async function fetchCurrentUserClaimsFromApi() {
  try {
    const data = await requestJson(
      CLAIMS_API,
      { method: "GET" },
      "Unable to load user claims.",
    );
    return mapClaimsToUi(data || {});
  } catch (error) {
    console.warn("Claims API error:", error);
    return mapClaimsToUi({});
  }
}

async function fetchProfileFromApi(userId) {
  const urls = [PROFILE_ME_API, getProfileByIdApi(userId)];
  let lastError = null;

  for (const url of urls) {
    try {
      return await requestJson(
        url,
        { method: "GET" },
        `Profile API failed: ${url}`,
      );
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Profile API failed");
}

async function deleteProfilePhotoFromApi(userId) {
  await requestJson(
    getDeletePhotoApi(userId),
    { method: "DELETE" },
    "Unable to delete profile photo.",
  );
  return true;
}

async function changePasswordFromApi(userId, passwordData) {
  return requestJson(
    getChangePasswordApi(userId),
    {
      method: "PUT",
      body: JSON.stringify({
        currentPassword: passwordData.currentPassword,
        oldPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
        confirmPassword: passwordData.confirmPassword,
      }),
    },
    "Unable to change password.",
  );
}

async function fetchCurrentSession(userId) {
  console.log("Current Session API:", getCurrentSessionApi(userId));

  return requestJson(
    getCurrentSessionApi(userId),
    { method: "GET" },
    "Unable to load current session.",
  );
}

function AdminProfile({
  adminProfile,
  settingsData,
  onClose,
  onLogout,
  onUpdateProfile,
}) {
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const [profileData, setProfileData] = useState(() => {
    const initialPhoto = getFinalProfilePhoto(adminProfile || {});
    return buildProfileWithPhoto(adminProfile || {}, initialPhoto);
  });

  const [claimsData, setClaimsData] = useState(() => mapClaimsToUi({}));
  const [currentUserId, setCurrentUserId] = useState(() =>
    resolveUserId(adminProfile || {}, mapClaimsToUi({})),
  );
  const [photoVersion, setPhotoVersion] = useState(Date.now());
  const [imageFailed, setImageFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [apiMessage, setApiMessage] = useState("");

  const [currentSession, setCurrentSession] = useState(null);

  const lang = settingsData?.language || "english";
  const p = profileText[lang] || profileText.english;

  const permissionsText = useMemo(() => {
    const permissions = profileData?.permissions?.length
      ? profileData.permissions
      : claimsData.permissions;
    return permissions?.length ? permissions.join(", ") : "-";
  }, [claimsData.permissions, profileData.permissions]);

  const claimsText = useMemo(() => {
    const roles = claimsData.roles?.length
      ? claimsData.roles.join(", ")
      : profileData?.role || "-";
    return `User ID: ${currentUserId || "-"} | Role: ${roles}`;
  }, [claimsData.roles, currentUserId, profileData?.role]);

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
    if (!adminProfile) return;

    const finalPhoto = getFinalProfilePhoto(adminProfile, profileData);

    setProfileData((previousProfile) =>
      buildProfileWithPhoto(
        {
          ...previousProfile,
          ...adminProfile,
        },
        finalPhoto,
      ),
    );

    setCurrentUserId(resolveUserId(adminProfile, claimsData));
    setImageFailed(false);
    setPhotoVersion(Date.now());
  }, [adminProfile]);

  useEffect(() => {
    const handlePhotoUpdated = (event) => {
      const updatedProfile = event.detail || {};
      const finalPhoto = getAnyProfilePhoto(updatedProfile);

      if (!finalPhoto) return;

      const finalProfile = buildProfileWithPhoto(
        {
          ...profileData,
          ...updatedProfile,
        },
        finalPhoto,
      );

      setProfileData(finalProfile);
      setImageFailed(false);
      setPhotoVersion(Date.now());
      saveStoredProfilePhoto(finalPhoto);

      if (typeof onUpdateProfile === "function") {
        onUpdateProfile(finalProfile);
      }
    };

    window.addEventListener("imsAdminProfilePhotoUpdated", handlePhotoUpdated);

    return () => {
      window.removeEventListener(
        "imsAdminProfilePhotoUpdated",
        handlePhotoUpdated,
      );
    };
  }, [profileData, onUpdateProfile]);

  useEffect(() => {
    let mounted = true;

    async function loadProfileAndClaims() {
      console.log("Profile loading...");
      try {
        setLoading(true);
        setApiError("");
        setApiMessage("");

        const claims = await fetchCurrentUserClaimsFromApi();
        const resolvedUserId = resolveUserId(adminProfile || {}, claims);
        const data = await fetchProfileFromApi(resolvedUserId);
        console.log("UserId =", resolvedUserId);
        console.log("Calling:", getCurrentSessionApi(resolvedUserId));

        const mappedProfile = mapApiProfileToUi(
          data || {},
          adminProfile || {},
          claims,
        );
        const finalUserId = resolveUserId(mappedProfile, claims);
        const session = await fetchCurrentSession(finalUserId);

        if (!mounted) return;

        setClaimsData(claims);
        setCurrentUserId(finalUserId);
        setProfileData(mappedProfile);
        setCurrentSession(session);

        setImageFailed(false);
        setPhotoVersion(Date.now());

        if (typeof onUpdateProfile === "function") {
          onUpdateProfile(mappedProfile);
        }
      } catch (error) {
        console.error("Profile fetch error:", error);

        if (!mounted) return;

        const hasFallbackData =
          Boolean(adminProfile) ||
          Boolean(profileData?.fullName) ||
          Boolean(profileData?.email);

        if (!hasFallbackData) {
          setApiError(error.message || p.error);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadProfileAndClaims();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSaveProfile = (updatedProfile) => {
    const finalPhoto =
      getAnyProfilePhoto(updatedProfile) || getAnyProfilePhoto(profileData);

    const finalProfile = buildProfileWithPhoto(
      {
        ...profileData,
        ...updatedProfile,
      },
      finalPhoto,
    );

    setProfileData(finalProfile);
    setCurrentUserId(resolveUserId(finalProfile, claimsData));
    setImageFailed(false);
    setPhotoVersion(Date.now());

    if (finalPhoto) {
      saveStoredProfilePhoto(finalPhoto);
    }

    if (typeof onUpdateProfile === "function") {
      onUpdateProfile(finalProfile);
    }
  };

  const handleAvatarImageError = () => {
    clearStoredProfilePhoto();
    setImageFailed(true);
    setPhotoVersion(Date.now());
    setProfileData((previousProfile) =>
      buildProfileWithPhoto(previousProfile, ""),
    );
  };

  const handleLogoutAllDevices = () => {
    // Open the existing Logout Confirmation screen.
    // The real /api/auth/logout-all-devices/{userId} request is handled there.
    if (typeof onLogout === "function") {
      onClose();
      onLogout();
      return;
    }

    onClose();
  };

  const profilePhoto = imageFailed ? "" : getAnyProfilePhoto(profileData);
  const profilePhotoSrc = getImageSrc(profilePhoto, photoVersion);

  return (
    <>
      <div className="profile-overlay" onClick={onClose}>
        <div
          className="profile-modal"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="profile-header">
            <div>
              <h2>{p.title}</h2>
            </div>

            <button
              className="profile-close-btn"
              onClick={onClose}
              type="button"
              aria-label="Close profile"
            >
              <X size={16} />
            </button>
          </div>

          {loading && <div className="profile-api-message">{p.loading}</div>}
          {apiMessage && (
            <div className="profile-api-message">{apiMessage}</div>
          )}
          {apiError && <div className="profile-api-error page-error-banner" role="alert">{apiError}</div>}

          <div className="profile-user-card">
            <div className="profile-avatar">
              {profilePhotoSrc ? (
                <img
                  key={`${profilePhotoSrc}-${photoVersion}`}
                  src={profilePhotoSrc}
                  alt="Profile"
                  onError={handleAvatarImageError}
                />
              ) : (
                profileData?.fullName?.charAt(0)?.toUpperCase() || "I"
              )}
            </div>

            <div className="profile-user-details">
              <div className="profile-name-row">
                <h3>{profileData?.fullName || "-"}</h3>
                <span className="profile-role-badge">
                  {profileData?.role || "-"}
                </span>
              </div>

              <p>{profileData?.email || "-"}</p>
            </div>

            <span className="profile-active-badge">
              {profileData?.status || "-"}
            </span>
          </div>

          <h4 className="profile-section-title">{p.accountInfo}</h4>

          <div className="profile-grid">
            <div className="profile-info-box">
              <label>{p.fullName}</label>
              <p>{profileData?.fullName || "-"}</p>
            </div>

            <div className="profile-info-box">
              <label>{p.email}</label>
              <p>{profileData?.email || "-"}</p>
            </div>

            <div className="profile-info-box">
              <label>{p.phone}</label>
              <p>{profileData?.phone ? `+91 ${profileData.phone}` : "-"}</p>
            </div>

            <div className="profile-info-box">
              <label>{p.employeeId}</label>
              <p>{profileData?.employeeId || "-"}</p>
            </div>

            <div className="profile-info-box">
              <label>{p.department}</label>
              <p>{profileData?.department || "-"}</p>
            </div>

            <div className="profile-info-box">
              <label>{p.role}</label>
              <p>{profileData?.role || "-"}</p>
            </div>

            <div className="profile-info-box">
              <label>{p.warehouse}</label>
              <p>{profileData?.warehouse || "-"}</p>
            </div>

            <div className="profile-info-box">
              <label>{p.lastLogin}</label>
              <p>{profileData?.lastLogin || "-"}</p>
            </div>

            <div className="profile-info-box">
              <label>{p.status}</label>
              <p>
                <span className="profile-active-badge small">
                  {profileData?.status || "-"}
                </span>
              </p>
            </div>
          </div>

          <h4 className="profile-section-title">{p.securityInfo}</h4>

          <div className="profile-grid">
            <div className="profile-info-box">
              <label>User ID</label>
              <p>{currentUserId || "-"}</p>
            </div>

            <div className="profile-info-box">
              <label>{p.claims}</label>
              <p>{claimsText}</p>
            </div>

            <div className="profile-info-box">
              <label>{p.permissions}</label>
              <p>{permissionsText}</p>
            </div>
          </div>

          <h4 className="profile-section-title">Current Session</h4>

          <div className="profile-grid">
            <div className="profile-info-box">
              <label>Browser</label>
              <p>{currentSession?.browser || "-"}</p>
            </div>

            <div className="profile-info-box">
              <label>Operating System</label>
              <p>{currentSession?.operatingSystem || "-"}</p>
            </div>

            <div className="profile-info-box">
              <label>Device</label>
              <p>{getDeviceName(currentSession?.deviceInfo)}</p>
            </div>

            <div className="profile-info-box">
              <label>IP Address</label>
              <p>{currentSession?.ipAddress || "-"}</p>
            </div>

            <div className="profile-info-box">
              <label>Login Time</label>
              <p>{formatDateTime(currentSession?.loginTime)}</p>
            </div>

            <div className="profile-info-box">
              <label>Current Session</label>
              <p>{currentSession?.isCurrentSession ? "✅ Yes" : "❌ No"}</p>
            </div>
          </div>

          <div className="profile-actions">
            <button
              className="profile-edit-btn"
              onClick={() => setShowEditProfile(true)}
              type="button"
            >
              {p.editProfile}
            </button>

            <button
              className="profile-password-btn"
              onClick={() => setShowChangePassword(true)}
              type="button"
            >
              {p.changePassword}
            </button>

            <button
              className="profile-logout-all-btn"
              onClick={handleLogoutAllDevices}
              type="button"
            >
              {p.logoutAll}
            </button>
          </div>
        </div>
      </div>

      {showEditProfile && (
        <EditProfile
          adminProfile={profileData}
          settingsData={settingsData}
          onClose={() => setShowEditProfile(false)}
          onSaveProfile={handleSaveProfile}
          onDeleteProfilePhoto={() => deleteProfilePhotoFromApi(currentUserId)}
        />
      )}

      {showChangePassword && (
        <ChangePassword
          settingsData={settingsData}
          onClose={() => setShowChangePassword(false)}
        />
      )}
    </>
  );
}

export default AdminProfile;
