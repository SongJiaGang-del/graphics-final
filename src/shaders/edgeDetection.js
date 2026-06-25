// edgeDetection.js — 自定义 Sobel 边缘检测后处理着色器
// 作为 three.js ShaderPass 使用。在亮度图上做 Sobel 卷积，
// 把轮廓线叠加到原始画面上。mix 由 uStrength 控制。

export const EdgeDetectionShader = {
  name: 'EdgeDetectionShader',

  uniforms: {
    tDiffuse: { value: null },          // 上一 Pass 的渲染结果
    resolution: { value: null },        // [1/width, 1/height]
    uStrength: { value: 1.0 },          // 边缘叠加强度 0~1
    uEdgeColor: { value: null },        // 边缘线颜色 (THREE.Color)
  },

  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float uStrength;
    uniform vec3 uEdgeColor;
    varying vec2 vUv;

    // 取某偏移像素的亮度
    float lum(vec2 uv) {
      vec3 c = texture2D(tDiffuse, uv).rgb;
      return dot(c, vec3(0.299, 0.587, 0.114));
    }

    void main() {
      vec2 px = resolution;
      // 3x3 邻域亮度
      float tl = lum(vUv + px * vec2(-1.0,  1.0));
      float  t = lum(vUv + px * vec2( 0.0,  1.0));
      float tr = lum(vUv + px * vec2( 1.0,  1.0));
      float  l = lum(vUv + px * vec2(-1.0,  0.0));
      float  r = lum(vUv + px * vec2( 1.0,  0.0));
      float bl = lum(vUv + px * vec2(-1.0, -1.0));
      float  b = lum(vUv + px * vec2( 0.0, -1.0));
      float br = lum(vUv + px * vec2( 1.0, -1.0));

      // Sobel 算子
      float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
      float gy =  tl + 2.0*t + tr - bl - 2.0*b - br;
      float edge = sqrt(gx*gx + gy*gy);
      edge = smoothstep(0.15, 0.6, edge);   // 阈值收紧轮廓

      vec3 base = texture2D(tDiffuse, vUv).rgb;
      vec3 outlined = mix(base, uEdgeColor, edge);
      gl_FragColor = vec4(mix(base, outlined, uStrength), 1.0);
    }
  `,
};
