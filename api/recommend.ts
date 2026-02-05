import { GoogleGenerativeAI } from "@google/generative-ai";
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// 1. INICIALIZACIÓN GLOBAL DE FIREBASE ADMIN
if (!getApps().length) {
  try {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
      const serviceAccount = JSON.parse(serviceAccountKey.trim());
      initializeApp({ credential: cert(serviceAccount) });
    }
  } catch (error) {
    console.error("❌ Error Firebase Init:", error);
  }
}

const db = getFirestore();

const normalizeText = (text: string) => 
  text ? text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { userId, type, mealType, cookingTime, cravings, budget, currency, _id } = req.body;
    const interactionId = _id || `int_${Date.now()}`;

    // 1. Perfil del Usuario
    const userSnap = await db.collection('users').doc(userId).get();
    const user = userSnap.exists ? userSnap.data() : {};

    // 2. Airtable (Safe mode)
    let safeIngredients = [];
    try {
      const airtableRes = await fetch(
        `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_NAME}?maxRecords=50`,
        { headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` } }
      );
      const airtableData = await airtableRes.json();
      safeIngredients = airtableData.records?.map((r: any) => r.fields.México || r.fields.Ingrediente) || [];
    } catch (e) {
      console.error("⚠️ Airtable Falló:", e);
    }

    // 3. Despensa
    let priorityList = [];
    try {
      const pantrySnap = await db.collection('user_pantry').where('userId', '==', userId).get();
      const pantryNames = pantrySnap.docs.map(doc => doc.data().name || doc.data().items || []).flat();
      priorityList = safeIngredients.filter((ing: string) => 
        pantryNames.some(p => normalizeText(ing).includes(normalizeText(p)))
      );
    } catch (e) {}

    // 4. Feedback
    let preferenceContext = "";
    try {
      const feedbackSnap = await db.collection('user_history')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc').limit(5).get();
      if (!feedbackSnap.empty) {
        const experiences = feedbackSnap.docs.map(doc => `- ${doc.data().itemId}: ${doc.data().rating}/5`).join('\n');
        preferenceContext = `\nGUSTOS RECIENTES DEL USUARIO:\n${experiences}`;
      }
    } catch (e) {}

    // 5. Prompt
    const prompt = type === 'En casa' ? `
    Actúa como "Bocado", nutricionista. Genera 3 recetas de ${mealType}.
    META: ${user?.nutritionalGoal || 'Saludable'}. TIEMPO: ${cookingTime}min.
    INGREDIENTES SEGUROS: ${safeIngredients.slice(0, 30).join(", ")}.
    USA ESTO DE DESPENSA: ${priorityList.join(", ")}.${preferenceContext}
    Responde solo JSON: {"saludo_personalizado": "..", "recetas": []}` 
    : `
    Actúa como "Bocado", guía experto en la ciudad de ${user?.city || 'su ubicación'}. Sugiere 5 restaurantes reales para: ${cravings}.
    PRESUPUESTO: ${budget} en moneda ${currency}.
    Responde solo JSON: {"saludo_personalizado": "..", "recomendaciones": []}`;

    // 6. Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "models/gemini-2.0-flash-001" });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    const startIdx = responseText.indexOf('{');
    const endIdx = responseText.lastIndexOf('}');
    const parsedData = JSON.parse(responseText.substring(startIdx, endIdx + 1));

    // 7. Guardado (CORREGIDO)
    try {
      const historyCol = type === 'En casa' ? 'historial_recetas' : 'historial_recomendaciones';
      
      const docToSave = {
        user_id: userId,
        interaction_id: interactionId, 
        fecha_creacion: FieldValue.serverTimestamp(), 
        ...parsedData
      };

      await db.collection(historyCol).add(docToSave);
      
      await db.collection('user_interactions').doc(interactionId).set({ 
        procesado: true,
        updatedAt: FieldValue.serverTimestamp() 
      }, { merge: true });

    } catch (e) {
      console.error("❌ Error Guardando:", e);
    }

    return res.status(200).json(parsedData);

  } catch (error: any) {
    console.error("❌ ERROR GENERAL:", error.message);
    return res.status(500).json({ error: error.message });
  }
}