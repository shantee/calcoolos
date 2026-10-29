/** Paysages du voyage : chaque tronçon de 240 m est reconstruit selon l'étape atteinte. */
import { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import type { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { ADS, paintAd, paintPeople, paintSmiley, type Ad } from "./ads";
import { placeAt, type Place } from "./stages";

export const CHUNK = 240;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const chance = (p: number) => Math.random() < p;
const hsl = (h: number, s = 85, l = 60) => Color3.FromHSV(((h % 360) + 360) % 360, s / 100, l / 100).toHexString();
/** Néons de la grande ville (avant les zones de couleur). */
const NEON = ["#21dceb", "#f34494", "#ffd23f", "#9d4dff", "#3dff8b", "#ff7b2e"];
const FACADES = [
  ["#12223c", "#41b8cc"],
  ["#171c35", "#b473bb"],
  ["#0c2435", "#5d9bb7"],
  ["#22132f", "#ff6fb5"],
  ["#1d1a14", "#ffc95c"],
  ["#0d2a22", "#4dffb0"],
];
const WIDE = ADS.filter((a) => a.shape === "wide" || a.shape === "square");
const TALL = ADS.filter((a) => a.shape === "tall");
const TICKERS = ADS.filter((a) => a.shape === "ticker");

export interface Roof {
  z: number;
  height: number;
  depth: number;
}
export interface Chunk {
  root: TransformNode;
  index: number;
  place: Place;
  roofs: Roof[];
  /** Véhicules qui traversent l'avenue (axe x). */
  cars: { node: TransformNode; speed: number; phase: number; span: number }[];
  bobbers: TransformNode[];
  rotors: TransformNode[];
}
type Make = () => Mesh;

export class Land {
  far = true;
  adMats: { tex: DynamicTexture; flicker: number; phase: number; ticker: boolean }[] = [];
  people: { tex: DynamicTexture; phase: number }[] = [];
  private templates = new Map<string, Mesh>();
  private mats = new Map<string, StandardMaterial>();
  private neons = new Map<string, StandardMaterial>();
  private textures = new Map<string, DynamicTexture>();
  private ads = new Map<Ad, Mesh>();
  private vc: StandardMaterial;
  constructor(
    private scene: Scene,
    private glow: GlowLayer,
    private neonFactory: (name: string, color: string, emission: number) => StandardMaterial,
  ) {
    this.vc = new StandardMaterial("vertex colors", scene);
    this.vc.specularColor = Color3.Black();
  }

  // ---------- Outils ----------
  mat(color: string, emission = 0, tex?: DynamicTexture) {
    const key = color + emission + (tex?.name ?? "");
    let m = this.mats.get(key);
    if (!m) {
      m = new StandardMaterial("mat " + key, this.scene);
      m.diffuseColor = Color3.FromHexString(color);
      m.emissiveColor = Color3.FromHexString(color).scale(emission);
      m.specularColor = Color3.Black();
      if (tex) {
        m.diffuseTexture = tex;
        if (emission) m.emissiveTexture = tex;
      }
      this.mats.set(key, m);
    }
    return m;
  }
  neon(color: string, emission = 1.7) {
    let m = this.neons.get(color);
    if (!m) this.neons.set(color, (m = this.neonFactory("neon " + color, color, emission)));
    return m;
  }
  template(key: string, make: Make) {
    let t = this.templates.get(key);
    if (!t) {
      t = make();
      t.isVisible = false;
      t.name = key;
      this.templates.set(key, t);
    }
    return t;
  }
  /** Pose une instance ; la périphérie est omise en qualité Éco. */
  put(key: string, make: Make, parent: TransformNode, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, ry = 0): InstancedMesh | undefined {
    if (!this.far && Math.abs(x) > 200) return undefined;
    const i = this.template(key, make).createInstance(key);
    i.parent = parent;
    i.position.set(x, y, z);
    i.scaling.set(sx, sy, sz);
    i.rotation.y = ry;
    return i;
  }
  paint(m: Mesh, color: string) {
    const c = Color3.FromHexString(color);
    const n = m.getTotalVertices();
    const data = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) data.set([c.r, c.g, c.b, 1], i * 4);
    m.setVerticesData(VertexBuffer.ColorKind, data);
    return m;
  }
  part(kind: "box" | "cyl" | "sphere" | "cone", color: string, size: number[], at: number[], rot: number[] = [0, 0, 0]) {
    const s = this.scene;
    const [a, b = a, c = a] = size;
    const m =
      kind === "box"
        ? MeshBuilder.CreateBox("p", { width: a, height: b, depth: c }, s)
        : kind === "cyl"
          ? MeshBuilder.CreateCylinder("p", { diameter: a, height: b, tessellation: 10 }, s)
          : kind === "cone"
            ? MeshBuilder.CreateCylinder("p", { diameterBottom: a, diameterTop: 0, height: b, tessellation: 8 }, s)
            : MeshBuilder.CreateSphere("p", { diameterX: a, diameterY: b, diameterZ: c, segments: 6 }, s);
    m.position.set(at[0], at[1], at[2]);
    m.rotation.set(rot[0], rot[1], rot[2]);
    return this.paint(m, color);
  }
  /** Fusionne des pièces colorées en un seul modèle (un seul appel de dessin). */
  compose(parts: Mesh[], emission = 0) {
    const m = Mesh.MergeMeshes(parts, true, true)!;
    if (emission) {
      const e = new StandardMaterial("glowing vc", this.scene);
      e.emissiveColor = Color3.White().scale(emission * 0.35);
      e.specularColor = Color3.Black();
      m.material = e;
    } else m.material = this.vc;
    return m;
  }
  texture(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, wrap = true) {
    let t = this.textures.get(key);
    if (!t) {
      t = new DynamicTexture(key, { width: w, height: h }, this.scene, true);
      draw(t.getContext() as CanvasRenderingContext2D);
      t.update();
      if (wrap) t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
      this.textures.set(key, t);
    }
    return t;
  }

  // ---------- Textures ----------
  field(kind: number) {
    const looks = [
      ["#d9b84a", "#c79f34"], // blé
      ["#6b4a2e", "#55391f"], // labours
      ["#9a7ad8", "#5f9a4a"], // lavande
      ["#7fc24a", "#5ea338"], // jeunes pousses
      ["#f2df3a", "#bfae1f"], // colza
      ["#5ea338", "#f5c518"], // tournesols
    ];
    const [a, b] = looks[kind];
    return this.texture("field " + kind, 64, 64, (c) => {
      c.fillStyle = a;
      c.fillRect(0, 0, 64, 64);
      c.fillStyle = b;
      if (kind === 5) for (let i = 0; i < 40; i++) c.fillRect(Math.random() * 62, Math.random() * 62, 3, 3);
      else for (let y = 0; y < 64; y += 8) c.fillRect(0, y, 64, kind === 1 ? 4 : 3);
    });
  }
  dayFacade(k: number) {
    const [wall, glass] = [
      ["#efe6d2", "#5c7a96"],
      ["#b9553f", "#3d4f66"],
      ["#c9cdd3", "#6aa7d6"],
      ["#8fb4d9", "#e8f4ff"],
      ["#f2c98a", "#6a5a8a"],
    ][k];
    return this.texture("day facade " + k, 64, 128, (c) => {
      c.fillStyle = wall;
      c.fillRect(0, 0, 64, 128);
      c.fillStyle = glass;
      for (let x = 6; x < 64; x += 14) for (let y = 6; y < 128; y += 16) c.fillRect(x, y, 8, 9);
      // Quelques fenêtres déjà allumées au crépuscule.
      c.fillStyle = "#ffd98a";
      for (let i = 0; i < 6; i++) c.fillRect(6 + 14 * Math.floor(Math.random() * 4), 6 + 16 * Math.floor(Math.random() * 8), 8, 9);
    });
  }
  nightFacade(bg: string, lit: string) {
    return this.texture("night facade " + bg + lit, 128, 256, (c) => {
      c.fillStyle = bg;
      c.fillRect(0, 0, 128, 256);
      for (let x = 5; x < 128; x += 12)
        for (let y = 4; y < 256; y += 10) {
          c.fillStyle = Math.random() > 0.3 ? (Math.random() > 0.93 ? pick(["#ffe27a", "#ff7ad9", "#7affea"]) : lit) : "#1b3048";
          c.fillRect(x, y, 4, 3);
        }
    });
  }
  pitch() {
    return this.texture("pitch", 256, 160, (c) => {
      for (let i = 0; i < 8; i++) {
        c.fillStyle = i % 2 ? "#3f9a3a" : "#4caf45";
        c.fillRect(i * 32, 0, 32, 160);
      }
      c.strokeStyle = "#ffffff";
      c.lineWidth = 3;
      c.strokeRect(8, 8, 240, 144);
      c.beginPath();
      c.moveTo(128, 8);
      c.lineTo(128, 152);
      c.stroke();
      c.beginPath();
      c.arc(128, 80, 22, 0, Math.PI * 2);
      c.stroke();
      c.strokeRect(8, 50, 30, 60);
      c.strokeRect(218, 50, 30, 60);
    }, false);
  }

  // ---------- Modèles ----------
  conifer = () => this.compose([this.part("cyl", "#6b4423", [1.2, 3], [0, 1.5, 0]), this.part("cone", "#1f5a2e", [6.5, 11], [0, 8, 0])]);
  leafy = (color: string) => () => this.compose([this.part("cyl", "#6b4423", [1.2, 4], [0, 2, 0]), this.part("sphere", color, [7.5, 6.5, 7.5], [0, 7, 0])]);
  bush = () => this.compose([this.part("sphere", "#3f7f35", [4, 2.6, 4], [0, 1, 0])]);
  cow = () =>
    this.compose([
      this.part("box", "#f7f7f2", [4.2, 2.2, 2], [0, 2.6, 0]),
      this.part("box", "#1c1c1c", [1.4, 2.3, 2.1], [0.6, 2.6, 0]),
      this.part("box", "#1c1c1c", [1.3, 1.3, 1.3], [2.6, 3.2, 0]),
      this.part("box", "#ffb6c8", [0.6, 0.7, 1.1], [3.3, 2.8, 0]),
      ...[-1.5, 1.5].flatMap((x) => [-0.7, 0.7].map((z) => this.part("box", "#f7f7f2", [0.5, 1.5, 0.5], [x, 0.75, z]))),
    ]);
  sheep = () => this.compose([this.part("sphere", "#fbfbf5", [3.2, 2.4, 2.4], [0, 2, 0]), this.part("box", "#222", [1, 1, 1], [1.8, 2.4, 0])]);
  hay = () => this.compose([this.part("cyl", "#e6c35c", [2.6, 2.4], [0, 1.3, 0], [0, 0, Math.PI / 2])]);
  house = (wall: string, roof: string) => () =>
    this.compose([
      this.part("box", wall, [9, 5, 7], [0, 2.5, 0]),
      this.part("box", roof, [9.8, 0.5, 4.8], [0, 6.4, 1.75], [0.65, 0, 0]),
      this.part("box", roof, [9.8, 0.5, 4.8], [0, 6.4, -1.75], [-0.65, 0, 0]),
      this.part("box", "#5a3a2a", [1.2, 2.4, 0.2], [0, 1.2, -3.55]),
      this.part("box", "#8fd3ff", [1.4, 1.2, 0.2], [-2.8, 3, -3.55]),
      this.part("box", "#8fd3ff", [1.4, 1.2, 0.2], [2.8, 3, -3.55]),
      this.part("box", "#8a5a44", [1, 2.4, 1], [2.6, 7.2, 1]),
    ]);
  church = () =>
    this.compose([
      this.part("box", "#e3dccb", [10, 9, 22], [0, 4.5, 2]),
      this.part("box", "#5d6b7a", [6.5, 0.5, 23], [2.3, 10.8, 2], [0, 0, -0.7]),
      this.part("box", "#5d6b7a", [6.5, 0.5, 23], [-2.3, 10.8, 2], [0, 0, 0.7]),
      this.part("box", "#e3dccb", [6, 22, 6], [0, 11, -11]),
      this.part("cone", "#4a5a6a", [7, 12], [0, 28, -11]),
      this.part("cyl", "#ffd23f", [2.4, 0.3], [0, 17, -14.1], [Math.PI / 2, 0, 0]),
    ]);
  barn = (h: number) => () =>
    this.compose([
      this.part("box", "#b8322a", [29, h - 7, 38], [0, (h - 7) / 2, 0]),
      this.part("box", "#f4efe1", [10, 8, 0.4], [0, 5, -19.1]),
      this.part("box", "#5a4a42", [16.5, 0.8, 39], [7.3, h - 3.5, 0], [0, 0, -0.45]),
      this.part("box", "#5a4a42", [16.5, 0.8, 39], [-7.3, h - 3.5, 0], [0, 0, 0.45]),
    ]);
  silo = () => this.compose([this.part("cyl", "#cfd6dc", [7, 20], [0, 10, 0]), this.part("sphere", "#9aa6b2", [7, 4, 7], [0, 20, 0])]);
  mushroom = () =>
    this.compose([
      this.part("cyl", "#f4efe1", [2.4, 5], [0, 2.5, 0]),
      this.part("sphere", "#e8302a", [8, 4.5, 8], [0, 5.4, 0]),
      ...[0, 1.3, 2.6, 3.9, 5.2].map((a) => this.part("sphere", "#ffffff", [1.2, 0.8, 1.2], [Math.cos(a) * 2.6, 6.8, Math.sin(a) * 2.6])),
    ]);
  tractor = () =>
    this.compose([
      this.part("box", "#d8322a", [4, 2, 2.4], [0, 2, 0]),
      this.part("box", "#d8322a", [1.8, 2, 2.2], [-1, 3.8, 0]),
      this.part("cyl", "#222", [3, 0.8], [-1.2, 1.5, 1.4], [Math.PI / 2, 0, 0]),
      this.part("cyl", "#222", [3, 0.8], [-1.2, 1.5, -1.4], [Math.PI / 2, 0, 0]),
      this.part("cyl", "#222", [1.8, 0.6], [1.5, 0.9, 1.3], [Math.PI / 2, 0, 0]),
      this.part("cyl", "#222", [1.8, 0.6], [1.5, 0.9, -1.3], [Math.PI / 2, 0, 0]),
    ]);
  balloon = (color: string, band: string) => () =>
    this.compose([
      this.part("sphere", color, [11, 13, 11], [0, 9, 0]),
      this.part("cyl", band, [11.2, 2.4], [0, 9, 0]),
      this.part("cone", color, [6, 4], [0, 2.6, 0], [Math.PI, 0, 0]),
      this.part("box", "#8a5a2a", [1.8, 1.4, 1.8], [0, -0.5, 0]),
    ]);
  car = (color: string) => () =>
    this.compose([this.part("box", color, [4.4, 1.2, 2], [0, 0.9, 0]), this.part("box", "#bfe6ff", [2.2, 0.9, 1.8], [-0.2, 1.9, 0])]);
  castle = (h: number) => () =>
    this.compose([
      this.part("box", "#b9b2a4", [27, h - 4, 36], [0, (h - 4) / 2, 0]),
      ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => this.part("cyl", "#a79f90", [7, h], [sx * 11, h / 2, sz * 15]))),
      ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => this.part("cone", "#3d5f8a", [8, 7], [sx * 11, h + 3, sz * 15]))),
      ...Array.from({ length: 6 }, (_, i) => this.part("box", "#b9b2a4", [2.4, 2.4, 2.4], [-7 + i * 2.8, h - 2.8, -17])),
      this.part("box", "#5a3a2a", [6, 8, 0.4], [0, 4, -18.1]),
      this.part("box", "#e8302a", [3, 2, 0.2], [11, h + 8, 15]),
    ]);
  rock = (h: number) => () =>
    this.compose([
      this.part("box", "#7b6f63", [29, h - 1, 38], [0, (h - 1) / 2, 0]),
      this.part("box", "#4f8f3a", [29.4, 1.2, 38.4], [0, h - 0.6, 0]),
      this.part("box", "#8c8073", [8, h * 0.6, 10], [-12, h * 0.3, -16], [0, 0.4, 0]),
    ]);

  // ---------- Remplissage ----------
  fill(c: Chunk, index: number) {
    for (const n of c.root.getChildren()) n.dispose();
    c.index = index;
    c.roofs = [];
    c.cars = [];
    c.bobbers = [];
    c.rotors = [];
    c.place = placeAt(index * CHUNK);
    const s = c.place.stage;
    this.put("ground " + s.id, () => {
      const g = MeshBuilder.CreateBox("ground", { width: 1300, height: 0.5, depth: CHUNK + 2 }, this.scene);
      g.material = this.mat(s.ground);
      return g;
    }, c.root, 0, -0.25, CHUNK / 2);
    this[s.id](c);
  }
  roof(c: Chunk, key: string, make: Make, h: number) {
    this.put(key, make, c.root, 0, 0, 120);
    c.roofs.push({ z: 120, height: h, depth: 38 });
  }
  free(x: number, z: number, r = 0) {
    return Math.abs(x) > 18 + r || Math.abs(z - 120) > 24 + r;
  }
  tree(c: Chunk, x: number, z: number, scale = rand(0.8, 1.5), autumn = 0.08) {
    const k = chance(autumn) ? "#e0782a" : pick(["#3f8f3a", "#2f7a35", "#5aa83f"]);
    if (chance(0.5)) this.put("conifer", this.conifer, c.root, x, 0, z, scale, scale, scale);
    else this.put("leafy " + k, this.leafy(k), c.root, x, 0, z, scale, scale, scale, rand(0, 6));
  }
  balloons(c: Chunk, n: number) {
    for (let i = 0; i < n; i++) {
      const col = pick(["#ff3b6b", "#ffb13b", "#3bc4ff", "#a23bff", "#3bff8b"]);
      const band = pick(["#ffffff", "#ffe14d", "#1d1d1d"]);
      const b = this.put("balloon " + col + band, this.balloon(col, band), c.root, pick([-1, 1]) * rand(45, 220), rand(70, 150), rand(0, CHUNK));
      if (b) c.bobbers.push(b);
    }
  }
  patches(c: Chunk, minX: number) {
    for (let x = -580; x <= 580; x += 78)
      for (let z = 28; z < CHUNK; z += 60) {
        if (Math.abs(x) < minX) continue;
        const k = Math.floor(Math.random() * 6);
        this.put("field " + k, () => {
          const m = MeshBuilder.CreateBox("field", { width: 1, height: 0.3, depth: 1 }, this.scene);
          m.material = this.mat("#ffffff", 0, this.field(k));
          return m;
        }, c.root, x, 0.15, z, 72, 1, 54);
      }
  }
  herd(c: Chunk, n: number, sheep = false) {
    const hx = pick([-1, 1]) * rand(25, 240),
      hz = rand(20, CHUNK - 20);
    for (let i = 0; i < n; i++) {
      const x = hx + rand(-25, 25),
        z = hz + rand(-25, 25);
      if (!this.free(x, z, 4)) continue;
      if (sheep) this.put("sheep", this.sheep, c.root, x, 0, z, 1.5, 1.5, 1.5, rand(0, 6));
      else this.put("cow", this.cow, c.root, x, 0, z, 1.7, 1.7, 1.7, rand(0, 6));
    }
  }
  path(c: Chunk, x: number, z: number, w: number, d: number, color = "#c9a66b") {
    this.put("path " + color, () => {
      const m = MeshBuilder.CreateBox("path", { size: 1 }, this.scene);
      m.material = this.mat(color);
      return m;
    }, c.root, x, 0.2, z, w, 0.3, d);
  }

  forest(c: Chunk) {
    const lake = chance(0.4) ? { x: pick([-1, 1]) * rand(90, 280), z: rand(40, 200), r: rand(28, 55) } : undefined;
    if (lake)
      this.put("lake", () => {
        const m = MeshBuilder.CreateCylinder("lake", { diameter: 1, height: 0.3, tessellation: 32 }, this.scene);
        m.material = this.mat("#3b8fd9", 0.25);
        return m;
      }, c.root, lake.x, 0.3, lake.z, lake.r * 2, 1, lake.r * 1.4);
    for (let i = 0; i < 170; i++) {
      const x = rand(-560, 560),
        z = rand(0, CHUNK);
      if (!this.free(x, z, 3)) continue;
      if (lake && Math.hypot(x - lake.x, (z - lake.z) * 1.4) < lake.r + 6) continue;
      this.tree(c, x, z);
    }
    if (chance(0.45)) this.put("mushroom", this.mushroom, c.root, pick([-1, 1]) * rand(30, 70), 0, rand(20, 220), 2.2, 2.2, 2.2);
    if (chance(0.4)) this.put("cabin", this.house("#a0703a", "#5a3a2a"), c.root, pick([-1, 1]) * rand(40, 160), 0, rand(10, 230), 0.8, 0.8, 0.8, rand(0, 6));
    this.balloons(c, chance(0.5) ? 1 : 0);
    this.roof(c, "rock " + c.place.stage.roof, this.rock(c.place.stage.roof), c.place.stage.roof);
  }
  fields(c: Chunk) {
    this.patches(c, 40);
    for (let i = 0; i < 45; i++) {
      // Bosquets et haies entre les champs.
      const x = Math.round(rand(-7, 7)) * 78 + 39,
        z = rand(0, CHUNK);
      if (this.free(x, z, 3)) this.tree(c, x + rand(-3, 3), z, rand(0.6, 1.1), 0.15);
    }
    this.herd(c, 9);
    this.herd(c, 7);
    this.herd(c, 8, true);
    for (let i = 0; i < 10; i++) this.put("hay", this.hay, c.root, pick([-1, 1]) * rand(50, 400), 0, rand(0, CHUNK), 1.6, 1.6, 1.6, rand(0, 3));
    if (chance(0.7)) {
      const x = pick([-1, 1]) * rand(70, 260),
        z = rand(30, 210);
      this.put("barn small", this.barn(18), c.root, x, 0, z, 0.5, 0.5, 0.5, rand(0, 6));
      this.put("silo", this.silo, c.root, x + 14, 0, z + 6);
      this.put("tractor", this.tractor, c.root, x - 18, 0, z + rand(-10, 10), 1.4, 1.4, 1.4, rand(0, 6));
    }
    for (let i = 0; i < 2; i++) this.turbine(c, pick([-1, 1]) * rand(120, 420), rand(0, CHUNK));
    this.path(c, 0, CHUNK / 2, 6, CHUNK);
    this.balloons(c, chance(0.6) ? 2 : 1);
    this.roof(c, "barn " + c.place.stage.roof, this.barn(c.place.stage.roof), c.place.stage.roof);
  }
  turbine(c: Chunk, x: number, z: number) {
    if (!this.far && Math.abs(x) > 200) return;
    this.put("turbine mast", () => this.compose([this.part("cyl", "#f4f4f4", [1.6, 42], [0, 21, 0]), this.part("box", "#f4f4f4", [2.4, 2.4, 5], [0, 42, 0])]), c.root, x, 0, z);
    const rotor = new TransformNode("rotor", this.scene);
    rotor.parent = c.root;
    rotor.position.set(x, 42, z - 2.8);
    for (let k = 0; k < 3; k++) {
      const b = this.put("blade", () => this.compose([this.part("box", "#ffffff", [1.2, 18, 0.4], [0, 9, 0])]), c.root, 0, 0, 0);
      if (!b) continue;
      b.parent = rotor;
      b.position.set(0, 0, 0);
      b.rotation.z = (k * Math.PI * 2) / 3;
    }
    rotor.rotation.z = rand(0, 6);
    c.rotors.push(rotor);
  }
  village(c: Chunk) {
    this.patches(c, 230);
    this.path(c, 0, CHUNK / 2, 7, CHUNK);
    for (const z of [40, 200]) this.path(c, 0, z, 460, 6);
    const looks = [
      ["#f4efe1", "#b3402a"],
      ["#f2d6a2", "#c8642c"],
      ["#e8c3b0", "#5a4a42"],
      ["#cfe3f0", "#3d5f8a"],
      ["#fff4c9", "#b3402a"],
    ];
    for (let h = 0; h < 4; h++) {
      const hx = pick([-1, 1]) * rand(35, 190),
        hz = rand(20, 220);
      if (h === 0 && chance(0.7)) this.put("church", this.church, c.root, hx, 0, hz, 1, 1, 1, pick([0, Math.PI / 2]));
      for (let i = 0; i < 8; i++) {
        const x = hx + rand(-40, 40),
          z = hz + rand(-40, 40);
        if (!this.free(x, z, 6) || (h === 0 && Math.hypot(x - hx, z - hz) < 16)) continue;
        const [w, r] = pick(looks);
        this.put("house " + w + r, this.house(w, r), c.root, x, 0, z, 1, 1, 1, Math.round(rand(0, 4)) * (Math.PI / 2) + rand(-0.15, 0.15));
      }
    }
    for (let i = 0; i < 55; i++) {
      const x = rand(-420, 420),
        z = rand(0, CHUNK);
      if (this.free(x, z, 5)) this.tree(c, x, z, rand(0.7, 1.2), 0.12);
    }
    this.herd(c, 6);
    if (chance(0.5)) this.herd(c, 6, true);
    if (chance(0.5)) this.turbine(c, pick([-1, 1]) * rand(260, 420), rand(0, CHUNK));
    this.balloons(c, 1);
    this.roof(c, "castle " + c.place.stage.roof, this.castle(c.place.stage.roof), c.place.stage.roof);
  }
  town(c: Chunk) {
    for (const x of [-30, 30, -120, 120, -210, 210, -300, 300]) this.path(c, x, CHUNK / 2, 9, CHUNK, "#3a3d44");
    for (const z of [10, 130]) this.path(c, 0, z, 700, 9, "#3a3d44");
    const stadiumX = chance(0.55) ? pick([-1, 1]) * 165 : 0;
    for (let bx = 75; bx < 560; bx += 90)
      for (let bz = 40; bz < CHUNK; bz += 60)
        for (const side of [-1, 1]) {
          const x = side * bx + rand(-8, 8),
            z = bz + rand(-6, 6);
          if (stadiumX && Math.abs(x - stadiumX) < 60 && Math.abs(z - 120) < 55) continue;
          if (chance(0.12)) {
            for (let k = 0; k < 4; k++) this.tree(c, x + rand(-18, 18), z + rand(-18, 18), rand(0.7, 1), 0.2);
            continue;
          }
          const k = Math.floor(Math.random() * 5),
            w = rand(18, 34),
            d = rand(18, 34),
            h = rand(10, 42) + (bx > 300 ? rand(0, 30) : 0);
          this.put("town block " + k, () => {
            const m = MeshBuilder.CreateBox("town block", { size: 1 }, this.scene);
            m.material = this.mat("#ffffff", 0, this.dayFacade(k));
            return m;
          }, c.root, x, h / 2, z, w, h, d);
          this.put("roof slab", () => this.compose([this.part("box", "#5b5f66", [1, 0.4, 1], [0, 0, 0])]), c.root, x, h + 0.2, z, w + 0.8, 1, d + 0.8);
          if (chance(0.4)) this.put("ac unit", () => this.compose([this.part("box", "#9aa1ab", [3, 2, 3], [0, 1, 0]), this.part("cyl", "#6a717b", [2, 0.3], [0, 2.1, 0])]), c.root, x + rand(-w / 4, w / 4), h + 0.4, z + rand(-d / 4, d / 4));
          if (chance(0.12)) this.ad(pick(WIDE), c.root, Math.min(w * 0.8, 16), Math.min(w * 0.4, 8), x, h * 0.6, z - d / 2 - 0.4);
        }
    if (stadiumX) this.stadium(c, stadiumX, 120);
    if (chance(0.4)) this.put("water tower", () => this.compose([this.part("cyl", "#b9c4cc", [3, 30], [0, 15, 0]), this.part("sphere", "#e8f0f6", [14, 9, 14], [0, 32, 0]), this.part("cyl", "#ff6b3d", [14.2, 1.6], [0, 32, 0])]), c.root, pick([-1, 1]) * rand(60, 120), 0, rand(20, 220));
    for (let i = 0; i < 12; i++) this.carAt(c, pick(["#e8302a", "#3b8fd9", "#ffd23f", "#f4f4f4", "#2fd650"]), rand(-300, 300), 1, pick([10, 130]) + pick([-2, 2]), rand(14, 26));
    this.balloons(c, chance(0.3) ? 1 : 0);
    this.roof(c, "town hall " + c.place.stage.roof, () => {
      const m = MeshBuilder.CreateBox("town hall", { width: 29, height: c.place.stage.roof, depth: 38 }, this.scene);
      m.bakeTransformIntoVertices(m.getWorldMatrix().clone().setTranslationFromFloats(0, c.place.stage.roof / 2, 0));
      m.material = this.mat("#ffffff", 0, this.dayFacade(2));
      return m;
    }, c.place.stage.roof);
    this.put("helipad", () => this.compose([this.part("cyl", "#ffd23f", [16, 0.3], [0, 0, 0]), this.part("cyl", "#3a3d44", [13, 0.35], [0, 0, 0])]), c.root, 0, c.place.stage.roof + 0.2, 120);
  }
  carAt(c: Chunk, color: string, x: number, y: number, z: number, speed: number) {
    const car = this.put("car " + color, this.car(color), c.root, x, y, z, 1.4, 1.4, 1.4, speed < 0 ? Math.PI : 0);
    if (car) c.cars.push({ node: car, speed: (z % 2 ? 1 : -1) * speed, phase: rand(0, 600), span: 600 });
  }
  stadium(c: Chunk, x: number, z: number) {
    this.put("pitch", () => {
      const m = MeshBuilder.CreateBox("pitch", { width: 70, height: 0.4, depth: 45 }, this.scene);
      m.material = this.mat("#ffffff", 0.15, this.pitch());
      return m;
    }, c.root, x, 0.3, z);
    const stand = (w: number, d: number, dx: number, dz: number) =>
      this.put("stand", () => this.compose([this.part("box", "#d8323a", [1, 1, 1], [0, 0.5, 0])]), c.root, x + dx, 0, z + dz, w, 9, d);
    stand(80, 8, 0, -27);
    stand(80, 8, 0, 27);
    stand(8, 46, -39, 0);
    stand(8, 46, 39, 0);
    for (const [dx, dz] of [[-40, -28], [40, -28], [-40, 28], [40, 28]]) {
      this.put("floodlight", () => this.compose([this.part("cyl", "#cfd6dc", [1, 30], [0, 15, 0])]), c.root, x + dx, 0, z + dz);
      this.put("floodlight lamp", () => {
        const m = MeshBuilder.CreateBox("lamp", { width: 6, height: 3, depth: 1 }, this.scene);
        m.material = this.mat("#fffbe0", 2);
        return m;
      }, c.root, x + dx, 31, z + dz);
    }
  }
  /** Grande ville (night = 0..1) et mégapole : tours, néons, pubs. */
  towers(c: Chunk, mega: boolean) {
    const zone = c.place.zone;
    const hue = zone?.hue ?? 0;
    const neons = zone ? [hsl(hue), hsl(hue + 35), hsl(hue - 35), hsl(hue + 180, 60, 75)] : NEON;
    const facades = zone
      ? [this.nightFacade(hsl(hue, 60, 12), hsl(hue, 70, 65)), this.nightFacade(hsl(hue + 20, 50, 9), hsl(hue - 25, 80, 70)), this.nightFacade("#101626", hsl(hue + 30, 70, 72))]
      : FACADES.map(([bg, lit]) => this.nightFacade(bg, lit));
    const facade = (k: number) => {
      const tex = facades[k % facades.length];
      return this.mat("#b0bed9", 0.65, tex);
    };
    const level = mega ? Math.min(1, 0.6 + c.place.zoneIndex * 0.1) : 0.45;
    for (let r = 0; r < 4; r++)
      for (let side = -1; side <= 1; side += 2)
        for (let col = 0; col < 5; col++) {
          const x = side * (48 + col * 68 + rand(-8, 8)),
            z = r * 60;
          const h = mega ? rand(70, 260) + (col === 3 ? 80 : 0) : rand(30, 140) + (col === 3 ? 40 : 0),
            w = rand(24, 46),
            d = rand(25, 47);
          const k = Math.floor(Math.random() * facades.length);
          const neon = this.neon(pick(neons));
          const tower = (key: string, make: Make, y: number, sx: number, sy: number, sz: number, ry = 0) =>
            this.put(key + k + (zone?.id ?? "city"), make, c.root, x, y, z, sx, sy, sz, ry);
          const boxMake = () => {
            const m = MeshBuilder.CreateBox("tower", { size: 1 }, this.scene);
            m.material = facade(k);
            return m;
          };
          let top = h;
          const shape = mega ? Math.random() : 1;
          if (mega && col < 2 && shape < 0.3) {
            // Immeuble large aux fenêtres géantes, avec des habitants qui font coucou.
            const ww = rand(44, 56),
              hh = rand(70, 130);
            tower("slab", boxMake, hh / 2, ww, hh, d);
            const cols = Math.floor((ww - 4) / 16),
              rows = Math.min(5, Math.floor((hh - 16) / 16));
            for (let i = 0; i < cols; i++)
              for (let j = 0; j < rows; j++) this.peopleWindow(c, Math.floor(Math.random() * 6), hue, x - ((cols - 1) * 16) / 2 + i * 16, 14 + j * 16, z - d / 2 - 0.4);
            top = hh;
          } else if (mega && shape < 0.45) {
            tower("cylinder", () => {
              const m = MeshBuilder.CreateCylinder("round tower", { diameter: 1, height: 1, tessellation: 18 }, this.scene);
              m.material = facade(k);
              return m;
            }, h / 2, w, h, w);
            for (let y = 30; y < h; y += 40)
              this.put("ring trim " + neon.name, () => {
                const m = MeshBuilder.CreateTorus("ring", { diameter: 1, thickness: 0.02, tessellation: 24 }, this.scene);
                m.material = neon;
                return m;
              }, c.root, x, y, z, w + 1, 40, w + 1);
          } else if (mega && shape < 0.6) {
            for (let s = 0; s < 6; s++) tower("twist", boxMake, (h / 6) * (s + 0.5), w * (1 - s * 0.06), h / 6, d * (1 - s * 0.06), s * 0.18);
          } else if (mega && shape < 0.72) {
            tower("step", boxMake, h * 0.3, w, h * 0.6, d);
            tower("step", boxMake, h * 0.75, w * 0.7, h * 0.3, d * 0.7);
            tower("step", boxMake, h * 0.95, w * 0.4, h * 0.1, d * 0.4);
          } else {
            tower("box", boxMake, h / 2, w, h, d);
            tower("crown", boxMake, h + 6, w * 0.65, 12, d * 0.65);
            top = h + 12;
          }
          const trimMake = () => {
            const m = MeshBuilder.CreateBox("trim", { size: 1 }, this.scene);
            m.material = neon;
            return m;
          };
          this.put("trim " + neon.name, trimMake, c.root, x, top, z, w * 0.65, 0.65, d * 0.65);
          if (col < 2) {
            this.put("trim " + neon.name, trimMake, c.root, x - w / 2 - 0.15, h / 2, z - d / 2 - 0.2, 0.65, h, 0.65);
            if (chance(0.5)) this.put("trim " + neon.name, trimMake, c.root, x, rand(20, h - 5), z - d / 2 - 0.25, w, 0.5, 0.5);
          }
          if (zone?.id === "jardin" && chance(0.7))
            for (let t = 0; t < 3; t++) this.tree(c, x + rand(-w / 4, w / 4), z + rand(-d / 4, d / 4), 0.8, 0);
          if (zone?.id === "dragon" && chance(0.35))
            for (let t = 0; t < 3; t++)
              this.put("pagoda", () => this.compose([this.part("box", "#c8102e", [1, 1, 1], [0, 0, 0])], 1), c.root, x, top + 3 + t * 6, z, w * (1.2 - t * 0.25), 1.2, d * (1.2 - t * 0.25));
          if (col < 3) {
            if (h > 45 && chance(0.4 + level * 0.5)) {
              const a = pick(WIDE);
              const pw = Math.min(w * 0.85, a.shape === "square" ? 18 : 32);
              const ph = a.shape === "square" ? pw : pw / 2;
              this.ad(a, c.root, pw, ph, x, rand(18 + ph / 2, Math.max(20 + ph / 2, Math.min(h, 120) - ph / 2 - 4)), z - d / 2 - 0.5);
            }
            if (col < 2 && chance(0.3 + level * 0.5)) {
              const sh = Math.min(28, h * 0.4);
              this.ad(pick(TALL), c.root, sh / 4, sh, x - side * (w / 2 + 0.4), rand(sh / 2 + 10, Math.min(h, 110) - sh / 2), z - d / 2 + 5, side > 0 ? Math.PI / 2 : -Math.PI / 2);
            }
            if (w > 30 && chance(level * 0.4)) this.ad(pick(TICKERS), c.root, 28, 2.4, x, rand(12, Math.min(h, 100) * 0.5), z - d / 2 - 0.6);
            if (chance(level * 0.4)) {
              const a = pick(WIDE);
              const pw = a.shape === "square" ? 14 : 24;
              this.ad(a, c.root, pw, a.shape === "square" ? pw : pw / 2, x, top + 1 + (a.shape === "square" ? pw : pw / 2) / 2, z);
            }
          }
        }
    // Obstacle central : le toit qu'il faut survoler.
    const h = c.place.stage.roof;
    this.roof(c, "obstacle " + (zone?.id ?? "city"), () => {
      const m = MeshBuilder.CreateBox("obstacle", { width: 29, height: h, depth: 38 }, this.scene);
      m.bakeTransformIntoVertices(m.getWorldMatrix().clone().setTranslationFromFloats(0, h / 2, 0));
      m.material = facade(0);
      return m;
    }, h);
    this.put("obstacle neon " + neons[0], () => {
      const m = MeshBuilder.CreateBox("obstacle roof", { width: 30, height: 0.7, depth: 39 }, this.scene);
      m.material = this.neon(neons[0]);
      return m;
    }, c.root, 0, h, 120);
    this.ad(pick(WIDE), c.root, 22, 11, 0, h - 8, 120 - 19.5);
    // Autoroutes suspendues et trafic.
    for (const x of [-25, 25]) {
      this.put("motorway", () => {
        const m = MeshBuilder.CreateBox("motorway", { width: 9, height: 1.5, depth: CHUNK }, this.scene);
        m.material = this.mat("#162239");
        return m;
      }, c.root, x, 21, 120);
      for (const dx of [-4, 4]) this.put("motorway edge " + neons[1], () => {
        const m = MeshBuilder.CreateBox("edge", { width: 0.35, height: 0.5, depth: CHUNK }, this.scene);
        m.material = this.neon(neons[1]);
        return m;
      }, c.root, x + dx, 22, 120);
    }
    const carColors = neons.map((n) => n);
    for (let k = 0; k < (mega ? 10 : 6); k++) {
      const col = pick(carColors);
      const car = this.put("flying car " + col, () => {
        const m = MeshBuilder.CreateCapsule("flying car", { radius: 1, height: 5, tessellation: 8 }, this.scene);
        m.rotation.z = Math.PI / 2;
        m.bakeCurrentTransformIntoVertices();
        m.material = this.neon(col);
        return m;
      }, c.root, 0, pick([72, 88, 118, 140, 165]), 30 + 60 * (k % 4));
      if (car) c.cars.push({ node: car, speed: pick([-1, 1]) * rand(25, 60), phase: rand(0, 600), span: 600 });
    }
    for (let k = 0; k < (mega ? 3 : 1); k++) {
      const a = pick(WIDE);
      const pw = a.shape === "square" ? 12 : 20;
      const holo = this.ad(a, c.root, pw, a.shape === "square" ? pw : pw / 2, pick([-1, 1]) * rand(34, 46), rand(85, 150), rand(20, 220), pick([-1, 1]) * 0.35);
      c.bobbers.push(holo);
    }
    if (mega && (chance(0.4) || zone?.id === "kawaii")) this.smiley(c, pick([-1, 1]) * 95, 175, 140);
    if (mega && chance(0.5)) this.blimp(c, pick([-1, 1]) * 135);
    if (zone) this.zoneDecor(c, zone.id, hue);
  }
  city(c: Chunk) {
    this.towers(c, false);
  }
  mega(c: Chunk) {
    this.towers(c, true);
  }
  zoneDecor(c: Chunk, id: string, hue: number) {
    const glow = (color: string) => this.neon(color, 1.4);
    for (let i = 0; i < 3; i++) {
      const x = pick([-1, 1]) * rand(50, 160),
        y = rand(90, 190),
        z = rand(0, CHUNK);
      let node: InstancedMesh | undefined;
      if (id === "ocean") {
        node = this.put("jellyfish", () => {
          const m = this.compose([
            this.part("sphere", "#7fe8ff", [12, 8, 12], [0, 0, 0]),
            ...[0, 1.25, 2.5, 3.75, 5].map((a) => this.part("cyl", "#c9f6ff", [0.5, 14], [Math.cos(a) * 3.5, -7, Math.sin(a) * 3.5])),
          ], 1.5);
          return m;
        }, c.root, x, y, z, 1.6, 1.6, 1.6);
      } else if (id === "soleil") {
        node = this.put("giant sun", () => {
          const m = MeshBuilder.CreateDisc("sun", { radius: 12, tessellation: 24 }, this.scene);
          m.material = glow("#ffb13b");
          m.billboardMode = Mesh.BILLBOARDMODE_ALL;
          return m;
        }, c.root, x, y, z);
        this.put("pyramid", () => {
          const m = MeshBuilder.CreateCylinder("pyramid", { diameterTop: 0, diameterBottom: 1, height: 1, tessellation: 4 }, this.scene);
          m.material = this.mat("#ff9a3b", 0.5, this.nightFacade("#2a1404", "#ffb13b"));
          return m;
        }, c.root, pick([-1, 1]) * rand(220, 420), 60, rand(0, CHUNK), 120, 120, 120, Math.PI / 4);
      } else if (id === "arcade") {
        const color = hsl(hue + rand(-60, 60), 80, 65);
        node = this.put("invader " + color, () => {
          const px = ["00100000100", "00010001000", "00111111100", "01101110110", "11111111111", "10111111101", "10100000101", "00011011000"];
          const parts: Mesh[] = [];
          px.forEach((row, j) => [...row].forEach((v, i) => v === "1" && parts.push(this.part("box", color, [1, 1, 1], [i - 5, 4 - j, 0]))));
          return this.compose(parts, 2);
        }, c.root, x, y, z, 2.2, 2.2, 2.2);
      } else if (id === "dragon") {
        // Guirlandes de lanternes rouges entre les tours.
        for (let k = 0; k < 9; k++)
          this.put("lantern", () => this.compose([this.part("sphere", "#ff3b3b", [2.4, 3, 2.4], [0, 0, 0]), this.part("cyl", "#ffd23f", [1.4, 0.5], [0, 1.6, 0])], 2), c.root, -40 + k * 10, y * 0.5 - Math.sin((k / 8) * Math.PI) * 6, z);
      } else if (id === "kawaii") {
        node = this.put("heart", () => this.compose([this.part("sphere", "#ff6fb5", [6, 6, 4], [-2, 2, 0]), this.part("sphere", "#ff6fb5", [6, 6, 4], [2, 2, 0]), this.part("cone", "#ff6fb5", [8.6, 6.5], [0, -2.5, 0], [Math.PI, 0, 0])], 1.6), c.root, x, y, z, 1.6, 1.6, 1.6);
      }
      if (node) c.bobbers.push(node);
    }
  }
  peopleWindow(c: Chunk, variant: number, hue: number, x: number, y: number, z: number) {
    const key = "people " + variant + " " + Math.round(hue / 30);
    this.put(key, () => {
      const tex = new DynamicTexture(key, paintPeople(variant, hue), this.scene, true);
      tex.uScale = 0.5;
      tex.update();
      this.people.push({ tex, phase: Math.random() * 2 });
      const m = new StandardMaterial(key, this.scene);
      m.diffuseColor = Color3.Black();
      m.specularColor = Color3.Black();
      m.emissiveTexture = tex;
      m.disableLighting = true;
      m.fogEnabled = false;
      const p = MeshBuilder.CreatePlane(key, { size: 1 }, this.scene);
      p.material = m;
      this.glow.addExcludedMesh(p);
      return p;
    }, c.root, x, y, z, 15, 15, 1);
  }
  smiley(c: Chunk, x: number, y: number, z: number) {
    const s = this.put("giant smiley", () => {
      const tex = new DynamicTexture("holo smiley", paintSmiley(), this.scene, true);
      tex.hasAlpha = true;
      tex.update();
      const m = new StandardMaterial("giant smiley", this.scene);
      m.diffuseColor = Color3.Black();
      m.emissiveTexture = tex;
      m.opacityTexture = tex;
      m.disableLighting = true;
      m.backFaceCulling = false;
      const p = MeshBuilder.CreatePlane("giant smiley", { size: 44 }, this.scene);
      p.material = m;
      p.billboardMode = Mesh.BILLBOARDMODE_ALL;
      return p;
    }, c.root, x, y, z);
    if (s) c.bobbers.push(s);
  }
  blimp(c: Chunk, x: number) {
    if (!this.far && Math.abs(x) > 200) return;
    const node = new TransformNode("blimp", this.scene);
    node.parent = c.root;
    node.position.set(x, 190, 120);
    const hull = this.put("blimp hull", () => this.compose([this.part("sphere", "#2a2f4a", [16, 14, 60], [0, 0, 0]), this.part("box", "#f34494", [0.6, 10, 8], [0, 6, -26])]), c.root, 0, 0, 0);
    if (hull) hull.parent = node, hull.position.set(0, 0, 0);
    const side = x > 0 ? -1 : 1;
    this.ad(pick(WIDE), node, 34, 17, side * 8.3, 0, 0, side > 0 ? -Math.PI / 2 : Math.PI / 2);
    this.ad(pick(WIDE), node, 12, 6, 0, -2, -30.2);
    c.bobbers.push(node);
  }
  /** Panneau publicitaire : un gabarit par publicité, puis des instances. */
  ad(ad: Ad, parent: TransformNode, w: number, h: number, x: number, y: number, z: number, rotY = 0) {
    let template = this.ads.get(ad);
    if (!template) {
      const tex = new DynamicTexture("ad " + ad.title, paintAd(ad), this.scene, true);
      tex.hasAlpha = false;
      tex.update();
      const m = new StandardMaterial("ad " + ad.title, this.scene);
      m.diffuseColor = Color3.Black();
      m.specularColor = Color3.Black();
      m.emissiveTexture = tex;
      m.disableLighting = true;
      m.backFaceCulling = false;
      // Les pubs percent le brouillard : la ville reste colorée jusqu'au loin.
      m.fogEnabled = false;
      if (ad.shape === "ticker") {
        tex.wrapU = Texture.WRAP_ADDRESSMODE;
        tex.uScale = 0.36;
      }
      template = MeshBuilder.CreatePlane("ad " + ad.title, { size: 1 }, this.scene);
      template.material = m;
      template.isVisible = false;
      this.ads.set(ad, template);
      this.adMats.push({ tex, flicker: ad.flicker ?? 0, phase: Math.random() * 10, ticker: ad.shape === "ticker" });
      this.glow.addExcludedMesh(template);
    }
    const p = template.createInstance("ad");
    p.parent = parent;
    p.position.set(x, y, z);
    p.rotation.y = rotY;
    p.scaling.set(w, h, 1);
    return p;
  }
}
