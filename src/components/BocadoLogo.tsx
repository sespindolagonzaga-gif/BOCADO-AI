import React from 'react';

const BocadoLogo: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <img 
      src="https://raw.githubusercontent.com/egarciav99/Clase/refs/heads/main/Bocado-logo.png" 
      alt="Bocado IA Logo" 
      className={`h-auto ${className}`} // h-auto para mantener la proporción
    />
  );
};

export default BocadoLogo;