import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { rateLimiter } from './utils/rateLimit';

// ============================================
// 1. INICIALIZACIÓN DE FIREBASE
// ============================================
if (!getApps().length) {
  try {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY no definida");
    }
    const serviceAccount = JSON.parse(serviceAccountKey.trim());
    initializeApp({ credential: cert(serviceAccount) });
  } catch (error) {
    console.error("❌ Error Firebase Init:", error);
    throw error;
  }
}

const db = getFirestore();

// ============================================
// 2. TIPOS E INTERFACES
// ============================================
interface UserProfile {
  nutritionalGoal?: string;
  allergies?: string[];
  diseases?: string[];
  dislikedFoods?: string[];
  city?: string;
  countryName?: string;
  gender?: string;
  age?: string;
  weight?: string;
  height?: string;
  activityLevel?: string;
  activityFrequency?: string;
}

interface RequestBody {
  userId: string;
  type: 'En casa' | 'Fuera';
  mealType?: string;
  cookingTime?: string;
  cravings?: string;
  budget?: string;
  currency?: string;
  dislikedFoods?: string[];
  _id?: string;
}

interface AirtableIngredient {
  id: string;
  fields: {
    México?: string;
    España?: string;
    EUA?: string;
    Nombre?: string;
    Ingrediente?: string;
    Vegano?: boolean;
    Vegetariano?: boolean;
    Celíaco?: boolean;
    Intolerancia_lactosa?: boolean;
    Alergia_frutos_secos?: boolean;
    Índice_glucémico?: number;
    Sodio_mg?: number;
    Colesterol_mg?: number;
    Yodo_µg?: number;
    Fibra_dietética_g?: number;
    Azúcares_totales_g?: number;
    Grasas_saturadas_g?: number;
  };
}

// ============================================
// 3. FUNCIONES DE UTILIDAD
// ============================================

const normalizeText = (text: string): string => 
  text ? text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";

const getRootWord = (text: string): string => {
  let clean = normalizeText(text);
  if (clean.length <= 3) return clean;
  if (clean.endsWith('ces')) return clean.slice(0, -3) + 'z';
  if (clean.endsWith('es')) return clean.slice(0, -2);
  if (clean.endsWith('s')) return clean.slice(0, -1);
  return clean;
};

const createRegexPattern = (text: string): string => {
  const root = getRootWord(text);
  return root
    .replace(/a/g, '[aáàäâ]')
    .replace(/e/g, '[eéèëê]')
    .replace(/i/g, '[iíìïî]')
    .replace(/o/g, '[oóòöô]')
    .replace(/u/g, '[uúùüû]');
};

const ensureArray = (input: any): string[] => {
  if (!input) return [];
  if (Array.isArray(input)) return input.filter((i): i is string => typeof i === 'string');
  if (typeof input === 'string') return input.split(',').map(s => s.trim()).filter(Boolean);
  return [];
};

const formatList = (data: any): string => {
  if (!data || (Array.isArray(data) && data.length === 0)) return "Ninguna";
  if (Array.isArray(data)) return data.join(", ");
  return String(data);
};

// ============================================
// 4. FILTROS DE SEGURIDAD ALIMENTARIA
// ============================================

