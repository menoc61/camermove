# CamerMove workflows

## Use case diagram

```mermaid
flowchart LR
  Traveler((Traveler))
  Partner((Partner))
  Admin((Admin))
  Provider((Payment / insurance / transport partners))
  CM["CamerMove platform"]
  Traveler -->|search, book, pay, track| CM
  Traveler -->|tickets, notifications, profile| CM
  Partner -->|catalogue, availability, fulfillment| CM
  Admin -->|moderate, report, commission, support| CM
  CM --> Provider
```

## Interurban booking sequence

```mermaid
sequenceDiagram
  actor T as Traveler
  participant W as Web
  participant A as API
  participant R as Redis
  participant D as Postgres
  participant K as Kafka
  participant P as Payment
  participant B as Worker
  T->>W: Search origin/destination/date/pax
  W->>A: GET /search
  A->>R: Read 60s cache
  A-->>W: Trips, prices, availability
  T->>W: Select seats and passenger data
  W->>A: POST /bookings + Idempotency-Key
  A->>D: Transaction + FOR UPDATE + trigger checks
  A->>R: Store idempotent response / seat hold
  A->>K: booking.created
  A-->>W: Pending booking
  W->>A: POST /payments + Idempotency-Key
  A->>P: Create payment
  P-->>A: Webhook / status
  A->>D: Confirm payment and ticket atomically
  K->>B: Consume booking event / notifications
  A-->>W: E-ticket and QR code
```

## Parcel activity diagram

```mermaid
flowchart TD
  Start((Start)) --> Create[Create shipment]
  Create --> Quote[Calculate tariff]
  Quote --> Pay{Payment succeeds?}
  Pay -- No --> Retry[Retry / show pending] --> Pay
  Pay -- Yes --> Registered[Enregistré]
  Registered --> Picked[Pris en charge]
  Picked --> Transit[En transit]
  Transit --> Arrived[Arrivé]
  Arrived --> Available[Disponible]
  Available --> Delivered[Livré]
  Delivered --> End((End))
```

## Insurance activity diagram

```mermaid
flowchart TD
  Start((Start)) --> Dates[Enter destination and dates]
  Dates --> Coverage[Choose coverage and travelers]
  Coverage --> Quote[Calculate premium]
  Quote --> Subscribe[Create policy]
  Subscribe --> Pay{Payment succeeds?}
  Pay -- No --> Pending[Keep pending / retry]
  Pay -- Yes --> Attestation[Issue policy and attestation]
  Attestation --> End((End))
```

## Events purchase sequence

```mermaid
sequenceDiagram
  actor T as Traveler
  participant A as API
  participant D as Postgres
  participant Pay as Payment provider
  T->>A: GET /events
  A-->>T: Events and ticket categories
  T->>A: POST /events/bookings + Idempotency-Key
  A->>D: Lock category inventory and reserve quantity
  A-->>T: Event booking
  T->>A: POST /events/bookings/:id/pay
  A->>Pay: Initiate payment
  Pay-->>A: Webhook confirmation
  A->>D: Mark paid, issue ticket + QR
  A-->>T: Digital ticket
```

## Auth and observability flow

```mermaid
sequenceDiagram
  actor C as Client
  participant A as API
  participant M as Metadata plugin
  participant L as AuditLog
  participant Prom as Prometheus
  C->>A: Request with Bearer JWT
  A->>M: Attach ip/os/browser/device/ua/referer/requestId
  M->>A: req.meta
  A->>L: Persist write/admin audit metadata
  A-->>C: Response
  Prom->>A: GET /metrics
```

## City-first place search sequence

```mermaid
sequenceDiagram
  actor T as Traveler
  participant W as Web (Combobox)
  participant A as API
  participant G as Geocoder adapter (OSM/Nominatim)
  participant R as Redis cache
  participant D as Postgres (seeded places)
  T->>W: Type city name
  W->>A: GET /places/cities?q=
  A->>R: Cache lookup
  R-->>A: Miss
  A->>D: Suggest seeded cities
  A->>G: Debounced autocomplete (bounded, rate-limited)
  G-->>A: City results (Cameroon-bounded)
  A->>R: Cache successful results (60s)
  A-->>W: City suggestions
  T->>W: Pick city, then type address/agency/stop
  W->>A: GET /places/search?city=&q=
  alt Provider available
    A->>G: Address search
    G-->>A: Structured places {lat, lon}
  else Provider down
    A->>D: Fallback to seeded local places
  end
  A-->>W: Structured {city, placeId, label, lat, lon}
  W-->>T: Ready for ticket-count search
```

## Auth login / password reset activity

```mermaid
flowchart TD
  Start((Start)) --> Login{Action}
  Login -- login --> Creds[Email + password]
  Creds --> Verify{argon2 verify ok?}
  Verify -- no --> Err[Generic error, ip/os logged to AuditLog] --> Creds
  Verify -- yes --> Role{Role}
  Role -- traveler --> UD[User dashboard]
  Role -- partner/transporter --> PD[Partner / transporter space]
  Role -- admin/super_admin --> AD[Admin dashboard]
  Login -- forgot password --> Req[POST password reset request]
  Req --> Mail[Email token via notification channel]
  Mail --> Validate{Token valid and unexpired?}
  Validate -- no --> Rej[Safe generic rejection]
  Validate -- yes --> Update[Update password hash]
  Update --> Done((Signed out to login))
  AD --> Done2((Session ends))
```

## Newsletter subscription activity

```mermaid
flowchart TD
  Start((Start)) --> Input[Enter email in footer form]
  Input --> Valid{Valid email?}
  Valid -- no --> ShowErr[Inline validation error] --> Input
  Valid -- yes --> Post[POST /newsletter + Idempotency-Key]
  Post --> Norm[Normalize: trim + lowercase]
  Norm --> Dup{Already subscribed?}
  Dup -- yes --> Same[200 alreadySubscribed — no duplicate record]
  Dup -- no --> Persist[Persist newsletter.subscribe notification]
  Persist --> OK[201 success state]
  Same --> End((End))
  OK --> End
```

## PWA offline / cache activity

```mermaid
flowchart TD
  Start((App loads)) --> Reg[Service worker registered]
  Reg --> Nav{Navigation request}
  Nav -- GET /api/* --> NetFirst[Network first — never cache private API responses]
  Nav -- static/navigations --> CacheFirst{In cache?}
  CacheFirst -- yes --> Serve[Serve cached]
  CacheFirst -- no --> Fetch[Fetch and update cache]
  Fetch -- offline --> Fallback[Serve cached shell /]
  NetFirst -- offline --> CachedApi{Cached copy?}
  CachedApi -- yes --> ServeApi[Serve stale API copy]
  CachedApi -- no --> OfflineBanner[Show offline state]
```

## Kafka / Prometheus / Grafana data flow

```mermaid
flowchart LR
  subgraph API
    RT[Routes + services]
    M[Metrics helpers: search_requests_total, bookings_total, payments_total, parcels_total, event_tickets_total, insurance_subscriptions_total]
  end
  subgraph Worker
    K[ka.kafka consumers]
    Q[BullMQ jobs]
  end
  RT -->|publish booking.created, payment.confirmed| KafkaTopic[(Kafka topics)]
  KafkaTopic --> K
  KafkaTopic --> Q
  M -->|/metrics scrape| Prom[Prometheus]
  Prom -->|rules: HighErrorRate, SlowP95, BookingSurge, PaymentFailures| Alert[Alerting]
  Prom -->|datasource| Grafana[Grafana dashboards]
  Grafana --> Panels[API latency + error, corridor searches, bookings, payment outcomes, event tickets]
```

## ER overview (core entities)

```mermaid
erDiagram
  USER ||--o{ BOOKING : places
  USER ||--o{ PARCEL : sends
  USER ||--o{ INSURANCE_POLICY : subscribes
  USER ||--o{ EVENT_BOOKING : buys
  USER ||--o{ NOTIFICATION : receives
  TRANSPORTER ||--o{ VEHICLE : owns
  TRANSPORTER ||--o{ ROUTE : operates
  ROUTE ||--o{ TRIP : schedules
  TRIP ||--o{ SEAT_AVAILABILITY : locks
  TRIP ||--o{ BOOKING : "booked on"
  BOOKING ||--o{ PASSENGER : carries
  BOOKING ||--o{ PAYMENT : "paid by"
  BOOKING ||--|| TICKET : "issues"
  HOTEL ||--o{ HOTEL_BOOKING : offers
  RENTAL_VEHICLE ||--o{ RENTAL_BOOKING : offered-by
  EVENT ||--o{ TICKET_CATEGORY : splits
  TICKET_CATEGORY ||--o{ EVENT_BOOKING : reserves
  AGENCY }o--|| TRANSPORTER : belongs-to
  PLACE }o--|| CITY : in
```
