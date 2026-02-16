import { defineConfig, devices } from '@playwright/test';

/**
 * Configuración de Playwright para tests E2E de Bocado AI
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Global setup y teardown
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  // Directorio donde se encuentran los tests
  testDir: './e2e',

  // Ejecutar tests en paralelo
  fullyParallel: true,

  // Fallar si se encuentra test.only en CI
  forbidOnly: !!process.env.CI,

  // Reintentos en CI
  retries: process.env.CI ? 2 : 0,

  // Workers en paralelo
  workers: process.env.CI ? 1 : undefined,

  // Reporter
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],

  // Configuración compartida para todos los tests
  use: {
    // URL base de la aplicación
    baseURL: 'http://localhost:3000',

    // Trazas en primer reintento
    trace: 'on-first-retry',

    // Captura de pantalla solo en fallos
    screenshot: 'only-on-failure',

    // Video solo en reintento
    video: 'on-first-retry',

    // Tiempo de espera acciones
    actionTimeout: 15000,

    // Tiempo de espera navegación
    navigationTimeout: 30000,

    // Viewport por defecto
    viewport: { width: 1280, height: 720 },

    // Configurar idioma español para los tests
    locale: 'es-ES',
    
    // Timezone
    timezane: 'Europe/Madrid',
  },

  // Proyectos de test
  // Nota: En Codespaces/entornos cloud puede faltar libatk1.0-0 y otras deps del sistema
  // Ver e2e/README.md para instrucciones de instalación
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Deshabilitar sandbox en entornos CI/Docker
        launchOptions: {
          args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : [],
        },
      },
    },
    // Descomentar para tests en móvil (requiere deps del sistema)
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  // Configuración del servidor de desarrollo
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  // Timeout global para tests
  timeout: 60000,

  // Expect timeout
  expect: {
    timeout: 10000,
  },
});
