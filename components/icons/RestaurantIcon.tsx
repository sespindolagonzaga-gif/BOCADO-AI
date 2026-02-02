
import React from 'react';

export const RestaurantIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    {/* Tenedor (Izquierda) */}
    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 3v8.25a2.25 2.25 0 0 0 2.25 2.25h0a2.25 2.25 0 0 0 2.25-2.25V3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3v10.5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 13.5v7.5" />
    
    {/* Cuchillo (Derecha) */}
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 3v18" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h1.5a3 3 0 0 1 3 3v15h-4.5" />
  </svg>
);
