// scene.js — 加载 Blender 建模导出的 GLB 场景，配置光照、阴影、法线贴图
//
// 所有几何模型（房间、桌、椅、台灯、书、装饰球）均在 Blender 中建模，
// 导出为 assets/models/scene.glb，这里用 GLTFLoader 载入。
// 地面/墙面的法线贴图在运行时程序化生成，增强微观凹凸细节（试卷要求 2-(4)）。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ---- 程序化法线贴图（由噪声高度场用 Sobel 求梯度生成切线空间法线）----
function makeNormalTexture(size = 256, strength = 2.0) {
  // 1) 生成平滑噪声高度场
  const h = new Float32Array(size * size);
  for (let i = 0; i < h.length; i++) h[i] = Math.random();
  // 简单 box blur 让高度场连续
  const tmp = new Float32Array(h);
  const idx = (x, y) => ((y + size) % size) * size + ((x + size) % size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) s += tmp[idx(x + dx, y + dy)];
      h[y * size + x] = s / 9;
    }
  // 2) Sobel 梯度 → 法线
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const gx = h[idx(x + 1, y)] - h[idx(x - 1, y)];
      const gy = h[idx(x, y + 1)] - h[idx(x, y - 1)];
      const nx = -gx * strength, ny = -gy * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const o = (y * size + x) * 4;
      img.data[o]     = (nx / len * 0.5 + 0.5) * 255;
      img.data[o + 1] = (ny / len * 0.5 + 0.5) * 255;
      img.data[o + 2] = (nz / len * 0.5 + 0.5) * 255;
      img.data[o + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const PICKABLE_NAMES = ['Desk', 'Chair', 'Lamp', 'Book', 'Pedestal', 'DisplayBall'];

/**
 * 异步构建场景：加载 GLB 模型 + 光照。
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

  // 法线贴图（地面/墙面）
  const normalTex = makeNormalTexture();

  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const mat = o.material;
    if (mat && mat.isMeshStandardMaterial) {
      // 给地面和墙体附加法线贴图，体现微观凹凸
      if (/Floor|Wall/i.test(o.name) || /Floor|Wall/i.test(o.parent?.name || '')) {
        const t = normalTex.clone();
        t.needsUpdate = true;
        t.repeat.set(8, 8);
        mat.normalMap = t;
        mat.normalScale = new THREE.Vector2(0.6, 0.6);
        mat.needsUpdate = true;
      }
      mat.userData.baseColor = mat.color.getHex();
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
        // 克隆材质，保证高亮拾取互不串色
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
