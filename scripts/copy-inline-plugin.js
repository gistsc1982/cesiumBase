/**
 * cesiumBase 内联插件复制脚本
 *
 * 功能：
 * - 从 sfcLib/dist/ 复制内联插件文件
 * - 自动将内联插件复制到 public 目录
 * - 验证文件完整性
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  // 内联插件源文件
  sourceFile: path.resolve(__dirname, '../../sfcLib/dist/dual-canvas-viewer-inline.js'),
  // 目标目录（cesiumBase public 目录）
  targetDir: path.resolve(__dirname, '../public/plugins'),
  // 目标文件名
  targetFile: 'dual-canvas-viewer-inline.js'
};

// 颜色输出
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

/**
 * 检查源文件是否存在
 */
function checkSourceFile() {
  if (!fs.existsSync(CONFIG.sourceFile)) {
    log(`✗ 内联插件文件不存在: ${CONFIG.sourceFile}`, 'red');
    log(`请先在 sfcLib 项目中运行: npm run build:inline`, 'yellow');
    return false;
  }

  // 检查文件大小
  const stats = fs.statSync(CONFIG.sourceFile);
  const sizeKB = (stats.size / 1024).toFixed(2);

  if (stats.size < 1000) {
    log(`⚠ 警告: 内联插件文件太小 (${sizeKB} KB)，可能打包不完整`, 'yellow');
    return false;
  }

  log(`✓ 源文件存在 (${sizeKB} KB)`, 'green');
  return true;
}

/**
 * 创建目标目录
 */
function ensureTargetDir() {
  if (!fs.existsSync(CONFIG.targetDir)) {
    fs.mkdirSync(CONFIG.targetDir, { recursive: true });
    log(`✓ 创建目标目录: ${CONFIG.targetDir}`, 'blue');
  }
}

/**
 * 复制内联插件文件
 */
function copyInlinePlugin() {
  log('=== cesiumBase 内联插件复制 ===\n', 'cyan');

  // 检查源文件
  if (!checkSourceFile()) {
    process.exit(1);
  }

  // 确保目标目录存在
  ensureTargetDir();

  // 目标文件路径
  const targetPath = path.join(CONFIG.targetDir, CONFIG.targetFile);

  // 复制文件
  fs.copyFileSync(CONFIG.sourceFile, targetPath);

  const stats = fs.statSync(targetPath);
  const sizeKB = (stats.size / 1024).toFixed(2);

  log(`✓ 复制完成`, 'green');
  log(`  源文件: ${CONFIG.sourceFile}`, 'blue');
  log(`  目标文件: ${targetPath}`, 'blue');
  log(`  文件大小: ${sizeKB} KB`, 'blue');
  log();
  log('使用方式:', 'yellow');
  log('  在 HTML 中添加:', 'yellow');
  log(`  <script src="/plugins/${CONFIG.targetFile}"></script>`, 'blue');
  log('  然后调用:', 'yellow');
  log('  window.DualCanvasViewerInline.loadDualCanvasViewerInline(vue3SfcLoader, Vue)', 'blue');
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  const watchMode = args.includes('--watch') || args.includes('-w');

  if (watchMode) {
    log('Watch 模式暂未实现', 'yellow');
    log('请使用: npm run build:inline (在 sfcLib)', 'yellow');
    log('然后运行: npm run copy:inline (在 cesiumBase)', 'yellow');
  } else {
    copyInlinePlugin();
  }
}

// 运行
main();
