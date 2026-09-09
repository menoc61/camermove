"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function TermsPage() {
  return (
    <Card className="mx-auto max-w-3xl mt-10 p-6">
      <CardHeader>
        <CardTitle>Conditions d’utilisation</CardTitle>
      </CardHeader>
      <CardContent className="prose prose-sm max-w-none">
        <p>Cette page répertorie les conditions générales d’utilisation du service Camermove. Elle est fournie à titre d’exemple ; les contenus juridiques devront être validés par votre équipe légale.</p>
        <ul>
          <li>Utilisation du service</li>
          <li>Protection des données personnelles</li>
          <li>Responsabilité et limitation de responsabilité</li>
          <li>Propriété intellectuelle</li>
          <li>Modification des conditions</li>
        </ul>
        <p>En continuant d’utiliser Camermove, vous acceptez ces conditions.</p>
      </CardContent>
    </Card>
  );
}
