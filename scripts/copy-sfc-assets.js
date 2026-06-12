/**
 * cesiumBase SFC 资源复制脚本
 *
 * 功能：
 * - 从 sfcLib/dist/dual-canvas-viewer-sfc/ 复制编译后的文件
 * - 支持开发和生产环境
 * - 可以作为 npm script 使用
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  // SFC 源目录（sfcLib 编译输出）
  sourceDir: path.resolve(__dirname, '../../sfcLib/dist/dual-canvas-viewer-sfc'),
  // 目标目录（cesiumBase public/test-sfc 目录）
  targetDir: path.resolve(__dirname, '../public/test-sfc/sfcLib/dist/dual-canvas-viewer-sfc'),
  // 需要复制的子目录
  subdirs: ['components', 'utils', 'runtime', 'lib']
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * 递归复制目录
 */
function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    log(`  ⚠ 源目录不存在: ${src}`, 'yellow');
    return 0;
  }

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  let fileCount = 0;
  const files = fs.readdirSync(src);

  files.forEach(file => {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      fileCount += copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      fileCount++;
    }
  });

  return fileCount;
}

/**
 * 检查 SFC 源目录是否存在
 */
function checkSourceDir() {
  if (!fs.existsSync(CONFIG.sourceDir)) {
    log(`✗ SFC 源目录不存在: ${CONFIG.sourceDir}`, 'red');
    log(`请先在 sfcLib 项目中运行: npm run build:sfc`, 'yellow');
    return false;
  }
  return true;
}

/**
 * 清理目标目录
 */
function cleanTargetDir() {
  if (fs.existsSync(CONFIG.targetDir)) {
    fs.rmSync(CONFIG.targetDir, { recursive: true, force: true });
    log('✓ 已清理目标目录', 'blue');
  }
  fs.mkdirSync(CONFIG.targetDir, { recursive: true });
}

/**
 * 复制 SFC 资源
 */
function copySFCAssets() {
  log('=== cesiumBase SFC 资源复制 ===\n', 'blue');

  // 检查源目录
  if (!checkSourceDir()) {
    process.exit(1);
  }

  // 清理并创建目标目录
  cleanTargetDir();

  let totalFiles = 0;

  // 复制子目录
  CONFIG.subdirs.forEach(subdir => {
    const srcPath = path.join(CONFIG.sourceDir, subdir);
    const destPath = path.join(CONFIG.targetDir, subdir);

    log(`复制 ${subdir}/...`, 'blue');
    const count = copyRecursive(srcPath, destPath);
    totalFiles += count;

    if (count > 0) {
      log(`  ✓ ${subdir}/ (${count} 个文件)`, 'green');
    }
  });

  log(`\n✓ 复制完成，共 ${totalFiles} 个文件`, 'green');
  log(`源目录: ${CONFIG.sourceDir}`, 'blue');
  log(`目标目录: ${CONFIG.targetDir}`, 'blue');
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  const watchMode = args.includes('--watch') || args.includes('-w');

  if (watchMode) {
    log('Watch 模式暂未实现', 'yellow');
    log('请使用: npm run build:sfc (在 sfcLib)', 'yellow');
    log('然后运行: npm run copy:sfc (在 cesiumBase)', 'yellow');
  } else {
    copySFCAssets();
  }
}

// 运行
main();
