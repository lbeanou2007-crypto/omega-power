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
      message = "Impossible de joindre l'API Java (port 8080). Le backend est-il lance ?";
    }

    return Promise.reject(new Error(message));
  }
);

export default api;
