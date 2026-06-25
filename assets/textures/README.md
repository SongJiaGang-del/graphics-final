# textures/

当前场景的纹理由 `src/scene.js` 用 `CanvasTexture` **程序化生成**，无需外部图片，开箱即用。

如果你想替换成真实贴图（木纹、砖墙等），把图片放到这个目录，然后在 `scene.js` 里改用 `THREE.TextureLoader`：

```js
const loader = new THREE.TextureLoader();
const tex = loader.load('assets/textures/wood_color.jpg'); // 注意：用正斜杠 /
tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
tex.colorSpace = THREE.SRGBColorSpace;
```
