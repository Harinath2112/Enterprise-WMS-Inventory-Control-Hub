import { useEffect, useState } from 'react'

export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === 'undefined') {
      return initialValue
    }

    try {
      const rawValue = window.localStorage.getItem(key)
      return rawValue ? JSON.parse(rawValue) : initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue))
    } catch {
      window.localStorage.removeItem(key)
    }
  }, [key, storedValue])

  return [storedValue, setStoredValue]
}
