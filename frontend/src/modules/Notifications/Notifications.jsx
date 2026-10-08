import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getNotifications,
  markNotificationRead,
  NOTIFICATIONS_UPDATED_EVENT,
} from "../../api/notificationsApi";
import { showToast } from "../../components/common/toast";
import NotificationsHeader from "./components/NotificationsHeader";
import NotificationsTable from "./components/NotificationsTable";
import "./Notifications.css";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const response = await getNotifications();
      if (response.success) {
        setNotifications(response.data || []);
      } else {
        if (!silent) showToast(response.error || "Failed to load notifications.", "error");
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
      if (!silent) showToast("Failed to load notifications.", "error");
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    const handleUpdated = () => fetchNotifications(true);
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, handleUpdated);
    return () => {
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, handleUpdated);
    };
  }, [fetchNotifications]);

  const handleMarkRead = useCallback(async (id) => {
    if (!id && id !== 0) return;
    try {
      const response = await markNotificationRead(id);
      if (response.success) {
        showToast("Notification marked as read.", "success");
        setNotifications((prev) =>
          prev.map((n) =>
            String(n.id) === String(id) || String(n.notificationId) === String(id)
              ? { ...n, isRead: true, IsRead: true, status: "Read", Status: "Read" }
              : n,
          ),
        );
      } else {
        showToast(response.error || "Failed to mark notification as read.", "error");
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
      showToast("Failed to mark notification as read.", "error");
    }
  }, []);

  const summary = useMemo(() => {
    const total = notifications.length;
    const unread = notifications.filter((n) => !n.isRead).length;
    const critical = notifications.filter(
      (n) => String(n.type || "").toLowerCase() === "critical",
    ).length;
    const read = Math.max(total - unread, 0);

    return { total, unread, read, critical };
  }, [notifications]);

  return (
    <div className="page notifications-page">
      <NotificationsHeader summary={summary} />
      <NotificationsTable
        notifications={notifications}
        loading={isLoading}
        onMarkRead={handleMarkRead}
      />
    </div>
  );
}
