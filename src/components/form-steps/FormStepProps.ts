import { FormData } from '../../types';

export interface FormStepProps {
  data: FormData;
  updateData: (field: keyof FormData, value: any) => void;
  errors: Record<string, string>;
  // Añadimos estas dos como opcionales para la edición de perfil
  hidePasswordFields?: boolean;
  disableEmail?: boolean;
}