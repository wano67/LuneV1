# Lune v2 — Développement avec Docker

Ce guide explique comment utiliser l’environnement de développement Docker pour le projet Lune v2 (backend, frontend, base de données).

## Ports utilisés
- **Frontend (Next.js)** : http://localhost:3001
- **Backend (API Fastify)** : http://localhost:3002
- **Base de données (Postgres)** : localhost:5433

## Commandes principales

### Démarrer l’environnement complet (build + detach)
```bash
docker compose up --build -d
```

### Arrêter tous les services
```bash
docker compose down
```

### Voir les services en cours
```bash
docker compose ps
```

### Voir les logs en direct
```bash
docker compose logs -f backend
# ou
docker compose logs -f web
```

## Tester l’API à la main

### Vérifier que le backend répond
```bash
curl -i http://localhost:3002/health
```

### Vérifier la configuration CORS (preflight)
```bash
curl -i -X OPTIONS 'http://localhost:3002/api/v1/auth/login' \
  -H 'Origin: http://localhost:3001' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: Content-Type, Authorization'
```

## Configuration de la base de données
- La base Postgres est lancée dans le conteneur `db`.
- Les données sont persistées dans le dossier local `./data/postgres`.
- Connexion backend :
  - `DATABASE_URL=postgres://postgres:password@db:5432/lune_dev`
- Pour accéder à Postgres en local (ex : via DBeaver, psql) :
  - Host : `localhost`
  - Port : `5433`
  - User : `postgres`
  - Password : `password`
  - Database : `lune_dev`

## Lancer les tests backend
- Les scripts de test sont définis dans `package.json` (ex : `npm run test:db:all`).
- Pour lancer les tests dans le conteneur backend :
```bash
docker compose exec backend npm run test:db:all
```

## Notes CORS / API
- Le backend est configuré pour accepter les requêtes du frontend (http://localhost:3001) avec les bons headers CORS.
- Si tu modifies la config CORS, redémarre le backend pour appliquer les changements.

## Conseils
- Si tu veux changer les ports, modifie le fichier `docker-compose.yml` (attention aux conflits locaux).
- Pour ajouter des variables d’environnement, utilise la clé `environment:` dans le service concerné.
- Pour une stack plus avancée (ex : Redis, Minio, Mailhog), ajoute les services dans `docker-compose.yml`.

---

Ce fichier est prêt à être commité dans le repo. Pour toute question ou problème, consulte les logs ou demande une analyse ici.
