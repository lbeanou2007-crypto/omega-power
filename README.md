# Omega Power - Supervision des boîtiers batteries

Projet BTS CIEL option IR - Ludovic Beanou.

Interface web (IHM) de supervision des boîtiers batteries **OMEGA EXPERT-S ES48100A**
(LiFePO4, 51,2 V, 100 Ah). Elle affiche en direct les mesures de chaque boîtier
(état de charge, tension, courant, température), signale les valeurs hors plage
et permet de gérer les mesures enregistrées en base.

Les données viennent d'une **API REST Spring Boot** développée par un camarade
de l'équipe projet. Ce dépôt contient uniquement la partie IHM (front React).

## Fonctionnalités

| Fonction | Détail |
| --- | --- |
| Liste des boîtiers | Chargée depuis l'API (`GET /api/boitiers`), choix dans un menu déroulant |
| Mesures en direct | Dernière mesure du boîtier sélectionné, rafraîchie toutes les 2,5 s |
| Alertes | Chaque valeur est comparée aux plages de la fiche technique (état OK / critique) |
| Graphiques | Courbe des 20 derniers points pour chaque grandeur (Recharts) |
| Gestion des mesures | Rechercher, créer et supprimer une mesure (l'API ne permet plus de les modifier) |
| Recherche historique | Recherche par jour / mois / année *(données simulées pour l'instant)* |
| Export CSV | Export de l'historique affiché |
| Test de coupure | Bouton « simuler déconnexion » pour vérifier le comportement sans réseau |

## Architecture

```
 Navigateur  ──HTTP──▶  Serveur Vite (IHM)  ──HTTPS──▶  API Spring Boot  ──▶  Base de données
 (PC client)            port 8443                       batterie-connectee-api.onrender.com
                        proxy /api/...                  (hébergée sur Render)
```

Schéma de l'ancienne architecture, quand l'API était sur le réseau local :
[`docs/flux_proxy_vite_api.png`](docs/flux_proxy_vite_api.png)

Documentation de l'API : [Swagger](https://batterie-connectee-api.onrender.com/swagger-ui/index.html)

Le navigateur appelle toujours `/api/...` sur le serveur Vite. Vite **redirige**
ces requêtes vers l'API (voir `proxy` dans `vite.config.js`). Ce choix permet :

- de ne parler qu'à une seule origine : pas de problème de **CORS** (l'API répond
  403 aux requêtes venant de `localhost:8443`, le proxy retire donc l'en-tête `Origin`) ;
- de changer l'adresse de l'API dans un seul fichier (`.env`) sans toucher au code.

## Environnement technique

| Élément | Choix | Pourquoi |
| --- | --- | --- |
| Langage | JavaScript (JSX) | Langage du web, utilisé aussi pour le front de l'équipe |
| Framework | React 18 | Interface découpée en composants réutilisables |
| Outil de build | Vite 5 | Démarrage rapide, proxy intégré vers l'API |
| Requêtes HTTP | axios | Gestion centralisée des erreurs (intercepteur) |
| Graphiques | Recharts | Courbes React simples à intégrer |
| Versionnage | Git + GitHub | Historique des modifications, travail en équipe |

## Installation et lancement

Prérequis : Node.js 18 ou plus, et un accès à Internet pour joindre l'API.

```bash
npm install
cp .env.example .env     # puis adapter l'adresse de l'API si besoin
npm run dev
```

L'IHM est ensuite disponible sur **http://localhost:8443**.

| Commande | Effet |
| --- | --- |
| `npm run dev` | Serveur de développement (rechargement à chaud) |
| `npm run build` | Version de production dans `dist/` |
| `npm run preview` | Teste le résultat du build en local |

### Configuration (`.env`)

| Variable | Rôle | Valeur par défaut |
| --- | --- | --- |
| `VITE_API_URL` | Préfixe des appels de l'IHM | `/api` (passe par le proxy) |
| `VITE_API_PROXY_TARGET` | Adresse réelle de l'API | `https://batterie-connectee-api.onrender.com` |

## Routes de l'API utilisées

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/api/boitiers` | Liste des boîtiers `{ id, nom }` |
| GET | `/api/boitiers/{id}/mesures/dernieres?limit=1` | Dernière mesure d'un boîtier |
| GET | `/api/boitiers/{id}/mesures/{mesureId}` | Une mesure précise |
| POST | `/api/boitiers/{id}/mesures` | Créer une mesure |
| DELETE | `/api/boitiers/{id}/mesures/{mesureId}` | Supprimer une mesure |

Format d'une mesure :
`{ id, boitierId, boitierNom, soc, tension, courant, temp, alarme, dateMesureNc }`

## Plages de fonctionnement (fiche technique ES48100A)

Définies dans `LIMITS` (`src/App.jsx`). En dehors de la plage nominale, la valeur
passe en état critique.

| Grandeur | Plage nominale | Bornes physiques | Source |
| --- | --- | --- | --- |
| État de charge (SOC) | 20 à 100 % | 0 à 100 % | Seuil bas d'alerte à 20 % |
| Tension | 44 à 56 V | 41,6 à 57,6 V | Coupure décharge 41,6 V, charge max 57,6 V |
| Courant | -90 à 90 A | -100 à 100 A | Courant max du BMS : 100 A |
| Température | 0 à 55 °C | -20 à 55 °C | Charge 0-55 °C, décharge -20-55 °C |

## Organisation des fichiers

```
├── index.html               Point d'entrée HTML
├── vite.config.js           Port de l'IHM + proxy vers l'API
├── .env.example             Modèle de configuration (à copier en .env)
├── docs/                    Schémas et documentation
└── src/
    ├── main.jsx             Montage de React dans la page
    ├── App.jsx              Tableau de bord : tuiles, graphiques, historique, export CSV
    ├── GestionMesures.jsx   Recherche, création et suppression des mesures du boîtier sélectionné
    ├── db.js                Tous les appels à l'API des boîtiers et des mesures
    ├── services/api.js      Instance axios + traduction des erreurs réseau
    └── styles/global.css    Couleurs et styles de base
```

Les fichiers `components/`, `hooks/useApi.js`, `services/statutService.js` et
`services/boitierService.js` viennent du modèle de départ et ne sont plus utilisés
par l'IHM actuelle.

## Sécurité et protection des données

- **HTTPS** entre le serveur de l'IHM et l'API.
- **Aucun secret dans le code** : l'adresse de l'API est dans `.env`, qui est exclu
  de Git (`.gitignore`) ; seul le modèle `.env.example` est versionné. Les fichiers
  de mots de passe et de clés (`*.p12`, `*.key`, `*.pem`) sont aussi exclus.
- **Contrôle des saisies** avant envoi à l'API (champs numériques, SOC entier
  entre 0 et 100) et **confirmation** avant toute suppression.
- **Erreurs gérées** : API injoignable, délai dépassé (10 s), mesure introuvable
  (404) ou valeurs refusées (400) affichent un message clair au lieu de bloquer l'IHM.
- Les données traitées sont des mesures techniques : **aucune donnée personnelle**.

## Limites connues et évolutions prévues

- L'API ne fournit qu'une seule température (`temp`) : elle est affichée pour les
  deux groupes de cellules en attendant `tempGroupe1` / `tempGroupe2`.
- La recherche historique utilise des données simulées : à brancher sur la route
  `GET /api/boitiers/{id}/mesures/jour?date=AAAA-MM-JJ`, désormais disponible.
- Le proxy n'existe qu'en développement (`npm run dev`) : pour déployer l'IHM, il
  faudra un autre proxy ou que l'API autorise son origine (CORS).
- Pas encore d'authentification des utilisateurs sur l'IHM.
- Supprimer les fichiers du modèle de départ qui ne servent plus.
