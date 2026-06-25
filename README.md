# Graphics Final · WebGL 交互场景

基于 **Three.js (r160)** 的第一人称 WebGL 场景，零打包、纯 ES 模块，VS Code Live Server 直接运行。

## 快速启动

VS Code 里右键 `index.html` → **Open with Live Server**，浏览器自动打开 `http://127.0.0.1:5500`。

> 其他启动方式见 `Windows11环境配置与启动指南.md`。

## 功能

- **Blender 建模**：房间/桌/椅/台灯/书/装饰球全部在 Blender 中建模，导出 GLB 由 `GLTFLoader` 加载。
- **第一人称漫游**：点击画面锁定鼠标，`WASD` / 方向键移动，`Space`/`Shift` 升降，鼠标转视角，`ESC` 退出。
- **透视 / 正交投影切换**：面板「正交投影」开关，两种投影共享同一视角。
- **物体拾取**：锁定状态下左键拾取屏幕中心准星对准的物体，面板显示名称并整体高亮（多材质模型一并点亮）。
- **法线贴图**：地面/墙面程序化生成切线空间法线贴图，体现微观凹凸。
- **Blinn-Phong 自定义着色器**：手写 GLSL（环境+漫反射+镜面，方向光+点光），可与 PBR 一键切换对比。
- **实时参数调节**：光照强度、阴影开关、选中物体的金属度/粗糙度（拾取后回显并实时修改）。
- **后处理（FBO ≥2 种）**：Bloom 辉光 + 自定义 Sobel 边缘检测，均可开关并调节强度。
- **阴影 + 雾 + ACES 色调映射**，FPS / draw call / 三角面 实时统计。

## 目录结构

```
index.html            页面 + importmap（CDN 引入 three）+ UI 容器样式
src/
  main.js             入口：渲染器、循环、模块装配
  scene.js            场景：光照、地面、墙体、可拾取物体（程序化纹理）
  camera.js           透视相机 + PointerLock 第一人称控制
  postProcess.js      EffectComposer 后处理管线
  picker.js           射线拾取
  ui.js               右侧参数面板（原生 DOM）
  shaders/
    edgeDetection.js  自定义 Sobel 边缘检测着色器
assets/textures/      贴图目录（当前用程序化纹理，可替换）
```

## 操作清单（对照指南第七节）

- [x] 深色背景场景渲染
- [x] 点击锁定鼠标（PointerLock）
- [x] WASD 移动 + 鼠标转视角
- [x] 右侧参数面板
- [x] 光照强度滑块
- [x] 边缘检测轮廓线