const buildAirtableFormula = (user: UserProfile): string => {
  const conditions: string[] = [];
  
  const prefs = ensureArray(user.allergies);
  if (prefs.includes("Vegano")) conditions.push("{Vegano} = TRUE()");
  if (prefs.includes("Vegetariano")) conditions.push("{Vegetariano} = TRUE()");
  if (prefs.includes("Celíaco")) conditions.push("{Celíaco} = TRUE()");
  if (prefs.includes("Intolerante a la lactosa")) conditions.push("{Intolerancia_lactosa} = TRUE()");
  if (prefs.includes("Alergia a frutos secos")) conditions.push("{Alergia_frutos_secos} = TRUE()");
  
  const illnesses = ensureArray(user.diseases);
  if (illnesses.includes("Diabetes")) {
    conditions.push("AND({Índice_glucémico} < 55, {Azúcares_totales_g} < 10)");
  }
  if (illnesses.includes("Hipertensión")) conditions.push("{Sodio_mg} < 140");
  if (illnesses.includes("Colesterol")) {
    conditions.push("AND({Colesterol_mg} < 20, {Grasas_saturadas_g} < 1.5)");
  }
  if (illnesses.includes("Hipotiroidismo")) conditions.push("{Yodo_µg} > 10");
  if (illnesses.includes("Hipertiroidismo")) conditions.push("{Yodo_µg} < 50");
  if (illnesses.includes("Intestino irritable")) {
    conditions.push("AND({Fibra_dietética_g} > 1, {Fibra_dietética_g} < 10)");
  }
  
  const dislikes = ensureArray(user.dislikedFoods);
  if (dislikes.length > 0) {
    const searchTarget = 'CONCATENATE({Ingrediente}, " ", {México}, " ", {España}, " ", {EUA})';
    dislikes.forEach(foodItem => {
      const pattern = createRegexPattern(foodItem);
      conditions.push(`NOT(REGEX_MATCH(${searchTarget}, '(?i)${pattern}'))`);
    });
  }
  
  return conditions.length > 0 ? `AND(${conditions.join(", ")})` : "TRUE()";
};

// ============================================
// 5. SISTEMA DE SCORING
// ============================================

const scoreIngredients = (
  airtableItems: AirtableIngredient[],
  pantryItems: string[]
): { priorityList: string; marketList: string; hasPantryItems: boolean } => {
  
  const pantryRoots = pantryItems
    .map(item => getRootWord(item))
    .filter(root => root && root.length > 2);
  
  const genericWords = ["aceite", "sal", "leche", "pan", "harina", "agua", "mantequilla", "crema", "salsa"];
  
  const scoredItems = airtableItems.map(atItem => {
    const rawName = atItem.fields.México || atItem.fields.Ingrediente || atItem.fields.Nombre || atItem.fields.España || "";
    if (!rawName) return { name: "", score: 0 };
    
    const norm = normalizeText(rawName);
    const root = getRootWord(rawName);
    let score = 1;
    
    pantryRoots.forEach(pantryRoot => {
      if (root === pantryRoot) {
        score = 50;
      } else if (new RegExp(`\\b${pantryRoot}\\b`, 'i').test(norm)) {
        if (!(norm.split(/\s+/).length > 2 && genericWords.includes(pantryRoot))) {
          score = 20;
        }
      }
    });
    
    return { name: rawName, score };
  }).filter(item => item.name);
  
  scoredItems.sort((a, b) => b.score - a.score);
  
  const priorityList = scoredItems.filter(i => i.score >= 20).map(i => i.name).join(", ");
  const marketList = scoredItems.filter(i => i.score < 20).map(i => i.name).join(", ");
  
  return { priorityList, marketList, hasPantryItems: priorityList.length > 0 };
};

// ============================================
// 6. RATE LIMITING DISTRIBUIDO (V2)
// ============================================
// Reemplazado por: ./utils/rateLimit.ts
// Usa transacciones atómicas de Firestore para evitar race conditions
// y es escalable a múltiples instancias serverless

// ============================================
// 7. UTILIDAD PARA GENERAR LINKS DE MAPS
// ============================================

