// src/engine/ChessEngine.js

import { INITIAL_BOARD, COLORS } from '../utils/constants';

// =======================================================
// ESTRUCTURA DE DATOS PRINCIPAL: La Clase del Motor
// =======================================================
export class ChessEngine {
  // Matriz 8x8 para representar el tablero
  // Índice [fila][columna]
  board = []; 
  
  // Lista para almacenar movimientos (para 'deshacer' y el historial)
  // ESTA ES OTRA ESTRUCTURA DE DATOS CLAVE (Lista/Pila)
  moveHistory = []; 

  currentTurn = COLORS.WHITE;

  constructor() {
    // Inicializa el tablero con la configuración estándar
    // Usamos una copia profunda para no modificar la constante original
  // Copia profunda ligera: clonar objetos de pieza para evitar mutar la constante original
  this.board = INITIAL_BOARD.map(row => row.map(cell => cell ? { ...cell } : null));
    // Nota: el rey NO se elimina del tablero en reglas correctas.
    // No inicializamos gameOver/winner aquí — la detección de jaque mate
    // se realiza mediante isCheckmate(color) y la UI debe reaccionar.
    console.log("Motor de Ajedrez Inicializado. Turno: Blanco");
  }

  // =======================================================
  // FUNCIÓN CLAVE 1: Obtener la representación del tablero
  // =======================================================
  getBoard() {
    return this.board;
  }

  // =======================================================
  // FUNCIÓN CLAVE 2: Mover una pieza (El inicio de la lógica)
  // =======================================================
  /**
   * Intenta mover una pieza de 'from' a 'to'.
   * @param {object} from - { row: number, col: number } Posición inicial
   * @param {object} to - { row: number, col: number } Posición final
   * @returns {boolean} - true si el movimiento es válido y se ejecuta.
   */
 movePiece(from, to) {
    // ANTES de ejecutar el movimiento, VERIFICA la validez
    if (!this.isValidMove(from, to)) {
        console.log("Movimiento ILEGAL según las reglas de la pieza.");
        return false;
    }
    // No permitir movimientos que dejarían al rey del movimiento en jaque
    if (this._wouldBeInCheckAfterMove(from, to)) {
      console.log('Movimiento invalidado: dejaría al rey en jaque.');
      return false;
    }
    
    // ... (El resto de la lógica de movePiece es la misma: capturar, mover, guardar en historial, cambiar turno)
    const piece = this.board[from.row][from.col];
    const capturedPiece = this.board[to.row][to.col];
    
    // Mover la pieza (clonamos para historial)
    this.board[to.row][to.col] = { ...piece };
    this.board[from.row][from.col] = null; 

    // Promotion: si un peón llega al final del tablero, promociona a reina
    const movedPiece = this.board[to.row][to.col];
    if (movedPiece && movedPiece.type === 'p') {
      if (movedPiece.color === COLORS.WHITE && to.row === 0) {
        // Peón blanco llega a fila 0 -> promociona a reina
        this.board[to.row][to.col].type = 'q';
      }
      if (movedPiece.color === COLORS.BLACK && to.row === 7) {
        // Peón negro llega a fila 7 -> promociona a reina
        this.board[to.row][to.col].type = 'q';
      }
    }

    // No permitir capturar al rey directamente: en reglas correctas el jaque mate
    // termina la partida sin eliminar al rey.
    if (capturedPiece && capturedPiece.type === 'k') {
      console.log('Captura de rey detectada: en ajedrez correcto el rey no se elimina. Movimiento rechazado.');
      return false;
    }

    // Guardar historial con copias para undo
    this.moveHistory.push({ from, to, piece: { ...piece }, capturedPiece: capturedPiece ? { ...capturedPiece } : null });

    this.currentTurn = this.currentTurn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;

    const pieceId = piece.type ? `${piece.color}${piece.type}` : JSON.stringify(piece);
    console.log(`Movimiento ejecutado: ${pieceId} de ${from.row},${from.col} a ${to.row},${to.col}`);
    return true;
  }

