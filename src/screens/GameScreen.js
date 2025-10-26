import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Image } from 'react-native';
import Board from '../components/Board';
import { ChessEngine } from '../engine/ChessEngine';
import PIECE_IMAGES from '../components/icons';
import { TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function GameScreen({ mode = 'local', replayLog = null, savedName = null, savedId = null, onExit }) {
	const engineRef = useRef();
	const [board, setBoard] = useState([]);
	const [selected, setSelected] = useState(null);
	const [status, setStatus] = useState('');
	const [loadedSavedId, setLoadedSavedId] = useState(null);
		const [highlights, setHighlights] = useState([]);
		const [attackers, setAttackers] = useState([]);
		const [gameOver, setGameOver] = useState(false);
		const [lastMove, setLastMove] = useState(null);

	useEffect(() => {
		// Inicializar el motor y cargar el tablero inicial
		engineRef.current = new ChessEngine();
		setBoard(engineRef.current.getBoard());
		// Si entramos en modo replay, reiniciamos el motor y cargamos el tablero inicial
		if (mode === 'replay' && replayLog) {
			// prepare engine for replay (animado si el usuario lanza reproducir)
			engineRef.current = new ChessEngine();
			setBoard(engineRef.current.getBoard());
		}

		// Si entramos en modo resume, aplicar inmediatamente los movimientos guardados
		if (mode === 'resume' && replayLog) {
			engineRef.current = new ChessEngine();
			const moves = parseMovesFromLog(replayLog);
			for (const m of moves) {
				// Intentar aplicar con el motor para mantener moveHistory y estado consistente
				const ok = engineRef.current.movePiece(m.from, m.to);
				if (!ok) {
					// Si por alguna razón el motor rechaza (log externo), aplicamos el movimiento directo
					const piece = engineRef.current.board[m.from.row][m.from.col];
					engineRef.current.board[m.to.row][m.to.col] = piece;
					engineRef.current.board[m.from.row][m.from.col] = null;
					// NOTA: en este fallback no se registra moveHistory correctamente, pero los logs guardados
					// que generó nuestra app deberían ser aplicables por movePiece.
				}
			}
			setBoard(engineRef.current.getBoard());
			// ajustar lastMove al último movimiento aplicado
			if (engineRef.current.moveHistory.length) {
				const lm = engineRef.current.moveHistory[engineRef.current.moveHistory.length - 1];
				setLastMove({ from: lm.from, to: lm.to });
			}
			// guardar metadata de la partida cargada para permitir actualizarla
			if (savedName) setSaveName(savedName);
			if (savedId) setLoadedSavedId(savedId);
			setStatus('Partida cargada: lista para continuar');
		}
	}, []);

	// --- Estado y helpers para guardar partida (local) ---
	const [saveModalVisible, setSaveModalVisible] = useState(false);
	const [saveName, setSaveName] = useState('');

	function buildLogFromHistory() {
		if (!engineRef.current) return '';
		const header = `Partida iniciada: ${new Date().toISOString()}`;
		const lines = (engineRef.current.moveHistory || []).map(m => {
			const pieceId = m.piece && m.piece.type ? `${m.piece.color}${m.piece.type}` : '??';
			return `Movimiento ejecutado: ${pieceId} de ${m.from.row},${m.from.col} a ${m.to.row},${m.to.col}`;
		});
		return [header].concat(lines).join('\n');
	}

	async function finalizeMatch(winnerColor) {
		try {
			const winnerName = winnerColor === 'w' ? 'Blancas' : 'Negras';
			const finalLog = buildLogFromHistory() + `\nPartida finalizada: ${new Date().toISOString()}\nResultado: Ganador: ${winnerName}`;
			const payload = {
				id: `match-${Date.now()}`,
				name: saveName || `Partida ${new Date().toISOString()}`,
				winner: winnerColor,
				winnerName,
				endedAt: new Date().toISOString(),
				movesCount: engineRef.current ? (engineRef.current.moveHistory || []).length : 0,
				log_text: finalLog
			};
			// Guardar en historial
			const rawHist = await AsyncStorage.getItem('match_history');
			const hist = rawHist ? JSON.parse(rawHist) : [];
			hist.push(payload);
			await AsyncStorage.setItem('match_history', JSON.stringify(hist));

			// Si la partida cargada venía de saved_games, eliminarla
			if (loadedSavedId) {
				const rawSaved = await AsyncStorage.getItem('saved_games');
				const savedArr = rawSaved ? JSON.parse(rawSaved) : [];
				const filtered = savedArr.filter(s => String(s.id) !== String(loadedSavedId));
				await AsyncStorage.setItem('saved_games', JSON.stringify(filtered));
				setLoadedSavedId(null);
			}
			setStatus(`Partida finalizada: Ganador ${winnerName}`);
		} catch (e) {
			console.warn('Error guardando historial de partida', e);
			setStatus('Partida finalizada (error guardando historial)');
		}
	}

	async function saveToLocal() {
		const payload = { id: `local-${Date.now()}`, name: saveName || `Partida ${new Date().toISOString()}`, log_text: buildLogFromHistory(), savedAt: new Date().toISOString() };
		try {
			setStatus('Guardando localmente...');
			const raw = await AsyncStorage.getItem('saved_games');
			const arr = raw ? JSON.parse(raw) : [];
			arr.push(payload);
			await AsyncStorage.setItem('saved_games', JSON.stringify(arr));
			setStatus('Partida guardada localmente');
			setSaveModalVisible(false);
			// Marcar que ahora la partida actual corresponde a la guardada (para futuras actualizaciones)
			setLoadedSavedId(payload.id);
		} catch (e) {
			setStatus('Error guardando localmente: ' + String(e));
		}
	}

	async function updateToLocal() {
		if (!loadedSavedId) {
			setStatus('No hay partida cargada para actualizar');
			return;
		}
		try {
			setStatus('Actualizando partida...');
			const raw = await AsyncStorage.getItem('saved_games');
			const arr = raw ? JSON.parse(raw) : [];
			const idx = arr.findIndex(g => String(g.id) === String(loadedSavedId));
			if (idx === -1) {
				setStatus('No se encontró la partida local para actualizar');
				return;
			}
			arr[idx].log_text = buildLogFromHistory();
			arr[idx].savedAt = new Date().toISOString();
			// keep name unless user changed it
			arr[idx].name = saveName || arr[idx].name;
			await AsyncStorage.setItem('saved_games', JSON.stringify(arr));
			setStatus('Partida actualizada');
		} catch (e) {
			setStatus('Error actualizando: ' + String(e));
		}
	}

	// --- Replayer state ---
	const [replayMoves, setReplayMoves] = useState([]);
	const [isPlaying, setIsPlaying] = useState(false);

	function parseMovesFromLog(logText) {
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

	async function playReplay(logText, speed = 500) {
		if (!logText) return;
		const moves = parseMovesFromLog(logText);
		setReplayMoves(moves);
		setIsPlaying(true);
		// reset engine
		engineRef.current = new ChessEngine();
		setBoard(engineRef.current.getBoard());
		for (let i = 0; i < moves.length; i++) {
			if (!isPlaying) break;
			const m = moves[i];
			// intentar mover con el engine (valida reglas)
			const ok = engineRef.current.movePiece(m.from, m.to);
			if (!ok) {
				// si falla, aplicar directamente (fallback)
				const piece = engineRef.current.board[m.from.row][m.from.col];
				engineRef.current.board[m.to.row][m.to.col] = piece;
				engineRef.current.board[m.from.row][m.from.col] = null;
			}
			setBoard(engineRef.current.getBoard());
			setLastMove({ from: m.from, to: m.to });
			await new Promise(res => setTimeout(res, speed));
		}
		setIsPlaying(false);
	}

	const handleSquarePress = async ({ row, col }) => {
		if (!engineRef.current) return;
		if (gameOver) {
			// Partida terminada: ignorar interacciones posteriores (status ya indica resultado)
			return;
		}

		const piece = board[row] && board[row][col];

		// Si no hay selección previa
		if (!selected) {
			if (!piece) {
				setStatus('Selecciona una pieza');
				return;
			}

					// La pieza ahora es un objeto { type, color }
					const pieceColor = piece.color;
			const currentTurn = engineRef.current.currentTurn || 'w';
			if (pieceColor !== currentTurn) {
				setStatus("No es el turno de esa pieza");
				return;
			}

			setSelected({ row, col });
					// Calcular movimientos posibles y resaltar
					const possible = engineRef.current.generateMoves({ row, col });
					setHighlights(possible);
			setStatus('Pieza seleccionada');
			return;
		}

		// Si se tocó la misma casilla, deseleccionar
		if (selected.row === row && selected.col === col) {
			setSelected(null);
			setHighlights([]);
			setAttackers([]);
			setAttackers([]);
			setStatus('');
			return;
		}

		// Si hay selección y el usuario tocó una pieza propia, cambiar selección en vez de intentar mover
		if (piece && piece.color === engineRef.current.currentTurn) {
			setSelected({ row, col });
			const possible = engineRef.current.generateMoves({ row, col });
			setHighlights(possible);
			setAttackers([]);
			setStatus('Pieza seleccionada');
			return;
		}

		// Intentar mover desde selected -> {row,col}
		const moved = engineRef.current.movePiece(selected, { row, col });
		if (moved) {
			setBoard(engineRef.current.getBoard());
			setSelected(null);
			setHighlights([]);
			setLastMove({ from: selected, to: { row, col } });

			// Comprobar empate por solo reyes
			if (engineRef.current.isOnlyKingsLeft && engineRef.current.isOnlyKingsLeft()) {
				setStatus('Empate: solo quedan los reyes');
				setAttackers([]);
				setGameOver(true);
				return;
			}
			// Después del movimiento, comprobar jaque / jaque mate para el oponente
			const opponent = engineRef.current.currentTurn; // ya fue cambiado en movePiece
			// Nota: el motor no elimina al rey ni debe permitir capturarlo.
			// Confiamos en la detección de jaque mate para terminar la partida.
			if (engineRef.current.isKingInCheck(opponent)) {
				const attackersList = engineRef.current.getAttackersOfKing(opponent);
				setAttackers(attackersList);
				if (engineRef.current.isCheckmate(opponent)) {
					// El oponente está en jaque mate -> el jugador que movió ha ganado
					const winner = opponent === 'w' ? 'b' : 'w';
					setStatus('Jaque mate');
					setGameOver(true);
					// Finalizar la partida: guardar en historial y eliminar la partida guardada si aplica
					await finalizeMatch(winner);
				} else {
					setStatus('Jaque');
				}
			} else {
				setStatus('Movimiento ejecutado');
				setAttackers([]);
			}
		} else {
			// Determinar por qué falló: ¿fue porque dejaría al rey en jaque?
			const eng = engineRef.current;
			let movingPiece = null;
			if (eng && eng.board && selected) movingPiece = eng.board[selected.row][selected.col];
			const wouldBeInCheck = eng && typeof eng._wouldBeInCheckAfterMove === 'function' && eng._wouldBeInCheckAfterMove(selected, { row, col });
			if (wouldBeInCheck) {
				// Simular el movimiento para calcular atacantes; si movemos el rey,
				// interesa quién ataca la casilla destino; si movemos otra pieza,
				// interesa quién atacaría al rey tras la retirada (ataque descubierto).
				const from = selected;
				const to = { row, col };
				const origFrom = eng.board[from.row][from.col];
				const origTo = eng.board[to.row][to.col];
				// Aplicar movimiento temporal
				eng.board[to.row][to.col] = origFrom ? { ...origFrom } : null;
				eng.board[from.row][from.col] = null;
				let attackersList = [];
				if (movingPiece && movingPiece.type === 'k') {
					// Si es el rey el que se mueve: atacantes sobre la casilla destino
					const opponent = movingPiece.color === 'w' ? 'b' : 'w';
					attackersList = eng.getAttackersOfSquare(to, opponent) || [];
					setStatus(`Movimiento inválido: la casilla estaría atacada por ${attackersList.length} pieza(s)`);
				} else {
					// Si es otra pieza: calculamos atacantes del rey después del movimiento
					const kingAttackers = eng.getAttackersOfKing(movingPiece.color) || [];
					attackersList = kingAttackers;
					setStatus(`Movimiento inválido: dejaría a tu rey en jaque por ${attackersList.length} pieza(s)`);
				}
				// Restaurar
				eng.board[from.row][from.col] = origFrom;
				eng.board[to.row][to.col] = origTo;
				setAttackers(attackersList);
			} else {
				setStatus('Movimiento inválido');
			}
			// Mantener la selección para intentar mover a otra casilla
		}
	};

	const restartGame = () => {
		engineRef.current = new ChessEngine();
		setBoard(engineRef.current.getBoard());
		// Limpiar todo el estado visual para evitar marcas residuales
		setSelected(null);
		setHighlights([]);
		setAttackers([]);
		setLastMove(null);
		setGameOver(false);
		setStatus('');
	};

	const undoLastMove = () => {
		if (!engineRef.current) return;
		const undone = engineRef.current.undoMove();
		if (undone) {
			// Actualizar tablero y limpiar resaltados
			setBoard(engineRef.current.getBoard());
			setSelected(null);
			setHighlights([]);
			setAttackers([]);
			setGameOver(false);
			setStatus('Movimiento deshecho');
			// Actualizar lastMove al movimiento anterior en el historial (o null si no hay)
			const mh = engineRef.current.moveHistory;
			if (mh && mh.length) {
				const lm = mh[mh.length - 1];
				setLastMove({ from: lm.from, to: lm.to });
			} else {
				setLastMove(null);
			}

			// Comprobar empate por solo reyes tras deshacer
			if (engineRef.current.isOnlyKingsLeft && engineRef.current.isOnlyKingsLeft()) {
				setStatus('Empate: solo quedan los reyes');
				setGameOver(true);
			} else {
				setGameOver(false);
			}
		} else {
			setStatus('No hay movimientos para deshacer');
		}
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Ajedrez — Tablero</Text>

			{mode === 'replay' && savedName ? <Text style={{ fontWeight: '600', marginBottom: 8 }}>Reproduciendo: {savedName}</Text> : null}
			{mode === 'replay' && replayLog ? (
				<View style={{ flexDirection: 'row', marginBottom: 8 }}>
					<TouchableOpacity style={styles.ctrlBtn} onPress={() => { if (!isPlaying) playReplay(replayLog); }}>
						<Text style={styles.ctrlText}>{isPlaying ? 'Reproduciendo...' : 'Reproducir'}</Text>
					</TouchableOpacity>
					<TouchableOpacity style={[styles.ctrlBtn, { backgroundColor: '#999' }]} onPress={() => { setIsPlaying(false); }}>
						<Text style={styles.ctrlText}>Pausar</Text>
					</TouchableOpacity>
					<TouchableOpacity style={[styles.ctrlBtn, { backgroundColor: '#666' }]} onPress={() => { onExit && onExit(); }}>
						<Text style={styles.ctrlText}>Salir</Text>
					</TouchableOpacity>
				</View>
			) : null}
			<Text style={styles.status}>{status}</Text>

			{/* Captured pieces panel */}
			<View style={styles.capturesRow}>
				{/* Piezas negras capturadas (capturadas por blancas) */}
				<View style={styles.captureColumn}>
					<Text style={styles.captureLabel}>Capturadas (negras)</Text>
					<View style={styles.captureList}>
						{engineRef.current && engineRef.current.getCapturedPieces().b.map((p, i) => {
							const key = `${p.color}${p.type}`;
							const src = PIECE_IMAGES[key];
							return src ? <Image key={i} source={src} style={styles.captureImg} /> : <Text key={i}>{key}</Text>;
						})}
					</View>
				</View>

				{/* Piezas blancas capturadas (capturadas por negras) */}
				<View style={styles.captureColumn}>
					<Text style={styles.captureLabel}>Capturadas (blancas)</Text>
					<View style={styles.captureList}>
						{engineRef.current && engineRef.current.getCapturedPieces().w.map((p, i) => {
							const key = `${p.color}${p.type}`;
							const src = PIECE_IMAGES[key];
							return src ? <Image key={i} source={src} style={styles.captureImg} /> : <Text key={i}>{key}</Text>;
						})}
					</View>
				</View>
			</View>
			{/* Controls bar */}
			<View style={styles.controls}>
				<TouchableOpacity style={styles.ctrlBtn} onPress={undoLastMove}>
					<Text style={styles.ctrlText}>Deshacer</Text>
				</TouchableOpacity>
				<TouchableOpacity style={styles.ctrlBtn} onPress={restartGame}>
					<Text style={styles.ctrlText}>Reiniciar</Text>
				</TouchableOpacity>
				<TouchableOpacity style={[styles.ctrlBtn, { backgroundColor: '#2a7f2a' }]} onPress={() => {
					if (loadedSavedId) {
						// Actualizar sin pedir nombre
						updateToLocal();
					} else {
						setSaveModalVisible(true);
					}
				}}>
					<Text style={styles.ctrlText}>Guardar</Text>
				</TouchableOpacity>
				<TouchableOpacity style={[styles.ctrlBtn, { backgroundColor: '#666' }]} onPress={() => { if (typeof onExit === 'function') onExit(); }}>
					<Text style={styles.ctrlText}>Salir</Text>
				</TouchableOpacity>
			</View>

			{/* Modal para guardar partida (local) */}
			<Modal visible={saveModalVisible} transparent animationType="fade">
				<View style={styles.modalBackdrop}>
					<View style={[styles.modalCard, { width: '90%' }] }>
						<Text style={styles.modalTitle}>Guardar partida (local)</Text>
						<TextInput placeholder="Nombre de la partida" value={saveName} onChangeText={setSaveName} style={{ width: '100%', borderWidth: 1, borderColor:'#ddd', padding:8, borderRadius:6, marginBottom:12 }} />
						<View style={{ flexDirection:'row', width:'100%' }}>
							<TouchableOpacity style={styles.btn} onPress={saveToLocal}><Text style={styles.btnText}>Guardar</Text></TouchableOpacity>
							<TouchableOpacity style={[styles.btn, styles.btnClose, { marginLeft: 8 }]} onPress={() => setSaveModalVisible(false)}><Text style={styles.btnText}>Cancelar</Text></TouchableOpacity>
						</View>
					</View>
				</View>
			</Modal>
			{/* Si hay jaque/attackers visibles, ocultamos el resaltado del último movimiento */}
			<Board board={board} onSquarePress={handleSquarePress} selected={selected} highlights={highlights} attackers={attackers} lastMove={attackers && attackers.length > 0 ? null : lastMove} />

			{/* Move history panel */}
			<View style={styles.historyContainer}>
				<Text style={styles.historyTitle}>Historial</Text>
				<ScrollView style={styles.historyList}>
					{engineRef.current && engineRef.current.moveHistory.map((m, idx) => {
						const pc = m.piece && m.piece.type ? `${m.piece.color}${m.piece.type}` : '??';
						return (
							<View key={idx} style={styles.historyItem}>
								<Text style={styles.historyText}>{idx + 1}. {pc} {m.from.row},{m.from.col} → {m.to.row},{m.to.col}{m.capturedPiece ? ` x ${m.capturedPiece.color}${m.capturedPiece.type}` : ''}{m.special && m.special.promoted ? ' (promo)' : ''}</Text>
							</View>
						)
						})}
				</ScrollView>
			</View>

			{/* Modal de fin de partida */}
			<Modal visible={gameOver} transparent animationType="fade">
				<View style={styles.modalBackdrop}>
					<View style={styles.modalCard}>
						<Text style={styles.modalTitle}>Partida terminada</Text>
						<Text style={styles.modalText}>{status || 'Jaque mate'}</Text>
						<View style={styles.modalButtons}>
							<TouchableOpacity style={styles.btn} onPress={restartGame}>
								<Text style={styles.btnText}>Reiniciar</Text>
							</TouchableOpacity>
							<TouchableOpacity style={styles.btn} onPress={undoLastMove}>
								<Text style={styles.btnText}>Deshacer</Text>
							</TouchableOpacity>
							<TouchableOpacity style={[styles.btn, styles.btnClose]} onPress={() => setGameOver(false)}>
								<Text style={styles.btnText}>Cerrar</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</Modal>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 16,
		backgroundColor: '#fff',
	},
	status: {
		marginBottom: 8,
		fontSize: 16,
		color: '#333',
	},
	modalBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.45)',
		alignItems: 'center',
		justifyContent: 'center',
	},
	modalCard: {
		width: '80%',
		backgroundColor: '#fff',
		padding: 18,
		borderRadius: 8,
		elevation: 6,
		alignItems: 'center',
	},
	modalTitle: {
		fontSize: 18,
		fontWeight: '700',
		marginBottom: 8,
	},
	modalText: {
		marginBottom: 12,
		textAlign: 'center',
	},
	modalButtons: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		width: '100%'
	},
	controls: {
		flexDirection: 'row',
		marginVertical: 8,
		width: '100%',
		justifyContent: 'center'
	},
	ctrlBtn: {
		paddingVertical: 8,
		paddingHorizontal: 14,
		backgroundColor: '#444',
		borderRadius: 6,
		marginHorizontal: 6,
	},
	ctrlText: {
		color: '#fff',
		fontWeight: '600'
	},
	btn: {
		flex: 1,
		padding: 10,
		marginHorizontal: 6,
		backgroundColor: '#2f95dc',
		borderRadius: 6,
		alignItems: 'center'
	},
	btnClose: {
		backgroundColor: '#999'
	},
	btnText: {
		color: '#fff',
		fontWeight: '600'
	},
	title: {
		fontSize: 20,
		fontWeight: '700',
		marginBottom: 12,
	},

	capturesRow: {
		width: '100%',
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 8,
	},
	captureColumn: {
		alignItems: 'center',
		flex: 1,
	},
	captureLabel: {
		fontSize: 12,
		color: '#444',
		marginBottom: 4,
	},
	captureList: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'center'
	},
	captureImg: {
		width: 28,
		height: 28,
		margin: 4,
	},

	historyContainer: {
		width: '100%',
		maxHeight: 140,
		marginTop: 10,
		borderTopWidth: 1,
		borderTopColor: '#eee',
		paddingTop: 8,
	},
	historyTitle: {
		fontWeight: '700',
		marginBottom: 6,
		textAlign: 'center'
	},
	historyList: {
		width: '100%'
	},
	historyItem: {
		paddingVertical: 4,
		paddingHorizontal: 8,
	},
	historyText: {
		color: '#333'
	},
});
