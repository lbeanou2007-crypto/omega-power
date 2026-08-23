import api from './api.js';

/**
 * Un service par ressource de l'API.
 * Les composants ne connaissent jamais axios : ils appellent ces fonctions.
 * Chaque fonction renvoie directement les donnees (pas l'objet response).
 */
const RESSOURCE = '/statuts';

export const getAllStatuts = async () => {
  const response = await api.get(RESSOURCE);
  return response.data;
};

export const getStatutById = async (id) => {
  const response = await api.get(`${RESSOURCE}/${id}`);
  return response.data;
};

export const createStatut = async (statut) => {
  const response = await api.post(RESSOURCE, statut);
  return response.data;
};

export const updateStatut = async (id, statut) => {
  const response = await api.put(`${RESSOURCE}/${id}`, statut);
  return response.data;
};

export const deleteStatut = async (id) => {
  await api.delete(`${RESSOURCE}/${id}`);
};
