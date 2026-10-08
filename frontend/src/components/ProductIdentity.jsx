import { useEffect, useState } from 'react'
import { resolveApiAssetUrl } from '../api/apiClient'
import './ProductIdentity.css'

function getInitials(value) {
  const words = String(value || 'Product')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) {
    return 'P'
  }

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}

function getStoredToken() {
  const keys = ['ims-auth-token', 'token', 'authToken', 'accessToken'];
  for (const k of keys) {
    const val = localStorage.getItem(k);
    if (val) {
      try {
        const parsed = JSON.parse(val);
        return typeof parsed === 'string' ? parsed : val;
      } catch {
        return val;
      }
    }
  }
  return '';
}

export default function ProductIdentity({
  name,
  image,
  meta = '',
  size = 'md',
  className = '',
}) {
  const [blobUrl, setBlobUrl] = useState('')
  const [hasImageError, setHasImageError] = useState(false)
  const displayName = String(name || 'Unnamed product').trim()
  const rawImageSrc = resolveApiAssetUrl(image)

  useEffect(() => {
    setHasImageError(false)
    setBlobUrl('')

    if (!rawImageSrc) return;

    if (rawImageSrc.startsWith('data:') || rawImageSrc.startsWith('blob:')) {
      setBlobUrl(rawImageSrc);
      return;
    }

    let isMounted = true;
    let createdUrl = '';

    const token = getStoredToken();

    fetch(rawImageSrc, {
      method: 'GET',
      headers: {
        'ngrok-skip-browser-warning': 'true',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.blob();
      })
      .then((blob) => {
        if (!isMounted) return;
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Authenticated image fetch failed, falling back to direct URL:', err);
        setBlobUrl(rawImageSrc);
      });

    return () => {
      isMounted = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [rawImageSrc])

  const showImage = Boolean(blobUrl || rawImageSrc) && !hasImageError

  return (
    <div
      className={`product-identity product-identity--${size} ${className}`.trim()}
      title={displayName}
    >
      {showImage ? (
        <img
          src={blobUrl || rawImageSrc}
          alt={displayName}
          className="product-identity__thumb"
          loading="lazy"
          onError={() => setHasImageError(true)}
        />
      ) : (
        <span className="product-identity__thumb product-identity__thumb--placeholder">
          {getInitials(displayName)}
        </span>
      )}

      <span className="product-identity__copy">
        <strong title={displayName}>{displayName}</strong>
        {meta ? <span title={meta}>{meta}</span> : null}
      </span>
    </div>
  )
}
