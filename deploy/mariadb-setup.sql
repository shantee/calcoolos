-- Création de la base Calcoolos sur MariaDB (à lancer UNE fois, sur le serveur).
--
--   sudo mariadb < deploy/mariadb-setup.sql
--
-- Le mot de passe n'est PAS dans ce fichier : remplacer MOT_DE_PASSE_A_GENERER par un
-- mot de passe généré sur le serveur (par exemple : openssl rand -base64 24) dans une
-- copie temporaire, ou taper les commandes à la main. Le même mot de passe va ensuite
-- dans /etc/calcoolos/calcoolos.env (DB_PASSWORD), jamais dans le dépôt.

CREATE DATABASE IF NOT EXISTS calcoolos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Accès local uniquement, et seulement à cette base.
CREATE USER IF NOT EXISTS 'calcoolos'@'localhost' IDENTIFIED BY 'MOT_DE_PASSE_A_GENERER';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES ON calcoolos.* TO 'calcoolos'@'localhost';
FLUSH PRIVILEGES;
