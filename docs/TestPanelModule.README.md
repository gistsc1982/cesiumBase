# TestPanelModule 使用指南

## 概述
TestPanelModule 是一个可复用的面板模板，提供多种方式自定义内容区域：
1. 使用 `setContent` 方法动态设置内容
2. 使用插槽静态替换内容
3. 使用组件组合方式

## 核心方法：setContent()

### 方法签名
```javascript
setContent(component, options)
```

### 参数说明

#### component (必需)
- **类型**: `Object | String`
- **说明**: 要渲染的组件
  - 组件对象：直接传入导入的 Vue 组件
  - 字符串路径：组件的相对路径（自动异步导入）

#### options (可选)
- **类型**: `Object`
- **属性**:
  - `props`: `Object` - 传递给组件的 props
  - `events`: `Object` - 事件监听配置 `{ eventName: handler }`
  - `title`: `String` - 覆盖面板标题
  - `titleIcon`: `String` - 覆盖面板图标

## 使用方式

### 方式 1: 使用组件对象（推荐）

```vue
<template>
  <TestPanelModule ref="panel" title="我的面板" />
</template>

<script>
import TestPanelModule from './TestPanelModule.vue';
import MyContentComponent from './MyContentComponent.vue';

export default {
  components: { TestPanelModule },
  mounted() {
    this.$refs.panel.setContent(MyContentComponent, {
      props: {
        data: this.myData,
        mode: 'edit'
      },
      events: {
        'save': this.handleSave,
        'cancel': this.handleCancel
      },
      title: '数据编辑',
      titleIcon: '✏️'
    });
  }
};
</script>
```

### 方式 2: 使用组件路径

```vue
<script>
export default {
  mounted() {
    // 使用相对路径，支持异步加载
    this.$refs.panel.setContent('functions/ObliqueHeightAdjustPanel.vue', {
      props: {
        'selected-layer': this.selectedLayer
      },
      events: {
        'height-change': this.handleHeightChange
      }
    });
  }
};
</script>
```

### 方式 3: 使用插槽（静态内容）

```vue
<template>
  <TestPanelModule title="我的面板">
    <template #content>
      <div>静态内容</div>
    </template>
  </TestPanelModule>
</template>
```

## 完整示例：使用 ObliqueHeightAdjustPanel

```vue
<template>
  <TestPanelModule
    ref="heightPanel"
    title="高度调整"
    :width="360"
    registration-key="MyHeightAdjustPanel"
  />
</template>

<script>
import TestPanelModule from './TestPanelModule.vue';
import ObliqueHeightAdjustPanel from './ObliqueHeightAdjustPanel.vue';

export default {
  name: 'MyHeightAdjustPanel',
  components: {
    TestPanelModule
  },
  data() {
    return {
      selectedLayer: null,
      computedHeightPanelX: 'right',
      initialY: 200,
      showHeightPanel: true
    };
  },
  mounted() {
    this.$refs.heightPanel.setContent(ObliqueHeightAdjustPanel, {
      props: {
        'initial-x': this.computedHeightPanelX,
        'initial-y': this.initialY,
        'selected-layer': this.selectedLayer
      },
      events: {
        'height-preview': this.onHeightPreview,
        'height-change': this.onHeightChange,
        'close': () => { this.showHeightPanel = false; }
      },
      title: '倾斜摄影高度调整',
      titleIcon: '🌏'
    });
  },
  methods: {
    onHeightPreview({ layer, value }) {
      // 处理高度预览
      console.log('预览高度:', value);
    },
    onHeightChange({ layer, value }) {
      // 处理高度变化
      console.log('设置高度:', value);
      // 更新 Cesium 图层
    }
  }
};
</script>
```

## 其他辅助方法

### clearContent()
清除动态内容，恢复默认插槽显示。

```javascript
this.$refs.panel.clearContent();
```

### getContentConfig()
获取当前内容配置。

```javascript
const config = this.$refs.panel.getContentConfig();
console.log(config.component, config.props);
```

## Props 配置

TestPanelModule 支持以下 props：

