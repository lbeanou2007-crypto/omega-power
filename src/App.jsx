import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import "./App.css";
import { fetchMesure } from "./db";

// Plage nominale (min/max, utilisée pour l'état ok/crit et l'axe Y du graphique)
// et bornes physiques absolues (floor/ceil, utilisées pour empêcher la simulation
// de dériver vers des valeurs impossibles, ex: SOC > 100%).
// Valeurs basees sur la fiche technique OMEGA EXPERT-S (ES48100A, 100Ah 51,2V).
const LIMITS = {
  soc: { min: 20, max: 100, floor: 0, ceil: 100, color: "#0d7fbf" },
  // Tension nominale 51,2V. Coupure decharge 41,6V, charge max 57,6V (25°C).
  tension: { min: 44, max: 56, floor: 41.6, ceil: 57.6, color: "#2f8f4e" },
  // Courant de charge/decharge max du BMS integre : 100A (marge d'alerte a 90A).
  courant: { min: -90, max: 90, floor: -100, ceil: 100, color: "#a1408c" },
  // Charge : 0 a 55°C (plus restrictive), decharge : -20 a 55°C. On prend la
  // plage de charge comme nominale et la plage de decharge comme bornes absolues.
  temp1: { min: 0, max: 55, floor: -20, ceil: 55, color: "#c76b1f" },
  temp2: { min: 0, max: 55, floor: -20, ceil: 55, color: "#b5501a" },
};

const BOITIERS = ["V16", "BMS_V14", "V16_MAC", "V17"];
const TEMP_MODES = ["Groupe 1", "Groupe 2", "Les deux"];
const MOIS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

// Détermine si une valeur est dans sa plage nominale (min/max) ou en alerte.
// Utilisé à la fois pour la classe CSS de la tuile (ok/crit) et pour le badge
// généré automatiquement par App.css (::after sur .metric-card).
function statusOf(value, min, max) {
  return value < min || value > max ? "crit" : "ok";
}

// --- Génération de données historiques SIMULÉES ---------------------------
// Pas de vraie base de données pour l'instant : on génère une journée de
// mesures plausibles pour un (boîtier, jour) donné. Le générateur est
// "seedé" à partir de la date + du boîtier, donc une même recherche renvoie
// toujours les mêmes valeurs (utile pour tester l'IHM de façon reproductible).

