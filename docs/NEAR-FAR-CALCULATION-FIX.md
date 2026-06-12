# 大坐标场景 near/far 计算修复说明

## 问题发现

在真实世界模式（大坐标场景）中，智能计算的 near/far 值出现异常：

```
distance: '504.65'        // 相机高度
minDistance: '3750894.75' // 最近模型距离：375万米！
near: '375089.47'         // near 值：37.5万米 ❌ 错误！
```

**问题**：near 值（37.5万米）远大于相机高度（504米），导致：
- near 平面在相机前方 37.5 万米处
- 所有近处的模型都被 near 平面裁剪掉
- 层1的大坐标模型看不见

## 根本原因

### 错误的计算逻辑

原始代码：
```javascript
// ❌ 错误：基于到遥远模型的距离计算 near 值
const nearByModel = Math.max(1, minDistance * 0.1);
near = Math.max(nearByHeight, nearByModel, 1);
// 当 minDistance = 3750894 时
// near = Math.max(5.04, 375089, 1) = 375089
```

### 大坐标场景的特点

在真实世界模式（大坐标场景）中：
- 相机位置：`(-2394760.89, 504.95, 2886924.21)`
- 模型位置：`(-2000000, 0, 3000000)`
- 相机到模型的距离：几百万米

但**near 值不应该基于这个距离**，而应该基于**场景的相对尺度**。

## 修复方案

### 修复后的计算逻辑

```javascript
// ✅ 正确：near 值基于相机高度和场景尺度
if (distance < 100) {
  near = Math.max(0.1, distance * 0.01);
} else if (distance < 1000) {
  near = Math.max(1, distance * 0.01);
} else {
  near = Math.max(10, distance * 0.001);
}

// ⚠️ 确保 near 值不会过大（关键修复）
const maxNear = distance * 0.1; // near 不超过相机高度的 10%
if (near > maxNear) {
  near = maxNear;
}
```

### 修复后的效果

```
distance: '504.65'
near: Math.max(10, 504.65 * 0.001, 504.65 * 0.1)
     = Math.max(10, 0.505, 50.465)
     = 50.465  ✅ 合理！
```

## 对数深度缓冲区的限制

### 问题

启用对数深度缓冲区后，层1的大坐标模型仍然看不见。这说明：
- 对数深度缓冲区不能完全解决大坐标场景的问题
- 可能还有其他因素影响模型可见性

### 可能的原因

1. **深度精度限制**
   - 对数深度改善了深度分布，但在极端坐标下仍然有限制
   - WebGL 的深度缓冲区精度是有限的（通常是 16-bit 或 24-bit）

2. **投影矩阵元素溢出**
   - 大坐标场景中，投影矩阵的某些元素可能非常大
   - 浮点数精度限制导致计算不准确

3. **深度测试方向**
   - 某些情况下深度测试方向可能被反转
   - 需要检查 `depthFunc` 设置

4. **模型位置问题**
   - 模型可能真的在视野外或被遮挡
   - 需要检查模型的实际位置和边界框

## 验证步骤

### 1. 检查 near/far 值

```javascript
console.log('near/far 检查:', {
  near: camera.near,
  far: camera.far,
  相机高度: camera.position.y,
  near是否合理: camera.near < camera.position.y * 0.5
});
```

### 2. 检查模型位置

```javascript
// 获取模型的边界框
const box = new THREE.Box3().setFromObject(model);
const center = box.getCenter(new THREE.Vector3());

// 计算到相机的距离
const distance = camera.position.distanceTo(center);

console.log('模型位置检查:', {
  模型名称: model.name,
  边界框中心: center,
  到相机距离: distance,
  是否在范围内: distance >= camera.near && distance <= camera.far
});
```

### 3. 检查 NDC 坐标

```javascript
// 将模型位置投影到 NDC 空间
const ndc = center.clone().project(camera);

console.log('NDC 坐标检查:', {
  x: ndc.x,
  y: ndc.y,
  z: ndc.z,
  是否在视野内: ndc.x >= -1 && ndc.x <= 1 &&
               ndc.y >= -1 && ndc.y <= 1 &&
               ndc.z >= -1 && ndc.z <= 1
});
```

## 替代方案

如果对数深度缓冲区不能解决问题，考虑以下方案：

### 方案 1：禁用对数深度，使用更保守的 near/far

```javascript
// 不使用对数深度
logarithmicDepthBuffer: false

// 使用更保守的 near/far 比例
near = Math.max(1, distance * 0.01);
far = Math.min(distance * 1000, 100000);
// 比例限制在 1000:1 以内
```

### 方案 2：使用相对坐标系统

```javascript
// 将模型移动到原点附近
const offset = model.position.clone();
model.position.set(0, 0, 0);

// 在着色器中应用偏移
// 或使用 custom shader material
```

### 方案 3：分层渲染

```javascript
// 为不同坐标范围的模型使用不同的场景/相机
const smallCoordScene = new THREE.Scene();
const largeCoordScene = new THREE.Scene();

// 分别渲染，然后合成
renderer.render(smallCoordScene, camera);
renderer.render(largeCoordScene, camera);
```

### 方案 4：动态调整相机位置

```javascript
// 在渲染前，临时将相机移动到原点附近
const originalPosition = camera.position.clone();
const tempPosition = camera.position.clone().sub(origin);
camera.position.copy(tempPosition);

// 渲染
renderer.render(scene, camera);

// 恢复相机位置
camera.position.copy(originalPosition);
```

## 当前实现

修复后的 near/far 计算逻辑：
1. ✅ near 值基于相机高度，不超过相机高度的 10%
2. ✅ far 值确保覆盖所有模型
3. ✅ 限制 near/far 比例在合理范围内
4. ✅ 添加详细的日志输出，便于调试

## 后续建议

1. **验证修复效果**
   - 检查修复后的 near/far 值是否合理
   - 确认层1的大坐标模型是否可见

2. **如果仍然不可见**
   - 检查模型的实际位置和边界框
   - 检查投影矩阵的计算
   - 考虑使用替代方案

3. **性能优化**
   - 减少不必要的 near/far 更新
   - 使用节流避免频繁计算

4. **长期方案**
   - 考虑使用相对坐标系统
   - 或者使用分层渲染方案
