"use client"
import Link from "next/link"

export function Navigation() {
  return (
    <nav className="yolo-nav" id="primary-nav">
      <div className="container">
        <div className="nav-columns">
          <div className="nav-column">
            <div className="nav-label">Menu</div>
            <ul className="nav-links">
              <li>
                <Link href="/">Accueil</Link>
              </li>
              <li>
                <Link href="/results?origin=Yaound%C3%A9&destination=Douala&pax=1">
                  Transport interurbain
                </Link>
              </li>
              <li>
                <Link href="/hotels">Hôtels &amp; appartements</Link>
              </li>
              <li>
                <Link href="/rentals">Location de véhicules</Link>
              </li>
              <li>
                <Link href="/parcels">Transport de colis</Link>
              </li>
              <li>
                <Link href="/insurance">Assurance voyage</Link>
              </li>
              <li>
                <Link href="/events">Billetterie événements</Link>
              </li>
              <li>
                <Link href="/dashboard">Mes réservations</Link>
              </li>
              <li>
                <Link href="/transporter/apply">Devenir partenaire</Link>
              </li>
            </ul>
          </div>
          <div className="nav-column">
            <div className="nav-label">Contact</div>
            <div className="nav-infos">
              <ul className="nav-info">
                <li className="nav-info-label">Email</li>
                <li>
                  <a href="mailto:contact@camermove.cm">contact@camermove.cm</a>
                </li>
                <li>
                  <a href="mailto:support@camermove.cm">support@camermove.cm</a>
                </li>
              </ul>
              <ul className="nav-info">
                <li className="nav-info-label">Siège</li>
                <li>Yaoundé</li>
                <li>Douala</li>
                <li>Cameroun</li>
              </ul>
              <ul className="nav-info">
                <li className="nav-info-label">Téléphone</li>
                <li>+237 6 XX XX XX XX</li>
              </ul>
              <ul className="nav-info">
                <li className="nav-info-label">Légal</li>
                <li>
                  <Link href="/legal/cgu">CGU</Link>
                </li>
                <li>
                  <Link href="/legal/privacy">Confidentialité</Link>
                </li>
                <li>
                  <Link href="/legal/terms">Mentions légales</Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="nav-meta">
          <span>Réinventons la mobilité africaine</span>
          <span>Yaoundé · Douala · 2026</span>
        </div>
      </div>
    </nav>
  )
}
