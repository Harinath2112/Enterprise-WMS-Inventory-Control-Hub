export function getAuthErrorMessage(message, fallback = 'We could not complete that request. Try again.') {
  const text = String(message ?? '').trim()
  const normalizedText = text.toLowerCase()

  if (!text) return fallback

  // Normalize raw backend error strings regarding working mail
  if (
    normalizedText.includes('working mail') ||
    normalizedText.includes('working email') ||
    normalizedText.includes('valid working') ||
    normalizedText.includes('valid mail')
  ) {
    if (normalizedText.includes('not found') || normalizedText.includes('no user')) {
      return 'No account matches that email.'
    }
    return 'Enter a valid email address.'
  }

  if (
    (normalizedText.includes('same') || normalizedText.includes('reuse') || normalizedText.includes('used') || normalizedText.includes('history') || normalizedText.includes('previous')) &&
    (normalizedText.includes('old') || normalizedText.includes('previous') || normalizedText.includes('recent') || normalizedText.includes('current') || normalizedText.includes('password'))
  ) {
    return 'New password cannot be the same as the old password.'
  }

  // Check credential failures first to avoid matching "invalid" as "valid" under email checks
  if (normalizedText.includes('invalid') && (normalizedText.includes('password') || normalizedText.includes('credential') || normalizedText.includes('user'))) {
    if (normalizedText.includes('remaining') || normalizedText.includes('attempt') || normalizedText.includes('lock')) {
      return text
    }
    return 'Check your email and password.'
  }

  if (
    normalizedText.includes('name') ||
    normalizedText.includes('email') ||
    normalizedText.includes('phone') ||
    normalizedText.includes('password') ||
    normalizedText.includes('match') ||
    normalizedText.includes('user') ||
    normalizedText.includes('account')
  ) {
    if (normalizedText.includes('already') || normalizedText.includes('exists') || normalizedText.includes('conflict') || normalizedText.includes('duplicate') || normalizedText.includes('registered')) {
      if (normalizedText.includes('phone') || normalizedText.includes('mobile')) return 'An account with this phone number already exists.'
      return 'An account with this email address already exists.'
    }
    if (normalizedText.includes('not found') || normalizedText.includes('no user')) {
      return 'No account matches that email.'
    }
    if (normalizedText.includes('invalid') || normalizedText.includes('valid')) {
      return 'Enter a valid email address.'
    }
    if (text.length <= 150) {
      return text
    }
  }

  if (normalizedText.includes('email') && normalizedText.includes('valid')) {
    return 'Enter a valid email address.'
  }
  if (normalizedText.includes('password') && normalizedText.includes('required')) {
    return 'Enter your password.'
  }
  if (normalizedText.includes('invalid') && normalizedText.includes('otp')) {
    return 'Enter the 6-digit code.'
  }
  if (normalizedText.includes('token')) {
    return 'We could not start your session. Please sign in again.'
  }
  if ((normalizedText.includes('phone') || normalizedText.includes('mobile')) && (normalizedText.includes('already') || normalizedText.includes('exists') || normalizedText.includes('conflict') || normalizedText.includes('duplicate'))) {
    return 'An account with this phone number already exists.'
  }
  if (normalizedText.includes('already') || normalizedText.includes('exists') || normalizedText.includes('conflict') || normalizedText.includes('duplicate') || normalizedText.includes('registered')) {
    return 'An account with this email address already exists.'
  }
  if (normalizedText.includes('not found') || normalizedText.includes('no user')) {
    return 'No account matches that email.'
  }
  if (normalizedText.includes('expired')) {
    return 'Your reset session has expired. Request a new code.'
  }
  if (normalizedText.includes('network') || normalizedText.includes('server') || normalizedText.includes('connect')) {
    return 'Unable to connect to the server.'
  }
  if (text.length > 150) return fallback

  return text
}
