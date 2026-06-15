# Claude Code 开发规范

## 🤖 给 Claude 的提示

### 在开始编码任务前，请务必执行以下步骤：

#### 第 1 步：查阅项目规范 ⭐ **强制要求**
```
1. 搜索本文档中与任务相关的规范
2. 确认编码时需要遵守的规则
3. 了解历史问题和避免方案
```

#### 第 2 步：快速检查清单
```bash
# 搜索相关规范
grep -n "Vue 3" docs/CLAUDE.md
grep -n "响应式" docs/CLAUDE.md
grep -n "性能" docs/CLAUDE.md
grep -n "Cesium" docs/CLAUDE.md
```

#### 第 3 步：编码时遵守规范
- ✅ 严格遵循文档中列出的正确做法
- ✅ 避免"错误示例"中的模式
- ✅ 参考"正确示例"实现

#### 第 4 步：修改后自查
- ✅ 代码是否违反了任何规范
- ✅ 是否有更好的实现方式
- ✅ 是否需要更新文档记录新问题

### 快速参考规范索引

| 任务类型 | 查找关键字 | 相关章节 |
|---------|-----------|---------|
| Vue 兼容性 | `Vue 3`, `响应式` | §6.5 Vue 3 响应式式更新规范 |
| 性能优化 | `Cesium`, `$set` | §6.1-6.6 |
| 变量声明 | `变量`, `重复` | §1 变量重复声明检查 |
| 事件处理 | `input`, `change` | §6.5 避免频繁触发 Cesium 更新 |
| 组件嵌套 | `Teleport` | §6.3 Teleport 嵌套冲突 |

---

## 代码修改检查清单

在修改代码后，必须执行以下检查：

### 1. 变量重复声明检查

**问题**：在同一个函数作用域中多次使用 `const` 或 `let` 声明同一个变量名，会导致打包错误。

**错误示例**：
```javascript
function handleZoomInUnified(deltaZoom) {
  // 函数开头声明
  const isUsingLocalCoord = this.mercatorProjection.isUsingLocalCoordinateSystem();

  // ... 其他代码 ...

  // 函数后面再次声明（错误！）
  const isUsingLocalCoord = this.mercatorProjection.isUsingLocalCoordinateSystem();

  if (!isUsingLocalCoord) {
    // ...
  }
}
```

**错误信息**：
```
Identifier "isUsingLocalCoord" has already been declared
```

**正确做法**：
1. **在函数开头声明一次**，整个函数中复用
2. **如果需要在后面使用**，添加注释说明变量已在前面声明
3. **使用 `grep` 检查**：在修改文件前，搜索变量名确保没有重复声明

**正确示例**：
```javascript
function handleZoomInUnified(deltaZoom) {
  // ⭐ 在函数开头声明一次
  const isUsingLocalCoord = this.mercatorProjection.isUsingLocalCoordinateSystem();

  // ... 其他代码 ...

  // ⭐ 后续使用时，添加注释说明已声明
  if (!isUsingLocalCoord) {  // isUsingLocalCoord 已在函数开头声明
    // ...
  }
}
```

### 2. 修改前检查步骤

在修改任何 JS/TS 文件前：

1. **使用 `Read` 工具查看文件**，了解现有结构
2. **使用 `Grep` 工具搜索变量名**，确认是否已声明
3. **修改完成后，检查语法**：
   ```bash
   node -c src/utils/YourFile.js
   ```

### 3. 常见错误模式

以下模式容易出现重复声明：

1. **多次检查同一条件**：
   ```javascript
   // ❌ 错误：多次声明
   const isLocalCoord = check();
   if (isLocalCoord) { ... }

   const isLocalCoord = check();  // 重复声明！
   if (isLocalCoord) { ... }

   // ✅ 正确：声明一次，复用
   const isLocalCoord = check();
   if (isLocalCoord) { ... }
   if (isLocalCoord) { ... }
   ```

2. **复制粘贴代码块**：
   复制粘贴代码时，忘记删除重复的变量声明

3. **函数分支中声明相同变量**：
   ```javascript
   // ❌ 错误
   if (condition1) {
     const result = calculate();
   }
   if (condition2) {
     const result = calculate();  // 重复声明
   }

   // ✅ 正确
   let result;
   if (condition1) {
     result = calculate();
   }
   if (condition2) {
     result = calculate();
   }
   ```

### 4. 检查命令

修改文件后，务必运行：

```bash
# 1. 语法检查
node -c src/utils/SyncManager.js

# 2. 尝试打包（如果语法通过）
npm run build
```

### 5. 历史问题记录

