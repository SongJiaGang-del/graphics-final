# Windows 11 环境配置与启动指南

> 工具链：Python ✓ · Node.js ✓ · VS Code ✓  
> **推荐方案：VS Code + Live Server 插件（零命令行，最省事）**

---

## 一、VS Code 安装 Live Server 插件（推荐，无需命令行）

1. 打开 VS Code
2. 左侧点击「扩展」图标（或 `Ctrl+Shift+X`）
3. 搜索 `Live Server`，选第一个（作者 Ritwick Dey，下载量最高）
4. 点击「安装」

**启动项目：**

1. VS Code → 文件 → 打开文件夹 → 选择 `graphics-final` 文件夹
2. 在左侧文件树中，右键点击 `index.html`
3. 选择 **「Open with Live Server」**
4. 浏览器自动打开 `http://127.0.0.1:5500`
5. 修改任意文件后，浏览器**自动刷新**，无需手动操作

---

## 二、创建项目文件夹

### 方法 A：直接在 VS Code 里建（最简单，不用命令行）

1. VS Code → 文件 → 打开文件夹 → 选一个位置（如桌面）→ 新建文件夹 `graphics-final` → 选择
2. 左侧文件树，点「新建文件夹」图标，依次创建：
   ```
   src/
   src/shaders/
   assets/
   assets/textures/
   ```
3. 点「新建文件」图标，依次创建：
   ```
   index.html
   src/main.js
   src/scene.js
   src/camera.js
   src/postProcess.js
   src/picker.js
   src/ui.js
   ```

### 方法 B：用 PowerShell 一键创建

右键开始菜单 → 「Windows PowerShell」或「终端」，粘贴以下命令：

```powershell
# 在桌面创建项目（可改成你喜欢的路径）
cd $env:USERPROFILE\Desktop
mkdir graphics-final
cd graphics-final

# 创建子目录
mkdir src\shaders
mkdir assets\textures

# 创建所有源文件（New-Item 是 PowerShell 的 touch 等价命令）
New-Item index.html
New-Item src\main.js
New-Item src\scene.js
New-Item src\camera.js
New-Item src\postProcess.js
New-Item src\picker.js
New-Item src\ui.js
```

### 方法 C：用 CMD 一键创建

开始菜单搜索 `cmd` → 打开命令提示符，粘贴以下命令：

```cmd
:: 进入桌面
cd %USERPROFILE%\Desktop

:: 创建项目目录
mkdir graphics-final
cd graphics-final

:: 创建子目录
mkdir src\shaders
mkdir assets\textures

:: 创建空文件（type nul 是 CMD 的 touch 等价命令）
type nul > index.html
type nul > src\main.js
type nul > src\scene.js
type nul > src\camera.js
type nul > src\postProcess.js
type nul > src\picker.js
type nul > src\ui.js
```

---

## 三、本地服务器启动方式

Live Server 优先，命令行作为备选。

### 方案 A：VS Code Live Server（推荐）

见第一节，右键 `index.html` → Open with Live Server，一步到位。

### 方案 B：Python（PowerShell 或 CMD）

```powershell
# PowerShell 版本
cd $env:USERPROFILE\Desktop\graphics-final
python -m http.server 8080
```

```cmd
:: CMD 版本
cd %USERPROFILE%\Desktop\graphics-final
python -m http.server 8080
```

浏览器访问：`http://localhost:8080`  
停止服务：`Ctrl+C`

> **找不到 python 命令？**  
> 开始菜单搜索「Python」，如果有说明已安装但没加入 PATH。  
> 解决：重新安装 Python，勾选 **「Add python.exe to PATH」** 选项。

### 方案 C：Node.js（PowerShell 或 CMD）

```powershell
# PowerShell 版本
cd $env:USERPROFILE\Desktop\graphics-final
npx serve .
```

```cmd
:: CMD 版本
cd %USERPROFILE%\Desktop\graphics-final
npx serve .
```

浏览器访问：`http://localhost:3000`

---

## 四、Windows 特有注意事项

### JS/HTML 里路径用正斜杠

Windows 系统路径用 `\`，但 HTML 和 JavaScript 里**必须用正斜杠** `/`：

```javascript
// ✅ 正确
const tex = loader.load('assets/textures/wood_color.jpg');

// ❌ 错误（浏览器不认反斜杠）
const tex = loader.load('assets\\textures\\wood_color.jpg');
```

### 项目路径避免中文

把项目放在路径全为英文的目录下，例如：
- ✅ `C:\Users\YourName\Desktop\graphics-final`
- ✅ `C:\projects\graphics-final`
- ❌ `C:\用户\桌面\图形学期末`（可能导致资源加载失败）

### 防火墙弹窗

首次运行 Python 或 Node 服务器时，Windows 防火墙可能弹窗，点**「允许访问」**即可。

### 浏览器推荐

用 **Chrome 或 Edge**，WebGL 支持最完整，报错信息最详细。

---

## 五、推荐 VS Code 插件

| 插件名 | 用途 | 必要性 |
|--------|------|--------|
| **Live Server** | 本地服务器，自动刷新 | ★ 必装 |
| **GLSL Lint** | GLSL 着色器语法高亮 + 报错提示 | 强烈推荐 |
| **Shader languages support** | `.vert` / `.frag` 文件语法高亮 | 推荐 |

`Ctrl+Shift+X` 搜索名称安装。

---

## 六、调试技巧（Chrome / Edge DevTools）

按 `F12` 打开开发者工具，**Console 面板**是最重要的调试入口。

所有 WebGL 错误、着色器编译失败都会显示在这里，格式如：

```
THREE.WebGLProgram: Shader Error 0 - VALIDATE_STATUS false
...
ERROR: 0:42: 'uNormalMap' : undeclared identifier
```

报错后把红色文字直接复制给我，我来定位问题。

**常用调试代码（粘贴到 Console 直接运行）：**

```javascript
// 查看渲染统计（三角面数、Draw Call 次数）
console.log(renderer.info.render);

// 查看相机当前位置
console.log(camera.position);

// 确认 WebGL 版本（应输出 WebGL 2.0）
console.log(renderer.getContext().getParameter(
  renderer.getContext().VERSION
));
```

---

## 七、快速验证清单

按顺序逐步确认，每步通过再继续：

- [ ] Live Server 启动，浏览器打开 `http://127.0.0.1:5500`
- [ ] Console 无红色报错
- [ ] 画面显示深色背景（场景已渲染）
- [ ] 点击画面后鼠标锁定（PointerLock 生效）
- [ ] WASD 可以移动，鼠标可以转动视角
- [ ] 右侧参数面板可见
- [ ] 拖动「光照强度」滑块，场景亮度随之变化
- [ ] 勾选「边缘检测」，出现轮廓线效果

---

> 遇到任何报错，把 Console 里的红色文字截图或复制给我，直接帮你定位。
