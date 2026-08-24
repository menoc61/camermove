export interface DomainEvent<T = unknown> {
  id: string
  type: string
  ts: string
  aggregateId: string
  data: T
}
