export interface ConfirmLink {
  id: string
  userId: string
  status: string
  totalAmount: number
  [key: string]: unknown
}

export interface ConfirmNotification {
  topic: string
  type: string
  userId: string
  payload: Record<string, unknown>
}

export interface CancelEntity {
  id: string
  userId: string
  status: string
  totalAmount: number
}
