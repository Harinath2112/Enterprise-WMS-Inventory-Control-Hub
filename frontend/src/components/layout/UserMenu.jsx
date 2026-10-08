import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PortalDropdown from "./PortalDropdown";

import AdminProfile from "../AdminProfile/AdminProfile";
import LogoutConfirm from "../LogoutConfirm/LogoutConfirm";

import {
  defaultAdminProfile,
  defaultSettings,
  getTranslatedText,
} from "../../data/imsConfig";

import "../../styles/imsProjectTheme.css";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(
  /\/+$/,
  "",
);
const SETTINGS_API = `${API_BASE_URL}/SystemSettings`;

const apiHeaders = {
  "Content-Type": "application/json",
  "ngrok-skip-browser-warning": "true",
};

function getInitials(value) {
  const parts = String(value || "IMS")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "IM";
}

function mapApiSettingsToUi(apiSettings, fallbackSettings = {}) {
  return {
    settingId: apiSettings?.settingId || fallbackSettings?.settingId || 1,
    companyName:
      apiSettings?.companyName || fallbackSettings?.companyName || "",
    companyLogo:
      apiSettings?.companyLogo || fallbackSettings?.companyLogo || "",
    email: apiSettings?.emailAddress || fallbackSettings?.email || "",
    phone: apiSettings?.phoneNumber || fallbackSettings?.phone || "",
    address: apiSettings?.address || fallbackSettings?.address || "",
    lowStockLimit:
      apiSettings?.lowStockAlertLimit?.toString() ||
      fallbackSettings?.lowStockLimit ||
      "",
    defaultUnit:
      apiSettings?.defaultUnitType || fallbackSettings?.defaultUnit || "pcs",

    barcodeEnabled:
      typeof apiSettings?.barcodeManagement === "boolean"
        ? apiSettings.barcodeManagement
        : (fallbackSettings?.barcodeEnabled ?? true),

    autoStockUpdate:
      typeof apiSettings?.autoStockUpdate === "boolean"
        ? apiSettings.autoStockUpdate
        : (fallbackSettings?.autoStockUpdate ?? true),

    lowStockAlerts:
      typeof apiSettings?.lowStockAlerts === "boolean"
        ? apiSettings.lowStockAlerts
        : (fallbackSettings?.lowStockAlerts ?? true),

    orderNotifications:
      typeof apiSettings?.orderNotifications === "boolean"
        ? apiSettings.orderNotifications
        : (fallbackSettings?.orderNotifications ?? true),

    paymentReminder:
      typeof apiSettings?.supplierPaymentReminder === "boolean"
        ? apiSettings.supplierPaymentReminder
        : (fallbackSettings?.paymentReminder ?? false),

    twoStepVerification:
      typeof apiSettings?.twoStepVerification === "boolean"
        ? apiSettings.twoStepVerification
        : (fallbackSettings?.twoStepVerification ?? false),

    themeMode: apiSettings?.themeMode || fallbackSettings?.themeMode || "light",
    language: apiSettings?.language || fallbackSettings?.language || "english",

    collapseSidebar:
      typeof apiSettings?.collapseSidebar === "boolean"
        ? apiSettings.collapseSidebar
        : (fallbackSettings?.collapseSidebar ?? false),
  };
}

