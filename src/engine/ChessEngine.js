// src/engine/ChessEngine.js

import { INITIAL_BOARD, COLORS } from '../utils/constants';

// =======================================================
// ESTRUCTURA DE DATOS PRINCIPAL: La Clase del Motor
// =======================================================
export class MotorAjedrez {
  // Matriz 8x8 para representar el tablero
  // Índice [fila][columna]
  board = []; 
  
  // Lista para almacenar movimientos (para 'deshacer' y el historial)
  historialMovimientos = []; 

  // Registro explícito de piezas capturadas (por color de la pieza capturada)
  piezasCapturadas = { w: [], b: [] };
  turnoActual = COLORS.WHITE;

  constructor() {
    // Inicializa el tablero con la configuración estándar
    // Usamos una copia profunda para no modificar la constante original
    this.board = INITIAL_BOARD.map(row => row.map(cell => cell ? { ...cell } : null));
    // Asegurar hasMoved = false para todas las piezas recién clonadas
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c]) this.board[r][c].hasMoved = false;
      }
    }
    console.log("Motor de Ajedrez Inicializado. Turno: Blanco");
  }

  // Devuelve una copia del registro de piezas capturadas
  obtenerPiezasCapturadas() {
    return {
      w: this.piezasCapturadas.w.map(p => ({ ...p })),
      b: this.piezasCapturadas.b.map(p => ({ ...p })),
    };
  }

  // =======================================================
  // FUNCIÓN CLAVE 1: Obtener la representación del tablero
  // =======================================================
  obtenerTablero() {
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
  moverPieza(from, to) {
    // ANTES de ejecutar el movimiento, VERIFICA la validez
    if (!this.esMovimientoValido(from, to)) {
      console.log("Movimiento ILEGAL según las reglas de la pieza.");
      return false;
    }
    // No permitir movimientos que dejarían al rey del movimiento en jaque
    if (this._estariaEnJaqueTrasMovimiento(from, to)) {
      console.log('Movimiento invalidado: dejaría al rey en jaque.');
      return false;
    }

    const piece = this.board[from.row][from.col];
    let capturedPiece = this.board[to.row][to.col];

    // Preparar el objeto de historial con posibilidad de marcar jugadas especiales
    const moveRecord = { from, to, piece: { ...piece }, capturedPiece: capturedPiece ? { ...capturedPiece } : null, special: {} };

    // Detectar EN PASSANT
    if (piece.type === 'p') {
      const dir = piece.color === 'w' ? -1 : 1;
      const rowDiff = to.row - from.row;
      const colDiff = to.col - from.col;
      if (Math.abs(colDiff) === 1 && rowDiff === dir && this.board[to.row][to.col] === null) {
        const last = this.historialMovimientos.length ? this.historialMovimientos[this.historialMovimientos.length - 1] : null;
        if (last && last.piece && last.piece.type === 'p' && last.piece.color !== piece.color) {
          if (Math.abs(last.from.row - last.to.row) === 2 && last.to.row === from.row && last.to.col === to.col) {
            capturedPiece = { ...this.board[last.to.row][last.to.col] };
            moveRecord.capturedPiece = capturedPiece ? { ...capturedPiece } : null;
            moveRecord.special.isEnPassant = true;
            moveRecord.special.enPassantCaptured = { row: last.to.row, col: last.to.col };
            this.board[last.to.row][last.to.col] = null;
          }
        }
      }
    }

    // Detectar ENROQUE
    if (piece.type === 'k' && from.row === to.row && Math.abs(to.col - from.col) === 2) {
      const dir = to.col - from.col > 0 ? 1 : -1;
      const rookCol = dir === 1 ? 7 : 0;
      const rook = this.board[from.row][rookCol];
      if (rook && rook.type === 'r' && rook.color === piece.color && !rook.hasMoved && !piece.hasMoved) {
        const pathFrom = { row: from.row, col: from.col + dir };
        const pathTo = { row: from.row, col: from.col + 2 * dir };
  if (this._caminoLibre(from, { row: from.row, col: rookCol })) {
          const opponent = piece.color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
          if (!this.estaReyEnJaque(piece.color) && !this.casillaEstaAtacada(pathFrom, opponent) && !this.casillaEstaAtacada(pathTo, opponent)) {
            const rookFrom = { row: from.row, col: rookCol };
            const rookTo = { row: from.row, col: from.col + dir };
            moveRecord.special.isCastling = true;
            moveRecord.special.rookFrom = rookFrom;
            moveRecord.special.rookTo = rookTo;
            moveRecord.special.rookPiece = rook ? { ...rook } : null;
            this.board[rookTo.row][rookTo.col] = { ...rook };
            this.board[rookFrom.row][rookFrom.col] = null;
          }
        }
      }
    }

    // Mover la pieza
    this.board[to.row][to.col] = { ...piece };
    this.board[from.row][from.col] = null; 

    // Promotion
    const movedPiece = this.board[to.row][to.col];
    if (movedPiece && movedPiece.type === 'p') {
      if (movedPiece.color === COLORS.WHITE && to.row === 0) {
        this.board[to.row][to.col].type = 'q';
        moveRecord.special.promoted = true;
        moveRecord.special.promotedTo = 'q';
      }
      if (movedPiece.color === COLORS.BLACK && to.row === 7) {
        this.board[to.row][to.col].type = 'q';
        moveRecord.special.promoted = true;
        moveRecord.special.promotedTo = 'q';
      }
    }

    // No permitir captura de rey
    if (moveRecord.capturedPiece && moveRecord.capturedPiece.type === 'k') {
      console.log('Captura de rey detectada: en ajedrez correcto el rey no se elimina. Movimiento rechazado.');
      return false;
    }

    if (this.board[to.row][to.col]) this.board[to.row][to.col].hasMoved = true;

    // Registrar capturas explícitamente
    if (moveRecord.capturedPiece) {
      this.piezasCapturadas[moveRecord.capturedPiece.color].push({ ...moveRecord.capturedPiece });
    }

    // Guardar historial
    this.historialMovimientos.push(moveRecord);

    this.turnoActual = this.turnoActual === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;

    const pieceId = piece.type ? `${piece.color}${piece.type}` : JSON.stringify(piece);
    console.log(`Movimiento ejecutado: ${pieceId} de ${from.row},${from.col} a ${to.row},${to.col}`);
    return true;
  }

  // =======================================================
  // Deshacer movimiento
  // =======================================================
  deshacerMovimiento() {
    if (this.historialMovimientos.length === 0) {
      console.log("No hay movimientos para deshacer.");
      return false;
    }

    const lastMove = this.historialMovimientos.pop(); 

    // Restaurar pieza origen
    this.board[lastMove.from.row][lastMove.from.col] = lastMove.piece;

    // Restaurar captura
    if (lastMove.special && lastMove.special.isEnPassant && lastMove.special.enPassantCaptured) {
      const capPos = lastMove.special.enPassantCaptured;
      this.board[capPos.row][capPos.col] = lastMove.capturedPiece;
      if (lastMove.capturedPiece) {
        const arr = this.piezasCapturadas[lastMove.capturedPiece.color];
        if (arr && arr.length) arr.pop();
      }
      this.board[lastMove.to.row][lastMove.to.col] = null;
    } else {
      this.board[lastMove.to.row][lastMove.to.col] = lastMove.capturedPiece;
      if (lastMove.capturedPiece) {
        const arr = this.piezasCapturadas[lastMove.capturedPiece.color];
        if (arr && arr.length) arr.pop();
      }
    }

    // Restaurar torre si fue enroque
    if (lastMove.special && lastMove.special.isCastling && lastMove.special.rookFrom && lastMove.special.rookTo) {
      const rf = lastMove.special.rookFrom;
      const rt = lastMove.special.rookTo;
      this.board[rf.row][rf.col] = lastMove.special.rookPiece ? { ...lastMove.special.rookPiece } : null;
      this.board[rt.row][rt.col] = null;
    }

    // Revertir turno
    this.turnoActual = this.turnoActual === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;

    const lastPieceId = lastMove.piece && lastMove.piece.type ? `${lastMove.piece.color}${lastMove.piece.type}` : JSON.stringify(lastMove.piece);
    console.log(`Movimiento deshecho: ${lastPieceId} vuelto a ${lastMove.from.row},${lastMove.from.col}`);
    return true;
  }

  // =======================================================
  // Validar un movimiento
  // =======================================================
  esMovimientoValido(from, to) {
    // límites
    if (from.row < 0 || from.row > 7 || from.col < 0 || from.col > 7 ||
        to.row < 0 || to.row > 7 || to.col < 0 || to.col > 7) {
      return false;
    }

    const piece = this.board[from.row][from.col];
    const targetPiece = this.board[to.row][to.col];
    if (!piece) return false;

    // Turno
    const pieceColor = piece.color;
    if (pieceColor !== this.turnoActual) {
      console.log("ERROR: No es el turno de esta pieza.");
      return false;
    }

    // No capturar propia pieza
    if (targetPiece && targetPiece.color === pieceColor) return false;

    const pieceType = piece.type;
    switch (pieceType) {
      case 'p': return this._esMovimientoValidoPeon(from, to, pieceColor);
      case 'n': return this._esMovimientoValidoCaballo(from, to);
      case 'r': return this._esMovimientoValidoTorre(from, to);
      case 'b': return this._esMovimientoValidoAlfil(from, to);
      case 'q': return this._esMovimientoValidoDama(from, to);
      case 'k': return this._esMovimientoValidoRey(from, to);
      default: return false;
    }
  }

  _esMovimientoValidoPeon(from, to, color) {
    const direction = color === COLORS.WHITE ? -1 : 1;
    const startRow = color === COLORS.WHITE ? 6 : 1;
    const rowDiff = to.row - from.row;
    const colDiff = Math.abs(to.col - from.col);
    const targetPiece = this.board[to.row][to.col];

    if (colDiff === 0 && rowDiff === direction) return targetPiece === null;
    if (colDiff === 0 && rowDiff === 2 * direction && from.row === startRow) {
      const interveningRow = from.row + direction;
      return targetPiece === null && this.board[interveningRow][from.col] === null;
    }
    if (colDiff === 1 && rowDiff === direction) {
      if (targetPiece !== null) return true;
      const last = this.historialMovimientos.length ? this.historialMovimientos[this.historialMovimientos.length - 1] : null;
      if (last && last.piece && last.piece.type === 'p' && last.piece.color !== color) {
        if (Math.abs(last.from.row - last.to.row) === 2 && last.to.row === from.row && last.to.col === to.col) {
          return true;
        }
      }
      return false;
    }
    return false;
  }

  _esMovimientoValidoCaballo(from, to) {
    const rowDiff = Math.abs(to.row - from.row);
    const colDiff = Math.abs(to.col - from.col);
    return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
  }

  _esMovimientoValidoTorre(from, to) {
    if (from.row !== to.row && from.col !== to.col) return false;
    return this._caminoLibre(from, to);
  }

  _esMovimientoValidoAlfil(from, to) {
    const rowDiff = Math.abs(to.row - from.row);
    const colDiff = Math.abs(to.col - from.col);
    if (rowDiff !== colDiff) return false;
    return this._caminoLibre(from, to);
  }

  _esMovimientoValidoDama(from, to) {
    const rowDiff = Math.abs(to.row - from.row);
    const colDiff = Math.abs(to.col - from.col);
    if (from.row === to.row || from.col === to.col || rowDiff === colDiff) {
      return this._caminoLibre(from, to);
    }
    return false;
  }

  _esMovimientoValidoRey(from, to) {
    const rowDiff = Math.abs(to.row - from.row);
    const colDiff = Math.abs(to.col - from.col);
    if (Math.max(rowDiff, colDiff) === 1) return true;

    if (rowDiff === 0 && Math.abs(colDiff) === 2) {
      const piece = this.board[from.row][from.col];
      if (!piece || piece.type !== 'k') return false;
      const dir = to.col - from.col > 0 ? 1 : -1;
      const rookCol = dir === 1 ? 7 : 0;
      const rook = this.board[from.row][rookCol];
  if (!rook || rook.type !== 'r' || rook.color !== piece.color) return false;
  if (rook.hasMoved || piece.hasMoved) return false;
  if (!this._caminoLibre(from, { row: from.row, col: rookCol })) return false;
      const opponent = piece.color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
      const pass1 = { row: from.row, col: from.col + dir };
      const pass2 = { row: from.row, col: from.col + 2 * dir };
      if (this.estaReyEnJaque(piece.color)) return false;
      if (this.casillaEstaAtacada(pass1, opponent) || this.casillaEstaAtacada(pass2, opponent)) return false;
      return true;
    }

    return false;
  }

  _caminoLibre(from, to) {
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
  generarMovimientos(from) {
    const moves = [];
    if (!this.board[from.row] || !this.board[from.row][from.col]) return moves;

    const piece = this.board[from.row][from.col];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const to = { row: r, col: c };
        if (this.esMovimientoValido(from, to)) {
          const target = this.board[r][c];
          const isCapture = !!target && target.color !== piece.color;
          moves.push({ row: r, col: c, capture: isCapture });
        }
      }
    }

    const legalMoves = moves.filter(m => !this._estariaEnJaqueTrasMovimiento(from, { row: m.row, col: m.col }));
    return legalMoves;
  }

  // Comprueba si una casilla está atacada por piezas de color `byColor`
  casillaEstaAtacada(square, byColor) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p || p.color !== byColor) continue;
        if (this._puedePiezaAlcanzar({ row: r, col: c }, square)) return true;
      }
    }
    return false;
  }

  // Devuelve la lista de atacantes de una casilla
  obtenerAtacantesDeCasilla(square, byColor) {
    const attackers = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p || p.color !== byColor) continue;
        if (this._puedePiezaAlcanzar({ row: r, col: c }, square)) attackers.push({ row: r, col: c });
      }
    }
    return attackers;
  }

  // Devuelve los atacantes del rey
  obtenerAtacantesDelRey(color) {
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
    return this.obtenerAtacantesDeCasilla(kingPos, opponent);
  }

  // Comprueba si el rey está en jaque
  estaReyEnJaque(color) {
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
    if (!kingPos) return false;
    const opponent = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
    return this.casillaEstaAtacada(kingPos, opponent);
  }

  // Comprueba si tras mover from->to el rey del color de la pieza estaría en jaque
  _estariaEnJaqueTrasMovimiento(from, to) {
    const moving = this.board[from.row][from.col];
    if (!moving) return false;

    const origFrom = this.board[from.row][from.col];
    const origTo = this.board[to.row][to.col];

    this.board[to.row][to.col] = origFrom ? { ...origFrom } : null;
    this.board[from.row][from.col] = null;

    const inCheck = this.estaReyEnJaque(moving.color);

    this.board[from.row][from.col] = origFrom;
    this.board[to.row][to.col] = origTo;

    return inCheck;
  }

  // Comprueba mate
  esJaqueMate(color) {
    if (!this.estaReyEnJaque(color)) return false;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p || p.color !== color) continue;
        const moves = this.generarMovimientos({ row: r, col: c });
        if (moves.length > 0) return false;
      }
    }
    return true;
  }

  // Comprueba si solo quedan reyes
  soloQuedanReyes() {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p) continue;
        if (p.type !== 'k') return false;
      }
    }
    return true;
  }

  // Comprueba alcance de pieza sin considerar turno
  _puedePiezaAlcanzar(from, to) {
    const p = this.board[from.row][from.col];
    if (!p) return false;
    const type = p.type;

    if (type === 'p') {
      const dir = p.color === COLORS.WHITE ? -1 : 1;
      const rowDiff = to.row - from.row;
      const colDiff = Math.abs(to.col - from.col);
      if (rowDiff === dir && colDiff === 1) return true;
      return false;
    }

    if (type === 'n') {
      const rowDiff = Math.abs(to.row - from.row);
      const colDiff = Math.abs(to.col - from.col);
      return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
    }

    if (type === 'k') {
      const rowDiff = Math.abs(to.row - from.row);
      const colDiff = Math.abs(to.col - from.col);
      return Math.max(rowDiff, colDiff) === 1;
    }

    const rowDiffAbs = Math.abs(to.row - from.row);
    const colDiffAbs = Math.abs(to.col - from.col);
    if (type === 'r') {
      if (from.row !== to.row && from.col !== to.col) return false;
      return this._caminoLibre(from, to);
    }
    if (type === 'b') {
      if (rowDiffAbs !== colDiffAbs) return false;
      return this._caminoLibre(from, to);
    }
    if (type === 'q') {
      if (from.row === to.row || from.col === to.col || rowDiffAbs === colDiffAbs) {
        return this._caminoLibre(from, to);
      }
      return false;
    }

    return false;
  }

  // Fin de la clase MotorAjedrez (API ahora en español)
}