- `title`: 面板标题（可被 setContent 的 title 覆盖）
- `title-icon`: 标题图标（可被 setContent 的 titleIcon 覆盖）
- `width`: 面板宽度（数字或字符串）
- `max-height`: 最大高度（如 '60vh'）
- `initial-x`: 初始 X 位置（数字或 'left'/'center'/'right'）
- `initial-y`: 初始 Y 位置（数字）
- `allow-minimize`: 是否允许最小化（默认 true）
- `close-event-name`: 关闭事件名称
- `auto-register`: 是否自动注册（默认 true）
- `registration-key`: 注册键
- `panel-instance-id`: 面板实例 ID（多实例模式）

## 配置注册

在 `functionPanels.config.json` 中添加配置：

```json
{
  "name": "MyHeightAdjustPanel",
  "file": "MyHeightAdjustPanel.vue",
  "title": "高度调整面板",
  "description": "使用 setContent 方法",
  "enabled": true,
  "visible": false,
  "icon": "🌏",
  "category": "tools",
  "singleton": true,
  "permissions": [],
  "position": {
    "initialX": "right",
    "initialY": 200
  }
}
```

## 可直接使用的组件

以下组件可以直接通过 setContent 使用：

- ✅ `ObliqueHeightAdjustPanel.vue` - 倾斜摄影高度调整
- ✅ `ObliquePhotographyPanel.vue` - 倾斜摄影管理
- ✅ `TestPanel.vue` - 测试面板
- ✅ 其他基于 FunctionPanelUIBase 的面板组件

## 注意事项

1. **Props 传递**: props 使用 kebab-case 格式传递，与组件定义对应
2. **事件处理**: 事件名使用 kebab-case，确保与组件 emits 定义一致
3. **异步加载**: 使用字符串路径时，组件会异步加载，注意处理加载状态
4. **组件引用**: 使用组件对象时，确保已正确导入

## 架构说明

```
┌─────────────────────────────────────────────┐
│         TestPanelModule (模板基类)           │
│  ┌──────────────────────────────────────┐  │
│  │  FunctionPanelUIBase (UI基类)       │  │
│  │  ┌────────────────────────────────┐  │  │
│  │  │  <slot name="content">         │  │  │
│  │  │    默认 test-panel-content     │  │  │
│  │  │  </slot>                       │  │  │
│  │  └────────────────────────────────┘  │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
           │
           │ 继承
           ▼
┌─────────────────────────────────────────────┐
│      子类 (MyCustomPanel)                    │
│  ┌──────────────────────────────────────┐  │
│  │  <template #content>                 │  │
│  │    方式1: <MyContent />              │  │
│  │    方式2: <PanelContentWrapper />    │  │
│  │  </template>                        │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## 示例文件

项目包含以下示例文件：

1. **SetContentExample.vue** - setContent 方法使用示例
2. **MultiContentExample.vue** - 动态切换内容示例
3. **SlotExample.vue** - 插槽使用示例

## 技术要点

1. **markRaw**: 使用 Vue 的 markRaw 防止组件被响应式转换
2. **动态组件**: 使用 `<component :is>` 实现动态渲染
3. **v-bind/v-on**: 分别处理 props 和 events
4. **计算属性**: 支持标题和图标的动态覆盖
5. **异步导入**: 支持组件路径的动态加载
6. **配置缓存**: 使用内存缓存优化配置读取性能
7. **全局缓存**: 通过 `window.__functionPanelsConfig__` 实现跨组件共享

---

## 配置管理方法

TestPanelModule 提供了一组配置管理方法，用于维护 `functionPanels.config.json` 文件：

### 方法列表

| 方法名 | 说明 | 返回值 |
|-------|------|--------|
| `loadPanelConfig()` | 加载面板配置文件 | Promise\<Object\> |
| `savePanelConfig(config, download)` | 保存配置到文件（导出 JSON） | String |
| `addSingletonPanelConfig(config, saveAndDownload)` | 添加单例面板配置 | Promise\<Object\> |
| `addMultiInstancePanelConfig(config, saveAndDownload)` | 添加多实例面板配置 | Promise\<Object\> |
| `addBothPanelConfigs(config, saveAndDownload)` | 同时添加单例和多实例配置 | Promise\<Object\> |
| `removePanelConfig(name, saveAndDownload)` | 删除面板配置 | Promise\<Object\> |
| `getPanelConfig(name)` | 获取指定面板配置 | Promise\<Object\> |
| `getAllPanelConfigs()` | 获取所有面板配置 | Promise\<Array\> |
| `getPanelsByCategory(category)` | 获取指定分类的面板配置 | Promise\<Array\> |
| `exportConfigToFile()` | 导出当前配置为 JSON 文件 | Promise\<void\> |
| `getConfigFilePath()` | 获取配置文件路径 | String |
| `generateConfigInterface()` | 生成 TypeScript 接口代码 | String |

### 添加单例面板配置

```javascript
await this.$refs.panel.addSingletonPanelConfig({
  name: 'MyCustomPanel',
  file: 'examples/MyCustomPanel.vue',
  title: '我的自定义面板',
  description: '这是一个自定义面板',
  icon: '🚀',
  category: 'tools',
  position: {
    initialX: 'right',
    initialY: 200
  }
}, true); // true 表示自动下载配置文件
```

### 添加多实例面板配置

```javascript
await this.$refs.panel.addMultiInstancePanelConfig({
  name: 'MyCustomPanel',
  file: 'examples/MyCustomPanel.vue',
  title: '我的自定义面板（多实例）',
  description: '这是一个多实例自定义面板',
  icon: '🧬',
  category: 'tools',
  position: {
    initialX: 'center',
    initialY: 120
  }
}, true);
```

### 同时添加单例和多实例配置

```javascript
await this.$refs.panel.addBothPanelConfigs({
  name: 'MyCustomPanel',
  file: 'examples/MyCustomPanel.vue',
  title: '我的自定义面板',
  description: '自定义面板',
  icon: '🚀',
  category: 'tools',
  singletonPosition: { initialX: 'right', initialY: 200 },
  multiInstancePosition: { initialX: 'center', initialY: 280 }
}, true);
```

### 删除面板配置

```javascript
await this.$refs.panel.removePanelConfig('MyCustomPanel', true);
```

### 获取面板配置

```javascript
// 获取指定面板配置
const config = await this.$refs.panel.getPanelConfig('MyCustomPanel');

