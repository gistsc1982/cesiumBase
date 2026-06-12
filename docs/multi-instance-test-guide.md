# 多实例面板配置测试指南

## 测试目的

验证多实例模式下，功能面板能够：
1. 正确创建独立实例配置
2. 根据实例ID自动偏移位置
3. 独立控制可见性

## 测试步骤

### 1. 启动应用

```bash
cd D:\GISBIM\cesiumBase
npm run dev
```

### 2. 打开浏览器控制台

在浏览器控制台中执行以下测试命令：

#### 测试1: 查看多实例配置管理器状态

```javascript
// 查看全局配置管理器
window.__multiInstancePanelConfigManager__.getStats()

// 预期输出：
// {
//   总实例数: 1,
//   实例列表: [1],
//   位置偏移: { x: 40, y: 40 },
//   默认可见: true
// }
```

#### 测试2: 查看实例1的面板配置

```javascript
// 获取实例1的TestPanel配置
const config = window.__multiInstancePanelConfigManager__.getPanelConfig(1, 'TestPanel');
console.log('TestPanel 配置:', config);

// 预期输出：
// {
//   name: 'TestPanel',
//   title: '测试面板',
//   visible: true,
//   position: { initialX: 'left', initialY: 100 },
//   ...
// }
```

#### 测试3: 切换面板可见性

```javascript
// 隐藏TestPanel
window.__multiInstancePanelConfigManager__.setPanelVisible(1, 'TestPanel', false);

// 再次显示TestPanel
window.__multiInstancePanelConfigManager__.setPanelVisible(1, 'TestPanel', true);

// 切换可见性
const newVisible = window.__multiInstancePanelConfigManager__.togglePanelVisible(1, 'TestPanel');
console.log('TestPanel 新的可见性:', newVisible);
```

#### 测试4: 创建多个实例（如果应用支持）

```javascript
// 模拟创建新实例
const instanceId2 = window.__multiInstancePanelConfigManager__.createInstance();
console.log('新实例ID:', instanceId2);

// 查看两个实例的TestPanel位置差异
const config1 = window.__multiInstancePanelConfigManager__.getPanelConfig(1, 'TestPanel');
const config2 = window.__multiInstancePanelConfigManager__.getPanelConfig(2, 'TestPanel');
console.log('实例1位置:', config1.position);
console.log('实例2位置:', config2.position);

// 预期：实例2的Y坐标应该比实例1偏移40px
```

### 3. 视觉测试

1. **位置验证**：
   - TestPanel 应该显示在配置文件中指定的位置
   - 如果有多个实例，不同实例的面板应该在视觉上分离（不重叠）

2. **可见性验证**：
   - TestPanel 默认应该是可见的（`visible: true`）
   - ObliquePhotographyPanel 默认应该是隐藏的（`visible: false`）

3. **交互验证**：
   - 点击最小化按钮，面板应该最小化
   - 点击关闭按钮，面板应该隐藏
   - 再次打开面板，应该保持之前的位置

## 控制台日志

正常情况下，控制台应该显示以下日志：

```
[MultiInstancePanelConfigManager] 初始化完成
[MultiInstancePanelConfigManager] 全局配置已初始化: { 面板数: 2, 位置偏移: {x: 40, y: 40}, 默认可见: true }
[MultiInstancePanelConfigManager] ✅ 创建实例 #1，配置面板数: 2
[CesiumMain] ✅ 多实例配置已初始化，实例 ID: 1
[CesiumMain #1] 📦 检测到 2 个启用的面板组件
[CesiumMain #1] 📋 预加载面板组件: TestPanel
[CesiumMain #1] 📋 预加载面板组件: ObliquePhotographyPanel
[FunctionPanelUIBase #1] TestPanel 已注册, visible: true, position: { initialX: 'left', initialY: 100 }
[FunctionPanelUIBase #1] ObliquePhotographyPanel 已注册, visible: false, position: { initialX: 'center', initialY: 120 }
```

## 故障排除

### 问题1: 面板没有显示

**可能原因**：
- 配置文件中 `visible: false`
- 组件加载失败
- 实例ID不正确

**解决方法**：
```javascript
// 检查配置
const config = window.__multiInstancePanelConfigManager__.getPanelConfig(1, 'TestPanel');
console.log('配置:', config);

// 强制设置为可见
window.__multiInstancePanelConfigManager__.setPanelVisible(1, 'TestPanel', true);
```

### 问题2: 多个实例面板重叠

**可能原因**：
- 位置偏移配置未生效
- 实例ID相同

**解决方法**：
```javascript
// 检查实例ID
console.log('当前实例ID:', window.__cesiumMainInstanceId__);

// 检查位置配置
const config1 = window.__multiInstancePanelConfigManager__.getPanelConfig(1, 'TestPanel');
const config2 = window.__multiInstancePanelConfigManager__.getPanelConfig(2, 'TestPanel');
console.log('位置差异:', {
  实例1: config1.position,
  实例2: config2.position
});
```

## 预期结果

✅ 所有功能面板都能正确显示
✅ TestPanel 默认可见，ObliquePhotographyPanel 默认隐藏
✅ 面板位置与配置文件一致
✅ 多实例模式下面板位置自动偏移，不重叠
✅ 控制台显示正确的日志信息

## 相关文件

- `src/components/utils/MultiInstancePanelConfigManager.js` - 配置管理器
- `src/components/CesiumMain.vue` - 主组件（已修改）
- `src/components/functionPanelUIBase.vue` - 面板基类（已修改）
- `src/components/functions/functionPanels.config.json` - 配置文件
