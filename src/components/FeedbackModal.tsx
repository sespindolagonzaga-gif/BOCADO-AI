import React, { useState } from 'react';
import { db, auth } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemTitle: string;
  type: 'home' | 'away';
  originalData: any;
}

// Helper para sanitizar comentarios (evita XSS básico)
const sanitizeComment = (text: string): string => {
  return text
    .trim()
    .replace(/[<>]/g, '') // Elimina < y > para evitar HTML
    .substring(0, 500);   // Máximo 500 caracteres
};

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, itemTitle, type, originalData }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (rating === 0) return;
    
    const user = auth.currentUser;
    if (!user) {
      setError('Debes iniciar sesión para enviar feedback');
      return;
    }

    setIsSubmitting(true);
    setError('');
    
    try {
      // Datos a guardar (SIN información sensible)
      const feedbackData = {
        userId: user.uid,           // Solo UID, no email ni nombre
        itemId: itemTitle,
        type: type,
        rating: rating,
        comment: sanitizeComment(comment), // Comentario sanitizado
        // Metadata mínima necesaria
        metadata: {
          title: originalData?.title || itemTitle,
          timestamp: new Date().toISOString(),
        },
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'user_feedback'), feedbackData); // Colección renombrada a 'user_feedback'
      
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

  // Limitar caracteres en tiempo real
  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= 500) {
      setComment(value);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center transform animate-pop-in">
        
        {!isSuccess ? (
          <>
            <div className="text-4xl mb-4">{type === 'home' ? '🍳' : '📍'}</div>
            <h3 className="text-xl font-bold text-bocado-dark-green">
              {type === 'home' ? '¿Qué tal quedó?' : '¿Qué tal la comida?'}
            </h3>
            <p className="text-sm text-gray-500 mt-1 mb-6">
              Califica tu experiencia con <br/><strong>{itemTitle}</strong>
            </p>
            
            {/* Error message */}
            {error && (
              <p className="text-red-500 text-sm mb-4 bg-red-50 p-2 rounded-lg">
                {error}
              </p>
            )}
            
            {/* Estrellas */}
            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className={`text-4xl transition-all transform active:scale-125 ${
                    rating >= star ? 'grayscale-0' : 'grayscale opacity-30'
                  }`}
                  aria-label={`Calificar con ${star} estrellas`}
                >
                  ⭐
                </button>
              ))}
            </div>

            {/* Caja de Comentario con contador */}
            <div className="relative mb-6">
              <textarea
                value={comment}
                onChange={handleCommentChange}
                placeholder="¿Algún detalle extra? (opcional)"
                className="w-full p-4 bg-gray-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-bocado-green/30 resize-none"
                rows={3}
                maxLength={500}
              />
              <span className="absolute bottom-2 right-2 text-xs text-gray-400">
                {comment.length}/500
              </span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 py-3 rounded-2xl font-bold text-gray-400 hover:bg-gray-50 transition-colors"
              >
                Omitir
              </button>
              <button
                onClick={handleSubmit}
                disabled={rating === 0 || isSubmitting}
                className="flex-1 bg-bocado-green text-white py-3 rounded-2xl font-bold shadow-lg shadow-green-100 disabled:bg-gray-200 transition-all active:scale-95"
              >
                {isSubmitting ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </>
        ) : (
          /* VISTA DE ÉXITO */
          <div className="py-8 animate-bounce-in">
            <div className="w-20 h-20 bg-green-100 text-bocado-green rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-bocado-dark-green">¡Gracias!</h3>
            <p className="text-gray-500 mt-2">Bocado aprenderá de esto para tus próximas sugerencias.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackModal;