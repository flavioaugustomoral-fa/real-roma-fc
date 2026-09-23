import React from 'react';

// Coroa de louros (não existe no lucide-react) — usada pra destacar o MVP
// da rodada. Duas hastes com folhas, em "currentColor" pra herdar a cor via
// className (ex: text-amber-400).
export const LaurelWreathIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M11 21c-4.2-1-7-4.7-7-9 0-2.9 1.1-5.4 3-7.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <g fill="currentColor">
      <ellipse cx="9.5" cy="19" rx="1.5" ry="0.8" transform="rotate(-70 9.5 19)" />
      <ellipse cx="7.3" cy="16.2" rx="1.5" ry="0.8" transform="rotate(-55 7.3 16.2)" />
      <ellipse cx="5.8" cy="13" rx="1.5" ry="0.8" transform="rotate(-35 5.8 13)" />
      <ellipse cx="5.1" cy="9.8" rx="1.5" ry="0.8" transform="rotate(-10 5.1 9.8)" />
      <ellipse cx="5.6" cy="6.8" rx="1.5" ry="0.8" transform="rotate(15 5.6 6.8)" />
      <ellipse cx="7.2" cy="4.6" rx="1.4" ry="0.75" transform="rotate(35 7.2 4.6)" />
    </g>
    <path d="M13 21c4.2-1 7-4.7 7-9 0-2.9-1.1-5.4-3-7.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <g fill="currentColor">
      <ellipse cx="14.5" cy="19" rx="1.5" ry="0.8" transform="rotate(70 14.5 19)" />
      <ellipse cx="16.7" cy="16.2" rx="1.5" ry="0.8" transform="rotate(55 16.7 16.2)" />
      <ellipse cx="18.2" cy="13" rx="1.5" ry="0.8" transform="rotate(35 18.2 13)" />
      <ellipse cx="18.9" cy="9.8" rx="1.5" ry="0.8" transform="rotate(10 18.9 9.8)" />
      <ellipse cx="18.4" cy="6.8" rx="1.5" ry="0.8" transform="rotate(-15 18.4 6.8)" />
      <ellipse cx="16.8" cy="4.6" rx="1.4" ry="0.75" transform="rotate(-35 16.8 4.6)" />
    </g>
  </svg>
);
