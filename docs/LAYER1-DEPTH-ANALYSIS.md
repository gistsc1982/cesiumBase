# 层1深度问题完整分析

## 问题现象

1. **真实世界模式下出现"远大近小"的透视反转**
2. **层1启用对数深度缓冲区后模型看不见**

## 架构背景

### 双Canvas架构

```
┌─────────────────────────────────────────────────────────────┐
│                      容器容器                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  层1 Canvas (threeCanvas1)                          │    │
│  │  - 独立WebGL上下文                                   │    │
│  │  - 独立深度缓冲区                                     │    │
│  │  - logarithmicDepthBuffer: false                    │    │
│  │  - z-index: 1                                       │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │  层2 Canvas (bimCanvas)                             │    │
│  │  - 独立WebGL上下文                                   │    │
│  │  - 独立深度缓冲区                                     │    │
│  │  - logarithmicDepthBuffer: true                     │    │
│  │  - z-index: (动态)                                   │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**关键点**：
- 两个Canvas有**独立的WebGL上下文**
- 每个上下文有**独立的深度缓冲区**
- **WebGL无法跨上下文进行深度比较**
- 深度排序只能通过Canvas层级（z-index）实现

## 为什么层1启用对数深度后看不见？

### 原因分析

#### 1. 对数深度函数的数学特性

对数深度使用以下公式计算深度值：

```
depth = log2(C * z + 1) / log2(C * far + 1) * 0.5 + 0.5
```

其中：
- `z` 是相机到像素的距离
- `C` 是常数（通常是1）
- `far` 是相机的远裁剪面距离

#### 2. 深度值范围问题

当启用对数深度时：

| 相机距离 | 线性深度值 | 对数深度值 |
|---------|-----------|-----------|
| near (0.1) | ~0.0000 | ~0.0000 |
| 中间距离 | ~0.5000 | ~0.5000 |
| far (10000) | ~1.0000 | ~1.0000 |

**问题**：如果层1的模型距离相机非常近或非常远，对数深度值可能：
- 趋近于0（所有像素深度值相同）
- 趋近于1（所有像素深度值相同）
- 导致深度测试失败，模型被裁剪

#### 3. 材质着色器兼容性

Three.js的标准材质（`MeshStandardMaterial`、`MeshBasicMaterial`等）会自动添加对数深度支持：

```glsl
// 标准 vertex shader 包含的代码
#ifdef USE_LOGDEPTHBUF
  gl_FragDepthEXT = log2(vFragDepth) * logDepthBufFC * 0.5;
#else
  gl_FragDepthEXT = gl_FragCoord.z;
#endif
```

但是，如果层1的模型使用了：
- 自定义ShaderMaterial
- 修改过的材质
- 旧版本的Three.js材质格式

可能不支持对数深度，导致渲染异常。

#### 4. near/far 比例敏感性

对数深度对near/far比例更敏感：

| near | far | 比例 | 线性深度效果 | 对数深度效果 |
|------|-----|------|-------------|-------------|
| 0.1 | 10000 | 100000:1 | 深度精度差 | ✅ 良好 |
| 0.1 | 100 | 1000:1 | ✅ 良好 | ✅ 良好 |
| 5.0 | 100 | 20:1 | ✅ 良好 | ❌ 可能失效 |

**层1的near/far配置**：
- 默认: `near=0.1, far=10000` (比例 100000:1)
- 动态调整: `near=距离*0.2, far=距离*10` (比例 50:1)

如果动态调整后的near/far比例不合适，对数深度可能失效。

## "远大近小"问题的真正原因

### 排除法分析

既然层1不能启用对数深度，那么"远大近小"问题必须通过其他方式解决。

### 可能的原因（按概率排序）

#### 1. 层1的深度函数错误 (🔴 最可能)

**症状**：
- 模型渲染，但遮挡关系错误
- 远处的物体遮挡近处的物体

**原因**：
- 深度函数被设置为 `gl.GREATER` 而不是 `gl.LESS`

**验证**：
```javascript
const gl = window.__dualCanvasViewer.renderer1.getContext();
console.log(gl.getParameter(gl.DEPTH_FUNC) === gl.LESS); // 应该是 true
```

**修复**：
```javascript
gl.depthFunc(gl.LESS);
```

#### 2. 层1的深度测试被禁用 (🟴 可能)

**症状**：
- 渲染顺序决定可见性
- 后加载的模型覆盖先加载的模型

**原因**：
- `gl.disable(gl.DEPTH_TEST)` 被调用

**验证**：
```javascript
const gl = window.__dualCanvasViewer.renderer1.getContext();
console.log(gl.getParameter(gl.DEPTH_TEST)); // 应该是 true
```

**修复**：
```javascript
gl.enable(gl.DEPTH_TEST);
```

#### 3. 层1的投影矩阵错误 (🟡 可能)

**症状**：
- 整个场景的透视关系错误
- 所有模型都出现"远大近小"

**原因**：
- 投影矩阵的 `[10,10]` 或 `[14,10]` 元素符号错误

**验证**：
```javascript
const proj = window.__dualCanvasViewer.camera1.projectionMatrix;
console.log(proj.elements[10] < 0);  // 应该是 true (负值)
console.log(proj.elements[14] > 0);  // 应该是 true (正值)
```

**修复**：
```javascript
window.__dualCanvasViewer.camera1.updateProjectionMatrix();
```

#### 4. 模型材质禁用深度写入 (🟢 较小可能)

**症状**：
- 特定模型出现渲染问题
- 透明模型排序错误

**原因**：
- 材质的 `depthWrite` 属性被设置为 `false`

**验证**：
```javascript
model.material.depthWrite; // 应该是 true
```

**修复**：
```javascript
model.material.depthWrite = true;
```

## 解决方案

### 方案1：修复层1深度配置（推荐）✅

**不修改代码，使用诊断脚本**：

```html
<script src="/diagnose-layer1-depth.js"></script>
```

然后在浏览器控制台执行：
```javascript
__layer1DepthFix.fixAll();
```

**优点**：
- 无需修改代码
- 可以立即验证效果
- 保持层1禁用对数深度的配置

**缺点**：
- 每次页面加载后需要执行
- 无法解决根本问题

### 方案2：在应用初始化时自动修复

修改 `src/components/DualCanvasViewer.vue`，在创建渲染器后添加：

```javascript
// 第3013行后添加
this.renderer1.setClearColor(0x000000, 0);

