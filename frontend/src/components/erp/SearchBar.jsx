import SearchInput from '../SearchInput'
import './ERPComponents.css'

export default function SearchBar({ className = '', ...props }) {
  return (
    <div className={`erp-search-bar ${className}`.trim()}>
      <SearchInput {...props} />
    </div>
  )
}
