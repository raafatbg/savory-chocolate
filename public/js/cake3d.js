// Real-time 3D cake on a gold stand, built with Three.js.
//
//   const stage = createCakeStage(element, { sparkles: true });
//   stage.setCake({ shape: 'heart', tiers: 2, color: '#f1c1c4', drip: '#2b160d', toppings: ['berries'] });
//
// Returns null when the browser has no WebGL, so callers can keep a static fallback.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;

export const DEFAULT_CAKE = {
  shape: 'round', // round | square | heart
  tiers: 1, // 1–3
  size: 1, // footprint scale, roughly 0.85–1.2
  color: '#f3e6d3', // frosting color
  tierColors: null, // optional per-tier colors, bottom first
  spongeColor: '#4a2512', // inner sponge color when sliced
  fillingColor: '#2a1208', // inner filling layer color when sliced
  sliced: false, // whether a wedge slice is pulled out to show inside layers
  drip: '', // drip color, '' for none
  dripMetallic: false,
  toppings: [], // berries | macarons | shards | goldleaf | sprinkles | flowers | cherries
  extras: [], // candles | topper | sparklers
  message: '', // written on a chocolate plaque
};

// Draws the vectorized SAVORY cocoa-pod emblem centered at (cx, cy) with height `h`.
export function drawSavoryPod(ctx, cx, cy, h, color = '#c9a063') {
  ctx.save();
  const s = h / 280;
  ctx.translate(cx - 90.5 * s, cy - 140 * s);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  const p = new Path2D('M 90.5 0 C 96 0.6 105.7 7.9 111.7 13 C 141.4 36.1 163.3 63.3 175.3 99.7 C 181 120.7 181.9 138.9 180 160.5 C 176.2 195.8 164.4 222.7 140.5 249.2 C 131.6 258.5 110.2 276 103.5 276 C 95.3 276 92.4 268.2 98.7 262 C 140.4 227.6 155.1 200.7 161 146.5 C 163.7 95.9 144.3 53.7 101.5 20.8 C 96.4 17.5 92.9 17.7 89.2 22.8 C 75.7 39.2 66.8 60.5 64 81.5 C 60.4 114.2 69.2 135.7 78.6 165.5 C 88.2 201.9 88.4 239.8 77.7 276.2 C 74.7 282.5 70.6 279.6 64.5 277.3 C 23.4 252.9 2.6 205.5 0.5 158.5 C -2.8 100.1 17.1 45.7 63.5 10.7 C 66.5 9.1 71 10.6 72 14 C 72 19 67.3 21.8 64.1 24.8 C 30.8 54.6 15.8 89.6 14 134 C 12.1 182.9 23.5 227.6 66 259.2 C 70.1 260.4 69.8 259.6 70.2 256 C 72.1 244.4 72 232.3 71.9 220.5 C 71.1 190 59.1 165.4 51.4 136.5 C 40.9 88.9 51 39.4 84.5 3.7 C 86.2 1.9 87.9 0 90.5 0 Z M 102 35 C 106.7 35.4 109.9 40.9 112.7 44.3 C 142.3 87.1 146.5 151.1 129.3 200 C 125.9 208.1 124.2 213.6 116.5 213 C 110.2 209.6 115.6 200.4 117.3 195 C 132.4 150.2 129.3 90.1 100.8 50.8 C 98 45.6 95.3 39.5 102 35 Z M 35 123 C 42 124.3 40 137.1 40.6 142.5 C 44.1 174.1 51.3 204.2 69.1 231 C 74.1 239.4 66.8 245.5 59.5 239.3 C 39.6 211.7 31.6 178.9 29.1 145 C 29.2 139.8 27.6 124.2 35 123 Z');
  ctx.fill(p, 'evenodd');
  ctx.restore();
}

export function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- stage