const generateMapsLink = (restaurantName: string, address: string, city: string): string => {
  // Limpiar caracteres especiales pero mantener espacios para la query
  const cleanName = restaurantName.replace(/[^\w\s\-&,]/g, '').trim();
  const cleanAddress = (address || '').replace(/[^\w\s\-&,]/g, '').trim();
  const cleanCity = (city || '').replace(/[^\w\s\-&]/g, '').trim();
  
  // Priorizar: Nombre + Dirección + Ciudad (más preciso)
  // Fallback: Nombre + Ciudad
  const searchQuery = cleanAddress 
    ? `${cleanName} ${cleanAddress} ${cleanCity}`
    : `${cleanName} ${cleanCity}`;
  
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`;
};

const sanitizeRecommendation = (rec: any, city: string) => {
  // Asegurar que el link de Maps sea válido y use dirección si existe
  if (rec.nombre_restaurante) {
    const address = rec.direccion_aproximada || '';
    rec.link_maps = generateMapsLink(rec.nombre_restaurante, address, city);
  }
  
  // Asegurar que no haya campos undefined
  rec.direccion_aproximada = rec.direccion_aproximada || `En ${city}`;
  rec.por_que_es_bueno = rec.por_que_es_bueno || 'Opción saludable disponible';
  rec.plato_sugerido = rec.plato_sugerido || 'Consulta el menú saludable';
  rec.hack_saludable = rec.hack_saludable || 'Pide porciones pequeñas';
  
  return rec;
};

// ============================================
// 8. HANDLER PRINCIPAL
// ============================================

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  // ============================================
  // GET /api/recommend?userId=xxx - Status del rate limit
  // ============================================
  if (req.method === 'GET') {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId requerido' });
    }
    
    const status = await rateLimiter.getStatus(userId);
    if (!status) {
      return res.status(200).json({ 
        canRequest: true, 
        requestsInWindow: 0,
        remainingRequests: 5 
      });
    }
    
    return res.status(200).json({
      ...status,
      nextAvailableIn: status.nextAvailableAt 
        ? Math.max(0, Math.ceil((status.nextAvailableAt - Date.now()) / 1000))
        : 0,
    });
  }
  
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  let interactionRef: FirebaseFirestore.DocumentReference | null = null;
  let userId: string | null = null;

  try {
    const request: RequestBody = req.body;
    userId = request.userId;
    const { type, _id } = request;
    const interactionId = _id || `int_${Date.now()}`;
    
    console.log(`🚀 Nueva solicitud: type=${type}, userId=${userId}, interactionId=${interactionId}`);

    if (!userId) return res.status(400).json({ error: 'userId requerido' });
    if (!type || !['En casa', 'Fuera'].includes(type)) {
      return res.status(400).json({ error: 'type debe ser "En casa" o "Fuera"' });
    }

    // ============================================
    // RATE LIMITING V2 - Transacción atómica
    // ============================================
    const rateCheck = await rateLimiter.checkRateLimit(userId);
    if (!rateCheck.allowed) {
      return res.status(429).json({ 
        error: rateCheck.error,
        retryAfter: rateCheck.secondsLeft,
        remainingRequests: rateCheck.remainingRequests 
      });
    }

    interactionRef = db.collection('user_interactions').doc(interactionId);
    await interactionRef.set({
      userId,
      interaction_id: interactionId,
      createdAt: FieldValue.serverTimestamp(),
      status: 'processing',
      tipo: type
    });

    const historyCol = type === 'En casa' ? 'historial_recetas' : 'historial_recomendaciones';

    const userSnap = await db.collection('users').doc(userId).get();
    if (!userSnap.exists) {
      await interactionRef.update({ status: 'error', error: 'Usuario no encontrado' });
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const user = userSnap.data() as UserProfile;

    let historyContext = "";
    try {
      // Intentar consulta con índice
      let historySnap;
      try {
        historySnap = await db.collection(historyCol)
          .where('user_id', '==', userId)
          .orderBy('fecha_creacion', 'desc')
          .limit(5)
          .get();
      } catch (indexError: any) {
        // Fallback sin orderBy si falta el índice
        if (indexError?.message?.includes('index') || indexError?.code === 'failed-precondition') {
          console.log('⚠️ Índice faltante en historial, usando fallback');
          const allHistory = await db.collection(historyCol)
            .where('user_id', '==', userId)
            .limit(20)
            .get();
          // Ordenar manualmente
          interface HistoryDoc {
            id: string;
            data: any;
          }
          const sortedDocs: HistoryDoc[] = allHistory.docs
            .map((d: any) => ({ id: d.id, data: d.data() }))
            .sort((a: HistoryDoc, b: HistoryDoc) => {
              const aTime = a.data?.fecha_creacion?.toMillis?.() || 0;
              const bTime = b.data?.fecha_creacion?.toMillis?.() || 0;
              return bTime - aTime;
            })
            .slice(0, 5);
          historySnap = { 
            docs: sortedDocs.map(d => ({ ...d, data: () => d.data })), 
            empty: sortedDocs.length === 0 
          } as any;
        } else {
          throw indexError;
        }
      }
      
      if (!historySnap.empty) {
        const recent = historySnap.docs.map((doc: any) => {
          const d = doc.data();
          return type === 'En casa' 
            ? d.receta?.recetas?.map((r: any) => r.titulo)
            : d.recomendaciones?.map((r: any) => r.nombre_restaurante);
        }).flat().filter(Boolean);
        if (recent.length > 0) {
          historyContext = `### 🧠 MEMORIA (NO REPETIR): Recientemente recomendaste: ${recent.join(", ")}. INTENTA VARIAR Y NO REPETIR ESTOS NOMBRES.`;
        }
      }
    } catch (e: any) {
      console.log("No se pudo obtener historial:", e?.message || e);
    }

    let feedbackContext = "";
    try {
      const feedbackSnap = await db.collection('user_history')
        .where('userId', '==', userId)
        .limit(5)
        .get();
        
      if (!feedbackSnap.empty) {
        const logs = feedbackSnap.docs
          .map(d => d.data())
          .sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
          .map((data: any) => `- ${data.itemId}: ${data.rating}/5${data.comment ? ` - "${data.comment}"` : ''}`)
          .join('\n');
        feedbackContext = `### ⭐️ PREFERENCIAS BASADAS EN FEEDBACK PREVIO:\n${logs}\nUsa esto para entender qué le gusta o no al usuario.`;
      }
    } catch (e) {
      console.log("No se pudo obtener feedback:", e);
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      ],
    });

    let finalPrompt = "";
    let parsedData: any;

    if (type === 'En casa') {
      const formula = buildAirtableFormula(user);
      
      const baseId = process.env.AIRTABLE_BASE_ID?.trim();
      const tableName = process.env.AIRTABLE_TABLE_NAME?.trim();
      const apiKey = process.env.AIRTABLE_API_KEY?.trim();
      
      if (!baseId || !tableName || !apiKey) {
        throw new Error(`Missing Airtable config: BASE_ID=${!!baseId}, TABLE_NAME=${!!tableName}, API_KEY=${!!apiKey}`);
      }
      
      const airtableUrl = `https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(tableName)}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=100`;
      
      let airtableItems: AirtableIngredient[] = [];
      
      try {
        const airtableRes = await fetch(airtableUrl, {
          headers: { 
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!airtableRes.ok) {
          const errorText = await airtableRes.text();
          throw new Error(`Airtable HTTP ${airtableRes.status}: ${errorText}`);
        }
        
        const airtableData = await airtableRes.json();
        airtableItems = airtableData.records || [];
        
      } catch (airtableError: any) {
        console.error("❌ Airtable Fetch Failed:", airtableError.message);
        airtableItems = [];
      }

      const pantrySnap = await db.collection('user_pantry').where('userId', '==', userId).get();
      const pantryItems = pantrySnap.docs.map(doc => doc.data().name || "").filter(Boolean);
      
      const { priorityList, marketList, hasPantryItems } = scoreIngredients(airtableItems, pantryItems);
      
      finalPrompt = `Actúa como "Bocado", un asistente nutricional experto en medicina culinaria y ahorro.

### PERFIL CLÍNICO DEL USUARIO
* **Meta Nutricional**: ${user.nutritionalGoal || "Comer saludable"}
* **Restricciones de Salud**: ${formatList(user.diseases)}, ${formatList(user.allergies)}
* **Alimentos que NO le gustan (PROHIBIDO USAR)**: ${formatList([...ensureArray(user.dislikedFoods), ...ensureArray(request.dislikedFoods)])}
* **Ubicación**: ${user.city || "su ciudad"}, ${user.countryName || ""}

### CONTEXTO DE LA SOLICITUD
* **Tipo de comida**: ${request.mealType || "Comida principal"}
* **Tiempo disponible**: ${request.cookingTime || "30"} minutos
* **Presupuesto**: ${request.budget || "No especificado"} ${request.currency || ""}

${historyContext}

${feedbackContext}

### 🛒 GESTIÓN DE INVENTARIO
${hasPantryItems ? `El usuario tiene estos ingredientes en casa (USA ESTOS PRIMERO para ahorrar dinero):
**[ ${priorityList} ]**` : "No hay coincidencias en la despensa."}

Ingredientes adicionales seguros disponibles en el mercado:
**[ ${marketList} ]**
*(También puedes usar básicos: aceite, sal, pimienta, especias)*

### INSTRUCCIONES DE SALIDA (JSON ESTRICTO)
Genera **3 RECETAS** distintas, creativas y saludables.
Responde ÚNICAMENTE con este JSON exacto (sin markdown, sin texto extra):

{
  "saludo_personalizado": "Mensaje cálido y motivador relacionado con su meta: ${user.nutritionalGoal || 'saludable'}",
  "receta": {
    "recetas": [
      {
        "id": 1,
        "titulo": "Nombre atractivo del plato",
        "tiempo_estimado": "Ej: 25 min",
        "dificultad": "Fácil|Media|Difícil",
        "coincidencia_despensa": "Ingrediente de casa usado o 'Ninguno'",
        "ingredientes": ["cantidad + ingrediente", "..."],
        "pasos_preparacion": ["Paso 1...", "Paso 2..."],
        "macros_por_porcion": {
          "kcal": 0,
          "proteinas_g": 0,
          "carbohidratos_g": 0,
          "grasas_g": 0
        }
      }
    ]
  }
}`;

    } else {
      // CORREGIDO: Prompt mejorado para exigir direcciones específicas reales
      finalPrompt = `Actúa como "Bocado", un experto en nutrición y guía gastronómico local en ${user.city || "su ciudad"}.

### PERFIL DEL USUARIO
* **Meta Nutricional**: ${user.nutritionalGoal || "Comer saludable"}
* **Restricciones de Salud**: ${formatList(user.diseases)}, ${formatList(user.allergies)}
* **Alimentos que NO le gustan**: ${formatList([...ensureArray(user.dislikedFoods), ...ensureArray(request.dislikedFoods)])}
* **Ubicación**: ${user.city || "su ciudad"}, ${user.countryName || ""}

### SOLICITUD
El usuario quiere comer fuera.
* **Tipo de cocina/Antojo**: ${request.cravings || "Cualquier tipo saludable"}
* **Presupuesto**: ${request.budget || "No especificado"} ${request.currency || ""}

${historyContext}

${feedbackContext}

### REQUISITOS CRÍTICOS PARA RESTAURANTES:
1. USA NOMBRES REALES Y ESPECÍFICOS de restaurantes que existan en ${user.city}
2. PROPORCIONA DIRECCIONES EXACTAS: Calle, número y colonia/zona (ej: "Calle Arturo Soria 126, Chamartín")
3. Si no conoces la dirección exacta, usa la zona/centro comercial específico (ej: "Plaza Norte, local 45")
4. NO uses direcciones vagas como "Por el centro" o "Zona Rosa"
5. Verifica que el nombre + dirección corresponda a un lugar real

### EJEMPLO CORRECTO:
{
  "nombre_restaurante": "El Bund",
  "direccion_aproximada": "Calle Arturo Soria 126, Chamartín, 28043 Madrid",
  "tipo_comida": "China Saludable"
}

### EJEMPLO INCORRECTO:
{
  "nombre_restaurante": "Restaurante Chino Bueno",
  "direccion_aproximada": "Por el centro de Madrid",
  "tipo_comida": "Asiática"
}

### TAREA
Genera **5 RECOMENDACIONES** de restaurantes reales en ${user.city || "su ciudad"}.

Responde ÚNICAMENTE con este JSON exacto (sin markdown, sin texto adicional):

{
  "saludo_personalizado": "Mensaje corto y motivador",
  "ubicacion_detectada": "${user.city || "su ciudad"}, ${user.countryName || ""}",
  "recomendaciones": [
    {
      "id": 1,
      "nombre_restaurante": "Nombre exacto del lugar",
      "tipo_comida": "Ej: Italiana, Vegana, Mexicana",
      "direccion_aproximada": "Calle Número, Colonia/Zona, Ciudad (formato completo)",
      "plato_sugerido": "Nombre de un plato específico recomendado",
      "por_que_es_bueno": "Explicación de por qué encaja con su perfil",
      "hack_saludable": "Consejo práctico para pedir más saludable"
    }
  ]
}

IMPORTANTE: 
- NO incluyas el campo "link_maps", se generará automáticamente usando el nombre + dirección
- Las direcciones deben ser específicas para que Google Maps pueda ubicarlas correctamente`;
    }

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
      generationConfig: { 
        temperature: 0.7, 
        maxOutputTokens: 4096,
        responseMimeType: 'application/json' 
      },
    });

    const responseText = result.response.text();
    
    try {
      parsedData = JSON.parse(responseText);
    } catch (e) {
      const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) || 
                        responseText.match(/{[\s\S]*}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } else {
        throw new Error("No se pudo parsear la respuesta de Gemini");
      }
    }

    // ============================================
    // POST-PROCESAMIENTO PARA LINKS CLICKEABLES
    // ============================================
    if (type === 'Fuera' && parsedData.recomendaciones) {
      // Generar links válidos en el backend usando nombre + dirección + ciudad
      parsedData.recomendaciones = parsedData.recomendaciones.map((rec: any) => 
        sanitizeRecommendation(rec, user.city || "")
      );
    }

    const batch = db.batch();
    
    const historyRef = db.collection(historyCol).doc();
    batch.set(historyRef, {
      user_id: userId,
      interaction_id: interactionId,
      fecha_creacion: FieldValue.serverTimestamp(),
      tipo: type,
      ...parsedData
    });
    
    batch.update(interactionRef, {
      procesado: true,
      status: 'completed',
      completedAt: FieldValue.serverTimestamp(),
      historyDocId: historyRef.id
    });
    
    await batch.commit();

    // ============================================
    // ÉXITO: Marcar proceso como completado
    // ============================================
    await rateLimiter.completeProcess(userId);

    return res.status(200).json(parsedData);

  } catch (error: any) {
    console.error("❌ Error completo:", error);
    console.error("Stack trace:", error.stack);
    
    // Identificar tipo de error para mejor diagnóstico
    let errorMessage = error.message || "Error interno del servidor";
    let statusCode = 500;
    
    if (error?.message?.includes('index') || error?.code === 'failed-precondition') {
      errorMessage = "Error de configuración de base de datos. Contacta al administrador.";
      statusCode = 500;
    } else if (error?.message?.includes('timeout') || error?.code === 'deadline-exceeded') {
      errorMessage = "La operación tomó demasiado tiempo. Intenta de nuevo.";
      statusCode = 504;
    }
    
    // ============================================
    // ERROR: Marcar proceso como fallido (no cuenta para rate limit)
    // ============================================
    if (userId) {
      try {
        await rateLimiter.failProcess(userId, error.message);
      } catch (rlError) {
        console.error("Error actualizando rate limit:", rlError);
      }
    }
    
    if (interactionRef) {
      try {
        await interactionRef.update({
          status: 'error',
          error: error.message,
          errorDetails: error.stack?.substring(0, 1000) || '',
          errorAt: FieldValue.serverTimestamp()
        });
      } catch (e) {
        console.error("No se pudo actualizar el estado de error:", e);
      }
    }
    
    return res.status(statusCode).json({ 
      error: errorMessage,
      code: error?.code || 'UNKNOWN_ERROR'
    });
  }
}