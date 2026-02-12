import React from 'react';

export interface TooltipProps {
  children: React.ReactNode;
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Componente Tooltip - Muestra texto al hover
 *
 * @example
 * <Tooltip text="Guardar para después">
 *   <button>❤️</button>
 * </Tooltip>
 */
export const Tooltip: React.FC<TooltipProps> = ({
  children,
  text,
  position = 'top'
}) => {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div className="group relative inline-flex">
      {children}
      <div className={`
        absolute ${positionClasses[position]}
        invisible group-hover:visible
        opacity-0 group-hover:opacity-100
        transition-opacity duration-200
        bg-bocado-dark-gray text-white text-2xs
        px-3 py-1.5 rounded-lg
        whitespace-nowrap z-50
        pointer-events-none
      `}>
        {text}
        {/* Triangle pointer */}
        <div className={`
          absolute w-0 h-0
          ${position === 'top' ? 'top-full left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-bocado-dark-gray' : ''}
          ${position === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-bocado-dark-gray' : ''}
          ${position === 'left' ? 'left-full top-1/2 -translate-y-1/2 border-t-4 border-b-4 border-l-4 border-t-transparent border-b-transparent border-l-bocado-dark-gray' : ''}
          ${position === 'right' ? 'right-full top-1/2 -translate-y-1/2 border-t-4 border-b-4 border-r-4 border-t-transparent border-b-transparent border-r-bocado-dark-gray' : ''}
        `} />
      </div>
    </div>
  );
};

export default Tooltip;