export function createCakeStage(container, {
  autoRotate = true, interactive = finePointer, sparkles = false, float = false, scrollSpin = false,
} = {}) {
  if (!webglAvailable()) return null;

  let renderer;
  try {
    renderer = createRenderer({ alpha: true });
  } catch {
    return null;
  }
  let pixelRatio = Math.min(window.devicePixelRatio, 1.5);
  renderer.setPixelRatio(pixelRatio);
  // Shadows are redrawn only when something changes (see loop), not every frame.
  renderer.shadowMap.autoUpdate = false;
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'A 3D preview of the cake');
  container.appendChild(renderer.domElement);

  const scene = setupScene(renderer);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  const turntable = new THREE.Group();
  scene.add(turntable);

  let controls = null;
  if (interactive) {
    controls = new OrbitControls(camera, renderer.domElement);
    Object.assign(controls, {
      enableZoom: false,
      enablePan: false,
      enableDamping: true,
      dampingFactor: 0.08,
      rotateSpeed: 0.7,
      minPolarAngle: 0.75,
      maxPolarAngle: 1.45,
      autoRotate: autoRotate && !reduceMotion,
      autoRotateSpeed: 1.6,
    });
  }

  const dust = sparkles ? createSparkles() : null;
  if (dust) scene.add(dust.points);

  // Scrolling the page gives the cake an extra spin that eases off.
  let spin = 0;
  let lastScroll = window.scrollY;
  const onScroll = () => {
    spin += (window.scrollY - lastScroll) * 0.0025;
    lastScroll = window.scrollY;
    requestRender();
  };
  if (scrollSpin && !reduceMotion) window.addEventListener('scroll', onScroll, { passive: true });

  // Camera framing eases toward these whenever the cake changes size.
  const view = { target: new THREE.Vector3(0, 1.5, 0), distance: 10, polar: 1.2 };
  const targetView = { ...view, target: view.target.clone() };
  placeCamera(view);

  let current = null;
  let pop = 1;
  let intro = -1;
  let wishMode = false;

  function setCake(config, { intro: withIntro = false } = {}) {
    const next = buildCake({ ...DEFAULT_CAKE, ...config, wishMode });
    const first = !current;
    if (current) {
      turntable.remove(current.group);
      disposeTree(current.group);
    }
    current = next;
    turntable.add(next.group);
    pop = reduceMotion ? 1 : 0;
    intro = withIntro && !reduceMotion ? 0 : -1;
    if (intro === 0) {
      pop = 1;
      playIntro(next, 0);
    }

    // When slicing the cake, gently rotate turntable so the cut slice faces the viewer.
    if (config?.sliced && controls) {
      turntable.rotation.y = -0.35;
    }

    Object.assign(targetView, framing(next, camera));
    if (first) {
      view.distance = targetView.distance;
      view.target.copy(targetView.target);
      placeCamera(view);
    }
    requestRender();
  }

  function setWishMode(active) {
    wishMode = Boolean(active);
    const lights = scene.userData.lights;
    if (lights) {
      lights.hemi.intensity = wishMode ? 0.14 : 0.4;
      lights.key.intensity = wishMode ? 0.48 : 2.3;
      lights.rim.intensity = wishMode ? 0.75 : 2.2;
      lights.fill.intensity = wishMode ? 0.18 : 0.6;
      scene.environmentIntensity = wishMode ? 0.2 : 0.55;
    }
    container.classList.toggle('wish-mode', wishMode);
    requestRender();
  }

  function placeCamera(v) {
    if (controls) {
      const offset = camera.position.clone().sub(controls.target);
      if (offset.lengthSq() < 0.01) offset.setFromSphericalCoords(1, v.polar, 0.35);
      offset.setLength(v.distance);
      controls.target.copy(v.target);
      camera.position.copy(v.target).add(offset);
    } else {
      camera.position.setFromSphericalCoords(v.distance, v.polar, 0.35).add(v.target);
      camera.lookAt(v.target);
    }
  }

  // ---- render loop (paused while off screen or in a background tab) ----
  const clock = new THREE.Clock();
  let visible = true;
  let frame = 0;
  let frames = 0;
  let slowTime = 0;

  // If the device can't keep up (under ~45 fps), render fewer pixels until it can.
  function adaptQuality(dt) {
    frames += 1;
    slowTime += dt;
    if (frames < 90) return;
    if (slowTime / frames > 1 / 45 && pixelRatio > 1) {
      pixelRatio = Math.max(1, pixelRatio - 0.25);
      renderer.setPixelRatio(pixelRatio);
      resize();
    }
    frames = 0;
    slowTime = 0;
  }

  function loop() {
    frame = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    adaptQuality(dt);
    // Shadows move little as the cake turns: refresh them a few times a second, or every frame while animating.
    if (intro >= 0 || pop < 1 || frames % 8 === 0) renderer.shadowMap.needsUpdate = true;

    view.distance += (targetView.distance - view.distance) * 0.08;
    view.target.lerp(targetView.target, 0.08);
    if (!controls && autoRotate && !reduceMotion) turntable.rotation.y += dt * 0.35;
    if (Math.abs(spin) > 0.0001) {
      turntable.rotation.y += spin;
      spin *= 0.9;
    }
    placeCamera(view);
    controls?.update(dt);

    if (current) {
      if (intro >= 0) {
        intro += dt;
        if (!playIntro(current, intro)) intro = -1;
      } else if (pop < 1) {
        pop = Math.min(1, pop + dt * 2.2);
        current.group.scale.setScalar(0.9 + 0.1 * easeOutBack(pop));
      }
      if (float && !reduceMotion) current.group.position.y = Math.sin(t * 1.1) * 0.05;
      current.animate?.(t, dt);
    }
    dust?.animate(dt);

    renderer.render(scene, camera);
    frame = requestAnimationFrame(loop);
  }

  // Draws one frame right away (so the cake shows even before animation starts), then keeps animating.
  function requestRender() {
    if (current) {
      placeCamera(view);
      renderer.shadowMap.needsUpdate = true;
      renderer.render(scene, camera);
    }
    if (!frame && visible && !document.hidden) {
      clock.getDelta();
      frame = requestAnimationFrame(loop);
    }
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (current) Object.assign(targetView, framing(current, camera));
    requestRender();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  const visibility = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    requestRender();
  });
  visibility.observe(container);
  const onVisibility = () => requestRender();
  document.addEventListener('visibilitychange', onVisibility);

  resize();
  container.classList.add('ready');

  return {
    setCake,
    setWishMode,
    getWishMode: () => wishMode,
    dispose() {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibility.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('scroll', onScroll);
      controls?.dispose();
      disposeTree(scene);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

// Renders a cake to a still image (PNG data URL) with a shared offscreen renderer.
let snapshotRig = null;
export async function renderCakeSnapshot(config, { width = 720, height = 720, type = 'image/png', quality } = {}) {
  if (!webglAvailable()) return null;
  if (document.fonts) await document.fonts.load('80px "Great Vibes"').catch(() => {});
  if (!snapshotRig) {
    const renderer = createRenderer({ alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    snapshotRig = { renderer, scene: setupScene(renderer), camera: new THREE.PerspectiveCamera(30, 1, 0.1, 100) };
  }
  const { renderer, scene, camera } = snapshotRig;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  const cake = buildCake({ ...DEFAULT_CAKE, ...config });
  scene.add(cake.group);
  const { distance, target } = framing(cake, camera, 0.68);
  camera.position.setFromSphericalCoords(distance, 1.2, 0.5).add(target);
  camera.lookAt(target);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL(type, quality);
  scene.remove(cake.group);
  disposeTree(cake.group);
  return url;
}

// Frees the offscreen renderer (and its GPU memory) once no more snapshots are needed.
export function releaseSnapshots() {
  if (!snapshotRig) return;
  disposeTree(snapshotRig.scene);
  snapshotRig.renderer.dispose();
  snapshotRig.renderer.forceContextLoss();
  snapshotRig = null;
}

function createRenderer(options) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', ...options });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

// Lighting, reflections, a soft shadow and a warm pool of light on the floor.
function setupScene(renderer) {
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  const hemi = new THREE.HemisphereLight(0xfff1e0, 0x2a160c, 0.4);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff0dc, 2.3);
  key.position.set(4, 9, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -4.5, right: 4.5, top: 4.5, bottom: -4.5, near: 2, far: 25 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 5;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffc27a, 2.2);
  rim.position.set(-6, 5, -6);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffe4c8, 0.6);
  fill.position.set(-5, 2, 6);
  scene.add(fill);

  scene.userData.lights = { hemi, key, rim, fill };

  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(3.1, 64),
    // Kept smaller than the visible floor so the canvas edges never clip the glow.
    new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, depthWrite: false, toneMapped: false }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.002;
  scene.add(pool);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.ShadowMaterial({ opacity: 0.45 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.004;
  ground.receiveShadow = true;
  scene.add(ground);
  return scene;
}

// Camera distance and look-at point that fit the whole cake in view.
function framing(cake, camera, margin = 0.74) {
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const fitHeight = (cake.height * margin) / Math.tan(fov / 2);
  const fitWidth = (cake.width * margin) / (Math.tan(fov / 2) * Math.max(camera.aspect, 0.5));
  return {
    distance: Math.max(fitHeight, fitWidth, 7),
    target: new THREE.Vector3(0, cake.height * 0.5, 0),
  };
}

function poolTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255, 214, 150, 0.38)');
  grad.addColorStop(0.45, 'rgba(214, 160, 90, 0.13)');
  grad.addColorStop(0.85, 'rgba(214, 160, 90, 0.02)');
  grad.addColorStop(1, 'rgba(214, 160, 90, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// ---------------------------------------------------------------- cake model

const STAND_HEIGHT = 0.78;
const BEVEL = 0.09;

const gold = () => new THREE.MeshStandardMaterial({ color: 0xd9b066, metalness: 1, roughness: 0.24 });

function frostingMaterial(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.66 });
}

function dripMaterial(color, metallic) {
  if (metallic) return new THREE.MeshStandardMaterial({ color: 0xd4a75a, metalness: 1, roughness: 0.2 });
  return new THREE.MeshStandardMaterial({ color, roughness: 0.14, metalness: 0.05 });
}

function lighten(hex, amount) {
  return new THREE.Color(hex).lerp(new THREE.Color(0xffffff), amount);
}

function buildCake(c) {
  const group = new THREE.Group();
  const animations = [];
  const tierCount = Math.min(3, Math.max(1, Number(c.tiers) || 1));
  const size = THREE.MathUtils.clamp(Number(c.size) || 1, 0.75, 1.3);
  const base = 1.5 * size;
  const radii = [[base * 1.04], [base, base * 0.7], [base, base * 0.73, base * 0.48]][tierCount - 1];
  const heights = [[1.2], [1.05, 0.95], [1.0, 0.9, 0.8]][tierCount - 1];

  const stand = buildStand(radii[0], c.sliced);
  group.add(stand);

  let y = STAND_HEIGHT;
  let top = null;
  const tiers = radii.map((r, i) => {
    const h = heights[i];
    const color = c.tierColors?.[i] || c.color;
    const tier = buildTier(c.shape, r, h, color, c.drip ? { color: c.drip, metallic: c.dripMetallic, seed: i } : null);
    tier.position.y = y;
    tier.userData.baseY = y;
    group.add(tier);
    top = { y: y + h, r, h, edge: edgeSampler(c.shape, r) };
    y += h;
    return tier;
  });

  // When "Cut a slice" is active, display a pulled-out wedge slice showing the 3 sponge layers & 2 filling layers.
  if (c.sliced) {
    const sliceSet = buildPulledSlice({
      r: radii[0],
      h: heights[0],
      frostingColor: c.tierColors?.[0] || c.color,
      spongeColor: c.spongeColor || '#4a2512',
      fillingColor: c.fillingColor || '#2a1208',
      dripColor: c.drip,
      dripMetallic: c.dripMetallic,
    });
    sliceSet.group.position.y = STAND_HEIGHT;
    group.add(sliceSet.group);
    animations.push(sliceSet.animate);
  }

  // A drip leaves a glaze layer on top; decorations sit on that, not under it.
  if (c.drip) top.y += 0.035;

  // Toppings and extras live in their own group, pivoting on the top of the cake,
  // so the intro animation can pop them in after the tiers have landed.
  const decor = new THREE.Group();
  decor.position.y = top.y;
  const onTop = new THREE.Group();
  onTop.position.y = -top.y;
  decor.add(onTop);
  group.add(decor);

  const rng = random(7);
  let extraHeight = 0.2;
  const toppings = new Set(c.toppings || []);
  const extras = new Set(c.extras || []);
  const hasMessage = Boolean(c.message && c.message.trim());

  if (toppings.has('sprinkles')) onTop.add(sprinkles(top, rng));
  if (toppings.has('goldleaf')) onTop.add(goldLeaf(top, radii, heights, rng));
  if (toppings.has('berries')) onTop.add(berries(top, rng));
  if (toppings.has('macarons')) onTop.add(macarons(top, hasMessage));
  if (toppings.has('cherries')) onTop.add(cherries(top, hasMessage));
  if (toppings.has('flowers')) onTop.add(flowers(top));
  if (toppings.has('shards')) { onTop.add(shards(top, rng)); extraHeight = Math.max(extraHeight, 0.6); }

  if (hasMessage) onTop.add(plaque(top, c.message.trim(), c.shape));

  if (extras.has('candles') || c.wishMode) {
    const candleSet = candles(top, c.wishMode);
    onTop.add(candleSet.group);
    animations.push(candleSet.animate);
    extraHeight = Math.max(extraHeight, 0.85);
  }
  if (extras.has('topper')) { onTop.add(topper(top)); extraHeight = Math.max(extraHeight, 1.35); }
  if (extras.has('sparklers')) {
    const set = sparklers(top);
    onTop.add(set.group);
    animations.push(set.animate);
    extraHeight = Math.max(extraHeight, 1.1);
  }

  tiers.forEach(flatten);
  flatten(onTop);

  // Everything casts a shadow; only the big surfaces receive one (receiving costs a lookup per pixel).
  group.traverse((o) => {
    if (o.isMesh && !o.userData.noShadow) o.castShadow = true;
    if (o.isMesh) o.receiveShadow = Boolean(o.userData.receive);
  });

  return {
    group,
    stand,
    tiers,
    decor,
    height: top.y + extraHeight,
    width: radii[0] * (c.sliced ? 3.1 : 2.7),
    animate: animations.length ? (t, dt) => animations.forEach((fn) => fn(t, dt)) : null,
  };
}

// Builds a pulled-out cake wedge and matching inner cut recess showing sponge + filling layers.
function buildPulledSlice({ r, h, frostingColor, spongeColor, fillingColor, dripColor, dripMetallic }) {
  const group = new THREE.Group();
  const wedgeAngle = 0.52; // ~30 degrees
  const startAngle = Math.PI * 0.22; // front-right direction
  const midAngle = startAngle + wedgeAngle / 2;

  const spongeMat = new THREE.MeshStandardMaterial({ color: spongeColor, roughness: 0.88 });
  const fillingMat = new THREE.MeshStandardMaterial({ color: fillingColor, roughness: 0.35, metalness: 0.04 });
  const frostMat = frostingMaterial(frostingColor);
  const darkRecessMat = new THREE.MeshStandardMaterial({ color: 0x1a0c06, roughness: 0.95 });

  // Recess panels slightly protruding on the bottom tier to show the interior cut on the main cake
  const recess = new THREE.Group();
  const panelLen = r * 0.96;
  const panelH = h * 0.94;
  [startAngle, startAngle + wedgeAngle].forEach((ang, idx) => {
    const sideGroup = new THREE.Group();
    sideGroup.rotation.y = -ang;
    // Frosting backing
    const back = new THREE.Mesh(new THREE.BoxGeometry(panelLen, panelH, 0.04), darkRecessMat);
    back.position.set(panelLen / 2 + 0.02, panelH / 2 + 0.02, 0);
    sideGroup.add(back);
    recess.add(sideGroup);
  });
  group.add(recess);

  // The pulled-out wedge slice resting forward on the stand
  const slice = new THREE.Group();
  const sliceR = r * 0.95;
  const wallT = 0.06;
  const innerH = h - wallT;

  // Outer frosting arc + top cap
  const outerShape = new THREE.Shape();
  outerShape.moveTo(0, 0);
  outerShape.absarc(0, 0, sliceR, -wedgeAngle / 2, wedgeAngle / 2, false);
  outerShape.lineTo(0, 0);

  const outerGeo = new THREE.ExtrudeGeometry(outerShape, {
    depth: h,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
    curveSegments: 24,
  });
  outerGeo.rotateX(-Math.PI / 2);
  const outerMesh = new THREE.Mesh(outerGeo, frostMat);
  outerMesh.userData.keep = true;
  slice.add(outerMesh);

  // Inner layered sponge & filling visible on both cut faces of the wedge
  const layerShape = new THREE.Shape();
  layerShape.moveTo(0.03, 0);
  layerShape.absarc(0, 0, sliceR - wallT, -wedgeAngle / 2 - 0.012, wedgeAngle / 2 + 0.012, false);
  layerShape.lineTo(0.03, 0);

  // 3 sponge layers + 2 filling bands
  const spongeH = (innerH * 0.72) / 3;
  const fillH = (innerH * 0.28) / 2;
  const bands = [
    { h: spongeH, mat: spongeMat },
    { h: fillH, mat: fillingMat },
    { h: spongeH, mat: spongeMat },
    { h: fillH, mat: fillingMat },
    { h: spongeH, mat: spongeMat },
  ];

  let curY = 0.02;
  for (const band of bands) {
    const bGeo = new THREE.ExtrudeGeometry(layerShape, {
      depth: band.h,
      bevelEnabled: false,
      curveSegments: 18,
    });
    bGeo.rotateX(-Math.PI / 2);
    const bMesh = new THREE.Mesh(bGeo, band.mat);
    bMesh.position.y = curY;
    bMesh.userData.keep = true;
    slice.add(bMesh);
    curY += band.h;
  }

  // Optional drip glaze on top of the slice
  if (dripColor) {
    const dMat = dripMaterial(dripColor, dripMetallic);
    const dGeo = new THREE.ExtrudeGeometry(outerShape, {
      depth: 0.04,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 2,
      curveSegments: 20,
    });
    dGeo.rotateX(-Math.PI / 2);
    const dMesh = new THREE.Mesh(dGeo, dMat);
    dMesh.position.y = h - 0.01;
    dMesh.userData.keep = true;
    slice.add(dMesh);
  }

  // Piped cream dollop on top of the slice
  const dollop = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 14, 10),
    frostingMaterial(lighten(frostingColor, 0.16)),
  );
  dollop.scale.set(1, 1.25, 1);
  dollop.position.set(sliceR * 0.62, h + 0.06, 0);
  dollop.userData.keep = true;
  slice.add(dollop);

  slice.rotation.y = -midAngle;
  const pullDist = r * 0.56;
  const dirX = Math.cos(midAngle);
  const dirZ = Math.sin(midAngle);
  slice.position.set(dirX * pullDist, 0.01, dirZ * pullDist);
  group.add(slice);

  let slideProgress = reduceMotion ? 1 : 0;
  return {
    group,
    animate(t, dt) {
      if (slideProgress < 1) {
        slideProgress = Math.min(1, slideProgress + dt * 2.6);
        const ease = 1 - (1 - slideProgress) ** 3;
        const d = pullDist * ease;
        slice.position.set(dirX * d, 0.01, dirZ * d);
      }
    },
  };
}

