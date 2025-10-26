import { ChessEngine } from '../src/engine/ChessEngine.js';

function parseMoves(logText) {
  const lines = logText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const moves = [];
  for (const line of lines) {
    // Only consider executed moves
    if (/Movimiento ejecutado:/.test(line)) {
      // Example: "Movimiento ejecutado: wp de 6,6 a 4,6"
      const m = line.match(/Movimiento ejecutado:\s*:\s*\w+\s+de\s+(\d+),(\d+)\s+a\s+(\d+),(\d+)/);
      if (m) {
        const from = { row: parseInt(m[1], 10), col: parseInt(m[2], 10) };
        const to = { row: parseInt(m[3], 10), col: parseInt(m[4], 10) };
        moves.push({ from, to, raw: line });
      }
    }
  }
  return moves;
}

const logText = `
Motor de Ajedrez Inicializado. Turno: Blanco
 LOG  Movimiento ejecutado: wp de 6,6 a 4,6
 LOG  Movimiento ejecutado: bp de 1,3 a 3,3
 LOG  Movimiento ejecutado: wp de 6,1 a 5,1
 LOG  Movimiento ejecutado: bp de 1,5 a 3,5
 LOG  Movimiento ejecutado: wn de 7,6 a 5,5
 LOG  Movimiento ejecutado: bp de 1,6 a 3,6
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ejecutado: wp de 5,1 a 4,1
 LOG  Movimiento ejecutado: bp de 1,4 a 3,4
 LOG  Movimiento ejecutado: wp de 6,4 a 4,4
 LOG  Movimiento ejecutado: bp de 3,3 a 4,3
 LOG  Movimiento ejecutado: wp de 6,3 a 5,3
 LOG  Movimiento ejecutado: bn de 0,6 a 1,4
 LOG  Movimiento ejecutado: wp de 4,6 a 3,5
 LOG  Movimiento ejecutado: bq de 0,3 a 3,3
 LOG  Movimiento ejecutado: wp de 6,2 a 5,2
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ejecutado: bp de 3,6 a 4,6
 LOG  Movimiento ejecutado: wp de 5,2 a 4,3
 LOG  Movimiento ejecutado: bq de 3,3 a 4,4
 LOG  Movimiento invalidado: dejaría al rey en jaque.
 LOG  Movimiento invalidado: dejaría al rey en jaque.
 LOG  Movimiento invalidado: dejaría al rey en jaque.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento invalidado: dejaría al rey en jaque.
 LOG  Movimiento invalidado: dejaría al rey en jaque.
 LOG  Movimiento invalidado: dejaría al rey en jaque.
 LOG  Movimiento invalidado: dejaría al rey en jaque.
 LOG  Movimiento ejecutado: wk de 7,4 a 6,3
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ejecutado: bp de 3,4 a 4,3
 LOG  Movimiento invalidado: dejaría al rey en jaque.
 LOG  Movimiento ejecutado: wk de 6,3 a 6,2
 LOG  Movimiento ejecutado: bq de 4,4 a 5,3
 LOG  Movimiento invalidado: dejaría al rey en jaque.
 LOG  Movimiento invalidado: dejaría al rey en jaque.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento invalidado: dejaría al rey en jaque.
 LOG  Movimiento invalidado: dejaría al rey en jaque.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ejecutado: wk de 6,2 a 6,1
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ejecutado: bp de 1,0 a 2,0
 LOG  Movimiento ejecutado: wp de 6,0 a 4,0
 LOG  Movimiento ejecutado: br de 0,0 a 1,0
 LOG  Movimiento ejecutado: wp de 4,1 a 3,1
 LOG  Movimiento ejecutado: bq de 5,3 a 6,2
 LOG  Movimiento invalidado: dejaría al rey en jaque.
 LOG  Movimiento invalidado: dejaría al rey en jaque.
 LOG  Movimiento ejecutado: wk de 6,1 a 5,0
 LOG  Movimiento ejecutado: bq de 6,2 a 6,1
 LOG  Movimiento invalidado: dejaría al rey en jaque.
 LOG  Movimiento invalidado: dejaría al rey en jaque.
 LOG  Movimiento invalidado: dejaría al rey en jaque.
 LOG  Movimiento invalidado: dejaría al rey en jaque.
 LOG  Movimiento ejecutado: wb de 7,2 a 6,1
 LOG  Movimiento ejecutado: bk de 0,4 a 1,3
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ejecutado: wb de 6,1 a 4,3
 LOG  Movimiento ejecutado: bp de 4,6 a 5,5
 LOG  Movimiento ejecutado: wp de 3,5 a 2,5
 LOG  Movimiento ejecutado: bb de 0,5 a 2,7
 LOG  Movimiento ejecutado: wb de 4,3 a 3,4
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento invalidado: dejaría al rey en jaque.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ejecutado: bb de 2,7 a 6,3
 LOG  Movimiento ejecutado: wq de 7,3 a 6,3
 LOG  Movimiento ejecutado: bn de 1,4 a 3,3
 LOG  Movimiento ejecutado: wb de 3,4 a 1,2
 LOG  Movimiento ejecutado: br de 0,7 a 0,6
 LOG  Movimiento ejecutado: wq de 6,3 a 3,3
 LOG  Movimiento ejecutado: bk de 1,3 a 1,2
 LOG  Movimiento ejecutado: wp de 3,1 a 2,1
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ejecutado: bk de 1,2 a 2,1
 LOG  Movimiento ejecutado: wn de 7,1 a 5,2
 LOG  Movimiento ejecutado: bb de 0,2 a 5,7
 LOG  Movimiento ejecutado: wn de 5,2 a 3,1
 LOG  Movimiento ejecutado: br de 0,6 a 1,6
 LOG  Movimiento ejecutado: wb de 7,5 a 4,2
 LOG  Movimiento ejecutado: br de 1,6 a 2,6
 LOG  Movimiento ejecutado: wq de 3,3 a 2,2
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ejecutado: bn de 0,1 a 2,2
 LOG  Movimiento ejecutado: wn de 3,1 a 1,0
 LOG  Movimiento ejecutado: br de 2,6 a 2,5
 LOG  Movimiento ejecutado: wr de 7,7 a 7,5
 LOG  Movimiento ejecutado: bb de 5,7 a 7,5
 LOG  Movimiento ejecutado: wk de 5,0 a 5,1
 LOG  Movimiento ejecutado: bk de 2,1 a 3,0
 LOG  Movimiento ejecutado: wb de 4,2 a 3,1
 LOG  Movimiento ejecutado: bk de 3,0 a 2,1
 LOG  Movimiento ejecutado: wn de 1,0 a 2,2
 LOG  Movimiento ejecutado: bp de 2,0 a 3,1
 LOG  Movimiento ejecutado: wk de 5,1 a 6,0
 LOG  Movimiento ejecutado: bb de 7,5 a 4,2
 LOG  Movimiento ejecutado: wk de 6,0 a 7,1
 LOG  Movimiento ejecutado: br de 2,5 a 2,2
 LOG  Movimiento ejecutado: wp de 4,0 a 3,1
 LOG  Movimiento ejecutado: bb de 4,2 a 3,1
 LOG  Movimiento ejecutado: wk de 7,1 a 6,0
 LOG  Movimiento ejecutado: bb de 3,1 a 4,2
 LOG  Movimiento ejecutado: wk de 6,0 a 7,1
 LOG  Movimiento ejecutado: bk de 2,1 a 3,1
 LOG  Movimiento ejecutado: wr de 7,0 a 2,0
 LOG  Movimiento ejecutado: br de 2,2 a 2,0
 LOG  Movimiento ejecutado: wk de 7,1 a 6,2
 LOG  Movimiento ejecutado: br de 2,0 a 6,0
 LOG  Movimiento ejecutado: wk de 6,2 a 7,1
 LOG  Movimiento ejecutado: bb de 4,2 a 5,3
 LOG  Movimiento ejecutado: wk de 7,1 a 7,2
 LOG  Movimiento ejecutado: br de 6,0 a 7,0
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento invalidado: dejaría al rey en jaque.
 LOG  Movimiento ejecutado: wk de 7,2 a 6,1
 LOG  Movimiento ejecutado: bb de 5,3 a 4,2
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ejecutado: wp de 6,7 a 4,7
 LOG  Movimiento ejecutado: bp de 1,7 a 2,7
 LOG  Movimiento ejecutado: wk de 6,1 a 7,0
 LOG  Movimiento ejecutado: bk de 3,1 a 4,1
 LOG  Movimiento ejecutado: wp de 4,7 a 3,7
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ejecutado: bb de 4,2 a 5,3
 LOG  Movimiento ejecutado: wk de 7,0 a 6,0
 LOG  Movimiento ejecutado: bk de 4,1 a 4,0
 LOG  Movimiento ejecutado: wk de 6,0 a 7,0
 LOG  Movimiento ejecutado: bp de 1,1 a 3,1
 LOG  Movimiento ejecutado: wk de 7,0 a 6,0
 LOG  Movimiento ejecutado: bp de 3,1 a 4,1
 LOG  Movimiento ejecutado: wk de 6,0 a 7,0
 LOG  Movimiento ejecutado: bp de 4,1 a 5,1
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento invalidado: dejaría al rey en jaque.
 LOG  Movimiento ejecutado: wk de 7,0 a 6,1
 LOG  Movimiento ejecutado: bb de 5,3 a 7,1
 LOG  Movimiento ejecutado: wk de 6,1 a 7,0
 LOG  Movimiento ejecutado: bp de 5,1 a 6,1
 LOG  Movimiento ejecutado: wk de 7,0 a 6,1
 LOG  Movimiento ejecutado: bk de 4,0 a 4,1
 LOG  Movimiento ejecutado: wk de 6,1 a 7,1
 LOG  Movimiento ejecutado: bk de 4,1 a 5,1
 LOG  Movimiento ejecutado: wk de 7,1 a 7,0
 LOG  Movimiento ejecutado: bk de 5,1 a 6,2
 LOG  Movimiento ejecutado: wk de 7,0 a 6,0
 LOG  Movimiento ejecutado: bk de 6,2 a 7,2
 LOG  Movimiento ejecutado: wk de 6,0 a 7,0
 LOG  Movimiento ejecutado: bk de 7,2 a 6,3
 LOG  Movimiento ejecutado: wk de 7,0 a 7,1
 LOG  Movimiento ejecutado: bk de 6,3 a 6,4
 LOG  Movimiento ejecutado: wk de 7,1 a 6,2
 LOG  Movimiento ejecutado: bk de 6,4 a 6,5
 LOG  Movimiento ejecutado: wk de 6,2 a 6,3
 LOG  Movimiento ejecutado: bk de 6,5 a 7,6
 LOG  Movimiento ejecutado: wk de 6,3 a 7,4
 LOG  Movimiento ejecutado: bp de 5,5 a 6,5
 LOG  Movimiento ejecutado: wk de 7,4 a 7,3
 LOG  Movimiento ejecutado: bp de 6,5 a 7,5
 LOG  Movimiento ejecutado: wk de 7,3 a 6,2
 LOG  Movimiento ejecutado: bq de 7,5 a 3,5
 LOG  Movimiento ejecutado: wk de 6,2 a 6,1
 LOG  Movimiento ejecutado: bq de 3,5 a 3,7
 LOG  Movimiento ejecutado: wk de 6,1 a 7,0
 LOG  Movimiento ejecutado: bq de 3,7 a 3,0
 LOG  Movimiento ejecutado: wk de 7,0 a 7,1
 LOG  Movimiento ejecutado: bp de 2,7 a 3,7
 LOG  Movimiento ejecutado: wk de 7,1 a 6,1
 LOG  Movimiento ejecutado: bp de 3,7 a 4,7
 LOG  Movimiento ejecutado: wk de 6,1 a 7,1
 LOG  Movimiento ejecutado: bk de 7,6 a 6,5
 LOG  Movimiento ejecutado: wk de 7,1 a 6,1
 LOG  Movimiento ejecutado: bp de 4,7 a 5,7
 LOG  Movimiento ejecutado: wk de 6,1 a 7,1
 LOG  Movimiento ejecutado: bp de 5,7 a 6,7
 LOG  Movimiento ejecutado: wk de 7,1 a 6,1
 LOG  Movimiento ejecutado: bp de 6,7 a 7,7
 LOG  Movimiento ejecutado: wk de 6,1 a 5,1
 LOG  Movimiento ejecutado: bq de 3,0 a 4,1
 LOG  Movimiento ejecutado: wk de 5,1 a 6,0
 LOG  Movimiento ejecutado: bq de 7,7 a 7,2
`;

