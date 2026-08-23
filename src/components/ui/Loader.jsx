import './Loader.css';

/** Indicateur de chargement affiche pendant les appels a l'API. */
const Loader = ({ message = 'Chargement...' }) => {
  return (
    <div className="loader">
      <span className="loader__spinner" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
};

export default Loader;
