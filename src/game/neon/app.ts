/**
 * Neon Flight dans Calcoolos : écran titre, réglages, tableau de bord du vol, fin de partie.
 * La plateforme fournit le niveau (?niveau=, sinon celui du profil ou de l'appareil), le profil actif,
 * le son commun, l'enregistrement du résultat (reportResult) et la mesure du temps de jeu actif.
 */
import "./style.css";
import { CEILING, COMBO_TIME, Flight, RECORD_KEY, SERIES, SETTINGS_KEY, TIME_LIMIT, loadSettings, readRecord, save, seriesOf, starsFor, type SeriesId, type Settings } from "./model";
import { Fx } from "./fx";
import { dangerAltitude, placeAt } from "./stages";
import { World } from "./world";
import { Synth } from "./audio";
import { reportResult, outcomeText } from "../../platform/results";
import { partieCommence, partiePause } from "../../platform/suivi";
import { activePlayer } from "../../platform/player";
import { estNiveau, niveauRetenu, NIVEAUX, NIVEAU_INFOS } from "../../platform/niveau";
import { AVATAR_INVITE, avatarImg } from "../../platform/avatars";
import type { TierId } from "../../core/difficulty";
const app = document.querySelector<HTMLDivElement>("#app")!;
const params = new URLSearchParams(location.search);
const player = activePlayer();
const tierParam = params.get("niveau");
let tier: TierId = estNiveau(tierParam) ? tierParam : estNiveau(player?.niveau) ? player.niveau : niveauRetenu() ?? "explorateur";
const settings = loadSettings(tier),
  flight = new Flight(settings),
  world = new World(),
  audio = new Synth();
let record = readRecord(),
  input = "",
  last = performance.now(),
  crashTime = 0,
  recorded = false,
  startedAt = 0,
  crashed = false;
/** Le son est commun à tous les jeux de Calcoolos. */
const SOUND_KEY = "calcoolos.son";
try {
  settings.sound = localStorage.getItem(SOUND_KEY) !== "off";
} catch {
  /* stockage indisponible : son actif */
}
/** ?depart=6.6 : commencer à 6,6 km (essais d'une étape). Un tel vol n'est pas enregistré. */
const essai = Number(params.get("depart")) > 0;
const recordKey = () => `${settings.difficulty}/${seriesOf(settings.tables)}`;
const bestFor = () => record.bests?.[recordKey()] ?? 0;
const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
  document.querySelector<T>(s)!;
const fmt = (n: number) => Math.floor(n).toLocaleString("fr-FR");
let shownScore = 0,
  lastPlace = "";
