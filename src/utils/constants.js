// Constantes y tablero inicial
export const COLORS = {
  WHITE: 'w',
  BLACK: 'b',
};

// Representación inicial del tablero
// Filas 0..7, columnas 0..7
// Usamos minúsculas para negras y mayúsculas para blancas
// Representación inicial usando objetos { type: 'p'|'r'..., color: 'w'|'b' }
const CHAR_BOARD = [
  ['r','n','b','q','k','b','n','r'], // fila 0 - negras
  ['p','p','p','p','p','p','p','p'], // fila 1 - peones negros
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  ['P','P','P','P','P','P','P','P'], // fila 6 - peones blancos
  ['R','N','B','Q','K','B','N','R'], // fila 7 - blancas
];

export const INITIAL_BOARD = CHAR_BOARD.map(row => row.map(ch => {
  if (ch === null) return null;
  const isUpper = ch === ch.toUpperCase();
  return { type: ch.toLowerCase(), color: isUpper ? COLORS.WHITE : COLORS.BLACK };
}));

export default {
  COLORS,
  INITIAL_BOARD,
};