| 日期 | 文件 | 问题 | 解决方案 |
|------|------|------|----------|
| 2024-04-26 | SyncManager.js | `isUsingLocalCoord` 重复声明 | 在函数开头声明一次，后面使用时添加注释 |
| 2024-04-26 | SyncManager.js | 缩放函数中重复声明 `isUsingLocalCoord` | 删除后续重复声明，保留开头声明 |
| 2025-01-15 | ObliquePhotographyPanel.vue | 滑块@input事件频繁触发Cesium更新导致性能问题 | 分离input/change事件，input只更新显示值，change触发Cesium更新 |
| 2026-06-13 | ObliquePhotographyPanel.vue | Cesium对象存储在Vue响应式数据中导致362ms(38.8%)性能损耗 | 使用beforeCreate钩子创建非响应式Map存储Cesium对象，冻结Cesium对象，优化3D瓦片配置 |

### 6. Cesium 性能优化规范

#### 6.1 ⚡ 避免将 Cesium 对象存储在 Vue 响应式数据中

**严重程度**: **P0 - 致命性能问题**

**问题**: 将 Cesium 对象（如 Cesium3DTileset, Matrix4 等）存储在 Vue 的 data 或响应式对象中，会导致 Vue 将这些复杂对象包装为响应式，造成严重的性能问题。

**性能影响**: 可导致 **362ms (38.8%)** 的性能损耗，其中：
- BoxGeometryUpdater: 130.4ms (13.9%)
- Three.js 核心: 75.5ms (8.1%)
- Vue 兼容层: 37.4ms (4.0%)

**错误示例**：
```javascript
// ❌ 错误：Cesium 对象被包装为响应式
data() {
  return {
    obliquePhotographyList: []  // 包含 tileset, initialTransform 等 Cesium 对象
  };
},
methods: {
  loadObliquePhotography(item) {
    const tileset = new Cesium.Cesium3DTileset({...});
    // 将 Cesium 对象存储在响应式数组中
    item.tileset = tileset;
    item.initialTransform = Cesium.Matrix4.clone(tileset.root.transform);
    this.$set(item, 'loaded', true);
  }
}
```

**正确做法**：
```javascript
// ✅ 正确：使用非响应式 Map 存储 Cesium 对象
beforeCreate() {
  // 在 Vue 实例创建前初始化，避免被包装为响应式
  this._cesiumTilesets = new Map();
  this._cesiumTransforms = new Map();
  this._cesiumHeightOffsets = new Map();
},
data() {
  return {
    // 只包含 UI 状态，不包含 Cesium 对象
    obliquePhotographyList: []  // 只包含 id, name, url, loaded, loading, heightOffset
  };
},
methods: {
  loadObliquePhotography(item) {
    const tileset = new Cesium.Cesium3DTileset({...});

    // 冻结 Cesium 对象，防止 Vue 响应式包装
    Object.freeze(tileset);

    // 存储到非响应式 Map 中
    this._cesiumTilesets.set(item.id, tileset);

    // 只在响应式数据中存储 UI 状态
    const index = this.obliquePhotographyList.findIndex(i => i.id === item.id);
    if (index !== -1) {
      this.obliquePhotographyList[index].loaded = true;
      this.obliquePhotographyList = [...this.obliquePhotographyList];
    }
  },

  // 从非响应式 Map 中获取 Cesium 对象
  applyObliqueHeightOffset(item) {
    const tileset = this._cesiumTilesets.get(item.id);
    const initialTransform = this._cesiumTransforms.get(item.id);
    // ...
  }
},
beforeUnmount() {
  // 清理非响应式 Map
  this._cesiumTilesets.clear();
  this._cesiumTransforms.clear();
}
```

**性能提升**: 50-70%（将 362ms 降低到 100-180ms）

#### 6.2 冻结 Cesium 对象

**严重程度**: **P0 - 重要性能优化**

即使使用非响应式 Map，也应该冻结 Cesium 对象以防止意外访问：

```javascript
const tileset = new Cesium.Cesium3DTileset({...});
Object.freeze(tileset);  // 冻结对象

const transform = Cesium.Matrix4.clone(tileset.root.transform);
Object.freeze(transform);  // 冻结 Matrix4
```

#### 6.3 优化 3D 瓦片配置

**严重程度**: **P0 - 重要性能优化**

优化 Cesium3DTileset 配置可以提升 30-40% 的性能：

```javascript
// ❌ 错误配置
const tileset = new Cesium.Cesium3DTileset({
  url: item.url,
  maximumScreenSpaceError: 2,  // 值太小，导致过度渲染
  immediatelyLoadDesiredLevelOfDetail: true  // 立即加载，性能问题
});

// ✅ 优化配置
const tileset = new Cesium.Cesium3DTileset({
  url: item.url,
  maximumScreenSpaceError: 16,  // 提高到 16，减少细节渲染
  immediatelyLoadDesiredLevelOfDetail: false,  // 改为 false
  // 添加动态屏幕空间误差优化
  dynamicScreenSpaceError: true,
  dynamicScreenSpaceErrorDensity: 0.00278,
  dynamicScreenSpaceErrorFactor: 4.0,
  dynamicScreenSpaceErrorHeightFalloff: 0.25,
  // 确保调试模式关闭
  debugShowBoundingVolume: false,
  debugShowContentBoundingVolume: false,
  debugShowViewerRequestVolume: false
});
```

#### 6.5 Vue 3 响应式更新规范

