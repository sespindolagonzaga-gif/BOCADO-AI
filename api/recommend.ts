import { GoogleGenerativeAI } from "@google/generative-ai";
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// 1. INICIALIZACIÓN GLOBAL (Fuera del handler)
if (!getApps().length) {
  try {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      console.error("❌ Error: FIREBASE_SERVICE_ACCOUNT_KEY no definida en Vercel");
    } else {
      const sanitizedKey = serviceAccountKey.trim();
      const serviceAccount = JSON.parse(sanitizedKey);
      initializeApp({ credential: cert(serviceAccount) });
      console.log("✅ Firebase Admin conectado con éxito");
    }
  } catch (error: any) {
    console.error("❌ Error crítico al parsear Service Account:", error.message);
  }
}

const db = getFirestore();

// 2. FUNCIONES DE AYUDA (Fuera del handler para limpieza)
const normalizeText = (text: string) => 
  text ? text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";

const getRootWord = (text: string) => {
  let clean = normalizeText(text);
  if (clean.length <= 3) return clean;
  if (clean.endsWith('ces')) return clean.slice(0, -3) + 'z';
  if (clean.endsWith('es')) return clean.slice(0, -2);
  if (clean.endsWith('s')) return clean.slice(0, -1);
  return clean;
};

const createRegexPattern = (text: string) => {
  const root = getRootWord(text);
  return root.replace(/a/g, '[aá]').replace(/e/g, '[eé]').replace(/i/g, '[ií]').replace(/o/g, '[oó]').replace(/u/g, '[uú]');
};

