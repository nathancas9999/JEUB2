export interface IdeTheme {
  id: string;
  name: string;
  cost: number;
  bgClass: string;       // Fond de l'éditeur
  textClass: string;     // Couleur du code principal
  accentClass: string;   // Couleur des infos (WPM, Argent)
  cursorClass: string;   // Couleur du curseur de frappe
  borderClass: string;   // Couleur des bordures
  successClass: string;  // Couleur quand on tape la bonne lettre
}

export const IDE_THEMES: IdeTheme[] = [
    { 
      id: 'DEFAULT', name: 'VS Code Dark', cost: 0, 
      bgClass: 'bg-[#1e1e1e]', textClass: 'text-slate-200', 
      accentClass: 'text-blue-400', cursorClass: 'bg-blue-500', borderClass: 'border-slate-700',
      successClass: 'text-green-400'
    },
    { 
      id: 'MATRIX', name: 'The Matrix', cost: 2500, 
      bgClass: 'bg-black', textClass: 'text-green-700 font-mono', 
      accentClass: 'text-green-400', cursorClass: 'bg-green-500', borderClass: 'border-green-800',
      successClass: 'text-green-400 neon-glow'
    },
    { 
      id: 'DRACULA', name: 'Dracula', cost: 5000, 
      bgClass: 'bg-[#282a36]', textClass: 'text-[#f8f8f2]', 
      accentClass: 'text-[#bd93f9]', cursorClass: 'bg-[#bd93f9]', borderClass: 'border-[#6272a4]',
      successClass: 'text-[#ff79c6] drop-shadow-md'
    },
    { 
      id: 'SOLARIZED', name: 'Solarized Light', cost: 10000, 
      bgClass: 'bg-[#fdf6e3]', textClass: 'text-[#657b83]', 
      accentClass: 'text-[#b58900]', cursorClass: 'bg-[#d33682]', borderClass: 'border-[#93a1a1]',
      successClass: 'text-[#d33682] font-bold'
    }
];