// Intro: the stand appears, each tier drops onto the one below, then the decorations pop on.
// Returns false once finished.
function playIntro(cake, time) {
  const ease = (x) => 1 - (1 - x) ** 3;
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const standT = clamp01(time / 0.45);
  cake.stand.scale.setScalar(0.85 + 0.15 * ease(standT));

  let end = 0;
  cake.tiers.forEach((tier, i) => {
    const start = 0.3 + i * 0.32;
    const t = clamp01((time - start) / 0.55);
    tier.visible = time >= start;
    tier.position.y = tier.userData.baseY + (1 - settle(t)) * 2.4;
    end = start + 0.55;
  });

  const decorT = clamp01((time - end - 0.05) / 0.5);
  cake.decor.visible = decorT > 0;
  cake.decor.scale.setScalar(Math.max(0.001, easeOutBack(decorT)));
  return decorT < 1;
}

function settle(x) {
  const c1 = 0.9;
  return 1 + (c1 + 1) * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}

// 2D outline of a tier, roughly `r` from the center. Shape y becomes world -z.
function outline(shape, r) {
  const s = new THREE.Shape();
  if (shape === 'square') {
    const half = r * 0.9;
    const k = r * 0.18;
    s.moveTo(-half + k, -half);
    s.lineTo(half - k, -half);
    s.quadraticCurveTo(half, -half, half, -half + k);
    s.lineTo(half, half - k);
    s.quadraticCurveTo(half, half, half - k, half);
    s.lineTo(-half + k, half);
    s.quadraticCurveTo(-half, half, -half, half - k);
    s.lineTo(-half, -half + k);
    s.quadraticCurveTo(-half, -half, -half + k, -half);
  } else if (shape === 'heart') {
    // Classic heart curve, re-centered and scaled; its point faces the front (+z).
    const k = (r * 2.15) / 22;
    const P = (x, yy) => [(x - 5) * k, (yy - 9.2) * k];
    s.moveTo(...P(5, 5));
    s.bezierCurveTo(...P(5, 5), ...P(4, 0), ...P(0, 0));
    s.bezierCurveTo(...P(-6, 0), ...P(-6, 7), ...P(-6, 7));
    s.bezierCurveTo(...P(-6, 11), ...P(-3, 15.4), ...P(5, 19));
    s.bezierCurveTo(...P(12, 15.4), ...P(16, 11), ...P(16, 7));
    s.bezierCurveTo(...P(16, 7), ...P(16, 0), ...P(10, 0));
    s.bezierCurveTo(...P(7, 0), ...P(5, 5), ...P(5, 5));
  } else {
    s.absarc(0, 0, r, 0, Math.PI * 2, false);
  }
  return s;
}