  // =======================================================
  // FUNCIÓN EXTRA: Implementación de Pila (Stack) para Deshacer
  // =======================================================
  undoMove() {
    if (this.moveHistory.length === 0) {
      console.log("No hay movimientos para deshacer.");
      return false;
    }

    // Usamos el método pop() de Array, que actúa como el pop() de una Pila
    const lastMove = this.moveHistory.pop(); 

    // Revertir el movimiento:
    // 1. Mover la pieza de vuelta a su posición original
    this.board[lastMove.from.row][lastMove.from.col] = lastMove.piece;
    // 2. Restaurar la pieza capturada (si la hubo)
    this.board[lastMove.to.row][lastMove.to.col] = lastMove.capturedPiece;
    
    // 3. Revertir el turno
    this.currentTurn = this.currentTurn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;

    console.log(`Movimiento deshecho: ${lastMove.piece} vuelto a ${lastMove.from.row},${lastMove.from.col}`);
    const lastPieceId = lastMove.piece && lastMove.piece.type ? `${lastMove.piece.color}${lastMove.piece.type}` : JSON.stringify(lastMove.piece);
    console.log(`Movimiento deshecho: ${lastPieceId} vuelto a ${lastMove.from.row},${lastMove.from.col}`);
    return true;
  }
  // =======================================================
  // FUNCIÓN CLAVE 3: Validar un Movimiento
  // =======================================================
  isValidMove(from, to) {
    // 1. Verificación de límites del tablero
    if (from.row < 0 || from.row > 7 || from.col < 0 || from.col > 7 ||
        to.row < 0 || to.row > 7 || to.col < 0 || to.col > 7) {
      return false; // Fuera de los límites
    }

    const piece = this.board[from.row][from.col];
    const targetPiece = this.board[to.row][to.col];

    // 2. Verificación de si hay una pieza en el origen
    if (!piece) {
      return false;
    }

  // 3. Verificación de Turno
  const pieceColor = piece.color;
    if (pieceColor !== this.currentTurn) {
        console.log("ERROR: No es el turno de esta pieza.");
        return false;
    }

    // 4. No puedes capturar tu propia pieza
    if (targetPiece) {
      const targetColor = targetPiece.color;
      if (pieceColor === targetColor) {
        return false;
      }
    }
    
    // 5. Delegar a la función específica de la pieza
    const pieceType = piece.type;
    
    switch (pieceType) {
      case 'p': return this._isValidPawnMove(from, to, pieceColor);
      case 'n': return this._isValidKnightMove(from, to);
      case 'r': return this._isValidRookMove(from, to);
      case 'b': return this._isValidBishopMove(from, to);
      case 'q': return this._isValidQueenMove(from, to);
      case 'k': return this._isValidKingMove(from, to);
      default: return false; 
    }
  }
  /**
   * Lógica específica para la validación del movimiento del Peón (Pawn).
   * @param {object} from - Posición inicial
   * @param {object} to - Posición final
   * @param {string} color - El color de la pieza ('w' o 'b')
   * @returns {boolean}
   */
  _isValidPawnMove(from, to, color) {
    const direction = color === COLORS.WHITE ? -1 : 1; // Blanco avanza hacia filas menores (-1), Negro hacia filas mayores (+1)
    const startRow = color === COLORS.WHITE ? 6 : 1; // Fila de inicio para el peón

    const rowDiff = to.row - from.row;
    const colDiff = Math.abs(to.col - from.col);
    const targetPiece = this.board[to.row][to.col];

    // 1. Movimiento de AVANCE: 1 casilla
    if (colDiff === 0 && rowDiff === direction) {
      // Debe ser a una casilla vacía
      return targetPiece === null;
    }

    // 2. Movimiento de AVANCE: 2 casillas (solo desde la posición inicial)
    if (colDiff === 0 && rowDiff === 2 * direction && from.row === startRow) {
      // La casilla justo delante (row + direction) y la de destino (row + 2*direction) deben estar vacías
      const interveningRow = from.row + direction;
      return targetPiece === null && this.board[interveningRow][from.col] === null;
    }

    // 3. Movimiento de CAPTURA: Diagonal
    if (colDiff === 1 && rowDiff === direction) {
      // Debe haber una pieza del oponente en el destino (targetPiece)
      return targetPiece !== null; 
      // NOTA: Aquí faltaría En Passant, pero es una regla muy avanzada.
    }

    return false;
  }
  
  // Implementaciones dummy (por ahora) para otras piezas:
  _isValidKnightMove(from, to) {
    const rowDiff = Math.abs(to.row - from.row);
    const colDiff = Math.abs(to.col - from.col);
    return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
  }

  _isValidRookMove(from, to) {
    // Movimiento en línea recta horizontal o vertical
    if (from.row !== to.row && from.col !== to.col) return false;
    return this._isPathClear(from, to);
  }

  _isValidBishopMove(from, to) {
    const rowDiff = Math.abs(to.row - from.row);
    const colDiff = Math.abs(to.col - from.col);
    if (rowDiff !== colDiff) return false;
    return this._isPathClear(from, to);
  }

  _isValidQueenMove(from, to) {
    // Combina rook + bishop
    const rowDiff = Math.abs(to.row - from.row);
    const colDiff = Math.abs(to.col - from.col);
    if (from.row === to.row || from.col === to.col || rowDiff === colDiff) {
      return this._isPathClear(from, to);
    }
    return false;
  }

  _isValidKingMove(from, to) {
    const rowDiff = Math.abs(to.row - from.row);
    const colDiff = Math.abs(to.col - from.col);
    return Math.max(rowDiff, colDiff) === 1; // una casilla en cualquier dirección
  }

  // Helper: comprobar que las casillas entre from (excluido) y to (excluido) están vacías
  _isPathClear(from, to) {
    const rowDir = Math.sign(to.row - from.row);
    const colDir = Math.sign(to.col - from.col);

    let r = from.row + rowDir;
    let c = from.col + colDir;
    while (r !== to.row || c !== to.col) {
      if (this.board[r][c] !== null) return false;
      r += rowDir;
      c += colDir;
    }
    return true;
  }

