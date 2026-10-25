import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',fullyParallel:false,workers:1,forbidOnly:!!process.env.CI,
  retries:process.env.CI?1:0,reporter:'list',timeout:30000,
  use:{baseURL:'http://127.0.0.1:4318',viewport:{width:1440,height:1000},trace:'retain-on-failure',screenshot:'only-on-failure',
    launchOptions:process.env.PD_TEST_CHROMIUM?{executablePath:process.env.PD_TEST_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{}},
  webServer:{command:'node scripts/browser-server.mjs',url:'http://127.0.0.1:4318/api/health',reuseExistingServer:false,timeout:30000},
});
