# « Continuer avec Google » : mise en route

Le code est prêt et publié. Le bouton n'apparaît que lorsque deux choses sont faites :

1. **chez Google** (par Philippe, sur son compte Google) : déclarer le site et obtenir un *identifiant client* ;
2. **sur le Dell** (une commande sudo) : enregistrer cet identifiant et ouvrir la page `compte.html` au bouton de Google.

Tant que ce n'est pas fait, le site fonctionne comme avant (e-mail + mot de passe, mode invité), sans bouton Google.

## 1. Chez Google (10 minutes, une seule fois)

Personne d'autre que Philippe ne se connecte à son compte Google ; aucun mot de passe n'est à transmettre.

1. Ouvrir <https://console.cloud.google.com/> et se connecter avec son compte Google.
2. En haut à gauche, liste des projets → **Nouveau projet** → nom : `Calcoolos` → **Créer**, puis le sélectionner.
3. Menu ☰ → **Google Auth Platform** (ou « API et services » → « Écran de consentement OAuth ») → **Commencer** :
   - Nom de l'application : `Calcoolos` ; adresse e-mail d'assistance : la sienne ;
   - Audience : **Externe** ;
   - Coordonnées : son adresse e-mail ; accepter le règlement → **Créer**.
4. **Branding** (« Image de marque ») : page d'accueil `https://calculos.zfx.fr`, règles de confidentialité
   `https://calculos.zfx.fr/confidentialite.html`, domaine autorisé `zfx.fr` → **Enregistrer**.
5. **Audience** → **Publier l'application** (passer « En production »). Calcoolos ne demande que l'identité
   (adresse e-mail), donc Google ne demande pas de vérification. Sans cette étape, seuls des « utilisateurs test »
   pourraient se connecter.
6. **Clients** → **Créer un client** :
   - Type d'application : **Application Web** ; nom : `Site Calcoolos` ;
   - **Origines JavaScript autorisées** : `https://calculos.zfx.fr`
     (pour les essais sur le poste, ajouter aussi `http://localhost:5173` et `http://localhost`) ;
   - **URI de redirection autorisés** : rien ;
   - **Créer**.
7. Google affiche l'**ID client**, de la forme `123456789012-abc…xyz.apps.googleusercontent.com`.
   **C'est la seule information à transmettre à l'agent** (elle n'est pas secrète : elle sera visible dans la page).
   Le « code secret du client » affiché à côté ne sert pas : ne pas le transmettre, ne pas le stocker.

## 2. Sur le Dell (une commande)

Depuis le poste (Philippe tape son mot de passe sudo du Dell) :

```bash
ssh -t shantee@192.168.1.26 'sudo bash /home/calculos-zfx-fr/calcoolos/current/deploy/webdell/activer-google.sh 123456789012-abc…xyz.apps.googleusercontent.com'
```

Le script (`deploy/webdell/activer-google.sh`) sauvegarde avant de modifier, ne touche qu'au site Calcoolos, teste
Nginx avant de le recharger (retour arrière automatique en cas d'échec) et vérifie le résultat. Il est relançable.
Pour retirer le bouton : même commande avec `--desactiver` à la place de l'identifiant.

## 3. Vérifier

Ouvrir <https://calculos.zfx.fr/compte.html> : le bouton « Continuer avec Google » est sur les deux cartes. Un essai
avec un compte Google qui n'a jamais servi crée un compte et ouvre l'espace famille.

## Si le domaine change

1. Dans la console Google → Clients → `Site Calcoolos` : ajouter la nouvelle origine (`https://nouveau-domaine`), et
   dans Branding les nouvelles adresses. Les comptes déjà associés continuent de fonctionner (même identifiant client).
2. Côté serveur, rien à faire si le nouveau nom est ajouté au vhost existant (méthode de `doc/DEPLOIEMENT.md`). Si un
   nouveau site est créé (`installer.sh <nouveau-domaine>`), y relancer `activer-google.sh` (domaine en 2e argument).

## Comment ça marche (pour un développeur)

- Navigateur : `src/platform/google.ts` charge `https://accounts.google.com/gsi/client` (Google Identity Services),
  seulement sur `compte.html` et seulement si `/api/etat` annonce `googleClientId`. Le bouton est celui de Google.
- Google rend un jeton d'identité (JWT RS256). L'API le vérifie dans `server/src/Google.php` : signature avec les
  clés publiques de Google (téléchargées, mises en cache dans `VAR_DIR/google-certs.json`), émetteur, destinataire
  (`GOOGLE_CLIENT_ID`), expiration. On garde `sub` (identifiant Google stable) dans `comptes.google_sub`.
- Routes : `POST /google` (connexion, ou création si ni ce `sub` ni cette adresse ne sont connus),
  `POST /google/associer` et `POST /google/dissocier` (connecté). **Jamais de fusion par la seule adresse** : si
  l'adresse appartient déjà à un compte, il faut s'y connecter par mot de passe puis associer Google.
- Un compte créé avec Google n'a pas de mot de passe (`mot_de_passe` vide) ; sa suppression se confirme en
  recopiant l'adresse du compte.
- CSP : seule `compte.html` autorise `accounts.google.com/gsi/` (script, styles, cadre) ; voir
  `deploy/nginx-calcoolos.conf` (vérifié par `scripts/csp-check.mjs`).
- Tests : `server/tests/run.php` (fausse Google : clés de test), `scripts/google-e2e.mjs` (navigateur, script de
  Google imité). L'essai avec le vrai Google se fait en ligne, une fois l'étape 1 faite.
