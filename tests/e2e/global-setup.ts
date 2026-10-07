import { execSync } from 'node:child_process';

export default function globalSetup(): void {
  execSync('npm run fixtures:generate', { stdio: 'inherit' });
}