app.innerHTML = `<div class="vignette"></div><header><a class="home-link" href="../index.html" title="Retour à l’accueil de Calcoolos">← Accueil</a><div class="tools"><button id="sound" aria-label="Activer ou couper le son"></button><button id="fullscreen" aria-label="Plein écran" title="Plein écran"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button><button id="pause" hidden>Ⅱ Pause</button></div></header>
<section id="title" class="title-screen"><div class="hero"><h1>NEON<br><span>FLIGHT</span><b>MULTIPLY</b></h1><p class="tagline">Tes réponses sont ton carburant.</p><p class="intro">De la forêt jusqu’à la mégapole.</p></div>
<div class="setup panel"><div class="pilot" id="pilot"></div><div class="segmented" id="modes"><button data-mode="arcade">Arcade <small>Vise le record · classé</small></button><button data-mode="training">Entraînement <small>Prends ton temps</small></button></div><div class="label-row"><label id="tables-label">Tes tables</label><span id="series-note" class="series-note"></span></div><div class="series" role="group" aria-labelledby="tables-label">${Object.entries(SERIES).map(([id, s]) => `<button data-series="${id}">${s.name.replace("Tables ", "")}</button>`).join("")}</div><div class="tables">${Array.from({ length: 11 }, (_, i) => `<button data-table="${i + 2}" aria-label="Table de ${i + 2}">${i + 2}</button>`).join("")}</div><div class="select-row"><label>Niveau<select id="difficulty">${NIVEAUX.map((n) => `<option value="${n}">${NIVEAU_INFOS[n].nom} · ${TIME_LIMIT[n]} s</option>`).join("")}</select></label><label>Graphismes<select id="quality"><option value="low">Éco</option><option value="medium">Équilibré</option><option value="high">Spectaculaire</option></select></label></div><button id="play" class="primary" disabled>INITIALISATION…</button><p class="hint">Tape ta réponse, puis <kbd>Entrée</kbd>.</p><div class="record"><span id="best-label">TON RECORD</span><strong id="best"></strong></div></div></section>
<section id="hud" hidden><div class="top-hud"><div class="score-block"><strong id="score">0</strong><small id="combo"></small><div class="mult" id="mult">×1</div><div class="heat"><span id="heat-label">🌈</span><div class="heat-track"><i id="heat-fill"></i></div></div></div><div class="telemetry"><span id="stage"></span><span id="distance">0 KM</span></div></div><div id="altitude" class="altimeter"><strong id="alt">100 <small>M</small></strong><div class="alt-track"><i id="alt-fill"></i><b></b></div><small id="alt-label"></small><b id="vario" class="vario">▼ 0,0 m/s</b></div><div id="event" role="status" aria-live="polite"></div><div class="question panel"><div class="question-top"><span id="question-label"></span><span id="seconds"></span></div><div class="time-track"><i id="time-fill"></i></div><div class="equation"><span id="equation">2 × 3</span><span class="equals">=</span><output id="answer" aria-label="Ta réponse">?</output></div><div id="feedback" aria-live="polite"></div><div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "⌫", 0, "↵"].map((v) => `<button data-key="${v}" aria-label="${v === "⌫" ? "Effacer" : v === "↵" ? "Valider" : v}">${v}</button>`).join("")}</div></div><button id="finish" class="finish" hidden>Terminer le vol</button></section>
<section id="pause-screen" class="overlay" hidden><div class="panel modal"><p class="eyebrow">RÉACTEURS EN VEILLE</p><h2>Petite escale.</h2><p>Ton vol t’attend.</p><button id="resume" class="primary">REPRENDRE ↗</button><button id="quit" class="secondary">Retour à la base</button></div></section>
<section id="results" class="overlay" hidden><div class="panel modal results"><p class="eyebrow" id="result-label">VOL TERMINÉ</p><h2 id="result-title">Une belle traversée.</h2><div class="final-score"><strong id="final-score">0</strong><span>POINTS</span></div><div id="stars" class="stars" aria-label=""></div><div id="stats" class="stats"></div><div id="mastery" class="mastery"></div><p id="outcome" class="outcome" role="status"></p><button id="replay" class="primary">REJOUER ↗</button><button id="home" class="secondary">Choisir mes tables</button><a class="secondary progress-link" href="../tableau.html">Voir mes progrès</a></div></section>`;
const fx = new Fx(app);
function syncSettings() {
  for (const b of document.querySelectorAll<HTMLButtonElement>(
    "[data-table]",
  )) {
    const active = settings.tables.includes(Number(b.dataset.table));
    b.classList.toggle("selected", active);
    b.setAttribute("aria-pressed", String(active));
  }
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
    const active = b.dataset.mode === settings.mode;
    b.classList.toggle("selected", active);
    b.setAttribute("aria-pressed", String(active));
  }
  const series = seriesOf(settings.tables);
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-series]")) {
    const active = b.dataset.series === series;
    b.classList.toggle("selected", active);
    b.setAttribute("aria-pressed", String(active));
  }
  $("#series-note").textContent =
    settings.mode === "training"
      ? "Entraînement : hors classement"
      : series === "perso"
        ? "Tables au choix : hors classement"
        : "🏆 Série classée";
  $("#difficulty").toggleAttribute("disabled", settings.mode === "training");
  $("#best-label").textContent = series === "perso" ? "TON RECORD · TABLES AU CHOIX" : `TON RECORD · ${NIVEAU_INFOS[settings.difficulty].nom.toUpperCase()} · ${SERIES[series].name.replace("Tables ", "").toUpperCase()}`;
  $("#best").innerHTML = `${fmt(bestFor())} <small>PTS</small>`;
  $("#sound").textContent = settings.sound ? "♫ SON" : "♫ MUET";
  $("#sound").setAttribute("aria-pressed", String(settings.sound));
  audio.set(settings.sound);
  save(SETTINGS_KEY, settings);
  try {
    localStorage.setItem(SOUND_KEY, settings.sound ? "on" : "off");
  } catch {
    /* stockage indisponible */
  }
}
/** Qui joue : le profil actif de Calcoolos, ou l'invité (résultats gardés sur l'appareil). */
$("#pilot").replaceChildren(
  avatarImg(player?.avatar ?? AVATAR_INVITE, 40, ""),
  Object.assign(document.createElement("span"), {
    innerHTML: player
      ? `<b></b><small>Tes vols sont enregistrés dans tes progrès</small>`
      : `<b>Invité</b><small>Scores gardés sur cet appareil · <a href="../compte.html#inscription">créer un compte</a></small>`,
  }),
);
if (player) $("#pilot b").textContent = player.pseudo;
$("#difficulty").addEventListener("change", (e) => {
  const v = (e.target as HTMLSelectElement).value;
  if (!estNiveau(v)) return;
  tier = settings.difficulty = v;
  // Le niveau choisi ici vaut pour cette page (l'adresse le garde au rechargement).
  const url = new URL(location.href);
  url.searchParams.set("niveau", v);
  history.replaceState(null, "", url);
  syncSettings();
});
$("#quality").addEventListener("change", (e) => {
  settings.quality = (e.target as HTMLSelectElement)
    .value as Settings["quality"];
  world.setQuality(settings.quality);
  syncSettings();
});
$<HTMLSelectElement>("#difficulty").value = settings.difficulty;
$<HTMLSelectElement>("#quality").value = settings.quality;
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-table]"))
  b.onclick = () => {
    const n = Number(b.dataset.table);
    if (settings.tables.includes(n)) {
      if (settings.tables.length > 1)
        settings.tables = settings.tables.filter((t) => t !== n);
    } else settings.tables.push(n);
    syncSettings();
  };
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-mode]"))
  b.onclick = () => {
    settings.mode = b.dataset.mode as Settings["mode"];
    syncSettings();
  };
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-series]"))
  b.onclick = () => {
    settings.tables = [...SERIES[b.dataset.series as SeriesId].tables];
    syncSettings();
  };
