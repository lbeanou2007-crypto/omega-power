import axios from 'axios';

/**
 * Instance axios partagee par tous les services.
 * Centraliser ici evite de repeter l'URL de base partout.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

// Intercepteur : traduit les erreurs axios en messages lisibles par l'utilisateur.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    let message;

    if (error.response) {
      // Le serveur a repondu, mais avec un code d'erreur (404, 500...).
      message = `Erreur ${error.response.status} : ${error.response.statusText}`;
    } else if (error.code === 'ECONNABORTED') {
      message = "Le serveur met trop de temps a repondre.";
    } else {
      message = "Impossible de joindre l'API Java (port 8443, HTTPS). Le backend est-il lance ?";
    }

    // On garde le code HTTP (404, 400...) pour que l'appelant puisse
    // afficher un message precis (ex: "id introuvable" sur un 404).
    const erreur = new Error(message);
    erreur.status = error.response ? error.response.status : null;
    return Promise.reject(erreur);
  }
);

export default api;