// Returns a function giving the point on the tier's edge in a world direction (radians, +x = 0, front +z = PI/2).
function edgeSampler(shape, r) {
  const pts = outline(shape, r).getSpacedPoints(240).map((p) => {
    const x = p.x;
    const z = -p.y;
    return { x, z, angle: Math.atan2(z, x), dist: Math.hypot(x, z) };
  });
  return (angle, factor = 1) => {
    let best = pts[0];
    let bestDiff = Infinity;
    for (const p of pts) {
      const diff = Math.abs(Math.atan2(Math.sin(p.angle - angle), Math.cos(p.angle - angle)));
      if (diff < bestDiff) { bestDiff = diff; best = p; }
    }
    return new THREE.Vector3(best.x * factor, 0, best.z * factor);
  };
}

// Shared shapes for drips and their beads, scaled per instance. Never disposed.
const UNIT_DRIP_RADIUS = 0.055;
const UNIT_DRIP_HEIGHT = 0.3 + UNIT_DRIP_RADIUS * 2;
const UNIT_DRIP = new THREE.CapsuleGeometry(UNIT_DRIP_RADIUS, 0.3, 4, 10);
const UNIT_BEAD_RADIUS = 0.06;
const UNIT_BEAD = new THREE.SphereGeometry(UNIT_BEAD_RADIUS, 12, 10);
UNIT_DRIP.userData.shared = true;
UNIT_BEAD.userData.shared = true;

