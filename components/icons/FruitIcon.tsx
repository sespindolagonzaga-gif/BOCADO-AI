
import React from 'react';

export const FruitIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <circle cx="12" cy="14" r="7" />
    <path d="M12 14c-1.667 0 -3.333 -1 -5 -3" />
    <path d="M9 12c.5 2 1.5 3 2.5 3.5" />
    <path d="M15 12c-.5 2 -1.5 3 -2.5 3.5" />
    <path d="M7 11c1.667 0 3.333 -1 5 -3" />
    <path d="M12 4a2 2 0 0 0 2 -2a2 2 0 0 0 -2 -2" />
  </svg>
);