async function main() {
  const engine = new ChessEngine();
  const moves = parseMoves(logText);
  console.log('Parsed moves:', moves.length);
  let moveNo = 0;
  for (const m of moves) {
    moveNo++;
    const ok = engine.movePiece(m.from, m.to);
    console.log(`${moveNo}. move ${m.from.row},${m.from.col} -> ${m.to.row},${m.to.col}: ${ok ? 'OK' : 'FAILED'}`);
  }

  // Find white king and black king positions
  function findKing(color) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = engine.board[r][c];
        if (p && p.type === 'k' && p.color === color) return { row: r, col: c };
      }
    }
    return null;
  }

  const whiteKing = findKing('w');
  const blackKing = findKing('b');
  console.log('White king at', whiteKing);
  console.log('Black king at', blackKing);

  const whiteInCheck = engine.isKingInCheck('w');
  const blackInCheck = engine.isKingInCheck('b');
  console.log('White in check?', whiteInCheck);
  console.log('Black in check?', blackInCheck);

  const whiteCheckmate = engine.isCheckmate('w');
  const blackCheckmate = engine.isCheckmate('b');
  console.log('White checkmate?', whiteCheckmate);
  console.log('Black checkmate?', blackCheckmate);

  // Legal moves for king whose turn it is
  const turn = engine.currentTurn;
  console.log('Current turn:', turn);
  const kingPos = turn === 'w' ? whiteKing : blackKing;
  if (kingPos) {
    const movesForKing = engine.generateMoves(kingPos);
    console.log('Legal moves for current king:', movesForKing);
    const attackers = engine.getAttackersOfKing(turn);
    console.log('Attackers of current king:', attackers);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
