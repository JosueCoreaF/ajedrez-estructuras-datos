import { MotorAjedrez } from '../engine/ChessEngine';

export function tipoPiezaEsp(type) {
  if (!type) return '';
  switch (type.toLowerCase()) {
    case 'k': return 'R'; // Rey
    case 'q': return 'D'; // Dama
    case 'r': return 'T'; // Torre
    case 'b': return 'A'; // Alfil
    case 'n': return 'C'; // Caballo
    case 'p': return 'p'; // Peón
    default: return type.toUpperCase();
  }
}

export function squareToAlgebraic({ row, col }) {
  if (row == null || col == null) return '??';
  const file = String.fromCharCode(97 + col); // a..h
  const rank = 8 - row; // row 0 -> 8
  return `${file}${rank}`;
}

export function moveToSAN(move, engineInstance) {
  if (!move || !move.piece) return '??';
  const color = move.piece.color;
  const type = (move.piece.type || 'p').toLowerCase();
  // Detect castling by king moving two cols
  if (type === 'k' && Math.abs(move.from.col - move.to.col) === 2) {
    return move.to.col > move.from.col ? 'O-O' : 'O-O-O';
  }
  const dest = squareToAlgebraic(move.to);
  const isCapture = !!(move.capturedPiece || move.capture);
  const promo = move.special && move.special.promoted ? '=' + tipoPiezaEsp(move.special.promotedTo || 'q') : '';

  const pieceLetter = type === 'p' ? '' : tipoPiezaEsp(type);

  let disamb = '';
  if (type !== 'p') {
    const board = engineInstance.obtenerTablero();
    const candidates = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type && p.type.toLowerCase() === type && p.color === color) {
          if (r === move.from.row && c === move.from.col) continue;
          const moves = engineInstance.generarMovimientos({ row: r, col: c }) || [];
          if (moves.find(m => m.row === move.to.row && m.col === move.to.col)) {
            candidates.push({ row: r, col: c });
          }
        }
      }
    }
    if (candidates.length > 0) {
      const sameFile = candidates.every(x => x.col === move.from.col);
      const sameRank = candidates.every(x => x.row === move.from.row);
      if (!sameFile) disamb = String.fromCharCode(97 + move.from.col);
      else if (!sameRank) disamb = String(8 - move.from.row);
      else disamb = String.fromCharCode(97 + move.from.col);
    }
  }

  if (type === 'p') {
    if (isCapture) {
      const fromFile = String.fromCharCode(97 + move.from.col);
      return `${fromFile}x${dest}${promo}`;
    }
    return `${dest}${promo}`;
  }

  const capMark = isCapture ? 'x' : '';
  return `${pieceLetter}${disamb}${capMark}${dest}${promo}`;
}

export function buildAlgebraicPairs(engineInstance) {
  const hist = engineInstance ? (engineInstance.historialMovimientos || []) : [];
  const tempEngine = new MotorAjedrez();
  const pairs = [];
  for (let i = 0; i < hist.length; i++) {
    const mv = hist[i];
    const san = moveToSAN(mv, tempEngine);
    const pieceKey = mv.piece && mv.piece.type ? `${mv.piece.color}${mv.piece.type}` : null;
    const ok = tempEngine.moverPieza(mv.from, mv.to);
    if (!ok) {
      const piece = tempEngine.board[mv.from.row][mv.from.col];
      tempEngine.board[mv.to.row][mv.to.col] = piece;
      tempEngine.board[mv.from.row][mv.from.col] = null;
    }
    if (i % 2 === 0) {
      pairs.push({ no: Math.floor(i / 2) + 1, white: san, whitePiece: pieceKey, black: '', blackPiece: null });
    } else {
      pairs[pairs.length - 1].black = san;
      pairs[pairs.length - 1].blackPiece = pieceKey;
    }
  }
  return pairs;
}

export function parseMovesFromLog(logText) {
  const lines = String(logText).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const moves = [];
  for (const line of lines) {
    const m = line.match(/Movimiento ejecutado:\s*\w+\s+de\s+(\d+),(\d+)\s+a\s+(\d+),(\d+)/);
    if (m) {
      moves.push({ from: { row: parseInt(m[1], 10), col: parseInt(m[2], 10) }, to: { row: parseInt(m[3], 10), col: parseInt(m[4], 10) }, raw: line });
    }
  }
  return moves;
}

export function buildLogFromHistory(engineInstance) {
  if (!engineInstance) return '';
  const header = `Partida iniciada: ${new Date().toISOString()}`;
  const lines = (engineInstance.historialMovimientos || []).map(m => {
    const tipo = m.piece && m.piece.type ? tipoPiezaEsp(m.piece.type) : '??';
    const pieceId = m.piece && m.piece.type ? `${m.piece.color}${tipo}` : '??';
    return `Movimiento ejecutado: ${pieceId} de ${m.from.row},${m.from.col} a ${m.to.row},${m.to.col}`;
  });
  return [header].concat(lines).join('\n');
}
