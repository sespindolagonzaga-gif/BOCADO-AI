/**
 * 📚 JSDoc & Documentation Standards para BOCADO-AI
 * 
 * Esta guía establece los estándares para documentar código.
 * Todos los exports públicos deben tener JSDoc.
 */

/**
 * COMPONENTES REACT
 * ==================
 * 
 * @example:
 * 
 * /**
 *  * Recomendador de comidas personalizado
 *  * 
 *  * Genera recomendaciones basadas en perfil del usuario,
 *  * preferencias y ubicación geográfica.
 *  * 
 *  * @component
 *  * @param {Object} props - Props del componente
 *  * @param {string} props.userId - UID del usuario autenticado
 *  * @param {"home"|"restaurant"} props.type - Tipo de recomendación
 *  * @param {Function} props.onSelect - Callback cuando el usuario selecciona una recomendación
 *  * @returns {React.ReactElement} Componente renderizado
 *  * 
 *  * @example
 *  * const recipes = await recommendRecipes(uid, { omitNuts: true });
 *  * 
 *  * @throws {Error} Si el usuario no existe en Firebase
 *  * @throws {Error} Si la API de Gemini falla
 *  * /
 * export const RecommendationScreen: React.FC<RecommendationScreenProps> = ({ userId, type, onSelect }) => {
 *   // ...
 * };
 */

/**
 * SERVICIOS & APIs
 * ==================
 * 
 * @example:
 * 
 * /**
 *  * Obtiene perfil del usuario con caché en memoria
 *  * 
 *  * Implementa caching de 2 capas:
 *  * 1. Memoria (node-cache)
 *  * 2. Firestore directo (fallback)
 *  * 
 *  * @param {string} userId - UID del usuario en Firebase Auth
 *  * @returns {Promise<UserProfile>} Datos del perfil del usuario
 *  * 
 *  * @throws {Error} "Usuario no encontrado" si el UID no existe
 *  * @throws {Error} Si hay error al conectar con Firestore
 *  * 
 *  * @example
 *  * const profile = await getUserProfileCached("u123");
 *  * console.log(profile.nutritionalGoal);
 *  * 
 *  * @performance
 *  * - Cache hit: ~1ms
 *  * - Firestore miss: ~50-100ms
 *  * - Cache TTL: 10 minutos
 *  * /
 * async function getUserProfileCached(userId: string): Promise<UserProfile> {
 *   // ...
 * }
 */

/**
 * HOOKS PERSONALIZADOS
 * ==================
 * 
 * @example:
 * 
 * /**
 *  * Hook para obtener y sincronizar perfil del usuario
 *  * 
 *  * Encapsula lógica de:
 *  * - Validación de autenticación
 *  * - Fetch inicial y refetch con TanStack Query
 *  * - Manejo de errores con retry automático
 *  * - Caché invalidation cuando cambia el usuario
 *  * 
 *  * @param {string|null} userId - UID del usuario (null si no autenticado)
 *  * @returns {Object} Estado del perfil
 *  * @returns {UserProfile|null} returns.data - Datos del perfil
 *  * @returns {boolean} returns.isLoading - Está cargando
 *  * @returns {Error|null} returns.error - Error si lo hay
 *  * @returns {Function} returns.refetch - Función para recargar
 *  * 
 *  * @example
 *  * const { data: profile, isLoading, error } = useUserProfile(uid);
 *  * 
 *  * if (error) return <ErrorComponent error={error} />;
 *  * if (isLoading) return <Skeleton />;
 *  * return <ProfileCard profile={profile} />;
 *  * /
 * export const useUserProfile = (userId: string | null) => {
 *   // ...
 * }
 */

/**
 * TIPOS & INTERFACES
 * ==================
 * 
 * @example:
 * 
 * /**
 *  * Datos de perfil del usuario
 *  * 
 *  * Los campos que NO vienen de Firebase Auth (sensibles)
 *  * sino de Firestore (datos públicos del perfil)
 *  * 
 *  * @typedef {Object} UserProfile
 *  * @property {string} uid - UID único del usuario
 *  * @property {string} [gender] - Género (M/F/Otro) - Opcional
 *  * @property {string} [age] - Grupo de edad (18-25, 25-35, etc)
 *  * @property {string[]} diseases - Enfermedades crónicas
 *  * @property {string[]} allergies - Alergias alimentarias
 *  * @property {GeoLocation} [location] - Coordenadas GPS - Requiere permiso
 *  * @property {Date} [createdAt] - Crea timestamp - Automático
 *  * @property {Date} [updatedAt] - Update timestamp - Automático
 *  * /
 * interface UserProfile {
 *   uid: string;
 *   gender?: string;
 *   age?: string;
 *   // ...
 * }
 */

