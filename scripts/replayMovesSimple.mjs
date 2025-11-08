// Simple replay script that doesn't import project modules. Reconstructs board by applying executed moves

const INITIAL_BOARD = [
  ['r','n','b','k','q','b','n','r'],
  ['p','p','p','p','p','p','p','p'],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  ['P','P','P','P','P','P','P','P'],
  ['R','N','B','Q','K','B','N','R'],
];

function makeBoard() {
  return INITIAL_BOARD.map(row => row.map(ch => {
    if (ch === null) return null;
    const isUpper = ch === ch.toUpperCase();
    return { type: ch.toLowerCase(), color: isUpper ? 'w' : 'b' };
  }));
}

function parseMoves(logText) {
  const lines = logText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const moves = [];
  for (const line of lines) {
    if (/Movimiento ejecutado:/.test(line)) {
      const m = line.match(/Movimiento ejecutado:\s*\w+\s+de\s+(\d+),(\d+)\s+a\s+(\d+),(\d+)/);
      if (m) {
        const from = { row: parseInt(m[1], 10), col: parseInt(m[2], 10) };
        const to = { row: parseInt(m[3], 10), col: parseInt(m[4], 10) };
        moves.push({ type: 'move', from, to, raw: line });
      }
    } else if (/Movimiento deshecho|Deshacer movimiento|^UNDO$/i.test(line)) {
      // Línea que indica deshacer el último movimiento
      moves.push({ type: 'undo', raw: line });
    }
  }
  return moves;
}

