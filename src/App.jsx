import React, { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { getBoitiers } from "./services/boitierService.js";
import "./App.css";

const PERIODE_MS = 2500;
const POINTS_MAX = 20;

function statusOf(value, min, max) {
  if (value == null) return "";              // pas de mesure : pas de verdict
  if (value < min || value > max) return "crit";
  return "ok";
}

// Une mesure absente s'affiche "--" au lieu de faire planter l'ecran.
const fmt = (v) => (v == null ? "--" : v.toFixed(1));

export default function App() {
  const [boitiers, setBoitiers] = useState([]);
  const [boitierId, setBoitierId] = useState(null);
  const [vueTemp, setVueTemp] = useState("deux");
  const [historiques, setHistoriques] = useState({});
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    // Empeche une reponse en retard de mettre a jour un composant demonte.
    let actif = true;

    const relever = async () => {
      try {
        const liste = await getBoitiers();
        if (!actif) return;

        setBoitiers(liste);
        setErreur(null);

        // Premiere reponse : on preselectionne le premier boitier.
        setBoitierId((prec) => prec ?? liste[0]?.id ?? null);

        // On historise les 3 boitiers, pas seulement celui affiche :
        // changer de boitier montre alors une courbe deja remplie.
        const heure = new Date().toLocaleTimeString();
        setHistoriques((prec) => {
          const suivant = { ...prec };
          liste.forEach((b) => {
            const point = {
              time: heure,
              soc: b.soc,
              tension: b.tension,
              courant: b.courant,
              tempGroupe1: b.tempGroupe1,
              tempGroupe2: b.tempGroupe2,
            };
            suivant[b.id] = [...(prec[b.id] ?? []), point].slice(-POINTS_MAX);
          });
          return suivant;
        });
      } catch (e) {
        if (actif) setErreur(e.message);
      } finally {
        if (actif) setChargement(false);
      }
    };

    relever();
    const id = setInterval(relever, PERIODE_MS);
    return () => {
      actif = false;
      clearInterval(id);
    };
  }, []);

  const boitier = boitiers.find((b) => b.id === boitierId) ?? null;
  const history = historiques[boitierId] ?? [];

  const montreG1 = vueTemp === "g1" || vueTemp === "deux";
  const montreG2 = vueTemp === "g2" || vueTemp === "deux";

  // SOC, tension et courant sont uniques par boitier ; la temperature
  // est doublee, un capteur par groupe de 8 cellules.
  const metrics = [
    { label: "SOC", value: boitier?.soc, unit: "%", min: 20, max: 100 },
    { label: "Tension", value: boitier?.tension, unit: "V", min: 44, max: 52 },
    { label: "Courant", value: boitier?.courant, unit: "A", min: -20, max: 20 },
  ];
  if (montreG1) {
    metrics.push({ label: "Temp. groupe 1", value: boitier?.tempGroupe1, unit: "°C", min: 2, max: 45 });
  }
  if (montreG2) {
    metrics.push({ label: "Temp. groupe 2", value: boitier?.tempGroupe2, unit: "°C", min: 2, max: 45 });
  }

  function exportToCSV() {
    if (!boitier || history.length === 0) return;

    // On exporte toujours les 2 temperatures, meme si l'ecran n'en montre
    // qu'une : le fichier doit etre exploitable sans savoir ce qui etait
    // selectionne au moment du clic.
    const headers = ["Heure", "SOC (%)", "Tension (V)", "Courant (A)", "Temp G1 (C)", "Temp G2 (C)"];
    const rows = history.map((p) => [
      p.time,
      fmt(p.soc),
      fmt(p.tension),
      fmt(p.courant),
      fmt(p.tempGroupe1),
      fmt(p.tempGroupe2),
    ]);

    // Separateur ";" + BOM : Excel en francais ouvre le fichier en colonnes.
    const csvContent = [headers, ...rows].map((row) => row.join(";")).join("\n");
    const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    // Le nom du boitier peut contenir un "+" : on l'assainit pour le fichier.
    link.download = `historique_${boitier.nom.replace(/[^a-zA-Z0-9_-]/g, "_")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (chargement) {
    return <div className="ihm-dashboard">Chargement des boîtiers…</div>;
  }

  return (
    <div className="ihm-dashboard">
      <div className="selecteur">
        <label>
          Boîtier{" "}
          <select
            value={boitierId ?? ""}
            onChange={(e) => setBoitierId(Number(e.target.value))}
            disabled={boitiers.length === 0}
          >
            {boitiers.length === 0 && <option value="">aucun boîtier</option>}
            {boitiers.map((b) => (
              <option key={b.id} value={b.id}>{b.nom}</option>
            ))}
          </select>
        </label>

        <label>
          Température{" "}
          <select value={vueTemp} onChange={(e) => setVueTemp(e.target.value)}>
            <option value="g1">Groupe 1</option>
            <option value="g2">Groupe 2</option>
            <option value="deux">Les deux</option>
          </select>
        </label>
      </div>

      {erreur && <div className="erreur">{erreur}</div>}
      {boitier?.alarme && <div className="erreur">Alarme active sur {boitier.nom}</div>}

      {metrics.map((m) => (
        <div key={m.label} className={`metric-card ${statusOf(m.value, m.min, m.max)}`}>
          <div>{m.label}</div>
          <div>{fmt(m.value)} {m.unit}</div>
        </div>
      ))}

      {boitier?.date && (
        <div className="horodatage">Dernière mesure : {boitier.date.toLocaleTimeString()}</div>
      )}

      <div style={{ width: "100%", height: 300, marginTop: 30 }}>
        <ResponsiveContainer>
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="soc" stroke="#4cd251" name="SOC (%)" dot={false} />
            <Line type="monotone" dataKey="tension" stroke="#2196f3" name="Tension (V)" dot={false} />
            <Line type="monotone" dataKey="courant" stroke="#ba36b3" name="Courant (A)" dot={false} />
            {montreG1 && (
              <Line type="monotone" dataKey="tempGroupe1" stroke="#f44336" name="Temp G1 (°C)" dot={false} />
            )}
            {montreG2 && (
              <Line type="monotone" dataKey="tempGroupe2" stroke="#ff9800" name="Temp G2 (°C)" dot={false} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <button onClick={exportToCSV} style={{ marginTop: 20 }} disabled={history.length === 0}>
        Exporter l'historique en CSV
      </button>
    </div>
  );
}