$("#sound").onclick = () => {
  settings.sound = !settings.sound;
  void audio.unlock().catch(() => {});
  syncSettings();
};
$("#fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    $("#fullscreen").hidden = true;
  }
};
function screen() {
  const state = flight.state;
  $("#title").hidden = state !== "title";
  $("#hud").hidden = !["playing", "paused", "crashing"].includes(state);
  $("#pause-screen").hidden = state !== "paused";
  $("#results").hidden = state !== "results";
  $("#pause").hidden = !["playing", "paused"].includes(state);
  $("#finish").hidden = settings.mode !== "training";
  document.body.dataset.state = state;
}
function start() {
  if (!world.ready) return;
  void audio.unlock().catch(() => {});
  flight.start();
  partieCommence("neon", settings.difficulty, settings.mode === "arcade" ? "defi" : "tranquille");
  startedAt = Date.now();
  crashed = false;
  const from = Number(params.get("depart")) * 1000 || 0;
  flight.distance = Math.max(0, from);
  world.reset(false, flight.distance);
  input = "";
  shownScore = 0;
  lastPlace = "";
  recorded = false;
  crashTime = 0;
  screen();
  renderHud();
  (document.activeElement as HTMLElement)?.blur();
}
function home() {
  flight.state = "title";
  world.reset(true);
  screen();
  syncSettings();
}
$("#play").onclick = start;
$("#replay").onclick = start;
$("#home").onclick = home;
function pause() {
  flight.pause();
  // Le temps de jeu actif s'arrête pendant la pause.
  partiePause(flight.state === "paused");
  screen();
}
$("#pause").onclick = pause;
$("#resume").onclick = () => {
  void audio.unlock().catch(() => {});
  pause();
};
$("#quit").onclick = home;
document.addEventListener("visibilitychange", () => {
  if (document.hidden && flight.state === "playing") pause();
});
window.addEventListener("blur", () => {
  if (flight.state === "playing") pause();
});
function key(k: string) {
  if (flight.state !== "playing" || flight.cooldown > 0) return;
  if (/^\d$/.test(k)) {
    if (input.length < 3) input += k;
  } else if (k === "Backspace" || k === "⌫") input = input.slice(0, -1);
  else if (k === "Enter" || k === "↵") {
    if (input === "") return;
    const wasFever = flight.boost > 0;
    const good = flight.answer(Number(input));
    world.event(good, flight);
    if (good) {
      fx.good(flight);
      audio.good(flight.combo, flight.rating === "flash");
      if (!wasFever && flight.boost > 0) {
        fx.fever();
        audio.fever();
      }
    } else {
      fx.bad();
      audio.bad();
    }
    input = "";
  }
  renderHud();
}
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    pause();
    return;
  }
  if (
    flight.state === "playing" &&
    (/^[0-9]$/.test(e.key) || ["Enter", "Backspace"].includes(e.key))
  ) {
    e.preventDefault();
    if (!e.repeat) key(e.key);
  }
});
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-key]"))
  b.onclick = () => key(b.dataset.key!);
