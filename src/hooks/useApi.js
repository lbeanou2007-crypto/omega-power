import { useState, useEffect, useCallback } from 'react';

/**
 * Hook generique pour appeler l'API : gere les 3 etats classiques
 * (chargement / donnees / erreur) une seule fois pour tout le projet.
 *
 * @param {Function} fonctionApi - fonction du service a appeler (ex: getAllStatuts)
 * @param {Array} dependances - relance l'appel quand une de ces valeurs change
 *
 * Exemple :
 *   const { data, loading, error, refetch } = useApi(getAllStatuts);
 */
export function useApi(fonctionApi, dependances = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const executer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fonctionApi());
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependances);

  useEffect(() => {
    executer();
  }, [executer]);

  return { data, loading, error, refetch: executer };
}
