// picker.js — 射线拾取：第一人称下用屏幕中心射线，锁定时左键选中物体
import * as THREE from 'three';

/**
 * @param {THREE.Camera} camera
 * @param {THREE.Mesh[]} pickables 可拾取物体
 * @param {(mesh|null)=>void} onPick 选中回调
 * @param {()=>boolean} isLocked 是否处于锁定（第一人称）状态
 */
export function setupPicker(camera, pickables, onPick, isLocked) {
  const raycaster = new THREE.Raycaster();
  const center = new THREE.Vector2(0, 0); // 屏幕中心（准星）
  let selectedName = null;                // 以逻辑物体名为单位记录选中

  function highlightMesh(mesh, on) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!m.emissive) continue;
      m.emissive.setHex(on ? 0x6ea8fe : 0x000000);
      m.emissiveIntensity = on ? 0.6 : 0;
    }
  }

  // 多材质模型（如台灯）会被拆成多个子网格，按 displayName 整体高亮
  function setHighlight(name, on) {
    if (!name) return;
    for (const m of pickables) {
      if (m.userData.displayName === name) highlightMesh(m, on);
    }
  }

  function pick() {
    raycaster.setFromCamera(center, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    const hit = hits.length ? hits[0].object : null;
    const hitName = hit ? hit.userData.displayName : null;

    if (hitName !== selectedName) {
      setHighlight(selectedName, false);
      setHighlight(hitName, true);
      selectedName = hitName;
      onPick?.(hit);
    }
  }

  // 锁定状态下左键拾取
  document.addEventListener('mousedown', (e) => {
    if (e.button === 0 && isLocked()) pick();
  });

  return {
    getSelectedName: () => selectedName,
    clear: () => { setHighlight(selectedName, false); selectedName = null; onPick?.(null); },
  };
}
