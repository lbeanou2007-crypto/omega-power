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

const LIMITS = {
  soc: { min: 20, max: 100, floor: 0, ceil: 100, color: "#0d7fbf" },
  tension: { min: 44, max: 52, floor: 40, ceil: 56, color: "#2f8f4e" },
  courant: { min: -20, max: 20, floor: -30, ceil: 30, color: "#a1408c" },
  temp1: { min: 2, max: 45, floor: -10, ceil: 60, color: "#c76b1f" },
  temp2: { min: 2, max: 45, floor: -10, ceil: 60, color: "#b5501a" },
};

const BOITIERS = ["boitier_V16", "boitier_BMS_V14", "boitier_V16+MAC"];
const TEMP_MODES = ["Groupe 1", "Groupe 2", "Les deux"];

function clamp(value, floor, ceil) {
  return Math.min(ceil, Math.max(floor, value));
}

function statusOf(value, min, max) {
  return value < min || value > max ? "crit" : "ok";
}

function stepValue(prev, key, delta) {
  const { floor, ceil } = LIMITS[key];
  return clamp(prev + delta, floor, ceil);
}

export default function App() {
  const [boitier, setBoitier] = useState(BOITIERS[0]);
  const [tempMode, setTempMode] = useState("Les deux");
  const [connected, setConnected] = useState(true);
  const [data, setData] = useState({
    soc: 75,
    tension: 48.2,
    courant: -6.4,
    temp1: 28.5,
    temp2: 26.1,
  });
  const [history, setHistory] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    if (!connected) return undefined;
    const id = setInterval(() => {
      setData((prev) => {
        const next = {
          soc: stepValue(prev.soc, "soc", (Math.random() - 0.5) * 2),
          tension: stepValue(prev.tension, "tension", (Math.random() - 0.5) * 0.5),
          courant: stepValue(prev.courant, "courant", (Math.random() - 0.5) * 1),
          temp1: stepValue(prev.temp1, "temp1", (Math.random() - 0.5) * 0.5),
          temp2: stepValue(prev.temp2, "temp2", (Math.random() - 0.5) * 0.5),
        };
        const now = new Date();
        const point = { time: now.toLocaleTimeString("fr-FR"), ...next };
        setHistory((prevHistory) => [...prevHistory, point].slice(-20));
        setLastUpdate(now);
        return next;
      });
    }, 2500);
    return () => clearInterval(id);
  }, [connected]);

  const allMetrics = [
    { key: "soc", label: "SOC", unit: "%", value: data.soc, ...LIMITS.soc },
    { key: "tension", label: "Tension", unit: "V", value: data.tension, ...LIMITS.tension },
    { key: "courant", label: "Courant", unit: "A", value: data.courant, ...LIMITS.courant },
    { key: "temp1", label: "Température (groupe 1)", unit: "°C", value: data.temp1, ...LIMITS.temp1 },
    { key: "temp2", label: "Température (groupe 2)", unit: "°C", value: data.temp2, ...LIMITS.temp2 },
  ];

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
    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
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

      {metrics.map((m) => {
        const status = statusOf(m.value, m.min, m.max);
        return (
          <div key={m.key} className={`metric-card ${status}`}>
            <div>{m.label}</div>
            <div style={{ "--couleur-texte": m.color }}>
              {m.value.toFixed(1)} {m.unit}
            </div>
            <div style={{ width: "100%", height: 110, marginTop: 4 }}>
              <ResponsiveContainer>
                <LineChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 9 }} minTickGap={30} />
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

      <button onClick={exportToCSV} disabled={history.length === 0}>
        Exporter l'historique en CSV
      </button>
    </div>
  );
}
