import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { getNameError, sanitizeNameInput } from "../../validators/nameValidator";
import { getEmailError } from "../../validators/emailValidator";
import "./EditProfile.css";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '').replace(/\/api$/, '');
const FALLBACK_USER_ID = 1;

const PROFILE_PHOTO_STORAGE_KEY = "imsAdminProfilePhoto";

const editText = {
  english: {
    title: "Edit Profile",
    subtitle: "Update your account information",
    changePhoto: "Change Photo",
    removePhoto: "Remove Photo",
    removingPhoto: "Removing...",
    photoHint: "JPG, PNG up to 2MB",
    fullName: "Full Name",
    email: "Email Address",
    phone: "Phone Number",
    employeeId: "Employee ID",
    department: "Department",
    role: "Role",
    warehouse: "Warehouse",
    selectDepartment: "Select Department",
    selectWarehouse: "Select Warehouse",
    cancel: "Cancel",
    update: "Update Profile",
    updating: "Updating...",
    loading: "Loading profile...",
    success: "Profile updated successfully",
    photoRemoved: "Profile photo removed successfully",
    updateFailed: "Profile update failed. Please try again.",
    loadFailed: "Profile details failed to load.",
    photoInvalid: "Please select JPG or PNG image below 2MB.",
    photoUploadFailed: "Profile photo upload failed.",
    photoRemoveFailed: "Profile photo remove failed.",
    fullNameRequired: "Full name is required",
    fullNameInvalid: "Full name can only contain letters, spaces, dots, hyphens, and apostrophes, and must contain at least one letter",
    emailRequired: "Email is required",
    emailInvalid: "Enter valid email address",
    phoneRequired: "Phone number is required",
    phoneInvalid: "Phone number must be exactly 10 digits",
    employeeRequired: "Employee ID is required",
    departmentRequired: "Department is required",
    warehouseRequired: "Warehouse is required",
  },
  telugu: {
    title: "ప్రొఫైల్ ఎడిట్ చేయండి",
    subtitle: "మీ అకౌంట్ సమాచారాన్ని అప్‌డేట్ చేయండి",
    changePhoto: "ఫోటో మార్చండి",
    removePhoto: "ఫోటో తొలగించండి",
    removingPhoto: "తొలగిస్తోంది...",
    photoHint: "JPG, PNG 2MB వరకు",
    fullName: "పూర్తి పేరు",
    email: "ఇమెయిల్ అడ్రస్",
    phone: "ఫోన్ నంబర్",
    employeeId: "ఎంప్లాయీ ID",
    department: "డిపార్ట్‌మెంట్",
    role: "రోల్",
    warehouse: "వేర్‌హౌస్",
    selectDepartment: "డిపార్ట్‌మెంట్ ఎంచుకోండి",
    selectWarehouse: "వేర్‌హౌస్ ఎంచుకోండి",
    cancel: "రద్దు",
    update: "ప్రొఫైల్ అప్‌డేట్ చేయండి",
    updating: "అప్‌డేట్ అవుతోంది...",
    loading: "ప్రొఫైల్ లోడ్ అవుతోంది...",
    success: "ప్రొఫైల్ విజయవంతంగా అప్‌డేట్ అయింది",
    photoRemoved: "ప్రొఫైల్ ఫోటో తొలగించబడింది",
    updateFailed: "ప్రొఫైల్ అప్‌డేట్ కాలేదు. మళ్లీ ప్రయత్నించండి.",
    loadFailed: "ప్రొఫైల్ వివరాలు లోడ్ కాలేదు.",
    photoInvalid: "2MB కంటే తక్కువ JPG లేదా PNG ఇమేజ్ మాత్రమే ఎంచుకోండి.",
    photoUploadFailed: "ప్రొఫైల్ ఫోటో అప్‌లోడ్ కాలేదు.",
    photoRemoveFailed: "ప్రొఫైల్ ఫోటో తొలగించలేకపోయాం.",
    fullNameRequired: "పూర్తి పేరు అవసరం",
    fullNameInvalid: "పూర్తి పేరులో అక్షరాలు, గుర్తులు మరియు ఖాళీలు మాత్రమే ఉండాలి, మరియు కనీసం ఒక అక్షరం ఉండాలి",
    emailRequired: "ఇమెయిల్ అవసరం",
    emailInvalid: "సరైన ఇమెయిల్ అడ్రస్ ఇవ్వండి",
    phoneRequired: "ఫోన్ నంబర్ అవసరం",
    phoneInvalid: "ఫోన్ నంబర్ ఖచ్చితంగా 10 అంకెలు ఉండాలి",
    employeeRequired: "ఎంప్లాయీ ID అవసరం",
    departmentRequired: "డిపార్ట్‌మెంట్ అవసరం",
    warehouseRequired: "వేర్‌హౌస్ అవసరం",
  },
  hindi: {
    title: "Edit Profile",
    subtitle: "अपनी account information update करें",
    changePhoto: "Change Photo",
    removePhoto: "Remove Photo",
    removingPhoto: "Removing...",
    photoHint: "JPG, PNG up to 2MB",
    fullName: "पूरा नाम",
    email: "ईमेल एड्रेस",
    phone: "फोन नंबर",
    employeeId: "Employee ID",
    department: "Department",
    role: "Role",
    warehouse: "Warehouse",
    selectDepartment: "Select Department",
    selectWarehouse: "Select Warehouse",
    cancel: "Cancel",
    update: "Update Profile",
    updating: "Updating...",
    loading: "Loading profile...",
    success: "Profile updated successfully",
    photoRemoved: "Profile photo removed successfully",
    updateFailed: "Profile update failed. Please try again.",
    loadFailed: "Profile details failed to load.",
    photoInvalid: "Please select JPG or PNG image below 2MB.",
    photoUploadFailed: "Profile photo upload failed.",
    photoRemoveFailed: "Profile photo remove failed.",
    fullNameRequired: "Full name required है",
    fullNameInvalid: "पूरा नाम में केवल अक्षर, रिक्त स्थान और मानक वर्ण होने चाहिए, और कम से कम एक अक्षर होना चाहिए",
    emailRequired: "Email required है",
    emailInvalid: "Valid email address enter करें",
    phoneRequired: "Phone number required है",
    phoneInvalid: "Phone number exactly 10 digits होना चाहिए",
    employeeRequired: "Employee ID required है",
    departmentRequired: "Department required है",
    warehouseRequired: "Warehouse required है",
  },
};

