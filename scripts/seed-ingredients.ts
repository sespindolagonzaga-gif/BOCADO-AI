/**
 * Seed script: Populates Firestore `ingredients` collection
 *
 * Usage:
 *   npx tsx scripts/seed-ingredients.ts
 *
 * Requires FIREBASE_SERVICE_ACCOUNT_KEY env var or a local serviceAccountKey.json
<<<<<<< HEAD
 *
 * This replaces the Airtable ingredients database with a Firestore collection.
=======
 * 
 * Llena la colección de ingredientes en Firestore.
>>>>>>> 74a8734 (FastApi)
 * Each document represents one ingredient with diet flags and nutrition data.
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ─── Firebase Init ───────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serviceAccount: any;
const localKeyPath = path.join(__dirname, "..", "serviceAccountKey.json");

if (fs.existsSync(localKeyPath)) {
  serviceAccount = JSON.parse(fs.readFileSync(localKeyPath, "utf-8"));
} else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
} else {
  console.error(
    "❌ No Firebase credentials found. Provide serviceAccountKey.json or FIREBASE_SERVICE_ACCOUNT_KEY env var.",
  );
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ─── Ingredient Type ────────────────────────────────────

interface Ingredient {
  /** Canonical name (used as doc ID after normalization) */
  name: string;
  /** Regional name variants */
  regional: { mx: string; es: string; us: string };
  /** Dietary compatibility flags */
  diet: {
    vegan: boolean;
    vegetarian: boolean;
    glutenFree: boolean;
    lactoseFree: boolean;
    nutFree: boolean;
  };
  /** Nutritional data per 100g (approximate) */
  nutrition: {
    glycemicIndex: number;
    sodium: number; // mg
    cholesterol: number; // mg
    iodine: number; // µg
    fiber: number; // g
    sugars: number; // g
    saturatedFat: number; // g
  };
}

// ─── Ingredients Database ───────────────────────────────
// ~130 ingredients covering all common Latin-American + Spanish cooking
// Nutritional values are per 100g, approximate from USDA/INCAP sources

