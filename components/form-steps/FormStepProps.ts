
import { FormData } from '../../types';

export interface FormStepProps {
  data: FormData;
  updateData: (field: keyof FormData, value: any) => void;
  errors: Record<string, string>;
  hidePasswordFields?: boolean;
  disableEmail?: boolean;
}
