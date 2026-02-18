import { test, expect } from '@playwright/test';
import { generateTestUser } from './utils/test-users';
import { register, clearAuthState } from './utils/auth';
import { SELECTORS } from './utils/selectors';

test.describe('Recommendation button visibility', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
  });

  test('botón de generar es accesible en móvil tras expandir opciones', async ({ page }) => {
    const user = generateTestUser();
    // Registrar usuario (flujo completo) y esperar a que cargue la pantalla de recomendaciones
    await register(page, user);

    // Emular viewport móvil
    await page.setViewportSize({ width: 390, height: 844 });

    // Esperar a que las opciones de recomendación estén visibles
    await page.waitForSelector(SELECTORS.recommendation.homeOption, { timeout: 10000 });

    // Seleccionar 'Fuera' para mostrar más opciones
    await page.click(SELECTORS.recommendation.outsideOption);

    // Forzar scroll hasta abajo (simula al usuario desplazándose)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Verificar que el botón de generar está visible y dentro del viewport
    const gen = page.locator(SELECTORS.recommendation.generateButton);
    await expect(gen).toBeVisible({ timeout: 5000 });

    const inViewport = await gen.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight);
    });
    expect(inViewport).toBeTruthy();
  });
});
