# Analyseur de logs serveur (Node.js)

Module PAWEB — 3ème année LMD — Option ISIL — Sujet 1

Outil en ligne de commande écrit en Node.js (sans API Web ni bibliothèque externe) qui analyse un fichier de logs serveur (format Apache/Nginx) et génère un rapport en **Markdown** ou **JSON**.

## Métriques calculées

1. Nombre total de requêtes
2. Taux d'erreur (4xx et 5xx)
3. Les 10 URLs les plus visitées
4. Nombre de requêtes échouées (4xx / 5xx) par date
5. Adresses IP suspectes (au moins 10 tentatives : accès refusés 401/403 ou URLs dangereuses comme `/wp-login.php`, `/.env`, `/admin`)

## Utilisation

Prérequis : Node.js installé (`node -v`).

```bash
node analyse.js samples/access.log        # rapport Markdown -> rapport.md
node analyse.js samples/access.log json   # rapport JSON     -> rapport.json
```

## Les étapes du programme

| Étape | Rôle |
|---|---|
| 1 | Lire les arguments (`process.argv`) : fichier et format |
| 2 | Préparer les compteurs (total, erreurs, URLs, dates, IP) |
| 3 | Traiter chaque ligne avec une expression régulière (IP, date, URL, code HTTP) |
| 4 | Construire le rapport (tri des URLs, taux d'erreur, IP suspectes) |
| 5 | Mettre le rapport en forme en Markdown |
| 6 | Lire le fichier ligne par ligne avec `readline` (streaming) : le fichier n'est jamais chargé entièrement en mémoire, ce qui permet d'analyser des fichiers volumineux |

Le code de chaque étape est commenté dans `analyse.js`.

## Format d'une ligne de log

```
45.155.205.33 - - [03/Nov/2026:14:22:10 +0000] "POST /wp-login.php HTTP/1.1" 401 230 "-" "curl/8.5.0"
```
