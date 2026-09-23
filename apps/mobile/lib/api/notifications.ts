import { resourceClient } from "./resource";

const notifications = resourceClient("/api/v1/me/notifications");

export interface MyNotification {
  id: string;
  channel: string;
  type: string;
  status: string;
  payload: Record<string, unknown> | null;
  sentAt: string | null;
  createdAt: string;
  read: boolean;
}

export interface MyNotificationsResponse {
  items: MyNotification[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export function fetchMyNotifications(token: string, params: Record<string, string> = {}): Promise<MyNotificationsResponse> {
  return notifications.list("", { token, params }) as Promise<MyNotificationsResponse>;
}

export function markNotificationRead(token: string, id: string): Promise<MyNotification> {
  return notifications.request<MyNotification>(`/api/v1/me/notifications/${id}/read`, { method: "PATCH", token });
}
