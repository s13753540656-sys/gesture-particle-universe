# Gesture Particle Universe

一个可以直接运行的手势粒子宇宙：React + Vite + TypeScript、Three.js、GLSL Shader、MediaPipe Hand Landmarker、GSAP 和 CSS3。黑色星空中，用双手或鼠标实时操控发光的三维粒子。

## 安装与运行

需要 **Node.js 22.12+**（推荐 Node.js 24 LTS）和 npm。进入本项目目录后运行：

```bash
npm install
npm run dev
```

在终端提示的地址打开页面，通常是 **http://localhost:5173**。默认直接展示粒子球体，不会自动申请摄像头权限。点击右侧「开启摄像头」，允许浏览器访问摄像头后即可操作。

```bash
npm run build    # TypeScript 检查、生产构建，产物位于 dist/
npm run preview  # 预览生产构建，通常为 http://localhost:4173
npm test         # 手势与粒子分布的自动化测试
```

`npm install` 会复制 MediaPipe WASM 文件并打包经典 Worker。`dev` 和 `build` 前也会重新生成这些资源。官方 `hand_landmarker.task` 模型已随项目放在 `public/mediapipe/`，运行时无需访问模型 CDN，也无需 API Key。

## 操作方式

| 方式 | 效果 |
| --- | --- |
| 展开手掌 | 粒子扩散 |
| 握拳 | 粒子收缩 |
| 手掌左右移动 | 旋转粒子结构 |
| 双手距离变化 | 相对初始距离缩放 |
| 仅伸出食指 | 指尖位置产生局部吸引漩涡 |
| 双手比心，保持约半秒 | 切换爱心形态 |
| 移动鼠标 / 触屏滑动 | 旋转粒子 |
| 按住鼠标 / 触屏按住 | 局部吸引 |
| 鼠标滚轮 / 底部加减按钮 | 缩放 |
| `R` / 重置宇宙 | 重置形态、配色、缩放和粒子数量 |
| `H` / 顶部问号 | 打开手势指南 |
| `Esc` | 关闭指南或移动端面板；浏览器同时可退出全屏 |

右侧提供六种形态：**三维球体、银河星云、浪漫爱心、螺旋星系、无限符号、粒子爆炸**；支持四组渐变配色、5,000–40,000 粒子数量、辉光、拖尾、旋转和鼠标交互开关。底部按钮可替代复杂手势。移动端点击右上角滑杆图标展开控制面板，底部速查栏可以横向滑动。

手动交互按钮在摄像头模式下有 2.5 秒优先窗口，之后继续跟随手势。切换回「鼠标交互」会关闭摄像头。重置不会关闭正在使用的摄像头，识别到的新手势仍会继续控制场景。

## 识别与运行环境

- 摄像头必须在 **localhost 或 HTTPS** 环境下使用。在手机上通过局域网 `http://电脑IP:5173` 可以预览粒子，但浏览器通常不会允许摄像头；测试手机手势请使用可信 HTTPS 地址。
- 面向支持 WebGL 2、WebAssembly 和摄像头 API 的现代 Chrome、Edge、Safari。移动端全屏 API 取决于浏览器；不支持时会显示提示。
- 摄像头视频和识别数据仅在浏览器本地处理，不保存、不上传。关闭摄像头或卸载页面会停止所有摄像头轨道、终止 Worker 并关闭识别器。
- 优先使用经典 Worker 和 GPU 推理。MediaPipe WASM 加载器依赖 `importScripts`，因此 Worker 在安装及启动前被独立打包为 IIFE。GPU 不可用时回退 CPU；Worker 不可用时回退到主线程限频推理。
- 开掌、握拳、食指使用 21 个关键点的关节夹角及归一化距离规则；双手比心为几何启发式识别，不是额外训练的分类模型。光线、遮挡和拍摄角度会影响识别，建议正对摄像头、完整展示手部。复杂动作可以直接使用屏幕按钮。
- MediaPipe 的检测、存在和跟踪置信度阈值为 0.65；另过滤低于 0.6 的左右手分类分数（该分数不是检测置信度）。普通动作稳定 160ms 后触发，比心需 450ms，并有 2 秒冷却与保持锁存。丢手超过 220ms 后平滑回到中性状态。

## 性能与资源

默认桌面 **20,000** 粒子，小屏或低核心设备初始 **12,000**。自动模式在连续低 FPS 时逐步减少数量，最低 5,000；必要时降低像素比并跳过辉光、拖尾后处理，FPS 样本忽略启动和后台时间。手动拖动数量滑杆会关闭自动数量控制并恢复用户选择的效果；重新开启自动适配或重置可重新评估数量。

粒子使用预分配的 `BufferGeometry`、`ShaderMaterial` 和 `drawRange`。六种分布按需缓存，形态切换时更新目标属性；每帧的形变、流动、吸引与点精灵渐变由 GPU 完成。GSAP 控制 1.75 秒形态过渡，过渡途中再次切换也会从当前插值位置继续。摄像头最多只保留一帧推理任务，Worker 模式约 22 FPS、兼容主线程模式约 13 FPS；渲染独立运行。

背景页暂停渲染和推理以减少消耗。摄像头仍保持连接，以便切回时立即恢复；如需关闭摄像头，请点击关闭按钮。Three.js 的几何体、材质、后处理、渲染目标、事件监听和动画均在卸载时释放。

## 目录

```text
src/
  components/       粒子容器、摄像头预览、控制面板、手势指南
  graphics/         Three.js 引擎、GLSL、六种几何分布
  hooks/            摄像头生命周期与异步竞态管理
  vision/           MediaPipe Worker、兼容回退、手势分类与防抖
  App.tsx           页面布局与交互协调
  styles.css        桌面 / 移动端样式
public/mediapipe/
  hand_landmarker.task   官方模型（随项目提供）
  hand.worker.js         生成的经典 Worker
  wasm/                  从 npm 包复制的 WASM 运行时
scripts/            本地模型运行资源准备
tests/              关键交互行为测试
```

## 故障排查

1. **拒绝权限**：在浏览器地址栏的站点设置允许摄像头，再点击重新连接。
2. **无设备 / 被占用**：连接摄像头，关闭其他正在使用它的应用，再重试。
3. **模型初始化失败**：检查 Network 中 `/mediapipe/hand_landmarker.task`、`/mediapipe/hand.worker.js` 和 WASM 请求是否成功。重新运行 `npm install` 或 `npm run dev`，不要直接双击 HTML。模型不能缺失。
4. **WebGL 不可用**：开启浏览器硬件加速，更新显卡驱动后刷新。上下文丢失会显示恢复提示。
5. **帧率较低**：开启自动适配、减少粒子、关闭辉光或拖尾。软件渲染与真实 GPU 的帧率不可直接比较。

## 开发验证

按六阶段完成了球体、扩散收缩旋转、摄像头与 MediaPipe、手势控制、多形态、视觉与性能适配。各阶段均执行构建与浏览器检查；手势规则另有自动化测试覆盖。

实际设备的物理手势效果、Safari / iOS 的摄像头和 GPU 表现仍需在对应设备上验收。模拟摄像头验证能覆盖模型初始化、推理与关闭资源，无法替代真人手势测试。

## 技术参考

- [Google MediaPipe Hand Landmarker Web 指南](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js)
- [官方 Hand Landmarker 模型](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task)
- [Three.js UnrealBloomPass](https://threejs.org/docs/pages/UnrealBloomPass.html)
- [Three.js AfterimagePass](https://threejs.org/docs/pages/AfterimagePass.html)

第三方库和模型的使用以各自原始许可为准。
