/**
 * 将编译后的所有 SFC .mjs 组件从 cesiumBase 复制到 test 项目
 *
 * 使用方式：
 *   node scripts/copy-to-test.js
 *   npm run copy:test
 *
 * 注意：必须使用 npm run build:test-sfc-all 全量编译后再复制，
 * 单独编译个别文件会导致内部变量名不一致。
 */
const fs = require('fs');
const path = require('path');

// 组件文件 → 目标子目录映射（相对于 test/src/components/）
const COPY_MAP = {
  // test/src/components/lib/
  'lib': [
    'FunctionPanelUIBase.mjs',
    'JsonConfigPanelBase.mjs',
    'TestSfc.mjs',
    'CesiumToolbar.mjs'
  ],
  // test/src/components/functions/lib/
  'functions/lib': [
    'ObliqueHeightAdjustPanel.mjs',
    'ObliquePhotographyPanel.mjs',
    'ObliquePhotographyPanelExample.mjs',
    'TestPanel.mjs',
    'TestPanelModule.mjs'
  ]
};

const SOURCE_DIR = path.resolve(__dirname, '../public/test-sfc');
const TEST_BASE = path.resolve(__dirname, '../../test/src/components');

console.log('=== 复制编译组件到 test 项目 ===\n');
console.log(`源目录: ${SOURCE_DIR}\n`);

if (!fs.existsSync(SOURCE_DIR)) {
  console.error(`❌ 源目录不存在: ${SOURCE_DIR}`);
  console.error('请先运行: npm run build:test-sfc-all');
  process.exit(1);
}

let totalCopied = 0;
let totalSkipped = 0;

for (const [subDir, files] of Object.entries(COPY_MAP)) {
  const targetDir = path.join(TEST_BASE, subDir);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  console.log(`📁 ${subDir}/`);
  files.forEach(file => {
    const src = path.join(SOURCE_DIR, file);
    const dest = path.join(targetDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      const size = (fs.statSync(dest).size / 1024).toFixed(1);
      console.log(`  ✅ ${file} (${size} KB)`);
      totalCopied++;
    } else {
      console.log(`  ⚠️ ${file} — 未编译，跳过`);
      totalSkipped++;
    }
    // 同时复制对应的 .mjs.css 文件（scope ID 需与 .mjs 匹配）
    const cssSrc = path.join(SOURCE_DIR, file + '.css');
    const cssDest = path.join(targetDir, file + '.css');
    if (fs.existsSync(cssSrc)) {
      fs.copyFileSync(cssSrc, cssDest);
      totalCopied++;
    }
  });
}

console.log(`\n✅ 复制完成: ${totalCopied} 个文件`);
if (totalSkipped > 0) {
  console.log(`⚠️ 跳过 ${totalSkipped} 个未编译文件`);
}