const INGREDIENTS: Ingredient[] = [
  // ═══ VERDURAS ═══
  {
    name: "Tomate",
    regional: { mx: "Jitomate", es: "Tomate", us: "Tomato" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 15,
      sodium: 5,
      cholesterol: 0,
      iodine: 2,
      fiber: 1.2,
      sugars: 2.6,
      saturatedFat: 0,
    },
  },
  {
    name: "Cebolla",
    regional: { mx: "Cebolla", es: "Cebolla", us: "Onion" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 10,
      sodium: 4,
      cholesterol: 0,
      iodine: 0,
      fiber: 1.7,
      sugars: 4.2,
      saturatedFat: 0,
    },
  },
  {
    name: "Ajo",
    regional: { mx: "Ajo", es: "Ajo", us: "Garlic" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 30,
      sodium: 17,
      cholesterol: 0,
      iodine: 0,
      fiber: 2.1,
      sugars: 1.0,
      saturatedFat: 0,
    },
  },
  {
    name: "Papa",
    regional: { mx: "Papa", es: "Patata", us: "Potato" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 78,
      sodium: 6,
      cholesterol: 0,
      iodine: 4,
      fiber: 2.2,
      sugars: 0.8,
      saturatedFat: 0,
    },
  },
  {
    name: "Zanahoria",
    regional: { mx: "Zanahoria", es: "Zanahoria", us: "Carrot" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 35,
      sodium: 69,
      cholesterol: 0,
      iodine: 5,
      fiber: 2.8,
      sugars: 4.7,
      saturatedFat: 0,
    },
  },
  {
    name: "Lechuga",
    regional: { mx: "Lechuga", es: "Lechuga", us: "Lettuce" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 15,
      sodium: 28,
      cholesterol: 0,
      iodine: 1,
      fiber: 1.3,
      sugars: 0.8,
      saturatedFat: 0,
    },
  },
  {
    name: "Espinaca",
    regional: { mx: "Espinaca", es: "Espinaca", us: "Spinach" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 15,
      sodium: 79,
      cholesterol: 0,
      iodine: 12,
      fiber: 2.2,
      sugars: 0.4,
      saturatedFat: 0.1,
    },
  },
  {
    name: "Brócoli",
    regional: { mx: "Brócoli", es: "Brócoli", us: "Broccoli" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 15,
      sodium: 33,
      cholesterol: 0,
      iodine: 3,
      fiber: 2.6,
      sugars: 1.7,
      saturatedFat: 0,
    },
  },
  {
    name: "Pimiento",
    regional: { mx: "Pimiento Morrón", es: "Pimiento", us: "Bell Pepper" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 15,
      sodium: 4,
      cholesterol: 0,
      iodine: 1,
      fiber: 1.7,
      sugars: 2.4,
      saturatedFat: 0,
    },
  },
  {
    name: "Pepino",
    regional: { mx: "Pepino", es: "Pepino", us: "Cucumber" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 15,
      sodium: 2,
      cholesterol: 0,
      iodine: 3,
      fiber: 0.5,
      sugars: 1.7,
      saturatedFat: 0,
    },
  },
  {
    name: "Calabacín",
    regional: { mx: "Calabacita", es: "Calabacín", us: "Zucchini" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 15,
      sodium: 8,
      cholesterol: 0,
      iodine: 2,
      fiber: 1.0,
      sugars: 2.5,
      saturatedFat: 0.1,
    },
  },
  {
    name: "Camote",
    regional: { mx: "Camote", es: "Boniato", us: "Sweet Potato" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 54,
      sodium: 55,
      cholesterol: 0,
      iodine: 2,
      fiber: 3.0,
      sugars: 4.2,
      saturatedFat: 0,
    },
  },
  {
    name: "Elote",
    regional: { mx: "Elote", es: "Maíz", us: "Corn" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 52,
      sodium: 15,
      cholesterol: 0,
      iodine: 0,
      fiber: 2.7,
      sugars: 6.3,
      saturatedFat: 0.2,
    },
  },
  {
    name: "Chayote",
    regional: { mx: "Chayote", es: "Chayote", us: "Chayote" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 15,
      sodium: 2,
      cholesterol: 0,
      iodine: 0,
      fiber: 1.7,
      sugars: 1.7,
      saturatedFat: 0,
    },
  },
  {
    name: "Nopal",
    regional: { mx: "Nopal", es: "Nopal", us: "Cactus Paddle" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 15,
      sodium: 21,
      cholesterol: 0,
      iodine: 0,
      fiber: 3.6,
      sugars: 1.1,
      saturatedFat: 0,
    },
  },
  {
    name: "Champiñones",
    regional: { mx: "Champiñones", es: "Champiñones", us: "Mushrooms" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 15,
      sodium: 5,
      cholesterol: 0,
      iodine: 18,
      fiber: 1.0,
      sugars: 2.0,
      saturatedFat: 0,
    },
  },
  {
    name: "Berenjena",
    regional: { mx: "Berenjena", es: "Berenjena", us: "Eggplant" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 15,
      sodium: 2,
      cholesterol: 0,
      iodine: 2,
      fiber: 3.0,
      sugars: 3.5,
      saturatedFat: 0,
    },
  },
  {
    name: "Coliflor",
    regional: { mx: "Coliflor", es: "Coliflor", us: "Cauliflower" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 15,
      sodium: 30,
      cholesterol: 0,
      iodine: 9,
      fiber: 2.0,
      sugars: 1.9,
      saturatedFat: 0,
    },
  },
  {
    name: "Ejotes",
    regional: { mx: "Ejotes", es: "Judías Verdes", us: "Green Beans" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 15,
      sodium: 6,
      cholesterol: 0,
      iodine: 1,
      fiber: 2.7,
      sugars: 3.3,
      saturatedFat: 0,
    },
  },
  {
    name: "Apio",
    regional: { mx: "Apio", es: "Apio", us: "Celery" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 15,
      sodium: 80,
      cholesterol: 0,
      iodine: 1,
      fiber: 1.6,
      sugars: 1.3,
      saturatedFat: 0,
    },
  },
  {
    name: "Betabel",
    regional: { mx: "Betabel", es: "Remolacha", us: "Beet" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 64,
      sodium: 78,
      cholesterol: 0,
      iodine: 0,
      fiber: 2.8,
      sugars: 6.8,
      saturatedFat: 0,
    },
  },
  {
    name: "Chile",
    regional: { mx: "Chile", es: "Guindilla", us: "Chili Pepper" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 15,
      sodium: 9,
      cholesterol: 0,
      iodine: 0,
      fiber: 1.5,
      sugars: 5.3,
      saturatedFat: 0,
    },
  },

  // ═══ FRUTAS ═══
  {
    name: "Aguacate",
    regional: { mx: "Aguacate", es: "Aguacate", us: "Avocado" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 15,
      sodium: 7,
      cholesterol: 0,
      iodine: 1,
      fiber: 6.7,
      sugars: 0.7,
      saturatedFat: 2.1,
    },
  },
  {
    name: "Plátano",
    regional: { mx: "Plátano", es: "Plátano", us: "Banana" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 51,
      sodium: 1,
      cholesterol: 0,
      iodine: 0,
      fiber: 2.6,
      sugars: 12.2,
      saturatedFat: 0.1,
    },
  },
  {
    name: "Manzana",
    regional: { mx: "Manzana", es: "Manzana", us: "Apple" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 36,
      sodium: 1,
      cholesterol: 0,
      iodine: 0,
      fiber: 2.4,
      sugars: 10.4,
      saturatedFat: 0,
    },
  },
  {
    name: "Naranja",
    regional: { mx: "Naranja", es: "Naranja", us: "Orange" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 43,
      sodium: 0,
      cholesterol: 0,
      iodine: 1,
      fiber: 2.4,
      sugars: 9.4,
      saturatedFat: 0,
    },
  },
  {
    name: "Limón",
    regional: { mx: "Limón", es: "Limón", us: "Lime" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 20,
      sodium: 2,
      cholesterol: 0,
      iodine: 0,
      fiber: 2.8,
      sugars: 1.7,
      saturatedFat: 0,
    },
  },
  {
    name: "Fresa",
    regional: { mx: "Fresa", es: "Fresa", us: "Strawberry" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 25,
      sodium: 1,
      cholesterol: 0,
      iodine: 1,
      fiber: 2.0,
      sugars: 4.9,
      saturatedFat: 0,
    },
  },
  {
    name: "Uva",
    regional: { mx: "Uva", es: "Uva", us: "Grape" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 46,
      sodium: 2,
      cholesterol: 0,
      iodine: 0,
      fiber: 0.9,
      sugars: 16.3,
      saturatedFat: 0,
    },
  },
  {
    name: "Piña",
    regional: { mx: "Piña", es: "Piña", us: "Pineapple" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 59,
      sodium: 1,
      cholesterol: 0,
      iodine: 0,
      fiber: 1.4,
      sugars: 9.9,
      saturatedFat: 0,
    },
  },
  {
    name: "Mango",
    regional: { mx: "Mango", es: "Mango", us: "Mango" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 51,
      sodium: 1,
      cholesterol: 0,
      iodine: 0,
      fiber: 1.6,
      sugars: 13.7,
      saturatedFat: 0,
    },
  },
  {
    name: "Papaya",
    regional: { mx: "Papaya", es: "Papaya", us: "Papaya" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 60,
      sodium: 8,
      cholesterol: 0,
      iodine: 0,
      fiber: 1.7,
      sugars: 7.8,
      saturatedFat: 0,
    },
  },
  {
    name: "Sandía",
    regional: { mx: "Sandía", es: "Sandía", us: "Watermelon" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 76,
      sodium: 1,
      cholesterol: 0,
      iodine: 0,
      fiber: 0.4,
      sugars: 6.2,
      saturatedFat: 0,
    },
  },
  {
    name: "Melón",
    regional: { mx: "Melón", es: "Melón", us: "Cantaloupe" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 65,
      sodium: 16,
      cholesterol: 0,
      iodine: 0,
      fiber: 0.9,
      sugars: 7.9,
      saturatedFat: 0,
    },
  },
  {
    name: "Guayaba",
    regional: { mx: "Guayaba", es: "Guayaba", us: "Guava" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 12,
      sodium: 2,
      cholesterol: 0,
      iodine: 0,
      fiber: 5.4,
      sugars: 8.9,
      saturatedFat: 0.3,
    },
  },

  // ═══ PROTEÍNAS ANIMALES ═══
  {
    name: "Pollo",
    regional: { mx: "Pollo", es: "Pollo", us: "Chicken" },
    diet: {
      vegan: false,
      vegetarian: false,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 70,
      cholesterol: 85,
      iodine: 6,
      fiber: 0,
      sugars: 0,
      saturatedFat: 1.0,
    },
  },
  {
    name: "Res",
    regional: { mx: "Res", es: "Ternera", us: "Beef" },
    diet: {
      vegan: false,
      vegetarian: false,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 66,
      cholesterol: 90,
      iodine: 3,
      fiber: 0,
      sugars: 0,
      saturatedFat: 5.0,
    },
  },
  {
    name: "Cerdo",
    regional: { mx: "Cerdo", es: "Cerdo", us: "Pork" },
    diet: {
      vegan: false,
      vegetarian: false,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 62,
      cholesterol: 80,
      iodine: 5,
      fiber: 0,
      sugars: 0,
      saturatedFat: 4.0,
    },
  },
  {
    name: "Pescado Blanco",
    regional: { mx: "Pescado Blanco", es: "Merluza", us: "White Fish" },
    diet: {
      vegan: false,
      vegetarian: false,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 81,
      cholesterol: 50,
      iodine: 116,
      fiber: 0,
      sugars: 0,
      saturatedFat: 0.2,
    },
  },
  {
    name: "Salmón",
    regional: { mx: "Salmón", es: "Salmón", us: "Salmon" },
    diet: {
      vegan: false,
      vegetarian: false,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 59,
      cholesterol: 55,
      iodine: 50,
      fiber: 0,
      sugars: 0,
      saturatedFat: 1.5,
    },
  },
  {
    name: "Atún",
    regional: { mx: "Atún", es: "Atún", us: "Tuna" },
    diet: {
      vegan: false,
      vegetarian: false,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 39,
      cholesterol: 49,
      iodine: 50,
      fiber: 0,
      sugars: 0,
      saturatedFat: 0.4,
    },
  },
  {
    name: "Camarón",
    regional: { mx: "Camarón", es: "Gamba", us: "Shrimp" },
    diet: {
      vegan: false,
      vegetarian: false,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 111,
      cholesterol: 189,
      iodine: 35,
      fiber: 0,
      sugars: 0,
      saturatedFat: 0.3,
    },
  },
  {
    name: "Huevo",
    regional: { mx: "Huevo", es: "Huevo", us: "Egg" },
    diet: {
      vegan: false,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 142,
      cholesterol: 372,
      iodine: 27,
      fiber: 0,
      sugars: 1.1,
      saturatedFat: 3.1,
    },
  },
  {
    name: "Jamón",
    regional: { mx: "Jamón", es: "Jamón York", us: "Ham" },
    diet: {
      vegan: false,
      vegetarian: false,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 1203,
      cholesterol: 53,
      iodine: 7,
      fiber: 0,
      sugars: 1.5,
      saturatedFat: 1.6,
    },
  },
  {
    name: "Salchicha",
    regional: { mx: "Salchicha", es: "Salchicha", us: "Sausage" },
    diet: {
      vegan: false,
      vegetarian: false,
      glutenFree: false,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 28,
      sodium: 911,
      cholesterol: 70,
      iodine: 4,
      fiber: 0,
      sugars: 1.4,
      saturatedFat: 8.5,
    },
  },
  {
    name: "Carne Molida",
    regional: { mx: "Carne Molida", es: "Carne Picada", us: "Ground Beef" },
    diet: {
      vegan: false,
      vegetarian: false,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 66,
      cholesterol: 78,
      iodine: 3,
      fiber: 0,
      sugars: 0,
      saturatedFat: 6.0,
    },
  },
  {
    name: "Sardina",
    regional: { mx: "Sardina", es: "Sardina", us: "Sardine" },
    diet: {
      vegan: false,
      vegetarian: false,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 505,
      cholesterol: 142,
      iodine: 32,
      fiber: 0,
      sugars: 0,
      saturatedFat: 1.5,
    },
  },
  {
    name: "Tocino",
    regional: { mx: "Tocino", es: "Bacon", us: "Bacon" },
    diet: {
      vegan: false,
      vegetarian: false,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 1717,
      cholesterol: 110,
      iodine: 3,
      fiber: 0,
      sugars: 1.0,
      saturatedFat: 14.0,
    },
  },

  // ═══ LÁCTEOS ═══
  {
    name: "Leche",
    regional: { mx: "Leche", es: "Leche", us: "Milk" },
    diet: {
      vegan: false,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: false,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 27,
      sodium: 44,
      cholesterol: 10,
      iodine: 22,
      fiber: 0,
      sugars: 5.0,
      saturatedFat: 1.9,
    },
  },
  {
    name: "Queso",
    regional: { mx: "Queso", es: "Queso", us: "Cheese" },
    diet: {
      vegan: false,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: false,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 621,
      cholesterol: 105,
      iodine: 40,
      fiber: 0,
      sugars: 0.5,
      saturatedFat: 21.0,
    },
  },
  {
    name: "Yogur",
    regional: { mx: "Yogur", es: "Yogur", us: "Yogurt" },
    diet: {
      vegan: false,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: false,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 36,
      sodium: 46,
      cholesterol: 13,
      iodine: 63,
      fiber: 0,
      sugars: 3.2,
      saturatedFat: 1.7,
    },
  },
  {
    name: "Mantequilla",
    regional: { mx: "Mantequilla", es: "Mantequilla", us: "Butter" },
    diet: {
      vegan: false,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: false,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 11,
      cholesterol: 215,
      iodine: 26,
      fiber: 0,
      sugars: 0.1,
      saturatedFat: 51.0,
    },
  },
  {
    name: "Crema",
    regional: { mx: "Crema", es: "Nata", us: "Cream" },
    diet: {
      vegan: false,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: false,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 40,
      cholesterol: 137,
      iodine: 7,
      fiber: 0,
      sugars: 2.8,
      saturatedFat: 23.0,
    },
  },
  {
    name: "Queso Cottage",
    regional: { mx: "Requesón", es: "Requesón", us: "Cottage Cheese" },
    diet: {
      vegan: false,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: false,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 10,
      sodium: 364,
      cholesterol: 17,
      iodine: 26,
      fiber: 0,
      sugars: 2.7,
      saturatedFat: 0.6,
    },
  },
  {
    name: "Queso Oaxaca",
    regional: { mx: "Queso Oaxaca", es: "Mozzarella", us: "Mozzarella" },
    diet: {
      vegan: false,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: false,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 486,
      cholesterol: 54,
      iodine: 10,
      fiber: 0,
      sugars: 1.0,
      saturatedFat: 11.0,
    },
  },

  // ═══ GRANOS Y CEREALES ═══
  {
    name: "Arroz",
    regional: { mx: "Arroz", es: "Arroz", us: "Rice" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 73,
      sodium: 1,
      cholesterol: 0,
      iodine: 2,
      fiber: 0.4,
      sugars: 0.1,
      saturatedFat: 0.1,
    },
  },
  {
    name: "Pasta",
    regional: { mx: "Pasta", es: "Pasta", us: "Pasta" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: false,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 55,
      sodium: 1,
      cholesterol: 0,
      iodine: 3,
      fiber: 1.8,
      sugars: 0.6,
      saturatedFat: 0.2,
    },
  },
  {
    name: "Pan",
    regional: { mx: "Pan", es: "Pan", us: "Bread" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: false,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 75,
      sodium: 491,
      cholesterol: 0,
      iodine: 5,
      fiber: 2.7,
      sugars: 5.0,
      saturatedFat: 0.7,
    },
  },
  {
    name: "Avena",
    regional: { mx: "Avena", es: "Avena", us: "Oats" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: false,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 55,
      sodium: 2,
      cholesterol: 0,
      iodine: 5,
      fiber: 10.6,
      sugars: 0.9,
      saturatedFat: 1.2,
    },
  },
  {
    name: "Harina de Trigo",
    regional: { mx: "Harina", es: "Harina", us: "Wheat Flour" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: false,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 71,
      sodium: 2,
      cholesterol: 0,
      iodine: 3,
      fiber: 2.7,
      sugars: 0.3,
      saturatedFat: 0.2,
    },
  },
  {
    name: "Tortilla de Maíz",
    regional: { mx: "Tortilla", es: "Tortilla de Maíz", us: "Corn Tortilla" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 52,
      sodium: 11,
      cholesterol: 0,
      iodine: 0,
      fiber: 5.2,
      sugars: 0.6,
      saturatedFat: 0.3,
    },
  },
  {
    name: "Tortilla de Harina",
    regional: {
      mx: "Tortilla de Harina",
      es: "Tortilla de Trigo",
      us: "Flour Tortilla",
    },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: false,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 62,
      sodium: 517,
      cholesterol: 0,
      iodine: 2,
      fiber: 2.0,
      sugars: 2.8,
      saturatedFat: 2.0,
    },
  },
  {
    name: "Quinoa",
    regional: { mx: "Quinoa", es: "Quinoa", us: "Quinoa" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 53,
      sodium: 5,
      cholesterol: 0,
      iodine: 0,
      fiber: 2.8,
      sugars: 0.9,
      saturatedFat: 0.2,
    },
  },
  {
    name: "Cuscús",
    regional: { mx: "Cuscús", es: "Cuscús", us: "Couscous" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: false,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 65,
      sodium: 5,
      cholesterol: 0,
      iodine: 1,
      fiber: 1.4,
      sugars: 0.1,
      saturatedFat: 0,
    },
  },

  // ═══ LEGUMBRES ═══
  {
    name: "Frijol",
    regional: { mx: "Frijol", es: "Judía/Alubia", us: "Bean" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 29,
      sodium: 2,
      cholesterol: 0,
      iodine: 3,
      fiber: 6.4,
      sugars: 0.3,
      saturatedFat: 0.1,
    },
  },
  {
    name: "Lenteja",
    regional: { mx: "Lenteja", es: "Lenteja", us: "Lentil" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 32,
      sodium: 2,
      cholesterol: 0,
      iodine: 4,
      fiber: 7.9,
      sugars: 1.8,
      saturatedFat: 0.1,
    },
  },
  {
    name: "Garbanzo",
    regional: { mx: "Garbanzo", es: "Garbanzo", us: "Chickpea" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 28,
      sodium: 24,
      cholesterol: 0,
      iodine: 2,
      fiber: 7.6,
      sugars: 4.8,
      saturatedFat: 0.4,
    },
  },
  {
    name: "Chícharo",
    regional: { mx: "Chícharo", es: "Guisante", us: "Pea" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 48,
      sodium: 5,
      cholesterol: 0,
      iodine: 1,
      fiber: 5.1,
      sugars: 5.7,
      saturatedFat: 0.1,
    },
  },
  {
    name: "Soya",
    regional: { mx: "Soya", es: "Soja", us: "Soy" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 16,
      sodium: 1,
      cholesterol: 0,
      iodine: 16,
      fiber: 9.3,
      sugars: 3.0,
      saturatedFat: 2.9,
    },
  },
  {
    name: "Tofu",
    regional: { mx: "Tofu", es: "Tofu", us: "Tofu" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 15,
      sodium: 7,
      cholesterol: 0,
      iodine: 16,
      fiber: 0.3,
      sugars: 0.6,
      saturatedFat: 0.7,
    },
  },

  // ═══ FRUTOS SECOS Y SEMILLAS ═══
  {
    name: "Nuez",
    regional: { mx: "Nuez", es: "Nuez", us: "Walnut" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: false,
    },
    nutrition: {
      glycemicIndex: 15,
      sodium: 2,
      cholesterol: 0,
      iodine: 2,
      fiber: 6.7,
      sugars: 2.6,
      saturatedFat: 6.1,
    },
  },
  {
    name: "Almendra",
    regional: { mx: "Almendra", es: "Almendra", us: "Almond" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: false,
    },
    nutrition: {
      glycemicIndex: 15,
      sodium: 1,
      cholesterol: 0,
      iodine: 2,
      fiber: 12.5,
      sugars: 4.4,
      saturatedFat: 3.7,
    },
  },
  {
    name: "Cacahuate",
    regional: { mx: "Cacahuate", es: "Cacahuete", us: "Peanut" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: false,
    },
    nutrition: {
      glycemicIndex: 14,
      sodium: 18,
      cholesterol: 0,
      iodine: 2,
      fiber: 8.5,
      sugars: 4.7,
      saturatedFat: 6.8,
    },
  },
  {
    name: "Semilla de Girasol",
    regional: {
      mx: "Semilla de Girasol",
      es: "Pipa de Girasol",
      us: "Sunflower Seed",
    },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 35,
      sodium: 9,
      cholesterol: 0,
      iodine: 0,
      fiber: 8.6,
      sugars: 2.6,
      saturatedFat: 4.5,
    },
  },
  {
    name: "Chía",
    regional: { mx: "Chía", es: "Chía", us: "Chia Seed" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 1,
      sodium: 16,
      cholesterol: 0,
      iodine: 0,
      fiber: 34.4,
      sugars: 0,
      saturatedFat: 3.3,
    },
  },
  {
    name: "Linaza",
    regional: { mx: "Linaza", es: "Lino", us: "Flaxseed" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 30,
      cholesterol: 0,
      iodine: 0,
      fiber: 27.3,
      sugars: 1.6,
      saturatedFat: 3.7,
    },
  },

  // ═══ CONDIMENTOS Y BÁSICOS ═══
  {
    name: "Aceite de Oliva",
    regional: { mx: "Aceite de Oliva", es: "Aceite de Oliva", us: "Olive Oil" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 2,
      cholesterol: 0,
      iodine: 0,
      fiber: 0,
      sugars: 0,
      saturatedFat: 13.8,
    },
  },
  {
    name: "Aceite Vegetal",
    regional: { mx: "Aceite", es: "Aceite de Girasol", us: "Vegetable Oil" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 0,
      cholesterol: 0,
      iodine: 0,
      fiber: 0,
      sugars: 0,
      saturatedFat: 7.0,
    },
  },
  {
    name: "Sal",
    regional: { mx: "Sal", es: "Sal", us: "Salt" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 38758,
      cholesterol: 0,
      iodine: 5080,
      fiber: 0,
      sugars: 0,
      saturatedFat: 0,
    },
  },
  {
    name: "Azúcar",
    regional: { mx: "Azúcar", es: "Azúcar", us: "Sugar" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 65,
      sodium: 0,
      cholesterol: 0,
      iodine: 0,
      fiber: 0,
      sugars: 99.8,
      saturatedFat: 0,
    },
  },
  {
    name: "Miel",
    regional: { mx: "Miel", es: "Miel", us: "Honey" },
    diet: {
      vegan: false,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 58,
      sodium: 4,
      cholesterol: 0,
      iodine: 0,
      fiber: 0.2,
      sugars: 82.1,
      saturatedFat: 0,
    },
  },
  {
    name: "Vinagre",
    regional: { mx: "Vinagre", es: "Vinagre", us: "Vinegar" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 2,
      cholesterol: 0,
      iodine: 0,
      fiber: 0,
      sugars: 0,
      saturatedFat: 0,
    },
  },
  {
    name: "Salsa de Soya",
    regional: { mx: "Salsa de Soya", es: "Salsa de Soja", us: "Soy Sauce" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: false,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 5637,
      cholesterol: 0,
      iodine: 0,
      fiber: 0.8,
      sugars: 0.4,
      saturatedFat: 0,
    },
  },
  {
    name: "Mostaza",
    regional: { mx: "Mostaza", es: "Mostaza", us: "Mustard" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 1135,
      cholesterol: 0,
      iodine: 0,
      fiber: 4.0,
      sugars: 3.0,
      saturatedFat: 0.5,
    },
  },
  {
    name: "Mayonesa",
    regional: { mx: "Mayonesa", es: "Mayonesa", us: "Mayonnaise" },
    diet: {
      vegan: false,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 635,
      cholesterol: 42,
      iodine: 6,
      fiber: 0,
      sugars: 0.6,
      saturatedFat: 5.7,
    },
  },
  {
    name: "Catsup",
    regional: { mx: "Catsup", es: "Ketchup", us: "Ketchup" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 55,
      sodium: 907,
      cholesterol: 0,
      iodine: 0,
      fiber: 0.3,
      sugars: 22.8,
      saturatedFat: 0,
    },
  },

  // ═══ ESPECIAS Y HIERBAS ═══
  {
    name: "Pimienta",
    regional: { mx: "Pimienta", es: "Pimienta", us: "Black Pepper" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 20,
      cholesterol: 0,
      iodine: 0,
      fiber: 25.3,
      sugars: 0.6,
      saturatedFat: 0.5,
    },
  },
  {
    name: "Comino",
    regional: { mx: "Comino", es: "Comino", us: "Cumin" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 168,
      cholesterol: 0,
      iodine: 0,
      fiber: 10.5,
      sugars: 2.3,
      saturatedFat: 1.5,
    },
  },
  {
    name: "Orégano",
    regional: { mx: "Orégano", es: "Orégano", us: "Oregano" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 25,
      cholesterol: 0,
      iodine: 0,
      fiber: 42.5,
      sugars: 4.1,
      saturatedFat: 1.6,
    },
  },
  {
    name: "Canela",
    regional: { mx: "Canela", es: "Canela", us: "Cinnamon" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 5,
      sodium: 10,
      cholesterol: 0,
      iodine: 0,
      fiber: 53.1,
      sugars: 2.2,
      saturatedFat: 0.3,
    },
  },
  {
    name: "Cilantro",
    regional: { mx: "Cilantro", es: "Cilantro", us: "Cilantro" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 46,
      cholesterol: 0,
      iodine: 0,
      fiber: 2.8,
      sugars: 0.9,
      saturatedFat: 0,
    },
  },
  {
    name: "Perejil",
    regional: { mx: "Perejil", es: "Perejil", us: "Parsley" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 56,
      cholesterol: 0,
      iodine: 0,
      fiber: 3.3,
      sugars: 0.9,
      saturatedFat: 0.1,
    },
  },
  {
    name: "Laurel",
    regional: { mx: "Laurel", es: "Laurel", us: "Bay Leaf" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 23,
      cholesterol: 0,
      iodine: 0,
      fiber: 26.3,
      sugars: 0,
      saturatedFat: 2.3,
    },
  },
  {
    name: "Cúrcuma",
    regional: { mx: "Cúrcuma", es: "Cúrcuma", us: "Turmeric" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 38,
      cholesterol: 0,
      iodine: 0,
      fiber: 21.1,
      sugars: 3.2,
      saturatedFat: 3.1,
    },
  },
  {
    name: "Jengibre",
    regional: { mx: "Jengibre", es: "Jengibre", us: "Ginger" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 13,
      cholesterol: 0,
      iodine: 0,
      fiber: 2.0,
      sugars: 1.7,
      saturatedFat: 0,
    },
  },
  {
    name: "Chile en Polvo",
    regional: {
      mx: "Chile en Polvo",
      es: "Pimentón Picante",
      us: "Chili Powder",
    },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 1010,
      cholesterol: 0,
      iodine: 0,
      fiber: 34.8,
      sugars: 7.2,
      saturatedFat: 2.5,
    },
  },

  // ═══ ENLATADOS Y PROCESADOS ═══
  {
    name: "Tomate Enlatado",
    regional: { mx: "Tomate Frito", es: "Tomate Frito", us: "Canned Tomato" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 30,
      sodium: 132,
      cholesterol: 0,
      iodine: 0,
      fiber: 1.2,
      sugars: 3.6,
      saturatedFat: 0,
    },
  },
  {
    name: "Pasta de Tomate",
    regional: {
      mx: "Puré de Tomate",
      es: "Concentrado de Tomate",
      us: "Tomato Paste",
    },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 35,
      sodium: 24,
      cholesterol: 0,
      iodine: 0,
      fiber: 4.1,
      sugars: 12.2,
      saturatedFat: 0.2,
    },
  },
  {
    name: "Caldo de Pollo",
    regional: {
      mx: "Caldo de Pollo",
      es: "Caldo de Pollo",
      us: "Chicken Broth",
    },
    diet: {
      vegan: false,
      vegetarian: false,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 343,
      cholesterol: 3,
      iodine: 1,
      fiber: 0,
      sugars: 0.2,
      saturatedFat: 0.1,
    },
  },
  {
    name: "Leche de Coco",
    regional: { mx: "Leche de Coco", es: "Leche de Coco", us: "Coconut Milk" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 15,
      cholesterol: 0,
      iodine: 0,
      fiber: 0,
      sugars: 2.8,
      saturatedFat: 16.0,
    },
  },
  {
    name: "Leche Evaporada",
    regional: {
      mx: "Leche Evaporada",
      es: "Leche Evaporada",
      us: "Evaporated Milk",
    },
    diet: {
      vegan: false,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: false,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 31,
      sodium: 100,
      cholesterol: 29,
      iodine: 28,
      fiber: 0,
      sugars: 10.0,
      saturatedFat: 4.9,
    },
  },

  // ═══ BEBIDAS ═══
  {
    name: "Café",
    regional: { mx: "Café", es: "Café", us: "Coffee" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 2,
      cholesterol: 0,
      iodine: 0,
      fiber: 0,
      sugars: 0,
      saturatedFat: 0,
    },
  },
  {
    name: "Té",
    regional: { mx: "Té", es: "Té", us: "Tea" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 3,
      cholesterol: 0,
      iodine: 0,
      fiber: 0,
      sugars: 0,
      saturatedFat: 0,
    },
  },
  {
    name: "Chocolate en Polvo",
    regional: {
      mx: "Chocolate en Polvo",
      es: "Cacao en Polvo",
      us: "Cocoa Powder",
    },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 30,
      sodium: 21,
      cholesterol: 0,
      iodine: 0,
      fiber: 33.2,
      sugars: 1.8,
      saturatedFat: 8.1,
    },
  },

  // ═══ OTROS ═══
  {
    name: "Chocolate",
    regional: { mx: "Chocolate", es: "Chocolate", us: "Chocolate" },
    diet: {
      vegan: false,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: false,
      nutFree: false,
    },
    nutrition: {
      glycemicIndex: 40,
      sodium: 24,
      cholesterol: 8,
      iodine: 10,
      fiber: 3.4,
      sugars: 48.0,
      saturatedFat: 18.5,
    },
  },
  {
    name: "Gelatina",
    regional: { mx: "Gelatina", es: "Gelatina", us: "Gelatin" },
    diet: {
      vegan: false,
      vegetarian: false,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 32,
      cholesterol: 0,
      iodine: 0,
      fiber: 0,
      sugars: 0,
      saturatedFat: 0,
    },
  },
  {
    name: "Levadura",
    regional: { mx: "Levadura", es: "Levadura", us: "Yeast" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 51,
      cholesterol: 0,
      iodine: 0,
      fiber: 26.5,
      sugars: 0,
      saturatedFat: 0.2,
    },
  },
  {
    name: "Polvo para Hornear",
    regional: { mx: "Polvo para Hornear", es: "Impulsor", us: "Baking Powder" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 10600,
      cholesterol: 0,
      iodine: 0,
      fiber: 0,
      sugars: 0,
      saturatedFat: 0,
    },
  },
  {
    name: "Maicena",
    regional: { mx: "Maicena", es: "Maizena", us: "Cornstarch" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 85,
      sodium: 9,
      cholesterol: 0,
      iodine: 0,
      fiber: 0.9,
      sugars: 0,
      saturatedFat: 0,
    },
  },
  {
    name: "Panela",
    regional: { mx: "Piloncillo", es: "Panela", us: "Raw Cane Sugar" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 65,
      sodium: 28,
      cholesterol: 0,
      iodine: 0,
      fiber: 0,
      sugars: 90.0,
      saturatedFat: 0,
    },
  },
  {
    name: "Leche de Almendra",
    regional: {
      mx: "Leche de Almendra",
      es: "Bebida de Almendra",
      us: "Almond Milk",
    },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: false,
    },
    nutrition: {
      glycemicIndex: 25,
      sodium: 72,
      cholesterol: 0,
      iodine: 0,
      fiber: 0.5,
      sugars: 3.4,
      saturatedFat: 0.2,
    },
  },
  {
    name: "Leche de Avena",
    regional: { mx: "Leche de Avena", es: "Bebida de Avena", us: "Oat Milk" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: false,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 69,
      sodium: 42,
      cholesterol: 0,
      iodine: 0,
      fiber: 0.8,
      sugars: 4.0,
      saturatedFat: 0.2,
    },
  },
  {
    name: "Chipotle",
    regional: { mx: "Chipotle", es: "Chile Chipotle", us: "Chipotle" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 15,
      sodium: 1560,
      cholesterol: 0,
      iodine: 0,
      fiber: 3.3,
      sugars: 2.0,
      saturatedFat: 0.1,
    },
  },
  {
    name: "Achiote",
    regional: { mx: "Achiote", es: "Achiote", us: "Annatto" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 4,
      cholesterol: 0,
      iodine: 0,
      fiber: 12.0,
      sugars: 3.5,
      saturatedFat: 0.8,
    },
  },
  {
    name: "Epazote",
    regional: { mx: "Epazote", es: "Epazote", us: "Epazote" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 0,
      sodium: 43,
      cholesterol: 0,
      iodine: 0,
      fiber: 3.8,
      sugars: 0.5,
      saturatedFat: 0.1,
    },
  },
  {
    name: "Amaranto",
    regional: { mx: "Amaranto", es: "Amaranto", us: "Amaranth" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 35,
      sodium: 4,
      cholesterol: 0,
      iodine: 0,
      fiber: 6.7,
      sugars: 1.7,
      saturatedFat: 1.5,
    },
  },
  {
    name: "Pepita de Calabaza",
    regional: { mx: "Pepita", es: "Semilla de Calabaza", us: "Pumpkin Seed" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 10,
      sodium: 7,
      cholesterol: 0,
      iodine: 0,
      fiber: 6.0,
      sugars: 1.4,
      saturatedFat: 8.7,
    },
  },
  {
    name: "Jícama",
    regional: { mx: "Jícama", es: "Jícama", us: "Jicama" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 12,
      sodium: 4,
      cholesterol: 0,
      iodine: 0,
      fiber: 4.9,
      sugars: 1.8,
      saturatedFat: 0,
    },
  },
  {
    name: "Tostada",
    regional: { mx: "Tostada", es: "Tostada de Maíz", us: "Tostada Shell" },
    diet: {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: true,
      nutFree: true,
    },
    nutrition: {
      glycemicIndex: 64,
      sodium: 189,
      cholesterol: 0,
      iodine: 0,
      fiber: 5.6,
      sugars: 0.5,
      saturatedFat: 1.2,
    },
  },
];

