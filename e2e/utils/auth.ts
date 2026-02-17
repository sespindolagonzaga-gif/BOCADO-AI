import { Page } from '@playwright/test';
import { TestUser } from './test-users';
import { SELECTORS } from './selectors';

/**
 * Helpers de autenticación para tests E2E
 */

/**
 * Realiza el proceso completo de login
 */
export async function login(page: Page, email: string, password: string): Promise<void> {
  // Navegar a la página de login
  await page.goto('/');
  
  // Click en iniciar sesión si estamos en la home
  const loginButton = page.locator(SELECTORS.home.loginButton).first();
  if (await loginButton.isVisible().catch(() => false)) {
    await loginButton.click();
  }

  // Esperar a que cargue el formulario de login
  await page.waitForSelector(SELECTORS.login.emailInput, { state: 'visible' });

  // Llenar credenciales
  await page.fill(SELECTORS.login.emailInput, email);
  await page.fill(SELECTORS.login.passwordInput, password);

  // Submit
  await page.click(SELECTORS.login.submitButton);

  // Esperar redirección o carga de la app
  await page.waitForURL(/\/(recommendation|home|app)/, { timeout: 10000 });
}

/**
 * Realiza el proceso completo de registro de un nuevo usuario
 * Incluye todos los 3 pasos del formulario
 */
export async function register(page: Page, user: TestUser): Promise<void> {

  // Navegar a la página de inicio
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Si ya está autenticado, cerrar sesión
  const enterAppButton = await page.$('[data-testid="enter-app-button"]');
  if (enterAppButton) {
    // Ir a logout
    const logoutButton = await page.$('[data-testid="logout-button"]');
    if (logoutButton) {
      await logoutButton.click();
      // Esperar a que desaparezca el botón de logout y aparezca el de start
      await page.waitForSelector('[data-testid="start-button"]', { state: 'visible', timeout: 10000 });
    }
  }

  // Click en "Empezar" - esperar a que el botón sea visible
  try {
    await page.waitForFunction(
      () => !!document.querySelector('[data-testid="start-button"]'),
      { timeout: 15000 }
    );
    await page.waitForSelector('[data-testid="start-button"]', { state: 'visible', timeout: 15000 });
  } catch (error) {
    await page.screenshot({ path: 'test-failure-start-button.png', fullPage: true });
    const html = await page.content();
    console.error('Start button not found. HTML content:', html);
    throw new Error(`Start button not found. Screenshot saved. Error: ${error}`);
  }

  await page.click('[data-testid="start-button"]');

  // === Manejar pantalla de permisos/privacidad ===
  // Después de hacer clic en "Empezar", aparece una pantalla de consentimiento de privacidad
  try {
    // Esperar a que aparezca el título de la pantalla de permisos
    const permissionsTitle = page.locator('h1:has-text("Protegemos"), h1:has-text("protect")');
    
    // Si existe la pantalla de permisos, manejarla
    const isVisible = await permissionsTitle.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (isVisible) {
      console.log('Permissions screen detected, handling it...');
      
      // Hacer clic en el área del checkbox (el div container con cursor-pointer)
      // Buscar el texto "Entiendo y acepto" o "agree" y hacer clic en su contenedor
      const consentArea = page.locator('text=Entiendo y acepto, text=agree').first();
      await consentArea.click({ timeout: 5000 });
      
      console.log('Clicked on consent checkbox');
      
      // Esperar un momento para que se habilite el botón
      await page.waitForTimeout(500);
      
      // Hacer clic en el botón "Continuar" / "Continue" (ahora debería estar habilitado)
      const continueButton = page.locator('button:has-text("Continuar"), button:has-text("Continue")').first();
      await continueButton.click({ timeout: 5000 });
      
      console.log('Clicked on continue button');
      
      // Esperar a que desaparezca la pantalla de permisos
      await page.waitForTimeout(1000);
    }
  } catch (error) {
    // Si no aparece la pantalla de permisos o ya fue aceptada, continuar normalmente
    console.log('Permissions screen not found or already accepted:', error);
  }

  // === Step 1: Datos personales ===
  await page.waitForSelector(SELECTORS.register.firstNameInput, { state: 'visible' });
  
  await page.fill(SELECTORS.register.firstNameInput, user.firstName);
  await page.fill(SELECTORS.register.lastNameInput, user.lastName);
  await page.fill(SELECTORS.register.emailInput, user.email);
  await page.fill(SELECTORS.register.passwordInput, user.password);
  await page.fill(SELECTORS.register.confirmPasswordInput, user.password);
  
  await page.click(SELECTORS.register.nextButton);

  // === Step 2: Datos corporales ===
  await page.waitForTimeout(500); // Pequeña espera para transición
  await page.waitForLoadState('domcontentloaded');
  
  if (user.birthDate) {
    await page.fill(SELECTORS.register.birthDateInput, user.birthDate);
  }
  
  if (user.gender) {
    const genderSelector = {
      male: SELECTORS.register.genderMale,
      female: SELECTORS.register.genderFemale,
      other: SELECTORS.register.genderOther,
    }[user.gender];
    await page.click(genderSelector);
  }
  
  if (user.height) {
    await page.fill(SELECTORS.register.heightInput, user.height.toString());
  }
  
  if (user.weight) {
    await page.fill(SELECTORS.register.weightInput, user.weight.toString());
  }
  
  await page.click(SELECTORS.register.nextButton);

  // === Step 3: Preferencias ===
  await page.waitForTimeout(500); // Pequeña espera para transición
  await page.waitForLoadState('domcontentloaded');
  
  if (user.activityLevel) {
    await page.selectOption(SELECTORS.register.activityLevelSelect, user.activityLevel);
  }
  
  if (user.goal) {
    await page.selectOption(SELECTORS.register.goalSelect, user.goal);
  }
  
  if (user.dietType) {
    await page.selectOption(SELECTORS.register.dietTypeSelect, user.dietType);
  }
  
  await page.click(SELECTORS.register.submitButton);

  // Esperar redirección a la app
  await page.waitForURL(/\/(recommendation|home|app)/, { timeout: 15000 });
  
  // Esperar a que los elementos interactivos de la página de recomendación estén renderizados
  await page.waitForSelector(SELECTORS.recommendation.homeOption, { state: 'visible', timeout: 10000 });
  await page.waitForSelector(SELECTORS.recommendation.mealTypeBreakfast, { state: 'visible', timeout: 10000 });
}

