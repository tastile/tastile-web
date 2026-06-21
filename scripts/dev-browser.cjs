/* eslint-disable */
const { spawn } = require('child_process');
const { chromium } = require('playwright');

async function main() {
  // Start Next.js dev server
  const server = spawn('npx', ['next', 'dev', '-p', '3000'], {
    cwd: 'C:\\Users\\rebui\\Desktop\\tastile\\tastile-web',
    env: {
      ...process.env,
      E2E_BYPASS_AUTH: '1',
      NEXT_PUBLIC_E2E_BYPASS_AUTH: '1',
      NEXT_PUBLIC_DAEMON_BASE_URL: 'https://api.tastile.app'
    },
    stdio: 'pipe',
    shell: true
  });

  server.stdout.on('data', d => process.stdout.write(d));
  server.stderr.on('data', d => process.stderr.write(d));

  // Wait for server
  await new Promise((resolve) => {
    const check = () => {
      const http = require('http');
      http.get('http://localhost:3000', res => {
        resolve();
      }).on('error', () => setTimeout(check, 500));
    };
    setTimeout(check, 2000);
  });

  console.log('Server ready. Launching browser...');

  // Launch headed Chrome
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:3000/dashboard/execute');
  await page.waitForLoadState('networkidle');

  console.log('');
  console.log('========================================');
  console.log('  Dashboard open in Chrome browser');
  console.log('  URL: http://localhost:3000/dashboard/execute');
  console.log('  DevTools: F12 in the browser window');
  console.log('');
  console.log('  Close the browser window to stop.');
  console.log('========================================');
  console.log('');

  // Wait for browser to close
  await browser.on('disconnected', () => {
    server.kill();
    process.exit(0);
  });

  // Keep alive
  await new Promise(() => {});
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
