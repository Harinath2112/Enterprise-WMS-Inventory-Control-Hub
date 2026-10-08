export default function NotificationsHeader({ summary }) {
  return (
    <header
      className="resource-center__compact-header"
      aria-label="Notifications workspace summary"
    >
      <div className="resource-center__compact-title-row">
        <h1>Notifications</h1>

        {summary ? (
          <div
            className="resource-center__compact-metrics"
            aria-label="Notification summary"
          >
            <span className="resource-center__metric-badge resource-center__metric-badge--total">
              <strong>{summary.total}</strong>
              Notifications
            </span>
            <span className="resource-center__metric-badge resource-center__metric-badge--warning">
              <strong>{summary.unread}</strong>
              Unread
            </span>
            <span className="resource-center__metric-badge resource-center__metric-badge--success">
              <strong>{summary.read}</strong>
              Read
            </span>
            {summary.critical > 0 ? (
              <span className="resource-center__metric-badge resource-center__metric-badge--danger">
                <strong>{summary.critical}</strong>
                Critical
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
