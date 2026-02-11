import { test, expect } from '@playwright/test';
import { generateTestUser, TestUser } from './utils/test-users';
import { SELECTORS } from './utils/selectors';
import { register, clearAuthState } from './utils/auth';

test.describe('Navegación', () => {
  let testUser: TestUser;

  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
    
    // Crear usuario para tests
    testUser = generateTestUser();
    await register(page, testUser);
  });

  test.describe('Navegación principal (Bottom Tab Bar)', () => {
    test('navega a Home desde cualquier pantalla', async ({ page }) => {
      // Ir a otra pantalla primero
      await page.click(SELECTORS.bottomNav.profile);
      await expect(page).toHaveURL(/.*profile.*/);
      
      // Volver a home
      await page.click(SELECTORS.bottomNav.home);
      await expect(page).toHaveURL(/.*(\/|home).*/);
    });

    test('navega a Recomendaciones', async ({ page }) => {
      await page.click(SELECTORS.bottomNav.recommendation);
      await expect(page).toHaveURL(/.*recommendation.*/);
    });

    test('navega a Despensa', async ({ page }) => {
      await page.click(SELECTORS.bottomNav.pantry);
      await expect(page).toHaveURL(/.*pantry.*/);
    });

    test('navega a Plan', async ({ page }) => {
      await page.click(SELECTORS.bottomNav.plan);
      await expect(page).toHaveURL(/.*plan.*/);
    });

    test('navega a Perfil', async ({ page }) => {
      await page.click(SELECTORS.bottomNav.profile);
      await expect(page).toHaveURL(/.*profile.*/);
    });

    test('mantiene el estado al navegar entre pestañas', async ({ page }) => {
      // Generar una recomendación
      await page.click(SELECTORS.recommendation.homeOption);
      await page.click(SELECTORS.recommendation.mealTypeLunch);
      await page.click(SELECTORS.recommendation.generateButton);
      
      await page.waitForSelector(SELECTORS.recommendation.recommendationResult, { 
        state: 'visible', 
        timeout: 30000 
      });
      
      // Navegar a perfil y volver
      await page.click(SELECTORS.bottomNav.profile);
      await page.click(SELECTORS.bottomNav.recommendation);
      
      // Verificar que la recomendación sigue visible
      await expect(page.locator(SELECTORS.recommendation.recommendationResult).first()).toBeVisible();
    });
  });

  test.describe('Navegación móvil', () => {
    test('navegación inferior es visible en móvil', async ({ page }) => {
      // Set viewport móvil
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Verificar que la navegación inferior es visible
      const bottomNav = page.locator(SELECTORS.bottomNav.home).first();
      await expect(bottomNav).toBeVisible();
    });

    test('todos los tabs son accesibles en móvil', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      const tabs = [
        SELECTORS.bottomNav.home,
        SELECTORS.bottomNav.recommendation,
        SELECTORS.bottomNav.pantry,
        SELECTORS.bottomNav.plan,
        SELECTORS.bottomNav.profile,
      ];
      
      for (const tab of tabs) {
        const tabElement = page.locator(tab).first();
        await expect(tabElement).toBeVisible();
      }
    });
  });

  test.describe('URLs y rutas', () => {
    test('accede directamente a /recommendation estando autenticado', async ({ page }) => {
      await page.goto('/recommendation');
      await expect(page).toHaveURL(/.*recommendation.*/);
    });

    test('accede directamente a /profile estando autenticado', async ({ page }) => {
      await page.goto('/profile');
      await expect(page).toHaveURL(/.*profile.*/);
    });

    test('accede directamente a /pantry estando autenticado', async ({ page }) => {
      await page.goto('/pantry');
      await expect(page).toHaveURL(/.*pantry.*/);
    });

    test('accede directamente a /plan estando autenticado', async ({ page }) => {
      await page.goto('/plan');
      await expect(page).toHaveURL(/.*plan.*/);
    });
  });

  test.describe('Página 404', () => {
    test('muestra página 404 para rutas inexistentes', async ({ page }) => {
      await page.goto('/ruta-inexistente-12345');
      
      // Verificar que no es una de las rutas conocidas
      const url = page.url();
      expect(url).toContain('ruta-inexistente');
      
      // Podría mostrar una página de 404
      const notFoundVisible = await page.locator('text=404, No encontrado, Página no existe').isVisible().catch(() => false);
      // O redirigir a home
      const isHome = url.includes('/recommendation') || url.includes('/home') || url === 'http://localhost:3000/';
      
      expect(notFoundVisible || isHome).toBeTruthy();
    });
  });
});