/**
 * Registro simplificado - solo datos básicos
 */
export async function registerBasic(page: Page, user: TestUser): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Usar timeout más largo y selector específico
  try {
    // Esperar a que el DOM esté listo y el botón exista
    await page.waitForFunction(
      () => !!document.querySelector('[data-testid="start-button"]'),
      { timeout: 15000 }
    );
    
    // Luego esperar a que sea visible
    await page.waitForSelector('[data-testid="start-button"]', { state: 'visible', timeout: 15000 });
  } catch (error) {
    await page.screenshot({ path: 'test-failure-start-button-basic.png', fullPage: true });
    const html = await page.content();
    require('fs').writeFileSync('test-failure-start-button-basic.html', html);
    throw new Error(`Start button not found in registerBasic. Screenshot and HTML saved. Error: ${error}`);
  }

  await page.click('[data-testid="start-button"]');

  // Solo completar step 1
  await page.waitForSelector(SELECTORS.register.firstNameInput, { state: 'visible' });
  await page.fill(SELECTORS.register.firstNameInput, user.firstName);
  await page.fill(SELECTORS.register.lastNameInput, user.lastName);
  await page.fill(SELECTORS.register.emailInput, user.email);
  await page.fill(SELECTORS.register.passwordInput, user.password);
  await page.fill(SELECTORS.register.confirmPasswordInput, user.password);
  await page.click(SELECTORS.register.nextButton);
}

/**
 * Cierra la sesión del usuario actual
 */
export async function logout(page: Page): Promise<void> {
  // Ir al perfil
  await page.click(SELECTORS.bottomNav.profile);
  
  // Buscar y hacer click en cerrar sesión
  const logoutButton = page.locator(SELECTORS.profile.logoutButton);
  
  if (await logoutButton.isVisible().catch(() => false)) {
    await logoutButton.click();
    
    // Confirmar si hay modal
    const confirmButton = page.locator(SELECTORS.modal.confirmButton);
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
    }
  }

  // Esperar redirección a home
  await page.waitForURL('/', { timeout: 5000 });
}

/**
 * Verifica si el usuario está autenticado
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  // Intentar navegar a una ruta protegida
  await page.goto('/recommendation');
  
  const url = page.url();
  return !url.includes('/login') && !url.includes('/register');
}

/**
 * Espera a que Firebase Auth esté inicializado
 */
export async function waitForAuthInit(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    // Verificar si Firebase está disponible y auth está listo
    return document.readyState === 'complete';
  }, { timeout: 10000 });
}

/**
 * Limpia el estado de autenticación (localStorage, sessionStorage, IndexedDB)
 */
export async function clearAuthState(page: Page): Promise<void> {
  await page.goto('/');
  
  // Limpiar todos los storages
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    
    // Limpiar IndexedDB (donde Firebase guarda el auth state)
    const databases = await indexedDB.databases();
    databases.forEach(db => {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
      }
    });
    
    // Configurar idioma español por defecto para los tests
    localStorage.setItem('bocado-locale', 'es');
  });
  
  // Recargar para asegurar que todo el estado se limpia
  await page.reload({ waitUntil: 'networkidle' });
}
