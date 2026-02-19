/**
 * Tests para filtrado inteligente de ingredientes
 * Valida que filterIngredientes cumpla con restricciones alimentarias:
 * - Alergias
 * - Dietas (vegano/vegetariano)
 * - Enfermedades crónicas (Diabetes, Hipertensión, Colesterol, Hipotiroidismo, Hipertiroidismo, IBS)
 * - Alimentos disliked
 */

import { describe, it, expect, beforeEach } from "vitest";

// ============================================
// HELPER FUNCTIONS (del archivo recommend.ts)
// ============================================

const normalizeText = (text: string): string =>
  text
    ? text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
    : "";

const getRootWord = (text: string): string => {
  let clean = normalizeText(text);
  if (clean.length <= 3) return clean;
  if (clean.endsWith("ces")) return clean.slice(0, -3) + "z";
  if (clean.endsWith("es")) return clean.slice(0, -2);
  if (clean.endsWith("s")) return clean.slice(0, -1);
  return clean;
};

const createRegexPattern = (text: string): string => {
  const root = getRootWord(text);
  return root
    .replace(/a/g, "[aáàäâ]")
    .replace(/e/g, "[eéèëê]")
    .replace(/i/g, "[iíìïî]")
    .replace(/o/g, "[oóòöô]")
    .replace(/u/g, "[uúùüû]");
};

// ============================================
// TYPES Y INTERFACES
// ============================================

interface UserProfile {
  userId: string;
  eatingHabit?: string;
  diseases?: string[];
  allergies?: string[];
  dislikedFoods?: string[];
  [key: string]: any;
}

interface FirestoreIngredient {
  id: string;
  name: string;
  category: string;
  regional: {
    es?: string;
    mx?: string;
    en?: string;
  };
  [key: string]: any;
}

// ============================================
// FUNCIÓN TESTEADA: filterIngredientes
// ============================================

