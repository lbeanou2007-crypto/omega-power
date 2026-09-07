// Ce module simule un appel réseau vers une base de données / API.
// Aujourd'hui il génère une mesure aléatoire après un petit délai.
// Le jour où une vraie API existe, il suffit de remplacer le contenu de
// fetchMesure() par un vrai fetch(), SANS changer App.jsx (même signature :
// une fonction async qui retourne un objet mesure ou lève une erreur).

const LIMITS = {
  soc: { floor: 0, ceil: 100 },
  tension: { floor: 40, ceil: 56 },
  courant: { floor: -30, ceil: 30 },
  temp1: { floor: -10, ceil: 60 },
  temp2: { floor: -10, ceil: 60 },
};

function clamp(value, floor, ceil) {
  return Math.min(ceil, Math.max(floor, value));
}

// Dernière mesure "en base", pour simuler une évolution cohérente d'un appel
// à l'autre (comme le ferait une vraie BDD qui stocke l'état du boîtier).
let derniereMesure = {
  soc: 75,
  tension: 48.2,
  courant: -6.4,
  temp1: 28.5,
  temp2: 26.1,
};

// délai réseau simulé, en ms (utile pour tester des états de chargement)
const LATENCE_MIN = 150;
const LATENCE_MAX = 600;

// probabilité qu'un appel échoue, pour tester le bandeau .erreur
const TAUX_ERREUR = 0.03;

export function fetchMesure(boitier) {
  const latence = LATENCE_MIN + Math.random() * (LATENCE_MAX - LATENCE_MIN);

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < TAUX_ERREUR) {
        reject(new Error(`Boîtier ${boitier} injoignable`));
        return;
      }

      derniereMesure = {
        soc: clamp(derniereMesure.soc + (Math.random() - 0.5) * 2, LIMITS.soc.floor, LIMITS.soc.ceil),
        tension: clamp(derniereMesure.tension + (Math.random() - 0.5) * 0.5, LIMITS.tension.floor, LIMITS.tension.ceil),
        courant: clamp(derniereMesure.courant + (Math.random() - 0.5) * 1, LIMITS.courant.floor, LIMITS.courant.ceil),
        temp1: clamp(derniereMesure.temp1 + (Math.random() - 0.5) * 0.5, LIMITS.temp1.floor, LIMITS.temp1.ceil),
        temp2: clamp(derniereMesure.temp2 + (Math.random() - 0.5) * 0.5, LIMITS.temp2.floor, LIMITS.temp2.ceil),
      };

      // On renvoie une copie pour éviter que l'appelant ne modifie l'état interne.
      resolve({ ...derniereMesure });
    }, latence);
  });
}
