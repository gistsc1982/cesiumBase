# 智能对数深度缓冲区方案

## 问题描述

在混合坐标场景中（层1同时存在大坐标和小坐标模型），需要确保：
1. 大坐标模型不会因深度精度问题而出现"近小远大"的透视反转
2. 小坐标模型不会被 near 平面裁剪掉
3. 所有模型都能正确显示和交互

## 对数深度缓冲区原理

### 线性深度 vs 对数深度

**线性深度**（默认）:
```
depth = (z - near) / (far - near)
```
- 深度值均匀分布
- 远处物体的深度精度很低
- far/near 比例限制在 1000:1 左右

**对数深度**（启用后）:
```
C = 2 / log2(far / near + 1)
depth = log2(C * z + 1) / log2(C * far + 1) * 2 - 1
```
- 深度值按对数分布
- 近处和远处都有较好的深度精度
- far/near 比例可以扩大到 10000:1 或更大

## 智能方案实现

### 1. 检测大坐标模型

```javascript
hasLargeCoordModelsInLayer1() {
  // 检查模型的用户数据标记
  // 检查模型的位置坐标
  // 检查模型的边界框中心
  // 返回是否检测到大坐标模型
}
```

### 2. 计算模型距离

```javascript
calculateModelDistances() {
  // 遍历层1和层2的所有模型
  // 计算每个模型边界框到相机的距离
  // 返回最小和最大距离
  // 返回值: { minDistance, maxDistance }
}
```

### 3. 智能计算 near/far 值

```javascript
// near 值计算:
// - 取相机高度的 1%（确保近处精度）
// - 不小于最近模型距离的 10%（避免裁剪）
// - 最小值为 1（避免除零）

near = Math.max(
  distance * 0.01,      // 相机高度的 1%
  minDistance * 0.1,    // 最近模型距离的 10%
  1                     // 最小值
)

// far 值计算:
// - 取相机距离的 10 倍（确保视野范围）
// - 不小于最远模型距离的 2 倍（确保可见）
// - 最小值为 1000（基本视野）

far = Math.max(
  distance * 10,        // 相机距离的 10 倍
  maxDistance * 2,      // 最远模型距离的 2 倍
  1000                  // 最小值
)

// 限制 far/near 比例
const MAX_RATIO = 10000;  // 对数深度支持的比例
if (far / near > MAX_RATIO) {
  near = far / MAX_RATIO;
}
```

## 使用指南

### 方案 A: 始终启用对数深度（推荐）

如果层1可能包含大坐标模型，建议在创建 renderer1 时就启用对数深度：

```javascript
this.renderer1 = new THREE.WebGLRenderer({
  canvas: this.threeCanvas1,
  alpha: true,
  antialias: true,
  powerPreference: 'high-performance',
  logarithmicDepthBuffer: true  // ✅ 启用
});
```

**优点**:
- 支持大坐标场景
- 避免透视反转问题
- far/near 比例更大，适用范围更广

**注意事项**:
- near 值不能太小（建议 ≥ 1）
- 智能计算 near/far 值会自动调整
- 小坐标模型仍然可以正常显示

### 方案 B: 动态检测（需要重新创建渲染器）

如果需要根据模型动态切换，需要重新创建渲染器：

```javascript
// 在模型加载后检查
const hasLargeModels = this.hasLargeCoordModelsInLayer1();
if (hasLargeModels && !this.renderer1.capabilities.isLogarithmicDepthBuffer) {
  // 需要重新创建渲染器以启用对数深度
  this.recreateRenderer1WithLogDepth();
}
```

**缺点**:
- 需要重新创建 WebGL 上下文
- 会丢失当前的渲染状态
- 性能开销较大

## 验证模型可见性

### 检查 near 平面裁剪

```javascript
// 计算模型到相机的距离
const distance = camera.position.distanceTo(model.position);

// 检查是否小于 near 值
if (distance < camera.near) {
  console.warn('模型被 near 平面裁剪:', {
    model: model.name,
    distance: distance,
    near: camera.near
  });
}
```

### 检查 far 平面裁剪

```javascript
// 检查是否超过 far 值
if (distance > camera.far) {
  console.warn('模型超出 far 平面:', {
    model: model.name,
    distance: distance,
    far: camera.far
  });
}
```

### 调试深度值

```javascript
// 将模型位置投影到 NDC 空间
const ndc = model.position.clone().project(camera);
console.log('模型 NDC 坐标:', {
  x: ndc.x.toFixed(4),
  y: ndc.y.toFixed(4),
  z: ndc.z.toFixed(4),  // 深度值 (-1 到 1)
  visible: ndc.z >= -1 && ndc.z <= 1
});
```

## 常见问题

### Q: 启用对数深度后，小模型不显示？

A: 检查 near 值是否过大。near 值应该：
- 大于相机到最近模型距离的 10%
- 但不要过大，否则会影响近处精度
- 建议范围: 1-100

### Q: 大模型仍然出现透视反转？

A: 检查 far/near 比例是否过大：
- 对数深度支持的最大比例约为 10000:1
- 如果比例更大，需要调整 near 值增大
- 或者考虑使用多场景渲染

### Q: 模型闪烁或深度冲突？

A: 可能是深度精度问题，尝试：
- 启用对数深度缓冲区
- 减小 far/near 比例
- 调整模型的 polygonOffset
- 使用 `renderer.sortObjects = false`

## 总结

智能对数深度方案通过以下方式确保所有模型可见：

1. ✅ 检测场景中的大坐标模型
2. ✅ 计算所有模型的实际距离范围
3. ✅ 智能调整 near/far 值以适应场景
4. ✅ 使用对数深度缓冲区改善深度精度
5. ✅ 限制 far/near 比例避免精度问题

这样可以确保：
- 大坐标模型不会出现透视反转
- 小坐标模型不会被裁剪
- 所有模型都能正确显示和交互
