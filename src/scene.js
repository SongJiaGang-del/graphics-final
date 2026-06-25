// scene.js — 加载 Blender 建模导出的 GLB 场景，配置光照、阴影，并为各模型贴上
// 由 Gemini 生成的写实基础色贴图（assets/textures/*_albedo.png）。
//
// 所有几何模型（房间、桌、椅、台灯、书、装饰台座、装饰球）均在 Blender 中建模，
// 导出为 assets/models/scene.glb，这里用 GLTFLoader 载入。
//
// 完整 PBR 流程（试卷要求 2-(4) 微观凹凸 / 材质）：
//   · 基础色 (albedo)  —— Gemini 写实贴图，直接加载（sRGB）。
//   · 法线   (normal)  —— 运行时由基础色亮度场用 Sobel 求梯度派生（切线空间）。
//   · 粗糙度 (roughness)—— 运行时由基础色亮度派生（暗处更粗糙），范围按材质调。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// 每个逻辑对象 → 贴图与材质参数。repeat 控制平铺次数，normal 控制法线强度，
// rough:[min,max] 是派生粗糙度的范围，metal 是金属度。
const TEX_CONFIG = {
  Floor:       { file: 'floor_albedo.png',       repeat: [6, 6], normal: 1.2, rough: [0.55, 0.90], metal: 0.0 },
  Wall:        { file: 'wall_albedo.png',         repeat: [4, 3], normal: 0.7, rough: [0.80, 1.00], metal: 0.0 },
  Desk:        { file: 'desk_albedo.png',         repeat: [2, 2], normal: 0.8, rough: [0.30, 0.60], metal: 0.0 },
  Chair:       { file: 'chair_albedo.png',        repeat: [2, 2], normal: 0.8, rough: [0.35, 0.65], metal: 0.0 },
  Lamp:        { file: 'lamp_albedo.png',         repeat: [1, 1], normal: 0.5, rough: [0.20, 0.45], metal: 0.9 },
  Book:        { file: 'book_albedo.png',         repeat: [1, 1], normal: 1.0, rough: [0.45, 0.80], metal: 0.0 },
  Pedestal:    { file: 'pedestal_albedo.png',     repeat: [1, 1], normal: 0.4, rough: [0.10, 0.35], metal: 0.0 },
  DisplayBall: { file: 'displayball_albedo.png',  repeat: [1, 1], normal: 0.4, rough: [0.05, 0.25], metal: 0.3 },
};

const PICKABLE_NAMES = ['Desk', 'Chair', 'Lamp', 'Book', 'Pedestal', 'DisplayBall'];

// ---- 加载图片为 HTMLImageElement（用于建纹理 + 读像素派生贴图）----
function loadImage(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('texture load failed: ' + url));
    img.src = url;
  });
}

