import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { unlinkSync } from 'node:fs';
const output = 'tests/.features-test-bundle.mjs';
try {
  await build({ entryPoints: ['tests/features.test.ts'], bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile: output, logLevel: 'silent' });
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', output, 'tests/media.test.mjs'], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally {
  try { unlinkSync(output); } catch { /* Bundle may not have been created. */ }
}
