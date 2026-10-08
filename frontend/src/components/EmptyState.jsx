import StateBlock from './common/StateBlock'

export default function EmptyState({ colSpan, message, actionLabel, onAction }) {
  return (
    <tr>
      <td colSpan={colSpan} className="table-empty">
        <StateBlock
          type="empty"
          title={message}
          message="There is nothing to show yet."
          actionLabel={actionLabel}
          onAction={onAction}
          compact
        />
      </td>
    </tr>
  )
}
