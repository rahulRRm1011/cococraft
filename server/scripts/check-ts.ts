import { execSync } from 'child_process';

const targetFile = process.argv[2];

try {
  execSync('npx tsc --noEmit', { encoding: 'utf8' });
  console.log('No TS errors!');
} catch (e: any) {
  const lines = (e.stdout || '').split('\n');
  for (const line of lines) {
    if (!targetFile || line.includes(targetFile)) {
      console.log(line);
    }
  }
}
