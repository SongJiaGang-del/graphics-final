// main.js — 入口：创建渲染器、装配各模块、驱动渲染循环
import * as THREE from 'three';
import { buildScene } from './scene.js';
import { createCamera, createOrthoCamera, updateOrthoAspect, setupControls } from './camera.js';
import { setupPostProcess } from './postProcess.js';
import { setupPicker } from './picker.js';
import { buildUI } from './ui.js';
import { createBlinnPhongSystem } from './shaders/blinnPhong.js';

const canvas = document.getElementById('app');

// --- 渲染器 ---
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.info.autoReset = false; // 手动重置，统计后处理多 Pass 的真实 draw call

// --- 场景 & 相机 ---
const scene = new THREE.Scene();
const aspect0 = window.innerWidth / window.innerHeight;
const camera = createCamera(aspect0);
camera.position.set(3.5, 1.8, 3.5); // 房间角落起始位置
// 正交相机：与透视相机共享位置/朝向，用于投影方式切换
const orthoCamera = createOrthoCamera(aspect0);
let useOrtho = false;

// 加载失败兜底：避免 GLB 缺失/路径错误时静默黑屏
function showError(title, err) {
  console.error(title, err);
  const hint = document.getElementById('hint');
  if (hint) {
    hint.style.cursor = 'default';
    hint.innerHTML =
      `<div style="color:#e06c75">⚠ ${title}</div>` +
      `<small style="max-width:560px;text-align:center">${err?.message || err}</small>` +
      `<small style="color:#707a8a">请确认 assets/models/scene.glb 存在，且通过本地服务器(Live Server)打开而非 file://</small>`;
  }
}

// GLB 异步加载，先拿到 pickables/灯光 再装配依赖它们的模块
let pickables, keyLight, lampLight, ambient;
try {
  ({ pickables, keyLight, lampLight, ambient } = await buildScene(scene));
} catch (err) {
  showError('场景模型加载失败', err);
  throw err; // 中止后续初始化
}
camera.lookAt(0, 0.8, 0); // 初始朝向房间中心（家具方向）

// --- 控制器 ---
const controls = setupControls(camera, canvas);

// --- 后处理 ---
const post = setupPostProcess(renderer, scene, camera);
post.setSize(window.innerWidth, window.innerHeight, renderer.getPixelRatio());

// 阴影开关：切换灯光投射 + 强制材质重新编译着色器
function setShadowEnabled(on) {
  renderer.shadowMap.enabled = on;
  keyLight.castShadow = on;
  if (lampLight) lampLight.castShadow = on;
  scene.traverse((o) => {
    if (o.isMesh) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => { m.needsUpdate = true; });
    }
  });
}

// 投影切换：换 RenderPass 相机；正交相机每帧同步透视相机的位姿
function setOrtho(on) {
  useOrtho = on;
  post.setCamera(on ? orthoCamera : camera);
}

// --- 当前选中物体（用于材质参数实时调节）---
let selectedName = null;
function selectedMeshes() {
  return selectedName ? pickables.filter((m) => m.userData.displayName === selectedName) : [];
}
function applyMaterial(prop, value) {
  for (const m of selectedMeshes()) {
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    mats.forEach((mat) => { if (prop in mat) mat[prop] = value; });
  }
}

// --- Blinn-Phong 自定义着色器（可与 PBR 切换对比）---
const blinn = createBlinnPhongSystem(keyLight, lampLight, ambient.color, ambient.intensity);
let useBlinn = false;
const pbrMats = new Map();    // 原始 PBR 材质
const blinnMats = new Map();  // 对应的 Blinn-Phong 材质
for (const m of pickables) {
  pbrMats.set(m, m.material);
  const make = (mat) => blinn.makeMaterial(mat.color ?? new THREE.Color(0xcccccc));
  blinnMats.set(m, Array.isArray(m.material) ? m.material.map(make) : make(m.material));
}
function setBlinn(on) {
  useBlinn = on;
  for (const m of pickables) m.material = on ? blinnMats.get(m) : pbrMats.get(m);
}

// --- UI ---
let autoRotate = true;
const ui = buildUI({
  onLightIntensity: (v) => { keyLight.intensity = v; },
  onShadow: (on) => setShadowEnabled(on),
  onOrtho: (on) => setOrtho(on),
  onAutoRotate: (on) => { autoRotate = on; },
  onBloomToggle: (on) => post.setBloomEnabled(on),
  onBloomStrength: (v) => post.setBloomStrength(v),
  onEdgeToggle: (on) => post.setEdgeEnabled(on),
  onEdgeStrength: (v) => post.setEdgeStrength(v),
  onMetalness: (v) => applyMaterial('metalness', v),
  onRoughness: (v) => applyMaterial('roughness', v),
  onBlinnToggle: (on) => setBlinn(on),
});

// --- 拾取（选中后回显材质参数到滑块）---
setupPicker(camera, pickables, (mesh) => {
  selectedName = mesh?.userData.displayName ?? null;
  ui.setPicked(selectedName);
  if (mesh) {
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    ui.setMaterialSliders(mat.metalness ?? 0, mat.roughness ?? 0.5);
  }
}, controls.isLocked);

// --- 渲染循环 ---
const clock = new THREE.Clock();
let frames = 0, fpsTime = 0, fps = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  renderer.info.reset(); // 每帧开始重置，累计本帧所有 render 调用

  controls.update(dt);

  // 正交相机跟随透视相机的位置与朝向（投影方式不同，视角一致）
  if (useOrtho) {
    orthoCamera.position.copy(camera.position);
    orthoCamera.quaternion.copy(camera.quaternion);
  }

  if (autoRotate) {
    for (const m of pickables) {
      if (m.userData.displayName === 'DisplayBall') m.rotation.y += 0.6 * dt;
    }
  }

  if (useBlinn) blinn.update(); // 刷新 Blinn-Phong 灯光/相机 uniform

  post.render();

  // FPS / draw call 统计（每 0.5s 刷新）
  frames++; fpsTime += dt;
  if (fpsTime >= 0.5) {
    fps = Math.round(frames / fpsTime);
    frames = 0; fpsTime = 0;
    const info = renderer.info.render;
    ui.setStats(`${fps} FPS · ${info.calls} draw calls · ${(info.triangles / 1000).toFixed(1)}k 三角面`);
  }
}
animate();

// --- 窗口自适应 ---
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  updateOrthoAspect(orthoCamera, w / h);
  renderer.setSize(w, h);
  post.setSize(w, h, renderer.getPixelRatio());
});

// 暴露到全局，方便在 DevTools Console 调试（见指南第六节）
window.renderer = renderer;
window.camera = camera;
window.scene = scene;
