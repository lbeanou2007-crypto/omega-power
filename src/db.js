// Ce module fait un vrai appel réseau vers l'API du camarade (Spring Boot).
// Signature inchangée par rapport à la version simulée : fetchMesure(boitier)
// reste async et renvoie { soc, tension, courant, temp1, temp2 }.
//
// On passe par l'instance axios partagée (services/api.js), dont la baseURL
// est "/api" : Vite redirige ces requêtes vers l'API réelle (voir le "proxy"
// dans vite.config.js, cible définie par VITE_API_PROXY_TARGET dans .env).
// Avantage : le navigateur ne voit qu'une origine locale, donc pas de CORS
// à configurer côté API, et pas d'exception de certificat auto-signé à
// accepter manuellement (le proxy, côté serveur Node, ignore la validation
// du certificat grâce à "secure: false").
import api from "./services/api.js";

export async function fetchMesure(boitierNom) {
  const toutesLesMesures = (await api.get("/batteries")).data;

  // L'API renvoie un champ "nom" à plat sur chaque mesure (pas d'objet
  // "boitier" imbriqué) : voir Batterie.java côté API.
  const mesuresDuBoitier = toutesLesMesures.filter((m) => m.nom === boitierNom);

  if (mesuresDuBoitier.length === 0) {
    throw new Error(`Aucune mesure trouvée pour ${boitierNom}`);
  }

  // Tri par date de mesure pour être sûr de prendre la plus récente.
  mesuresDuBoitier.sort(
    (a, b) => new Date(a.dateMesure) - new Date(b.dateMesure)
  );
  const derniere = mesuresDuBoitier[mesuresDuBoitier.length - 1];

  // ⚠️ L'API n'a qu'un seul champ "temperature" (pas temp1/temp2).
  // On le duplique sur les deux pour ne pas casser l'affichage existant,
  // à corriger si besoin plus tard (ex: retirer une des deux tuiles).
  return {
    soc: derniere.etatCharge,
    tension: derniere.tension,
    courant: derniere.courant,
    temp1: derniere.temperature,
    temp2: derniere.temperature,
  };
}

// Récupère la liste des boîtiers connus, déduite des mesures existantes
// (l'API n'expose pas de route dédiée /boitiers).
export async function fetchBoitiers() {
  const toutesLesMesures = (await api.get("/batteries")).data;
  return [...new Set(toutesLesMesures.map((m) => m.nom))];
}
