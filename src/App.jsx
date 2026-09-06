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

const LIMITS = {
  soc: { min: 20, max: 100, floor: 0, ceil: 100 },
  tension: { min: 44, max: 52, floor: 40, ceil: 56 },
  courant: { min: -20, max: 20, floor: -30, ceil: 30 },
  temp1: { min: 2, max: 45, floor: -10, ceil: 60 },
  temp2: { min: 2, max: 45, floor: -10, ceil: 60 },
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

  useEffect(() => {
    const id = setInterval(() => {
      setData((prev) => {
        const next = {
          soc: stepValue(prev.soc, "soc", (Math.random() - 0.5) * 2),
          tension: stepValue(prev.tension, "tension", (Math.random() - 0.5) * 0.5),
          courant: stepValue(prev.courant, "courant", (Math.random() - 0.5) * 1),
          temp1: stepValue(prev.temp1, "temp1", (Math.random() - 0.5) * 0.5),
          temp2: stepValue(prev.temp2, "temp2", (Math.random() - 0.5) * 0.5),
        };
        const point = { time: new Date().toLocaleTimeString("fr-FR"), ...next };
        setHistory((prevHistory) => [...prevHistory, point].slice(-20));
        return next;
      });
    }, 2500);
    return () => clearInterval(id);
  }, []);

  const allMetrics = [
    { key: "soc", label: "SOC", unit: "%", value: data.soc, color: "#5dcaa5", ...LIMITS.soc },
    { key: "tension", label: "Tension", unit: "V", value: data.tension, color: "#378add", ...LIMITS.tension },
    { key: "courant", label: "Courant", unit: "A", value: data.courant, color: "#d4537e", ...LIMITS.courant },
    { key: "temp1", label: "Température (groupe 1)", unit: "°C", value: data.temp1, color: "#ef9f27", ...LIMITS.temp1 },
    { key: "temp2", label: "Température (groupe 2)", unit: "°C", value: data.temp2, color: "#c97a1a", ...LIMITS.temp2 },
  ];

  const metrics = allMetrics.filter((m) => {
    if (m.key === "temp1") return tempMode === "Groupe 1" || tempMode === "Les deux";
    if (m.key === "temp2") return tempMode === "Groupe 2" || tempMode === "Les deux";
    return true;
  });

  const anyCrit = metrics.some((m) => statusOf(m.value, m.min, m.max) === "crit");

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
    <div
      style={{
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        background: "#12161c",
        color: "#d7dbe2",
        padding: "24px",
        borderRadius: "6px",
        minHeight: "560px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .bd-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:12px; }
        .bd-title { font-size:15px; letter-spacing:0.02em; color:#8b94a3; margin:0; }
        .bd-status { display:flex; align-items:center; gap:8px; font-family:'IBM Plex Mono', monospace; font-size:12px; }
        .bd-dot { width:8px; height:8px; border-radius:50%; }
        .bd-controls { display:flex; align-items:center; gap:16px; flex-wrap:wrap; margin-bottom:20px; padding-bottom:16px; border-bottom:1px solid #262d38; }
        .bd-field { display:flex; flex-direction:column; gap:4px; }
        .bd-field label { font-size:11px; color:#8b94a3; letter-spacing:0.02em; }
        .bd-select { background:#1a2029; color:#eef0f3; border:1px solid #33394450; border-radius:4px; padding:7px 10px; font-family:'IBM Plex Mono', monospace; font-size:12px; min-width:170px; }
        .bd-select:focus { outline:none; border-color:#3ddc8460; }
        .bd-grid { display:grid; grid-template-columns:repeat(2, minmax(220px, 1fr)); gap:12px; margin-bottom:24px; }
        .bd-card { background:#1a2029; border:1px solid #262d38; border-radius:4px; padding:14px 16px; position:relative; }
        .bd-card.crit { border-color:#7a2f36; background:#241a1c; }
        .bd-card-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
        .bd-card-label { font-size:12px; color:#8b94a3; letter-spacing:0.02em; }
        .bd-card-value { font-family:'IBM Plex Mono', monospace; font-size:22px; font-weight:500; color:#eef0f3; }
        .bd-card-range { font-family:'IBM Plex Mono', monospace; font-size:11px; color:#5b6472; margin-top:6px; margin-bottom:10px; }
        .bd-led { width:7px; height:7px; border-radius:50%; background:#3ddc84; box-shadow:0 0 4px #3ddc8480; }
        .bd-led.crit { background:#f24b4b; box-shadow:0 0 4px #f24b4b80; }
        .bd-mini-chart { margin-top:8px; border-top:1px solid #262d38; padding-top:8px; }
        .bd-btn { margin-top:16px; background:#1e252f; color:#c8ccd4; border:1px solid #33394450; border-radius:4px; padding:9px 16px; font-family:'IBM Plex Mono', monospace; font-size:12px; cursor:pointer; letter-spacing:0.02em; }
        .bd-btn:hover { background:#262e3a; border-color:#3ddc8460; }
        .bd-btn:active { transform: translateY(1px); }
      `}</style>

      <div className="bd-header">
        <p className="bd-title">Supervision batterie — pack principal</p>
        <div className="bd-status">
          <span className="bd-dot" style={{ background: connected ? "#3ddc84" : "#f24b4b" }} />
          {connected ? "en ligne" : "hors ligne"}
          <button
            className="bd-btn"
            style={{ marginTop: 0, padding: "4px 10px" }}
            onClick={() => setConnected((c) => !c)}
          >
            {connected ? "simuler déconnexion" : "reconnecter"}
          </button>
        </div>
      </div>

      <div className="bd-controls">
        <div className="bd-field">
          <label htmlFor="boitier-select">Boîtier</label>
          <select
            id="boitier-select"
            className="bd-select"
            value={boitier}
            onChange={(e) => setBoitier(e.target.value)}
          >
            {BOITIERS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div className="bd-field">
          <label htmlFor="temp-select">Température</label>
          <select
            id="temp-select"
            className="bd-select"
            value={tempMode}
            onChange={(e) => setTempMode(e.target.value)}
          >
            {TEMP_MODES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bd-grid">
        {metrics.map((m) => {
          const status = statusOf(m.value, m.min, m.max);
          return (
            <div key={m.key} className={`bd-card ${status}`}>
              <div className="bd-card-top">
                <span className="bd-card-label">{m.label}</span>
                <span className={`bd-led ${status}`} />
              </div>
              <div className="bd-card-value">
                {m.value.toFixed(1)} {m.unit}
              </div>
              <div className="bd-card-range">
                plage nominale {m.min} – {m.max} {m.unit}
              </div>
              <div className="bd-mini-chart">
                <ResponsiveContainer width="100%" height={110}>
                  <LineChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="#262d38" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="time" stroke="#5b6472" tick={{ fontSize: 9, fill: "#5b6472" }} minTickGap={30} />
                    <YAxis stroke="#5b6472" tick={{ fontSize: 9, fill: "#5b6472" }} domain={[m.floor, m.ceil]} />
                    <Tooltip
                      contentStyle={{
                        background: "#1a2029",
                        border: "1px solid #262d38",
                        fontSize: 11,
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}
                      labelStyle={{ color: "#8b94a3" }}
                      formatter={(v) => [`${v.toFixed(1)} ${m.unit}`, m.label]}
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
      </div>

      <button className="bd-btn" onClick={exportToCSV} disabled={history.length === 0}>
        exporter l'historique en csv{anyCrit ? " · alerte active" : ""}
      </button>
    </div>
  );
}
