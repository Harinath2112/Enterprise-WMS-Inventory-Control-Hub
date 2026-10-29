# Enterprise WMS — Guest Preview Mode Security & Data-Isolation Audit

**Date:** 2026-10-29  
**Auditor:** Senior Application Security & Cloud Architecture  
**Target:** Enterprise WMS Guest Preview Mode Implementation  
**Status:** **PASSED — ZERO SENSITIVE DATA EXPOSURE**

---

## 1. Threat Model & Isolation Principles

The Guest Preview Mode was engineered to guarantee the following invariants:
1. **Zero Credential Generation:** No JWT tokens, Bearer headers, database users, or cookies are generated or stored.
2. **Synchronous Network Interception:** Protected endpoints are intercepted in the client JavaScript runtime before any HTTP network packets are dispatched.
3. **Cache & Storage Sanitization:** `localStorage` cached production data (`ims-frontend-data`) is discarded upon entry, and `appData` evaluates to empty arrays.
4. **Offline Resilience:** Guest mode operates completely decoupled from backend cloud health. Sleeping Render instances or unreachable databases never degrade the guest experience.
5. **No Synthetic Fictions:** Zero fake products, fake suppliers, or fictitious orders are generated. The UI preserves authentic structural layout with empty table states.

---

## 2. Security Controls & Implementation Review

### 2.1 API Interception (`frontend/src/api/apiClient.js`)
- **Control:** `isGuestSession()` checks `window.sessionStorage.getItem('ims-guest-mode') === 'true'`.
- **Interception Rule:**
  ```javascript
  if (isGuestSession()) {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return {
        success: false,
        data: null,
        error: 'Available to authorized users only in Guest Mode.',
        status: 403,
      }
    }
    return {
      success: true,
      data: endpoint.includes('summary') ? {} : [],
      status: 200,
    }
  }
  ```
- **Audit Result:** **PASS**. Dispatches zero requests to `https://enterprise-wms-inventory-control-hub.onrender.com`.

### 2.2 Server Health Interception (`checkServerHealth`)
- **Control:** In `apiClient.js`, `checkServerHealth()` returns `true` immediately when `isGuestSession()` is active.
- **Audit Result:** **PASS**. Never initiates network preflight or ping to `/health`. Prevents CORS warnings and connection drop banners.

### 2.3 Network Status UI (`AppNetworkStatus.jsx`)
- **Control:** Returns `null` whenever `isGuestSession()` is true.
- **Audit Result:** **PASS**. Completely suppresses "Server connection issue" or "Unable to connect to server" alert banners.

### 2.4 File Export & Download Interceptions
- **Control:** Added synchronous guest session checks to:
  - `businessApi.js` (`downloadApiFile`)
  - `resourceApi.js` (`downloadResourceFile`)
  - `returnsExchangeApi.js` (`getReturnAttachmentBlob`)
  - `suppliersApi.js` (`downloadSupplierDocument`)
- **Audit Result:** **PASS**. Direct download and raw fetch routines immediately reject with explanatory notices before issuing network calls.

### 2.5 State & Cache Isolation (`frontend/src/App.jsx`)
- **Control:**
  ```javascript
  const appData = isGuestMode ? initialData : finalizeState(getSafeState(data, users, roles))
  ```
  `ApiDataBootstrap` effect:
  ```javascript
  if (!isAuthenticated || isGuestMode) {
    return undefined
  }
  ```
- **Audit Result:** **PASS**. Even if a previous admin session had persisted products or customer records into `ims-frontend-data`, `appData` ignores it and returns empty arrays `[]`.
- **Mutation Guard:** `updateData` cancels mutation requests and triggers a warning toast notification (`ims:toast`).

### 2.6 Session Hygiene (`frontend/src/hooks/useAuth.js`)
- **Control:**
  - `enterGuestMode`:
    1. Removes `ims-auth-token` from `localStorage`.
    2. Removes `ims-current-user` from `localStorage`.
    3. Removes `ims-frontend-data` from `localStorage`.
    4. Sets `ims-guest-mode: true` in `sessionStorage`.
    5. Sets `user` object to `{ id: 'guest-preview', role: 'Guest', isGuest: true }`.
  - `isAuthenticated`: Strictly `Boolean(user && !isGuestMode && localStorage.getItem(AUTH_TOKEN_KEY))`.
  - Session validation heartbeats: Bypassed when `isGuestMode` is true.
- **Audit Result:** **PASS**. No token leakage, no background session polling.

---

## 3. Vulnerability Assessment Summary

| Threat Vector | Mitigation | Status |
| :--- | :--- | :--- |
| Network sniffing / MITM | Zero network requests sent to backend API | SECURE |
| LocalStorage data scraping | Cache wiped on guest entry; `initialData` enforced | SECURE |
| Unauthorized data mutation | Intercepted in React state and API client with 403 | SECURE |
| Unauthorized document downloads | Guarded in all download routines | SECURE |
| Session hijacking | No tokens or bearer credentials exist | SECURE |
| Denial of service (Render sleep) | Works 100% offline without backend availability | SECURE |

