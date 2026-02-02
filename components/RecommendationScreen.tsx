import React, { useState } from 'react';
import { 
  Home, 
  Utensils, 
  Clock, 
  ChefHat, 
  Sparkles, 
  ChevronRight,
  AlertCircle
} from 'lucide-react';

interface RecommendationScreenProps {
  user: any;
  onRecommendationRequested: () => void;
}

export const RecommendationScreen: React.FC<RecommendationScreenProps> = ({ 
  user, 
  onRecommendationRequested 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<'casa' | 'fuera'>('casa');
  const [mealType, setMealType] = useState('Almuerzo');
  const [time, setTime] = useState('30');
  const [cravings, setCravings] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    const payload = {
      userId: user.uid,
      type: location,
      context: {
        mealType,
        time: parseInt(time),
        cravings: cravings.trim(),
        timestamp: new Date().toISOString()
      },
      // Pasamos datos mínimos, el backend en Vercel se encargará 
      // de hidratar con el perfil completo desde Firestore/Airtable
      userProfile: {
        diet: user.dietaryRestrictions || [],
        allergies: user.allergies || []
      }
    };

    try {
      // LLAMADA A TU NUEVA API EN VERCEL (Sustituye a n8n)
      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Error al conectar con el motor de IA');
      }

      const result = await response.json();
      
      if (result.success) {
        // Notificamos a la App principal para que cambie a la pestaña de 'Plan'
        // donde el listener de Firestore ya estará esperando el documento.
        onRecommendationRequested();
      } else {
        throw new Error(result.message || 'Error desconocido');
      }

    } catch (err: any) {
      console.error('Error generando recomendación:', err);
      setError(err.message || 'No se pudo generar el plan. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white px-6 pt-12 pb-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">¿Qué comeremos hoy?</h1>
        <p className="text-gray-500 text-sm mt-1">Personalizado para tu perfil nutricional</p>
      </div>

      <div className="p-6 space-y-8 overflow-y-auto">
        {/* Selector de Ubicación */}
        <section>
          <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4 block">
            ¿Dónde prefieres?
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setLocation('casa')}
              className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all ${
                location === 'casa' 
                ? 'border-orange-500 bg-orange-50 text-orange-600' 
                : 'border-gray-100 bg-white text-gray-400'
              }`}
            >
              <Home className="mb-2" size={24} />
              <span className="font-medium">En Casa</span>
            </button>
            <button
              onClick={() => setLocation('fuera')}
              className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all ${
                location === 'fuera' 
                ? 'border-orange-500 bg-orange-50 text-orange-600' 
                : 'border-gray-100 bg-white text-gray-400'
              }`}
            >
              <Utensils className="mb-2" size={24} />
              <span className="font-medium">Fuera</span>
            </button>
          </div>
        </section>

        {/* Configuración de Comida */}
        <section className="space-y-6">
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-3 block">Tipo de comida</label>
            <div className="flex flex-wrap gap-2">
              {['Desayuno', 'Almuerzo', 'Cena', 'Snack'].map((type) => (
                <button
                  key={type}
                  onClick={() => setMealType(type)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    mealType === type ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {location === 'casa' && (
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-3 block flex items-center gap-2">
                <Clock size={16} /> Tiempo disponible
              </label>
              <select 
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full p-3 bg-white border border-gray-200 rounded-xl text-gray-700 focus:ring-2 focus:ring-orange-500 outline-none"
              >
                <option value="15">Rápido (15 min)</option>
                <option value="30">Estándar (30 min)</option>
                <option value="60">Con calma (60+ min)</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-sm font-semibold text-gray-700 mb-3 block flex items-center gap-2">
              <Sparkles size={16} /> Antojos o ingredientes (opcional)
            </label>
            <textarea
              value={cravings}
              onChange={(e) => setCravings(e.target.value)}
              placeholder="Ej: Algo con pasta, comida mexicana, algo ligero..."
              className="w-full p-4 bg-white border border-gray-200 rounded-xl text-gray-700 focus:ring-2 focus:ring-orange-500 outline-none min-h-[100px] resize-none"
            />
          </div>
        </section>

        {/* Mensaje de Error */}
        {error && (
          <div className="bg-red-50 p-4 rounded-xl flex items-center gap-3 text-red-600 border border-red-100">
            <AlertCircle size={20} />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Botón de Acción */}
        <button
          onClick={handleGenerate}
          disabled={loading}
          className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
            loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'
          }`}
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              <span>Cocinando tu plan...</span>
            </>
          ) : (
            <>
              <ChefHat size={20} />
              <span>Generar Recomendación</span>
              <ChevronRight size={20} />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
