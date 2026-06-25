// camera.js — 透视相机 + PointerLock 第一人称控制（WASD 移动 + 鼠标转视角）
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

export function createCamera(aspect) {
  const camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 200);
  camera.position.set(0, 1.7, 10); // 人眼高度
  return camera;
}

// 正交相机：与透视相机共享位置/朝向，仅投影方式不同（试卷要求 1-(4)）
export const ORTHO_FRUSTUM = 6; // 垂直视野世界尺寸（米）

export function createOrthoCamera(aspect) {
  const h = ORTHO_FRUSTUM / 2;
  const cam = new THREE.OrthographicCamera(-h * aspect, h * aspect, h, -h, 0.1, 200);
  return cam;
}

// 窗口尺寸变化时更新正交相机视锥
export function updateOrthoAspect(cam, aspect) {
  const h = ORTHO_FRUSTUM / 2;
  cam.left = -h * aspect; cam.right = h * aspect;
  cam.top = h; cam.bottom = -h;
  cam.updateProjectionMatrix();
}

/**
 * 装配第一人称控制器。
 * @returns { controls, update(dt), isLocked() }
 */
export function setupControls(camera, domElement, { onLock, onUnlock } = {}) {
  const controls = new PointerLockControls(camera, domElement);

  // 点击画面锁定鼠标
  domElement.addEventListener('click', () => controls.lock());
  controls.addEventListener('lock', () => { document.body.classList.add('locked'); onLock?.(); });
  controls.addEventListener('unlock', () => { document.body.classList.remove('locked'); onUnlock?.(); });

  // 键盘状态
  const keys = { forward: false, back: false, left: false, right: false, up: false, down: false };
  const map = {
    KeyW: 'forward', ArrowUp: 'forward',
    KeyS: 'back', ArrowDown: 'back',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    Space: 'up', ShiftLeft: 'down',
  };
  const onKey = (down) => (e) => {
    const k = map[e.code];
    if (k) { keys[k] = down; e.preventDefault(); }
  };
  document.addEventListener('keydown', onKey(true));
  document.addEventListener('keyup', onKey(false));

  const velocity = new THREE.Vector3();
  const SPEED = 8;       // 移动速度 (m/s)
  const DAMPING = 10;    // 阻尼，越大越跟手

  function update(dt) {
    // 键盘移动不依赖 PointerLock：即使锁定失败/未锁定，WASD 仍可用
    // （鼠标转视角仍由 PointerLockControls 在锁定时处理）

    // 目标速度（相机本地空间：x=右, z=前）
    const dir = new THREE.Vector3(
      (keys.right ? 1 : 0) - (keys.left ? 1 : 0),
      (keys.up ? 1 : 0) - (keys.down ? 1 : 0),
      (keys.forward ? 1 : 0) - (keys.back ? 1 : 0)
    );
    if (dir.lengthSq() > 0) dir.normalize();

    // 阻尼插值
    velocity.x += (dir.x * SPEED - velocity.x) * Math.min(DAMPING * dt, 1);
    velocity.z += (dir.z * SPEED - velocity.z) * Math.min(DAMPING * dt, 1);
    velocity.y += (dir.y * SPEED - velocity.y) * Math.min(DAMPING * dt, 1);

    controls.moveRight(velocity.x * dt);
    controls.moveForward(velocity.z * dt);
    camera.position.y += velocity.y * dt;

    // 地面约束，别钻到地下
    camera.position.y = Math.max(0.6, camera.position.y);
  }

  return { controls, update, isLocked: () => controls.isLocked };
}