// 获取所有面板配置
const allConfigs = await this.$refs.panel.getAllPanelConfigs();

// 获取指定分类的面板配置
const toolsConfigs = await this.$refs.panel.getPanelsByCategory('tools');
```

### 导出配置文件

```javascript
// 导出当前配置为 JSON 文件
await this.$refs.panel.exportConfigToFile();
```

## 配置管理方法参数说明

### addSingletonPanelConfig(config, saveAndDownload)

**参数：**
- `config.name` (String, 必需) - 面板唯一名称
- `config.file` (String, 必需) - 组件文件路径
- `config.title` (String) - 面板标题
- `config.description` (String) - 面板描述
- `config.icon` (String) - 图标 emoji
- `config.category` (String) - 分类名称（默认 'tools'）
- `config.position` (Object) - 初始位置配置
  - `position.initialX` (Number\|String) - X 位置或 'left'/'center'/'right'
  - `position.initialY` (Number) - Y 位置
- `config.enabled` (Boolean) - 是否启用（默认 true）
- `config.visible` (Boolean) - 是否可见（默认 false）
- `saveAndDownload` (Boolean) - 是否下载配置文件（默认 false）

**返回：** Promise\<Object\> - 更新后的完整配置

### addMultiInstancePanelConfig(config, saveAndDownload)

参数与 `addSingletonPanelConfig` 相同，但会自动在名称后添加 "Multi" 后缀，并设置 `singleton: false`。

### addBothPanelConfigs(config, saveAndDownload)

**额外参数：**
- `config.singletonPosition` (Object) - 单例面板位置
- `config.multiInstancePosition` (Object) - 多实例面板位置

会同时创建单例和多实例两个配置项。

### removePanelConfig(name, saveAndDownload)

**参数：**
- `name` (String, 必需) - 要删除的面板名称
- `saveAndDownload` (Boolean) - 是否下载配置文件（默认 false）

**返回：** Promise\<Object\> - 更新后的完整配置

## 配置管理使用示例

### 示例1：动态创建面板配置

```vue
<template>
  <TestPanelModule ref="panel" />
  <button @click="createCustomPanel">创建自定义面板</button>