  // Generar movimientos válidos desde una posición (sin comprobar jaque)
  // Devuelve un array de { row, col }
  generateMoves(from) {
    const moves = [];
    // Verificar que la casilla de origen contiene una pieza
    if (!this.board[from.row] || !this.board[from.row][from.col]) return moves;

    const piece = this.board[from.row][from.col];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const to = { row: r, col: c };
        // Usamos isValidMove que ya verifica límites, turno y capturas propias
        if (this.isValidMove(from, to)) {
          const target = this.board[r][c];
          const isCapture = !!target && target.color !== piece.color;
          moves.push({ row: r, col: c, capture: isCapture });
        }
      }
    }

    // Filtrar movimientos que dejarían al rey en jaque
    const legalMoves = moves.filter(m => !this._wouldBeInCheckAfterMove(from, { row: m.row, col: m.col }));

    return legalMoves;
  }

  // Comprueba si una casilla está atacada por piezas de color `byColor`
  isSquareAttacked(square, byColor) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p || p.color !== byColor) continue;
        if (this._canPieceReach({ row: r, col: c }, square)) return true;
      }
    }
    return false;
  }

  // Devuelve la lista de piezas (posiciones) de `byColor` que atacan la casilla `square`
  getAttackersOfSquare(square, byColor) {
    const attackers = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p || p.color !== byColor) continue;
        if (this._canPieceReach({ row: r, col: c }, square)) attackers.push({ row: r, col: c });
      }
    }
    return attackers;
  }

  // Devuelve los atacantes del rey de `color` (los que están dando jaque)
  getAttackersOfKing(color) {
    // localizar rey
    let kingPos = null;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.type === 'k' && p.color === color) {
          kingPos = { row: r, col: c };
          break;
        }
      }
      if (kingPos) break;
    }
    if (!kingPos) return [];
    const opponent = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
    return this.getAttackersOfSquare(kingPos, opponent);
  }

  // Comprueba si el rey de `color` está en jaque
  isKingInCheck(color) {
    // localizar rey
    let kingPos = null;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.type === 'k' && p.color === color) {
          kingPos = { row: r, col: c };
          break;
        }
      }
      if (kingPos) break;
    }
    if (!kingPos) return false; // sin rey (estado inválido)
    const opponent = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
    return this.isSquareAttacked(kingPos, opponent);
  }

  // Comprueba si tras mover from->to el rey del color de la pieza estaría en jaque
  _wouldBeInCheckAfterMove(from, to) {
    const moving = this.board[from.row][from.col];
    if (!moving) return false;

    // Guardar estado
    const origFrom = this.board[from.row][from.col];
    const origTo = this.board[to.row][to.col];

    // Aplicar movimiento temporal
    this.board[to.row][to.col] = origFrom ? { ...origFrom } : null;
    this.board[from.row][from.col] = null;

    const inCheck = this.isKingInCheck(moving.color);

    // Restaurar
    this.board[from.row][from.col] = origFrom;
    this.board[to.row][to.col] = origTo;

    return inCheck;
  }

  // Comprueba si `color` está en mate: rey en jaque y sin movimientos legales
  isCheckmate(color) {
    if (!this.isKingInCheck(color)) return false;
    // buscar cualquier movimiento legal para color
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p || p.color !== color) continue;
        const moves = this.generateMoves({ row: r, col: c });
        if (moves.length > 0) return false;
      }
    }
    return true;
  }

  // Comprueba si una pieza en `from` podría alcanzar `to` según reglas de movimiento
  // (usa las mismas reglas que los movimientos pero NO verifica turno ni captura propia)
  _canPieceReach(from, to) {
    const p = this.board[from.row][from.col];
    if (!p) return false;
    const type = p.type;

    // Para peón: las casillas atacadas son diagonales hacia adelante
    if (type === 'p') {
      const dir = p.color === COLORS.WHITE ? -1 : 1;
      const rowDiff = to.row - from.row;
      const colDiff = Math.abs(to.col - from.col);
      if (rowDiff === dir && colDiff === 1) return true;
      return false;
    }

    // Caballo
    if (type === 'n') {
      const rowDiff = Math.abs(to.row - from.row);
      const colDiff = Math.abs(to.col - from.col);
      return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
    }

    // Rey
    if (type === 'k') {
      const rowDiff = Math.abs(to.row - from.row);
      const colDiff = Math.abs(to.col - from.col);
      return Math.max(rowDiff, colDiff) === 1;
    }

    // Rook / Bishop / Queen: comprobar dirección y camino
    const rowDiffAbs = Math.abs(to.row - from.row);
    const colDiffAbs = Math.abs(to.col - from.col);
    if (type === 'r') {
      if (from.row !== to.row && from.col !== to.col) return false;
      return this._isPathClear(from, to);
    }
    if (type === 'b') {
      if (rowDiffAbs !== colDiffAbs) return false;
      return this._isPathClear(from, to);
    }
    if (type === 'q') {
      if (from.row === to.row || from.col === to.col || rowDiffAbs === colDiffAbs) {
        return this._isPathClear(from, to);
      }
      return false;
    }

    return false;
  }
}