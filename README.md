# Ludovic Beanou - Projet

Base React (Vite + axios) construite sur la meme organisation que le projet `front/react`
de l'archive `front (1).zip`, avec quelques ajouts pour partir sur des bonnes bases.

## Demarrage

```bash
npm install
npm run dev
```

Le site est disponible sur http://localhost:5173

Autres commandes :

| Commande          | Effet                                          |
| ----------------- | ---------------------------------------------- |
| `npm run dev`     | Serveur de developpement (rechargement a chaud) |
| `npm run build`   | Version de production dans `dist/`             |
| `npm run preview` | Teste le resultat du build en local            |

## Organisation des fichiers

```
Ludovic Beanou Projet/
├── index.html              Point d'entree HTML
├── package.json            Dependances et scripts
├── vite.config.js          Config Vite + proxy vers le backend Java
├── .env.example            Modele de configuration (a copier en .env)
└── src/
    ├── main.jsx            Montage de React dans la page
    ├── App.jsx             Assemblage des composants
    ├── styles/
    │   └── global.css      Variables de couleurs + styles de base
    ├── services/
    │   ├── api.js          Instance axios + gestion des erreurs
    │   └── statutService.js Appels API pour la ressource "statuts"
    ├── hooks/
    │   └── useApi.js       Hook chargement / donnees / erreur
    └── components/
        ├── Layout.jsx      Cadre visuel commun
        ├── StatutList.jsx  Liste + detail d'un statut
        └── ui/             Briques reutilisables
            ├── Button.jsx
            ├── Loader.jsx
            └── ErrorMessage.jsx
```

Regle simple : un composant = un fichier `.jsx` + son `.css` a cote.

## Lien avec le backend Java

Le front appelle `/api/...`, et Vite redirige ces requetes vers
`http://localhost:8080` (voir le `proxy` dans `vite.config.js`).
Cela evite les erreurs CORS pendant le developpement.

Le backend Spring Boot doit donc etre lance sur le port 8080 et exposer :

- `GET /api/statuts` - liste des statuts
- `GET /api/statuts/{id}` - un statut

Sans backend, la page affiche un message d'erreur avec un bouton *Reessayer* :
c'est normal.

## Ajouter une nouvelle ressource (exemple : les utilisateurs)

1. Creer `src/services/utilisateurService.js` sur le modele de `statutService.js`.
2. Creer `src/components/UtilisateurList.jsx` + `UtilisateurList.css`.
3. Recuperer les donnees avec le hook :

```jsx
const { data, loading, error, refetch } = useApi(getAllUtilisateurs);
```

4. Afficher le composant depuis `App.jsx`.
