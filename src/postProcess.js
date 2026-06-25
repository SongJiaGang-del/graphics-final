// postProcess.js — EffectComposer 后处理管线（FBO 离屏渲染）
// 渲染 → Bloom 辉光 → 边缘检测 → 输出（≥2 种后处理特效，试卷高级渲染 (3)）
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { EdgeDetectionShader } from './shaders/edgeDetection.js';

/**
 * @returns 一组控制方法
 */
export function setupPostProcess(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // 1) Bloom 辉光：高亮区域泛光（基于亮度阈值的高斯模糊叠加）
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.6,   // strength 强度
    0.4,   // radius 半径
    0.85   // threshold 亮度阈值
  );
  bloomPass.enabled = false;
  composer.addPass(bloomPass);

  // 2) 边缘检测：自定义 Sobel 着色器
  const edgePass = new ShaderPass(EdgeDetectionShader);
  edgePass.uniforms.resolution.value = new THREE.Vector2();
  edgePass.uniforms.uEdgeColor.value = new THREE.Color(0x000000);
  edgePass.uniforms.uStrength.value = 1.0;
  edgePass.enabled = false;
  composer.addPass(edgePass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  function setSize(width, height, pixelRatio) {
    composer.setPixelRatio(pixelRatio);
    composer.setSize(width, height);
    edgePass.uniforms.resolution.value.set(1 / (width * pixelRatio), 1 / (height * pixelRatio));
    bloomPass.setSize(width * pixelRatio, height * pixelRatio);
  }

  return {
    composer,
    // 投影切换时更新 RenderPass 使用的相机
    setCamera: (cam) => { renderPass.camera = cam; },
    setEdgeEnabled: (on) => { edgePass.enabled = on; },
    setEdgeStrength: (v) => { edgePass.uniforms.uStrength.value = v; },
    setBloomEnabled: (on) => { bloomPass.enabled = on; },
    setBloomStrength: (v) => { bloomPass.strength = v; },
    setSize,
    render: () => composer.render(),
  };
}