// ---- 由基础色图派生 法线图 + 粗糙度图 ----
// 取亮度作为高度场，用 Sobel 求梯度得到切线空间法线；亮度同时映射到粗糙度区间。
function deriveMaps(img, { size = 512, roughMin = 0.4, roughMax = 0.9 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;

  // 亮度高度场（Rec.601）
  const h = new Float32Array(size * size);
  for (let i = 0; i < h.length; i++) {
    h[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255;
  }
  const idx = (x, y) => ((y + size) % size) * size + ((x + size) % size); // 环绕取样保证可平铺

  const nCanvas = document.createElement('canvas'); nCanvas.width = nCanvas.height = size;
  const rCanvas = document.createElement('canvas'); rCanvas.width = rCanvas.height = size;
  const nCtx = nCanvas.getContext('2d'); const rCtx = rCanvas.getContext('2d');
  const nImg = nCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);

  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      // Sobel 梯度 → 法线（×6 放大微弱亮度梯度，最终强度再由 material.normalScale 调）
      const gx = h[idx(x + 1, y)] - h[idx(x - 1, y)];
      const gy = h[idx(x, y + 1)] - h[idx(x, y - 1)];
      const nx = -gx * 6, ny = -gy * 6, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const o = (y * size + x) * 4;
      nImg.data[o]     = (nx / len * 0.5 + 0.5) * 255;
      nImg.data[o + 1] = (ny / len * 0.5 + 0.5) * 255;
      nImg.data[o + 2] = (nz / len * 0.5 + 0.5) * 255;
      nImg.data[o + 3] = 255;

      // 粗糙度：亮处更光滑（高光更聚），暗处更粗糙
      const rough = roughMax - (roughMax - roughMin) * h[y * size + x];
      const rv = Math.max(0, Math.min(255, rough * 255));
      rImg.data[o] = rImg.data[o + 1] = rImg.data[o + 2] = rv;
      rImg.data[o + 3] = 255;
    }

  nCtx.putImageData(nImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  return { normalMap: new THREE.CanvasTexture(nCanvas), roughnessMap: new THREE.CanvasTexture(rCanvas) };
}

// ---- 加载一种材质（基础色 + 派生法线/粗糙度），并配置平铺 ----
async function loadMaterial(cfg) {
  const img = await loadImage('assets/textures/' + cfg.file);

  const albedo = new THREE.Texture(img);
  albedo.colorSpace = THREE.SRGBColorSpace;   // 基础色走 sRGB
  albedo.anisotropy = 8;
  albedo.needsUpdate = true;

  const { normalMap, roughnessMap } = deriveMaps(img, { roughMin: cfg.rough[0], roughMax: cfg.rough[1] });

  // 三张图统一平铺设置（法线/粗糙度为线性数据，CanvasTexture 默认即线性）
  for (const t of [albedo, normalMap, roughnessMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(cfg.repeat[0], cfg.repeat[1]);
  }
  return { albedo, normalMap, roughnessMap };
}

/**
 * 异步构建场景：加载 GLB 模型 + 光照 + 贴图。
 * @returns {Promise<{ pickables, keyLight, ambient, lampLight }>}
 */
export async function buildScene(scene) {
  scene.background = new THREE.Color(0x0b0d12);
  scene.fog = new THREE.Fog(0x0b0d12, 14, 45);

  // --- 光照（环境 + 主方向光带阴影 + 台灯点光）---
  const ambient = new THREE.AmbientLight(0x404a5c, 0.5);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xfff1d0, 1.6);
  keyLight.position.set(4, 8, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);   // 阴影贴图 ≥1024×1024（试卷要求）
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 30;
  keyLight.shadow.camera.left = -8;
  keyLight.shadow.camera.right = 8;
  keyLight.shadow.camera.top = 8;
  keyLight.shadow.camera.bottom = -8;
  keyLight.shadow.bias = -0.0004;
  keyLight.shadow.radius = 4;                 // PCF 软阴影边缘
  scene.add(keyLight);
  scene.add(keyLight.target);

  const lampLight = new THREE.PointLight(0xffd9a0, 6, 8, 2);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(1024, 1024);
  scene.add(lampLight);

  // --- 加载 Blender 模型 ---
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync('assets/models/scene.glb');
  const root = gltf.scene;
  scene.add(root);

  // 由网格自身或祖先节点名判断它属于哪个逻辑对象（→ 选哪套贴图）
  const keyFor = (o) => {
    for (let n = o; n; n = n.parent) {
      const nm = n.name || '';
      for (const k of Object.keys(TEX_CONFIG)) if (new RegExp(k, 'i').test(nm)) return k;
    }
    return null;
  };

  // 先收集场景实际用到的材质键，只加载这些贴图
  const used = new Set();
  root.traverse((o) => { if (o.isMesh) { const k = keyFor(o); if (k) used.add(k); } });
  const maps = {};
  await Promise.all([...used].map(async (k) => { maps[k] = await loadMaterial(TEX_CONFIG[k]); }));

  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const mat = o.material;
    if (!(mat && mat.isMeshStandardMaterial)) return;

    // 记录原始基础色（供 Blinn-Phong 对比模式使用），贴图模式下用纯白避免二次染色
    mat.userData.baseColor = mat.color.getHex();

    const k = keyFor(o);
    const m = k && maps[k];
    if (m) {
      const cfg = TEX_CONFIG[k];
      mat.color.setHex(0xffffff);
      mat.map = m.albedo;
      mat.normalMap = m.normalMap;
      mat.normalScale = new THREE.Vector2(cfg.normal, cfg.normal);
      mat.roughnessMap = m.roughnessMap;
      mat.roughness = 1.0;        // 真实粗糙度来自 roughnessMap
      mat.metalness = cfg.metal;
      mat.needsUpdate = true;
    }
  });

  // 收集可拾取物体（取每个命名节点下的网格）
  const pickables = [];
  for (const name of PICKABLE_NAMES) {
    const node = root.getObjectByName(name);
    if (!node) continue;
    node.traverse((o) => {
      if (o.isMesh) {
        o.userData.displayName = name;
        // 克隆材质，保证高亮拾取互不串色（贴图引用共享，无额外开销）
        o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
        pickables.push(o);
      }
    });
  }

  // 把台灯点光放到灯罩位置
  const lamp = root.getObjectByName('Lamp');
  if (lamp) {
    const p = new THREE.Vector3();
    lamp.getWorldPosition(p);
    lampLight.position.set(p.x, p.y + 0.55, p.z);
  } else {
    lampLight.position.set(-2.1, 1.4, 2.9);
  }

  return { pickables, keyLight, ambient, lampLight };
}
