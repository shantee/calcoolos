/**
 * Diagnostic de la 3D, pour comprendre un échec sur un appareil qu'on n'a pas sous la main (tablette d'un enfant…).
 * Le rapport reste dans la page : rien n'est envoyé au serveur, on le lit à l'écran ou on le copie.
 * Pour l'obtenir : ajouter ?diag à l'adresse d'un jeu en 3D, ou « Détails techniques » sur l'écran d'échec.
 */
import './sans3d.css';

const MAX_LIGNES = 60;
const journal: string[] = [];

/** Ajoute une ligne au journal du démarrage de la 3D. */
export function noter3d(message: string): void {
  const secondes = (performance.now() / 1000).toFixed(1);
  if (journal.length < MAX_LIGNES) journal.push(`${secondes} s  ${message}`);
}

const texteErreur = (e: unknown): string =>
  e instanceof Error ? `${e.name} : ${e.message}` : String(e).slice(0, 300);

/** Retient aussi les erreurs que personne n'intercepte : shaders refusés par le pilote, erreurs de rendu. */
export function ecouterErreurs3d(): void {
  const reel = console.error;
  console.error = (...args: unknown[]) => {
    noter3d(`console.error : ${args.map(texteErreur).join(' ').slice(0, 300)}`);
    reel.apply(console, args);
  };
  window.addEventListener('error', (e) => noter3d(`erreur : ${e.message}`));
  window.addEventListener('unhandledrejection', (e) => noter3d(`promesse rejetée : ${texteErreur(e.reason)}`));
}

function sonderWebgl(type: 'webgl2' | 'webgl'): string[] {
  const canvas = document.createElement('canvas');
  let refus = '';
  canvas.addEventListener('webglcontextcreationerror', (e) => {
    refus = (e as WebGLContextEvent).statusMessage;
  });
  const gl = canvas.getContext(type) as WebGLRenderingContext | null;
  const nom = type === 'webgl2' ? 'WebGL 2' : 'WebGL 1';
  if (!gl) return [`${nom} : REFUSÉ${refus ? ` (${refus})` : ''}`];
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const haute = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  const extensions = ['EXT_color_buffer_float', 'EXT_color_buffer_half_float', 'OES_texture_float_linear']
    .filter((e) => gl.getExtension(e))
    .join(', ');
  const lignes = [
    `${nom} : OK, ${gl.getParameter(gl.VERSION)}`,
    `  rendu : ${gl.getParameter(gl.VENDOR)} / ${gl.getParameter(gl.RENDERER)}`,
    `  rendu détaillé : ${info ? `${gl.getParameter(info.UNMASKED_VENDOR_WEBGL)} / ${gl.getParameter(info.UNMASKED_RENDERER_WEBGL)}` : 'non communiqué'}`,
    `  limites : texture ${gl.getParameter(gl.MAX_TEXTURE_SIZE)}, tampon ${gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)}, précision haute ${haute?.precision ?? '?'}`,
    `  extensions utiles : ${extensions || 'aucune'}`,
  ];
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return lignes;
}

/** WebGPU n'est plus utilisé par les jeux, mais son état explique le comportement d'un navigateur. */
async function sonderWebgpu(): Promise<string> {
  const gpu = (navigator as unknown as { gpu?: GPU }).gpu;
  if (!gpu) return 'WebGPU : absent';
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) return 'WebGPU : présent, aucun adaptateur';
    const { vendor, architecture } = adapter.info;
    const device = await adapter.requestDevice();
    device.destroy();
    return `WebGPU : disponible (fabricant « ${vendor} », architecture « ${architecture} »)`;
  } catch (e) {
    return `WebGPU : échec, ${texteErreur(e)}`;
  }
}

const avecDelai = (attente: Promise<string>, ms: number): Promise<string> =>
  Promise.race([attente, new Promise<string>((ok) => setTimeout(() => ok('WebGPU : pas de réponse'), ms))]);

export async function rapport3d(): Promise<string> {
  const sonde = (type: 'webgl2' | 'webgl') => {
    try {
      return sonderWebgl(type);
    } catch (e) {
      return [`${type} : échec de la sonde, ${texteErreur(e)}`];
    }
  };
  return [
    'Diagnostic 3D Calcoolos',
    `${new Date().toLocaleString('fr-FR')}, ${location.pathname}`,
    navigator.userAgent,
    `Brave : ${'brave' in navigator ? 'oui' : 'non détecté'}`,
    `Écran : ${innerWidth} × ${innerHeight}, densité ${devicePixelRatio}, tactile ${navigator.maxTouchPoints}`,
    '',
    ...sonde('webgl2'),
    ...sonde('webgl'),
    await avecDelai(sonderWebgpu(), 4000),
    '',
    'Démarrage :',
    ...(journal.length ? journal : ['(rien de noté)']),
  ].join('\n');
}

/** Copie même sans l'API du presse-papiers (absente ou refusée sur certains navigateurs). */
async function copier(zone: HTMLTextAreaElement): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(zone.value);
    return true;
  } catch {
    zone.select();
    return document.execCommand('copy');
  }
}

/** Panneau lisible et copiable, par-dessus le jeu ou l'écran d'échec. */
export async function ouvrirDiag3d(): Promise<void> {
  document.querySelector('.diag3d')?.remove();
  const panneau = document.createElement('section');
  panneau.className = 'diag3d';
  panneau.setAttribute('aria-label', 'Diagnostic de la 3D');
  const zone = document.createElement('textarea');
  zone.readOnly = true;
  zone.value = 'Analyse en cours…';
  const actions = document.createElement('div');
  const boutonCopier = document.createElement('button');
  boutonCopier.type = 'button';
  boutonCopier.textContent = 'Copier le rapport';
  boutonCopier.onclick = async () => {
    boutonCopier.textContent = (await copier(zone)) ? 'Copié !' : 'Sélectionne le texte pour le copier';
  };
  const fermer = document.createElement('button');
  fermer.type = 'button';
  fermer.textContent = 'Fermer';
  fermer.onclick = () => panneau.remove();
  actions.append(boutonCopier, fermer);
  panneau.append(zone, actions);
  document.body.append(panneau);
  zone.value = await rapport3d();
}
