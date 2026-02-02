import React, { useState } from 'react';
import { Meal } from '../types';
import { MEALS } from '../constants';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { SavingsIcon } from './icons/SavingsIcon';
import { HeartIcon } from './icons/HeartIcon';

interface MealCardProps {
  meal: Meal;
  isSaved: boolean;
  isSaving: boolean;
  onToggleSave: () => void;
}

const MealCard: React.FC<MealCardProps> = ({ meal, isSaved, isSaving, onToggleSave }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    const { recipe } = meal;
    const isRestaurant = recipe.difficulty === 'Restaurante';

    const handleSaveClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggleSave();
    };
    
    const renderTextWithLinks = (text: string) => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const parts = text.split(urlRegex);
        
        if (parts.length === 1) return text;

        return (
            <>
                {parts.map((part, i) => {
                    if (part.match(urlRegex)) {
                        return (
                            <a 
                                key={i} 
                                href={part} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-bocado-green underline break-all hover:text-bocado-dark-green font-medium"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {part}
                            </a>
                        );
                    }
                    return part;
                })}
            </>
        );
    };
    
    const mealEmoji = MEALS.find(m => meal.mealType.includes(m.split(' ')[1]))?.split(' ')[0] || '🍽️';
    const showSavings = recipe.savingsMatch && recipe.savingsMatch !== 'Ninguno';
    
    const getBadgeStyle = (difficulty: string) => {
        switch (difficulty) {
            case 'Fácil': return 'bg-green-100 text-green-800';
            case 'Media': return 'bg-yellow-100 text-yellow-800';
            case 'Restaurante': return 'bg-blue-100 text-blue-800';
            default: return 'bg-red-100 text-red-800';
        }
    };

    return (
        <div className="border border-gray-200 rounded-xl overflow-hidden transition-all duration-300 bg-white shadow-sm hover:shadow-md">
            <div
                className="w-full flex justify-between items-start p-4 text-left relative"
            >
                <div 
                    className="flex-1 pr-10 cursor-pointer"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl">{mealEmoji}</span>
                        <h3 className="text-lg font-bold text-bocado-dark-green leading-tight">{recipe.title}</h3>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-gray-600">
                        {!isRestaurant && (
                             <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded text-xs font-medium">
                                 ⏱️ {recipe.time}
                            </span>
                        )}
                        
                        {isRestaurant && recipe.cuisine && (
                             <span className="flex items-center gap-1 bg-orange-100 text-orange-800 px-2 py-0.5 rounded text-xs font-medium">
                                 🍴 {recipe.cuisine}
                            </span>
                        )}

                        {recipe.calories !== 'N/A' && (
                            <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded text-xs font-medium">
                                🔥 {recipe.calories} kcal
                            </span>
                        )}
                        
                        {!isRestaurant && recipe.difficulty && recipe.difficulty !== 'N/A' && (
                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getBadgeStyle(recipe.difficulty)}`}>
                                📊 {recipe.difficulty}
                            </span>
                        )}
                    </div>

                    {showSavings && (
                        <div className="mt-2 inline-flex items-center gap-1.5 text-bocado-green text-xs font-bold bg-bocado-green/10 px-2 py-1 rounded-full">
                            <SavingsIcon className="w-4 h-4" />
                            <span>¡Usas tu despensa!</span>
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-center gap-2">
                    <button 
                        onClick={handleSaveClick}
                        disabled={isSaving}
                        className={`p-2 rounded-full transition-colors ${isSaved ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:text-red-500 hover:bg-gray-50'}`}
                    >
                        <HeartIcon className="w-6 h-6" filled={isSaved} />
                    </button>
                    <button 
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1"
                    >
                        <ChevronDownIcon className={`w-5 h-5 text-gray-400 transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>
            
            {isExpanded && (
                <div className="p-4 pt-0 space-y-6 animate-fade-in border-t border-gray-100 mt-2">
                    <div className="pt-2">
                        <h4 className="font-bold text-bocado-dark-green text-sm uppercase tracking-wide mb-3 border-b border-gray-100 pb-1">
                            {isRestaurant ? 'Detalles del Lugar' : 'Ingredientes'}
                        </h4>
                        <ul className="space-y-2">
                            {recipe.ingredients.map((ing, index) => (
                                <li key={index} className="text-sm text-gray-700 flex items-start gap-3">
                                    <div className="h-5 flex items-center shrink-0">
                                        <div className="w-1.5 h-1.5 rounded-full bg-bocado-green"></div>
                                    </div>
                                    <span className="flex-1 leading-snug">
                                        {renderTextWithLinks(ing)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    
                    {recipe.instructions && recipe.instructions.length > 0 && (
                        <div>
                             <h4 className="font-bold text-bocado-dark-green text-sm uppercase tracking-wide mb-3 border-b border-gray-100 pb-1">
                                {isRestaurant ? 'Recomendación' : 'Preparación'}
                             </h4>
                             <div className="space-y-3">
                                {recipe.instructions.map((step, i) => (
                                    <div key={i} className="flex gap-3 text-sm text-gray-700">
                                        {!isRestaurant && (
                                            <span className="font-bold text-bocado-green min-w-[1.5rem]">{i + 1}.</span>
                                        )}
                                        <p className="flex-1 leading-relaxed">{step}</p>
                                    </div>
                                ))}
                             </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MealCard;