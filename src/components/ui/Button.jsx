import './Button.css';

/**
 * Bouton reutilisable.
 * @param {'primary'|'danger'|'ghost'} variant - style du bouton
 */
const Button = ({ variant = 'primary', children, ...props }) => {
  return (
    <button className={`btn btn--${variant}`} {...props}>
      {children}
    </button>
  );
};

export default Button;
