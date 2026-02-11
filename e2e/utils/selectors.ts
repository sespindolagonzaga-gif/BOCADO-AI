/**
 * Selectores de elementos para los tests E2E
 * 
 * Preferimos usar data-testid cuando está disponible, 
 * y como fallback usamos textos o atributos.
 */

export const SELECTORS = {
  // Pantalla de inicio (Home)
  home: {
    startButton: '[data-testid="start-button"]',  // Sitúa data-testid primero para máxima fiabilidad
    loginButton: '[data-testid="login-button"]',  // Sitúa data-testid primero
    appTitle: 'text=Bocado',
  },

  // Flujo de registro
  register: {
    // Step 1: Datos personales
    firstNameInput: 'input[name="firstName"], input[placeholder*="nombre" i]',
    lastNameInput: 'input[name="lastName"], input[placeholder*="apellido" i]',
    emailInput: 'input[name="email"], input[type="email"]',
    passwordInput: 'input[name="password"], input[type="password"]:first-of-type',
    confirmPasswordInput: 'input[name="confirmPassword"], input[name="confirm-password"], input[placeholder*="confirmar" i]',
    nextButton: 'button:has-text("Siguiente"), button[type="submit"]',
    submitButton: 'button:has-text("Crear cuenta"), button[type="submit"]',
    
    // Step 2: Datos corporales
    birthDateInput: 'input[name="birthDate"], input[type="date"]',
    genderMale: 'input[value="male"], [data-testid="gender-male"], button:has-text("Hombre")',
    genderFemale: 'input[value="female"], [data-testid="gender-female"], button:has-text("Mujer")',
    genderOther: 'input[value="other"], [data-testid="gender-other"], button:has-text("Otro")',
    heightInput: 'input[name="height"], input[placeholder*="altura" i]',
    weightInput: 'input[name="weight"], input[placeholder*="peso" i]',
    
    // Step 3: Preferencias y objetivos
    activityLevelSelect: 'select[name="activityLevel"], [data-testid="activity-level"]',
    goalSelect: 'select[name="goal"], [data-testid="goal"]',
    dietTypeSelect: 'select[name="dietType"], [data-testid="diet-type"]',
    allergiesInput: 'input[name="allergies"], input[placeholder*="alergia" i]',
    intolerancesInput: 'input[name="intolerances"], input[placeholder*="intolerancia" i]',
    
    // Errores
    errorMessage: '[data-testid="error-message"], .error-message, [role="alert"]',
  },

  // Login
  login: {
    emailInput: 'input[name="email"], input[type="email"]',
    passwordInput: 'input[name="password"], input[type="password"]',
    submitButton: 'button[type="submit"], button:has-text("Iniciar sesión")',
    forgotPasswordLink: 'a:has-text("¿Olvidaste"), a:has-text("recuperar")',
    registerLink: 'a:has-text("Regístrate"), a:has-text("Crear cuenta")',
    errorMessage: '[data-testid="error-message"], .error-message, [role="alert"]',
  },

  // Recomendaciones
  recommendation: {
    // Opciones de ubicación
    homeOption: 'button:has-text("En casa"), [data-testid="location-home"], div:has-text("En casa")',
    outsideOption: 'button:has-text("Fuera"), [data-testid="location-outside"], div:has-text("Fuera")',
    
    // Tipo de comida
    mealTypeBreakfast: 'button:has-text("Desayuno"), [data-testid="meal-breakfast"]',
    mealTypeLunch: 'button:has-text("Almuerzo"), [data-testid="meal-lunch"], button:has-text("Comida")',
    mealTypeDinner: 'button:has-text("Cena"), [data-testid="meal-dinner"]',
    mealTypeSnack: 'button:has-text("Snack"), [data-testid="meal-snack"], button:has-text("Merienda")',
    
    // Botón de generar
    generateButton: 'button:has-text("Generar"), [data-testid="generate-recommendation"], button:has-text("Crear")',
    
    // Resultados
    recommendationResult: '[data-testid="recommendation-result"], .recommendation-result',
    mealCard: '[data-testid="meal-card"], .meal-card',
    recipeTitle: '[data-testid="recipe-title"], h3, h4',
    calories: '[data-testid="calories"], .calories',
    macros: '[data-testid="macros"], .macros',
    
    // Acciones
    saveRecipeButton: 'button:has-text("Guardar"), [data-testid="save-recipe"], button[aria-label*="guardar" i]',
    shareButton: 'button:has-text("Compartir"), [data-testid="share-recipe"]',
    regenerateButton: 'button:has-text("Regenerar"), button:has-text("Otra opción")',
  },

  // Navegación inferior
  bottomNav: {
    home: '[data-testid="nav-recommendation"], button:has-text("Inicio")',
    recommendation: '[data-testid="nav-recommendation"], button:has-text("Inicio")',
    pantry: '[data-testid="nav-pantry"], button:has-text("Despensa")',
    saved: '[data-testid="nav-saved"], button:has-text("Recetas")',
    restaurants: '[data-testid="nav-restaurants"], button:has-text("Lugares")',
    profile: '[data-testid="nav-profile"], button:has-text("Perfil")',
  },

  // Perfil
  profile: {
    userName: '[data-testid="user-name"], .user-name, h1, h2',
    userEmail: '[data-testid="user-email"], .user-email',
    editButton: 'button:has-text("Editar"), [data-testid="edit-profile"]',
    saveButton: 'button:has-text("Guardar"), button[type="submit"]',
    logoutButton: 'button:has-text("Cerrar sesión"), [data-testid="logout"]',
    deleteAccountButton: 'button:has-text("Eliminar cuenta"), [data-testid="delete-account"]',
    
    // Campos editables
    firstNameInput: 'input[name="firstName"]',
    lastNameInput: 'input[name="lastName"]',
    weightInput: 'input[name="weight"]',
    goalSelect: 'select[name="goal"]',
    
    // Estadísticas
    statsSection: '[data-testid="profile-stats"], .stats',
    bmiValue: '[data-testid="bmi-value"], .bmi',
    dailyCalories: '[data-testid="daily-calories"], .daily-calories',
  },

  // Despensa (Pantry)
  pantry: {
    addItemButton: 'button:has-text("Añadir"), [data-testid="add-item"], button[aria-label*="añadir" i]',
    itemNameInput: 'input[name="itemName"], input[placeholder*="producto" i]',
    quantityInput: 'input[name="quantity"], input[type="number"]',
    categorySelect: 'select[name="category"], [data-testid="category-select"]',
    saveItemButton: 'button:has-text("Guardar"), button[type="submit"]',
    itemList: '[data-testid="pantry-list"], .pantry-list',
    itemRow: '[data-testid="pantry-item"], .pantry-item',
    deleteItemButton: 'button[aria-label*="eliminar" i], button:has-text("Eliminar")',
  },

  // Plan
  plan: {
    weekView: '[data-testid="week-view"], .week-view',
    dayCard: '[data-testid="day-card"], .day-card',
    mealSlot: '[data-testid="meal-slot"], .meal-slot',
    generatePlanButton: 'button:has-text("Generar plan"), [data-testid="generate-plan"]',
  },

  // Modales
  modal: {
    overlay: '[data-testid="modal-overlay"], .modal-overlay, [role="dialog"]',
    closeButton: 'button[aria-label*="cerrar" i], [data-testid="close-modal"], button:has-text("×")',
    confirmButton: 'button:has-text("Confirmar"), button:has-text("Sí")',
    cancelButton: 'button:has-text("Cancelar"), button:has-text("No")',
  },

  // Loading y estados
  loading: {
    spinner: '[data-testid="loading"], .loading, .spinner, [role="progressbar"]',
    skeleton: '.skeleton, [data-testid="skeleton"]',
  },

  // Notificaciones
  notifications: {
    toast: '[data-testid="toast"], .toast, [role="alert"]',
    successMessage: '.success, [data-testid="success"]',
    errorMessage: '.error, [data-testid="error"]',
  },
} as const;

/**
 * Helper para construir selectores personalizados
 */
export function buildTestIdSelector(testId: string): string {
  return `[data-testid="${testId}"]`;
}

/**
 * Helper para construir selectores de texto
 */
export function buildTextSelector(text: string): string {
  return `text=${text}`;
}