function getStoredValue(storage, key) {
  try {
    return storage.getItem(key) || "";
  } catch {
    return "";
  }
}

function parseJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function cleanToken(token) {
  if (!token) return "";
  const value = String(token).trim();
  return value.toLowerCase().startsWith("bearer ")
    ? value.slice(7).trim()
    : value;
}

function getTokenFromObject(value) {
  const parsedValue = parseJson(value);

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
    parsedValue?.user?.token ||
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

function getCurrentUserId(profile = {}) {
  const profileId =
    profile?.id ||
    profile?.userId ||
    profile?.userID ||
    profile?.adminId ||
    "";

  if (profileId) return profileId;

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

function getJsonHeaders() {
  const token = getAuthToken();

  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getUploadHeaders() {
  const token = getAuthToken();

  return {
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getProfileApiUrl(userId) {
  return `${API_BASE_URL}/api/Profile/${userId || FALLBACK_USER_ID}`;
}

function getUploadPhotoApiUrl(userId) {
  return `${API_BASE_URL}/api/Profile/upload-photo/${userId || FALLBACK_USER_ID}`;
}

function getDeletePhotoApiUrl(userId) {
  return `${API_BASE_URL}/api/Profile/photo/${userId || FALLBACK_USER_ID}`;
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
    // ignore storage error
  }
}

function clearStoredProfilePhoto() {
  try {
    localStorage.removeItem(PROFILE_PHOTO_STORAGE_KEY);
  } catch {
    // ignore storage error
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

function getProfilePhoto(profile = {}) {
  return (
    normalizePhotoUrl(
      profile?.profilePhoto ||
      profile?.profileImage ||
      profile?.photo ||
      profile?.avatar ||
      profile?.photoUrl ||
      profile?.imageUrl ||
      profile?.picture ||
      ""
    ) ||
    getStoredProfilePhoto() ||
    ""
  );
}

function makeProfileWithPhoto(profile, photoUrl) {
  return {
    ...profile,
    profilePhoto: photoUrl,
    profileImage: photoUrl,
    photo: photoUrl,
    avatar: photoUrl,
  };
}

function getCleanString(value) {
  return value == null ? "" : String(value).trim();
}

function mapApiToUiProfile(apiData = {}, fallbackData = {}) {
  const apiProfile = apiData?.data || apiData?.profile || apiData || {};
  const finalPhoto = getProfilePhoto({
    ...fallbackData,
    ...apiProfile,
  });

  return {
    id:
      apiProfile?.id ||
      apiProfile?.userId ||
      fallbackData?.id ||
      fallbackData?.userId ||
      FALLBACK_USER_ID,
    userId:
      apiProfile?.userId ||
      apiProfile?.id ||
      fallbackData?.userId ||
      fallbackData?.id ||
      FALLBACK_USER_ID,
    fullName:
      apiProfile?.name ||
      apiProfile?.fullName ||
      apiProfile?.userName ||
      fallbackData?.fullName ||
      "",
    email: apiProfile?.email || fallbackData?.email || "",
    phone:
      apiProfile?.phoneNumber ||
      apiProfile?.phone ||
      fallbackData?.phone ||
      "",
    employeeId:
      apiProfile?.employeeId ||
      apiProfile?.employeeID ||
      fallbackData?.employeeId ||
      "",
    department: apiProfile?.department || fallbackData?.department || "",
    role: apiProfile?.role || fallbackData?.role || "Admin",
    warehouse: apiProfile?.warehouse || fallbackData?.warehouse || "",
    profilePhoto: finalPhoto,
    profileImage: finalPhoto,
    photo: finalPhoto,
    avatar: finalPhoto,
    status: apiProfile?.isActive === false ? "Inactive" : "Active",
    isActive: apiProfile?.isActive !== false,
    lastLogin: apiProfile?.lastLogin || fallbackData?.lastLogin || "",
  };
}

async function getApiErrorMessage(response, fallbackMessage) {
  try {
    const data = await response.json();

    if (typeof data === "string") return data;
    if (data?.message) return data.message;
    if (data?.error) return data.error;
    if (data?.title && !data?.errors) return data.title;

    if (data?.errors && typeof data.errors === "object") {
      const validationMessages = Object.entries(data.errors)
        .flatMap(([field, messages]) => {
          if (Array.isArray(messages)) {
            return messages.map((message) => `${field}: ${message}`);
          }

          return [`${field}: ${messages}`];
        })
        .join(" | ");

      return validationMessages || data?.title || fallbackMessage;
    }

    return fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

async function readJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Unable to read image"));

    reader.readAsDataURL(file);
  });
}

function getUploadedPhotoUrl(responseData, fallbackPreview) {
  if (typeof responseData === "string") {
    return normalizePhotoUrl(responseData);
  }

  return (
    normalizePhotoUrl(
      responseData?.profilePhoto ||
      responseData?.profileImage ||
      responseData?.photo ||
      responseData?.avatar ||
      responseData?.photoUrl ||
      responseData?.imageUrl ||
      responseData?.url ||
      responseData?.fileUrl ||
      responseData?.path ||
      responseData?.data?.profilePhoto ||
      responseData?.data?.profileImage ||
      responseData?.data?.photo ||
      responseData?.data?.photoUrl ||
      responseData?.data?.imageUrl ||
      responseData?.data?.url ||
      responseData?.data?.fileUrl ||
      responseData?.data?.path ||
      ""
    ) ||
    fallbackPreview ||
    ""
  );
}

async function fetchProfileDetails(userId, fallbackMessage) {
  const response = await fetch(getProfileApiUrl(userId), {
    method: "GET",
    headers: getJsonHeaders(),
  });

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, fallbackMessage));
  }

  return await readJsonSafely(response);
}

function getProfileUpdatePayloads(formData) {
  const userId = Number(formData.id || formData.userId || FALLBACK_USER_ID);

  const fullName = getCleanString(formData.fullName);
  const email = getCleanString(formData.email);
  const phone = getCleanString(formData.phone);
  const employeeId = getCleanString(formData.employeeId);
  const department = getCleanString(formData.department);
  const role = getCleanString(formData.role || "Admin");
  const warehouse = getCleanString(formData.warehouse);
  const isActive = formData.status !== "Inactive";

  return [
    {
      userId,
      fullName,
      email,
      phoneNumber: phone,
      employeeId,
      department,
      role,
      warehouse,
      isActive,
    },
    {
      id: userId,
      fullName,
      email,
      phoneNumber: phone,
      employeeId,
      department,
      role,
      warehouse,
      isActive,
    },
    {
      userId,
      name: fullName,
      email,
      phoneNumber: phone,
      employeeId,
      department,
      role,
      warehouse,
      isActive,
    },
    {
      id: userId,
      name: fullName,
      email,
      phoneNumber: phone,
      employeeId,
      department,
      role,
      warehouse,
      isActive,
    },
    {
      fullName,
      email,
      phoneNumber: phone,
      employeeId,
      department,
      warehouse,
    },
  ];
}

async function updateProfileDetails(userId, payloads, fallbackMessage) {
  const list = Array.isArray(payloads) ? payloads : [payloads];
  let lastError = null;

  for (const payload of list) {
    try {
      const response = await fetch(getProfileApiUrl(userId), {
        method: "PUT",
        headers: getJsonHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        lastError = new Error(await getApiErrorMessage(response, fallbackMessage));
        continue;
      }

      try {
        return await response.json();
      } catch {
        return payload;
      }
    } catch (error) {
      if (error?.message === "Failed to fetch") {
        throw new Error(
          "Failed to fetch. Backend CORS/ngrok is blocking PUT /api/Profile/{userId}."
        );
      }

      lastError = error;
    }
  }

  throw lastError || new Error(fallbackMessage);
}

async function uploadProfilePhoto(userId, file, fallbackPreview, errorMessage) {
  const formData = new FormData();

  formData.append("file", file);
  formData.append("photo", file);
  formData.append("profilePhoto", file);

  const response = await fetch(getUploadPhotoApiUrl(userId), {
    method: "POST",
    headers: getUploadHeaders(),
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, errorMessage));
  }

  const responseData = await readJsonSafely(response);
  return getUploadedPhotoUrl(responseData, fallbackPreview);
}

async function deleteProfilePhoto(userId, fallbackMessage) {
  const response = await fetch(getDeletePhotoApiUrl(userId), {
    method: "DELETE",
    headers: getJsonHeaders(),
  });

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, fallbackMessage));
  }

  return true;
}

