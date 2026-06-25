// blinnPhong.js — 自定义 Blinn-Phong 光照模型着色器（试卷基础点 2-(2)）
//
// 光照 = 环境光(ambient) + 漫反射(Lambert) + 镜面反射(Blinn-Phong half-vector)
// 光源：1 个方向光(key) + 1 个点光(台灯)，满足"至少两个普通光"。
// 用 ShaderMaterial 实现，three 自动注入 position/normal/modelMatrix/viewMatrix/
// projectionMatrix/cameraPosition 等内建量。
import * as THREE from 'three';

const vertexShader = /* glsl */`
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = mat3(modelMatrix) * normal;   // 几何体已应用变换，模型矩阵为刚体
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const fragmentShader = /* glsl */`
  precision highp float;

  uniform vec3  uDiffuse;       // 物体固有色（线性空间）
  uniform float uShininess;     // 高光指数
  uniform float uSpecular;      // 镜面反射强度

  uniform vec3  uAmbient;       // 环境光颜色×强度

  uniform vec3  uDirDir;        // 方向光：指向光源的单位向量（世界空间）
  uniform vec3  uDirColor;      // 方向光颜色×强度

  uniform vec3  uPointPos;      // 点光位置（世界空间）
  uniform vec3  uPointColor;    // 点光颜色×强度
  uniform float uPointDist;     // 点光衰减距离

  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;

  // 单个光源的 Blinn-Phong 贡献
  vec3 lighting(vec3 N, vec3 V, vec3 L, vec3 radiance) {
    float diff = max(dot(N, L), 0.0);
    vec3  H = normalize(L + V);
    float spec = (diff > 0.0) ? pow(max(dot(N, H), 0.0), uShininess) : 0.0;
    return radiance * (diff * uDiffuse + spec * uSpecular);
  }

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);

    // 环境项
    vec3 color = uAmbient * uDiffuse;

    // 方向光
    color += lighting(N, V, normalize(uDirDir), uDirColor);

    // 点光（带二次衰减）
    vec3 Lp = uPointPos - vWorldPos;
    float dist = length(Lp);
    float atten = 1.0 / (1.0 + (dist * dist) / (uPointDist * uPointDist));
    color += lighting(N, V, Lp / dist, uPointColor * atten);

    gl_FragColor = vec4(color, 1.0);   // 线性输出，交由 OutputPass 做色调映射
  }
`;

/**
 * 创建 Blinn-Phong 材质系统。各材质共享灯光/环境的 uniform 对象（按引用），
 * 每帧 update() 刷新一次即可全部生效。
 */
export function createBlinnPhongSystem(keyLight, lampLight, ambientColor, ambientIntensity) {
  // 共享 uniform（多材质引用同一对象，update 一次全更新）
  const shared = {
    uAmbient:    { value: new THREE.Color() },
    uDirDir:     { value: new THREE.Vector3() },
    uDirColor:   { value: new THREE.Color() },
    uPointPos:   { value: new THREE.Vector3() },
    uPointColor: { value: new THREE.Color() },
    uPointDist:  { value: 1 },
  };

  function makeMaterial(diffuseColor, shininess = 64, specular = 0.12) {
    return new THREE.ShaderMaterial({
      uniforms: {
        ...shared,
        uDiffuse:   { value: diffuseColor.clone() },
        uShininess: { value: shininess },
        uSpecular:  { value: specular },
      },
      vertexShader,
      fragmentShader,
    });
  }

  const _v = new THREE.Vector3();
  function update() {
    // 环境
    shared.uAmbient.value.copy(ambientColor).multiplyScalar(ambientIntensity);
    // 方向光：指向光源（target 默认在原点）
    shared.uDirDir.value.copy(keyLight.position).sub(keyLight.target.position).normalize();
    shared.uDirColor.value.copy(keyLight.color).multiplyScalar(keyLight.intensity);
    // 点光
    lampLight.getWorldPosition(_v);
    shared.uPointPos.value.copy(_v);
    shared.uPointColor.value.copy(lampLight.color).multiplyScalar(lampLight.intensity * 0.08);
    shared.uPointDist.value = lampLight.distance || 8;
  }

  return { makeMaterial, update };
}