// Petit générateur pseudo-aléatoire déterministe (mulberry32).
function creerRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Transforme une chaîne (ex: "2024-03-14|boitier_V16") en entier pour servir
// de graine au générateur pseudo-aléatoire.
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Génère un point de mesure plausible pour un instant donné de la journée
// (heureDecimal ∈ [0, 24[), avec une légère variation sinusoïdale + du bruit.
function genererPoint(rng, heureDecimal) {
  const cycle = Math.sin((heureDecimal / 24) * Math.PI * 2);
  const soc = clamp(60 + cycle * 25 + (rng() - 0.5) * 8, LIMITS.soc.floor, LIMITS.soc.ceil);
  const tension = clamp(48 + cycle * 2.5 + (rng() - 0.5) * 1.2, LIMITS.tension.floor, LIMITS.tension.ceil);
  const courant = clamp(cycle * 12 + (rng() - 0.5) * 6, LIMITS.courant.floor, LIMITS.courant.ceil);
  const temp1 = clamp(24 + cycle * 8 + (rng() - 0.5) * 3, LIMITS.temp1.floor, LIMITS.temp1.ceil);
  const temp2 = clamp(23 + cycle * 8 + (rng() - 0.5) * 3, LIMITS.temp2.floor, LIMITS.temp2.ceil);
  return { soc, tension, courant, temp1, temp2 };
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// Génère une journée complète (un point toutes les 30 minutes) pour le
// boîtier et la date donnés.
function genererHistoriqueSimule(boitier, annee, mois, jour) {
  const dateStr = `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
  const rng = creerRng(hashSeed(`${dateStr}|${boitier}`));
  const points = [];
  for (let demiHeure = 0; demiHeure < 48; demiHeure++) {
    const heureDecimal = demiHeure / 2;
    const h = Math.floor(heureDecimal);
    const m = heureDecimal % 1 === 0 ? "00" : "30";
    const mesure = genererPoint(rng, heureDecimal);
    points.push({
      time: `${String(h).padStart(2, "0")}:${m}`,
      ...mesure,
    });
  }
  return { dateStr, points };
}

// Vérifie qu'un triplet jour/mois/année correspond à une vraie date
// (rejette par ex. le 31 février) et qu'elle n'est pas dans le futur.
function dateEstValide(annee, mois, jour) {
  const d = new Date(annee, mois - 1, jour);
  const valide =
    d.getFullYear() === annee && d.getMonth() === mois - 1 && d.getDate() === jour;
  if (!valide) return false;
  return d <= new Date();
}

export default function App() {
  const [boitier, setBoitier] = useState(BOITIERS[0]);
  const [tempMode, setTempMode] = useState("Les deux");
  const [connected, setConnected] = useState(true);

  // "live" : mesures en direct (comportement d'origine).
  // "historique" : résultat d'une recherche par date, données simulées.
  const [mode, setMode] = useState("live");

  // Valeurs "instantanées" affichées dans les tuiles (mode live).
  const [data, setData] = useState({
    soc: 110,
    tension: 48.2,
    courant: -6.4,
    temp1: 28.5,
    temp2: 26.1,
  });

  // Historique glissant (20 derniers points) utilisé par les mini-graphiques
  // et par l'export CSV en mode live.
  const [history, setHistory] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  // Message d'erreur du dernier appel "BDD" en échec (distinct de la
  // déconnexion manuelle via le bouton).
  const [erreurReseau, setErreurReseau] = useState(null);

  // --- État de la recherche par date -----------------------------------
  const maintenant = new Date();
  const [jourRecherche, setJourRecherche] = useState(maintenant.getDate());
  const [moisRecherche, setMoisRecherche] = useState(maintenant.getMonth() + 1);
  const [anneeRecherche, setAnneeRecherche] = useState(maintenant.getFullYear());
  const [resultatRecherche, setResultatRecherche] = useState(null); // { dateStr, points }
  const [erreurRecherche, setErreurRecherche] = useState(null);

  const anneesDisponibles = [];
  for (let a = maintenant.getFullYear(); a >= maintenant.getFullYear() - 5; a--) {
    anneesDisponibles.push(a);
  }

  useEffect(() => {
    // En mode historique on n'interroge pas le boîtier en direct.
    if (mode !== "live") return undefined;
    // Si on simule une déconnexion, on arrête complètement le sondage
    // (pas de nouvel appel, pas de mise à jour de l'historique).
    if (!connected) return undefined;

    // "Annulé" évite d'appliquer le résultat d'un appel encore en vol après
    // que le composant ait été démonté ou que boitier/connected aient changé.
    let annule = false;

    async function sonder() {
      try {
        const mesure = await fetchMesure(boitier);
        if (annule) return;

        const now = new Date();
        const point = { time: now.toLocaleTimeString("fr-FR"), ...mesure };

        setData(mesure);
        // On ne garde que les 20 derniers points pour éviter que l'historique
        // (et donc les graphiques/le CSV) ne grossisse indéfiniment.
        setHistory((prevHistory) => [...prevHistory, point].slice(-20));
        setLastUpdate(now);
        setErreurReseau(null);
      } catch (err) {
        if (!annule) setErreurReseau(err.message);
      }
    }

    sonder(); // premier appel immédiat, sans attendre le premier intervalle
    const id = setInterval(sonder, 2500);

    return () => {
      annule = true;
      clearInterval(id);
    };
  }, [connected, boitier, mode]); // relancé si on (re)connecte, change de boîtier, ou change de mode

  function lancerRecherche() {
    if (!dateEstValide(anneeRecherche, moisRecherche, jourRecherche)) {
      setErreurRecherche("Cette date n'existe pas (ou est dans le futur).");
      setResultatRecherche(null);
      return;
    }
    setErreurRecherche(null);
    const resultat = genererHistoriqueSimule(boitier, anneeRecherche, moisRecherche, jourRecherche);
    setResultatRecherche(resultat);
    setMode("historique");
  }

  function revenirAuDirect() {
    setMode("live");
    setResultatRecherche(null);
    setErreurRecherche(null);
  }

  // Source des mesures affichées dans les tuiles : le dernier point de
  // l'historique simulé en mode "historique", sinon les données live.
  const dataAffichee =
    mode === "historique" && resultatRecherche
      ? resultatRecherche.points[resultatRecherche.points.length - 1]
      : data;

  const historiqueAffiche =
    mode === "historique" && resultatRecherche ? resultatRecherche.points : history;

  // Liste complète des métriques possibles, avant filtrage par le sélecteur
  // de température. Chaque entrée regroupe tout ce dont une tuile a besoin :
  // libellé, unité, valeur courante, plage nominale/bornes et couleur.
  const allMetrics = [
    { key: "soc", label: "SOC", unit: "%", value: dataAffichee.soc, ...LIMITS.soc },
    { key: "tension", label: "Tension", unit: "V", value: dataAffichee.tension, ...LIMITS.tension },
    { key: "courant", label: "Courant", unit: "A", value: dataAffichee.courant, ...LIMITS.courant },
    { key: "temp1", label: "Temperature (groupe 1)", unit: "°C", value: dataAffichee.temp1, ...LIMITS.temp1 },
    { key: "temp2", label: "Temperature (groupe 2)", unit: "°C", value: dataAffichee.temp2, ...LIMITS.temp2 },
  ];

  // Filtre les tuiles température affichées selon le sélecteur "Groupe 1 /
  // Groupe 2 / Les deux". SOC, tension et courant sont toujours affichés.
  const metrics = allMetrics.filter((m) => {
    if (m.key === "temp1") return tempMode === "Groupe 1" || tempMode === "Les deux";
    if (m.key === "temp2") return tempMode === "Groupe 2" || tempMode === "Les deux";
    return true;
  });

  function exportToCSV() {
    const headers = ["Heure", ...metrics.map((m) => `${m.label} (${m.unit})`)];
    const rows = historiqueAffiche.map((point) => [
      point.time,
      ...metrics.map((m) => point[m.key].toFixed(1)),
    ]);
    // Séparateur ";" car Excel en locale française utilise "," comme séparateur
    // décimal, et un BOM UTF-8 ("\uFEFF") pour que les accents s'affichent
    // correctement (sans ça Excel devine le mauvais encodage et affiche
    // "TempÃ©rature" au lieu de "Température").
    const csvContent = [headers, ...rows].map((row) => row.join(";")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const suffixe =
      mode === "historique" && resultatRecherche ? resultatRecherche.dateStr : "direct";
    link.download = `historique_batterie_${suffixe}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="ihm-dashboard">
      <div className="selecteur">
        <label>
          Boîtier{" "}
          <select value={boitier} onChange={(e) => setBoitier(e.target.value)}>
            {BOITIERS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label>
          Température{" "}
          <select value={tempMode} onChange={(e) => setTempMode(e.target.value)}>
            {TEMP_MODES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        {/* Bouton de test : simule une coupure de connexion sans code réseau réel. */}
        <button type="button" onClick={() => setConnected((c) => !c)}>
          {connected ? "simuler déconnexion" : "reconnecter"}
        </button>
        {mode === "live" && lastUpdate && (
          <span className="horodatage">
            dernière mesure : {lastUpdate.toLocaleTimeString("fr-FR")}
          </span>
        )}
      </div>

      {/* Recherche de données historiques par jour / mois / année.
          Les données renvoyées sont simulées (pas de vraie base de
          données branchée pour l'instant), mais reproductibles : une
          même date + un même boîtier redonnent toujours les mêmes
          valeurs. */}
      <div className="selecteur recherche-historique">
        <label>
          Jour{" "}
          <select value={jourRecherche} onChange={(e) => setJourRecherche(Number(e.target.value))}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mois{" "}
          <select value={moisRecherche} onChange={(e) => setMoisRecherche(Number(e.target.value))}>
            {MOIS.map((nom, i) => (
              <option key={nom} value={i + 1}>
                {nom}
              </option>
            ))}
          </select>
        </label>
        <label>
          Année{" "}
          <select value={anneeRecherche} onChange={(e) => setAnneeRecherche(Number(e.target.value))}>
            {anneesDisponibles.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={lancerRecherche}>
          Rechercher
        </button>
        {mode === "historique" && (
          <button type="button" onClick={revenirAuDirect}>
            Revenir au direct
          </button>
        )}
      </div>

      {erreurRecherche && <div className="erreur">{erreurRecherche}</div>}

      {mode === "historique" && resultatRecherche && (
        <div className="erreur" style={{ background: "#eef3fb", color: "#1d3a5f" }}>
          Données simulées pour le {resultatRecherche.dateStr} ({boitier}) — aucune base de
          données réelle n'est encore branchée.
        </div>
      )}

      {mode === "live" && !connected && (
        <div className="erreur">Connexion au boîtier {boitier} interrompue.</div>
      )}
      {mode === "live" && connected && erreurReseau && (
        <div className="erreur">Erreur de lecture : {erreurReseau}</div>
      )}

      {metrics.map((m) => {
        const status = statusOf(m.value, m.min, m.max);
        return (
          // La classe "ok"/"crit" pilote la couleur de bordure ET le badge
          // "✓ Nominal" / "⚠ Hors plage" généré par App.css (::after) — on ne
          // génère pas ce texte ici, uniquement la classe.
          <div key={m.key} className={`metric-card ${status}`}>
            {/* :first-child dans App.css → style du libellé */}
            <div>{m.label}</div>
            {/* :nth-child(2) dans App.css → style de la valeur.
                --couleur-texte est une variable CSS lue par App.css pour teinter
                le chiffre selon la métrique, indépendamment de l'état ok/crit. */}
            <div style={{ "--couleur-texte": m.color }}>
              {m.value.toFixed(1)} {m.unit}
            </div>
            {/* Mini-graphique propre à cette métrique : 3e enfant de la tuile,
                ne perturbe pas les sélecteurs :first-child/:nth-child(2) et
                l'état ::after (toujours calculé après tous les enfants). */}
            <div style={{ width: "100%", height: 110, marginTop: 4 }}>
              <ResponsiveContainer>
                <LineChart data={historiqueAffiche} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 9 }} minTickGap={30} />
                  {/* domain fixé sur floor/ceil (bornes physiques) plutôt que sur
                      min/max nominal, pour que l'axe ne "saute" pas si une
                      valeur sort de la plage nominale. */}
                  <YAxis tick={{ fontSize: 9 }} domain={[m.floor, m.ceil]} />
                  <Tooltip
                    formatter={(v) => [`${v.toFixed(1)} ${m.unit}`, m.label]}
                    labelFormatter={(l) => l}
                  />
                  <Line
                    type="monotone"
                    dataKey={m.key}
                    stroke={m.color}
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}

      {/* Désactivé tant qu'il n'y a aucune mesure à exporter. */}
      <button onClick={exportToCSV} disabled={historiqueAffiche.length === 0}>
        Exporter l'historique en CSV
      </button>
    </div>
  );
}