export default function UserMenu({ user, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);

  const [showProfile, setShowProfile] = useState(false);
  const [showLogout, setShowLogout] = useState(false);

  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  const name = user?.name || user?.email || "IMS";
  const role = user?.role || "Admin";
  const initials = useMemo(() => getInitials(name), [name]);

  const [adminProfile, setAdminProfile] = useState(() => {
    const savedProfile = localStorage.getItem("imsAdminProfile");

    if (savedProfile) {
      return JSON.parse(savedProfile);
    }

    return {
      ...defaultAdminProfile,
      fullName: name,
      email: user?.email || defaultAdminProfile.email,
      role: role === "User" ? "Admin" : role,
    };
  });

  const [settingsData, setSettingsData] = useState(() => {
    const savedSettings = localStorage.getItem("imsAdminSettings");
    return savedSettings ? JSON.parse(savedSettings) : defaultSettings;
  });

  const t = getTranslatedText(settingsData.language);

  useEffect(() => {
    async function fetchAdminSettings() {
      try {
        const rawToken = localStorage.getItem("ims-auth-token");
        let token = "";
        if (rawToken) {
          try {
            const parsed = JSON.parse(rawToken);
            token = typeof parsed === "string" ? parsed : rawToken;
          } catch {
            token = rawToken;
          }
        }

        const response = await fetch(SETTINGS_API, {
          method: "GET",
          headers: {
            ...apiHeaders,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!response.ok) return;

        const data = await response.json();
        const apiSettings = Array.isArray(data)
          ? data[0]
          : data?.data && Array.isArray(data.data)
            ? data.data[0]
            : data?.data || data;
        const mappedSettings = mapApiSettingsToUi(apiSettings, settingsData);

        setSettingsData(mappedSettings);
        localStorage.setItem(
          "imsAdminSettings",
          JSON.stringify(mappedSettings),
        );
      } catch (error) {
        console.error("Admin settings fetch error:", error);
      }
    }

    // Disabled to prevent console 404 errors since backend SystemSettings table is not seeded.
    // Settings will fall back to localStorage.
    // fetchAdminSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleClick(event) {
      if (!menuRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleOpenProfile() {
    setIsOpen(false);
    setShowProfile(true);
  }

  function handleOpenLogout() {
    setIsOpen(false);
    setShowLogout(true);
  }

  function handleUpdateProfile(updatedProfile) {
    const finalProfile = {
      ...adminProfile,
      ...updatedProfile,
    };

    setAdminProfile(finalProfile);
    localStorage.setItem("imsAdminProfile", JSON.stringify(finalProfile));

    const currentUserRaw = localStorage.getItem("ims-current-user");
    if (currentUserRaw) {
      try {
        const currentUser = JSON.parse(currentUserRaw);
        currentUser.name = finalProfile.fullName || finalProfile.name || currentUser.name;
        currentUser.email = finalProfile.email || currentUser.email;
        localStorage.setItem("ims-current-user", JSON.stringify(currentUser));
        window.dispatchEvent(new Event("storage"));
      } catch (e) {
        console.error("Error updating current user local storage:", e);
      }
    }
  }

  function handleUpdateSettings(updatedSettings) {
    const finalSettings = {
      ...settingsData,
      ...updatedSettings,
    };

    setSettingsData(finalSettings);
    localStorage.setItem("imsAdminSettings", JSON.stringify(finalSettings));
  }

  function handleConfirmLogout() {
    setShowLogout(false);

    if (typeof onLogout === "function") {
      onLogout();
    }
  }

  const modalThemeClass =
    settingsData.themeMode === "dark" ? "ims-dark-theme" : "";

  const modalContent = (
    <div className={modalThemeClass}>
      {showProfile ? (
        <AdminProfile
          adminProfile={adminProfile}
          settingsData={settingsData}
          t={t}
          onClose={() => setShowProfile(false)}
          onUpdateProfile={handleUpdateProfile}
          onLogout={() => {
            setShowProfile(false);
            setShowLogout(true);
          }}
        />
      ) : null}

      {showLogout ? (
        <LogoutConfirm
          settingsData={settingsData}
          t={t}
          user={user}
          onCancel={() => setShowLogout(false)}
          onLogout={handleConfirmLogout}
        />
      ) : null}
    </div>
  );

  return (
    <>
      <div className="app-menu" ref={menuRef}>
        <button
          ref={buttonRef}
          type="button"
          className="app-user-button"
          aria-label={`Signed in as ${name}, ${role}`}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((value) => !value)}
        >
          <span className="app-avatar" aria-hidden="true">
            {initials}
          </span>

          <span className="app-user-button__copy">
            <strong>{name}</strong>
            <span>{role}</span>
          </span>

          <ChevronDown size={14} className="app-user-button__chevron" />
        </button>

        {isOpen ? (
          <PortalDropdown
            anchorRef={buttonRef}
            className="app-dropdown--user"
            width={260}
          >
            <div className="app-dropdown__profile">
              <span className="app-avatar app-avatar--large" aria-hidden="true">
                {initials}
              </span>

              <div>
                <strong>{name}</strong>
                <span>{role}</span>
              </div>
            </div>

            <button
              type="button"
              className="app-dropdown__item"
              role="menuitem"
              onClick={handleOpenProfile}
            >
              <UserRound size={16} />
              <span>{t.profile}</span>
            </button>

            <button
              type="button"
              className="app-dropdown__item app-dropdown__item--danger"
              role="menuitem"
              onClick={handleOpenLogout}
            >
              <LogOut size={16} />
              <span>{t.logout}</span>
            </button>
          </PortalDropdown>
        ) : null}
      </div>

      {createPortal(modalContent, document.body)}
    </>
  );
}
