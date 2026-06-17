#!/usr/bin/env node

/**
 * 面板配置管理命令行工具
 *
 * 使用方法：
 *   node scripts/panel-config.js add SetContentExample
 *   node scripts/panel-config.js add-all
 *   node scripts/panel-config.js list
 *   node scripts/panel-config.js export
 *   node scripts/panel-config.js validate
 */

const fs = require('fs');
const path = require('path');

// 配置文件路径（从 src/utils 向上两级到 src/components/functions）
const CONFIG_FILE = path.join(__dirname, '../components/functions/functionPanels.config.json');

// ==================== 配置元数据定义 ====================

/**
 * 面板配置字段元数据
 * 定义所有配置字段及其类型、是否必需、默认值和说明
 */
const PANEL_CONFIG_SCHEMA = {
  // 必需字段
  required: {
    name: { type: 'string', description: '面板名称（唯一标识符）' },
    file: { type: 'string', description: '组件文件路径（相对于 functions 目录）' },
    title: { type: 'string', description: '面板显示标题' },
    description: { type: 'string', description: '面板功能描述' },
    enabled: { type: 'boolean', default: true, description: '是否启用面板' },
    visible: { type: 'boolean', default: false, description: '默认是否可见' },
    icon: { type: 'string', description: '面板图标（emoji）' },
    category: { type: 'string', description: '面板分类（需在 categories 中定义）' },
    singleton: { type: 'boolean', description: '是否为单例模式（true=单例，false=多实例）' },
    lazyLoad: { type: 'boolean', default: true, description: '是否延迟加载（在面板首次打开时才加载配置）' },
    permissions: { type: 'array', default: [], description: '权限配置数组' },
    position: {
      type: 'object',
      description: '面板初始位置',
      properties: ['initialX', 'initialY'],
      allowedValues: { initialX: ['left', 'center', 'right', 'number'], initialY: 'number' }
    }
  },

  // 可选字段
  optional: {
    singletonContainerId: {
      type: 'string',
      description: '全局容器 ID（用于单例模式，多实例模式建议配置以保持格式统一）'
    },
    iifeGlobalVar: {
      type: 'string',
      description: 'IIFE 全局变量名（仅用于 .mjs 文件）',
      condition: 'file.endsWith(".mjs")'
    }
  }
};

/**
 * 验证面板配置是否符合元数据规范
 * @param {Object} config - 面板配置对象
 * @param {Object} schema - 配置元数据
 * @returns {Object} { valid: boolean, errors: Array<string>, warnings: Array<string> }
 */