// Points per curve of each outline: a circle is one curve, a heart is six, a square's corners are four small ones.
const CURVE_SEGMENTS = { round: 64, heart: 14, square: 8 };

// Tier shapes are the slowest thing to build, and the same few are needed over and over
// (a color or topping change keeps every tier the same shape), so they're cached.
const solidCache = new Map();

function solid(shape, r, h, bevel = BEVEL) {
  const key = `${shape}|${r.toFixed(3)}|${h.toFixed(3)}|${bevel}`;
  const cached = solidCache.get(key);
  if (cached) return cached;

  let geo = new THREE.ExtrudeGeometry(outline(shape, r - bevel), {
    depth: Math.max(0.001, h - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: CURVE_SEGMENTS[shape] || 64,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bevel, 0);
  // Weld the vertices so the frosting shades smoothly instead of in flat facets.
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo, 1e-4);
  geo.computeVertexNormals();
  geo.userData.shared = true;

  if (solidCache.size > 60) solidCache.delete(solidCache.keys().next().value);
  solidCache.set(key, geo);
  return geo;
}

function buildTier(shape, r, h, color, drip) {
  const tier = new THREE.Group();
  const body = new THREE.Mesh(solid(shape, r, h), frostingMaterial(color));
  body.userData.receive = true;
  body.userData.keep = true;
  tier.add(body);

  const sampler = outline(shape, r);
  const perimeter = sampler.getLength();

  // Piped pearl border around the base.
  const pearlCount = Math.floor(perimeter / 0.13);
  const pearls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 14, 10), frostingMaterial(lighten(color, 0.12)), pearlCount);
  const m = new THREE.Matrix4();
  sampler.getSpacedPoints(pearlCount).slice(0, pearlCount).forEach((p, i) => {
    m.makeTranslation(p.x, 0.07, -p.y);
    pearls.setMatrixAt(i, m);
  });
  tier.add(pearls);

  if (drip) {
    const mat = dripMaterial(drip.color, drip.metallic);
    const cap = new THREE.Mesh(solid(shape, r + 0.018, 0.08, 0.035), mat);
    cap.position.y = h - 0.05;
    tier.add(cap);

    // Every drip is the same unit capsule, stretched per instance; beads are one sphere, likewise.
    const count = Math.floor(perimeter / 0.16);
    const rng = random(31 + drip.seed * 17);
    const drips = new THREE.InstancedMesh(UNIT_DRIP, mat, count);
    const beads = new THREE.InstancedMesh(UNIT_BEAD, mat, count);
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    let beadCount = 0;
    sampler.getSpacedPoints(count).slice(0, count).forEach((p, i) => {
      const len = (0.04 + rng() ** 1.6 * 0.5) * Math.min(1, h);
      const rad = 0.042 + rng() * 0.026;
      const out = new THREE.Vector2(p.x, p.y).normalize().multiplyScalar(0.012);
      pos.set(p.x + out.x, h - len / 2 - 0.04, -(p.y + out.y));
      scale.set(rad / UNIT_DRIP_RADIUS, (len + rad * 2) / UNIT_DRIP_HEIGHT, rad / UNIT_DRIP_RADIUS);
      drips.setMatrixAt(i, m.compose(pos, q, scale));
      // A slightly fatter bead where the drip has pooled at its tip.
      if (len > 0.12) {
        pos.y = h - len - 0.04;
        scale.setScalar((rad * 1.22) / UNIT_BEAD_RADIUS);
        beads.setMatrixAt(beadCount++, m.compose(pos, q, scale));
      }
    });
    beads.count = beadCount;
    tier.add(drips, beads);
  } else {
    // Without a drip, finish the top edge with smaller pearls.
    const n = Math.floor(perimeter / 0.11);
    const topPearls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.058, 12, 8), frostingMaterial(lighten(color, 0.18)), n);
    outline(shape, r - 0.07).getSpacedPoints(n).slice(0, n).forEach((p, i) => {
      m.makeTranslation(p.x, h - 0.005, -p.y);
      topPearls.setMatrixAt(i, m);
    });
    tier.add(topPearls);
  }
  return tier;
}

