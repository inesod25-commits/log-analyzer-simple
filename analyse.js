// =============================================================
//  Analyseur de logs serveur - version simple (un seul fichier)
//  Utilisation :  node analyse.js <fichier.log> [md|json]
//  Exemple     :  node analyse.js samples/access.log md
// =============================================================

const fs = require('fs');
const readline = require('readline');

// ---------- Étape 1 : lire les arguments ----------
const fichier = process.argv[2];
const format = process.argv[3] || 'md';   // md par défaut

if (!fichier || !fs.existsSync(fichier)) {
  console.log('Utilisation : node analyse.js <fichier.log> [md|json]');
  process.exit(1);
}

// ---------- Étape 2 : préparer les compteurs ----------
let total = 0;            // nombre total de requêtes
let erreurs4xx = 0;       // erreurs client
let erreurs5xx = 0;       // erreurs serveur
const urls = {};          // { "/index.html": 120, ... }
const erreursParDate = {};// { "01/Nov/2026": { "4xx": 3, "5xx": 1 } }
const tentativesParIp = {}; // { "1.2.3.4": 15 }

// Une ligne de log ressemble à :
// 1.2.3.4 - - [01/Nov/2026:10:15:32 +0000] "GET /index.html HTTP/1.1" 200 5320 "-" "Mozilla"
const regex = /^(\S+) \S+ \S+ \[([^:]+):[^\]]+\] "\S+ (\S+)[^"]*" (\d{3})/;

// URLs typiquement visées par les pirates
const urlsDangereuses = ['wp-login', 'admin', '.env', '.git', 'phpmyadmin', 'passwd', '../', 'xmlrpc'];

// ---------- Étape 3 : traiter une ligne ----------
function traiterLigne(ligne) {
  const m = regex.exec(ligne);
  if (!m) return;                         // ligne invalide : on l'ignore

  const ip = m[1];
  const date = m[2];                      // ex : 01/Nov/2026
  const url = m[3].split('?')[0];         // on enlève les paramètres ?id=...
  const code = Number(m[4]);

  total++;
  urls[url] = (urls[url] || 0) + 1;

  // Erreurs 4xx / 5xx avec leur date
  if (code >= 400) {
    const type = code >= 500 ? '5xx' : '4xx';
    if (type === '5xx') erreurs5xx++; else erreurs4xx++;
    if (!erreursParDate[date]) erreursParDate[date] = { '4xx': 0, '5xx': 0 };
    erreursParDate[date][type]++;
  }

  // Tentative d'intrusion : accès refusé (401/403) ou URL dangereuse
  const dangereuse = urlsDangereuses.some((mot) => url.includes(mot));
  if (code === 401 || code === 403 || dangereuse) {
    tentativesParIp[ip] = (tentativesParIp[ip] || 0) + 1;
  }
}

// ---------- Étape 4 : construire le rapport ----------
function construireRapport() {
  const totalErreurs = erreurs4xx + erreurs5xx;

  const topUrls = Object.entries(urls)
    .sort((a, b) => b[1] - a[1])          // tri du plus visité au moins visité
    .slice(0, 10)
    .map(([url, visites]) => ({ url, visites }));

  const ipSuspectes = Object.entries(tentativesParIp)
    .filter(([ip, n]) => n >= 10)         // seuil : 10 tentatives
    .sort((a, b) => b[1] - a[1])
    .map(([ip, tentatives]) => ({ ip, tentatives }));

  return {
    totalRequetes: total,
    tauxErreur: (total ? (totalErreurs / total) * 100 : 0).toFixed(2) + ' %',
    erreurs4xx,
    erreurs5xx,
    topUrls,
    erreursParDate,
    ipSuspectes,
  };
}

// ---------- Étape 5 : afficher en Markdown ----------
function enMarkdown(r) {
  let md = '# Rapport d\'analyse des logs\n\n';
  md += `- Nombre total de requêtes : **${r.totalRequetes}**\n`;
  md += `- Taux d'erreur : **${r.tauxErreur}** (4xx : ${r.erreurs4xx}, 5xx : ${r.erreurs5xx})\n\n`;

  md += '## URLs les plus visitées\n\n| URL | Visites |\n|---|---|\n';
  r.topUrls.forEach((u) => { md += `| ${u.url} | ${u.visites} |\n`; });

  md += '\n## Requêtes échouées par date\n\n| Date | 4xx | 5xx |\n|---|---|---|\n';
  for (const date in r.erreursParDate) {
    md += `| ${date} | ${r.erreursParDate[date]['4xx']} | ${r.erreursParDate[date]['5xx']} |\n`;
  }

  md += '\n## Adresses IP suspectes\n\n| IP | Tentatives |\n|---|---|\n';
  r.ipSuspectes.forEach((s) => { md += `| ${s.ip} | ${s.tentatives} |\n`; });
  return md;
}

// ---------- Étape 6 : lire le fichier ligne par ligne (streaming) ----------
// On ne charge pas tout le fichier en mémoire : ça marche même pour des Go de logs.
const lecteur = readline.createInterface({ input: fs.createReadStream(fichier) });

lecteur.on('line', traiterLigne);

lecteur.on('close', () => {
  const rapport = construireRapport();
  const contenu = format === 'json' ? JSON.stringify(rapport, null, 2) : enMarkdown(rapport);
  const sortie = format === 'json' ? 'rapport.json' : 'rapport.md';

  fs.writeFileSync(sortie, contenu);       // enregistre le rapport
  console.log(contenu);                    // et l'affiche
  console.log(`\nRapport enregistré dans ${sortie}`);
});
