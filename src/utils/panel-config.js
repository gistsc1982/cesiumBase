#!/usr/bin/env node

/**
 * 面板配置管理命令行工具
 *
 * 使用方法：
 *   node scripts/panel-config.js add SetContentExample
 *   node scripts/panel-config.js add-all
 *   node scripts/panel-config.js list
 *   node scripts/panel-config.js export
 */

const fs = require('fs');
const path = require('path');

// 配置文件路径（从 src/utils 向上两级到 src/components/functions）
const CONFIG_FILE = path.join(__dirname, '../components/functions/functionPanels.config.json');

// 示例面板配置（包含单例和多实例的完整配置）
const EXAMPLE_PANELS = {
  SetContentExample: {
    name: 'SetContentExample',
    file: 'examples/SetContentExample.vue',
    title: '双画布查看器',
    description: 'DualCanvasViewerPlugin 单例加载',
    icon: '🖥️',
    category: 'tools',
    // 单例面板位置
    position: { initialX: 'right', initialY: 0 },
    // 多实例面板位置
    multiPosition: { initialX: 'center', initialY: 280 },
    // 多实例面板图标
    multiIcon: '🧬',
    // 多实例面板分类
    multiCategory: 'test'
  },
  MultiContentExample: {
    name: 'MultiContentExample',
    file: 'examples/MultiContentExample.vue',
    title: '多内容切换示例',
    description: 'TestPanelModule 动态切换内容示例',
    icon: '🔄',
    category: 'test',
    // 单例面板位置
    position: { initialX: 'right', initialY: 280 },
    // 多实例面板位置
    multiPosition: { initialX: 'center', initialY: 360 },
    // 多实例面板图标
    multiIcon: '🔀',
    // 多实例面板分类（默认与单例相同）
    multiCategory: 'test'
  },
  SlotExample: {
    name: 'SlotExample',
    file: 'examples/SlotExample.vue',
    title: '插槽示例',
    description: 'TestPanelModule 插槽使用示例',
    icon: '🎨',
    category: 'test',
    // 单例面板位置
    position: { initialX: 'right', initialY: 360 },
    // 多实例面板位置
    multiPosition: { initialX: 'center', initialY: 440 },
    // 多实例面板图标
    multiIcon: '🖼️',
    // 多实例面板分类（默认与单例相同）
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
  const { name, file, title, description, icon, category, position } = panelConfig;

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
  const { name, file, title, description, multiIcon, multiPosition, multiCategory } = panelConfig;
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

示例：
  node panel-config.js add SetContentExample
  node panel-config.js add-all
  node panel-config.js list
  node panel-config.js remove SetContentExample
  node panel-config.js export

可用的面板名称：
  - SetContentExample
  - MultiContentExample
  - SlotExample
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
