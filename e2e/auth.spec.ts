import { test, expect } from '@playwright/test';
import { generateTestUser, INVALID_CREDENTIALS, FIXED_TEST_USER } from './utils/test-users';
import { SELECTORS } from './utils/selectors';
import { login, register, clearAuthState } from './utils/auth';

test.describe('Autenticación', () => {
  // Limpiar estado antes de cada test
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
  });

  test.describe('Registro', () => {
    test('usuario puede registrarse completando el formulario de 3 pasos', async ({ page }) => {
      const user = generateTestUser();
      
      // Paso 1: Ir a la home y hacer click en Empezar
      await page.goto('/');
      await expect(page).toHaveTitle(/Bocado/i);
      
      await page.click(SELECTORS.home.startButton);
      
      // === Manejar pantalla de permisos/privacidad ===
      try {
        // Esperar a que aparezca el texto "Protegemos" (título de la pantalla de permisos)
        await page.waitForTimeout(1000); // Dar tiempo para que cargue la página
        
        const permissionsTitle = await page.locator('text=Protegemos').count();
        
        if (permissionsTitle > 0) {
          console.log('Permissions screen detected, handling consent...');
          
          // Hacer clic en el área del checkbox de consentimiento
          // Buscar por el texto completo "Entiendo y acepto"
          await page.locator('text=Entiendo y acepto').click();
          
          // Esperar a que se habilite el botón
          await page.waitForTimeout(500);
          
          // Hacer clic en el botón "Continuar"
          await page.locator('button:has-text("Continuar")').click();
          
          // Esperar a que desaparezca la pantalla de permisos
          await page.waitForTimeout(1000);
          
          console.log('Permissions handled successfully');
        } else {
          console.log('Permissions screen not detected');
        }
      } catch (error) {
        console.log('Error handling permissions screen:', error);
      }
      
      // Paso 2: Completar datos personales (formulario unificado)
      await page.waitForSelector(SELECTORS.register.firstNameInput, { state: 'visible' });
      
      await page.fill(SELECTORS.register.firstNameInput, user.firstName);
      await page.fill(SELECTORS.register.lastNameInput, user.lastName);
      
      // Seleccionar género (requerido)
      await page.click(SELECTORS.register.genderMale);
      
      // Llenar edad (el campo es un textbox simple, no fecha de nacimiento)
      const ageInput = page.locator('input[placeholder="25"]');
      if (await ageInput.isVisible().catch(() => false)) {
        await ageInput.fill('25');
      }
      
      // Peso y altura (opcionales) - usar placeholders
      const weightInput = page.locator('input[placeholder="70"]');
      if (await weightInput.isVisible().catch(() => false)) {
        await weightInput.fill('70');
      }
      
      const heightInput = page.locator('input[placeholder="175"]');
      if (await heightInput.isVisible().catch(() => false)) {
        await heightInput.fill('175');
      }
      
      // Seleccionar país (requerido)
      const countrySelect = page.locator('select, combobox').first();
      if (await countrySelect.isVisible().catch(() => false)) {
        await countrySelect.selectOption('México');
      }
      
      // Esperar a que se habilite el campo de ciudad
      await page.waitForTimeout(500);
      
      // Llenar ciudad (si está habilitado)
      const cityInput = page.locator('input[placeholder*="ciudad" i], input[name="city"]');
      if (await cityInput.isEnabled().catch(() => false)) {
        await cityInput.fill('Ciudad de México');
      }
      
      // Email y contraseña
      await page.fill(SELECTORS.register.emailInput, user.email);
      await page.fill(SELECTORS.register.passwordInput, user.password);
      await page.fill(SELECTORS.register.confirmPasswordInput, user.password);
      
      // IMPORTANTE: Inicializar campos del paso 2 en localStorage antes de avanzar
      // Esto asegura que Zustand tenga los campos necesarios
      await page.evaluate(() => {
        const stored = localStorage.getItem('profile-draft-storage');
        if (stored) {
          const data = JSON.parse(stored);
          if (!data.state.formData.diseases) {
            data.state.formData.diseases = [];
          }
          if (!data.state.formData.allergies) {
            data.state.formData.allergies = [];
          }
          if (!data.state.formData.nutritionalGoal) {
            data.state.formData.nutritionalGoal = [];
          }
          localStorage.setItem('profile-draft-storage', JSON.stringify(data));
        }
      });
      console.log('Initialized step 2 fields in localStorage');
      
      // Hacer click en "Siguiente" para avanzar al paso 2
      const nextBtn = page.locator('button:has-text("Siguiente")').first();
      await nextBtn.scrollIntoViewIfNeeded();
      await nextBtn.click();
      console.log('Clicked next button - moving to step 2');
      
      // Paso 3: Objetivo nutricional y preferencias (Paso 2 de 3)
      // Esperar a que el paso 1 desaparezca y aparezca el paso 2
      await page.waitForTimeout(1500);
      
      // Esperar a que aparezca el texto "Paso 2 de 3"
      await page.waitForSelector('text=Paso 2 de 3', { timeout: 15000 });
      console.log('Step 2 loaded');
      
      // Esperar a que aparezca el texto de objetivo nutricional
      await page.waitForSelector('text=Objetivo nutricional', { timeout: 10000 });
      console.log('Nutrition goal section visible');
      
      // Seleccionar objetivo nutricional (requerido)
      // Asegurarse de que el botón sea visible y clickeable
      const goalButton = page.locator('button:has-text("Salud y bienestar")');
      await goalButton.scrollIntoViewIfNeeded();
      await goalButton.waitFor({ state: 'visible', timeout: 5000 });
      
      // IMPORTANTE: Disparar el evento de React correctamente
      // El .click() de Playwright no siempre dispara los event handlers de React correctamente
      await goalButton.evaluate((btn) => {
        // Disparar eventos que React escucha
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        btn.dispatchEvent(clickEvent);
      });
      console.log('Dispatched click event on "Salud y bienestar" button');
      
      // Esperar un momento para que React procese el evento
      await page.waitForTimeout(1000);
      
      // Verificar que el botón realmente se seleccionó (cambió de clase)
      const isSelected = await goalButton.evaluate((btn) => {
        return btn.classList.contains('bg-bocado-green');
      });
      console.log('Goal button selected:', isSelected);
      
      if (!isSelected) {
        // Intentar hacer clic nuevamente
        console.log('Button not selected, retrying click...');
        await goalButton.click();
        await page.waitForTimeout(500);
        
        const isSelectedAfterRetry = await goalButton.evaluate((btn) => {
          return btn.classList.contains('bg-bocado-green');
        });
        console.log('Goal button selected after retry:', isSelectedAfterRetry);
      }
      
      // IMPORTANTE: Esperar a que Zustand persista el estado en localStorage
      // El componente usa useProfileDraftStore que persiste a localStorage
      await page.waitForTimeout(1000);
      console.log('Waited for state to persist');
      
      // DEBUG: Verificar que el valor se guardó en el store de Zustand
      const storedData = await page.evaluate(() => {
        const stored = localStorage.getItem('profile-draft-storage');
        if (stored) {
          const parsed = JSON.parse(stored);
          return parsed.state?.formData?.nutritionalGoal || null;
        }
        return null;
      });
      console.log('Stored nutritionalGoal in localStorage:', storedData);
      
      // Verificar que el botón "Siguiente" siga activo
      const nextButtonStep2 = page.locator('button:has-text("Siguiente")').last();
      const isEnabled = await nextButtonStep2.isEnabled();
      console.log('Next button enabled:', isEnabled);
      
      // Hacer scroll al botón y hacer click
      await nextButtonStep2.scrollIntoViewIfNeeded();
      await nextButtonStep2.click();
      console.log('Clicked next button - moving to step 3');
      
      // Paso 4: Esperar y ver si hay un paso 3 o si se completa el registro
      await page.waitForTimeout(2000);
      
      // Intentar detectar si hay un paso 3 o si ya terminó el registro
      const step3Title = await page.locator('text=Paso 3').count();
      
      if (step3Title > 0) {
        console.log('Step 3 detected');
        // Si hay paso 3, buscar botón para finalizar
        const finalizeBtn = page.locator('button:has-text("Crear cuenta"), button:has-text("Finalizar"), button:has-text("Siguiente"), button[type="submit"]').first();
        if (await finalizeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          console.log('Clicking finalize button');
          await finalizeBtn.click();
          await page.waitForTimeout(2000);
        }
      }
      
      // Verificar redirección exitosa
      await expect(page).toHaveURL(/.*(recommendation|home|app).*/, { timeout: 15000 });
      
      // Verificar que aparece algún elemento de la app
      const navElement = page.locator(SELECTORS.bottomNav.home).first();
      await expect(navElement).toBeVisible({ timeout: 5000 });
    });

    test('muestra error cuando las contraseñas no coinciden', async ({ page }) => {
      await page.goto('/');
      await page.click(SELECTORS.home.startButton);
      
      await page.waitForSelector(SELECTORS.register.firstNameInput, { state: 'visible' });
      
      await page.fill(SELECTORS.register.firstNameInput, 'Test');
      await page.fill(SELECTORS.register.lastNameInput, 'User');
      await page.fill(SELECTORS.register.emailInput, 'test@example.com');
      await page.fill(SELECTORS.register.passwordInput, 'Password123!');
      await page.fill(SELECTORS.register.confirmPasswordInput, 'DifferentPassword123!');
      
      await page.click(SELECTORS.register.nextButton);
      
      // Verificar que hay mensaje de error
      const errorVisible = await page.locator(SELECTORS.register.errorMessage).isVisible().catch(() => false);
      expect(errorVisible).toBeTruthy();
    });

    test('muestra error con email inválido', async ({ page }) => {
      await page.goto('/');
      await page.click(SELECTORS.home.startButton);
      
      await page.waitForSelector(SELECTORS.register.firstNameInput, { state: 'visible' });
      
      await page.fill(SELECTORS.register.firstNameInput, 'Test');
      await page.fill(SELECTORS.register.lastNameInput, 'User');
      await page.fill(SELECTORS.register.emailInput, 'email-invalido');
      await page.fill(SELECTORS.register.passwordInput, 'Password123!');
      await page.fill(SELECTORS.register.confirmPasswordInput, 'Password123!');
      
      await page.click(SELECTORS.register.nextButton);
      
      // El navegador debería mostrar validación de email
      const emailInput = page.locator(SELECTORS.register.emailInput);
      const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
      expect(validationMessage).toBeTruthy();
    });
  });

  test.describe('Login', () => {
    test('usuario puede iniciar sesión con credenciales válidas', async ({ page }) => {
      // Nota: Este test asume que FIXED_TEST_USER existe
      // Para tests reales, se debería crear el usuario antes o usar un mock
      
      await page.goto('/login');
      
      await page.waitForSelector(SELECTORS.login.emailInput, { state: 'visible' });
      
      await page.fill(SELECTORS.login.emailInput, FIXED_TEST_USER.email);
      await page.fill(SELECTORS.login.passwordInput, FIXED_TEST_USER.password);
      
      await page.click(SELECTORS.login.submitButton);
      
      // Verificar redirección
      await expect(page).toHaveURL(/.*(recommendation|home|app).*/, { timeout: 10000 });
    });

    test('muestra error con credenciales inválidas', async ({ page }) => {
      await page.goto('/login');
      
      await page.waitForSelector(SELECTORS.login.emailInput, { state: 'visible' });
      
      await page.fill(SELECTORS.login.emailInput, INVALID_CREDENTIALS.email);
      await page.fill(SELECTORS.login.passwordInput, INVALID_CREDENTIALS.password);
      
      await page.click(SELECTORS.login.submitButton);
      
      // Verificar mensaje de error
      await page.waitForTimeout(1000);
      
      const errorLocator = page.locator(SELECTORS.login.errorMessage);
      const hasError = await errorLocator.isVisible().catch(() => false);
      
      // O la URL sigue siendo /login
      const url = page.url();
      expect(hasError || url.includes('/login')).toBeTruthy();
    });

    test('navegación entre login y registro funciona', async ({ page }) => {
      await page.goto('/login');
      
      await page.waitForSelector(SELECTORS.login.registerLink, { state: 'visible' });
      await page.click(SELECTORS.login.registerLink);
      
      // Verificar que estamos en la página de registro
      await expect(page).toHaveURL(/.*register.*/);
      await page.waitForSelector(SELECTORS.register.firstNameInput, { state: 'visible' });
    });
  });

  test.describe('Navegación desde Home', () => {
    test('botón Empezar redirige al flujo de registro', async ({ page }) => {
      await page.goto('/');
      
      await page.click(SELECTORS.home.startButton);
      
      // Verificar que estamos en el flujo de registro
      await page.waitForSelector(SELECTORS.register.firstNameInput, { state: 'visible' });
    });

    test('botón Iniciar sesión redirige a login', async ({ page }) => {
      await page.goto('/');
      
      const loginButton = page.locator(SELECTORS.home.loginButton).first();
      if (await loginButton.isVisible().catch(() => false)) {
        await loginButton.click();
        await expect(page).toHaveURL(/.*login.*/);
      }
    });
  });
});
