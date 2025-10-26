// src/engine/utils/constants.js

export const PIECES = {
  PAWN: 'p',
  KNIGHT: 'n',
  BISHOP: 'b',
  ROOK: 'r',
  QUEEN: 'q',
  KING: 'k',
};

export const COLORS = {
  WHITE: 'w',
  BLACK: 'b',
};

// Notación del tablero inicial de ajedrez (FEN simplificado)
// minúsculas = negras, MAYÚSCULAS = blancas
export const INITIAL_BOARD = [
  ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
  ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'], // Las mayúsculas representan las piezas blancas
  ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
];