const principles = [
  {
    n: "01",
    title: "Itinéraires avant tout",
    body: "Chaque écran part du trajet réel : horaires vérifiés, places restantes, prix fermes. Le reste — filtres, cartes, options — ne sert qu'à y arriver plus vite.",
  },
  {
    n: "02",
    title: "Un compte, six services",
    body: "Transport, hôtels, location, colis, assurance, événements : une seule identité, un seul portefeuille Mobile Money, un seul historique.",
  },
  {
    n: "03",
    title: "Prix affichés, sans surprise",
    body: "Le montant vu à la recherche est celui payé au guichet. Commissions partenaires et frais affichés ligne par ligne, avant validation.",
  },
  {
    n: "04",
    title: "Conçu pour durer",
    body: "Transactions ACID, files d'attente durables, exports et paramètres administrables : l'infrastructure encaisse la pointe de Tabaski comme le mardi creux.",
  },
]

export function Method() {
  return (
    <section
      aria-label="Notre méthode"
      className="border-t border-line bg-paper text-ink"
    >
      <div className="mx-auto max-w-[1560px] px-6 py-16 sm:px-8 md:px-12 md:py-24">
        <div className="mb-10 max-w-[64ch] border-b border-line pb-8 md:mb-12">
          <p className="text-[11px] uppercase tracking-[0.22em] text-ink-2">
            08 — Méthode
          </p>
          <h2 className="mt-3 max-w-[22ch] text-[clamp(1.8rem,3.2vw,2.8rem)] font-medium leading-[1.02] tracking-[-0.025em] text-balance">
            Quatre principes, appliqués à la mobilité.
          </h2>
          <p className="mt-4 max-w-[52ch] text-[14px] leading-[1.55] text-ink-1">
            Empruntés au Bauhaus — proportion, matériau, lumière, temps — et
            traduits pour les routes du Cameroun.
          </p>
        </div>

        <div className="grid grid-cols-12 gap-x-6 gap-y-10">
          {principles.map((p) => (
            <article
              key={p.n}
              className="col-span-12 border-t border-ink/70 pt-5 md:col-span-3"
            >
              <p className="font-body text-3xl font-medium leading-none tracking-[-0.04em] text-ink num-tabular">
                {p.n}
              </p>
              <h3 className="mt-4 text-xl font-medium tracking-[-0.015em] text-ink">
                {p.title}
              </h3>
              <p className="mt-3 max-w-[38ch] text-[15px] leading-[1.55] text-ink-1">
                {p.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
