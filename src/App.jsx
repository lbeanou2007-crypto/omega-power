import React, { useState, useEffect, useRef } from "react";
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
import { fetchBoitiers, fetchDernieresMesures, fetchMesuresDuJour } from "./db";
import GestionMesures from "./GestionMesures";

// Plage nominale (min/max, utilisée pour l'état ok/crit) et bornes physiques
// absolues (floor/ceil, utilisées pour l'axe Y du graphique).
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

const TEMP_MODES = ["Groupe 1", "Groupe 2", "Les deux"];
const MOIS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

// Détermine si une valeur est dans sa plage nominale (min/max) ou en alerte.
// Utilisé à la fois pour la classe CSS de la tuile (ok/crit) et pour le badge
// généré automatiquement par App.css (::after sur .metric-card).
// Sans valeur (aucune mesure reçue), pas de classe, donc pas de badge.
function statusOf(value, min, max) {
  if (value === null) return "";
  return value < min || value > max ? "crit" : "ok";
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
  // Boîtiers fournis par l'API ([{ id, nom }]) et id du boîtier sélectionné.
  const [boitiers, setBoitiers] = useState([]);
  const [boitierId, setBoitierId] = useState(null);
  const boitierCourant = boitiers.find((b) => b.id === boitierId) || null;
  // Nom du boîtier sélectionné (affichage).
  const boitier = boitierCourant ? boitierCourant.nom : "";
  const [tempMode, setTempMode] = useState("Les deux");
  const [connected, setConnected] = useState(true);

  // "live" : mesures en direct (comportement d'origine).
  // "historique" : résultat d'une recherche par date.
  const [mode, setMode] = useState("live");

  // 20 dernières mesures enregistrées du boîtier, de la plus ancienne à la plus
  // récente (tuiles, mini-graphiques et export CSV en mode live). Vide tant
  // qu'aucune mesure n'a été reçue.
  const [history, setHistory] = useState([]);
  // Message d'erreur du dernier appel à l'API en échec (distinct de la
  // déconnexion manuelle via le bouton).
  const [erreurReseau, setErreurReseau] = useState(null);

  // --- État de la recherche par date -----------------------------------
  const maintenant = new Date();
  const [jourRecherche, setJourRecherche] = useState(maintenant.getDate());
  const [moisRecherche, setMoisRecherche] = useState(maintenant.getMonth() + 1);
  const [anneeRecherche, setAnneeRecherche] = useState(maintenant.getFullYear());
  const [resultatRecherche, setResultatRecherche] = useState(null); // { dateStr, points }
  const [erreurRecherche, setErreurRecherche] = useState(null);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);
  // Numéro de la dernière recherche : permet d'ignorer la réponse d'une recherche
  // devenue obsolète (changement de boîtier ou retour au direct entre-temps).
  const derniereRecherche = useRef(0);

  const anneesDisponibles = [];
  for (let a = maintenant.getFullYear(); a >= maintenant.getFullYear() - 5; a--) {
    anneesDisponibles.push(a);
  }

  // Chargement de la liste des boîtiers au démarrage. Triés par id pour que
  // le premier boîtier créé côté API (V16) soit sélectionné par défaut.
  useEffect(() => {
    let annule = false;
    fetchBoitiers()
      .then((liste) => {
        if (annule) return;
        const tries = [...liste].sort((a, b) => a.id - b.id);
        setBoitiers(tries);
        if (tries.length > 0) setBoitierId(tries[0].id);
      })
      .catch((err) => {
        if (!annule) setErreurReseau(`liste des boîtiers : ${err.message}`);
      });
    return () => {
      annule = true;
    };
  }, []);

  useEffect(() => {
    // En mode historique on n'interroge pas le boîtier en direct.
    if (mode !== "live") return undefined;
    // Si on simule une déconnexion, on arrête complètement le sondage
    // (pas de nouvel appel, pas de mise à jour de l'historique).
    if (!connected) return undefined;
    // Rien à sonder tant que la liste des boîtiers n'est pas chargée.
    if (boitierId === null) return undefined;

    // "Annulé" évite d'appliquer le résultat d'un appel encore en vol après
    // que le composant ait été démonté ou que boitier/connected aient changé.
    let annule = false;

    async function sonder() {
      try {
        const points = await fetchDernieresMesures(boitierId);
        if (annule) return;

        setHistory(points);
        setErreurReseau(points.length === 0 ? "aucune mesure disponible pour ce boîtier." : null);
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
  }, [connected, boitierId, mode]); // relancé si on (re)connecte, change de boîtier, ou change de mode

  async function lancerRecherche() {
    if (!dateEstValide(anneeRecherche, moisRecherche, jourRecherche)) {
      setErreurRecherche("Cette date n'existe pas (ou est dans le futur).");
      setResultatRecherche(null);
      return;
    }
    const numero = ++derniereRecherche.current;
    const dateStr = `${anneeRecherche}-${String(moisRecherche).padStart(2, "0")}-${String(jourRecherche).padStart(2, "0")}`;
    setErreurRecherche(null);
    setRechercheEnCours(true);
    try {
      const points = await fetchMesuresDuJour(boitierId, dateStr);
      if (numero !== derniereRecherche.current) return;
      setResultatRecherche({ dateStr, points });
      setMode("historique");
    } catch (err) {
      if (numero === derniereRecherche.current) {
        setErreurRecherche(`Recherche impossible : ${err.message}`);
      }
    } finally {
      if (numero === derniereRecherche.current) setRechercheEnCours(false);
    }
  }

  function revenirAuDirect() {
    derniereRecherche.current++;
    setRechercheEnCours(false);
    setMode("live");
    setResultatRecherche(null);
    setErreurRecherche(null);
  }

  // Les mesures affichées appartiennent à un seul boîtier : on repart de zéro
  // quand on en change, pour ne jamais afficher celles du précédent.
  function changerBoitier(id) {
    revenirAuDirect();
    setHistory([]);
    setErreurReseau(null);
    setBoitierId(id);
  }

  const historiqueAffiche =
    mode === "historique" && resultatRecherche ? resultatRecherche.points : history;

  // Mesure affichée dans les tuiles : la plus récente de la liste, ou null si
  // la liste est vide (les tuiles affichent alors "—").
  const dataAffichee = historiqueAffiche[historiqueAffiche.length - 1] ?? null;
  const valeur = (cle) => (dataAffichee ? dataAffichee[cle] : null);

  // Liste complète des métriques possibles, avant filtrage par le sélecteur
  // de température. Chaque entrée regroupe tout ce dont une tuile a besoin :
  // libellé, unité, valeur courante, plage nominale/bornes et couleur.
  const allMetrics = [
    { key: "soc", label: "SOC", unit: "%", value: valeur("soc"), ...LIMITS.soc },
    { key: "tension", label: "Tension", unit: "V", value: valeur("tension"), ...LIMITS.tension },
    { key: "courant", label: "Courant", unit: "A", value: valeur("courant"), ...LIMITS.courant },
    { key: "temp1", label: "Temperature (groupe 1)", unit: "°C", value: valeur("temp1"), ...LIMITS.temp1 },
    { key: "temp2", label: "Temperature (groupe 2)", unit: "°C", value: valeur("temp2"), ...LIMITS.temp2 },
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
          <select value={boitierId ?? ""} onChange={(e) => changerBoitier(Number(e.target.value))}>
            {boitiers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nom}
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
        {mode === "live" && dataAffichee && (
          <span className="horodatage">dernière mesure : {dataAffichee.time}</span>
        )}
      </div>

      {/* Recherche des mesures enregistrées pour un jour / mois / année. */}
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
        <button
          type="button"
          onClick={lancerRecherche}
          disabled={boitierId === null || rechercheEnCours}
        >
          {rechercheEnCours ? "Recherche…" : "Rechercher"}
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
          {resultatRecherche.points.length === 0
            ? `Aucune mesure le ${resultatRecherche.dateStr} (${boitier}).`
            : `${resultatRecherche.points.length} mesure(s) le ${resultatRecherche.dateStr} (${boitier}). Les tuiles affichent la dernière de la journée.`}
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
              {m.value === null ? "—" : `${m.value.toFixed(1)} ${m.unit}`}
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

      {/* Gestion des mesures de l'API (GET par id, POST, DELETE).
          key : changer de boîtier remet la section à zéro (la mesure chargée
          appartenait à l'ancien boîtier). */}
      <GestionMesures key={boitierId ?? "aucun"} boitier={boitierCourant} />
    </div>
  );
}
