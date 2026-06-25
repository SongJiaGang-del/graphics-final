// ui.js — 右侧参数面板：光照强度、边缘检测开关与强度、自动旋转、统计信息
//
// 用原生 DOM 构建，避免引入额外依赖。所有变化通过回调暴露给 main.js。

/**
 * @param {object} handlers 回调集合
 *   onLightIntensity(v), onEdgeToggle(on), onEdgeStrength(v), onAutoRotate(on)
 * @returns { setPicked(name), setStats(text) }
 */
export function buildUI(handlers) {
  const body = document.getElementById('panel-body');

  function rangeRow(label, min, max, value, step, fmt, onInput) {
    const row = document.createElement('div');
    row.className = 'row';
    const lab = document.createElement('label');
    const name = document.createElement('span');
    name.textContent = label;
    const val = document.createElement('span');
    val.className = 'val';
    val.textContent = fmt(value);
    lab.append(name, val);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = min; input.max = max; input.step = step; input.value = value;
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      val.textContent = fmt(v);
      onInput(v);
    });
    row.append(lab, input);
    body.append(row);
    // setValue: 仅同步显示，不触发 onInput（用于拾取时回显材质值）
    return { input, setValue: (v) => { input.value = v; val.textContent = fmt(v); } };
  }

  function checkRow(label, checked, onChange) {
    const row = document.createElement('div');
    row.className = 'row';
    const wrap = document.createElement('label');
    wrap.className = 'check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    const span = document.createElement('span');
    span.textContent = label;
    input.addEventListener('change', () => onChange(input.checked));
    wrap.append(input, span);
    row.append(wrap);
    body.append(row);
    return input;
  }

  function divider() {
    const d = document.createElement('div');
    d.className = 'divider';
    body.append(d);
  }

  // --- 光照与场景 ---
  rangeRow('光照强度', 0, 4, 1.6, 0.05, (v) => v.toFixed(2), handlers.onLightIntensity);
  checkRow('阴影', true, handlers.onShadow);
  checkRow('正交投影', false, handlers.onOrtho);
  checkRow('Blinn-Phong 着色', false, handlers.onBlinnToggle);
  checkRow('装饰球旋转', true, handlers.onAutoRotate);

  divider();

  // --- 后处理（FBO 特效）---
  checkRow('Bloom 辉光', false, handlers.onBloomToggle);
  rangeRow('辉光强度', 0, 2, 0.6, 0.05, (v) => v.toFixed(2), handlers.onBloomStrength);
  checkRow('边缘检测（轮廓线）', false, handlers.onEdgeToggle);
  rangeRow('轮廓强度', 0, 1, 1.0, 0.05, (v) => v.toFixed(2), handlers.onEdgeStrength);

  divider();

  // --- 选中物体材质（作用于当前拾取）---
  const pickRow = document.createElement('div');
  pickRow.className = 'row';
  pickRow.innerHTML = '<label><span>当前拾取</span></label><div id="picked">—</div>';
  body.append(pickRow);
  const pickedEl = pickRow.querySelector('#picked');

  const metalRow = rangeRow('金属度', 0, 1, 0.0, 0.01, (v) => v.toFixed(2), handlers.onMetalness);
  const roughRow = rangeRow('粗糙度', 0, 1, 0.5, 0.01, (v) => v.toFixed(2), handlers.onRoughness);

  // --- 统计 ---
  const statsEl = document.createElement('div');
  statsEl.id = 'stats';
  body.append(statsEl);

  return {
    setPicked: (name) => { pickedEl.textContent = name || '—'; },
    setStats: (text) => { statsEl.textContent = text; },
    // 拾取物体时回显其材质参数到滑块
    setMaterialSliders: (metalness, roughness) => {
      metalRow.setValue(metalness);
      roughRow.setValue(roughness);
    },
  };
}
