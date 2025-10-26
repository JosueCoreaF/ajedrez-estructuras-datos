import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Image } from 'react-native';
import Board from '../components/Board';
import { ChessEngine } from '../engine/ChessEngine';
import PIECE_IMAGES from '../components/icons';

export default function GameScreen() {
	const engineRef = useRef();
	const [board, setBoard] = useState([]);
	const [selected, setSelected] = useState(null);
		const [status, setStatus] = useState('');
		const [highlights, setHighlights] = useState([]);
		const [attackers, setAttackers] = useState([]);
		const [gameOver, setGameOver] = useState(false);
		const [lastMove, setLastMove] = useState(null);

	useEffect(() => {
		// Inicializar el motor y cargar el tablero inicial
		engineRef.current = new ChessEngine();
		setBoard(engineRef.current.getBoard());
	}, []);

	const handleSquarePress = ({ row, col }) => {
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
					setStatus('Jaque mate');
					setGameOver(true);
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
			</View>
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