const logText = ` LOG  Movimiento ejecutado: wp de 6,4 a 4,4
 LOG  Movimiento ejecutado: bp de 1,4 a 3,4
 LOG  Movimiento ejecutado: wp de 6,3 a 4,3
 LOG  Movimiento ejecutado: bk de 0,4 a 1,4
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ejecutado: wp de 4,3 a 3,4
 LOG  Movimiento ejecutado: bk de 1,4 a 2,4
 LOG  Movimiento ejecutado: wp de 6,5 a 4,5
 LOG  Movimiento ejecutado: bk de 2,4 a 1,4
 LOG  Movimiento ejecutado: wp de 6,2 a 4,2
 LOG  Movimiento ejecutado: bk de 1,4 a 2,4
 LOG  Movimiento ejecutado: wp de 4,5 a 3,5
 LOG  Movimiento invalidado: dejaría al rey en jaque.
 LOG  Movimiento ejecutado: bk de 2,4 a 3,4
 LOG  Movimiento ejecutado: wq de 7,3 a 3,3
 LOG  Movimiento ejecutado: bk de 3,4 a 2,5
 LOG  Movimiento ejecutado: wp de 6,7 a 4,7
 LOG  Movimiento ejecutado: bk de 2,5 a 1,4
 LOG  Movimiento ejecutado: wq de 3,3 a 2,4
 LOG  Movimiento ejecutado: bp de 1,5 a 2,4
 LOG  Movimiento ejecutado: wp de 3,5 a 2,4
 LOG  Movimiento ejecutado: bp de 1,6 a 3,6
 LOG  Movimiento ejecutado: wp de 2,4 a 1,3
 LOG  Movimiento ejecutado: bp de 3,6 a 4,6
 LOG  Movimiento ejecutado: wb de 7,2 a 3,6
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ejecutado: bk de 1,4 a 1,3
 LOG  Movimiento ejecutado: wp de 4,2 a 3,2
 LOG  Movimiento ejecutado: bb de 0,5 a 3,2
 LOG  Movimiento ejecutado: wp de 4,4 a 3,4
 LOG  Movimiento ejecutado: bb de 3,2 a 7,6
 LOG  Movimiento ejecutado: wr de 7,7 a 7,6
 LOG  Movimiento ejecutado: bp de 1,7 a 3,7
 LOG  Movimiento ejecutado: wp de 3,4 a 2,4
 LOG  Movimiento ejecutado: bk de 1,3 a 2,4
 LOG  Movimiento ejecutado: wk de 7,4 a 6,4
 LOG  Movimiento ejecutado: bk de 2,4 a 3,3
 LOG  Movimiento ejecutado: wp de 6,6 a 5,6
 LOG  Movimiento ejecutado: bk de 3,3 a 4,2
 LOG  Movimiento ejecutado: wb de 7,5 a 6,6
 LOG  Movimiento ejecutado: bk de 4,2 a 4,3
 LOG  Movimiento ejecutado: wb de 6,6 a 4,4
 LOG  Movimiento ejecutado: bk de 4,3 a 4,2
 LOG  Movimiento ejecutado: wb de 4,4 a 5,3
 LOG  Movimiento ejecutado: bk de 4,2 a 3,2
 LOG  Movimiento ejecutado: wn de 7,1 a 5,0
 LOG  Movimiento ejecutado: bp de 1,2 a 2,2
 LOG  Movimiento ejecutado: wp de 6,1 a 4,1
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ejecutado: bk de 3,2 a 4,1
 LOG  Movimiento ejecutado: wn de 5,0 a 6,2
 LOG  Movimiento ejecutado: bk de 4,1 a 4,0
 LOG  Movimiento ejecutado: wb de 5,3 a 3,5
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ejecutado: bp de 2,2 a 3,2
 LOG  Movimiento ejecutado: wr de 7,0 a 7,1
 LOG  Movimiento ejecutado: bp de 3,2 a 4,2
 LOG  Movimiento ejecutado: wr de 7,1 a 1,1
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ejecutado: bp de 4,2 a 5,2
 LOG  Movimiento ejecutado: wb de 3,5 a 1,3
 LOG  Movimiento ejecutado: bq de 0,3 a 1,3
 LOG  Movimiento ejecutado: wb de 3,6 a 1,4
 LOG  Movimiento ejecutado: bq de 1,3 a 7,3
 LOG  Movimiento ejecutado: wr de 7,6 a 7,3
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ejecutado: bk de 4,0 a 3,0
 LOG  Movimiento ejecutado: wn de 6,2 a 4,3
 LOG  Movimiento ejecutado: bk de 3,0 a 2,0
 LOG  Movimiento ejecutado: wr de 1,1 a 2,1
 LOG  Movimiento ejecutado: bk de 2,0 a 2,1
 LOG  Movimiento ejecutado: wn de 4,3 a 2,2
 LOG  Movimiento ejecutado: bb de 0,2 a 3,5
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ejecutado: wb de 1,4 a 3,2
 LOG  Movimiento ejecutado: bk de 2,1 a 2,2
 LOG  Movimiento ejecutado: wr de 7,3 a 1,3
 LOG  Movimiento ejecutado: bk de 2,2 a 3,1
 LOG  Movimiento ejecutado: wp de 6,0 a 4,0
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ejecutado: bk de 3,1 a 2,0
 LOG  Movimiento ejecutado: wb de 3,2 a 2,1
 LOG  Movimiento ejecutado: bn de 0,1 a 2,2
 LOG  Movimiento ejecutado: wr de 1,3 a 0,3
 LOG  Movimiento ejecutado: bn de 2,2 a 1,4
 LOG  Movimiento ejecutado: wr de 0,3 a 0,0
 LOG  Movimiento ejecutado: bk de 2,0 a 1,1
 LOG  Movimiento ejecutado: wb de 2,1 a 1,0
 LOG  Movimiento ejecutado: bk de 1,1 a 2,0
 LOG  Movimiento ejecutado: wr de 0,0 a 0,1
 LOG  Movimiento ejecutado: bk de 2,0 a 3,0
 LOG  Movimiento ejecutado: wr de 0,1 a 3,1
 LOG  Movimiento ejecutado: bk de 3,0 a 4,0
 LOG  Movimiento ejecutado: wb de 1,0 a 3,2
 LOG  Movimiento ejecutado: bk de 4,0 a 3,1
 LOG  Movimiento ejecutado: wb de 3,2 a 1,4
 LOG  Movimiento ejecutado: bk de 3,1 a 4,2
 LOG  Movimiento ejecutado: wb de 1,4 a 2,5
 LOG  Movimiento ejecutado: bn de 0,6 a 2,5
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ejecutado: wk de 6,4 a 7,3
 LOG  Movimiento ejecutado: bp de 5,2 a 6,2
 LOG  Movimiento ejecutado: wk de 7,3 a 6,3
 LOG  Movimiento ejecutado: bp de 6,2 a 7,2
 LOG  Movimiento ejecutado: wk de 6,3 a 7,2
 LOG  Movimiento ejecutado: bb de 3,5 a 2,6
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ejecutado: wk de 7,2 a 6,1
 LOG  Movimiento ejecutado: bb de 2,6 a 7,1
 LOG  Movimiento ejecutado: wk de 6,1 a 7,0
 LOG  Movimiento ejecutado: br de 0,7 a 0,0
 LOG  Movimiento ejecutado: wk de 7,0 a 7,1
 LOG  Movimiento ejecutado: bk de 4,2 a 5,1
 LOG  Movimiento ejecutado: wk de 7,1 a 7,2
 LOG  Movimiento ejecutado: bn de 2,5 a 4,4
 LOG  Movimiento ejecutado: wk de 7,2 a 7,3
 LOG  Movimiento ejecutado: bn de 4,4 a 6,3
 LOG  Movimiento ejecutado: wk de 7,3 a 6,3
 LOG  Movimiento ejecutado: bk de 5,1 a 6,1
 LOG  Movimiento ejecutado: wk de 6,3 a 7,3
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ejecutado: br de 0,0 a 7,0
 LOG  Movimiento ejecutado: wk de 7,3 a 6,3
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ejecutado: bk de 6,1 a 7,1
 LOG  Movimiento ejecutado: wk de 6,3 a 5,4
 LOG  Movimiento ejecutado: br de 7,0 a 5,0
 LOG  Movimiento ejecutado: wk de 5,4 a 4,5
 LOG  Movimiento ILEGAL según las reglas de la pieza.
 LOG  Movimiento ejecutado: br de 5,0 a 5,4
 LOG  Movimiento ejecutado: wk de 4,5 a 3,6
 LOG  Movimiento ejecutado: br de 5,4 a 5,6
 LOG  Movimiento ejecutado: wk de 3,6 a 3,7
 LOG  Movimiento ejecutado: bk de 7,1 a 6,2
 LOG  Movimiento ejecutado: wk de 3,7 a 3,6
 LOG  Movimiento ejecutado: br de 5,6 a 5,7
 LOG  Movimiento ejecutado: wp de 4,7 a 3,7
 LOG  Movimiento ejecutado: br de 5,7 a 4,7
 LOG  Movimiento deshecho: br vuelto a 5,7
 LOG  Movimiento ejecutado: br de 5,7 a 3,7
 LOG  Movimiento ejecutado: wk de 3,6 a 3,7
 LOG  Movimiento ejecutado: bk de 6,2 a 5,3
 LOG  Movimiento ejecutado: wk de 3,7 a 4,6
 LOG  Movimiento ejecutado: bk de 5,3 a 4,4
 LOG  Movimiento ejecutado: wk de 4,6 a 5,6
 LOG  Movimiento ejecutado: bk de 4,4 a 3,3
 LOG  Movimiento ejecutado: wk de 5,6 a 4,5
`;

function applyMoves(board, moves) {
  const history = []; // historial de movimientos aplicados para soportar undo
  for (const m of moves) {
    if (m.type === 'move') {
      const { from, to } = m;
      // move without validation, pero registrar lo anterior
      const piece = board[from.row][from.col];
      const captured = board[to.row][to.col];
      history.push({ from, to, piece: piece ? { ...piece } : null, captured: captured ? { ...captured } : null });
      board[to.row][to.col] = piece;
      board[from.row][from.col] = null;
    } else if (m.type === 'undo') {
      // revertir el último movimiento aplicado
      const last = history.pop();
      if (!last) {
        console.log('Advertencia: intento de deshacer pero no hay historial');
        continue;
      }
      // Restaurar pieza movida a su origen
      board[last.from.row][last.from.col] = last.piece;
      // Restaurar pieza capturada (si la hubo)
      board[last.to.row][last.to.col] = last.captured || null;
    }
  }
}

function findKing(board, color) {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c];
    if (p && p.type === 'k' && p.color === color) return { row: r, col: c };
  }
  return null;
}

function inBounds(r,c){ return r>=0 && r<8 && c>=0 && c<8 }

function casillaEstaAtacada(board, square, byColor) {
  // check for pawn attacks
  const dir = byColor === 'w' ? -1 : 1; // pawns attack forward by color
  const r = square.row, c = square.col;
  // pawns
  const pawnRows = [{r: r - dir, c: c-1},{r: r - dir, c: c+1}];
  for (const pr of pawnRows) {
    if (inBounds(pr.r, pr.c)) {
      const p = board[pr.r][pr.c];
      if (p && p.color === byColor && p.type === 'p') return true;
    }
  }
  // knights
  const knights = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  for (const d of knights) {
    const nr = r + d[0], nc = c + d[1];
    if (inBounds(nr,nc)) {
      const p = board[nr][nc];
      if (p && p.color === byColor && p.type === 'n') return true;
    }
  }
  // king adjacency
  for (let dr=-1; dr<=1; dr++) for (let dc=-1; dc<=1; dc++) {
    if (dr===0 && dc===0) continue;
    const nr = r+dr, nc = c+dc;
    if (inBounds(nr,nc)){
      const p = board[nr][nc];
      if (p && p.color===byColor && p.type==='k') return true;
    }
  }
  // sliding pieces: rook/bishop/queen
  const directions = [ [-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1] ];
  for (const d of directions) {
    let nr = r + d[0], nc = c + d[1];
    while (inBounds(nr,nc)) {
      const p = board[nr][nc];
      if (p) {
        if (p.color === byColor) {
          const isDiag = Math.abs(d[0]) === Math.abs(d[1]);
          if (p.type === 'q') return true;
          if (!isDiag && p.type === 'r') return true;
          if (isDiag && p.type === 'b') return true;
        }
        break; // blocked
      }
      nr += d[0]; nc += d[1];
    }
  }
  return false;
}