**严重程度**: **P1 - 兼容性要求**

**问题**: 使用 Vue 2.x 的 `this.$set` API 会导致性能问题和兼容性警告。

**错误示例**：
```javascript
// ❌ 错误：使用 Vue 2 的 $set API
this.$set(this.registeredPanels[key], 'visible', visible);

// ❌ 错误：导入并使用 Vue 2 的 set 函数
import { set } from 'vue';
set(this.object, 'property', value);
```

**正确做法**：
```javascript
// ✅ 正确：Vue 3 直接赋值（Proxy 自动处理响应式）
this.registeredPanels[key].visible = visible;

// ✅ 对于对象替换（确保响应式）
this.registeredPanels[key] = {
  ...this.registeredPanels[key],
  visible: visible
};

// ✅ 对于数组替换（触发响应式）
this.obliquePhotographyList = [...this.obliquePhotographyList];
```

**原理说明**：
- Vue 2 使用 `Object.defineProperty` 实现响应式，无法检测新增属性
- Vue 3 使用 `Proxy` 实现响应式，所有属性操作都是响应式的
- 在 Vue 3 中使用 `this.$set` 会触发兼容层警告，且性能较差

**性能影响**：
- `this.$set`: 约 2-3ms （触发兼容层检查）
- 直接赋值: <0.1ms （原生 Proxy 操作）

**历史记录**：
| 日期 | 文件 | 问题描述 | 解决方案 |
|------|------|----------|----------|
| 2026-06-16 | CesiumMain.vue | 使用 `this.$set` 导致 Vue 警告 | 改为 Vue 3 直接赋值 |

#### 6.6 移除 $set 调用

**严重程度**: **P1 - 重要性能优化**

`$set` 是 Vue 2.x 的 API，会触发整个数组的响应式更新，代价高昂：

```javascript
// ❌ 错误：频繁使用 $set
this.$set(item, 'loading', true);
this.$set(item, 'loaded', true);
this.$set(item, 'tileset', tileset);

// ✅ 正确：使用数组替换
const index = this.obliquePhotographyList.findIndex(i => i.id === item.id);
if (index !== -1) {
  this.obliquePhotographyList[index].loading = true;
  this.obliquePhotographyList = [...this.obliquePhotographyList];
}
```

#### 6.5 避免频繁触发 Cesium 更新

**问题**：使用滑块（range input）的 `@input` 事件直接触发 Cesium 操作会导致性能问题。用户拖动滑块时会连续触发事件，每次都执行 Cesium 更新操作（如修改 tileset 变换矩阵）。

**错误示例**：
```vue
<!-- ❌ 错误：每次滑块移动都触发 Cesium 更新 -->
<input
  type="range"
  :value="heightOffset"
  @input="onHeightChange"  <!-- 频繁触发！ -->
/>

<script>
methods: {
  onHeightChange(event) {
    const value = parseFloat(event.target.value);
    this.heightOffset = value;
    this.applyCesiumUpdate();  // 每次都执行！性能杀手
  }
}
</script>
```

**正确做法**：
```vue
<!-- ✅ 正确：分离 preview 和 confirm 逻辑 -->
<input
  type="range"
  :value="heightOffset"
  @input="onHeightPreview"   <!-- 只更新显示 -->
  @change="onHeightConfirm"   <!-- 释放时触发 Cesium 更新 -->
/>

<script>
methods: {
  // 滑块拖动时：只更新显示值
  onHeightPreview(event) {
    const value = parseFloat(event.target.value);
    this.heightOffset = value;  // 仅更新UI显示
  },

  // 滑块释放时：执行 Cesium 更新
  onHeightConfirm(event) {
    const value = parseFloat(event.target.value);
    this.heightOffset = value;
    this.applyCesiumUpdate();  // 只执行一次
  }
}
</script>
```

#### 6.2 Cesium 操作防抖原则

| 操作类型 | 推荐方式 | 防抖时间 |
|---------|---------|---------|
| 相机飞行 | 防抖 | 100-200ms |
| 图层显示/隐藏 | 防抖 | 50-100ms |
| 高度/位置调整 | change事件 | - |
| 样式更新 | 防抖 | 100-300ms |
| 数据加载 | - | 无需防抖 |

#### 6.3 Teleport 嵌套冲突

**问题**：多个 `Teleport to="body"` 嵌套时会产生渲染冲突和性能问题。

**错误示例**：
```vue
<!-- ❌ 错误：嵌套 Teleport -->
<FunctionPanelUIBase>
  <Teleport to="body">
    <AnotherPanel />  <!-- 冲突！ -->
  </Teleport>
</FunctionPanelUIBase>
```

**正确做法**：
```vue
<!-- ✅ 正确：平级 Teleport -->
<FunctionPanelUIBase>
  <!-- 内容 -->
</FunctionPanelUIBase>

<Teleport to="body">
  <AnotherPanel />
</Teleport>
```

## 记录新增问题

当遇到新的代码格式错误时，请在此文档中添加记录，格式参考上表。