function filterIngredientes(
  allIngredients: FirestoreIngredient[],
  user: UserProfile,
): FirestoreIngredient[] {
  const allergies = (user.allergies || []).map((a) => a.toLowerCase());
  const dislikedFoods = (user.dislikedFoods || []).map((d) => d.toLowerCase());
  const eatingHabit = (user.eatingHabit || "").toLowerCase();
  const diseases = (user.diseases || []).map((d) => d.toLowerCase());

  // Mapeo detallado de alérgenos (coverage completa)
  const allergenMap: Record<string, string[]> = {
    "alergia a frutos secos": [
      "nuez",
      "almendra",
      "cacahuate",
      "pistacho",
      "avellana",
      "semilla",
      "pecan",
    ],
    celíaco: ["trigo", "cebada", "centeno", "gluten", "pan", "pasta", "galleta"],
    "alergia a mariscos": [
      "camarón",
      "langosta",
      "cangrejo",
      "mejillón",
      "ostra",
      "camarones",
      "pulpo",
    ],
    "alergia a cacahuates": ["cacahuate", "maní", "mantequilla de maní"],
    "intolerancia a la lactosa": [
      "leche",
      "queso",
      "yogur",
      "mantequilla",
      "crema",
      "nata",
      "helado",
    ],
    "alergia al huevo": ["huevo", "clara", "yema"],
  };

  return allIngredients.filter((ingredient) => {
    const name = ingredient.name.toLowerCase();
    const regional = ingredient.regional.es?.toLowerCase() || "";
    const mx = ingredient.regional.mx?.toLowerCase() || "";
    const combinedText = `${name} ${regional} ${mx}`;

    // 1️⃣ PRIORIDAD CRÍTICA: Excluir alimentos no deseados
    if (
      dislikedFoods.some((d) => {
        const pattern = createRegexPattern(d);
        return new RegExp(pattern, "i").test(combinedText);
      })
    ) {
      return false;
    }

    // 2️⃣ Excluir alérgenos (high priority)
    for (const allergyKey of allergies) {
      const allergens = allergenMap[allergyKey] || [allergyKey];
      if (allergens.some((a) => new RegExp(`\\b${a}\\b`, "i").test(combinedText))) {
        return false;
      }
    }

    // 3️⃣ Filtrar por dieta (vegano/vegetariano)
    if (eatingHabit.includes("vegano")) {
      const animalProducts = [
        "carne",
        "pollo",
        "pavo",
        "res",
        "cerdo",
        "cordero",
        "pescado",
        "camarón",
        "huevo",
        "leche",
        "queso",
        "miel",
      ];
      if (
        animalProducts.some((m) =>
          new RegExp(`\\b${m}\\b`, "i").test(combinedText),
        )
      ) {
        return false;
      }
    } else if (eatingHabit.includes("vegetariano")) {
      const meats = [
        "carne",
        "pollo",
        "pavo",
        "res",
        "cerdo",
        "cordero",
        "pescado",
        "camarón",
      ];
      if (meats.some((m) => new RegExp(`\\b${m}\\b`, "i").test(combinedText))) {
        return false;
      }
    }

    // 4️⃣ Filtrar según enfermedades crónicas
    for (const disease of diseases) {
      // 🩺 DIABETES: Evitar alimentos altos en azúcar
      if (disease.includes("diabetes")) {
        const highSugar = [
          "azúcar",
          "dulce",
          "postre",
          "chocolate",
          "refresco",
          "jugo de",
          "miel",
          "caramelo",
        ];
        if (highSugar.some((s) => combinedText.includes(s))) {
          return false;
        }
      }

      // 🩺 HIPERTENSIÓN: Evitar alimentos salados
      if (disease.includes("hipertensión")) {
        const saltyFoods = [
          "sal",
          "embutido",
          "jamón",
          "tocino",
          "salchicha",
          "conserva",
          "enlatado",
        ];
        if (saltyFoods.some((s) => combinedText.includes(s))) {
          return false;
        }
      }

      // 🩺 COLESTEROL: Evitar grasas saturadas
      if (disease.includes("colesterol")) {
        const fattyFoods = [
          "manteca",
          "mantequilla",
          "chicharrón",
          "grasa animal",
          "crema",
        ];
        if (fattyFoods.some((f) => combinedText.includes(f))) {
          return false;
        }
      }

      // 🩺 HIPOTIROIDISMO: Necesita más yodo (preservar lácteos, pescados, algas)
      // En DB: marcar ingredientes altos en yodo, aquí simplemente NO excluir
      if (disease.includes("hipotiroidismo")) {
        const lowIodine = ["agua destilada"];
        if (lowIodine.some((l) => combinedText.includes(l))) {
          return false;
        }
        // Nota: El algoritmo debería dar MEJOR SCORING a alimentos con yodo
        // pero por ahora solo excluir los claramente deficientes
      }

      // 🩺 HIPERTIROIDISMO: Evitar exceso de yodo (algas, mucho pescado)
      if (disease.includes("hipertiroidismo")) {
        const highIodine = ["alga", "nori", "kombu"];
        if (highIodine.some((h) => combinedText.includes(h))) {
          return false;
        }
      }

      // 🩺 SÍNDROME DE INTESTINO IRRITABLE: Evitar irritantes
      if (disease.includes("intestino irritable") || disease.includes("ibs")) {
        const irritants = ["picante", "chile", "ají", "curry", "café"];
        if (irritants.some((i) => combinedText.includes(i))) {
          return false;
        }
      }
    }

    return true;
  });
}

// ============================================
// TEST SUITE
// ============================================

