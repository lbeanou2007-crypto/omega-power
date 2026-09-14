// Ce module fait un vrai appel réseau vers l'API du boîtier (Swagger).
// Signature inchangée par rapport à la version simulée.

const BASE_URL = "https://192.168.100.197:8443/api/batteries";

export async function fetchMesure(boitierNom) {
  let response;
  try {
    response = await fetch(`${BASE_URL}/mesures`);
  } catch (err) {
    throw new Error(`Boîtier ${boitierNom} injoignable (réseau)`);
  }

  if (!response.ok) {
    throw new Error(`Boîtier ${boitierNom} : erreur API (${response.status})`);
  }

  const toutesLesMesures = await response.json();

  // Le nom du boîtier est dans mesure.boitier.nom (objet imbriqué)
  const mesuresDuBoitier = toutesLesMesures.filter(
    (m) => m.boitier?.nom === boitierNom
  );

  if (mesuresDuBoitier.length === 0) {
    throw new Error(`Aucune mesure trouvée pour ${boitierNom}`);
  }

  // Tri par date (time) pour être sûr de prendre la plus récente
  mesuresDuBoitier.sort((a, b) => new Date(a.time) - new Date(b.time));
  const derniere = mesuresDuBoitier[mesuresDuBoitier.length - 1];

  // ⚠️ L'API n'a qu'un seul champ "temp" (pas temp1/temp2).
  // On le duplique sur les deux pour ne pas casser l'affichage existant,
  // à corriger si besoin plus tard (ex: retirer une des deux tuiles).
  return {
    soc: derniere.soc,
    tension: derniere.tension,
    courant: derniere.courant,
    temp1: derniere.temp,
    temp2: derniere.temp,
  };
}

// Récupère la liste des boîtiers disponibles depuis l'API
export async function fetchBoitiers() {
  const response = await fetch(`${BASE_URL}/boitiers`);
  if (!response.ok) throw new Error(`Erreur API (${response.status})`);
  const boitiers = await response.json();
  return boitiers.map((b) => b.nom); // ["BMS_V14", "V16", "V16_MAC", "V17"]
}