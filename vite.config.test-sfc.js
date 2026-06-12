import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: 'public/test-sfc',
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, 'src/components/TestSfc.vue'),
      name: 'TestSfc',
      fileName: (format) => `TestSfc.${format === 'es' ? 'mjs' : 'umd.js'}`,
      formats: ['es', 'umd']
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue'
        }
      }
    }
  },
  resolve: {
    alias: {
      'vue': path.resolve(__dirname, 'node_modules/vue')
    }
  }
});
