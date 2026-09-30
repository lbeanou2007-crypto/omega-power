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

// L'API du camarade ne gere qu'UN seul boitier physique : le V16. Ses mesures
// n'ont pas de champ "nom" (pas de notion de boitier cote API), donc aucun
// filtrage n'est possible ni necessaire : toutes les mesures recues sont
// celles du V16. Le parametre "boitierNom" est conserve pour ne pas casser
// l'appelant (App.jsx garde ses 4 boitiers), mais il est ignore : quel que
// soit le boitier selectionne, on affiche les valeurs du V16.
// A remettre en filtre (m.nom === boitierNom) le jour ou l'API redevient
// multi-boitiers.
// eslint-disable-next-line no-unused-vars
export async function fetchMesure(boitierNom) {
  const toutesLesMesures = (await api.get("/batteries")).data;

  if (toutesLesMesures.length === 0) {
    throw new Error("Aucune mesure disponible (boîtier V16)");
  }

  // Tri par date de mesure pour être sûr de prendre la plus récente.
  const triees = [...toutesLesMesures].sort(
    (a, b) => new Date(a.dateMesure) - new Date(b.dateMesure)
  );
  const derniere = triees[triees.length - 1];

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

// Seul le V16 est branche cote API pour l'instant.
export async function fetchBoitiers() {
  return ["V16"];
}

// --- CRUD sur une mesure precise (endpoints /api/batteries/{id}) ----------
// Ces fonctions renvoient la mesure brute de l'API :
// { id, nom, etatCharge, tension, courant, temperature, alarme, dateMesure }.

// Le champ "nom" est obligatoire cote API (@NotNull) mais n'est pas saisi
// dans le formulaire : on envoie toujours "V16", seul boitier branche.
const NOM_BOITIER = "V16";

// GET /api/batteries/{id} -> une mesure, ou erreur 404 si l'id n'existe pas.
export async function fetchMesureParId(id) {
  return (await api.get(`/batteries/${id}`)).data;
}
