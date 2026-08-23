import Button from './Button.jsx';
import './ErrorMessage.css';

/**
 * Affiche une erreur d'API avec un bouton "Reessayer" optionnel.
 * @param {string} message - texte de l'erreur
 * @param {Function} [onRetry] - si fourni, affiche le bouton de relance
 */
const ErrorMessage = ({ message, onRetry }) => {
  return (
    <div className="error-message" role="alert">
      <p className="error-message__text">{message}</p>
      {onRetry && (
        <Button variant="ghost" onClick={onRetry}>
          Reessayer
        </Button>
      )}
    </div>
  );
};

export default ErrorMessage;
