import React, { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import "./App.css";

function statusOf(value, min, max) {
  if (value < min || value > max) return "crit";
  return "ok";
}

export default function App() {
  const [data, setData] = useState({
    soc: 75,
    tension: 48.2,
    courant: -6.4,
    temp: 28.5,
  });

  const [history, setHistory] = useState([]);

  useEffect(() => {
    const id = setInterval(() => {
      setData((prev) => {
        const next = {
          soc: prev.soc + (Math.random() - 0.5) * 2,
          tension: prev.tension + (Math.random() - 0.5) * 0.5,
          courant: prev.courant + (Math.random() - 0.5) * 1,
          temp: prev.temp + (Math.random() - 0.5) * 0.5,
        };

        setHistory((prevHistory) => {
          const point = { time: new Date().toLocaleTimeString(), ...next };
          const updated = [...prevHistory, point];
          return updated.slice(-20);
        });

        return next;
      });
    }, 2500);
    return () => clearInterval(id);
  }, []);

  const metrics = [
    { label: "SOC", value: data.soc, unit: "%", min: 20, max: 100 },
    { label: "Tension", value: data.tension, unit: "V", min: 44, max: 52 },
    { label: "Courant", value: data.courant, unit: "A", min: -20, max: 20 },
    { label: "Température", value: data.temp, unit: "°C", min: 2, max: 45 },
  ];

  function exportToCSV() {
    const headers = ["Heure", "SOC (%)", "Tension (V)", "Courant (A)", "Température (°C)"];
    const rows = history.map((point) => [
      point.time,
      point.soc.toFixed(1),
      point.tension.toFixed(1),
      point.courant.toFixed(1),
      point.temp.toFixed(1),
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
      {metrics.map((m) => (
        <div key={m.label} className={`metric-card ${statusOf(m.value, m.min, m.max)}`}>
          <div>{m.label}</div>
          <div>{m.value.toFixed(1)} {m.unit}</div>
        </div>
      ))}

      <div style={{ width: "100%", height: 300, marginTop: 30 }}>
        <ResponsiveContainer>
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="soc" stroke="#4cd251" name="SOC (%)" />
            <Line type="monotone" dataKey="tension" stroke="#2196f3" name="Tension (V)" />
            <Line type="monotone" dataKey="courant" stroke="#ba36b3" name="Courant (A)" />
            <Line type="monotone" dataKey="temp" stroke="#f44336" name="Température (°C)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <button onClick={exportToCSV} style={{ marginTop: 20 }}>
        Exporter l'historique en CSV
      </button>
    </div>
  );
}