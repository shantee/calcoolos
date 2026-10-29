import { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { Engine } from "@babylonjs/core/Engines/engine";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { Scene } from "@babylonjs/core/scene";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import "@babylonjs/core/Particles/particleSystemComponent";
import "@babylonjs/core/Meshes/instancedMesh";
import { ImportMeshAsync } from "@babylonjs/core/Loading/sceneLoader";
import type { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import "@babylonjs/loaders/glTF/2.0";
import shuttleUrl from "./assets/shuttle.glb?url";
import type { Flight, Quality } from "./model";
import { hitsRoof } from "./collision";
import { CHUNK, Land, type Chunk } from "./land";
import { STAGES, dangerAltitude, placeAt, type Place } from "./stages";
const C = (s: string) => Color3.FromHexString(s);
/** Le décor d'accueil montre la destination : la mégapole. */
const TITLE_INDEX = Math.ceil(STAGES[STAGES.length - 1].from / CHUNK) + 1;
const SLOTS = 8;
/** Longueur de la navette (m) ; SHIP_FLIP si le modèle arrive nez vers l'arrière. */
const SHIP_LENGTH = 22;
const SHIP_FLIP = true;
export class World {
  engine!: AbstractEngine;
  scene!: Scene;
  camera!: FreeCamera;
  light!: HemisphericLight;
  ship!: TransformNode;
  land!: Land;
  chunks: Chunk[] = [];
  flames: TransformNode[] = [];
  boosters: ParticleSystem[] = [];
  hullMats: PBRMaterial[] = [];
  shipSize = { w: 12, h: 6, rear: -10 };
  particles: { mesh: Mesh; v: Vector3 }[] = [];
  pipeline!: DefaultRenderingPipeline;
  glow!: GlowLayer;
  shock!: Mesh;
  shockMat!: StandardMaterial;
  trails: Mesh[] = [];
  trailMat!: StandardMaterial;
  trailHistory: number[] = Array(25).fill(100);
  neonMats: { mat: StandardMaterial; base: Color3; hue: number }[] = [];
  nightOnly: Mesh[] = [];
  ground!: Mesh;
  avenue: Mesh[] = [];
  burst!: ParticleSystem;
  stream!: ParticleSystem;
  burstOrigin = new Vector3(0, 100, 0);
  streamOrigin = new Vector3(0, 100, -12);
  lightsMat!: StandardMaterial;
  time = 0;
  impact = 0;
  pulse = 0;
  flash = 0;
  hue = 0;
  quality: Quality = "high";
  ready = false;
  disposed = false;
  async init(canvas: HTMLCanvasElement, quality: Quality) {
    let gpu: WebGPUEngine | undefined;
    try {
      if (
        !new URLSearchParams(location.search).has("webgl") &&
        (await WebGPUEngine.IsSupportedAsync)
      ) {
        gpu = new WebGPUEngine(canvas, { antialias: true });
        await gpu.initAsync();
        this.engine = gpu;
      }
    } catch {
      gpu?.dispose();
    }
    this.engine ??= new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.018, 0.025, 0.075, 1);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.0019;
    this.scene.fogColor = C("#17213d");
    this.camera = new FreeCamera("chase", new Vector3(0, 110, -43), this.scene);
    this.camera.minZ = 0.5;
    this.camera.maxZ = 2400;
    this.camera.fov = 0.95;
    this.light = new HemisphericLight(
      "sky light",
      new Vector3(0.2, 1, -0.3),
      this.scene,
    );
    this.light.intensity = 0.9;
    this.light.diffuse = C("#859bff");
    this.light.groundColor = C("#1c1637");
    this.pipeline = new DefaultRenderingPipeline("neon", true, this.scene, [
      this.camera,
    ]);
    this.pipeline.bloomEnabled = true;
    this.pipeline.bloomThreshold = 0.65;
    this.pipeline.bloomWeight = 0.35;
    this.pipeline.bloomKernel = 48;
    this.pipeline.fxaaEnabled = true;
    this.pipeline.chromaticAberrationEnabled = true;
    this.pipeline.chromaticAberration.aberrationAmount = 0;
    this.glow = new GlowLayer("reactor aura", this.scene, {
      blurKernelSize: 32,
    });
    this.glow.intensity = 0.5;
    this.land = new Land(this.scene, this.glow, (n, c, e) => this.neon(n, c, e));
    this.buildSky();
    for (let j = 0; j < SLOTS; j++) {
      const root = new TransformNode("district " + j, this.scene);
      this.chunks.push({ root, index: 0, place: placeAt(0), roofs: [], cars: [], bobbers: [], rotors: [] });
    }
    await this.buildShip();
    this.buildParticles();
    this.setQuality(quality);
    this.reset(true);
    this.ready = true;
    window.addEventListener("resize", this.resize);
    document.addEventListener("fullscreenchange", this.resize);
  }
  resize = () => this.engine?.resize();
  mat(name: string, color: string, emission = 0) {
    const m = new StandardMaterial(name, this.scene);
    m.diffuseColor = C(color);
    m.emissiveColor = C(color).scale(emission);
    m.specularColor = C("#6885ad").scale(0.3);
    return m;
  }
  /** Matériau néon dont la teinte s'emballe en mode arc-en-ciel. */
  neon(name: string, color: string, emission: number) {
    const m = this.mat(name, color, emission);
    this.neonMats.push({
      mat: m,
      base: m.emissiveColor.clone(),
      hue: this.neonMats.length * 47,
    });
    return m;
  }
  box(
    name: string,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: StandardMaterial,
    parent?: TransformNode,
  ) {
    const m = MeshBuilder.CreateBox(
      name,
      { width: w, height: h, depth: d },
      this.scene,
    );
    m.position.set(x, y, z);
    m.material = mat;
    if (parent) m.parent = parent;
    return m;
  }
  buildSky() {
    const sky = new DynamicTexture(
      "original sunset",
      { width: 1024, height: 1024 },
      this.scene,
      false,
    );
    const ctx = sky.getContext();
    const grad = ctx.createLinearGradient(0, 0, 0, 1024);
    grad.addColorStop(0, "#ffda8b");
    grad.addColorStop(0.4, "#ff8067");
    grad.addColorStop(1, "#f12b85");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);
    for (let y = 530; y < 1024; y += 50) {
      ctx.clearRect(0, y, 1024, 10 + (y - 530) / 25);
    }
    sky.update();
    const sm = this.mat("solar disc", "#ffffff", 1);
    sm.diffuseTexture = sky;
    sm.emissiveTexture = sky;
    sm.opacityTexture = sky;
    sm.disableLighting = true;
    sm.backFaceCulling = false;
    const sun = MeshBuilder.CreateDisc(
      "striped sunset",
      { radius: 210, tessellation: 96 },
      this.scene,
    );
    sun.position.set(0, 310, 1500);
    sun.material = sm;
    sun.applyFog = false;
    // Planète annelée, lune et étoiles : seulement la nuit.
    const planet = MeshBuilder.CreateSphere("planet", { diameter: 150, segments: 24 }, this.scene);
    planet.position.set(-620, 560, 1700);
    planet.material = this.mat("planet", "#7d4dff", 0.55);
    planet.applyFog = false;
    const belt = MeshBuilder.CreateTorus("planet ring", { diameter: 260, thickness: 6, tessellation: 64 }, this.scene);
    belt.position.copyFrom(planet.position);
    belt.rotation.set(1.2, 0, 0.35);
    belt.material = this.neon("planet ring", "#ffb3f0", 0.9);
    belt.applyFog = false;
    const moon = MeshBuilder.CreateSphere("moon", { diameter: 60, segments: 16 }, this.scene);
    moon.position.set(560, 640, 1600);
    moon.material = this.mat("moon", "#bff8ff", 0.9);
    moon.applyFog = false;
    const starmat = this.mat("stars", "#9bbdf5", 1);
    const source = MeshBuilder.CreateSphere(
      "star",
      { diameter: 1.2, segments: 3 },
      this.scene,
    );
    source.material = starmat;
    source.isVisible = false;
    for (let i = 0; i < 220; i++) {
      const s = source.createInstance("star");
      s.position.set(
        (Math.random() - 0.5) * 2400,
        220 + Math.random() * 750,
        500 + Math.random() * 1100,
      );
    }
    this.nightOnly.push(planet, belt, moon, source);
    this.ground = this.box("ground", 2500, 1, 2400, 0, -1.2, 850, this.mat("far ground", "#070f22"));
    const gridmat = this.neon("avenue light", "#177b98", 0.75);
    for (let x = -700; x <= 700; x += 70)
      this.avenue.push(this.box("infinite avenue", 1, 0.15, 2100, x, 0.4, 700, gridmat));
  }
  /** Navette spatiale (modèle glTF) avec trois réacteurs et feux de position. */
  async buildShip() {
    this.ship = new TransformNode("space shuttle", this.scene);
    this.lightsMat = this.mat("running lights", "#ff569f", 3);
    const model = new TransformNode("shuttle model", this.scene);
    model.parent = this.ship;
    const loaded = await ImportMeshAsync(shuttleUrl, this.scene, { pluginExtension: ".glb" });
    const root = loaded.meshes[0];
    root.parent = model;
    for (const m of loaded.meshes) {
      const mat = m.material as PBRMaterial | null;
      if (mat && "emissiveColor" in mat) {
        // Sans carte d'environnement, le PBR est terne : on renforce la lumière directe.
        mat.directIntensity = 1.8;
        mat.environmentIntensity = 0;
        this.hullMats.push(mat);
      }
    }
    // Mise à l'échelle : la navette mesure SHIP_LENGTH m, nez vers +z, centrée.
    let { min, max } = root.getHierarchyBoundingVectors(true);
    if (max.x - min.x > max.z - min.z) model.rotation.y = Math.PI / 2;
    model.computeWorldMatrix(true);
    ({ min, max } = root.getHierarchyBoundingVectors(true));
    const scale = SHIP_LENGTH / (max.z - min.z);
    model.scaling.setAll(scale);
    if (SHIP_FLIP) model.rotation.y += Math.PI;
    model.computeWorldMatrix(true);
    ({ min, max } = root.getHierarchyBoundingVectors(true));
    model.position.set(-(min.x + max.x) / 2, -(min.y + max.y) / 2, -(min.z + max.z) / 2);
    const w = max.x - min.x,
      h = max.y - min.y,
      rear = -(max.z - min.z) / 2;
    this.shipSize = { w, h, rear };
    // Trois tuyères à l'arrière : flamme bleutée au cœur, enveloppe orange.
    const core = this.mat("booster core", "#bfe8ff", 3);
    const outer = this.mat("booster fire", "#ff7a1a", 2.4);
    outer.alpha = 0.55;
    outer.backFaceCulling = false;
    for (const [ex, ey] of [[0, h * 0.18], [-w * 0.09, -h * 0.05], [w * 0.09, -h * 0.05]]) {
      const nozzle = new TransformNode("nozzle", this.scene);
      nozzle.parent = this.ship;
      nozzle.position.set(ex, ey, rear);
      const fire = MeshBuilder.CreateCylinder("booster fire", { height: 1, diameterTop: 1, diameterBottom: 0, tessellation: 16 }, this.scene);
      fire.rotation.x = Math.PI / 2;
      fire.bakeCurrentTransformIntoVertices();
      fire.position.z = -0.5;
      fire.parent = nozzle;
      fire.material = outer;
      const flame = MeshBuilder.CreateCylinder("booster core", { height: 1, diameterTop: 0.55, diameterBottom: 0, tessellation: 12 }, this.scene);
      flame.rotation.x = Math.PI / 2;
      flame.bakeCurrentTransformIntoVertices();
      flame.position.z = -0.5;
      flame.parent = nozzle;
      flame.material = core;
      this.flames.push(nozzle);
    }
    for (const x of [-w / 2, w / 2]) this.box("wing light", 0.8, 0.3, 0.8, x * 0.97, -h * 0.25, rear * 0.6, this.lightsMat, this.ship);
    this.shock = MeshBuilder.CreateTorus(
      "energy shockwave",
      { diameter: 10, thickness: 0.12, tessellation: 64 },
      this.scene,
    );
    this.shockMat = this.mat("shock cyan", "#70ffef", 2);
    this.shock.material = this.shockMat;
    this.shock.setEnabled(false);
    this.trailMat = this.mat("ion trails", "#fa5ba7", 1.4);
    this.trailMat.alpha = 0.45;
    this.trailMat.backFaceCulling = false;
    for (const x of [-4, 4]) {
      const paths = [-1, 1].map((side) =>
        Array.from(
          { length: 25 },
          (_, i) =>
            new Vector3(x + side * (1 - i / 25) * 0.45, 100, -7 - i * 2),
        ),
      );
      const trail = MeshBuilder.CreateRibbon(
        "ion ribbon",
        { pathArray: paths, updatable: true },
        this.scene,
      );
      trail.material = this.trailMat;
      this.trails.push(trail);
    }
    const particlemat = this.mat("impact sparks", "#a6fff0", 3);
    for (let i = 0; i < 90; i++) {
      const p = MeshBuilder.CreateBox("spark", { size: 0.7 }, this.scene);
      p.material = particlemat;
      p.setEnabled(false);
      this.particles.push({
        mesh: p,
        v: new Vector3(
          (Math.random() - 0.5) * 65,
          (Math.random() - 0.15) * 65,
          (Math.random() - 0.5) * 65,
        ),
      });
    }
  }
  /** Gerbes d'étincelles arc-en-ciel (réussites) et traînée continue (mode arc-en-ciel). */
  buildParticles() {
    const tex = new DynamicTexture("sparkle", { width: 64, height: 64 }, this.scene, false);
    const c = tex.getContext() as CanvasRenderingContext2D;
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.25, "#ffffffcc");
    g.addColorStop(1, "#ffffff00");
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    c.fillStyle = "#ffffff";
    c.fillRect(30, 2, 4, 60);
    c.fillRect(2, 30, 60, 4);
    tex.hasAlpha = true;
    tex.update();
    const rainbow = (ps: ParticleSystem) => {
      const stops = [
        ["#ff3b6b", "#ffb13b"],
        ["#ffee3b", "#5bff6b"],
        ["#3bf0ff", "#3b7bff"],
        ["#a23bff", "#ff3bd8"],
      ];
      stops.forEach(([a, b], i) =>
        ps.addColorGradient(i / 3, Color4.FromHexString(a + "ff"), Color4.FromHexString(b + "ff")),
      );
      ps.addColorGradient(1, new Color4(1, 0.3, 0.9, 0));
      ps.particleTexture = tex;
      ps.blendMode = ParticleSystem.BLENDMODE_ADD;
      ps.emitter = this.burstOrigin;
    };
    this.burst = new ParticleSystem("rainbow burst", 1600, this.scene);
    rainbow(this.burst);
    this.burst.createSphereEmitter(4, 1);
    this.burst.minSize = 0.4;
    this.burst.maxSize = 1.3;
    this.burst.minLifeTime = 0.4;
    this.burst.maxLifeTime = 1.1;
    this.burst.minEmitPower = 18;
    this.burst.maxEmitPower = 55;
    this.burst.gravity = new Vector3(0, -14, 30);
    this.burst.emitRate = 0;
    this.burst.updateSpeed = 0.016;
    this.burst.start();
    for (const n of this.flames) {
      const b = new ParticleSystem("booster fire", 400, this.scene);
      b.particleTexture = tex;
      b.blendMode = ParticleSystem.BLENDMODE_ADD;
      b.emitter = n.getChildMeshes()[1];
      b.minEmitBox = b.maxEmitBox = Vector3.Zero();
      b.direction1 = new Vector3(-0.15, -0.15, -1);
      b.direction2 = new Vector3(0.15, 0.15, -1);
      b.addColorGradient(0, Color4.FromHexString("#fff4d0ff"));
      b.addColorGradient(0.3, Color4.FromHexString("#ffb13bff"));
      b.addColorGradient(0.7, Color4.FromHexString("#ff3b6bcc"));
      b.addColorGradient(1, new Color4(0.4, 0.1, 0.5, 0));
      b.minSize = 0.5;
      b.maxSize = 1.6;
      b.addSizeGradient(0, 0.6);
      b.addSizeGradient(1, 2.2);
      b.minLifeTime = 0.12;
      b.maxLifeTime = 0.3;
      b.start();
      this.boosters.push(b);
    }
    this.stream = new ParticleSystem("rainbow stream", 1200, this.scene);
    rainbow(this.stream);
    this.stream.createConeEmitter(2, 0.5);
    this.stream.minSize = 0.25;
    this.stream.maxSize = 0.7;
    this.stream.minLifeTime = 0.2;
    this.stream.maxLifeTime = 0.45;
    this.stream.minEmitPower = 5;
    this.stream.maxEmitPower = 15;
    this.stream.gravity = new Vector3(0, 0, -60);
    this.stream.emitRate = 0;
    this.stream.start();
  }
  setQuality(q: Quality) {
    this.quality = q;
    this.engine.setHardwareScalingLevel(
      q === "low"
        ? 1.8
        : q === "medium"
          ? 1.25
          : 1 / Math.min(devicePixelRatio, 1.5),
    );
    this.pipeline.bloomEnabled = q !== "low";
    this.glow.isEnabled = q !== "low";
    this.pipeline.bloomWeight = q === "high" ? 0.35 : 0.2;
    this.land.far = q !== "low";
    for (const c of this.chunks)
      for (const m of c.root.getChildMeshes())
        if (Math.abs(m.position.x) > 200) m.setEnabled(q !== "low");
    this.engine.resize();
  }
  event(good: boolean, f?: Flight) {
    this.pulse = good ? 1 : -1;
    if (!good) return;
    const combo = f?.combo ?? 1;
    this.hue = (this.hue + 50) % 360;
    this.shockMat.emissiveColor = Color3.FromHSV(this.hue, 0.7, 1).scale(2);
    this.shock.position.copyFrom(this.ship.position);
    this.shock.scaling.setAll(1);
    this.shock.setEnabled(true);
    this.flash = Math.min(1.5, 0.5 + combo * 0.08) * (f?.rating === "flash" ? 1.4 : 1);
    this.burstOrigin.copyFrom(this.ship.position);
    this.burst.manualEmitCount = Math.min(380, 80 + combo * 25 + (f?.rating === "flash" ? 80 : 0));
  }
  explode() {
    this.shock.position.copyFrom(this.ship.position);
    this.shock.scaling.setAll(1);
    this.shock.setEnabled(true);
    this.impact = 2.6;
    this.ship.setEnabled(false);
    for (const p of this.particles) {
      p.mesh.position.copyFrom(this.ship.position);
      p.mesh.scaling.setAll(1);
      p.mesh.setEnabled(true);
    }
  }
  /** Reconstruit les 8 tronçons : départ en forêt, ou mégapole pour l'accueil. */
  reset(title = false, from = 0) {
    this.ship.setEnabled(true);
    this.impact = 0;
    this.shock.setEnabled(false);
    this.trailHistory.fill(100);
    const first = title ? TITLE_INDEX : Math.floor(from / CHUNK);
    this.chunks.forEach((c, i) => {
      c.root.position.z = i * CHUNK;
      this.land.fill(c, first + i);
    });
    this.particles.forEach((p) => p.mesh.setEnabled(false));
  }
  /** Ambiance (ciel, brouillard, lumière) interpolée entre les étapes. */
  ambience(distance: number, fever: boolean, t: number) {
    const place = placeAt(distance);
    const next = STAGES[place.index + 1];
    const blend = next ? Math.max(0, Math.min(1, (distance - (next.from - 500)) / 500)) : 0;
    const look = (p: Place | undefined, s = p?.stage ?? next!) => ({
      fog: C(p?.zone?.fog ?? s.fog),
      sky: C(p?.zone?.sky ?? s.sky),
      ground: C(s.ground),
      light: C(s.light),
      intensity: s.lightIntensity,
      density: s.fogDensity,
      night: s.night,
    });
    const a = look(place),
      b = next ? look(undefined, next) : a;
    const fog = Color3.Lerp(a.fog, b.fog, blend);
    const sky = Color3.Lerp(a.sky, b.sky, blend);
    const night = a.night + (b.night - a.night) * blend;
    if (fever) fog.addInPlace(Color3.FromHSV((t * 120) % 360, 0.6, 0.35).scale(0.5));
    this.scene.fogColor = fog;
    this.scene.fogDensity = a.density + (b.density - a.density) * blend;
    this.scene.clearColor.set(sky.r, sky.g, sky.b, 1);
    this.light.diffuse = Color3.Lerp(a.light, b.light, blend);
    this.light.intensity = a.intensity + (b.intensity - a.intensity) * blend;
    this.light.groundColor = Color3.Lerp(C("#6a6a5a"), C("#1c1637"), night);
    (this.ground.material as StandardMaterial).diffuseColor = Color3.Lerp(a.ground, b.ground, blend);
    for (const m of this.nightOnly) m.visibility = Math.max(0, night * 1.4 - 0.4);
    for (const m of this.avenue) m.setEnabled(night > 0.7);
    // De jour, l'éclat est réservé aux effets : l'avion ne doit pas être éblouissant.
    this.pipeline.bloomThreshold = 0.92 - 0.27 * night;
    return { place, night };
  }
  update(dt: number, f: Flight) {
    this.time += dt;
    const playing = f.state === "playing",
      title = f.state === "title",
      moving = playing || title || f.state === "crashing";
    const fever = f.boost > 0 && playing;
    const speed = title ? 28 : f.speed;
    let hit = false;
    if (moving)
      for (const c of this.chunks) {
        const prev = c.root.position.z;
        c.root.position.z -= speed * dt * (f.state === "crashing" ? 0.15 : 1);
        if (playing && f.settings.mode === "arcade")
          for (const r of c.roofs) {
            if (hitsRoof(prev, c.root.position.z, r, f.altitude)) hit = true;
          }
        if (c.root.position.z < -CHUNK) {
          c.root.position.z += CHUNK * SLOTS;
          this.land.fill(c, c.index + SLOTS);
        }
      }
    const t = this.time;
    for (const c of this.chunks) {
      for (const car of c.cars)
        car.node.position.x = (((t * car.speed + car.phase) % car.span) + car.span) % car.span - car.span / 2;
      for (const [i, b] of c.bobbers.entries()) b.position.y += Math.sin(t * 0.8 + i) * dt * 1.5;
      for (const r of c.rotors) r.rotation.z += dt * 1.6;
    }
    for (const a of this.land.adMats) {
      if (a.ticker) a.tex.uOffset = (t * 0.05 + a.phase) % 1;
      a.tex.level =
        a.flicker && Math.sin(t * 13 + a.phase) * Math.sin(t * 3.1 + a.phase * 2) > 1 - a.flicker
          ? 0.25
          : fever
            ? 0.9 + Math.sin(t * 8 + a.phase) * 0.15
            : 0.95;
    }
    // Habitants des grandes fenêtres : deux images qui alternent (coucou, danse).
    for (const p of this.land.people) p.tex.uOffset = Math.floor(t * 2.4 + p.phase) % 2 ? 0.5 : 0;
    // Néons : couleurs d'origine, ou arc-en-ciel qui tourne en mode fièvre.
    const glowBoost = 1 + this.flash * 0.4;
    for (const n of this.neonMats) {
      if (fever) n.mat.emissiveColor = Color3.FromHSV((n.hue + t * 240) % 360, 0.85, 1).scale(1.25);
      else n.mat.emissiveColor = n.base.scale(glowBoost);
    }
    this.trailMat.emissiveColor = Color3.FromHSV((t * (fever ? 400 : 40)) % 360, 0.7, 1).scale(1.6);
    const night = this.ambience(title ? TITLE_INDEX * CHUNK : f.distance, fever, t).night;
    const alt = title ? 105 + Math.sin(this.time * 0.2) * 10 : f.altitude;
    const roll = fever ? Math.sin(t * 3) * 0.25 : Math.sin(t * 0.7) * -0.04;
    this.ship.position.set(
      Math.sin(this.time * 0.7) * (fever ? 4 : 1.5),
      alt + Math.sin(this.time * 2) * 0.25,
      0,
    );
    this.ship.rotation.z = roll;
    // Nez vers le bas pendant la descente, vers le haut quand on remonte.
    const pitch = title ? 0 : Math.max(-0.35, Math.min(0.3, -f.vario * 0.03));
    this.ship.rotation.x += (pitch - this.ship.rotation.x) * (1 - Math.exp(-dt * 4));
    // Réacteurs : flammes qui vacillent et s'allongent avec la vitesse.
    const thrust = (fever ? 1.8 : 1 + (f.speed - 55) / 90) + this.pulse * 0.7;
    const d = this.shipSize.w * 0.075;
    this.flames.forEach((n, i) => {
      const flicker = 1 + Math.sin(t * 37 + i * 2) * 0.08 + Math.sin(t * 61 + i) * 0.05;
      n.scaling.set(d * flicker, d * flicker, 7 * thrust * flicker);
    });
    for (const b of this.boosters) {
      b.emitRate = this.ship.isEnabled() ? 70 + 60 * thrust : 0;
      b.minEmitPower = 20 + f.speed * 0.3;
      b.maxEmitPower = 30 + f.speed * 0.5;
    }
    // Feux d'aile : rouges et clignotants près des toits.
    const danger = playing && f.altitude < dangerAltitude(f.distance);
    this.lightsMat.emissiveColor =
      danger && Math.sin(t * 14) > 0
        ? C("#ff2a2a").scale(3)
        : fever
          ? Color3.FromHSV((t * 500) % 360, 0.8, 1).scale(3)
          : C("#ff569f").scale(3);
    for (const m of this.hullMats) m.emissiveColor = fever ? Color3.FromHSV((t * 200) % 360, 0.5, 1) : Color3.White();
    this.pulse *= Math.exp(-dt * 4);
    this.flash *= Math.exp(-dt * 3);
    const shake =
      this.pulse < 0 ? Math.sin(this.time * 90) * this.pulse * 0.5 : 0;
    // Caméra qui flotte doucement autour de la navette, le regard toujours vers l'avant.
    const swayX = title ? Math.sin(t * 0.25) * 18 : Math.sin(t * 0.23) * 12 + Math.sin(t * 0.09) * 6;
    const swayY = Math.sin(t * 0.17) * 4 + Math.sin(t * 0.41) * 1.5;
    this.camera.position.set(shake + swayX, alt + 13 + swayY, -48 + Math.sin(t * 0.13) * 5);
    this.camera.setTarget(new Vector3(swayX * 0.2, alt - (window.innerWidth < 760 ? 42 : 20) + swayY * 0.3, 100));
    const fov = fever ? 1.18 : 0.95 + Math.min(0.12, (f.speed - 55) / 400);
    this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-dt * 2));
    if (this.quality !== "low") {
      this.pipeline.bloomWeight = (this.quality === "high" ? 0.35 : 0.2) * (0.5 + night * 0.5) + this.flash * 0.12 + (fever ? 0.08 : 0);
      this.glow.intensity = 0.15 + 0.35 * night + this.flash * 0.25 + (fever ? 0.15 : 0);
    }
    this.pipeline.chromaticAberration.aberrationAmount = fever ? 6 + Math.sin(t * 6) * 4 : this.flash * 5;
    this.burstOrigin.copyFrom(this.ship.position);
    this.stream.emitter = this.streamOrigin.set(this.ship.position.x, this.ship.position.y, this.ship.position.z - 12);
    this.stream.emitRate = fever ? 160 : 0;
    if (this.impact > 0) {
      this.impact -= dt;
      for (const p of this.particles) {
        p.mesh.position.addInPlace(p.v.scale(dt * 0.6));
        p.mesh.scaling.scaleInPlace(Math.exp(-dt * 0.5));
      }
      this.camera.position.x += Math.sin(this.time * 50) * this.impact * 0.35;
    }
    if (this.shock.isEnabled()) {
      this.shock.scaling.addInPlace(new Vector3(dt * 22, dt * 22, dt * 22));
      this.shock.visibility = Math.exp(-this.shock.scaling.x * 0.15);
      if (this.shock.scaling.x > 35) this.shock.setEnabled(false);
    }
    if (dt > 0) {
      this.trailHistory.unshift(alt);
      this.trailHistory.pop();
    }
    this.trails.forEach((trail, k) => {
      trail.setEnabled(this.ship.isEnabled());
      const x = (k === 0 ? -1 : 1) * this.shipSize.w * 0.09;
      const paths = [-1, 1].map((side) =>
        this.trailHistory.map(
          (y, i) =>
            new Vector3(
              x + side * (1 - i / 25) * (fever ? 1.4 : 0.45),
              y - this.shipSize.h * 0.05,
              this.shipSize.rear - 2 - i * (fever ? 3.5 : 2 + (f.speed - 55) / 70),
            ),
        ),
      );
      MeshBuilder.CreateRibbon(
        "ion ribbon",
        { pathArray: paths, instance: trail },
        this.scene,
      );
    });
    this.scene.render();
    return hit;
  }
  dispose() {
    this.disposed = true;
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("fullscreenchange", this.resize);
    this.scene.dispose();
    this.engine.dispose();
  }
}
