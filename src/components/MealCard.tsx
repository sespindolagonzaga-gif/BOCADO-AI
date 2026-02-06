import React, { useState } from 'react';
import { Meal } from '../types';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { HeartIcon } from './icons/HeartIcon';
import FeedbackModal from './FeedbackModal';

interface MealCardProps {
  meal: Meal;
  isSaved: boolean;
  isSaving: boolean;
  onToggleSave: () => void;
}

// Emoji inteligente pero simple
const getSmartEmoji = (title: string) => {
  const lower = title.toLowerCase();

  if (lower.includes('pollo')) return '🍗';
  if (lower.includes('pescado') || lower.includes('salmon')) return '🐟';
  if (lower.includes('carne') || lower.includes('res')) return '🥩';
  if (lower.includes('ensalada')) return '🥗';
  if (lower.includes('pasta')) return '🍝';
  if (lower.includes('taco')) return '🌮';
  if (lower.includes('huevo')) return '🍳';
  if (lower.includes('sopa')) return '🍲';

  return '🍽️';
};

const getDifficultyStyle = (difficulty: string) => {
  switch (difficulty) {
    case 'Fácil':
      return 'bg-green-100 text-green-700';
    case 'Media':
      return 'bg-yellow-100 text-yellow-700';
    case 'Difícil':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
};

const MealCard: React.FC<MealCardProps> = ({
  meal,
  isSaved,
  isSaving,
  onToggleSave,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const { recipe } = meal;
  const isRestaurant = recipe.difficulty === 'Restaurante';
  const emoji = getSmartEmoji(recipe.title);
  const showSavings =
    recipe.savingsMatch && recipe.savingsMatch !== 'Ninguno';

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSave();
  };

  return (
    <div className="group border border-gray-100 rounded-2xl bg-white transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
      
      {/* HEADER */}
      <div
        className="p-5 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex justify-between items-start gap-4">
          
          {/* Title Section */}
          <div className="flex gap-3 flex-1 min-w-0">
            <span className="text-2xl shrink-0">{emoji}</span>

            <div className="min-w-0">
              <h3 className="text-xl font-semibold text-gray-900 leading-tight group-hover:text-bocado-green transition-colors">
                {recipe.title}
              </h3>

              <div className="flex flex-wrap gap-2 mt-2 text-xs">
                {!isRestaurant && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md">
                    ⏱ {recipe.time}
                  </span>
                )}

                {recipe.calories !== 'N/A' && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md">
                    🔥 {recipe.calories} kcal
                  </span>
                )}

                {!isRestaurant &&
                  recipe.difficulty &&
                  recipe.difficulty !== 'N/A' && (
                    <span
                      className={`px-2 py-1 rounded-md ${getDifficultyStyle(
                        recipe.difficulty
                      )}`}
                    >
                      {recipe.difficulty}
                    </span>
                  )}
              </div>

              {showSavings && (
                <span className="inline-block mt-2 text-xs font-medium text-bocado-green">
                  ✨ Usa ingredientes que ya tienes
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <button
              onClick={handleSaveClick}
              disabled={isSaving}
              className={`p-2 rounded-full transition ${
                isSaved
                  ? 'text-red-500'
                  : 'text-gray-300 hover:text-red-400'
              }`}
            >
              <HeartIcon className="w-6 h-6" filled={isSaved} />
            </button>

            <ChevronDownIcon
              className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>
      </div>

      {/* EXPANDED CONTENT */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 space-y-5 animate-fade-in">
          
          {/* Ingredients */}
          <div>
            <h4 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
              {isRestaurant ? 'Detalles' : 'Ingredientes'}
            </h4>

            <ul className="space-y-2">
              {recipe.ingredients.map((ing, index) => (
                <li
                  key={index}
                  className="text-sm text-gray-700 flex items-start gap-3"
                >
                  <span className="w-1.5 h-1.5 bg-bocado-green rounded-full mt-2 shrink-0"></span>
                  <span className="leading-relaxed">{ing}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Instructions */}
          {recipe.instructions && recipe.instructions.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
                {isRestaurant ? 'Recomendación' : 'Preparación'}
              </h4>

              <div className="space-y-3">
                {recipe.instructions.map((step, i) => (
                  <div key={i} className="flex gap-3 text-sm text-gray-700">
                    {!isRestaurant && (
                      <span className="text-bocado-green font-semibold">
                        {i + 1}.
                      </span>
                    )}
                    <p className="leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <button
            onClick={() => setShowFeedback(true)}
            className="w-full py-3 rounded-xl bg-bocado-dark-green text-white font-semibold text-sm transition hover:opacity-90 active:scale-[0.98]"
          >
            {isRestaurant ? '📍 Fui al lugar' : '🍳 La preparé'}
          </button>
        </div>
      )}

      <FeedbackModal
        isOpen={showFeedback}
        onClose={() => setShowFeedback(false)}
        itemTitle={recipe.title}
        type={isRestaurant ? 'away' : 'home'}
        originalData={recipe}
      />
    </div>
  );
};

export default MealCard;