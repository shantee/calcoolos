/**
 * Le manège de l'accueil : les jeux tournent sur un anneau, celui de face montre sa description.
 * Glisser fait tourner, toucher une carte de côté l'amène de face, toucher la carte de face demande la difficulté.
 *
 * Sans ce script, les jeux restent simplement l'un sous l'autre. Tout passe par `transform` et `opacity`, que la carte
 * graphique déplace sans rien redessiner : ni WebGL, ni flou, ni filtre. Les sections des jeux étant en
 * `display: contents`, sans contexte 3D commun, chaque carte porte sa propre perspective.
 */
import { h } from './dom';

interface Options {
  /** Animations réduites : les cartes changent de place sans tourner. */
  calme: boolean;
  /** Appareil modeste annoncé d'avance : cartes à plat, sans inclinaison ni halo. */
  leger: boolean;
  depart: number;
  surChangement: (vitrine: HTMLElement) => void;
}

export interface Manege {
  aller(index: number): void;
}

/** Écart et profondeur de l'anneau, en largeurs de carte. */
const ECART = 1.02;
const PROFONDEUR = 0.5;
const INCLINAISON_DEG = 38;
/** Vitesse de rotation (ms) : plus lent à l'ouverture de la page, qui fait un seul tour de présentation. */
const TEMPS_TOUR = 130;
const TEMPS_OUVERTURE = 420;
const SEUIL_GLISSE_PX = 8;
/** Un geste vif compte : relâcher à 20 % d'un cran suffit à passer au jeu suivant. */
const ELAN = 0.3;
/** Plus de 40 ms par image sur deux tours : l'appareil peine, le manège passe à plat. */
const IMAGE_LENTE_MS = 40;
const TOURS_LENTS = 2;

const modulo = (x: number, n: number) => ((x % n) + n) % n;
const borne = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