</template>

<script>
export default {
  methods: {
    async createCustomPanel() {
      await this.$refs.panel.addSingletonPanelConfig({
        name: 'DynamicPanel',
        file: 'examples/DynamicPanel.vue',
        title: '动态创建的面板',
        description: '通过代码动态创建的面板配置',
        icon: '⚡',
        category: 'tools',
        position: {
          initialX: 'right',
          initialY: 150
        }
      }, true); // true = 自动下载配置文件

      alert('配置已创建！请将下载的文件复制到项目目录。');
    }
  }
};
</script>
```

### 示例2：批量管理面板配置

```vue
<script>
export default {
  async mounted() {
    const panel = this.$refs.panel;

    // 添加多个面板
    await panel.addSingletonPanelConfig({
      name: 'Panel1',
      file: 'Panel1.vue',
      title: '面板1',
      icon: '1️⃣',
      category: 'demo'
    }, false);

    await panel.addSingletonPanelConfig({
      name: 'Panel2',
      file: 'Panel2.vue',
      title: '面板2',
      icon: '2️⃣',
      category: 'demo'
    }, false);

    // 一次性导出所有配置
    await panel.exportConfigToFile();
  }
};
</script>
```

### 示例3：查询和管理现有配置

```vue
<script>
export default {
  async mounted() {
    const panel = this.$refs.panel;

    // 获取所有工具类面板
    const toolsPanels = await panel.getPanelsByCategory('tools');
    console.log('工具类面板:', toolsPanels);

    // 检查特定面板是否存在
    const existingPanel = await panel.getPanelConfig('MyPanel');
    if (existingPanel) {
      console.log('面板已存在:', existingPanel);

      // 删除旧配置
      await panel.removePanelConfig('MyPanel', false);
    }

    // 添加新配置
    await panel.addSingletonPanelConfig({
      name: 'MyPanel',
      file: 'MyPanel.vue',
      title: '我的面板',
      icon: '📦'
    }, true);
  }
};
</script>
```

### 示例4：生成 TypeScript 类型定义

```javascript
// 生成配置接口的 TypeScript 代码
const interfaceCode = this.$refs.panel.generateConfigInterface();
console.log(interfaceCode);

// 输出:
// interface PanelConfig {
//   name: string;
//   file: string;
//   ...
// }
```

## 配置文件格式说明

生成的 `functionPanels.config.json` 文件格式：

```json
{
  "description": "功能面板组件配置文件 - 可手工编辑来控制哪些组件可以被动态加载和默认显示",
  "version": "1.0.0",
  "lastUpdated": "2024-06-12",
  "panels": [
    {
      "name": "MyPanel",
      "file": "examples/MyPanel.vue",
      "title": "我的面板",
      "description": "面板描述",
      "enabled": true,
      "visible": false,
      "icon": "🚀",
      "category": "tools",
      "singleton": true,
      "permissions": [],
      "position": {
        "initialX": "right",
        "initialY": 200
      }
    }
  ],
  "categories": {
    "tools": {
      "name": "工具",
      "description": "工具类面板",
      "icon": "🔧"
    }
  }
}
```

## 配置管理注意事项

1. **文件路径**: 配置文件路径为 `src/components/functions/functionPanels.config.json`
2. **自动下载**: 设置 `saveAndDownload: true` 会自动下载 JSON 文件
3. **手动复制**: 下载的 JSON 文件需要手动复制到项目目录才能生效
4. **内存缓存**: 配置会被缓存到 `window.__functionPanelsConfig__`，提高读取性能
5. **名称唯一性**: 面板名称必须唯一，重复名称会更新现有配置
6. **分类自动创建**: 添加面板时，如果分类不存在会自动创建

## 配置管理最佳实践

1. **开发阶段**: 使用 `saveAndDownload: false`，批量操作后一次性导出
2. **生产环境**: 手动编辑配置文件，确保版本控制
3. **版本同步**: 导出的配置文件应提交到版本控制系统
4. **命名规范**: 使用驼峰命名法，多实例面板自动添加 "Multi" 后缀
5. **分类管理**: 合理使用分类，便于面板组织和查找