function validatePanelConfig(config, schema = PANEL_CONFIG_SCHEMA) {
  const errors = [];
  const warnings = [];

  // 检查必需字段
  for (const [field, metadata] of Object.entries(schema.required)) {
    if (!(field in config)) {
      errors.push(`缺少必需字段: ${field} (${metadata.description})`);
    } else {
      // 类型检查
      const expectedType = metadata.type;
      const actualValue = config[field];
      const actualType = Array.isArray(actualValue) ? 'array' : typeof actualValue;

      if (expectedType === 'array' && !Array.isArray(actualValue)) {
        errors.push(`字段 ${field} 类型错误: 期望 array，实际 ${actualType}`);
      } else if (expectedType !== 'array' && expectedType !== actualType) {
        errors.push(`字段 ${field} 类型错误: 期望 ${expectedType}，实际 ${actualType}`);
      }
    }
  }

  // 检查可选字段的条件
  for (const [field, metadata] of Object.entries(schema.optional || {})) {
    if (field in config) {
      // 检查条件是否满足
      if (metadata.condition) {
        // 简单条件检查（支持 singleton === true 等格式）
        const condition = metadata.condition
          .replace('singleton', 'config.singleton')
          .replace('file.endsWith(', 'config.file.endsWith(');

        // 安全评估条件（仅支持简单的比较）
        try {
          const meetsCondition = eval(condition);
          if (!meetsCondition) {
            warnings.push(`字段 ${field} 的配置条件不满足: ${metadata.condition}`);
          }
        } catch (e) {
          warnings.push(`无法评估字段 ${field} 的条件: ${metadata.condition}`);
        }
      }
    }
  }

  // 特殊验证：position 结构
  if (config.position) {
    if (typeof config.position.initialX !== 'number' &&
        config.position.initialX !== 'left' &&
        config.position.initialX !== 'center' &&
        config.position.initialX !== 'right') {
      errors.push(`position.initialX 值无效: ${config.position.initialX}，必须是 left/center/right 或数字`);
    }
    if (typeof config.position.initialY !== 'number') {
      errors.push(`position.initialY 必须是数字: ${config.position.initialY}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 验证配置文件中的所有面板
 * @param {Object} config - 完整配置对象
 * @returns {Object} { valid: boolean, results: Array }
 */
function validateAllPanels(config) {
  const results = [];

  for (const panel of config.panels) {
    const validation = validatePanelConfig(panel);
    results.push({
      name: panel.name,
      ...validation
    });
  }

  const allValid = results.every(r => r.valid);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

  return {
    valid: allValid,
    totalErrors,
    totalWarnings,
    results
  };
}

/**
 * 从 functionPanels.config.json 读取并生成 EXAMPLE_PANELS 的硬编码值
 * 用于更新文件中的 EXAMPLE_PANELS 常量
 */
function generateExamplePanelsCode() {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    const panels = {};

    // 按 baseName 分组（单例和多实例）
    const panelGroups = {};

    for (const panel of config.panels) {
      // 提取基础名称（移除 Multi 后缀）
      let baseName = panel.name;
      if (panel.name.endsWith('Multi')) {
        baseName = panel.name.slice(0, -5); // 移除 'Multi'
      }

      if (!panelGroups[baseName]) {
        panelGroups[baseName] = {};
      }

      if (panel.name.endsWith('Multi')) {
        panelGroups[baseName].multi = panel;
      } else {
        panelGroups[baseName].singleton = panel;
      }
    }

    // 转换为 EXAMPLE_PANELS 格式
    for (const [baseName, group] of Object.entries(panelGroups)) {
      const singleton = group.singleton;
      const multi = group.multi;

      if (!singleton && !multi) continue;

      // 从单例或多实例配置构建面板对象
      const panelConfig = {
        name: baseName,
        file: (singleton || multi).file,
        title: (singleton || multi).title?.replace('（单例）', '').replace('（多实例）', ''),
        description: (singleton || multi).description?.replace('（单例模式）', '').replace('（多实例）', '').replace('（多实例模式）', ''),
        icon: (singleton || multi).icon,
        category: (singleton || multi).category,
        singletonContainerId: (singleton || multi).singletonContainerId || baseName
      };

      // 单例位置信息
      if (singleton) {
        panelConfig.position = singleton.position;
      }

      // 多实例位置和信息
      if (multi) {
        panelConfig.multiPosition = multi.position;
        panelConfig.multiIcon = multi.icon;
        panelConfig.multiCategory = multi.category;
      } else if (singleton) {
        // 如果没有多实例配置，使用单例配置作为默认值
        panelConfig.multiPosition = singleton.position;
        panelConfig.multiIcon = singleton.icon;
        panelConfig.multiCategory = singleton.category;
      }

      panels[baseName] = panelConfig;
    }

    return panels;
  } catch (error) {
    console.error('读取面板配置失败:', error.message);
    return {};
  }
}

/**
 * 生成 EXAMPLE_PANELS 的硬编码代码字符串
 */
function generateExamplePanelsString() {
  const panels = generateExamplePanelsCode();
  const panelNames = Object.keys(panels).sort();

  let code = '// 示例面板配置（包含单例和多实例的完整配置）\n';
  code += '// 所有继承 FunctionPanelUIBase 的组件都在这里配置\n';
  code += '// 使用 \'node panel-config.js load-example-panels\' 命令更新此常量\n';
  code += 'const EXAMPLE_PANELS = {\n';

  for (const name of panelNames) {
    const panel = panels[name];
    code += `  ${name}: {\n`;
    code += `    name: '${panel.name}',\n`;
    code += `    file: '${panel.file}',\n`;
    code += `    title: '${panel.title}',\n`;
    code += `    description: '${panel.description}',\n`;
    code += `    icon: '${panel.icon}',\n`;
    code += `    category: '${panel.category}',\n`;
    code += `    singletonContainerId: '${panel.singletonContainerId}',\n`;
    code += `    position: ${JSON.stringify(panel.position)},\n`;
    code += `    multiPosition: ${JSON.stringify(panel.multiPosition)},\n`;
    code += `    multiIcon: '${panel.multiIcon}',\n`;
    code += `    multiCategory: '${panel.multiCategory}'\n`;
    code += `  }${name !== panelNames[panelNames.length - 1] ? ',' : ''}\n`;
  }

  code += '};';
  return code;
}

// 示例面板配置（包含单例和多实例的完整配置）
// 所有继承 FunctionPanelUIBase 的组件都在这里配置
// 使用 'node panel-config.js load-example-panels' 命令更新此常量
const EXAMPLE_PANELS = {
  DualCanvasViewer: {
    name: 'DualCanvasViewer',
    file: 'test-sfc/sfcLib/dist/dual-canvas-viewer-sfc/lib/dual-canvas-viewer.mjs',
    title: 'mjs双画布查看器',
    description: 'mjs双画布查看器（单实例）',
    icon: '🧬',
    category: 'tools',
    singletonContainerId: 'dualCanvasContainer',
    lazyLoad: true,
    position: { initialX: 'center', initialY: 100 },
    multiPosition: { initialX: 'center', initialY: 100 },
    multiIcon: '🧬',
    multiCategory: 'tools'
  },
  MultiContentExample: {
    name: 'MultiContentExample',
    file: 'examples/MultiContentExample.vue',
    title: '多内容切换示例',
    description: 'TestPanelModule 动态切换内容示例',
    icon: '🔄',
    category: 'test',
    singletonContainerId: 'contentExample',
    lazyLoad: true,
    position: { initialX: 'right', initialY: 280 },
    multiPosition: { initialX: 'center', initialY: 360 },
    multiIcon: '🔀',
    multiCategory: 'test'
  },
  ObliqueHeightAdjustPanel: {
    name: 'ObliqueHeightAdjustPanel',
    file: 'ObliqueHeightAdjustPanel.vue',
    title: '高度调整面板',
    description: '倾斜摄影高度偏移调整面板',
    icon: '📏',
    category: 'tools',
    singletonContainerId: 'obliqueHeightAdjustPanel',
    lazyLoad: true,
    position: { initialX: 'right', initialY: 100 },
    multiPosition: { initialX: 'right', initialY: 180 },
    multiIcon: '📐',
    multiCategory: 'tools'
  },
  ObliquePhotographyPanel: {
    name: 'ObliquePhotographyPanel',
    file: 'ObliquePhotographyPanel.vue',
    title: '倾斜摄影面板',
    description: '倾斜摄影模型加载和管理面板',
    icon: '📷',
    category: 'tools',
    singletonContainerId: 'obliquePhotographyPanel',
    lazyLoad: true,
    position: { initialX: 'center', initialY: 120 },
    multiPosition: { initialX: 'center', initialY: 200 },
    multiIcon: '📷',
    multiCategory: 'tools'
  },
  ObliquePhotographyPanelExample: {
    name: 'ObliquePhotographyPanelExample',
    file: 'ObliquePhotographyPanelExample.vue',
    title: '测试面板',
    description: '测试 JsonConfigPanelBase',
    icon: '🧪',
    category: 'test',
    singletonContainerId: 'obliquePhotographyPanelExample',
    lazyLoad: true,
    position: { initialX: 'left', initialY: 150 },
    multiPosition: { initialX: 'left', initialY: 150 },
    multiIcon: '🧪',
    multiCategory: 'test'
  },
  SetContentExample: {
    name: 'SetContentExample',
    file: 'examples/SetContentExample.vue',
    title: 'SetContent 示例',
    description: 'TestPanelModule setContent 方法使用示例',
    icon: '📦',
    category: 'test',
    singletonContainerId: 'setContentExample',
    lazyLoad: true,
    position: { initialX: 'right', initialY: 200 },
    multiPosition: { initialX: 'center', initialY: 150 },
    multiIcon: '🧬',
    multiCategory: 'test'
  },
  SlotExample: {
    name: 'SlotExample',
    file: 'examples/SlotExample.vue',
    title: '插槽示例',
    description: 'TestPanelModule 插槽使用示例',
    icon: '🎨',
    category: 'test',
    singletonContainerId: 'slotExample',
    lazyLoad: true,
    position: { initialX: 'right', initialY: 360 },
    multiPosition: { initialX: 'center', initialY: 200 },
    multiIcon: '🧬',
    multiCategory: 'test'
  },
  TestPanel: {
    name: 'TestPanel',
    file: 'TestPanel.vue',
    title: 'TestPanel',
    description: 'TestPanel',
    icon: '🧪',
    category: 'test',
    singletonContainerId: 'testPanel',
    lazyLoad: true,
    position: { initialX: 'left', initialY: 100 },
    multiPosition: { initialX: 'left', initialY: 100 },
    multiIcon: '🧪',
    multiCategory: 'test'
  },
  TestPanelModule: {
    name: 'TestPanelModule',
    file: 'TestPanelModule.vue',
    title: '面板模板',
    description: '可复用的面板模板',
    icon: '📦',
    category: 'test',
    singletonContainerId: 'testPanelModule',
    lazyLoad: true,
    position: { initialX: 'left', initialY: 140 },
    multiPosition: { initialX: 'left', initialY: 220 },
    multiIcon: '📋',
    multiCategory: 'test'
  }
};

/**
 * 读取配置文件
 */
function readConfig() {
  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('读取配置文件失败:', error.message);
    process.exit(1);
  }
}

/**
 * 写入配置文件
 */
function writeConfig(config) {
  try {
    // 更新时间戳
    config.lastUpdated = new Date().toISOString().split('T')[0];
    const content = JSON.stringify(config, null, 2);
    fs.writeFileSync(CONFIG_FILE, content, 'utf8');
    console.log('✅ 配置文件已更新');
  } catch (error) {
    console.error('写入配置文件失败:', error.message);
    process.exit(1);
  }
}

/**
 * 检查面板是否已存在
 */
function panelExists(config, name) {
  return config.panels.some(p => p.name === name);
}

/**
 * 添加单例面板配置
 */
function addSingletonPanel(config, panelConfig) {
  const { name, file, title, description, icon, category, singletonContainerId, position } = panelConfig;

  if (panelExists(config, name)) {
    console.warn(`⚠️  面板 ${name} 已存在，将更新配置`);
  }

  const panel = {
    name,
    file,
    title,
    description,
    enabled: true,
    visible: false,
    icon,
    category,
    singleton: true,
    singletonContainerId: singletonContainerId || name,
    lazyLoad: true,
    permissions: [],
    position: position || { initialX: 'center', initialY: 120 }
  };

  // 移除旧配置（如果存在）
  config.panels = config.panels.filter(p => p.name !== name);
  // 添加新配置
  config.panels.push(panel);

  // 确保分类存在
  if (!config.categories[category]) {
    config.categories[category] = {
      name: category,
      description: `${category} 类面板`,
      icon: '📁'
    };
  }

  console.log(`✅ 已添加单例面板配置: ${name}`);
}

/**
 * 添加多实例面板配置
 */
function addMultiInstancePanel(config, panelConfig) {
  const { name, file, title, description, singletonContainerId, multiIcon, multiPosition, multiCategory } = panelConfig;
  const multiInstanceName = `${name}Multi`;

  if (panelExists(config, multiInstanceName)) {
    console.warn(`⚠️  多实例面板 ${multiInstanceName} 已存在，将更新配置`);
  }

  const panel = {
    name: multiInstanceName,
    file,
    title: `${title}（多实例）`,
    description: `${description}（多实例）`,
    enabled: true,
    visible: false,
    // 优先使用配置中的多实例图标，否则使用默认图标
    icon: multiIcon || '🧬',
    // 优先使用配置中的多实例分类，否则使用单例的分类
    category: multiCategory || panelConfig.category,
    singleton: false,
    singletonContainerId: singletonContainerId || name,
    lazyLoad: true,
    permissions: [],
    // 优先使用配置中的多实例位置，否则使用默认位置
    position: multiPosition || { initialX: 'center', initialY: 200 }
  };

  // 移除旧配置（如果存在）
  config.panels = config.panels.filter(p => p.name !== multiInstanceName);
  // 添加新配置
  config.panels.push(panel);

  // 确保分类存在
  const category = panel.category;
  if (!config.categories[category]) {
    config.categories[category] = {
      name: category,
      description: `${category} 类面板`,
      icon: '📁'
    };
  }

  console.log(`✅ 已添加多实例面板配置: ${multiInstanceName}`);
}

/**
 * 删除面板配置
 */
function removePanel(config, name) {
  const initialLength = config.panels.length;
  config.panels = config.panels.filter(p => p.name !== name);

  if (config.panels.length < initialLength) {
    console.log(`✅ 已删除面板配置: ${name}`);
  } else {
    console.warn(`⚠️  未找到面板配置: ${name}`);
  }
}

/**
 * 列出所有面板
 */
function listPanels(config) {
  console.log('\n📋 当前面板配置：\n');
  console.table(config.panels.map(p => ({
    名称: p.name,
    标题: p.title,
    单例: p.singleton ? '是' : '否',
    启用: p.enabled ? '是' : '否',
    分类: p.category
  })));
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
📦 面板配置管理工具

用法：
  node panel-config.js <command> [options]

命令：
  add <name>              添加指定面板的单例和多实例配置
  add-all                 添加所有示例面板配置
  remove <name>           删除指定面板配置
  remove-all              删除所有示例面板配置
  list                    列出所有面板配置
  export                  导出配置文件（打印到控制台）
  validate                验证配置文件格式是否符合元数据规范
  load-example-panels     从 functionPanels.config.json 更新 EXAMPLE_PANELS 硬编码值

示例：
  node panel-config.js add SetContentExample
  node panel-config.js add-all
  node panel-config.js list
  node panel-config.js remove SetContentExample
  node panel-config.js export
  node panel-config.js validate
  node panel-config.js load-example-panels

可用的面板名称：
  核心功能面板:
  - ObliquePhotographyPanel (倾斜摄影面板)
  - ObliqueHeightAdjustPanel (高度调整面板)

  测试面板:
  - TestPanel (测试面板)
  - TestPanelModule (面板模板)

  示例面板:
  - SetContentExample (SetContent 示例)
  - MultiContentExample (多内容切换示例)
  - SlotExample (插槽示例)
`);
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  // 读取当前配置
  const config = readConfig();

  switch (command) {
    case 'add': {
      const panelName = args[1];
      if (!panelName) {
        console.error('❌ 请指定面板名称');
        showHelp();
        process.exit(1);
      }

      const panelConfig = EXAMPLE_PANELS[panelName];
      if (!panelConfig) {
        console.error(`❌ 未找到面板配置: ${panelName}`);
        console.log('可用的面板名称:', Object.keys(EXAMPLE_PANELS).join(', '));
        process.exit(1);
      }

      addSingletonPanel(config, panelConfig);
      addMultiInstancePanel(config, panelConfig);
      writeConfig(config);
      break;
    }

    case 'add-all': {
      console.log('🔄 批量添加所有示例面板配置...');
      Object.values(EXAMPLE_PANELS).forEach(panelConfig => {
        addSingletonPanel(config, panelConfig);
        addMultiInstancePanel(config, panelConfig);
      });
      writeConfig(config);
      console.log('✅ 已完成批量添加');
      break;
    }

    case 'remove': {
      const panelName = args[1];
      if (!panelName) {
        console.error('❌ 请指定面板名称');
        showHelp();
        process.exit(1);
      }

      removePanel(config, panelName);
      // 同时删除多实例版本
      removePanel(config, `${panelName}Multi`);
      writeConfig(config);
      break;
    }

    case 'remove-all': {
      console.log('🔄 批量删除所有示例面板配置...');
      Object.keys(EXAMPLE_PANELS).forEach(name => {
        removePanel(config, name);
        removePanel(config, `${name}Multi`);
      });
      writeConfig(config);
      console.log('✅ 已完成批量删除');
      break;
    }

    case 'list': {
      listPanels(config);
      break;
    }

    case 'export': {
      console.log('\n📄 配置文件内容：\n');
      console.log(JSON.stringify(config, null, 2));
      console.log(`\n文件路径: ${CONFIG_FILE}`);
      break;
    }

    case 'validate': {
      console.log('🔍 验证配置文件格式...');
      const validation = validateAllPanels(config);

      console.log(`\n📊 验证结果：`);
      console.log(`✅ 有效面板: ${validation.results.filter(r => r.valid).length}/${validation.results.length}`);
      console.log(`❌ 错误总数: ${validation.totalErrors}`);
      console.log(`⚠️  警告总数: ${validation.totalWarnings}`);

      // 显示详细错误和警告
      if (validation.totalErrors > 0 || validation.totalWarnings > 0) {
        console.log('\n📋 详细信息：');
        validation.results.forEach(result => {
          if (result.errors.length > 0 || result.warnings.length > 0) {
            console.log(`\n面板: ${result.name}`);
            if (result.errors.length > 0) {
              console.log('  错误:');
              result.errors.forEach(err => console.log(`    ❌ ${err}`));
            }
            if (result.warnings.length > 0) {
              console.log('  警告:');
              result.warnings.forEach(warn => console.log(`    ⚠️  ${warn}`));
            }
          }
        });
      }

      if (validation.valid) {
        console.log('\n✅ 配置文件验证通过！');
      } else {
        console.log('\n❌ 配置文件验证失败，请修复上述错误。');
        process.exit(1);
      }
      break;
    }

    case 'load-example-panels': {
      console.log('🔄 从 functionPanels.config.json 更新 EXAMPLE_PANELS...');
      const newCode = generateExamplePanelsString();

      // 读取当前文件内容
      const currentFilePath = __filename;
      let currentContent = fs.readFileSync(currentFilePath, 'utf8');

      // 使用正则表达式匹配并替换 EXAMPLE_PANELS 定义
      // 匹配从 "// 示例面板配置" 到 "};\n" 的整个 EXAMPLE_PANELS 定义
      const examplePanelsRegex = /\/\/ 示例面板配置[\s\S]*?const EXAMPLE_PANELS = \{[\s\S]*?^};/;
      currentContent = currentContent.replace(examplePanelsRegex, newCode);

      // 写回文件
      fs.writeFileSync(currentFilePath, currentContent, 'utf8');
      console.log('✅ EXAMPLE_PANELS 已更新');
      console.log(`📊 共加载 ${Object.keys(generateExamplePanelsCode()).length} 个面板配置`);
      break;
    }

    default:
      console.error(`❌ 未知命令: ${command}`);
      showHelp();
      process.exit(1);
  }
}

// 执行主函数
main().catch(error => {
  console.error('执行失败:', error);
  process.exit(1);
});
