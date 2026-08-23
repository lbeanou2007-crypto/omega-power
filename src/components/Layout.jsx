import './Layout.css';

/**
 * Coquille visuelle de l'application : en-tete + zone de contenu centree.
 * Toutes les pages passent par ici pour garder la meme presentation.
 */
const Layout = ({ title, children }) => {
  return (
    <div className="layout">
      <div className="layout__box">
        <h1 className="layout__title">{title}</h1>
        {children}
      </div>
    </div>
  );
};

export default Layout;
