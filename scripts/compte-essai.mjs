/**
 * Plus de mode invité (03/11/2026) : une page de jeu exige un compte et un profil. Les scripts qui ouvrent un jeu
 * directement appellent `preparerJoueur(contexte, base)` juste après `browser.newContext(...)`.
 *
 * - API joignable : connexion au compte d'essai local (créé au premier passage, un seul compte pour tous les
 *   scripts : la limite de 5 inscriptions par heure n'est jamais atteinte), profil personnel « Robot essai ».
 * - API injoignable (`vite preview` seul) : un joueur retenu sur l'appareil suffit (cas « serveur en panne »).
 *
 * Jamais en production : refuse toute adresse qui n'est pas locale.
 */
const EMAIL = 'robot-essai@calcoolos.invalid';
const MOT_DE_PASSE = 'robot-essai-local-42';
const PSEUDO = 'RobotEssai';

export async function preparerJoueur(contexte, base) {
  const hote = new URL(base).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(hote)) throw new Error(`compte d'essai réservé au poste local (${hote})`);
  const page = await contexte.newPage();
  await page.goto(`${base}/confidentialite.html`, { waitUntil: 'domcontentloaded' });
  const joueur = await page.evaluate(async ([email, motDePasse, pseudo]) => {
    const get = async () => {
      const r = await fetch('/api/etat', { headers: { Accept: 'application/json' } });
      return r.status === 200 ? r.json() : null;
    };
    const post = async (chemin, corps) => {
      const etat = await get();
      const r = await fetch(`/api${chemin}`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Calcoolos': '1', 'X-CSRF-Token': etat?.csrf ?? '' },
        body: JSON.stringify(corps),
      });
      return { status: r.status, data: await r.json().catch(() => ({})) };
    };
    let etat = await get().catch(() => null);
    if (!etat) return { hors: true };
    if (!etat.connecte) {
      let r = await post('/connexion', { email, motDePasse });
      if (r.status !== 200) r = await post('/inscription', { email, motDePasse, adulte: true });
      if (r.status !== 200 && r.status !== 201) throw new Error(`compte d'essai : ${r.status} ${JSON.stringify(r.data)}`);
      etat = await get();
    }
    let profil = etat.profils?.find((p) => p.personnel) ?? etat.profils?.[0];
    if (!profil) {
      const r = await post('/profils', { pseudo, niveau: 'ce2', avatar: 'astronaute', personnel: true });
      if (r.status !== 201) throw new Error(`profil d'essai : ${r.status} ${JSON.stringify(r.data)}`);
      profil = r.data.profils.find((p) => p.personnel) ?? r.data.profils[0];
    }
    return { id: profil.id, pseudo: profil.pseudo, avatar: profil.avatar, niveau: profil.niveau };
  }, [EMAIL, MOT_DE_PASSE, PSEUDO]);
  const retenu = joueur.hors ? { id: 1, pseudo: PSEUDO, avatar: 'astronaute', niveau: 'ce2' } : joueur;
  await page.evaluate((j) => localStorage.setItem('calcoolos.joueur', JSON.stringify(j)), retenu);
  await page.close();
  return { ...retenu, horsLigne: !!joueur.hors };
}
