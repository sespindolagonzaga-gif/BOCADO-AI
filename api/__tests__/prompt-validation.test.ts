/**
 * Test para validar que los prompts se construyen correctamente
 * incluso cuando faltan datos del perfil
 */

describe('Prompt Construction - Defensive Validation', () => {
  const ensureArray = (input: any): string[] => {
    if (!input) return [];
    if (Array.isArray(input)) return input.filter((i): i is string => typeof i === 'string');
    if (typeof input === 'string') return input.split(',').map(s => s.trim()).filter(Boolean);
    return [];
  };

  describe('User Profile Completeness', () => {
    it('should handle empty user profile gracefully', () => {
      const user = {};
      
      const demographicParts = [
        user.eatingHabit ? `Dieta: ${user.eatingHabit}` : '',
        user.age ? `${user.age} años` : '',
        user.activityLevel && user.activityLevel !== 'Sedentario' ? user.activityLevel : ''
      ].filter(Boolean);
      
      expect(demographicParts.length).toBe(0);
      expect(demographicParts.join(', ')).toBe('');
    });

    it('should build demographic context when data exists', () => {
      const user = {
        eatingHabit: 'Vegano',
        age: '35',
        activityLevel: 'Deportista intenso'
      };
      
      const demographicParts = [
        user.eatingHabit ? `Dieta: ${user.eatingHabit}` : '',
        user.age ? `${user.age} años` : '',
        user.activityLevel && user.activityLevel !== 'Sedentario' ? user.activityLevel : ''
      ].filter(Boolean);
      
      expect(demographicParts).toEqual([
        'Dieta: Vegano',
        '35 años',
        'Deportista intenso'
      ]);
      expect(demographicParts.join(', ')).toBe('Dieta: Vegano, 35 años, Deportista intenso');
    });

    it('should filter out Sedentario activity level', () => {
      const user = {
        activityLevel: 'Sedentario'
      };
      
      const demographicParts = [
        user.eatingHabit ? `Dieta: ${user.eatingHabit}` : '',
        user.age ? `${user.age} años` : '',
        user.activityLevel && user.activityLevel !== 'Sedentario' ? user.activityLevel : ''
      ].filter(Boolean);
      
      expect(demographicParts.length).toBe(0);
    });

    it('should build medical restrictions context', () => {
      const user = {
        diseases: ['Diabetes', 'Hipertensión'],
        allergies: ['Celíaco', 'Intolerante a la lactosa']
      };
      
      const diseases = ensureArray(user.diseases);
      const allergies = ensureArray(user.allergies);
      const medicalRestrictions = [...diseases, ...allergies].filter(Boolean);
      const medicalContext = medicalRestrictions.length > 0 
        ? `Restricciones: ${medicalRestrictions.join(', ')}` 
        : '';
      
      expect(medicalContext).toBe('Restricciones: Diabetes, Hipertensión, Celíaco, Intolerante a la lactosa');
    });

    it('should handle empty medical restrictions', () => {
      const user = {
        diseases: [],
        allergies: []
      };
      
      const diseases = ensureArray(user.diseases);
      const allergies = ensureArray(user.allergies);
      const medicalRestrictions = [...diseases, ...allergies].filter(Boolean);
      const medicalContext = medicalRestrictions.length > 0 
        ? `Restricciones: ${medicalRestrictions.join(', ')}` 
        : '';
      
      expect(medicalContext).toBe('');
    });

    it('should build disliked foods context', () => {
      const user = {
        dislikedFoods: ['pescado', 'brócoli']
      };
      const request = {
        dislikedFoods: ['cilantro']
      };
      
      const allDislikedFoods = [...ensureArray(user.dislikedFoods), ...ensureArray(request.dislikedFoods)].filter(Boolean);
      const dislikedContext = allDislikedFoods.length > 0 
        ? `NO usar: ${allDislikedFoods.join(', ')}` 
        : '';
      
      expect(dislikedContext).toBe('NO usar: pescado, brócoli, cilantro');
    });

    it('should build complete profile line without duplicates or empty parts', () => {
      const user = {
        eatingHabit: 'Vegano',
        age: '35',
        activityLevel: 'Deportista intenso',
        diseases: ['Diabetes'],
        allergies: [],
        dislikedFoods: ['pescado'],
        nutritionalGoal: 'Perder peso'
      };
      const request = {
        dislikedFoods: []
      };
      
      // Demographic
      const demographicParts = [
        user.eatingHabit ? `Dieta: ${user.eatingHabit}` : '',
        user.age ? `${user.age} años` : '',
        user.activityLevel && user.activityLevel !== 'Sedentario' ? user.activityLevel : ''
      ].filter(Boolean);
      const demographicContext = demographicParts.length > 0 ? demographicParts.join(', ') : '';
      
      // Medical
      const diseases = ensureArray(user.diseases);
      const allergies = ensureArray(user.allergies);
      const medicalRestrictions = [...diseases, ...allergies].filter(Boolean);
      const medicalContext = medicalRestrictions.length > 0 
        ? `Restricciones: ${medicalRestrictions.join(', ')}` 
        : '';
      
      // Disliked
      const allDislikedFoods = [...ensureArray(user.dislikedFoods), ...ensureArray(request.dislikedFoods)].filter(Boolean);
      const dislikedContext = allDislikedFoods.length > 0 
        ? `NO usar: ${allDislikedFoods.join(', ')}` 
        : '';
      
      // Profile line
      const profileParts = [demographicContext, medicalContext, dislikedContext].filter(Boolean);
      const profileLine = profileParts.join(' | ');
      
      expect(profileLine).toBe('Dieta: Vegano, 35 años, Deportista intenso | Restricciones: Diabetes | NO usar: pescado');
      expect(profileLine).not.toContain('Ninguna');
      expect(profileLine).not.toContain('undefined');
      expect(profileLine).not.toContain('null');
      expect(profileLine).not.toMatch(/\|\s*\|/); // No double pipes
    });

    it('should show "Sin restricciones" when profile is completely empty', () => {
      const user = {};
      const request = {};
      
      // Demographic
      const demographicParts = [
        user.eatingHabit ? `Dieta: ${user.eatingHabit}` : '',
        user.age ? `${user.age} años` : '',
        user.activityLevel && user.activityLevel !== 'Sedentario' ? user.activityLevel : ''
      ].filter(Boolean);
      const demographicContext = demographicParts.length > 0 ? demographicParts.join(', ') : '';
      
      // Medical
      const diseases = ensureArray(user.diseases);
      const allergies = ensureArray(user.allergies);
      const medicalRestrictions = [...diseases, ...allergies].filter(Boolean);
      const medicalContext = medicalRestrictions.length > 0 
        ? `Restricciones: ${medicalRestrictions.join(', ')}` 
        : '';
      
      // Disliked
      const allDislikedFoods = [...ensureArray(user.dislikedFoods), ...ensureArray(request.dislikedFoods)].filter(Boolean);
      const dislikedContext = allDislikedFoods.length > 0 
        ? `NO usar: ${allDislikedFoods.join(', ')}` 
        : '';
      
      // Profile line
      const profileParts = [demographicContext, medicalContext, dislikedContext].filter(Boolean);
      const profileLine = profileParts.join(' | ');
      
      const finalProfileLine = profileLine || 'Sin restricciones';
      
      expect(finalProfileLine).toBe('Sin restricciones');
    });
  });
});
