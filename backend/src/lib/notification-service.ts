import fetch from 'node-fetch';

const BACKEND_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';

export class NotificationService {
  static async fetchNotifications(
    userId: string,
    limit = 50,
    offset = 0,
    unreadOnly = false,
  ) {
    const params = new URLSearchParams();
    params.append('userId', userId);
    params.append('limit', String(limit));
    params.append('offset', String(offset));
    params.append('unreadOnly', String(unreadOnly));

    const res = await fetch(
      `${BACKEND_URL}/notifications?${params.toString()}`,
    );
    if (!res.ok) throw new Error('Failed to fetch notifications');
    const body = await res.json();
    return body.notifications;
  }

  static async subscribe(userId: string) {
    // Return suggested websocket endpoint and a simple ephemeral token (for client usage)
    const wsUrl = process.env.WS_URL || 'ws://localhost:3000/notifications';
    const token = `sub_${userId}_${Date.now()}`;
    return { wsUrl, token };
  }

  static async markAsRead(userId: string, notificationId: string) {
    const res = await fetch(
      `${BACKEND_URL}/notifications/read/${notificationId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      },
    );
    if (!res.ok) throw new Error('Failed to mark read');
    return true;
  }
}