/**
 * APIs SERVERLESS
 * ==================
 * 
 * @example:
 * 
 * /**
 *  * POST /api/recommend
 *  * 
 *  * Genera recomendaciones personalizadas con IA
 *  * 
 *  * @route POST /api/recommend
 *  * @access Private (requiere autenticación Firebase)
 *  * @rateLimit 20 requests por hora por usuario
 *  * 
 *  * @body {RecommendationRequest}
 *  * @body.userId {string} UID del usuario autenticado
 *  * @body.type {string} "home" | "restaurant"
 *  * @body.dietary {Object} Restricciones dietéticas
 *  * 
 *  * @response {RecommendationResponse}
 *  * @response.saludo_personalizado {string} Saludo motivador
 *  * @response.receta {Object} Recomendación tipo receta
 *  * @response.recomendaciones {Object[]} Recomendación tipo restaurante
 *  * 
 *  * @example
 *  * POST /api/recommend
 *  * Authorization: Bearer <firebase_token>
 *  * Content-Type: application/json
 *  * 
 *  * {
 *  *   "userId": "user123",
 *  *   "type": "home",
 *  *   "dietary": { "vegetarian": true }
 *  * }
 *  * 
 *  * Response:
 *  * {
 *  *   "saludo_personalizado": "¡Hola Juan! Tengo una receta perfecta para ti",
 *  *   "receta": { ... }
 *  * }
 *  * 
 *  * @throws {400} Validation Error - Body inválido
 *  * @throws {401} Unauthorized - Token inválido o expirado
 *  * @throws {429} Too Many Requests - Rate limit excedido
 *  * @throws {500} Internal Server Error - Error en Gemini API
 *  * 
 *  * @performance
 *  * - Latencia típica: 1-3 segundos
 *  * - Timeout: 30 segundos
 *  * - Cache: Resultados cachados por 1 hora
 *  * /
 * export default async function handler(req, res) {
 *   // ...
 * }
 */

/**
 * CONSTANTS & CONFIGS
 * ==================
 * 
 * @example:
 * 
 * /**
 *  * Mapeo de países a monedas
 *  * 
 *  * Usado en:
 *  * - ProfileScreen para validar país
 *  * - PlanScreen para mostrar presupuesto en moneda local
 *  * - API para validaciones
 *  * /
 * export const COUNTRY_TO_CURRENCY = {
 *   "MX": "MXN",
 *   "ES": "EUR",
 *   // ...
 * } as const;
 */

/**
 * GUÍA DE TAGS ESPECIALES
 * ==================
 * 
 * @param       - Parámetro de función/tipo
 * @returns     - Valor de retorno
 * @throws      - Excepciones que puede lanzar
 * @deprecated  - Marcar código obsoleto
 * @internal    - Uso interno solamente
 * @private     - No exportar/usar externamente
 * @public      - API pública estable
 * @beta        - API en beta, puede cambiar
 * @example     - Ejemplo de uso
 * @see         - Referencia a otro archivo
 * @todo        - Trabajo pendiente
 * @performance - Notas de performance
 * @accessibility - Notas de accesibilidad
 * @security    - Notas de seguridad
 * @component   - Componente React
 * @route       - Ruta de API
 * @rateLimit   - Límite de rate limiting
 */

/**
 * TOOL: GENERAR DOCUMENTACIÓN
 * ==================
 * 
 * Para generar documentación HTML:
 * ```bash
 * npx typedoc src/ --out docs-generated
 * ```
 * 
 * O instalar en package.json:
 * ```json
 * {
 *   "devDependencies": {
 *     "typedoc": "^0.25.0"
 *   },
 *   "scripts": {
 *     "docs": "typedoc src/ --out docs-generated"
 *   }
 * }
 * ```
 */