function obtenerAtacantesDeCasilla(board, square, byColor) {
  const attackers = [];
  for (let r=0;r<8;r++) for (let c=0;c<8;c++){
    const p = board[r][c];
    if (!p || p.color!==byColor) continue;
  // comprobar si p alcanza la casilla usando la misma lógica que casillaEstaAtacada pero desde la pos de p
  // reutilizar casillaEstaAtacada moviendo temporalmente p? Más simple: comprobar por tipo
    const dr = square.row - r, dc = square.col - c;
    if (p.type==='p') {
      const dir = p.color === 'w' ? -1 : 1;
      if (dr === dir && Math.abs(dc) === 1) attackers.push({row:r,col:c});
      continue;
    }
    if (p.type==='n') {
      const moves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      for (const m of moves) if (r+m[0]===square.row && c+m[1]===square.col) attackers.push({row:r,col:c});
      continue;
    }
    if (p.type==='k') {
      if (Math.max(Math.abs(dr),Math.abs(dc))===1) attackers.push({row:r,col:c});
      continue;
    }
    // sliding
    if (p.type==='r' || p.type==='q' || p.type==='b') {
      const isDiag = Math.abs(dr) === Math.abs(dc) && dr!==0;
      const isStraight = (dr===0 && dc!==0) || (dc===0 && dr!==0);
      if ((isDiag && (p.type==='b' || p.type==='q')) || (isStraight && (p.type==='r' || p.type==='q'))) {
        // check path clear
        const stepR = dr === 0 ? 0 : dr/Math.abs(dr);
        const stepC = dc === 0 ? 0 : dc/Math.abs(dc);
        let rr = r + stepR, cc = c + stepC, blocked=false;
        while (rr!==square.row || cc!==square.col) {
          if (!inBounds(rr,cc)) { blocked=true; break; }
          if (board[rr][cc]) { blocked=true; break; }
          rr += stepR; cc += stepC;
        }
        if (!blocked) attackers.push({row:r,col:c});
      }
    }
  }
  return attackers;
}

function printBoard(board){
  for (let r=0;r<8;r++){
    console.log(board[r].map(p=>p? (p.color+p.type):'.').join(' '));
  }
}

function main(){
  const board = makeBoard();
  const moves = parseMoves(logText);
  applyMoves(board, moves);
  console.log('Movimientos aplicados:', moves.length);
  printBoard(board);

  const whiteKing = findKing(board,'w');
  const blackKing = findKing(board,'b');
  console.log('Rey blanco', whiteKing);
  console.log('Rey negro', blackKing);

  console.log('¿Rey blanco en jaque?', casillaEstaAtacada(board, whiteKing, 'b'));
  console.log('¿Rey negro en jaque?', casillaEstaAtacada(board, blackKing, 'w'));

}

main();
