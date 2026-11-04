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
// Une mesure renvoyée par l'API :
//   { id, boitierId, boitierNom, soc, tension, courant, temp, alarme, dateMesureNc }
import api from "./services/api.js";

// GET /api/boitiers -> [{ id, nom }, ...]
export async function fetchBoitiers() {
  return (await api.get("/boitiers")).data;
}

// Dernière mesure d'un boîtier, au format attendu par les tuiles de App.jsx :
// { soc, tension, courant, temp1, temp2 }.
export async function fetchMesure(boitierId) {
  const dernieres = (
    await api.get(`/boitiers/${boitierId}/mesures/dernieres`, { params: { limit: 1 } })
  ).data;

  if (dernieres.length === 0) {
    throw new Error("Aucune mesure disponible pour ce boîtier");
  }
  const derniere = dernieres[0];

  // ⚠️ L'API n'a qu'un seul champ "temp" (pas temp1/temp2).
  // On le duplique sur les deux pour ne pas casser l'affichage existant.
  return {
    soc: derniere.soc,
    tension: derniere.tension,
    courant: derniere.courant,
    temp1: derniere.temp,
    temp2: derniere.temp,
  };
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
