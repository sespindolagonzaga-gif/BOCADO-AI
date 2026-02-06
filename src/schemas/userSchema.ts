import { z } from 'zod';

// ✅ Esquema para el Paso 1 (Datos Personales y Cuenta)
export const step1Schema = z.object({
  firstName: z.string().min(2, "El nombre es muy corto"),
  lastName: z.string().min(2, "El apellido es muy corto"),
  gender: z.string().min(1, "Selecciona un género"),
  age: z.string().min(1, "Edad requerida"),
  country: z.string().min(1, "Selecciona un país"),
  city: z.string().min(1, "La ciudad es requerida"),
  email: z.string().email("Formato de correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

// ✅ Esquema para el Paso 2 (Salud y Nutrición)
export const step2Schema = z.object({
  allergies: z.array(z.string()),
  otherAllergies: z.string().optional(),
  nutritionalGoal: z.array(z.string()).min(1, "Selecciona al menos un objetivo"),
}).refine((data) => {
  // Si seleccionó "Otro" en alergias, el campo otherAllergies debe tener texto
  if (data.allergies.includes('Otro') && (!data.otherAllergies || data.otherAllergies.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: "Especifica tus otras alergias",
  path: ["otherAllergies"],
});

// Tipos para TypeScript
export type UserStep1Data = z.infer<typeof step1Schema>;
export type UserStep2Data = z.infer<typeof step2Schema>;