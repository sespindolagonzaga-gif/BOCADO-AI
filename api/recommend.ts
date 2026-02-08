import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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
// 6. RATE LIMITING ROBUSTO (LIMPIA ATASCOS)
// ============================================

async function checkRateLimit(userId: string): Promise<{ allowed: boolean; secondsLeft?: number; error?: string }> {
  try {
    const recentSnap = await db.collection('user_interactions')
      .where('userId', '==', userId)
      .where('createdAt', '>', new Date(Date.now() - 10 * 60 * 1000))
      .get();
    
    const now = Date.now();
    const COOLDOWN = 30000;
    const STUCK_THRESHOLD = 120000;
    
    let hasActiveProcess = false;
    let lastCompletedTime = 0;
    
    for (const doc of recentSnap.docs) {
      const data = doc.data();
      const status = data.status;
      const createdAt = data.createdAt?.toMillis() || 0;
      
      if (status === 'processing') {
        if (now - createdAt > STUCK_THRESHOLD) {
          console.log(`🧹 Limpiando proceso atascado ${doc.id} (${Math.round((now - createdAt)/1000)}s)`);
          await doc.ref.update({ 
            status: 'timeout', 
            error: 'Auto-cleanup: proceso atascado',
            cleanedAt: FieldValue.serverTimestamp()
          });
        } else {
          hasActiveProcess = true;
        }
      }
      
      if (status === 'completed' || status === 'error' || status === 'timeout') {
        if (createdAt > lastCompletedTime) {
          lastCompletedTime = createdAt;
        }
      }
    }
    
    if (hasActiveProcess) {
      return { allowed: false, secondsLeft: 30, error: 'Ya estás generando una recomendación. Espera un momento.' };
    }
    
    if (lastCompletedTime > 0 && now - lastCompletedTime < COOLDOWN) {
      const secondsLeft = Math.ceil((COOLDOWN - (now - lastCompletedTime)) / 1000);
      return { allowed: false, secondsLeft, error: `Espera ${secondsLeft} segundos antes de generar otra recomendación.` };
    }
    
    return { allowed: true };
  } catch (error: any) {
    console.error('Rate limit check error:', error);
    return { allowed: true };
  }
}

// ============================================
// 7. UTILIDAD PARA GENERAR LINKS DE MAPS
// ============================================

const generateMapsLink = (restaurantName: string, city: string): string => {
  // Limpiar y codificar correctamente
  const cleanName = restaurantName.replace(/[^\w\s-]/g, '').trim();
  const cleanCity = (city || '').replace(/[^\w\s-]/g, '').trim();
  const query = encodeURIComponent(`${cleanName} ${cleanCity}`.trim());
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
};

const sanitizeRecommendation = (rec: any, city: string) => {
  // Asegurar que el link de Maps sea válido y no tenga espacios
  if (rec.nombre_restaurante) {
    rec.link_maps = generateMapsLink(rec.nombre_restaurante, city);
  }
  
  // Asegurar que no haya campos undefined que rompan el frontend
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  let interactionRef: FirebaseFirestore.DocumentReference | null = null;

  try {
    const request: RequestBody = req.body;
    const { userId, type, _id } = request;
    const interactionId = _id || `int_${Date.now()}`;

    if (!userId) return res.status(400).json({ error: 'userId requerido' });
    if (!type || !['En casa', 'Fuera'].includes(type)) {
      return res.status(400).json({ error: 'type debe ser "En casa" o "Fuera"' });
    }

    const rateCheck = await checkRateLimit(userId);
    if (!rateCheck.allowed) {
      return res.status(429).json({ 
        error: rateCheck.error,
        retryAfter: rateCheck.secondsLeft 
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
      const historySnap = await db.collection(historyCol)
        .where('user_id', '==', userId)
        .orderBy('fecha_creacion', 'desc')
        .limit(5)
        .get();
      
      if (!historySnap.empty) {
        const recent = historySnap.docs.map(doc => {
          const d = doc.data();
          return type === 'En casa' 
            ? d.receta?.recetas?.map((r: any) => r.titulo)
            : d.recomendaciones?.map((r: any) => r.nombre_restaurante);
        }).flat().filter(Boolean);
        if (recent.length > 0) {
          historyContext = `### 🧠 MEMORIA (NO REPETIR): Recientemente recomendaste: ${recent.join(", ")}. INTENTA VARIAR Y NO REPETIR ESTOS NOMBRES.`;
        }
      }
    } catch (e) {
      console.log("No se pudo obtener historial:", e);
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
      
      // CORREGIDO: Eliminado el espacio después de v0/
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
      // CORREGIDO: Prompt simplificado sin intentar ejecutar JS en el template
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

### TAREA
Genera **5 RECOMENDACIONES** de restaurantes reales o tipos de cocina específicos en ${user.city || "su ciudad"}.

Responde ÚNICAMENTE con este JSON exacto (sin markdown, sin texto adicional):

{
  "saludo_personalizado": "Mensaje corto y motivador",
  "ubicacion_detectada": "${user.city || "su ciudad"}, ${user.countryName || ""}",
  "recomendaciones": [
    {
      "id": 1,
      "nombre_restaurante": "Nombre exacto del lugar para búsqueda",
      "tipo_comida": "Ej: Italiana, Vegana, Mexicana",
      "direccion_aproximada": "Zona o dirección aproximada",
      "por_que_es_bueno": "Explicación de por qué encaja con su perfil",
      "plato_sugerido": "Nombre de un plato específico recomendado",
      "hack_saludable": "Consejo práctico para pedir más saludable"
    }
  ]
}

IMPORTANTE: 
- NO incluyas el campo "link_maps", se generará automáticamente
- Usa nombres de restaurantes reales y específicos de ${user.city}
- Si no conoces nombres exactos, sugiere tipos de restaurante muy específicos (ej: "Restaurante de comida india vegana en Zona Rosa")`;
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
      // Generar links válidos en el backend
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

    return res.status(200).json(parsedData);

  } catch (error: any) {
    console.error("❌ Error completo:", error);
    
    if (interactionRef) {
      try {
        await interactionRef.update({
          status: 'error',
          error: error.message,
          errorAt: FieldValue.serverTimestamp()
        });
      } catch (e) {
        console.error("No se pudo actualizar el estado de error:", e);
      }
    }
    
    return res.status(500).json({ 
      error: error.message || "Error interno del servidor" 
    });
  }
}