/**
 * 批量构建 SFC 组件脚本（仅构建继承 SfcBase 的组件）
 *
 * 功能：
 * - 自动发现继承 SfcBase 的子类组件
 * - 为每个组件生成 .mjs 和 .umd.js 文件
 * - 统一输出到 public/test-sfc 目录
 * - 不构建不继承 SfcBase 的组件
 *
 * 使用方式：
 * node scripts/build-sfc-components.js
 * node scripts/build-sfc-components.js --discover
 */

const { build } = require('vite');
const vue = require('@vitejs/plugin-vue');
const path = require('path');
const fs = require('fs');

// ==================== 配置 ====================

const CONFIG = {
  // 项目根目录
  rootDir: path.resolve(__dirname, '..'),
  // 源目录
  srcDir: 'src/components',
  // 输出目录
  outDir: 'public/test-sfc',
  // 基础类名称
  baseComponent: 'SfcBase'
};

// ==================== 颜色输出 ====================

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// ==================== 检测函数 ====================

/**
 * 检查组件是否继承 SfcBase（直接或间接）
 * @param {string} filePath - 组件文件路径
 * @returns {boolean} 是否继承 SfcBase
 */
function checkExtendsSfcBase(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // 检查是否直接导入 SfcBase
    const hasSfcBaseImport = /import\s+SfcBase\s+from\s+['"]\.\/SfcBase\.vue['"]/.test(content);

    // 检查是否使用 extends SfcBase
    const hasExtendsSfcBase = /extends:\s*SfcBase/.test(content);

    // 检查是否使用 mixins 包含 SfcBase
    const hasSfcBaseMixin = /mixins:\s*\[[\s*\{[^}]*SfcBase/.test(content);

    // 检查是否使用 FunctionPanelUIBase（间接继承 SfcBase）
    const hasFunctionPanelUIBase = /import\s+FunctionPanelUIBase/.test(content) ||
                                   /FunctionPanelUIBase.*mixins:.*SfcBase/s.test(content) ||
                                   /mixins:\s*\[[\s*\{[^}]*FunctionPanelUIBase/.test(content);

    // 检查是否使用 JsonConfigPanelBase（间接继承 FunctionPanelUIBase → SfcBase）
    const hasJsonConfigPanelBase = /import\s+JsonConfigPanelBase/.test(content);

    // 检查是否使用其他可能继承 SfcBase 的基础组件
    const hasOtherBaseComponent = /import.*from.*\/(SfcBase|CesiumBase|functionPanelUIBase|JsonConfigPanelBase)\.vue/.test(content);

    // 支持直接继承和间接继承：
    // 1. 直接继承：导入 SfcBase 并通过 extends/mixins 使用
    // 2. 间接继承：使用 FunctionPanelUIBase / JsonConfigPanelBase 或其他中间基类
    return (hasSfcBaseImport && (hasExtendsSfcBase || hasSfcBaseMixin)) ||
           hasFunctionPanelUIBase ||
           hasJsonConfigPanelBase ||
           (hasOtherBaseComponent && !hasSfcBaseImport);
  } catch (error) {
    log(`   ⚠️ 无法读取文件 ${filePath}: ${error.message}`, 'yellow');
    return false;
  }
}

/**
 * 递归扫描目录下所有 .vue 文件
 * @param {string} dir - 要扫描的目录
 * @param {Array} results - 收集结果的数组
 */
function scanDirectoryRecursively(dir, results = []) {
  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // 递归扫描子目录
      scanDirectoryRecursively(fullPath, results);
    } else if (entry.isFile() && entry.name.endsWith('.vue') && entry.name !== 'SfcBase.vue') {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * 扫描 src/components 目录（包括子目录）下所有继承 SfcBase 的组件
 * @returns {Array} 发现的组件列表
 */
function discoverSfcComponents() {
  const componentsDir = path.resolve(CONFIG.rootDir, CONFIG.srcDir);

  if (!fs.existsSync(componentsDir)) {
    log(`⚠️ 组件目录不存在: ${componentsDir}`, 'yellow');
    return [];
  }

  log('🔍 递归扫描组件目录...', 'yellow');

  // 递归扫描所有 .vue 文件
  const vueFiles = scanDirectoryRecursively(componentsDir);

  const discovered = [];

  for (const filePath of vueFiles) {
    // 计算相对于 src/components 的路径
    const relativePath = path.relative(path.resolve(CONFIG.rootDir, CONFIG.srcDir), filePath);
    const componentName = path.basename(filePath, '.vue');
    const subDir = path.dirname(relativePath).replace(/\\/g, '/'); // Windows 路径处理

    // 检查是否继承 SfcBase
    if (checkExtendsSfcBase(filePath)) {
      discovered.push({
        name: componentName,
        entry: relativePath.replace(/\\/g, '/'), // 统一使用 / 分隔符
        description: `继承 SfcBase 的组件: ${componentName} (${subDir || '根目录'})`
      });
      log(`   ✅ 发现 ${componentName} (${subDir || '根目录'})`, 'green');
    } else {
      const subDir = path.dirname(relativePath).replace(/\\/g, '/');
      log(`   ⊙ 跳过 ${componentName} (${subDir || '根目录'}, 未继承 SfcBase)`, 'yellow');
    }
  }

  return discovered;
}

// ==================== 构建函数 ====================

/**
 * 构建单个 SFC 组件
 * @param {Object} component - 组件配置
 * @returns {Promise<void>}
 */
async function buildComponent(component) {
  log(`\n📦 构建 ${component.name}...`, 'blue');
  log(`   入口: ${component.entry}`, 'cyan');

  const startTime = Date.now();

  try {
    await build({
      plugins: [vue()],
      root: CONFIG.rootDir,
      build: {
        outDir: path.resolve(CONFIG.rootDir, CONFIG.outDir),
        emptyOutDir: false, // 不清空输出目录
        lib: {
          entry: path.resolve(CONFIG.rootDir, CONFIG.srcDir, component.entry),
          name: component.name,
          fileName: (format) => `${component.name}.${format === 'es' ? 'mjs' : 'umd.js'}`,
          formats: ['es', 'umd']
        },
        rollupOptions: {
          external: ['vue', 'cesium', 'three', 'three/examples/jsm/controls/OrbitControls', 'three/examples/jsm/loaders/GLTFLoader', 'three/examples/jsm/loaders/DRACOLoader'],
          output: {
            globals: {
              vue: 'Vue',
              cesium: 'Cesium',
              three: 'THREE'
            }
          }
        },
        // 排除不需要的资源
        copyPublicDir: false,
        // 不生成 source map（减少文件数量）
        sourcemap: false
      },
      resolve: {
        alias: {
          'vue': path.resolve(CONFIG.rootDir, 'node_modules/vue')
        }
      },
      // 禁用某些优化以提高构建速度
      minify: false
    });

    // 保存 CSS 为 .mjs.css（匹配组件 scope ID）
    const cssFile = path.join(path.resolve(CONFIG.rootDir, CONFIG.outDir), 'cesiumBase.css');
    if (fs.existsSync(cssFile)) {
      const cssDest = path.join(path.resolve(CONFIG.rootDir, CONFIG.outDir), `${component.name}.mjs.css`);
      fs.copyFileSync(cssFile, cssDest);
      // 同步更新 cesiumBase/src/components/ 下的备份 CSS（保持 scope ID 一致）
      const backupDir = path.resolve(CONFIG.rootDir, CONFIG.srcDir);
      const backupDest = path.join(backupDir, `${component.name}.mjs.css`);
      fs.copyFileSync(cssFile, backupDest);
      log(`   🎨 CSS: ${component.name}.mjs.css (含 cesiumBase 备份)`, 'cyan');
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`   ✅ ${component.name} 构建成功 (${duration}s)`, 'green');
    return { success: true, component: component.name, duration };
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`   ❌ ${component.name} 构建失败: ${error.message}`, 'red');
    return { success: false, component: component.name, error: error.message };
  }
}

/**
 * 批量构建所有组件
 * @param {Array} components - 要构建的组件列表
 * @returns {Promise<Object>} 构建结果统计
 */
async function buildAllComponents(components) {
  if (components.length === 0) {
    log('\n⚠️ 未发现任何继承 SfcBase 的组件', 'yellow');
    log('提示: 请确保组件中使用 `extends: SfcBase` 或 `import SfcBase from \'./SfcBase.vue\'`', 'yellow');
    return { total: 0, success: 0, failed: 0, details: [] };
  }

  log('\n=== SFC 组件批量构建（仅继承 SfcBase 的组件） ===\n', 'blue');
  log(`待构建组件: ${components.map(c => c.name).join(', ')}`, 'cyan');

  const results = {
    total: components.length,
    success: 0,
    failed: 0,
    details: []
  };

  for (const component of components) {
    const result = await buildComponent(component);
    results.details.push(result);

    if (result.success) {
      results.success++;
    } else {
      results.failed++;
    }
  }

  return results;
}

/**
 * 生成组件列表文件
 * @param {Array} components - 组件列表
 */
function generateComponentsList(components) {
  if (components.length === 0) {
    log('\n⚠️ 没有组件可写入列表', 'yellow');
    return;
  }

  const listPath = path.resolve(CONFIG.rootDir, CONFIG.outDir, 'components.json');
  const listData = {
    generated: new Date().toISOString(),
    baseComponent: CONFIG.baseComponent,
    count: components.length,
    components: components.map(c => ({
      name: c.name,
      entry: c.entry,
      description: c.description,
      extends: CONFIG.baseComponent,
      files: [
        `${c.name}.mjs`,
        `${c.name}.umd.js`
      ]
    }))
  };

  fs.writeFileSync(listPath, JSON.stringify(listData, null, 2), 'utf-8');
  log(`\n📝 组件列表已生成: ${listPath}`, 'cyan');
}

/**
 * 生成使用示例文件
 * @param {Array} components - 组件列表
 */
function generateUsageExamples(components) {
  if (components.length === 0) {
    log('\n⚠️ 没有组件可生成示例', 'yellow');
    return;
  }

  const examplesPath = path.resolve(CONFIG.rootDir, CONFIG.outDir, 'usage-examples.md');

  let content = '# SFC 组件使用示例（继承 SfcBase）\n\n';
  content += `生成时间: ${new Date().toISOString()}\n`;
  content += `基础类: ${CONFIG.baseComponent}\n\n`;
  content += `## 组件列表\n\n`;

  for (const component of components) {
    content += `### ${component.name}\n\n`;
    content += `**描述**: ${component.description}\n\n`;
    content += `**继承**: ${CONFIG.baseComponent}\n\n`;
    content += `**文件**: \n`;
    content += `- ES Module: \`${component.name}.mjs\`\n`;
    content += `- UMD: \`${component.name}.umd.js\`\n\n`;

    content += `#### ES Module 使用示例\n\n`;
    content += `\`\`\`javascript\n`;
    content += `import ${component.name} from './${component.name}.mjs';\n\n`;
    content += `// 使用组件（已继承 SfcBase 的所有功能）\n`;
    content += `const app = Vue.createApp({\n`;
    content += `  components: {\n`;
    content += `    ${component.name}\n`;
    content += `  }\n`;
    content += `});\n`;
    content += `\`\`\`\n\n`;

    content += `#### UMD 使用示例\n\n`;
    content += `\`\`\`html\n`;
    content += `<script src="./vue.global.prod.js"></script>\n`;
    content += `<script src="./${component.name}.umd.js"></script>\n\n`;
    content += `<div id="app">\n`;
    content += `  <${component.name}></${component.name}>\n`;
    content += `</div>\n\n`;
    content += `<script>\n`;
    content += `  const { createApp } = Vue;\n`;
    content += `  const app = createApp({\n`;
    content += `    components: {\n`;
    content += `      ${component.name}: window.${component.name}\n`;
    content += `    }\n`;
    content += `  });\n`;
    content += `  app.mount('#app');\n`;
    content += `</script>\n`;
    content += `\`\`\`\n\n`;
    content += `---\n\n`;
  }

  fs.writeFileSync(examplesPath, content, 'utf-8');
  log(`📝 使用示例已生成: ${examplesPath}`, 'cyan');
}

// ==================== 主函数 ====================

async function main() {
  const args = process.argv.slice(2);

  // 解析命令行参数
  const discover = args.includes('--discover');

  let componentsToBuild = [];

  if (discover) {
    // 自动发现模式
    log('🔍 自动发现继承 SfcBase 的组件...', 'yellow');
    componentsToBuild = discoverSfcComponents();

    if (componentsToBuild.length === 0) {
      log('\n⚠️ 未发现任何继承 SfcBase 的组件', 'yellow');
      log('请确保组件中使用 `extends: SfcBase`', 'yellow');
      return;
    }

    log(`\n✅ 发现 ${componentsToBuild.length} 个继承 SfcBase 的组件:`, 'green');
    componentsToBuild.forEach(c => {
      log(`   - ${c.name}`, 'cyan');
    });
  } else {
    // 默认：自动发现
    componentsToBuild = discoverSfcComponents();

    if (componentsToBuild.length === 0) {
      log('\n⚠️ 未发现任何继承 SfcBase 的组件', 'yellow');
      log('提示: 使用 --discover 参数或确保组件继承 SfcBase', 'yellow');
      return;
    }
  }

  // 执行构建
  const results = await buildAllComponents(componentsToBuild);

  // 输出结果统计
  log('\n=== 构建结果统计 ===', 'blue');
  log(`总计: ${results.total}`, 'cyan');
  log(`成功: ${results.success}`, 'green');
  if (results.failed > 0) {
    log(`失败: ${results.failed}`, 'red');
    log('\n失败的组件:', 'red');
    results.details
      .filter(r => !r.success)
      .forEach(r => log(`   - ${r.component}: ${r.error}`, 'red'));
  }

  // 生成辅助文件
  if (results.success > 0) {
    const successfulComponents = results.details
      .filter(r => r.success)
      .map(r => componentsToBuild.find(c => c.name === r.component));

    generateComponentsList(successfulComponents);
    generateUsageExamples(successfulComponents);
  }

  // 输出文件位置
  log(`\n📁 输出目录: ${path.resolve(CONFIG.rootDir, CONFIG.outDir)}`, 'blue');

  // 返回退出码
  process.exit(results.failed > 0 ? 1 : 0);
}

// 错误处理
main().catch(error => {
  log(`\n❌ 构建过程出错: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
