import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import {
  DataTable,
  FilterBar,
  StatusBadge,
} from "../../../components/erp";
import { formatDate, formatDateTime } from "../../../utils/helpers";

const NOTIFICATION_COLUMNS_STORAGE_KEY = "ims.notifications.visibleColumns.v1";
const NOTIFICATION_DEFAULT_COLUMNS = [
  "notification",
  "type",
  "message",
  "status",
  "createdAt",
];

function getNotificationType(row) {
  return String(row?.type || "info");
}

export default function NotificationsTable({
  notifications,
  loading,
  onMarkRead,
}) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const filteredNotifications = useMemo(() => {
    return (notifications || []).filter((item) => {
      if (statusFilter === "unread" && item.isRead) return false;
      if (statusFilter === "read" && !item.isRead) return false;
      if (typeFilter !== "all" && String(item.type || "").toLowerCase() !== typeFilter.toLowerCase()) return false;
      return true;
    });
  }, [notifications, statusFilter, typeFilter]);

  const columns = [
    {
      key: "notification",
      label: "Notification",
      sortable: true,
      className: "notifications-col-title",
      searchValue: (row) => String(row.title || ""),
      render: (row) => (
        <div className="notifications-table__title-cell">
          <span
            className={`notifications-table__dot ${row.isRead ? "is-read" : "is-unread"}`}
            aria-hidden="true"
          />
          <strong>{row.title || "Notification"}</strong>
        </div>
      ),
    },
    {
      key: "type",
      label: "Type",
      sortable: true,
      className: "notifications-col-type",
      searchValue: getNotificationType,
      render: (row) => {
        const type = getNotificationType(row);
        let tone = "neutral";
        const lower = type.toLowerCase();
        if (lower === "critical" || lower === "error") tone = "danger";
        else if (lower === "warning") tone = "warning";
        else if (lower === "success") tone = "success";
        else if (lower === "info" || lower === "action") tone = "info";

        const formattedType = type
          ? type
              .replace(/[_-]+/g, " ")
              .toLowerCase()
              .replace(/\b\w/g, (char) => char.toUpperCase())
          : "";

        return <StatusBadge type={tone}>{formattedType}</StatusBadge>;
      },
    },
    {
      key: "message",
      label: "Message",
      sortable: true,
      className: "notifications-col-message",
      searchValue: (row) => String(row.message || ""),
      render: (row) => (
        <div className="notifications-table__message-cell">{row.message}</div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: false,
      className: "notifications-col-status",
      render: (row) => {
        const targetId = row.id ?? row.notificationId ?? row.NotificationId;

        return (
          <div className="notifications-table__status-cell">
            <StatusBadge type={row.isRead ? "success" : "warning"}>
              {row.isRead ? "Read" : "Unread"}
            </StatusBadge>
            {!row.isRead && (
              <button
                type="button"
                className="button button-text notifications-table__mark-read"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkRead(targetId);
                }}
              >
                Mark Read
              </button>
            )}
          </div>
        );
      },
    },
    {
      key: "createdAt",
      label: "Created",
      sortable: true,
      className: "notifications-col-created",
      searchValue: (row) => String(row.createdAt || ""),
      render: (row) => (
        <span className="notifications-table__date">
          {formatDateTime(row.createdAt)}
        </span>
      ),
    },
  ];

  const availableTypeOptions = useMemo(() => {
    const rawTypes = (notifications || [])
      .map((item) => String(item.type || "").trim())
      .filter(Boolean);

    const defaultTypes = ["Critical", "Warning", "Info", "Action"];
    const merged = [...new Set([...defaultTypes, ...rawTypes])];

    return merged.map((t) => {
      const formatted = t
        .replace(/[_-]+/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());

      return { value: t.toLowerCase(), label: formatted };
    });
  }, [notifications]);

  const toolbarContent = (
    <FilterBar>
      <div className="notifications-table__toolbar-actions">
        <select
          className="input-field"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
        <select
          className="input-field"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">All Types</option>
          {availableTypeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </FilterBar>
  );

  return (
    <div className="card notifications-page__table-card">
      <DataTable
        className="notifications-data-table"
        rows={filteredNotifications}
        columns={columns}
        loading={loading}
        searchKeys={["title", "type", "message"]}
        searchPlaceholder="Search notifications"
        emptyMessage="No notifications found."
        defaultPageSize={20}
        defaultSortKey="createdAt"
        defaultSortDirection="desc"
        showSearch={true}
        fitExplicitColumnsToContainer
        splitToolbar
        columnStorageKey={NOTIFICATION_COLUMNS_STORAGE_KEY}
        defaultVisibleColumnKeys={NOTIFICATION_DEFAULT_COLUMNS}
        toolbarContent={toolbarContent}
        keyField="id"
      />
    </div>
  );
}