function buildStand(cakeRadius, wide = false) {
  const stand = new THREE.Group();
  const R = cakeRadius * (wide ? 1.52 : 1.24) + 0.15;
  const mat = gold();

  const plate = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.96, 0.08, 96), mat);
  plate.userData.receive = true;
  plate.position.y = STAND_HEIGHT - 0.04;
  stand.add(plate);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.035, 12, 120), mat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = STAND_HEIGHT - 0.03;
  stand.add(rim);

  const profile = [
    [0.001, 0], [R * 0.48, 0], [R * 0.48, 0.05], [R * 0.3, 0.1], [0.2, 0.18],
    [0.13, 0.35], [0.12, 0.5], [0.16, 0.62], [0.32, STAND_HEIGHT - 0.08], [0.001, STAND_HEIGHT - 0.08],
  ].map(([x, yy]) => new THREE.Vector2(x, yy));
  stand.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 72), mat));
  return stand;
}

// ---------------------------------------------------------------- toppings

function mesh(geo, mat, x, y, z) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  return o;
}

function berries(top, rng) {
  const g = new THREE.Group();
  const rasp = new THREE.MeshStandardMaterial({ color: 0xb3203b, roughness: 0.55, flatShading: true });
  const blue = new THREE.MeshStandardMaterial({ color: 0x2b3263, roughness: 0.3 });
  const mint = new THREE.MeshStandardMaterial({ color: 0x4f8a3a, roughness: 0.5 });
  for (let i = 0; i < 16; i++) {
    const angle = -Math.PI * 1.05 + (i / 15) * Math.PI * 1.1 + (rng() - 0.5) * 0.15;
    const p = top.edge(angle, 0.62 + rng() * 0.16);
    if (i % 3 === 2) {
      g.add(mesh(new THREE.SphereGeometry(0.075, 16, 12), blue, p.x, top.y + 0.07, p.z));
    } else {
      const berry = mesh(new THREE.IcosahedronGeometry(0.105, 1), rasp, p.x, top.y + 0.1, p.z);
      berry.scale.set(1, 1.15, 1);
      berry.rotation.set(rng(), rng(), rng());
      g.add(berry);
    }
    if (i % 5 === 1) {
      const leaf = mesh(new THREE.SphereGeometry(0.11, 12, 8), mint, p.x * 0.9, top.y + 0.13, p.z * 0.9);
      leaf.scale.set(1, 0.18, 0.5);
      leaf.rotation.y = rng() * Math.PI;
      leaf.rotation.z = 0.4;
      g.add(leaf);
    }
  }
  return g;
}

function macarons(top, gapAtFront) {
  const g = new THREE.Group();
  const colors = [0xf2b8c6, 0xc9e4b4, 0xd9c7ef, 0xf6e3a1, 0xf7cfb0];
  const cream = new THREE.MeshStandardMaterial({ color: 0xfaf3e6, roughness: 0.7 });
  const count = 7;
  let placed = 0;
  for (let i = 0; i < count + 2 && placed < count; i++) {
    const angle = Math.PI / 2 + ((i + 0.5) / (count + 1)) * Math.PI * 2;
    if (gapAtFront && Math.abs(Math.atan2(Math.sin(angle - Math.PI / 2), Math.cos(angle - Math.PI / 2))) < 0.6) continue;
    const p = top.edge(angle, 0.74);
    const shell = new THREE.MeshStandardMaterial({ color: colors[placed % colors.length], roughness: 0.65 });
    const mac = new THREE.Group();
    const lower = mesh(new THREE.SphereGeometry(0.17, 24, 14), shell, 0, 0.06, 0);
    lower.scale.set(1, 0.36, 1);
    const upper = lower.clone();
    upper.position.y = 0.17;
    mac.add(lower, upper, mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.06, 24), cream, 0, 0.115, 0));
    mac.position.set(p.x, top.y + 0.02, p.z);
    mac.lookAt(p.x * 2, top.y + 0.02, p.z * 2);
    mac.rotateX(-0.45);
    g.add(mac);
    placed++;
  }
  return g;
}

function cherries(top, gapAtFront) {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0x8e0f22, roughness: 0.12 });
  const stem = new THREE.MeshStandardMaterial({ color: 0x5b6b2a, roughness: 0.6 });
  const count = 8;
  for (let i = 0; i < count; i++) {
    const angle = Math.PI / 2 + ((i + 0.5) / count) * Math.PI * 2;
    if (gapAtFront && Math.abs(Math.atan2(Math.sin(angle - Math.PI / 2), Math.cos(angle - Math.PI / 2))) < 0.5) continue;
    const p = top.edge(angle, 0.84);
    g.add(mesh(new THREE.SphereGeometry(0.1, 20, 16), red, p.x, top.y + 0.1, p.z));
    const s = mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.26, 6), stem, p.x, top.y + 0.28, p.z);
    s.rotation.z = 0.35;
    s.rotation.y = angle;
    g.add(s);
  }
  return g;
}

function flowers(top) {
  const g = new THREE.Group();
  const petalColors = [0xfbf4ef, 0xf4b6c2, 0xcbb7ea];
  const center = new THREE.MeshStandardMaterial({ color: 0xf2c84b, roughness: 0.5 });
  [[Math.PI * 0.18, 0.62], [Math.PI * 0.32, 0.8], [Math.PI * 0.02, 0.8]].forEach(([angle, f], i) => {
    const p = top.edge(angle, f);
    const flower = new THREE.Group();
    const petal = new THREE.MeshStandardMaterial({ color: petalColors[i % 3], roughness: 0.6, side: THREE.DoubleSide });
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const pm = mesh(new THREE.SphereGeometry(0.1, 14, 10), petal, Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1);
      pm.scale.set(1, 0.3, 0.62);
      pm.rotation.y = -a;
      flower.add(pm);
    }
    flower.add(mesh(new THREE.SphereGeometry(0.045, 12, 10), center, 0, 0.03, 0));
    flower.position.set(p.x, top.y + 0.05, p.z);
    flower.rotation.set(-0.25, i, 0);
    g.add(flower);
  });
  return g;
}

