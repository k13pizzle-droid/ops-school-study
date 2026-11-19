import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __BANK_VERSION__: '"test"', __BUILD_TIME__: '"test"' },
  test: { include: ['tests/**/*.spec.ts'] },
});
