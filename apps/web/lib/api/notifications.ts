import { apiFetch } from "./client"

export interface MyNotification {
  id: string
  channel: string
  type: string
  status: string
  payload: Record<string, unknown> | null
  sentAt: string | null
  createdAt: string
  read: boolean
}

export interface MyNotificationsResponse {
  items: MyNotification[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

export function fetchMyNotifications(token: string, params: Record<string, string> = {}): Promise<MyNotificationsResponse> {
  const qs = new URLSearchParams(params).toString()
  return apiFetch<MyNotificationsResponse>(`/api/v1/me/notifications${qs ? `?${qs}` : ""}`, { method: "GET", token })
}

export function markNotificationRead(token: string, id: string): Promise<MyNotification> {
  return apiFetch<MyNotification>(`/api/v1/me/notifications/${id}/read`, {
    method: "PATCH",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    token,
  })
}
