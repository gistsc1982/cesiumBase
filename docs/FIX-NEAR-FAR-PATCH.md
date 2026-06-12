# 修复near值导致小模型消失的问题

## 问题根源

在 `src/components/DualCanvasViewer.vue` 第943行：

```javascript
const near = Math.max(5.0, distance * 0.2);  // 距离的 20%，最小 5.0
```

这个 `Math.max(5.0, ...)` 导致 near 值永远不会小于 5.0。

### 为什么L16大模型能显示？
- L16大模型尺寸很大（几百到几千单位）
- near = 5.0 对它来说很小，不会影响显示

### 为什么Catwalk04小模型消失？
- Catwalk04小模型尺寸很小（可能只有2-3单位）
- **near = 5.0 太大了！** 相机前方5单位以内的小模型会被近裁剪面裁掉
- 放大地图后，distance 变化导致 near 值变化，模型又能看到

## 修复方案

### 方法1：直接修改源代码（推荐）

修改 `src/components/DualCanvasViewer.vue` 第943行：

**修改前：**
```javascript
const near = Math.max(5.0, distance * 0.2);  // 距离的 20%，最小 5.0
```

**修改后：**
```javascript
const near = Math.max(0.1, distance * 0.2);  // 距离的 20%，最小 0.1
```

### 方法2：使用修复脚本（临时测试）

在浏览器控制台运行 `fix-near-far-for-small-models.js`

## 预期效果

修复后：
1. 小坐标模型（Catwalk04）能正确显示
2. 大坐标模型（L16_10302）也能正常显示
3. 不会影响深度精度（far/near比例仍然很小）

## 技术说明

### 为什么原来设置 near = 5.0？
- 为了在保持深度精度的同时避免 z-fighting
- 5.0 对于大模型来说是合理的

### 为什么改成 0.1 也可以？
- 对于小模型，需要更小的 near 值
- 0.1 是 WebGL 推荐的最小值
- far/near 比例仍然保持很小（约50倍），深度精度足够

### 动态调整的好处
- distance * 0.2 确保近裁剪面随距离变化
- Math.max(0.1, ...) 确保最小值为0.1，支持小模型
- far = distance * 10 确保 far/near 比例约为50

## 测试步骤

1. 修改源代码或运行修复脚本
2. 重新加载页面
3. 加载小坐标模型（Catwalk04），检查是否显示
4. 加载大坐标模型（L16_10302），检查是否显示
5. 同时加载两个模型，检查是否都显示
6. 测试缩放操作

## 相关文件

- 源代码：`src/components/DualCanvasViewer.vue` 第943行
- 修复脚本：`public/fix-near-far-for-small-models.js`
- 相关函数：`updateCameraProjectionForLargeCoord()`
