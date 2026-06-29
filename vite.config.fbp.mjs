
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: 'public/test-sfc',
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, 'src/components/FunctionPanelUIBase.vue'),
      name: 'FunctionPanelUIBase',
      fileName: (format) => `FunctionPanelUIBase.${format === 'es' ? 'mjs' : 'umd.js'}`,
      formats: ['es']
    },
    rollupOptions: {
      external: ['vue', 'cesium', 'three'],
      output: { globals: { vue: 'Vue', cesium: 'Cesium', three: 'THREE' } }
    }
  },
  resolve: {
    alias: { 'vue': path.resolve(__dirname, 'node_modules/vue') }
  }
});
