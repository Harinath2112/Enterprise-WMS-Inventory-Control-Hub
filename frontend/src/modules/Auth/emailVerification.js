export const EMAIL_VERIFICATION_COMPLETED_KEY =
  "ims-email-verification-completed";
export const EMAIL_VERIFICATION_COMPLETED_EVENT =
  "ims:email-verification-completed";

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function parseEmailVerificationCompletion(value) {
  try {
    const parsedValue = typeof value === "string" ? JSON.parse(value) : value;

    if (!parsedValue || typeof parsedValue !== "object") {
      return null;
    }

    return {
      email: normalizeEmail(parsedValue.email),
      verifiedAt: Number(parsedValue.verifiedAt) || 0,
    };
  } catch {
    return null;
  }
}

export function isEmailAlreadyVerifiedMessage(value) {
  const message = String(value ?? "").trim().toLowerCase();
  return (
    message.includes("verified") &&
    (message.includes("already") || message.includes("previously"))
  );
}

export function announceEmailVerificationCompleted(email) {
  if (typeof window === "undefined") {
    return;
  }

  const detail = {
    email: normalizeEmail(email),
    verifiedAt: Date.now(),
  };

  try {
    window.localStorage.setItem(
      EMAIL_VERIFICATION_COMPLETED_KEY,
      JSON.stringify(detail),
    );
  } catch {
    // The current verification page still redirects when storage is unavailable.
  }

  window.dispatchEvent(
    new CustomEvent(EMAIL_VERIFICATION_COMPLETED_EVENT, { detail }),
  );
}
