/**
 * 批量构建 SFC — 使用 preserveModules 保持模块结构一致
 * 每次构建所有模块一起编译，共享代码只编译一次，变量名统一
 */
const { build } = require('vite');
const vue = require('@vitejs/plugin-vue');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.resolve(ROOT, 'src/components');
const OUT = path.resolve(ROOT, 'public/test-sfc');

const colors = { reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m', blue: '\x1b[34m', cyan: '\x1b[36m', yellow: '\x1b[33m' };
function log(msg, c = 'reset') { console.log(`${colors[c]}${msg}${colors.reset}`); }

// 收集所有入口组件
function discoverEntries() {
  const entries = {};
  const scanDir = (dir, prefix = '') => {
    for (const f of fs.readdirSync(dir)) {
      const fp = path.join(dir, f);
      const stat = fs.statSync(fp);
      if (stat.isDirectory()) {
        scanDir(fp, prefix ? `${prefix}/${f}` : f);
      } else if (f.endsWith('.vue') && f !== 'SfcBase.vue') {
        const content = fs.readFileSync(fp, 'utf-8');
        // 只构建继承 SfcBase 的组件
        if (/import\s+SfcBase\s+from/.test(content) || /import\s+FunctionPanelUIBase/.test(content)) {
          const name = f.replace('.vue', '');
          const key = prefix ? `${prefix}/${name}` : name;
          entries[name] = key + '.vue';
          log(`  ✅ ${name}`, 'green');
        } else {
          log(`  ⊙ 跳过 ${f}`, 'yellow');
        }
      }
    }
  };
  scanDir(SRC);
  return entries;
}

async function main() {
  log('\n=== SFC 批量构建 (preserveModules) ===\n', 'blue');

  const entries = discoverEntries();
  log(`\n共 ${Object.keys(entries).length} 个组件\n`, 'cyan');

  // 单入口，preserveModules 会把所有模块输出为独立文件
  // 用 FunctionPanelUIBase 作为主入口
  const input = {};
  for (const [name, entry] of Object.entries(entries)) {
    input[name] = path.resolve(SRC, entry);
  }

  const startTime = Date.now();

  try {
    await build({
      plugins: [vue()],
      root: ROOT,
      css: { cssCodeSplit: false },
      build: {
        outDir: OUT,
        emptyOutDir: false,
        rollupOptions: {
          input,
          external: ['vue', 'cesium', 'three'],
          output: {
            format: 'es',
            entryFileNames: '[name].mjs',
            chunkFileNames: '[name].mjs',
            globals: { vue: 'Vue', cesium: 'Cesium', three: 'THREE' },
            // 确保共享模块被内联而非提取为 chunk
            manualChunks: undefined,
            hoistTransitiveImports: false
          }
        },
        copyPublicDir: false,
        sourcemap: false,
        minify: false,
        // ⚠️ 不拆分 chunk，每个入口自包含
        modulePreload: false,
        cssMinify: false
      },
      resolve: {
        alias: { 'vue': path.resolve(ROOT, 'node_modules/vue') }
      }
    });

    // 清理非 .mjs 文件
    for (const f of fs.readdirSync(OUT)) {
      const fp = path.join(OUT, f);
      if (fs.statSync(fp).isFile() && !f.endsWith('.mjs') && f !== 'components.json') {
        fs.unlinkSync(fp);
      }
    }

    // 列出 .mjs 文件
    log('\n📁 .mjs 输出:', 'blue');
    for (const f of fs.readdirSync(OUT).filter(x => x.endsWith('.mjs')).sort()) {
      const sz = (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(1);
      log(`  ${f} (${sz} KB)`, f in entries ? 'green' : 'yellow');
    }

    log(`\n✅ 完成 (${((Date.now() - startTime) / 1000).toFixed(1)}s)`, 'green');
  } catch (err) {
    log(`\n❌ ${err.message}`, 'red');
    process.exit(1);
  }
}

main();
