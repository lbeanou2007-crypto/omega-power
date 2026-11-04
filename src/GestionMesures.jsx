import React, { useState } from "react";
import { fetchMesureParId, creerMesure, supprimerMesure } from "./db";

// Section "Gestion des mesures" du boîtier sélectionné
// (routes /api/boitiers/{boitierId}/mesures).
// - Rechercher (GET /{id})  : charge une mesure et remplit le formulaire.
// - Créer (POST)            : ajoute une nouvelle mesure avec les valeurs du formulaire.
// - Supprimer (DELETE /{id}): efface la mesure chargée, après confirmation.
// L'API ne permet plus de modifier une mesure (pas de route PUT).

const FORMULAIRE_VIDE = {
  soc: "",
  tension: "",
  courant: "",
  temp: "",
  alarme: false,
};

// Traduit une erreur de l'API en message lisible. Le 404 est traité à part
// car c'est le cas le plus courant (id qui n'existe pas ou plus).
function messageErreur(err, id) {
  if (err.status === 404) return `Erreur : aucune mesure avec l'id ${id} pour ce boîtier.`;
  if (err.status === 400) return "Erreur : valeurs refusées par l'API (vérifie les champs).";
  return `Erreur : ${err.message}`;
}

// Vérifie les champs du formulaire et les convertit en nombres pour l'API.
// Renvoie { valeurs } si tout est correct, sinon { erreur }.
function lireFormulaire(form) {
  const champs = ["soc", "tension", "courant", "temp"];
  for (const champ of champs) {
    if (form[champ] === "" || Number.isNaN(Number(form[champ]))) {
      return { erreur: `Le champ « ${champ} » doit être un nombre.` };
    }
  }
  const soc = Number(form.soc);
  // L'API impose un entier entre 0 et 100 (minimum 0, maximum 100, int32).
  if (!Number.isInteger(soc) || soc < 0 || soc > 100) {
    return { erreur: "L'état de charge doit être un entier entre 0 et 100." };
  }
  return {
    valeurs: {
      soc,
      tension: Number(form.tension),
      courant: Number(form.courant),
      temp: Number(form.temp),
      alarme: form.alarme,
    },
  };
}

