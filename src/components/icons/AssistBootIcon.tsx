import React from 'react';
import chuteiraAssist from '../../assets/icons/chuteira-assist.png';

// Chuteira colorida (ícone do usuário, fundo removido) usada pra representar
// assistência — substitui o emoji 👟 mantendo o mesmo estilo colorido do ⚽
// usado para gol. Como é um PNG (não currentColor), o className controla só
// o tamanho, não a cor.
export const AssistBootIcon: React.FC<{ className?: string }> = ({ className }) => (
  <img src={chuteiraAssist} alt="Assistência" className={`inline-block object-contain ${className || ''}`} />
);
