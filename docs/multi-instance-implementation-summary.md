# 多实例面板配置实现总结

## 实现概述

已完成方案一：实例感知的配置管理器，为多实例模式下的功能面板提供独立配置支持。

## 修改的文件

### 1. 新建文件

#### `src/components/utils/MultiInstancePanelConfigManager.js`
- **功能**：多实例面板配置管理器
- **主要特性**：
  - 为每个实例维护独立的配置副本
  - 自动计算位置偏移（默认每个实例偏移40px）
  - 支持实例级别的可见性控制
  - 向后兼容单实例模式

- **核心方法**：
  ```javascript
  initGlobalConfig(config)        // 初始化全局配置
  createInstance(options)         // 创建新实例配置
  getPanelConfig(instanceId, name) // 获取面板配置
  setPanelVisible(instanceId, name, visible) // 设置可见性
  destroyInstance(instanceId)     // 销毁实例配置
  ```

### 2. 修改的文件

#### `src/components/CesiumMain.vue`

**导入配置管理器**：
```javascript
import { multiInstancePanelConfigManager } from './utils/MultiInstancePanelConfigManager.js';
```

**新增数据字段**：
```javascript
data() {
  return {
    instanceId: null, // 当前实例ID
    // ... 其他字段
  };
}
```

**新增方法**：
```javascript
methods: {
  initMultiInstanceConfig() {
    // 初始化多实例配置管理器
    // 创建当前实例配置
  }
}
```

**修改的provide**：
```javascript
provide() {
  return {
    instanceId: this.instanceId || 1, // 使用动态实例ID
    // ... 其他提供
  };
}
```

**修改的mounted**：
- 添加多实例配置初始化
- 使用实例特定的配置预注册面板

**修改的registerPanelComponent**：
- 从配置管理器获取实例配置
- 合并实例配置和传入的配置
- 实例配置优先

**修改的beforeUnmount**：
- 销毁实例配置

#### `src/components/functionPanelUIBase.vue`

**新增inject**：
```javascript
inject: {
  instanceId: {
    default: 1 // 默认为第一个实例
  }
}
```

**新增方法**：
```javascript
getInstanceConfig() {
  // 从多实例配置管理器获取实例配置
}
```

**修改的registerToParent**：
- 使用getInstanceConfig获取实例配置
- 合并实例位置配置和组件props
- 使用实例配置的可见性

### 3. 新建文档

#### `docs/multi-instance-panel-config.md`
- 方案设计文档
- 使用示例
- 迁移步骤

#### `docs/multi-instance-test-guide.md`
- 测试指南
- 测试步骤
- 故障排除

## 配置流程

### 初始化流程

1. **CesiumMain mounted**：
   ```
   initMultiInstanceConfig()
   → multiInstancePanelConfigManager.initGlobalConfig(functionPanelsConfig)
   → multiInstancePanelConfigManager.createInstance()
   → this.instanceId = 1
   ```

2. **加载面板组件**：
   ```
   loadFunctionPanel(panelName)
   → 获取组件
   → registerPanelComponent(name, { component, props, visible })
   → multiInstancePanelConfigManager.getPanelConfig(instanceId, name)
   → 使用实例配置（位置偏移、可见性）
   ```

3. **子组件注册**：
   ```
   FunctionPanelUIBase mounted
   → autoRegister && registrationKey
   → registerToParent()
   → getInstanceConfig()
   → registerPanelComponent()
   → 合并实例配置
   ```

### 位置偏移逻辑

每个实例的面板位置会自动偏移：

```
实例 #1: initialY = 100
实例 #2: initialY = 140 (100 + 40)
实例 #3: initialY = 180 (140 + 40)
...
```

偏移量可在配置管理器中自定义：
```javascript
positionOffset: {
  x: 40, // 水平偏移
  y: 40  // 垂直偏移
}
```

### 可见性控制

- 配置文件中的 `visible` 字段作为初始值
- 每个实例独立控制可见性
- 默认值：`true`

## 向后兼容性

✅ **完全兼容单实例模式**：
- 如果只有一个实例，行为与之前完全一致
- 配置文件格式不变
- 子组件无需修改（除非需要使用实例特定功能）

## 使用示例

### 单实例模式（默认）

```javascript
// 自动使用实例 #1
// 配置从 functionPanels.config.json 读取
// 行为与之前完全一致
```

### 多实例模式

```javascript
// 创建多个 CesiumMain 实例
const instance1 = new CesiumMain(); // instanceId = 1
const instance2 = new CesiumMain(); // instanceId = 2

// 每个实例有独立的面板配置
// instance2 的面板会自动偏移 40px

// 独立控制可见性
multiInstancePanelConfigManager.setPanelVisible(1, 'TestPanel', true);
multiInstancePanelConfigManager.setPanelVisible(2, 'TestPanel', false);
```

## 测试验证

请参考 `docs/multi-instance-test-guide.md` 进行测试。

## 下一步（可选）

1. **配置文件增强**：
   - 添加 `multiInstance` 配置节
   - 支持自定义位置偏移
   - 支持实例特定的默认配置

2. **UI增强**：
   - 添加实例切换界面
   - 显示当前实例ID
   - 实例配置可视化编辑

3. **持久化**：
   - 将实例配置保存到 localStorage
   - 支持配置导入/导出
   - 保存用户自定义位置

## 文件清单

```
cesiumBase/
├── src/
│   └── components/
│       ├── utils/
│       │   └── MultiInstancePanelConfigManager.js (新建)
│       ├── CesiumMain.vue (已修改)
│       └── functionPanelUIBase.vue (已修改)
└── docs/
    ├── multi-instance-panel-config.md (新建)
    └── multi-instance-test-guide.md (新建)
```

## 总结

✅ 已完成方案一的所有实现
✅ 支持多实例独立配置
✅ 自动位置偏移避免重叠
✅ 独立可见性控制
✅ 向后兼容单实例模式
✅ 提供完整的测试指南

系统现在可以在多实例模式下正确管理功能面板配置，每个实例都有独立的面板位置和可见性设置。
