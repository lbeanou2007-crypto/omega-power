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
const LIMITS = {
  soc: { min: 20, max: 100, floor: 0, ceil: 100, color: "#0d7fbf" },
  tension: { min: 44, max: 52, floor: 40, ceil: 56, color: "#2f8f4e" },
  courant: { min: -20, max: 20, floor: -30, ceil: 30, color: "#a1408c" },
  temp1: { min: 2, max: 45, floor: -10, ceil: 60, color: "#c76b1f" },
  temp2: { min: 2, max: 45, floor: -10, ceil: 60, color: "#b5501a" },
};

const BOITIERS = ["boitier_V16", "boitier_BMS_V14", "boitier_V16+MAC"];
const TEMP_MODES = ["Groupe 1", "Groupe 2", "Les deux"];

// Détermine si une valeur est dans sa plage nominale (min/max) ou en alerte.
// Utilisé à la fois pour la classe CSS de la tuile (ok/crit) et pour le badge
// généré automatiquement par App.css (::after sur .metric-card).
function statusOf(value, min, max) {
  return value < min || value > max ? "crit" : "ok";
}

export default function App() {
  const [boitier, setBoitier] = useState(BOITIERS[0]);
  const [tempMode, setTempMode] = useState("Les deux");
  const [connected, setConnected] = useState(true);

  // Valeurs "instantanées" affichées dans les tuiles.
  const [data, setData] = useState({
    soc: 75,
    tension: 448.2,
    courant: -6.4,
    temp1: 28.5,
    temp2: 26.1,
  });

  // Historique glissant (20 derniers points) utilisé par les mini-graphiques
  // et par l'export CSV.
  const [history, setHistory] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  // Message d'erreur du dernier appel "BDD" en échec (distinct de la
  // déconnexion manuelle via le bouton).
  const [erreurReseau, setErreurReseau] = useState(null);

  useEffect(() => {
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
  }, [connected, boitier]); // relancé si on (re)connecte ou change de boîtier

  // Liste complète des métriques possibles, avant filtrage par le sélecteur
  // de température. Chaque entrée regroupe tout ce dont une tuile a besoin :
  // libellé, unité, valeur courante, plage nominale/bornes et couleur.
  const allMetrics = [
    { key: "soc", label: "SOC", unit: "%", value: data.soc, ...LIMITS.soc },
    { key: "tension", label: "Tension", unit: "V", value: data.tension, ...LIMITS.tension },
    { key: "courant", label: "Courant", unit: "A", value: data.courant, ...LIMITS.courant },
    { key: "temp1", label: "Temperature (groupe 1)", unit: "°C", value: data.temp1, ...LIMITS.temp1 },
    { key: "temp2", label: "Temperature (groupe 2)", unit: "°C", value: data.temp2, ...LIMITS.temp2 },
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
    const rows = history.map((point) => [
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
    link.download = "historique_batterie.csv";
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
        {lastUpdate && (
          <span className="horodatage">
            dernière mesure : {lastUpdate.toLocaleTimeString("fr-FR")}
          </span>
        )}
      </div>

      {!connected && (
        <div className="erreur">Connexion au boîtier {boitier} interrompue.</div>
      )}
      {connected && erreurReseau && (
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
                <LineChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
      <button onClick={exportToCSV} disabled={history.length === 0}>
        Exporter l'historique en CSV
      </button>
    </div>
  );
}