// "boitier" = boîtier sélectionné dans App.jsx ({ id, nom }), ou null tant
// que la liste des boîtiers n'est pas chargée.
export default function GestionMesures({ boitier }) {
  const [idRecherche, setIdRecherche] = useState("");
  // Mesure actuellement chargée (résultat du dernier GET par id), ou null.
  const [mesureChargee, setMesureChargee] = useState(null);
  const [form, setForm] = useState(FORMULAIRE_VIDE);
  // Retour visuel de la dernière action : { type: "succes" | "erreur", texte }.
  const [retour, setRetour] = useState(null);
  const [enCours, setEnCours] = useState(false);

  function changerChamp(champ, valeur) {
    setForm((f) => ({ ...f, [champ]: valeur }));
  }

  // Remplit le formulaire avec les valeurs d'une mesure reçue de l'API.
  function chargerDansFormulaire(mesure) {
    setMesureChargee(mesure);
    setForm({
      soc: String(mesure.soc),
      tension: String(mesure.tension),
      courant: String(mesure.courant),
      temp: String(mesure.temp),
      alarme: Boolean(mesure.alarme),
    });
  }

  // Enveloppe commune : bloque les boutons pendant l'appel et affiche
  // l'erreur éventuelle.
  async function executer(action, id) {
    setEnCours(true);
    setRetour(null);
    try {
      await action();
    } catch (err) {
      setRetour({ type: "erreur", texte: messageErreur(err, id) });
    } finally {
      setEnCours(false);
    }
  }

  function rechercher() {
    const id = idRecherche.trim();
    if (!/^\d+$/.test(id)) {
      setRetour({ type: "erreur", texte: "Erreur : l'id doit être un nombre entier." });
      return;
    }
    executer(async () => {
      setMesureChargee(null);
      const mesure = await fetchMesureParId(boitier, id);
      chargerDansFormulaire(mesure);
      setRetour({ type: "succes", texte: `Mesure ${mesure.id} trouvée.` });
    }, id);
  }

  function creer() {
    const { valeurs, erreur } = lireFormulaire(form);
    if (erreur) {
      setRetour({ type: "erreur", texte: `Erreur : ${erreur}` });
      return;
    }
    executer(async () => {
      const creee = await creerMesure(boitier, valeurs);
      chargerDansFormulaire(creee);
      setIdRecherche(String(creee.id));
      setRetour({ type: "succes", texte: `Mesure créée avec l'id ${creee.id} (${boitier.nom}).` });
    });
  }

  function supprimer() {
    const id = mesureChargee.id;
    if (!window.confirm(`Supprimer définitivement la mesure ${id} ?`)) return;
    executer(async () => {
      await supprimerMesure(boitier, id);
      setMesureChargee(null);
      setForm(FORMULAIRE_VIDE);
      setRetour({ type: "succes", texte: `Mesure ${id} supprimée.` });
    }, id);
  }

  if (!boitier) {
    return (
      <div className="gestion-mesures">
        <h2>Gestion des mesures</h2>
        <div>En attente de la liste des boîtiers…</div>
      </div>
    );
  }

  return (
    <div className="gestion-mesures">
      <h2>Gestion des mesures — {boitier.nom}</h2>

      {/* GET par id */}
      <div className="selecteur">
        <label>
          Id{" "}
          <input
            type="number"
            min="1"
            value={idRecherche}
            onChange={(e) => setIdRecherche(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && rechercher()}
            style={{ width: 90 }}
          />
        </label>
        <button type="button" onClick={rechercher} disabled={enCours}>
          Rechercher
        </button>
      </div>

      {mesureChargee && (
        <div className="mesure-chargee">
          Mesure <strong>{mesureChargee.id}</strong> ({mesureChargee.boitierNom}) : SOC{" "}
          {mesureChargee.soc} %, {mesureChargee.tension} V, {mesureChargee.courant} A,{" "}
          {mesureChargee.temp} °C, alarme {mesureChargee.alarme ? "oui" : "non"}, le{" "}
          {mesureChargee.dateMesureNc
            ? new Date(mesureChargee.dateMesureNc).toLocaleString("fr-FR")
            : "?"}
        </div>
      )}

      {/* Formulaire de création (POST), prérempli après une recherche. */}
      <div className="selecteur">
        <label>
          État de charge (%){" "}
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            value={form.soc}
            onChange={(e) => changerChamp("soc", e.target.value)}
            style={{ width: 80 }}
          />
        </label>
        <label>
          Tension (V){" "}
          <input
            type="number"
            step="0.1"
            value={form.tension}
            onChange={(e) => changerChamp("tension", e.target.value)}
            style={{ width: 80 }}
          />
        </label>
        <label>
          Courant (A){" "}
          <input
            type="number"
            step="0.1"
            value={form.courant}
            onChange={(e) => changerChamp("courant", e.target.value)}
            style={{ width: 80 }}
          />
        </label>
        <label>
          Température (°C){" "}
          <input
            type="number"
            step="0.1"
            value={form.temp}
            onChange={(e) => changerChamp("temp", e.target.value)}
            style={{ width: 80 }}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.alarme}
            onChange={(e) => changerChamp("alarme", e.target.checked)}
          />{" "}
          Alarme
        </label>
      </div>

      <div className="selecteur">
        <button type="button" onClick={creer} disabled={enCours}>
          Créer
        </button>
        {/* DELETE n'a de sens que sur une mesure déjà retrouvée. */}
        {mesureChargee && (
          <button type="button" onClick={supprimer} disabled={enCours}>
            Supprimer
          </button>
        )}
      </div>

      {retour && (
        <div className={retour.type === "erreur" ? "erreur" : "erreur succes"}>{retour.texte}</div>
      )}
    </div>
  );
}
