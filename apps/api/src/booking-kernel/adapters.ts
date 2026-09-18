/**
 * Backward-compat shim — adapters now live per-domain in `./adapters/`
 * (hotel, rental, event, parcel, trip, insurance + shared types).
 * This module re-exports the registry so existing `./adapters.js` importers
 * (confirm, fail, reserve, cancel, expiry, index) keep working untouched.
 */
export * from "./adapters/index.js"
