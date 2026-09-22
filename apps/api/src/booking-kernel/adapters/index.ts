import type { PayableKind } from "../references.js"
import type { AdapterInstance } from "./types.js"
import { hotelAdapter } from "./hotel.js"
import { rentalAdapter } from "./rental.js"
import { eventAdapter } from "./event.js"
import { parcelAdapter } from "./parcel.js"
import { tripAdapter } from "./trip.js"
import { insuranceAdapter } from "./insurance.js"

export type { AdapterInstance } from "./types.js"
export { hotelAdapter, rentalAdapter, eventAdapter, parcelAdapter, tripAdapter, insuranceAdapter }

export function getAdapter(kind: PayableKind): AdapterInstance {
  switch (kind) {
    case "hotel": return hotelAdapter
    case "rental": return rentalAdapter
    case "event": return eventAdapter
    case "parcel": return parcelAdapter
    case "trip": return tripAdapter
    case "insurance": return insuranceAdapter
  }
}
