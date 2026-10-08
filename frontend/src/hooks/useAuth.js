import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import {
  apiRequest,
  AUTH_TOKEN_KEY,
  AUTH_UNAUTHORIZED_EVENT,
} from "../api/apiClient";
import { resolveUserId, validateCurrentSession } from "../api/authApi";
import { API_ENDPOINTS } from "../api/endpoints";
import { canAccess } from "../utils/permissions";
import { useLocalStorage } from "./useLocalStorage";

const AuthContext = createContext(null);
const AUTH_USER_KEY = "ims-current-user";
const SESSION_VALIDATION_INTERVAL_MS = 60000;
let lastSessionCheckTime = 0;

function normalizeSessionPermissions(value) {
  if (!Array.isArray(value)) return {};

  return value.reduce((permissions, item) => {
    const moduleKey = String(item?.moduleKey ?? item?.ModuleKey ?? "").trim();
    if (!moduleKey) return permissions;

    const actions = [];
    if (item.canView ?? item.CanView) actions.push("view");
    if (item.canAdd ?? item.CanAdd) actions.push("create");
    if (item.canEdit ?? item.CanEdit) actions.push("edit");
    if (item.canDelete ?? item.CanDelete) actions.push("delete");
    permissions[moduleKey] = actions;
    return permissions;
  }, {});
}

export function AuthProvider({ children, roles = [] }) {
  const [user, setUser] = useLocalStorage(AUTH_USER_KEY, null);
  const authenticatedUserId = resolveUserId(user);

  useEffect(() => {
    function handleUnauthorized() {
      // Clear authentication
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
      sessionStorage.clear();

      setUser(null);

      // Prevent redirect loop
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);

    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, [setUser]);

  useEffect(() => {
    if (!authenticatedUserId || !localStorage.getItem(AUTH_TOKEN_KEY)) {
      return undefined;
    }

    let requestInFlight = false;

    const checkSession = async (force = false) => {
      const now = Date.now();
      if (
        requestInFlight ||
        document.hidden ||
        !localStorage.getItem(AUTH_TOKEN_KEY) ||
        (!force && now - lastSessionCheckTime < 30000)
      ) {
        return;
      }

      requestInFlight = true;
      lastSessionCheckTime = now;
      try {
        await validateCurrentSession();
      } finally {
        requestInFlight = false;
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void checkSession(false);
      }
    };

    void checkSession(true);
    const intervalId = window.setInterval(
      () => checkSession(true),
      SESSION_VALIDATION_INTERVAL_MS,
    );

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [authenticatedUserId]);

  const login = useCallback(
    async function login({ emailOrPhone, password }) {
      const result = await apiRequest(API_ENDPOINTS.auth.login, {
        method: "POST",
        body: {
          emailOrPhone: emailOrPhone.trim(),
          password,
        },
      });

      if (!result.success) {
        return {
          success: false,
          message: result.error || "Check your email and password.",
        };
      }

      const data = result.data ?? {};
      const token = data?.token ?? data?.accessToken ?? "";
      const apiUser = data?.user ?? data ?? {};
      const resolvedId = resolveUserId(apiUser);
      const userData = {
        id: resolvedId,
        name: apiUser.name ?? apiUser.fullName ?? apiUser.username ?? "",
        email: apiUser.email ?? emailOrPhone.trim(),
        role: apiUser.role ?? "User",
        permissions: normalizeSessionPermissions(data?.permissions),
      };

      if (!token) {
        return {
          success: false,
          message: "We could not start your session. Please sign in again.",
        };
      }

      localStorage.setItem(AUTH_TOKEN_KEY, token);
      setUser(userData);

      return { success: true, user: userData, token };
    },
    [setUser],
  );

  const logout = useCallback(
    function logout() {
      const keysToRemove = [
        AUTH_TOKEN_KEY,
        AUTH_USER_KEY,
        "ims-auth-token",
        "ims-current-user",
        "token",
        "user",
        "authToken",
        "imsAdminProfile",
        "imsAdminSettings",
        "ims-email-verification-completed",
      ];

      for (const key of keysToRemove) {
        try {
          localStorage.removeItem(key);
        } catch {}
      }

      try {
        sessionStorage.clear();
      } catch {}

      setUser(null);

      if (typeof window !== "undefined") {
        window.location.replace("/login");
      }
    },
    [setUser],
  );

  const hasPermission = useCallback(
    function hasPermission(moduleKey, action = "view") {
      const liveRoles = roles.length
        ? roles
        : user?.role && user?.permissions
          ? [{ name: user.role, permissions: user.permissions }]
          : [];

      return canAccess(moduleKey, action, user?.role, liveRoles);
    },
    [roles, user],
  );

  const isAuthenticated = Boolean(user && localStorage.getItem(AUTH_TOKEN_KEY));
  const value = useMemo(
    () => ({
      user,
      roles,
      login,
      logout,
      hasPermission,
      isAuthenticated,
    }),
    [hasPermission, isAuthenticated, login, logout, roles, user],
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
