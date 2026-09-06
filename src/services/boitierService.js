import api from './api.js';

const RESSOURCE = '/boitiers';

/*
 * ============================================================
 *  INTERRUPTEUR : passe a false le jour ou GET /api/boitiers
 *  existe reellement chez le camarade. C'est la SEULE ligne
 *  a changer, rien d'autre dans le projet ne bouge.
 * ============================================================
 */
const MODE_DEMO = true;

/**
 * Adapte un "Boitier" venu de l'API au vocabulaire de l'IHM.
 *
 * C'est le SEUL endroit du projet qui connait le format de l'API.
 * Le camarade a deja renomme ses champs une fois (soc -> etatCharge,
 * temp -> temperature, time -> dateMesure) : quand il recommence,
 * on corrige ici, et App.jsx ne bouge pas d'une ligne.
 */
const versBoitier = (b) => ({
  id: b.id,
  nom: b.nom,
  soc: b.etatCharge,
  tension: b.tension,
  courant: b.courant,
  tempGroupe1: b.tempGroupe1,
  tempGroupe2: b.tempGroupe2,
  alarme: b.alarme,
  // On ne construit une Date que si le champ existe reellement.
  date: b.dateMesure ? new Date(b.dateMesure) : null,
});

/* ---------------------------------------------------------------
 * Fausses donnees, le temps que l'API livre /api/boitiers.
 *
 * Point important : la demo renvoie le format BRUT de l'API
 * (etatCharge, dateMesure...), pas le format de l'IHM. Elle passe
 * donc par le meme versBoitier() que les vraies donnees. Le jour du
 * basculement, il n'y a aucun chemin de code nouveau a tester.
 * --------------------------------------------------------------- */

// 3 boitiers de 16 cellules, chacun avec 2 groupes de 8 cellules.
const DEMO_DEPART = [
  { id: 1, nom: 'boitier_V16',     soc: 78, tension: 48.4, courant: -6.2, t1: 28.5, t2: 30.1 },
  { id: 2, nom: 'boitier_BMS_V14', soc: 64, tension: 47.1, courant: -4.8, t1: 31.2, t2: 33.8 },
  { id: 3, nom: 'boitier_V16+MAC', soc: 91, tension: 49.6, courant:  2.4, t1: 26.9, t2: 27.4 },
];

let demoEtat = DEMO_DEPART.map((b) => ({ ...b }));

// Petite derive aleatoire, bornee : les courbes bougent sans partir en vrille.
const deriver = (valeur, amplitude, mini, maxi) => {
  const suivant = valeur + (Math.random() - 0.5) * amplitude;
  return Math.min(maxi, Math.max(mini, suivant));
};

const getBoitiersDemo = () => {
  demoEtat = demoEtat.map((b) => ({
    ...b,
    soc: deriver(b.soc, 1.5, 0, 100),
    tension: deriver(b.tension, 0.4, 40, 55),
    courant: deriver(b.courant, 1.0, -25, 25),
    t1: deriver(b.t1, 0.6, 15, 50),
    t2: deriver(b.t2, 0.6, 15, 50),
  }));

  const maintenant = new Date().toISOString();

  return demoEtat.map((b) => ({
    id: b.id,
    nom: b.nom,
    etatCharge: Math.round(b.soc),
    tension: b.tension,
    courant: b.courant,
    tempGroupe1: b.t1,
    tempGroupe2: b.t2,
    alarme: b.t2 > 45 || b.t1 > 45 || b.soc < 20,
    dateMesure: maintenant,
  }));
};

/**
 * Renvoie les boitiers, tries par id.
 *
 * Le tri n'est pas cosmetique : sans lui, l'ordre du menu deroulant
 * depend de l'ordre de la base et peut changer d'un rafraichissement
 * a l'autre sous les yeux de l'utilisateur.
 */
export const getBoitiers = async () => {
  const brut = MODE_DEMO ? getBoitiersDemo() : (await api.get(RESSOURCE)).data;
  return brut.map(versBoitier).sort((a, b) => a.id - b.id);
};
