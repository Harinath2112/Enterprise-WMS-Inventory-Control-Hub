import TableComponent from '../tables/TableComponent'
import './ERPComponents.css'

export default function DataTable({
  defaultPageSize = 10,
  allowSortReset = false,
  enableRowSelection = false,
  className = '',
  ...props
}) {
  return (
    <div className={`erp-data-table ${className}`.trim()}>
      <TableComponent
        defaultPageSize={defaultPageSize}
        allowSortReset={allowSortReset}
        enableRowSelection={enableRowSelection}
        {...props}
      />
    </div>
  )
}