// 3. HANDLER PRINCIPAL
export default async function handler(req: any, res: any) {
  // Configuración de CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { userId, type, mealType, cookingTime, cravings, _id } = req.body;
    const interactionId = _id || `int_${Date.now()}`;
    const now = new Date().toISOString();

    // --- BLOQUE 1: Obtener Perfil del Usuario ---
    const userSnap = await db.collection('users').doc(userId).get();
    if (!userSnap.exists) throw new Error("Usuario no encontrado en la base de datos");
    const user = userSnap.data() || {};

    // --- BLOQUE 2: Filtrado Airtable ---
    let conditions = [];
    const allergies = user.allergies || [];
    const diseases = user.diseases || [];
    const dislikedFoods = [...new Set([...(user.dislikedFoods || []), ...(req.body.dislikedFoods || [])])];

    if (allergies.includes("Vegano")) conditions.push("{Vegano} = TRUE()");
    if (allergies.includes("Celíaco")) conditions.push("{Celíaco} = TRUE()");
    if (diseases.includes("Diabetes")) conditions.push("AND({Índice_glucémico} < 55, {Azúcares_totales_g} < 10)");
    if (diseases.includes("Hipertensión")) conditions.push("{Sodio_mg} < 140");
    if (diseases.includes("Colesterol")) conditions.push("AND({Colesterol_mg} < 20, {Grasas_saturadas_g} < 1.5)");

    dislikedFoods.forEach(food => {
      const pattern = createRegexPattern(food);
      conditions.push(`NOT(REGEX_MATCH(CONCATENATE({Ingrediente}, " ", {México}), '(?i)${pattern}'))`);
    });

    const airtableFormula = conditions.length > 0 ? `AND(${conditions.join(", ")})` : "TRUE()";
    
    const airtableRes = await fetch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_NAME}?filterByFormula=${encodeURIComponent(airtableFormula)}`,
      { headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` } }
    );
    const airtableData = await airtableRes.json();
    const safeIngredients = airtableData.records?.map((r: any) => r.fields.México || r.fields.Ingrediente) || [];

    // --- BLOQUE 3: Scoring de Despensa ---
    const pantrySnap = await db.collection('user_pantry').where('userId', '==', userId).get();
    const pantryNames = pantrySnap.docs.map(doc => doc.data().name || doc.data().items).flat();
    
    const priorityList = safeIngredients.filter((ing: string) => 
      pantryNames.some(p => normalizeText(ing).includes(normalizeText(p)))
    );

    // --- BLOQUE 4: Memoria ---
    const historyCol = type === 'En casa' ? 'historial_recetas' : 'historial_recomendaciones';
    const historySnap = await db.collection(historyCol).where('user_id', '==', userId).orderBy('fecha_creacion', 'desc').limit(5).get();
    const forbidden = historySnap.docs.map((doc: any) => {
      const d = doc.data();
      return type === 'En casa' ? d.receta?.recetas?.map((r: any) => r.titulo) : d.recomendaciones?.recomendaciones?.map((r: any) => r.nombre_restaurante);
    }).flat().filter(Boolean);

   // --- BLOQUE 5: Gemini IA (Prompt Inteligente) ---
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash-latest"
    });

    const prompt = type === 'En casa' ? `
Actúa como "Bocado", experto en nutrición clínica y ahorro doméstico.

### PERFIL DEL USUARIO
* **Meta Nutricional**: ${user.nutritionalGoal}
* **Condiciones Médicas**: ${diseases.join(", ") || "Ninguna"}
* **Alergias**: ${allergies.join(", ") || "Ninguna"}
* **Dislikes (PROHIBIDOS)**: ${dislikedFoods.join(", ")}

### CONTEXTO DE LA SOLICITUD
* **Ocasión**: ${mealType}
* **Tiempo disponible**: ${cookingTime} minutos

### REGLAS DE SEGURIDAD ALIMENTARIA (Airtable)
Solo puedes usar ingredientes de esta lista segura: [${safeIngredients.slice(0, 50).join(", ")}].
SI el usuario tiene Diabetes, prioriza IG < 55. SI tiene Hipertensión, Sodio < 140mg.

### SCORING DE DESPENSA (Prioridad Alta)
El usuario TIENE estos ingredientes en casa: [${priorityList.join(", ")}].
DEBES incluirlos como base principal de las recetas para maximizar el ahorro.

### MEMORIA (No repetir platos recientes)
PROHIBIDO sugerir estos nombres de platos: [${forbidden.join(", ")}].

### TAREA
Genera 3 recetas creativas y saludables. Responde ÚNICAMENTE con un objeto JSON siguiendo esta estructura:
{
  "saludo_personalizado": "Un mensaje corto, motivador y clínico sobre por qué elegiste estas recetas.",
  "recetas": [
    {
      "id": 1,
      "titulo": "Nombre creativo del plato",
      "tiempo_estimado": "${cookingTime} min",
      "dificultad": "Baja/Media",
      "coincidencia_despensa": "Ingredientes que usaste de la despensa",
      "ingredientes": ["cantidad exacta y nombre"],
      "pasos_preparacion": ["paso 1", "paso 2"],
      "macros_por_porcion": { "kcal": 0, "proteinas_g": 0, "carbohidratos_g": 0, "grasas_g": 0 }
    }
  ]
}` 
: `
Actúa como "Bocado", el guía gastronómico experto de ${user.city}.

### CONTEXTO
* **Antojo del Usuario**: ${cravings}
* **Ubicación Actual**: ${user.city}, ${user.country}
* **Restricciones Médicas**: ${diseases.join(", ")}

### MEMORIA
No sugerir estos lugares: [${forbidden.join(", ")}].

### TAREA
Sugiere 5 restaurantes reales en ${user.city} que se alineen con su meta de ${user.nutritionalGoal}.
Si no encuentras 5 reales, sugiere el TIPO de comida ideal para su salud en esa zona.
Responde ÚNICAMENTE en este JSON:
{
  "saludo_personalizado": "Mensaje cálido con recomendación sobre su antojo.",
  "recomendaciones": [
    {
      "id": 1,
      "nombre_restaurante": "Nombre real",
      "tipo_comida": "Categoría",
      "link_maps": "https://www.google.com/maps/search/?api=1&query={NombreRestaurante}+${user.city}",
      "por_que_es_bueno": "Explicación breve",
      "plato_sugerido": "Plato específico del menú que sea saludable",
      "hack_saludable": "Tip para pedir (ej: pide la salsa aparte)"
    }
  ]
}`;

    // Ejecución de la IA
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsedData = JSON.parse(responseText.replace(/```json|```/gi, "").trim());

    // --- BLOQUE 6: Guardado ---
    const finalObject = {
      user_id: userId,
      user_interactions: interactionId,
      fecha_creacion: now,
      [type === 'En casa' ? 'receta' : 'recomendaciones']: parsedData
    };

    await db.collection(historyCol).add(finalObject);
    await db.collection('user_interactions').doc(interactionId).set({ procesado: true }, { merge: true });

    return res.status(200).json(parsedData);

  } catch (error: any) {
    console.error("❌ Error en Handler:", error.message);
    return res.status(500).json({ error: error.message });
  }
}