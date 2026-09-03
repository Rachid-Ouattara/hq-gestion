# Déploiement — gestion.headquaters.org

Guide pas-à-pas pour mettre HQ Gestion en ligne sur le VPS (Ubuntu/Debian, PostgreSQL + PM2 + Nginx déjà installés). Chaque étape est à exécuter dans l'ordre indiqué.

## 1. DNS

Chez le registraire de `headquaters.org`, ajouter un enregistrement :

```
Type : A
Nom  : gestion
Valeur : <IP publique du VPS>
```

La propagation peut prendre quelques minutes à quelques heures. Vérifier avec `dig gestion.headquaters.org` ou `nslookup gestion.headquaters.org` avant de passer à l'étape HTTPS (étape 11) — Certbot a besoin que le DNS pointe déjà vers le VPS.

## 2. Dépôt GitHub

Sur github.com, créer un **dépôt privé** (ex. `hq-gestion`). Puis, en local :

```bash
cd "/Users/changeme/Documents/projects/headquarters /hq-gestion"
git remote add origin git@github.com:<votre-compte>/hq-gestion.git
git push -u origin main
```

## 3. Cloner sur le VPS

```bash
sudo mkdir -p /var/www/hq-gestion
sudo chown $USER:$USER /var/www/hq-gestion
git clone git@github.com:<votre-compte>/hq-gestion.git /var/www/hq-gestion
cd /var/www/hq-gestion
```

(Si le VPS n'a pas encore de clé SSH connue de GitHub : `ssh-keygen -t ed25519 -C "vps"` puis ajouter `~/.ssh/id_ed25519.pub` dans GitHub → Settings → SSH keys — ou cloner en HTTPS avec un token d'accès personnel.)

## 4. Base de données

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE hq_gestion;
CREATE USER hq_gestion WITH PASSWORD 'choisir_un_mot_de_passe_solide';
GRANT ALL PRIVILEGES ON DATABASE hq_gestion TO hq_gestion;
\c hq_gestion
GRANT ALL ON SCHEMA public TO hq_gestion;
\q
```

Noter le mot de passe choisi — il va dans `DATABASE_URL` à l'étape 6.

> Sur PostgreSQL 15 et plus récent, le schéma `public` n'accorde plus le droit
> `CREATE` à tout le monde par défaut — sans la ligne `GRANT ALL ON SCHEMA
> public`, `npm run migrate` échoue avec `droit refusé pour le schéma public`.
> Le `\c hq_gestion` avant cette ligne est indispensable : la permission doit
> être accordée en étant connecté à la base `hq_gestion`, pas à `postgres`.

## 5. Dépendances

```bash
node -v   # recommandé : Node 20 LTS ou plus récent
npm ci
```

## 6. Variables d'environnement

```bash
cp backend/.env.production.example backend/.env
nano backend/.env
```

Remplir chaque `CHANGER_MOI` :
- `DATABASE_URL` : avec le mot de passe choisi à l'étape 4.
- `JWT_ACCESS_SECRET` et `JWT_REFRESH_SECRET` : deux valeurs **différentes**, générées avec `openssl rand -hex 32` (relancer la commande deux fois).
- `SEED_ADMIN_PASSWORD` : le mot de passe du tout premier compte administrateur.
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` : générées avec `npx web-push generate-vapid-keys`.
- `SMTP_*` : à renseigner si un fournisseur d'e-mail est disponible, sinon laisser vide pour l'instant (voir note dans le fichier).

## 7. Migrations et compte administrateur

```bash
npm run migrate
npm run seed
```

(`npm run seed` est sans danger à relancer plus tard — il ne duplique rien, il ne fait que créer ce qui manque.)

## 8. Build du frontend

```bash
npm run build --workspace web
```

Produit `web/dist/` — c'est ce dossier que Nginx sert directement (étape 10).

## 9. PM2

```bash
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup   # puis exécuter la commande que pm2 affiche (démarrage auto au reboot)
```

Vérifier que ça tourne :
```bash
pm2 status
curl http://127.0.0.1:4000/api/health
```

## 10. Nginx

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/gestion.headquaters.org
sudo nano /etc/nginx/sites-available/gestion.headquaters.org
```

Vérifier/adapter la ligne `root /var/www/hq-gestion/web/dist;` si le dépôt a été cloné ailleurs qu'à l'étape 3.

```bash
sudo ln -s /etc/nginx/sites-available/gestion.headquaters.org /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

À ce stade, `http://gestion.headquaters.org` doit déjà répondre (sans HTTPS).

## 11. HTTPS (Let's Encrypt)

```bash
sudo certbot --nginx -d gestion.headquaters.org
```

Certbot réécrit automatiquement le fichier Nginx pour ajouter le certificat et la redirection HTTP → HTTPS.

## 12. Vérification

- `https://gestion.headquaters.org` charge la page de connexion, cadenas HTTPS valide.
- Connexion avec le compte admin créé à l'étape 7.
- Le tableau de bord affiche les KPI (confirme que l'API répond via `/api/`).
- Cliquer la clochette de notifications, activer les notifications push, vérifier qu'aucune erreur n'apparaît.
- Soumettre une action qui notifie (ex. une demande de congé) depuis un autre compte et vérifier que le badge de la clochette se met à jour sans recharger la page — confirme que `/api/notifications/stream` (SSE) passe bien à travers Nginx.
- Recharger la page sur une route profonde (ex. après avoir cliqué sur un employé, `/modules/rh/employes/<id>`) — doit fonctionner sans erreur 404 (confirme le `try_files` SPA).
- Téléverser un document sur une fiche pour vérifier `backend/uploads/`.
- `pm2 logs hq-gestion-api` ne doit montrer aucune erreur récurrente.

## 13. Mises à jour futures

Une fois tout ci-dessus en place, chaque mise à jour se résume à :

```bash
cd /var/www/hq-gestion
git pull
npm ci
npm run migrate
npm run build --workspace web
pm2 reload hq-gestion-api
```

## À sauvegarder régulièrement

- La base de données : `pg_dump hq_gestion > backup.sql`.
- Le dossier `backend/uploads/` (documents joints, photos) — non versionné, à sauvegarder séparément (ex. `rsync` vers un autre serveur, ou script cron).
- Le fichier `backend/.env` — contient les secrets, jamais dans git, à conserver en lieu sûr.