// ─── Normalize doc ID ────────────────────────────────────

function normalizeId(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

// ─── Seed ────────────────────────────────────────────────

async function seed() {
  const COLLECTION = "ingredients";
  const BATCH_SIZE = 400; // Firestore batch limit is 500

  console.log(
    `\n🌱 Seeding ${INGREDIENTS.length} ingredients into Firestore collection '${COLLECTION}'...\n`,
  );

  let batch = db.batch();
  let count = 0;

  for (const ingredient of INGREDIENTS) {
    const docId = normalizeId(ingredient.name);
    const ref = db.collection(COLLECTION).doc(docId);

    batch.set(ref, {
      name: ingredient.name,
      regional: ingredient.regional,
      diet: ingredient.diet,
      nutrition: ingredient.nutrition,
      _createdAt: FieldValue.serverTimestamp(),
    });

    count++;

    if (count % BATCH_SIZE === 0) {
      await batch.commit();
      console.log(`  ✅ Committed batch (${count}/${INGREDIENTS.length})`);
      batch = db.batch();
    }
  }

  // Commit remaining
  if (count % BATCH_SIZE !== 0) {
    await batch.commit();
  }

  console.log(`\n✅ Done! Seeded ${count} ingredients.`);
  console.log(`\n📊 Breakdown:`);

  const vegan = INGREDIENTS.filter((i) => i.diet.vegan).length;
  const vegetarian = INGREDIENTS.filter((i) => i.diet.vegetarian).length;
  const glutenFree = INGREDIENTS.filter((i) => i.diet.glutenFree).length;
  const lactoseFree = INGREDIENTS.filter((i) => i.diet.lactoseFree).length;
  const nutFree = INGREDIENTS.filter((i) => i.diet.nutFree).length;

  console.log(`  🌱 Vegan:       ${vegan}/${count}`);
  console.log(`  🥦 Vegetarian:  ${vegetarian}/${count}`);
  console.log(`  🌾 Gluten-free: ${glutenFree}/${count}`);
  console.log(`  🥛 Lactose-free:${lactoseFree}/${count}`);
  console.log(`  🥜 Nut-free:    ${nutFree}/${count}`);

  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
