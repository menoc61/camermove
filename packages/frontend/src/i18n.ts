export const I18N_DEFAULT = "fr" as const
export type Locale = typeof I18N_DEFAULT

const dict: Record<string, string> = {
  "nav.home": "Accueil",
  "nav.tickets": "Billets",
  "nav.stops": "Arrêts",
  "nav.more": "Plus",
  "common.enterDestination": "Entrez la destination",
  "search.origin": "Origine",
  "search.destination": "Destination",
  "search.trip": "Rechercher un trajet",
  "search.seats": "places",
  "most_bought": "Les plus achetés",
  "your_routes": "Vos itinéraires",
  "your_addresses": "Vos adresses",
  "your_ticket": "Votre billet",
}

export function t(key: string): string {
  return dict[key] ?? key
}
