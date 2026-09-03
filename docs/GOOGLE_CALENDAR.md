# Connexion Google Calendar — liens Google Meet automatiques

Ce guide explique comment créer les identifiants Google nécessaires pour que HQ Gestion génère automatiquement un lien Google Meet lors de la planification d'un entretien de recrutement (individuel ou groupé). Sans cette configuration, le module Recrutement fonctionne normalement — la case « Générer un lien Google Meet » reste simplement absente des formulaires.

## 1. Créer un projet Google Cloud

1. Allez sur [console.cloud.google.com](https://console.cloud.google.com), connectez-vous avec le compte Google que vous voulez utiliser pour créer les entretiens (idéalement un compte dédié au service RH, ex. `recrutement@headquaters.org`, plutôt qu'un compte personnel).
2. En haut de la page, créez un nouveau projet (ex. « HQ Gestion »).

## 2. Activer l'API Google Calendar

1. Menu de gauche → **APIs & Services** → **Bibliothèque**.
2. Recherchez « Google Calendar API » et cliquez sur **Activer**.

## 3. Configurer l'écran de consentement OAuth

1. **APIs & Services** → **Écran de consentement OAuth**.
2. Type d'utilisateur : **Externe** (sauf si vous disposez d'un Google Workspace pour `headquaters.org`, auquel cas **Interne** est plus simple).
3. Renseignez le nom de l'application (« HQ Gestion »), l'e-mail de support, et l'e-mail de contact développeur.
4. Champs d'application (scopes) : ajoutez `.../auth/calendar.events` et `.../auth/userinfo.email`.
5. Si le type est Externe : ajoutez le compte Google qui servira à connecter le calendrier dans la liste des **utilisateurs de test** (tant que l'application n'est pas publiée/vérifiée par Google, seuls les comptes de test peuvent l'utiliser — largement suffisant ici, un seul compte se connecte).

## 4. Créer les identifiants OAuth

1. **APIs & Services** → **Identifiants** → **Créer des identifiants** → **ID client OAuth**.
2. Type d'application : **Application Web**.
3. **URI de redirection autorisés**, ajoutez exactement :
   - En développement : `http://localhost:4000/api/rh/google/callback`
   - En production : `https://gestion.headquaters.org/api/rh/google/callback`
4. Validez — Google affiche un **ID client** et un **secret client**.

## 5. Renseigner les variables d'environnement

Dans `backend/.env` (développement) ou `backend/.env` sur le VPS (production, voir `docs/DEPLOIEMENT.md`) :

```
GOOGLE_CLIENT_ID=<ID client>
GOOGLE_CLIENT_SECRET=<secret client>
GOOGLE_REDIRECT_URI=http://localhost:4000/api/rh/google/callback
```

(remplacer par l'URI de production le cas échéant). Redémarrez le serveur backend après modification.

## 6. Connecter le compte depuis HQ Gestion

1. Connectez-vous avec un compte du personnel ayant le droit de modifier le module RH.
2. Allez dans **Ressources Humaines → Recrutement**.
3. Un bandeau « Google Calendar » apparaît désormais en haut de la page — cliquez sur **Connecter Google Calendar**.
4. Vous êtes redirigé vers l'écran d'autorisation Google : choisissez le compte prévu pour le recrutement, acceptez.
5. Vous revenez automatiquement sur HQ Gestion avec un message de confirmation — le bandeau affiche désormais l'e-mail du compte connecté.

À partir de là, la case **Générer un lien Google Meet** apparaît sur les formulaires de création d'entretien (individuel et groupé), et le lien généré est automatiquement envoyé par e-mail au(x) candidat(s).

## Reconnecter ou changer de compte

Bouton **Déconnecter** dans le même bandeau, puis **Connecter Google Calendar** à nouveau avec le compte souhaité.
