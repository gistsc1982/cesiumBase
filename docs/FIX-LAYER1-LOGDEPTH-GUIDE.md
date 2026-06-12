# 层1对数深度缓冲区修复指南

## 问题分析

### 当前配置
- **层1（原始层）**：`logarithmicDepthBuffer: false`
- **层2（BIM层）**：`logarithmicDepthBuffer: true`

### 问题症状
1. 大坐标模型（L16_10302）在层1中无法正确显示（需要对数深度）
2. 小坐标模型（Catwalk04）在层1中能正常显示（不需要对数深度）
3. 当为层1启用对数深度后，小模型消失

## 解决方案

### 方法1：使用修复脚本（推荐用于快速测试）

1. 在浏览器控制台中运行修复脚本：
```javascript
// 将fix-layer1-logdepth.js文件内容复制到控制台运行
```

或者：
```html
<script src="fix-layer1-logdepth.js"></script>
```

### 方法2：修改源代码（推荐用于永久修复）

修改 `src/components/DualCanvasViewer.vue` 文件：

#### 第1步：启用层1对数深度缓冲区

在第3009行，将：
```javascript
logarithmicDepthBuffer: false
```

改为：
```javascript
logarithmicDepthBuffer: true
```

#### 第2步：调整层1相机的near/far参数

找到层1相机初始化代码（大约在第2950行附近），添加动态near/far调整：

```javascript
// 在render1方法中添加
if (this.camera1 && this.renderer1) {
  const distance = this.camera1.position.distanceTo(
    this.controls1 ? this.controls1.target : new THREE.Vector3(0, 0, 0)
  );
  
  // 动态调整near/far，确保小坐标模型也能显示
  const near = Math.max(0.1, distance * 0.001);
  const far = Math.max(1000, distance * 1000);
  
  if (this.camera1.near !== near || this.camera1.far !== far) {
    this.camera1.near = near;
    this.camera1.far = far;
    this.camera1.updateProjectionMatrix();
  }
}
```

## 预期效果

修复后：
1. 大坐标模型（L16_10302）应该能正确显示
2. 小坐标模型（Catwalk04）也应该能正确显示
3. 远大近小的透视问题应该得到改善

## 测试步骤

1. 清除浏览器缓存
2. 重新加载页面
3. 加载大坐标模型（L16_10302），检查是否正常显示
4. 加载小坐标模型（Catwalk04），检查是否正常显示
5. 同时加载两个模型，检查是否都能显示
6. 测试缩放操作，检查是否还有远大近小的问题

## 故障排除

### 小模型仍然不可见
1. 尝试缩放地图窗口
2. 检查控制台是否有错误信息
3. 尝试调整near/far的比例

### 大模型仍然有问题
1. 检查对数深度是否真的启用了
2. 检查模型坐标是否正确
3. 检查相机位置

### 性能下降
1. 对数深度缓冲区会增加一些GPU开销
2. 如果性能问题严重，可以考虑只在需要时启用

## 技术细节

### 对数深度缓冲区原理
- 线性深度：depth = (z - near) / (far - near)
- 对数深度：depth = log2(z / near) / log2(far / near)

对数深度可以提供更好的深度精度，特别是对于远距离物体。

### near/far参数的重要性
- near: 相机到近裁剪面的距离
- far: 相机到远裁剪面的距离
- 比值 far/near 越大，深度精度越低

对于小坐标模型：
- near 应该相对较小（0.1 - 1）
- far 不需要太大（1000 - 10000）

对于大坐标模型：
- near 可以较大（1 - 100）
- far 需要很大（1000000 - 10000000）

动态调整可以在两者之间取得平衡。
