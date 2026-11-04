// Ce module fait les vrais appels réseau vers l'API du camarade (Spring Boot),
// hébergée sur Render.
//
// On passe par l'instance axios partagée (services/api.js), dont la baseURL
// est "/api" : Vite redirige ces requêtes vers l'API réelle (voir le "proxy"
// dans vite.config.js, cible définie par VITE_API_PROXY_TARGET dans .env).
// Avantage : le navigateur ne voit qu'une origine locale, donc pas de CORS
// à configurer côté API.
//
// Structure de l'API utilisée ici :
//   /api/boitiers                          -> liste des boîtiers { id, nom }
//   /api/boitiers/{boitierId}/mesures      -> mesures d'un boîtier
//   /api/boitiers/{boitierId}/mesures/{id} -> une mesure précise
//   /api/boitiers/{boitierId}/mesures/dernieres?limit=N -> les N dernières mesures
//   /api/boitiers/{boitierId}/mesures/jour?date=AAAA-MM-JJ -> les mesures d'un jour
// Une mesure renvoyée par l'API :
//   { id, boitierId, boitierNom, soc, tension, courant, temp, alarme, dateMesureNc }
import api from "./services/api.js";

// GET /api/boitiers -> [{ id, nom }, ...]
export async function fetchBoitiers() {
  return (await api.get("/boitiers")).data;
}

// Transforme une mesure de l'API en point affichable par App.jsx (tuiles,
// graphiques, CSV). "time" est la date de la mesure, pas celle de la requête.
function versPoint(mesure) {
  return {
    id: mesure.id,
    time: new Date(mesure.dateMesureNc).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    timestamp: new Date(mesure.dateMesureNc).getTime(),
    soc: mesure.soc,
    tension: mesure.tension,
    courant: mesure.courant,
    // ⚠️ L'API n'a qu'un seul champ "temp" (pas temp1/temp2).
    // On le duplique sur les deux pour ne pas casser l'affichage existant.
    temp1: mesure.temp,
    temp2: mesure.temp,
  };
}

// Convertit une liste de mesures en points, de la plus ancienne à la plus récente.
function versPointsTries(mesures) {
  return mesures.map(versPoint).sort((a, b) => a.timestamp - b.timestamp);
}

// GET /api/boitiers/{boitierId}/mesures/dernieres -> les dernières mesures enregistrées.
export async function fetchDernieresMesures(boitierId, limit = 20) {
  const { data } = await api.get(`/boitiers/${boitierId}/mesures/dernieres`, {
    params: { limit },
  });
  return versPointsTries(data);
}

// GET /api/boitiers/{boitierId}/mesures/jour?date=AAAA-MM-JJ -> les mesures d'une journée.
export async function fetchMesuresDuJour(boitierId, dateStr) {
  const { data } = await api.get(`/boitiers/${boitierId}/mesures/jour`, {
    params: { date: dateStr },
  });
  return versPointsTries(data);
}

// --- Gestion d'une mesure précise d'un boîtier -----------------------------
// L'API ne permet plus de modifier une mesure (pas de route PUT).
// "valeurs" = { soc, tension, courant, temp, alarme } (saisies du formulaire).

// Corps attendu par l'API pour POST : la mesure + le boîtier auquel elle
// appartient ("boitier" est obligatoire, avec son nom).
function corpsMesure(boitier, valeurs) {
  return { boitier: { id: boitier.id, nom: boitier.nom }, ...valeurs };
}

// GET /api/boitiers/{boitierId}/mesures/{id} -> une mesure.
export async function fetchMesureParId(boitier, id) {
  return (await api.get(`/boitiers/${boitier.id}/mesures/${id}`)).data;
}

// POST /api/boitiers/{boitierId}/mesures -> crée une mesure et la renvoie
// (avec son nouvel id). L'API fixe elle-même la date de mesure.
export async function creerMesure(boitier, valeurs) {
  return (await api.post(`/boitiers/${boitier.id}/mesures`, corpsMesure(boitier, valeurs))).data;
}

// DELETE /api/boitiers/{boitierId}/mesures/{id} -> supprime la mesure.
export async function supprimerMesure(boitier, id) {
  await api.delete(`/boitiers/${boitier.id}/mesures/${id}`);
}