function shards(top, rng) {
  const g = new THREE.Group();
  const choc = new THREE.MeshStandardMaterial({ color: 0x2a150c, roughness: 0.22 });
  for (let i = 0; i < 5; i++) {
    const p = top.edge(-Math.PI / 2 + (i - 2) * 0.45, 0.32 + rng() * 0.15);
    const w = 0.35 + rng() * 0.25;
    const h = 0.45 + rng() * 0.3;
    const shard = mesh(new THREE.BoxGeometry(w, h, 0.025), choc, p.x, top.y + h * 0.38, p.z);
    shard.rotation.set((rng() - 0.5) * 0.5, rng() * Math.PI, (rng() - 0.5) * 0.6);
    g.add(shard);
  }
  return g;
}

function goldLeaf(top, radii, heights, rng) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xe1b866, metalness: 1, roughness: 0.28, side: THREE.DoubleSide });
  for (let i = 0; i < 26; i++) {
    const flake = new THREE.Mesh(new THREE.CircleGeometry(0.05 + rng() * 0.06, 5), mat);
    flake.userData.noShadow = true;
    const angle = rng() * Math.PI * 2;
    if (i < 9) {
      const p = top.edge(angle, 0.2 + rng() * 0.65);
      flake.position.set(p.x, top.y + 0.012, p.z);
      flake.rotation.set(-Math.PI / 2, 0, rng() * Math.PI);
    } else {
      // On the side of the top tier.
      const p = top.edge(angle, 1.012);
      flake.position.set(p.x, top.y - 0.15 - rng() * (top.h - 0.3), p.z);
      flake.lookAt(p.x * 2, flake.position.y, p.z * 2);
      flake.rotateZ(rng() * Math.PI);
    }
    g.add(flake);
  }
  return g;
}

function sprinkles(top, rng) {
  const count = 320;
  const palette = ['#f5b8c9', '#9ad0ec', '#ffe08a', '#b8e0a8', '#ffffff', '#f7a072', '#c9a7eb'].map((c) => new THREE.Color(c));
  const mesh = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.014, 0.055, 2, 5), new THREE.MeshStandardMaterial({ roughness: 0.45 }), count);
  mesh.userData.noShadow = true;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let i = 0; i < count; i++) {
    const p = top.edge(rng() * Math.PI * 2, Math.sqrt(rng()) * 0.9);
    e.set(Math.PI / 2, 0, rng() * Math.PI * 2);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(p.x, top.y + 0.016, p.z), q, new THREE.Vector3(1, 1, 1));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, palette[i % palette.length]);
  }
  return mesh;
}

// ---------------------------------------------------------------- extras

function candles(top, wishMode = false) {
  const group = new THREE.Group();
  const colors = [0xf7d9e3, 0xfdf3dc, 0xd7e8f5, 0xf3e1b5];
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffd17a, toneMapped: false });
  const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffb35a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const flames = [];
  const n = 5;
  const baseGlow = wishMode ? 0.62 : 0.42;
  const baseLight = wishMode ? 4.8 : 2.5;
  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + (i - (n - 1) / 2) * 0.55;
    const p = top.edge(angle, 0.42);
    const candle = new THREE.Group();
    const wax = new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.5 });
    candle.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 14), wax, 0, 0.275, 0));
    candle.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 6), new THREE.MeshBasicMaterial({ color: 0x222222 }), 0, 0.58, 0));
    const flame = mesh(new THREE.SphereGeometry(0.04, 12, 10), flameMat, 0, 0.66, 0);
    flame.userData.keep = true; // animated, so it can't be merged
    flame.scale.set(1, 2.1, 1);
    flame.userData.noShadow = true;
    const glow = new THREE.Sprite(glowMat);
    glow.scale.setScalar(baseGlow);
    glow.position.y = 0.66;
    candle.add(flame, glow);
    candle.position.set(p.x, top.y, p.z);
    group.add(candle);
    flames.push({ flame, glow, phase: i * 1.7 });
  }
  const light = new THREE.PointLight(0xffb560, baseLight, wishMode ? 6.5 : 4, 2);
  light.position.set(0, top.y + 0.8, -0.2);
  group.add(light);

  return {
    group,
    animate(t) {
      if (reduceMotion) return;
      for (const f of flames) {
        const flicker = 1 + Math.sin(t * 17 + f.phase) * 0.08 + Math.sin(t * 29 + f.phase * 2) * 0.05;
        f.flame.scale.set(1, 2.1 * flicker, 1);
        f.glow.scale.setScalar(baseGlow * flicker);
      }
      light.intensity = baseLight + Math.sin(t * 13) * (wishMode ? 0.55 : 0.3);
    },
  };
}

function topper(top) {
  const g = new THREE.Group();
  const mat = gold();
  const texture = textTexture(1024, 400, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#fbe7b0');
    grad.addColorStop(0.5, '#d9b066');
    grad.addColorStop(1, '#a57936');
    ctx.fillStyle = grad;
    fitText(ctx, 'Happy Birthday', w * 0.92, 200, '"Great Vibes", cursive');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Happy Birthday', w / 2, h / 2);
  });
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.58),
    new THREE.MeshStandardMaterial({ map: texture, transparent: true, alphaTest: 0.2, metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide }),
  );
  const back = top.edge(-Math.PI / 2, 0.35);
  sign.position.set(back.x, top.y + 0.95, back.z);
  sign.userData.noShadow = true;
  g.add(sign);
  for (const x of [-0.42, 0.42]) {
    g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.75, 8), mat, back.x + x, top.y + 0.37, back.z));
  }
  return g;
}

function sparklers(top) {
  const group = new THREE.Group();
  const stickMat = new THREE.MeshStandardMaterial({ color: 0x6b6b6b, metalness: 0.6, roughness: 0.4 });
  const sets = [-0.35, 0.35].map((dx, i) => {
    const p = top.edge(-Math.PI / 2 + dx, 0.45);
    group.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.75, 6), stickMat, p.x, top.y + 0.37, p.z));
    const count = 70;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const life = new Float32Array(count);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({
      map: glowTexture(), color: 0xffe6a8, size: 0.07, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    const tip = new THREE.Vector3(p.x, top.y + 0.72, p.z);
    const rng = random(91 + i);
    const respawn = (k) => {
      positions.set([tip.x, tip.y, tip.z], k * 3);
      const a = rng() * Math.PI * 2;
      const up = rng() * 1.6 - 0.3;
      velocities.set([Math.cos(a) * 0.9, up, Math.sin(a) * 0.9], k * 3);
      life[k] = 0.15 + rng() * 0.35;
    };
    for (let k = 0; k < count; k++) { respawn(k); life[k] *= rng(); }
    group.add(points);
    return { geo, positions, velocities, life, respawn, count };
  });

  return {
    group,
    animate(t, dt) {
      if (reduceMotion) return;
      for (const s of sets) {
        for (let k = 0; k < s.count; k++) {
          s.life[k] -= dt;
          if (s.life[k] <= 0) { s.respawn(k); continue; }
          s.velocities[k * 3 + 1] -= dt * 2.5;
          s.positions[k * 3] += s.velocities[k * 3] * dt;
          s.positions[k * 3 + 1] += s.velocities[k * 3 + 1] * dt;
          s.positions[k * 3 + 2] += s.velocities[k * 3 + 2] * dt;
        }
        s.geo.attributes.position.needsUpdate = true;
      }
    },
  };
}