// 🔧 确保层1的深度配置正确
const gl1 = this.renderer1.getContext();
gl1.enable(gl1.DEPTH_TEST);      // 启用深度测试
gl1.depthFunc(gl1.LESS);         // 设置正确的深度函数
gl1.depthMask(true);             // 启用深度写入

console.log('[DualCanvasViewer] 层1深度配置已修复');
```

**优点**：
- 自动修复，无需手动操作
- 从根本上解决问题

**缺点**：
- 需要修改代码

### 方案3：动态near/far调整优化

修改 `updateCameraProjectionForLargeCoord` 函数，确保near/far比例合理：

```javascript
// 第943-944行
const near = Math.max(1.0, distance * 0.1);  // 最小1.0，比例10%
const far = distance * 20;                   // 比例20倍，far/near = 200
```

确保far/near比例不超过10000:1，避免深度精度问题。

### 方案4：使用共享渲染器（理想方案）⭐

使用 `rendererManager` 让两层共享同一个WebGL上下文：

```javascript
// 修改架构，使用单渲染器多场景
window.rendererManager.addScene({
  element: container1,
  scene: this.scene1,
  camera: this.camera1,
  controls: this.controls1,
  logarithmicDepthBuffer: false  // 层1
});

window.rendererManager.addScene({
  element: container2,
  scene: this.scene2,
  camera: this.camera2,
  controls: this.controls2,
  logarithmicDepthBuffer: true   // 层2
});
```

**优点**：
- 可以实现真正的跨层深度排序
- 避免独立的深度缓冲区问题

**缺点**：
- 需要大幅重构
- 可能影响现有功能

## 诊断工具使用

### 1. 全面诊断

```html
<script src="/diagnose-layer1-depth.js"></script>
```

### 2. 快速修复

在浏览器控制台执行：
```javascript
__layer1DepthFix.fixAll();
```

### 3. 验证修复

```javascript
__layer1DepthFix.check();
```

## 最佳实践建议

1. **开发阶段**：
   - 使用诊断脚本定期检查层1深度配置
   - 确保 `DEPTH_TEST` 启用且 `DEPTH_FUNC` 为 `LESS`

2. **生产环境**：
   - 在渲染器创建后自动设置正确的深度配置
   - 添加日志记录深度配置状态

3. **问题排查**：
   - 首先运行 `diagnose-layer1-depth.js`
   - 根据诊断结果选择合适的修复方案
   - 验证修复效果

## 相关文件

- `public/diagnose-layer1-depth.js` - 层1深度状态诊断
- `public/diagnose-cross-canvas-depth.js` - 跨Canvas深度诊断
- `public/fix-layer1-depth.js` - 完整修复脚本
- `public/quick-fix-depth.js` - 快速修复脚本
- `src/components/DualCanvasViewer.vue:3009` - 层1渲染器配置

## 总结

层1启用对数深度后模型看不见的原因：
1. **对数深度函数对深度值的重新计算**可能与层1的模型距离不匹配
2. **near/far比例**可能不适合对数深度
3. **材质着色器**可能不完全支持对数深度

"远大近小"问题的真正原因很可能是：
1. **层1的深度函数错误**（`gl.GREATER` 而不是 `gl.LESS`）
2. **层1的深度测试被禁用**
3. **层1的投影矩阵计算错误**

推荐的解决方案是**保持层1禁用对数深度**，但确保其深度配置正确：
- `DEPTH_TEST = true`
- `DEPTH_FUNC = LESS`
- `DEPTH_WRITEMASK = true`

这样可以在不影响层1渲染的情况下，解决"远大近小"问题。
