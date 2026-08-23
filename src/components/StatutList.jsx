import { useState } from 'react';
import { getAllStatuts, getStatutById } from '../services/statutService.js';
import { useApi } from '../hooks/useApi.js';
import Button from './ui/Button.jsx';
import Loader from './ui/Loader.jsx';
import ErrorMessage from './ui/ErrorMessage.jsx';
import './StatutList.css';

const StatutList = () => {
  // useApi s'occupe du chargement, des erreurs et du rechargement.
  const { data: statuts, loading, error, refetch } = useApi(getAllStatuts);
  const [selection, setSelection] = useState(null);

  const voirDetails = async (id) => {
    try {
      setSelection(await getStatutById(id));
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <Loader message="Chargement des statuts..." />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;

  return (
    <div className="statut">
      {statuts?.length === 0 && (
        <p className="statut__vide">Aucun statut enregistre pour le moment.</p>
      )}

      <ul className="statut__list">
        {statuts?.map((s) => (
          <li key={s.id} className="statut__item">
            <span>{s.libelle}</span>
            <Button onClick={() => voirDetails(s.id)}>Details</Button>
          </li>
        ))}
      </ul>

      {selection && (
        <div className="statut__detail">
          <h3>Focus : {selection.libelle}</h3>
          <p>
            <strong>ID Base de donnees :</strong> {selection.id}
          </p>
          <Button variant="ghost" onClick={() => setSelection(null)}>
            Fermer
          </Button>
        </div>
      )}
    </div>
  );
};

export default StatutList;