function EditProfile({ adminProfile, settingsData, onClose, onSaveProfile }) {
  const photoInputRef = useRef(null);

  const activeUserId = getCurrentUserId(adminProfile);
  const initialPhoto = getProfilePhoto(adminProfile);

  const [formData, setFormData] = useState({
    id: adminProfile?.id || adminProfile?.userId || activeUserId,
    userId: adminProfile?.userId || adminProfile?.id || activeUserId,
    fullName: adminProfile?.fullName || "",
    email: adminProfile?.email || "",
    phone: adminProfile?.phone || "",
    employeeId: adminProfile?.employeeId || "",
    department: adminProfile?.department || "",
    role: adminProfile?.role || "Admin",
    warehouse: adminProfile?.warehouse || "",
    profilePhoto: initialPhoto,
    profileImage: initialPhoto,
    photo: initialPhoto,
    avatar: initialPhoto,
    status: adminProfile?.status || "Active",
    lastLogin: adminProfile?.lastLogin || "",
  });

  const [previewPhoto, setPreviewPhoto] = useState(initialPhoto);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const [apiError, setApiError] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);

  const lang = settingsData?.language || "english";
  const e = editText[lang] || editText.english;

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        setLoadingProfile(true);
        setApiError("");

        const apiData = await fetchProfileDetails(activeUserId, e.loadFailed);

        if (!isMounted) return;

        const mappedProfile = mapApiToUiProfile(apiData, adminProfile || {});
        const latestPhoto = getProfilePhoto(mappedProfile);

        setFormData(mappedProfile);
        setPreviewPhoto(latestPhoto);

        if (latestPhoto) {
          saveStoredProfilePhoto(latestPhoto);
        }

        if (typeof onSaveProfile === "function") {
          onSaveProfile(mappedProfile);
        }
      } catch (error) {
        console.error("Load profile error:", error);

        const hasFallbackData =
          Boolean(adminProfile?.fullName) ||
          Boolean(adminProfile?.email) ||
          Boolean(formData?.fullName) ||
          Boolean(formData?.email);

        if (isMounted && !hasFallbackData) {
          setApiError(error.message || e.loadFailed);
        }
      } finally {
        if (isMounted) {
          setLoadingProfile(false);
        }
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUserId]);

  useEffect(() => {
    const latestPhoto = getProfilePhoto(adminProfile);

    setFormData((previousData) => ({
      ...previousData,
      id: adminProfile?.id || adminProfile?.userId || previousData.id || activeUserId,
      userId: adminProfile?.userId || adminProfile?.id || previousData.userId || activeUserId,
      fullName: adminProfile?.fullName || previousData.fullName,
      email: adminProfile?.email || previousData.email,
      phone: adminProfile?.phone || previousData.phone,
      employeeId: adminProfile?.employeeId || previousData.employeeId,
      department: adminProfile?.department || previousData.department,
      role: adminProfile?.role || previousData.role || "Admin",
      warehouse: adminProfile?.warehouse || previousData.warehouse,
      profilePhoto: latestPhoto || previousData.profilePhoto,
      profileImage: latestPhoto || previousData.profileImage,
      photo: latestPhoto || previousData.photo,
      avatar: latestPhoto || previousData.avatar,
      status: adminProfile?.status || previousData.status || "Active",
      lastLogin: adminProfile?.lastLogin || previousData.lastLogin,
    }));

    if (latestPhoto) {
      setPreviewPhoto(latestPhoto);
    }
  }, [adminProfile, activeUserId]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (
        event.key === "Escape" &&
        !saving &&
        !uploadingPhoto &&
        !removingPhoto &&
        !loadingProfile
      ) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, saving, uploadingPhoto, removingPhoto, loadingProfile]);

  const syncProfileToParent = (updatedData) => {
    const finalPhoto = updatedData.profilePhoto || "";
    const finalProfile = makeProfileWithPhoto(
      {
        ...adminProfile,
        ...updatedData,
      },
      finalPhoto
    );

    if (finalPhoto) {
      saveStoredProfilePhoto(finalPhoto);
    } else {
      clearStoredProfilePhoto();
    }

    if (typeof onSaveProfile === "function") {
      onSaveProfile(finalProfile);
    }

    window.dispatchEvent(
      new CustomEvent("imsAdminProfilePhotoUpdated", {
        detail: finalProfile,
      })
    );
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setErrors((previousErrors) => ({
      ...previousErrors,
      [name]: "",
    }));

    setApiError("");
    setSuccessMessage("");

    if (name === "phone") {
      setFormData((previousData) => ({
        ...previousData,
        phone: value.replace(/\D/g, "").slice(0, 10),
      }));
      return;
    }

    if (name === "fullName") {
      setFormData((previousData) => ({
        ...previousData,
        fullName: sanitizeNameInput(value),
      }));
      return;
    }

    setFormData((previousData) => ({
      ...previousData,
      [name]: value,
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    const fullNameError = getNameError(formData.fullName, { required: true, label: e.fullName });
    if (fullNameError) {
      newErrors.fullName = fullNameError;
    }

    const emailErr = getEmailError(formData.email, { required: true, label: e.email });
    if (emailErr) {
      newErrors.email = emailErr;
    }

    if (!formData.phone.trim()) {
      newErrors.phone = e.phoneRequired;
    } else if (!/^\d{10}$/.test(formData.phone)) {
      newErrors.phone = e.phoneInvalid;
    }

    if (!formData.employeeId.trim()) {
      newErrors.employeeId = e.employeeRequired;
    }

    if (!formData.department) {
      newErrors.department = e.departmentRequired;
    }

    if (!formData.warehouse) {
      newErrors.warehouse = e.warehouseRequired;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePhotoButtonClick = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (photoInputRef.current) {
      photoInputRef.current.click();
    }
  };

  const handlePhotoUpload = async (event) => {
    event.stopPropagation();

    const file = event.target.files?.[0];

    if (!file) return;

    const isValidImage =
      file.type === "image/jpeg" ||
      file.type === "image/jpg" ||
      file.type === "image/png" ||
      file.type.startsWith("image/");

    const isValidSize = file.size <= 2 * 1024 * 1024;

    if (!isValidImage || !isValidSize) {
      setApiError(e.photoInvalid);

      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }

      return;
    }

    const oldPreviewPhoto = previewPhoto;

    try {
      setUploadingPhoto(true);
      setApiError("");
      setSuccessMessage("");

      const localPreviewUrl = await readFileAsDataUrl(file);
      setPreviewPhoto(localPreviewUrl);

      const uploadedPhotoUrl = await uploadProfilePhoto(
        activeUserId,
        file,
        localPreviewUrl,
        e.photoUploadFailed
      );

      const updatedData = makeProfileWithPhoto(
        {
          ...formData,
          id: formData.id || activeUserId,
          userId: formData.userId || activeUserId,
        },
        uploadedPhotoUrl
      );

      setFormData(updatedData);
      setPreviewPhoto(uploadedPhotoUrl);
      saveStoredProfilePhoto(uploadedPhotoUrl);
      syncProfileToParent(updatedData);
    } catch (error) {
      console.error("Photo upload error:", error);
      setApiError(error.message || e.photoUploadFailed);
      setPreviewPhoto(oldPreviewPhoto);
    } finally {
      setUploadingPhoto(false);

      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
    }
  };

  const handleRemovePhoto = async () => {
    if (!previewPhoto || removingPhoto || saving || uploadingPhoto) return;

    try {
      setRemovingPhoto(true);
      setApiError("");
      setSuccessMessage("");

      await deleteProfilePhoto(activeUserId, e.photoRemoveFailed);

      const updatedData = makeProfileWithPhoto(
        {
          ...formData,
          id: formData.id || activeUserId,
          userId: formData.userId || activeUserId,
        },
        ""
      );

      setFormData(updatedData);
      setPreviewPhoto("");
      clearStoredProfilePhoto();
      syncProfileToParent(updatedData);
      setSuccessMessage(e.photoRemoved);
    } catch (error) {
      console.error("Photo remove error:", error);
      setApiError(error.message || e.photoRemoveFailed);
    } finally {
      setRemovingPhoto(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);
      setApiError("");
      setSuccessMessage("");

      const finalFormData = {
        ...formData,
        id: formData.id || activeUserId,
        userId: formData.userId || activeUserId,
        profilePhoto: previewPhoto || formData.profilePhoto || "",
      };

      const responseData = await updateProfileDetails(
        activeUserId,
        getProfileUpdatePayloads(finalFormData),
        e.updateFailed
      );

      const updatedProfile = mapApiToUiProfile(responseData, finalFormData);

      if (updatedProfile.profilePhoto) {
        saveStoredProfilePhoto(updatedProfile.profilePhoto);
      }

      setFormData(updatedProfile);
      setPreviewPhoto(updatedProfile.profilePhoto || "");
      syncProfileToParent(updatedProfile);

      setSuccessMessage(e.success);

      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 900);
    } catch (error) {
      console.error("Profile update error:", error);
      setApiError(error.message || e.updateFailed);
    } finally {
      setSaving(false);
    }
  };

  const isBusy = loadingProfile || saving || uploadingPhoto || removingPhoto;

  return (
    <div
      className="edit-profile-overlay"
      onClick={!isBusy ? onClose : undefined}
    >
      <div
        className="edit-profile-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="edit-profile-header">
          <div>
            <h2>{e.title}</h2>
          </div>

          <button
            className="edit-profile-close-btn"
            onClick={onClose}
            disabled={isBusy}
            type="button"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        <div className="edit-profile-body">
          {loadingProfile && (
            <div className="edit-success-message">{e.loading}</div>
          )}

          {successMessage && (
            <div className="edit-success-message">{successMessage}</div>
          )}

          {apiError && <div className="edit-api-error page-error-banner" role="alert">{apiError}</div>}

          <div className="edit-photo-section">
            <div className="edit-avatar">
              {previewPhoto ? (
                <img key={previewPhoto} src={previewPhoto} alt="Profile" />
              ) : (
                formData.fullName?.charAt(0)?.toUpperCase() || "I"
              )}
            </div>

            <div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/*"
                onChange={handlePhotoUpload}
                onClick={(event) => event.stopPropagation()}
                style={{ display: "none" }}
              />

              <button
                className="change-photo-btn"
                type="button"
                onClick={handlePhotoButtonClick}
                disabled={isBusy}
              >
                {uploadingPhoto ? "Uploading..." : e.changePhoto}
              </button>

              {previewPhoto && (
                <button
                  className="change-photo-btn"
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={isBusy}
                  style={{ marginLeft: "10px" }}
                >
                  {removingPhoto ? e.removingPhoto : e.removePhoto}
                </button>
              )}

              <p>{e.photoHint}</p>
            </div>
          </div>

          <div className="edit-form-grid">
            <div className="edit-form-group full-width">
              <label>{e.fullName}</label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                maxLength={50}
                disabled={isBusy}
              />
              {errors.fullName && <small>{errors.fullName}</small>}
            </div>

            <div className="edit-form-group">
              <label>{e.email}</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                disabled={isBusy}
              />
              {errors.email && <small>{errors.email}</small>}
            </div>

            <div className="edit-form-group">
              <label>{e.phone}</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                maxLength="10"
                disabled={isBusy}
              />
              {errors.phone && <small>{errors.phone}</small>}
            </div>

            <div className="edit-form-group">
              <label>{e.employeeId}</label>
              <input
                type="text"
                name="employeeId"
                value={formData.employeeId}
                onChange={handleChange}
                disabled={isBusy}
              />
              {errors.employeeId && <small>{errors.employeeId}</small>}
            </div>

            <div className="edit-form-group">
              <label>{e.department}</label>
              <select
                name="department"
                value={formData.department}
                onChange={handleChange}
                disabled={isBusy}
              >
                <option value="">{e.selectDepartment}</option>
                <option value="Inventory Management">Inventory Management</option>
                <option value="Warehouse Management">Warehouse Management</option>
                <option value="Sales Management">Sales Management</option>
                <option value="Purchase Management">Purchase Management</option>
              </select>
              {errors.department && <small>{errors.department}</small>}
            </div>

            <div className="edit-form-group">
              <label>{e.role}</label>
              <input
                type="text"
                name="role"
                value={formData.role}
                disabled
              />
            </div>

            <div className="edit-form-group">
              <label>{e.warehouse}</label>
              <select
                name="warehouse"
                value={formData.warehouse}
                onChange={handleChange}
                disabled={isBusy}
              >
                <option value="">{e.selectWarehouse}</option>
                <option value="Main Warehouse - Hyderabad">
                  Main Warehouse - Hyderabad
                </option>
                <option value="Branch Warehouse - Vijayawada">
                  Branch Warehouse - Vijayawada
                </option>
                <option value="Branch Warehouse - Bengaluru">
                  Branch Warehouse - Bengaluru
                </option>
              </select>
              {errors.warehouse && <small>{errors.warehouse}</small>}
            </div>
          </div>
        </div>

        <div className="edit-profile-actions">
          <button
            className="edit-save-btn"
            onClick={handleUpdateProfile}
            disabled={isBusy}
            type="button"
          >
            {saving ? e.updating : e.update}
          </button>

          <button
            className="edit-cancel-btn"
            onClick={onClose}
            disabled={isBusy}
            type="button"
          >
            {e.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditProfile;