export function monterManege(racine: HTMLElement, { calme, leger, depart, surChangement }: Options): Manege {
  const vitrines = [...racine.querySelectorAll<HTMLElement>('.vitrine')];
  const cartes = vitrines.map((v) => v.querySelector<HTMLElement>('.vitrine-image')!);
  const textes = vitrines.map((v) => v.querySelector<HTMLElement>('.vitrine-texte')!);
  const n = vitrines.length;
  /** Dernières valeurs écrites : on n'y touche que si elles changent. */
  const plans = cartes.map(() => ({ z: -1, cachee: false, active: false }));

  let cible = depart;
  let position = calme ? depart : depart - 1.6;
  let temps = TEMPS_OUVERTURE;
  let largeur = 0;
  let image = 0;
  let precedent = 0;
  let imagesDuTour = 0;
  let dureeDuTour = 0;
  let toursLents = 0;

  const annonce = h('p', { class: 'visuel-masque', 'aria-live': 'polite' });
  const noms = vitrines.map((v, i) => {
    const nom = v.querySelector('h2')?.textContent ?? '';
    // Sur petit écran, les noms laissent la place aux miniatures : on reconnaît le jeu à son image.
    const b = h('button', { type: 'button' },
      h('img', { src: v.querySelector('img')?.srcset.split(' ')[0] ?? '', alt: '', width: 480, height: 360, loading: 'lazy' }),
      h('span', {}, nom));
    b.addEventListener('click', () => aller(i));
    return b;
  });
  const fleche = (libelle: string, classe: string, pas: number) => {
    const b = h('button', { type: 'button', class: `manege-fleche ${classe}`, 'aria-label': libelle });
    b.addEventListener('click', () => tourner(pas));
    return b;
  };
  // Avant les jeux, pour que la tabulation aille des noms au bouton « Jouer » du jeu de face.
  racine.prepend(
    h('nav', { class: 'manege-nav', 'aria-label': 'Choisir un jeu' }, fleche('Jeu précédent', 'manege-precedent', -1), h('div', { class: 'manege-noms' }, ...noms), fleche('Jeu suivant', 'manege-suivant', 1)),
    annonce,
  );

  function dessiner(): void {
    for (let i = 0; i < n; i++) {
      const angle = ((modulo(i - position + n / 2, n) - n / 2) * 2 * Math.PI) / n;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      const s = cartes[i].style;
      const x = (sin * ECART * largeur).toFixed(1);
      if (leger) {
        s.transform = `translate3d(${x}px, 0, 0) scale(${(0.74 + 0.26 * Math.max(cos, 0)).toFixed(3)})`;
      } else {
        const y = ((cos - 1) * 0.05 * largeur).toFixed(1);
        const z = ((cos - 1) * PROFONDEUR * largeur).toFixed(1);
        s.transform = `perspective(1400px) translate3d(${x}px, ${y}px, ${z}px) rotateY(${(-sin * INCLINAISON_DEG).toFixed(1)}deg)`;
      }
      // L'opacité assombrit les cartes de côté sur le fond de la page ; celles de derrière n'existent plus pour le navigateur.
      s.opacity = (cos > 0.5 ? 0.82 + (cos - 0.5) * 0.36 : borne((cos + 0.5) * 0.82, 0, 0.82)).toFixed(2);
      const plan = plans[i];
      const z = Math.round((cos + 1) * 10) + 1;
      if (z !== plan.z) s.zIndex = String((plan.z = z));
      const cachee = cos <= -0.5;
      if (cachee !== plan.cachee) s.visibility = (plan.cachee = cachee) ? 'hidden' : '';
      const active = cos > 0;
      if (active !== plan.active) s.pointerEvents = (plan.active = active) ? '' : 'none';
    }
  }

  function passerAPlat(): void {
    leger = true;
    racine.classList.add('manege-leger');
    dessiner();
  }

  function boucle(maintenant: number): void {
    const brut = maintenant - precedent;
    const ecoule = Math.min(brut, 50);
    precedent = maintenant;
    if (temps === TEMPS_TOUR && brut < 250) {
      imagesDuTour++;
      dureeDuTour += brut;
    }
    position += (cible - position) * (1 - Math.exp(-ecoule / temps));
    const fini = Math.abs(cible - position) < 0.001;
    if (fini) position = cible;
    dessiner();
    image = fini ? 0 : requestAnimationFrame(boucle);
    if (fini && imagesDuTour >= 6) {
      if (dureeDuTour / imagesDuTour > IMAGE_LENTE_MS) toursLents++;
      imagesDuTour = 0;
      dureeDuTour = 0;
      if (toursLents >= TOURS_LENTS && !leger) passerAPlat();
    }
  }

  function animer(): void {
    if (calme) {
      position = cible;
      dessiner();
    } else if (!image) {
      precedent = performance.now();
      image = requestAnimationFrame(boucle);
    }
  }

  function actualiser(): void {
    const actif = modulo(cible, n);
    // Le clavier était sur « Jouer » : il suit le jeu de face au lieu de se perdre dans un texte masqué.
    const suivreFocus = document.activeElement?.closest('.vitrine-texte') != null;
    vitrines.forEach((_, i) => {
      cartes[i].classList.toggle('devant', i === actif);
      textes[i].classList.toggle('devant', i === actif);
      if (i === actif) noms[i].setAttribute('aria-current', 'true');
      else noms[i].removeAttribute('aria-current');
    });
    if (suivreFocus) textes[actif].querySelector<HTMLElement>('a.jouer')?.focus({ preventScroll: true });
    annonce.textContent = `${noms[actif].textContent}, jeu ${actif + 1} sur ${n}`;
    surChangement(vitrines[actif]);
  }

  function tourner(pas: number): void {
    cible += pas;
    temps = TEMPS_TOUR;
    actualiser();
    animer();
  }

  /** Va vers ce jeu par le chemin le plus court. */
  function aller(index: number): void {
    tourner(modulo(index - modulo(cible, n) + n / 2, n) - n / 2);
  }

  // Glisser pour faire tourner : le manège suit le doigt, puis se cale sur le jeu le plus proche.
  // Un mouvement surtout vertical reste au navigateur : il fait défiler la page, sans toucher au manège.
  let prise: { x: number; y: number; position: number; id: number; glisse: boolean } | null = null;
  let clicAnnule = false;
  racine.addEventListener('dragstart', (e) => e.preventDefault());
  racine.addEventListener('pointerdown', (e) => {
    if (e.button === 0 && (e.target as Element).closest('.vitrine-image')) {
      prise = { x: e.clientX, y: e.clientY, position, id: e.pointerId, glisse: false };
    }
  });
  racine.addEventListener('pointermove', (e) => {
    if (!prise || e.pointerId !== prise.id) return;
    const dx = e.clientX - prise.x;
    if (!prise.glisse && Math.abs(dx) > SEUIL_GLISSE_PX) {
      if (Math.abs(e.clientY - prise.y) > Math.abs(dx)) {
        prise = null;
        return;
      }
      prise.glisse = true;
      racine.setPointerCapture(e.pointerId);
      racine.classList.add('manege-tenu');
      if (image) cancelAnimationFrame(image);
      image = 0;
    }
    if (prise.glisse) {
      position = prise.position - dx / (largeur * ECART);
      dessiner();
    }
  });
  // Le manège garde le geste pour lui : sinon Chrome lance une inertie invisible, et le toucher suivant ne fait que l'arrêter.
  racine.addEventListener(
    'touchmove',
    (e) => {
      if (prise?.glisse && e.cancelable) e.preventDefault();
    },
    { passive: false },
  );
  // Un appui long sur une carte ne doit pas ouvrir le menu « ouvrir le lien, enregistrer l'image ».
  racine.addEventListener('contextmenu', (e) => {
    if (prise) e.preventDefault();
  });
  const lacher = (e: PointerEvent) => {
    if (!prise || e.pointerId !== prise.id) return;
    if (prise.glisse) {
      // Le clic qui suit un glissé est ignoré ; certains navigateurs n'en envoient pas, d'où la limite de temps.
      clicAnnule = e.type === 'pointerup';
      setTimeout(() => (clicAnnule = false), 100);
      racine.classList.remove('manege-tenu');
      tourner(Math.round(position + Math.sign(position - prise.position) * ELAN) - cible);
    }
    prise = null;
  };
  racine.addEventListener('pointerup', lacher);
  racine.addEventListener('pointercancel', lacher);

  // Une carte de côté vient de face ; seule celle de face lance le jeu (en phase de capture, avant le lancement).
  racine.addEventListener(
    'click',
    (e) => {
      const carte = (e.target as Element).closest<HTMLElement>('.vitrine-image');
      const i = carte ? cartes.indexOf(carte) : -1;
      if (clicAnnule || (i >= 0 && i !== modulo(cible, n))) {
        e.preventDefault();
        e.stopPropagation();
        if (!clicAnnule) aller(i);
      }
      clicAnnule = false;
    },
    true,
  );

  racine.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') tourner(-1);
    else if (e.key === 'ArrowRight') tourner(1);
  });

  // La largeur des cartes suit l'écran (et vaut 0 tant que le manège est masqué).
  new ResizeObserver(() => {
    largeur = cartes[0].offsetWidth;
    dessiner();
  }).observe(racine);

  racine.classList.add('manege-pret');
  racine.classList.toggle('manege-leger', leger);
  largeur = cartes[0].offsetWidth;
  actualiser();
  dessiner();
  animer();
  return { aller };
}