function plaque(top, message, shape) {
  const g = new THREE.Group();
  const stretch = 1.55;
  const texture = textTexture(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#4C2007';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(1 / stretch, 1);
    ctx.strokeStyle = '#d9b066';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.44, 0, Math.PI * 2);
    ctx.stroke();

    // Embossed SAVORY cocoa-pod seal at the top of the plaque
    drawSavoryPod(ctx, 0, -w * 0.28, 120, '#d9b066');

    ctx.fillStyle = '#F7F7D3';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = wrap(message, 18);
    const size = fitText(ctx, lines.reduce((a, b) => (a.length > b.length ? a : b)), w * 1.08, lines.length > 1 ? 140 : 185, '"Great Vibes", "Amiri", cursive, serif');
    lines.forEach((line, i) => ctx.fillText(line, 0, 32 + (i - (lines.length - 1) / 2) * size * 1.05));
    ctx.restore();
  });
  const side = new THREE.MeshStandardMaterial({ color: 0x3a1805, roughness: 0.42 });
  const face = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.42 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 48), [side, face, side]);
  // A cylinder's top-cap texture runs along its local z axis, so stretch z and turn it to face the front.
  disc.scale.z = stretch;
  disc.rotation.y = Math.PI / 2;
  disc.userData.noShadow = true;
  const front = top.edge(Math.PI / 2, shape === 'heart' ? 0.2 : 0.42);
  g.position.set(front.x, top.y + 0.09, front.z);
  g.rotation.x = 0.32;
  g.add(disc);
  return g;
}

// ---------------------------------------------------------------- sparkle dust

function createSparkles() {
  const count = 140;
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const rng = random(3);
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const r = 1.5 + rng() * 3.5;
    positions.set([Math.cos(a) * r, rng() * 6, Math.sin(a) * r - 0.5], i * 3);
    speeds[i] = 0.08 + rng() * 0.22;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    map: glowTexture(), color: 0xf3d08a, size: 0.09, transparent: true, opacity: 0.85,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  return {
    points,
    animate(dt) {
      if (reduceMotion) return;
      for (let i = 0; i < count; i++) {
        positions[i * 3 + 1] += speeds[i] * dt;
        if (positions[i * 3 + 1] > 6) positions[i * 3 + 1] = 0;
      }
      geo.attributes.position.needsUpdate = true;
      points.rotation.y += dt * 0.03;
    },
  };
}

// ---------------------------------------------------------------- helpers

let glow = null;
function glowTexture() {
  if (glow) return glow;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,240,200,0.8)');
  grad.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  glow = new THREE.CanvasTexture(c);
  glow.userData.shared = true;
  return glow;
}

// Draws text onto a canvas texture, and redraws once the script font has loaded.
function textTexture(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const paint = () => {
    ctx.clearRect(0, 0, w, h);
    draw(ctx, w, h);
    texture.needsUpdate = true;
  };
  paint();
  if (document.fonts && !document.fonts.check('80px "Great Vibes"')) {
    document.fonts.load('80px "Great Vibes"').then(paint).catch(() => {});
  }
  return texture;
}

function fitText(ctx, text, maxWidth, maxSize, family) {
  let size = maxSize;
  do {
    ctx.font = `${size}px ${family}`;
    size -= 6;
  } while (ctx.measureText(text).width > maxWidth && size > 30);
  return size + 6;
}

function wrap(text, max) {
  if (text.length <= max) return [text];
  const words = text.split(/\s+/);
  const lines = [''];
  for (const word of words) {
    const line = lines[lines.length - 1];
    if ((line + ' ' + word).trim().length > max && line && lines.length < 3) lines.push(word);
    else lines[lines.length - 1] = (line + ' ' + word).trim();
  }
  return lines;
}

function random(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function easeOutBack(x) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}

// Merges the many small meshes inside `root` (drips, beads, berries, gold flakes…) into one mesh
// per material. A cake goes from several hundred draw calls to a few dozen.
// Skips instanced meshes, textured or multi-material meshes, and anything marked userData.keep.
function flatten(root) {
  root.updateMatrixWorld(true);
  const toLocal = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const merged = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.keep || Array.isArray(o.material) || o.material.map) return;
    const key = `${o.material.uuid}:${o.userData.noShadow ? 0 : 1}`;
    if (!buckets.has(key)) buckets.set(key, { material: o.material, noShadow: Boolean(o.userData.noShadow), geometries: [] });
    const matrix = new THREE.Matrix4().multiplyMatrices(toLocal, o.matrixWorld);
    buckets.get(key).geometries.push(o.geometry.clone().applyMatrix4(matrix));
    merged.push(o);
  });

  for (const o of merged) {
    o.parent.remove(o);
    if (!o.geometry.userData.shared) o.geometry.dispose();
  }

  for (const { material, noShadow, geometries } of buckets.values()) {
    let list = geometries;
    if (list.some((g) => !g.index)) list = list.map((g) => (g.index ? g.toNonIndexed() : g));
    const shared = Object.keys(list[0].attributes).filter((name) => list.every((g) => g.attributes[name]));
    for (const g of list) {
      for (const name of Object.keys(g.attributes)) if (!shared.includes(name)) g.deleteAttribute(name);
      g.clearGroups();
    }
    const geometry = list.length === 1 ? list[0] : mergeGeometries(list, false);
    if (!geometry) continue;
    if (list.length > 1) list.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.noShadow = noShadow;
    root.add(mesh);
  }
}

function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    const materials = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const mat of materials) {
      if (mat.map && !mat.map.userData.shared) mat.map.dispose();
      mat.dispose();
    }
  });
}
