import { Search } from 'lucide-react'
import { useEffect, useRef } from 'react'

export default function SearchBar() {
  const inputRef = useRef(null)

  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <form className="app-header__search" role="search" onSubmit={(event) => event.preventDefault()}>
      <Search size={17} aria-hidden="true" />
      <input ref={inputRef} type="search" placeholder="Search inventory, people, or reports" />
      <kbd>Ctrl K</kbd>
    </form>
  )
}
