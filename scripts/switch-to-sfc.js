/**
 * cesiumBase HTML 入口文件切换脚本
 *
 * 功能：
 * - 在 SFC 模式和 IIFE 模式之间切换
 * - 自动备份当前版本
 * - 提供恢复功能
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  publicDir: path.resolve(__dirname, '../public'),
  files: {
    // 当前使用的入口文件
    index: 'index.html',
    // SFC 模式模板文件
    sfcTemplate: 'index-sfc.html',
    // IIFE 模式备份文件名
    iifeBackup: 'index-iife-backup.html',
    // SFC 模式备份文件名
    sfcBackup: 'index-sfc-backup.html'
  }
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
 * 检查文件是否存在
 */
function fileExists(filename) {
  const filePath = path.join(CONFIG.publicDir, filename);
  return fs.existsSync(filePath);
}

/**
 * 切换到 SFC 模式
 */
function switchToSFC() {
  log('=== 切换到 SFC 模式 ===\n', 'cyan');

  // 1. 备份当前的 index.html 为 IIFE 版本
  if (fileExists(CONFIG.files.index)) {
    const indexPath = path.join(CONFIG.publicDir, CONFIG.files.index);
    const backupPath = path.join(CONFIG.publicDir, CONFIG.files.iifeBackup);

    if (fileExists(CONFIG.files.iifeBackup)) {
      fs.unlinkSync(backupPath);
      log('✓ 删除旧的 IIFE 备份', 'blue');
    }

    fs.renameSync(indexPath, backupPath);
    log(`✓ 已备份 index.html → ${CONFIG.files.iifeBackup}`, 'green');
  }

  // 2. 将 index-sfc.html 复制为 index.html
  if (fileExists(CONFIG.files.sfcTemplate)) {
    const sfcPath = path.join(CONFIG.publicDir, CONFIG.files.sfcTemplate);
    const indexPath = path.join(CONFIG.publicDir, CONFIG.files.index);

    fs.copyFileSync(sfcPath, indexPath);
    log(`✓ 已复制 ${CONFIG.files.sfcTemplate} → index.html`, 'green');
  } else {
    log(`✗ SFC 模板文件不存在: ${CONFIG.files.sfcTemplate}`, 'red');
    return false;
  }

  log('\n✓ 切换完成！当前使用 SFC 模式', 'green');
  log('运行 npm run serve 启动开发服务器', 'yellow');
  return true;
}

/**
 * 切换回 IIFE 模式
 */
function switchToIIFE() {
  log('=== 切换回 IIFE 模式 ===\n', 'cyan');

  // 1. 检查是否有 IIFE 备份
  if (!fileExists(CONFIG.files.iifeBackup)) {
    log(`✗ IIFE 备份文件不存在: ${CONFIG.files.iifeBackup}`, 'red');
    log('可能从未切换过，或备份已被删除', 'yellow');
    return false;
  }

  // 2. 备份当前的 index.html (SFC 版本)
  if (fileExists(CONFIG.files.index)) {
    const indexPath = path.join(CONFIG.publicDir, CONFIG.files.index);
    const sfcBackupPath = path.join(CONFIG.publicDir, CONFIG.files.sfcBackup);

    if (fileExists(CONFIG.files.sfcBackup)) {
      fs.unlinkSync(sfcBackupPath);
    }

    fs.renameSync(indexPath, sfcBackupPath);
    log(`✓ 已备份 index.html → ${CONFIG.files.sfcBackup}`, 'green');
  }

  // 3. 恢复 IIFE 备份为 index.html
  const backupPath = path.join(CONFIG.publicDir, CONFIG.files.iifeBackup);
  const indexPath = path.join(CONFIG.publicDir, CONFIG.files.index);

  fs.copyFileSync(backupPath, indexPath);
  log(`✓ 已恢复 ${CONFIG.files.iifeBackup} → index.html`, 'green');

  log('\n✓ 切换完成！当前使用 IIFE 模式', 'green');
  log('运行 npm run serve 启动开发服务器', 'yellow');
  return true;
}

/**
 * 显示当前状态
 */
function showStatus() {
  log('=== 当前模式状态 ===\n', 'cyan');

  const publicDir = CONFIG.publicDir;

  // 检查当前 index.html 的内容来判断模式
  if (fileExists(CONFIG.files.index)) {
    const indexPath = path.join(publicDir, CONFIG.files.index);
    const content = fs.readFileSync(indexPath, 'utf-8');

    const isSFC = content.includes('sfc-plugin/') || content.includes('index-sfc');
    const isIIFE = content.includes('sfc-runtime/') || content.includes('/bundle/');

    if (isSFC) {
      log('当前模式: SFC (sfc-plugin/)', 'green');
    } else if (isIIFE) {
      log('当前模式: IIFE (sfc-runtime/)', 'blue');
    } else {
      log('当前模式: 未知', 'yellow');
    }
  }

  // 检查备份文件
  log('\n备份文件状态:', 'blue');
  log(`  IIFE 备份 (${CONFIG.files.iifeBackup}): ${fileExists(CONFIG.files.iifeBackup) ? '存在' : '不存在'}`, fileExists(CONFIG.files.iifeBackup) ? 'green' : 'yellow');
  log(`  SFC 备份 (${CONFIG.files.sfcBackup}): ${fileExists(CONFIG.files.sfcBackup) ? '存在' : '不存在'}`, fileExists(CONFIG.files.sfcBackup) ? 'green' : 'yellow');
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'sfc';

  switch (mode) {
    case 'sfc':
      switchToSFC();
      break;
    case 'iife':
      switchToIIFE();
      break;
    case 'status':
      showStatus();
      break;
    default:
      log('用法:', 'yellow');
      log('  node scripts/switch-to-sfc.js sfc    - 切换到 SFC 模式', 'blue');
      log('  node scripts/switch-to-sfc.js iife   - 切换回 IIFE 模式', 'blue');
      log('  node scripts/switch-to-sfc.js status - 查看当前状态', 'blue');
  }
}

// 运行
main();
