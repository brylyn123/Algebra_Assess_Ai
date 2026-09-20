import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../fetchClient';

const typeConfig = {
  assessment_created: {
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path d="M10.75 16.82A7.462 7.462 0 0012 15.5a7.462 7.462 0 001.25-1.32V16.82h-2.5zM9.25 16.82v-2.62A7.462 7.462 0 008 15.5c.458 0 .904-.078 1.322-.22L9.25 16.82zM6.39 12.257A7.46 7.46 0 014.5 9.5a7.46 7.46 0 01.45-2.527l1.52.76a5.492 5.492 0 000 3.774l-1.08.75zM13.61 12.257l-1.08-.75a5.492 5.492 0 000-3.774l1.52-.76A7.46 7.46 0 0115.5 9.5c0 .864-.185 1.687-.52 2.43l-1.37.327zM10 3.5a7.5 7.5 0 100 15 7.5 7.5 0 000-15z" />
      </svg>
    ),
    color: 'text-blue-500',
    bg: 'bg-blue-50',
  },
  assessment_submitted: {
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
      </svg>
    ),
    color: 'text-emerald-500',
    bg: 'bg-emerald-50',
  },
  grade_returned: {
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
      </svg>
    ),
    color: 'text-amber-500',
    bg: 'bg-amber-50',
  },
};

const typeLabels = {
  assessment_created: 'New Assessment',
  assessment_submitted: 'New Submission',
  grade_returned: 'Grade Returned',
};

function timeAgo(dateStr) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = now - then;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const dropdownRef = useRef(null);
  const bellRef = useRef(null);
  const limit = 15;

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await apiFetch('/get_unread_count.php');
      const data = await res.json();
      if (data.status === 'success') {
        setUnreadCount(data.unread_count);
      }
    } catch {
      // silent
    }
  }, []);

  const fetchNotifications = useCallback(
    async (reset = false) => {
      if (loading) return;
      setLoading(true);
      try {
        const offset = reset ? 0 : page * limit;
        const res = await apiFetch(`/get_notifications.php?limit=${limit}&offset=${offset}`);
        const data = await res.json();
        if (data.status === 'success') {
          if (reset) {
            setNotifications(data.notifications);
            setPage(1);
          } else {
            setNotifications((prev) => [...prev, ...data.notifications]);
            setPage((p) => p + 1);
          }
          setHasMore(data.notifications.length === limit);
          setUnreadCount(data.unread_count);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    },
    [page, loading]
  );

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications(true);
    }
  }, [isOpen, fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        bellRef.current &&
        !bellRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (ids) => {
    try {
      await apiFetch('/mark_notifications_read.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_ids: ids }),
      });
      setNotifications((prev) =>
        prev.map((n) => (ids.includes(n.notification_id) ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - ids.length));
    } catch {
      // silent
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiFetch('/mark_notifications_read.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // silent
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markAsRead([notification.notification_id]);
    }
  };

  const handleMarkOneRead = (e, notification) => {
    e.stopPropagation();
    if (!notification.is_read) {
      markAsRead([notification.notification_id]);
    }
  };

  return (
    <div className="relative">
      <button
        ref={bellRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
        title="Notifications"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4">
          <path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen &&
        createPortal(
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="fixed right-4 top-14 z-[9999] w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-[11px] font-semibold text-blue-600 transition hover:text-blue-800"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Notification list */}
            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 && !loading ? (
                <div className="px-4 py-8 text-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto h-8 w-8 text-slate-300">
                    <path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="mt-2 text-xs text-slate-500">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {notifications.map((notification) => {
                    const config = typeConfig[notification.type] || typeConfig.assessment_created;
                    return (
                      <button
                        key={notification.notification_id}
                        type="button"
                        onClick={() => handleNotificationClick(notification)}
                        className={`group flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${
                          !notification.is_read ? 'bg-blue-50/30' : ''
                        }`}
                      >
                        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${config.bg} ${config.color}`}>
                          {config.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className={`text-xs font-semibold ${!notification.is_read ? 'text-slate-900' : 'text-slate-700'}`}>
                              {notification.title}
                            </p>
                            {!notification.is_read && (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">
                              {typeLabels[notification.type] || notification.type}
                            </span>
                            <span className="text-[10px] text-slate-300">·</span>
                            <span className="text-[10px] text-slate-400">{timeAgo(notification.created_at)}</span>
                          </div>
                        </div>
                        {!notification.is_read && (
                          <button
                            type="button"
                            onClick={(e) => handleMarkOneRead(e, notification)}
                            title="Mark as read"
                            className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-300 opacity-0 transition hover:bg-blue-100 hover:text-blue-600 group-hover:opacity-100"
                          >
                            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                              <path d="M5.28 4.22a.75.75 0 00-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 101.06 1.06L8 9.06l2.72 2.72a.75.75 0 101.06-1.06L9.06 8l2.72-2.72a.75.75 0 00-1.06-1.06L8 6.94 5.28 4.22z" />
                            </svg>
                          </button>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {loading && (
                <div className="flex items-center justify-center py-4">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
                </div>
              )}

              {!loading && hasMore && notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => fetchNotifications(false)}
                  className="w-full border-t border-slate-100 py-2.5 text-center text-[11px] font-semibold text-blue-600 transition hover:bg-blue-50"
                >
                  Load more
                </button>
              )}
            </div>
          </motion.div>,
          document.body
        )}
    </div>
  );
}
