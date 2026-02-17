/**
 * Limpia un objeto para Firestore: convierte undefined → null recursivamente.
 * Firestore no acepta undefined pero sí acepta null.
 *
 * Uso:
 * ```ts
 * import { cleanForFirestore } from '../utils/cleanForFirestore';
 * await setDoc(docRef, cleanForFirestore(data), { merge: true });
 * ```
 */
export const cleanForFirestore = (obj: Record<string, any>): Record<string, any> => {
  const cleanValue = (value: any): any => {
    if (value === undefined) return null;
    if (value === null) return null;
    // Preserve Firestore-native types and Date instances
    if (value instanceof Date) return value;
    if (Array.isArray(value)) {
      return value.map(v => cleanValue(v)).filter(v => v !== undefined);
    }
    if (typeof value === 'object') {
      const cleanedObj: Record<string, any> = {};
      Object.keys(value).forEach(k => {
        const cleaned = cleanValue(value[k]);
        if (cleaned !== undefined) {
          cleanedObj[k] = cleaned;
        }
      });
      return cleanedObj;
    }
    return value;
  };

  const cleaned: Record<string, any> = { ...obj };
  Object.keys(cleaned).forEach(key => {
    cleaned[key] = cleanValue(cleaned[key]);
  });
  return cleaned;
};