function finish() {
  flight.state = "results";
  const stars = starsFor(flight.distance);
  let isRecord = false;
  if (!recorded) {
    if (settings.mode === "arcade" && !essai) {
      const key = recordKey();
      isRecord = flight.score > (record.bests![key] ?? 0) && flight.score > 0;
      record.bests![key] = Math.max(record.bests![key] ?? 0, flight.score);
      record.best = Math.max(record.best, flight.score);
    }
    record.combo = Math.max(record.combo, flight.longest);
    for (const [n, s] of Object.entries(flight.stats.tables)) {
      const old = (record.tables[n] ??= { correct: 0, total: 0 });
      old.correct += s.correct;
      old.total += s.total;
    }
    save(RECORD_KEY, record);
    recorded = true;
    report(stars);
  }
  $("#stars").textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
  $("#stars").setAttribute("aria-label", `${stars} étoile${stars > 1 ? "s" : ""} sur 3 : ${["pas encore au village", "village atteint", "grande ville atteinte", "mégapole atteinte"][stars]}`);
  $("#stars").title = "★ village · ★★ grande ville · ★★★ mégapole";
  $("#result-label").textContent =
    settings.mode === "training"
      ? "ENTRAÎNEMENT TERMINÉ"
      : "CONTACT AVEC UN TOIT · FIN DU VOL";
  $("#result-title").textContent =
    flight.correct > 0
      ? "Chaque réponse te porte."
      : "Prêt pour un nouveau départ ?";
  $("#final-score").textContent = fmt(flight.score);
  $("#stats").innerHTML =
    `<div><strong>${flight.correct}/${flight.total}</strong><span>Bonnes réponses</span></div><div><strong>${flight.total ? Math.round((100 * flight.correct) / flight.total) : 0}%</strong><span>Précision</span></div><div><strong>${flight.longest}</strong><span>Meilleure série</span></div><div><strong>${flight.flashes} ⚡</strong><span>Réponses éclair</span></div><div><strong>${(flight.distance / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} km</strong><span>Distance</span></div><div><strong>${fmt(bestFor())}${isRecord ? " 🎉" : ""}</strong><span>${isRecord ? "Nouveau record !" : "Ton record"}</span></div>`;
  const tables = Object.entries(record.tables)
    .filter(([, s]) => s.total > 0)
    .sort((a, b) => b[1].correct / b[1].total - a[1].correct / a[1].total);
  $("#mastery").textContent = tables.length
    ? "Tes tables · " +
      tables
        .slice(0, 4)
        .map(
          ([n, s]) =>
            `${n} : ${Math.round((s.correct / s.total) * 100)}% (${s.total} essais)`,
        )
        .join("  /  ")
    : "Chaque vol est une occasion d’apprendre.";
  screen();
}
$("#finish").onclick = finish;
/** Envoie le résultat à Calcoolos ; une panne du serveur n'interrompt jamais le jeu. */
function report(stars: number) {
  const out = $("#outcome");
  if (essai) {
    out.textContent = "Vol d’essai (départ avancé) : non enregistré.";
    return;
  }
  out.textContent = "Enregistrement…";
  void reportResult({
    jeu: "neon",
    niveau: settings.difficulty,
    mode: settings.mode === "arcade" ? "defi" : "tranquille",
    variante: seriesOf(settings.tables),
    score: flight.score,
    gagne: stars > 0,
    etoiles: stars,
    duree: (Date.now() - startedAt) / 1000,
    precision: flight.total ? flight.correct / flight.total : 0,
    ops: { "×": [flight.correct, flight.total - flight.correct] },
    details: {
      distance: Math.round(flight.distance),
      altitude: Math.round(flight.maxAltitude),
      crash: crashed ? 1 : 0,
      eclairs: flight.flashes,
      arcenciel: flight.fevers,
      serie: flight.longest,
    },
    mesures: flight.releve.mesures(),
  })
    .then((o) => {
      out.textContent = outcomeText(o);
    })
    .catch(() => {
      out.textContent = "Résultat gardé sur cet appareil.";
    });
}
function renderHud() {
  // Le score défile jusqu'à sa valeur au lieu de sauter.
  shownScore += (flight.score - shownScore) * 0.18;
  if (Math.abs(flight.score - shownScore) < 2) shownScore = flight.score;
  $("#score").textContent = fmt(shownScore);
  const fever = flight.boost > 0;
  $("#combo").textContent = fever
    ? `MODE ARC-EN-CIEL · ${Math.ceil(flight.boost)} s`
    : flight.combo > 0
      ? `${flight.combo} d’affilée`
      : "";
  const mult = $("#mult");
  mult.textContent = `×${flight.multiplier * (fever ? 2 : 1)}`;
  mult.dataset.level = String(Math.min(6, flight.multiplier * (fever ? 2 : 1)));
  mult.style.setProperty("--h", String(flight.combo ? (flight.combo * 47) % 360 : 190));
  $("#heat-fill").style.width = (fever ? (flight.boost / 6) * 100 : flight.heat * 100) + "%";
  const place = placeAt(flight.distance);
  $("#stage").textContent = `${place.zone?.emoji ?? place.stage.emoji} ${place.zone?.name ?? place.stage.name}`;
  $("#distance").textContent = (flight.distance / 1000).toFixed(1).replace(".", ",") + " km";
  // Chaque nouvelle étape du voyage est annoncée.
  if (place.key !== lastPlace) {
    if (lastPlace) fx.stage(place.zone?.emoji ?? place.stage.emoji, place.zone?.name ?? place.stage.name);
    lastPlace = place.key;
  }
  $("#alt").innerHTML = `${Math.round(flight.altitude)} <small>M</small>`;
  $("#alt-fill").style.height = (flight.altitude / CEILING) * 100 + "%";
  const danger = flight.altitude < dangerAltitude(flight.distance);
  const sinking = flight.vario < -0.3;
  $("#altitude").classList.toggle("danger", danger);
  $("#alt-label").textContent = danger ? "ATTENTION AUX TOITS" : "";
  const vario = $("#vario");
  vario.textContent = `${flight.vario < 0 ? "▼" : "▲"} ${Math.abs(flight.vario).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m/s`;
  vario.classList.toggle("up", flight.vario >= 0);
  $("#equation").textContent = `${flight.a} × ${flight.b}`;
  $("#answer").textContent = input || "?";
  $("#time-fill").style.width = (flight.remaining / flight.limit) * 100 + "%";
  $("#time-fill").classList.toggle("urgent", flight.remaining < 3);
  $("#time-fill").classList.toggle("combo", flight.cooldown <= 0 && flight.limit - flight.remaining <= COMBO_TIME);
  $("#seconds").textContent = Math.ceil(flight.remaining) + " s";
  const wrong = flight.correctionTime > 0;
  $("#feedback").textContent = wrong
    ? flight.correction
    : flight.cooldown > 0
      ? flight.feedback
      : sinking && flight.limit - flight.remaining > 3
        ? "▼ Réponds pour remonter"
        : flight.total === 0
          ? "Tape ta réponse · Entrée pour valider"
          : "";
  $(".question").dataset.result = wrong ? "bad" : flight.cooldown > 0 ? flight.result : "";
  $(".question").dataset.rating = flight.cooldown > 0 ? flight.rating : "";
  $("#question-label").textContent = settings.mode === "training" ? "ENTRAÎNEMENT" : "";
  $("#event").textContent = fever ? "" : danger ? "⚠ ALTITUDE CRITIQUE ⚠" : "";
  $("#event").classList.toggle("alarm", !fever && danger);
}
syncSettings();
screen();
try {
  await world.init($("#world"), settings.quality);
  $("#play").removeAttribute("disabled");
  $("#play").textContent = "JOUER  ↗";
  world.engine.runRenderLoop(() => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 1);
    last = now;
    if (document.hidden) return;
    const prevTotal = flight.total;
    flight.tick(dt);
    if (flight.total > prevTotal && flight.result === "bad") {
      audio.bad();
      world.event(false);
      fx.bad();
      input = "";
    }
    fx.update(dt, flight);
    const hit = world.update(flight.state === "paused" ? 0 : dt, flight);
    if (hit && flight.state === "playing") {
      crashed = settings.mode === "arcade";
      flight.crash();
      world.explode();
      audio.crash();
      screen();
    }
    if (flight.state === "crashing") {
      crashTime += dt;
      if (crashTime > 2.6) finish();
    }
    audio.update(
      dt,
      flight.state === "playing",
      flight.boost > 0,
      flight.altitude < dangerAltitude(flight.distance),
    );
    if (flight.state === "playing") renderHud();
  });
} catch (e) {
  console.error(e);
  $("#play").textContent = "3D indisponible";
  $(".hint").textContent =
    "Active l’accélération graphique de ton navigateur, puis recharge cette page.";
}
/** Crochets de test (scripts Playwright), comme les autres jeux : window.__neon. */
Object.assign(window, {
  __neon: {
    ready: () => world.ready,
    start: (mode: Settings["mode"] = settings.mode) => {
      settings.mode = mode;
      syncSettings();
      start();
    },
    answer: () => {
      if (flight.state !== "playing" || flight.cooldown > 0) return false;
      for (const k of String(flight.a * flight.b)) key(k);
      key("Enter");
      return true;
    },
    wrong: () => {
      if (flight.state !== "playing" || flight.cooldown > 0) return false;
      for (const k of String(flight.a * flight.b + 1)) key(k);
      key("Enter");
      return true;
    },
    finish,
    pause,
    state: () => ({ state: flight.state, score: flight.score, correct: flight.correct, total: flight.total, distance: flight.distance, altitude: flight.altitude, combo: flight.combo }),
    outcome: () => $("#outcome").textContent,
  },
});
window.addEventListener(
  "pagehide",
  (event) => {
    if (!event.persisted) {
      world.dispose();
      void audio.ctx?.close();
    }
  },
);