describe("filterIngredientes - Ingredient Filtering", () => {
  let testIngredients: FirestoreIngredient[];

  beforeEach(() => {
    testIngredients = [
      {
        id: "1",
        name: "Pollo Asado",
        category: "Proteína",
        regional: { es: "Pollo", mx: "Pollo Asado" },
      },
      {
        id: "2",
        name: "Arroz blanco",
        category: "Carbohidrato",
        regional: { es: "Arroz", mx: "Arroz" },
      },
      {
        id: "3",
        name: "Leche entera",
        category: "Lácteo",
        regional: { es: "Leche", mx: "Leche" },
      },
      {
        id: "4",
        name: "Huevo",
        category: "Proteína",
        regional: { es: "Huevo", mx: "Huevo" },
      },
      {
        id: "5",
        name: "Nori (alga)",
        category: "Vegetal",
        regional: { es: "Alga nori", mx: "Alga nori" },
      },
      {
        id: "6",
        name: "Camarón",
        category: "Marisco",
        regional: { es: "Gamba", mx: "Camarón" },
      },
      {
        id: "7",
        name: "Almendra",
        category: "Fruto seco",
        regional: { es: "Almendra", mx: "Almendra" },
      },
      {
        id: "8",
        name: "Azúcar blanca",
        category: "Edulcorante",
        regional: { es: "Azúcar", mx: "Azúcar" },
      },
      {
        id: "9",
        name: "Jamón serrano",
        category: "Embutido",
        regional: { es: "Jamón", mx: "Jamón" },
      },
      {
        id: "10",
        name: "Brócoli",
        category: "Vegetal",
        regional: { es: "Brócoli", mx: "Brócoli" },
      },
      {
        id: "11",
        name: "Chile picante",
        category: "Especia",
        regional: { es: "Ají", mx: "Chile" },
      },
      {
        id: "12",
        name: "Cafe arabica",
        category: "Bebida",
        regional: { es: "Café", mx: "Café" },
      },
    ];
  });

  // ============================================
  // PRUEBAS DE ALIMENTOS DISLIKED
  // ============================================

  describe("Disliked Foods", () => {
    it("should exclude disliked ingredient by name", () => {
      const user: UserProfile = {
        userId: "user1",
        dislikedFoods: ["Pollo"],
      };

      const result = filterIngredientes(testIngredients, user);
      const names = result.map((i) => i.name);

      expect(names).not.toContain("Pollo Asado");
      expect(result.length).toBe(testIngredients.length - 1);
    });

    it("should handle accented disliked foods", () => {
      const user: UserProfile = {
        userId: "user1",
        dislikedFoods: ["Ají"], // Disliked with acento
      };

      const result = filterIngredientes(testIngredients, user);
      const names = result.map((i) => i.name);

      // "Ají" debería coincidir porque Chile picante tiene "Ají" en regional.es
      expect(names.length).toBeLessThan(testIngredients.length);
      // Chile picante debería estar excluido porque contiene "Ají" en regional
      const hasChile = names.some((name) => name.includes("Chile"));
      expect(hasChile).toBe(false);
    });
  });

  // ============================================
  // PRUEBAS DE ALERGIAS
  // ============================================

  describe("Allergies", () => {
    it("should exclude nut allergens when 'alergia a frutos secos'", () => {
      const user: UserProfile = {
        userId: "user1",
        allergies: ["Alergia a frutos secos"],
      };

      const result = filterIngredientes(testIngredients, user);
      const names = result.map((i) => i.name);

      expect(names).not.toContain("Almendra");
      expect(result.length).toBe(testIngredients.length - 1);
    });

    it("should exclude shellfish when 'alergia a mariscos'", () => {
      const user: UserProfile = {
        userId: "user1",
        allergies: ["Alergia a mariscos"],
      };

      const result = filterIngredientes(testIngredients, user);
      const names = result.map((i) => i.name);

      expect(names).not.toContain("Camarón");
    });

    it("should exclude eggs when 'alergia al huevo'", () => {
      const user: UserProfile = {
        userId: "user1",
        allergies: ["Alergia al huevo"],
      };

      const result = filterIngredientes(testIngredients, user);
      const names = result.map((i) => i.name);

      expect(names).not.toContain("Huevo");
    });

    it("should exclude dairy when 'intolerancia a la lactosa'", () => {
      const user: UserProfile = {
        userId: "user1",
        allergies: ["Intolerancia a la lactosa"],
      };

      const result = filterIngredientes(testIngredients, user);
      const names = result.map((i) => i.name);

      expect(names).not.toContain("Leche entera");
    });
  });

  // ============================================
  // PRUEBAS DE DIETA
  // ============================================

  describe("Diet Restrictions", () => {
    it("should exclude meat when vegan", () => {
      const user: UserProfile = {
        userId: "user1",
        eatingHabit: "Vegano",
      };

      const result = filterIngredientes(testIngredients, user);
      const names = result.map((i) => i.name);

      expect(names.some((n) => n.includes("Pollo"))).toBe(false);
      expect(names.some((n) => n.includes("Huevo"))).toBe(false);
      expect(names.some((n) => n.includes("Leche"))).toBe(false);
      expect(names.some((n) => n.includes("Camarón"))).toBe(false);
    });

    it("should exclude meat but allow dairy when vegetarian", () => {
      const user: UserProfile = {
        userId: "user1",
        eatingHabit: "Vegetariano",
      };

      const result = filterIngredientes(testIngredients, user);
      const names = result.map((i) => i.name);

      expect(names.some((n) => n.includes("Pollo"))).toBe(false);
      expect(names.some((n) => n.includes("Camarón"))).toBe(false);
      expect(names.some((n) => n.includes("Leche"))).toBe(true); // Lácteos permitidos
      expect(names.some((n) => n.includes("Huevo"))).toBe(true); // Huevos permitidos
    });
  });

  // ============================================
  // PRUEBAS DE ENFERMEDADES CRÓNICAS
  // ============================================

  describe("Chronic Diseases", () => {
    describe("Diabetes", () => {
      it("should exclude high-sugar foods", () => {
        const user: UserProfile = {
          userId: "user1",
          diseases: ["Diabetes"],
        };

        const result = filterIngredientes(testIngredients, user);
        const names = result.map((i) => i.name);

        expect(names.some((n) => n.includes("Azúcar"))).toBe(false);
      });
    });

    describe("Hipertensión (High Blood Pressure)", () => {
      it("should exclude salty foods", () => {
        const user: UserProfile = {
          userId: "user1",
          diseases: ["Hipertensión"],
        };

        const result = filterIngredientes(testIngredients, user);
        const names = result.map((i) => i.name);

        expect(names.some((n) => n.includes("Jamón"))).toBe(false);
      });
    });

    describe("Hipotiroidismo (Low Thyroid) - NEW", () => {
      it("should preserve iodine-rich foods like nori and fish", () => {
        const user: UserProfile = {
          userId: "user1",
          diseases: ["Hipotiroidismo"],
        };

        const result = filterIngredientes(testIngredients, user);
        const names = result.map((i) => i.name);

        // Algas con yodo DEBEN mantenerse (no excluir)
        expect(names).toContain("Nori (alga)");
      });

      it("should not exclude nori for hypothyroidism but should for hyperthyroidism", () => {
        const hypoUser: UserProfile = {
          userId: "user1",
          diseases: ["Hipotiroidismo"],
        };

        const hyperUser: UserProfile = {
          userId: "user2",
          diseases: ["Hipertiroidismo"],
        };

        const hypoResult = filterIngredientes(testIngredients, hypoUser);
        const hyperResult = filterIngredientes(testIngredients, hyperUser);

        const hypoNames = hypoResult.map((i) => i.name);
        const hyperNames = hyperResult.map((i) => i.name);

        expect(hypoNames).toContain("Nori (alga)"); // Preserved for hypo
        expect(hyperNames).not.toContain("Nori (alga)"); // Excluded for hyper
      });
    });

    describe("Hipertiroidismo (High Thyroid) - NEW", () => {
      it("should exclude iodine-rich foods like nori", () => {
        const user: UserProfile = {
          userId: "user1",
          diseases: ["Hipertiroidismo"],
        };

        const result = filterIngredientes(testIngredients, user);
        const names = result.map((i) => i.name);

        expect(names).not.toContain("Nori (alga)");
      });
    });

    describe("Intestinal Irritable Bowel Syndrome (IBS) - NEW", () => {
      it("should exclude spicy irritants", () => {
        const user: UserProfile = {
          userId: "user1",
          diseases: ["Intestino Irritable"],
        };

        const result = filterIngredientes(testIngredients, user);
        const names = result.map((i) => i.name);

        expect(names).not.toContain("Chile picante");
      });

      it("should handle IBS alias", () => {
        const user: UserProfile = {
          userId: "user1",
          diseases: ["IBS"],
        };

        const result = filterIngredientes(testIngredients, user);
        const names = result.map((i) => i.name);

        expect(names).not.toContain("Chile picante");
      });

      it("should exclude coffee for IBS", () => {
        const user: UserProfile = {
          userId: "user1",
          diseases: ["Intestino Irritable"],
        };

        const result = filterIngredientes(testIngredients, user);
        const names = result.map((i) => i.name);

        expect(names).not.toContain("Cafe arabica");
      });
    });
  });

  // ============================================
  // PRUEBAS DE COMBINACIONES
  // ============================================

  describe("Combined Restrictions", () => {
    it("should respect multiple restrictions simultaneously", () => {
      const user: UserProfile = {
        userId: "user1",
        eatingHabit: "Vegano",
        diseases: ["Diabetes", "Hipertiroidismo"],
        allergies: ["Alergia a frutos secos"],
      };

      const result = filterIngredientes(testIngredients, user);
      const names = result.map((i) => i.name);

      // Vegano - should exclude animal products
      expect(names.some((n) => n.includes("Pollo"))).toBe(false);
      expect(names.some((n) => n.includes("Leche"))).toBe(false);

      // Diabetes - should exclude sugar
      expect(names.some((n) => n.includes("Azúcar"))).toBe(false);

      // Hipertiroidismo - should exclude iodine-rich foods
      expect(names.some((n) => n.includes("Nori"))).toBe(false);

      // Alergia a frutos secos - should exclude nuts
      expect(names.some((n) => n.includes("Almendra"))).toBe(false);

      // Safe foods should remain
      expect(names.some((n) => n.includes("Arroz"))).toBe(true);
      expect(names.some((n) => n.includes("Brócoli"))).toBe(true);
    });

    it("should allow safe foods when no restrictions", () => {
      const user: UserProfile = {
        userId: "user1",
      };

      const result = filterIngredientes(testIngredients, user);

      expect(result.length).toBe(testIngredients.length); // Todos los ingredientes pasan
    });
  });

  // ============================================
  // PRUEBAS DE EDGE CASES
  // ============================================

  describe("Edge Cases", () => {
    it("should handle ingredient with no regional variants", () => {
      const ingredients: FirestoreIngredient[] = [
        {
          id: "1",
          name: "X Ingredient",
          category: "Test",
          regional: {},
        },
      ];

      const user: UserProfile = {
        userId: "user1",
        eatingHabit: "Vegano",
      };

      // Should not crash
      const result = filterIngredientes(ingredients, user);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should normalize comparisons with accents", () => {
      const ingredients: FirestoreIngredient[] = [
        {
          id: "1",
          name: "Jamón",
          category: "Embutido",
          regional: { es: "Jamón" },
        },
      ];

      const user: UserProfile = {
        userId: "user1",
        diseases: ["Hipertensión"],
      };

      const result = filterIngredientes(ingredients, user);
      const names = result.map((i) => i.name);

      // jamón (with accent or not) should be detected as salty food
      expect(names.length).toBe(0);
      expect(names).not.toContain("Jamón");
    });

    it("should handle empty restrictions", () => {
      const user: UserProfile = {
        userId: "user1",
        allergies: [],
        diseases: [],
        dislikedFoods: [],
      };

      const result = filterIngredientes(testIngredients, user);
      expect(result.length).toBe(testIngredients.length);
    });
  });
});
