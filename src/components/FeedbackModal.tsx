import React, { useState } from 'react';
import { db } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthStore } from '../stores/authStore';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemTitle: string;
  type: 'home' | 'away';
  originalData: any;
}

const sanitizeComment = (text: string): string => {
  return text
    .trim()
    .replace(/[<>]/g, '')
    .substring(0, 500);
};

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, itemTitle, type, originalData }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  // ✅ ZUSTAND: Obtenemos usuario del store en lugar de auth.currentUser
  const { user, isAuthenticated } = useAuthStore();

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (rating === 0) return;
    
    // ✅ Validación usando el store
    if (!isAuthenticated || !user) {
      setError('Debes iniciar sesión para enviar feedback');
      return;
    }

    setIsSubmitting(true);
    setError('');
    
    try {
      const feedbackData = {
        userId: user.uid, // Ahora viene del store tipado
        itemId: itemTitle,
        type: type,
        rating: rating,
        comment: sanitizeComment(comment),
        metadata: {
          title: originalData?.title || itemTitle,
          timestamp: new Date().toISOString(),
        },
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'user_history'), feedbackData);
      
      setIsSuccess(true);
      
      setTimeout(() => {
        handleClose();
      }, 2000);
      
    } catch (error) {
      console.error("Error guardando feedback:", error);
      setError("No se pudo guardar la calificación. Inténtalo de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setRating(0);
    setComment("");
    setIsSuccess(false);
    setError('');
    onClose();
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= 500) {
      setComment(value);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center transform transition-transform duration-300 translate-y-0">
        
        {/* Indicador de arrastre en móvil */}
        <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6 sm:hidden"></div>
        
        {!isSuccess ? (
          <>
            <div className="text-4xl mb-4">{type === 'home' ? '🍳' : '📍'}</div>
            <h3 className="text-lg sm:text-xl font-bold text-bocado-dark-green">
              {type === 'home' ? '¿Qué tal quedó?' : '¿Qué tal la comida?'}
            </h3>
            <p className="text-sm text-bocado-gray mt-1 mb-6 line-clamp-2">
              Califica tu experiencia con <br className="hidden sm:block"/>
              <strong className="text-bocado-dark-gray">{itemTitle}</strong>
            </p>
            
            {error && (
              <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-xl">
                {error}
              </p>
            )}
            
            {/* Estrellas más grandes en móvil para touch */}
            <div className="flex justify-center gap-3 sm:gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className={`text-4xl sm:text-3xl transition-transform active:scale-125 ${
                    rating >= star ? 'grayscale-0' : 'grayscale opacity-30'
                  }`}
                  style={{ touchAction: 'manipulation' }}
                  aria-label={`Calificar con ${star} estrellas`}
                >
                  ⭐
                </button>
              ))}
            </div>

            <div className="relative mb-6">
              <textarea
                value={comment}
                onChange={handleCommentChange}
                placeholder="¿Algún detalle extra? (opcional)"
                className="w-full p-4 bg-bocado-background border-none rounded-2xl text-sm focus:ring-2 focus:ring-bocado-green/30 resize-none text-bocado-text placeholder-bocado-gray/50"
                rows={3}
                maxLength={500}
              />
              <span className="absolute bottom-3 right-3 text-xs text-bocado-gray bg-white/80 px-2 py-1 rounded-full">
                {comment.length}/500
              </span>
            </div>

            <div className="flex gap-3 pb-safe">
              <button
                onClick={handleClose}
                className="flex-1 py-3 rounded-2xl font-bold text-bocado-gray hover:bg-bocado-background transition-colors active:scale-95"
              >
                Omitir
              </button>
              <button
                onClick={handleSubmit}
                disabled={rating === 0 || isSubmitting}
                className="flex-1 bg-bocado-green text-white py-3 rounded-2xl font-bold shadow-bocado disabled:bg-bocado-gray/30 disabled:shadow-none transition-all active:scale-95"
              >
                {isSubmitting ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </>
        ) : (
          <div className="py-8">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 text-bocado-green rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-bocado-dark-green">¡Gracias!</h3>
            <p className="text-bocado-gray mt-2 text-sm sm:text-base">Bocado aprenderá de esto para tus próximas sugerencias.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackModal;