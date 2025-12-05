import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Image } from 'react-native';
import Board from '../components/Board';
import { MotorAjedrez } from '../engine/ChessEngine';
import PIECE_IMAGES from '../components/icons';
import { TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from '../utils/supabaseClient';
import * as Clipboard from 'expo-clipboard';

export default function GameScreen({ mode = 'local', replayLog = null, savedName = null, savedId = null, roomId = null, inviteCode: inviteCodeProp = null, onExit }) {
	const engineRef = useRef();
	const [board, setBoard] = useState([]);
	const [selected, setSelected] = useState(null);
	const [status, setStatus] = useState('');
	const [loadedSavedId, setLoadedSavedId] = useState(null);
	const [loadedSharedId, setLoadedSharedId] = useState(null); // id en shared_games (Supabase)
    const roomChannelRef = useRef(null);
    const myUserRef = useRef(null);
	const participantsChannelRef = useRef(null);
	const [participants, setParticipants] = useState([]);
	// start in waiting state for multiplayer to avoid flashing the board briefly
	const [waitingForOpponent, setWaitingForOpponent] = useState(mode === 'multiplayer');
	const [inviteCode, setInviteCode] = useState(inviteCodeProp || null);
	const [roomOwnerId, setRoomOwnerId] = useState(null);
	const [myColor, setMyColor] = useState(null);
		const [highlights, setHighlights] = useState([]);
		const [attackers, setAttackers] = useState([]);
		const [gameOver, setGameOver] = useState(false);
		const [lastMove, setLastMove] = useState(null);

	useEffect(() => {
	// Inicializar el motor y cargar el tablero inicial
	engineRef.current = new MotorAjedrez();
	setBoard(engineRef.current.obtenerTablero());
		// Si entramos en modo replay, reiniciamos el motor y cargamos el tablero inicial
		if (mode === 'replay' && replayLog) {
			// prepare engine for replay (animado si el usuario lanza reproducir)
			engineRef.current = new MotorAjedrez();
			setBoard(engineRef.current.obtenerTablero());
		}

		// Si entramos en modo resume, aplicar inmediatamente los movimientos guardados
		if (mode === 'resume' && replayLog) {
			engineRef.current = new MotorAjedrez();
			const moves = parseMovesFromLog(replayLog);
			for (const m of moves) {
				// Intentar aplicar con el motor para mantener historialMovimientos y estado consistente
				const ok = engineRef.current.moverPieza(m.from, m.to);
				if (!ok) {
					// Si por alguna razón el motor rechaza (log externo), aplicamos el movimiento directo
					const piece = engineRef.current.board[m.from.row][m.from.col];
					engineRef.current.board[m.to.row][m.to.col] = piece;
					engineRef.current.board[m.from.row][m.from.col] = null;
					// NOTA: en este fallback no se registra historialMovimientos correctamente, pero los logs guardados
					// que generó nuestra app deberían ser aplicables por moverPieza.
				}
			}
			setBoard(engineRef.current.obtenerTablero());
			// ajustar lastMove al último movimiento aplicado
			if (engineRef.current.historialMovimientos.length) {
				const lm = engineRef.current.historialMovimientos[engineRef.current.historialMovimientos.length - 1];
				setLastMove({ from: lm.from, to: lm.to });
			}
			// guardar metadata de la partida cargada para permitir actualizarla
			if (savedName) setSaveName(savedName);
			if (savedId) setLoadedSavedId(savedId);
			setStatus('Partida cargada: lista para continuar');
		}

		// obtener usuario actual si auth disponible
		(async () => {
			try {
				const r = await supabase.auth.getUser();
				myUserRef.current = r?.data?.user || r?.user || null;
			} catch (_) { myUserRef.current = null; }
		})();

		// cleanup on unmount: unsubscribe realtime and participants
		return () => {
			try { unsubscribeRoom(); } catch (_) {}
			try { unsubscribeParticipants(); } catch (_) {}
		};
	}, []);

		// Desactivar rotación automática en modo multijugador
		useEffect(() => {
			if (mode === 'multiplayer') {
				setAutoRotateEnabled(false);
			}
		}, [mode]);

	// If a roomId prop is passed (joining), use it to load & subscribe
	useEffect(() => {
		if (mode === 'multiplayer' && roomId) {
			setLoadedSharedId(roomId);
		}
	}, [roomId]);

	// When loadedSharedId changes, initialize room state + subscription
	useEffect(() => {
		if (mode === 'multiplayer' && loadedSharedId) {
			loadRoomState(loadedSharedId).then(() => subscribeToRoom(loadedSharedId, async (rec) => {
				try {
					const myId = myUserRef.current?.id || null;
					if (rec.by_user && myId && rec.by_user === myId) return;
					const from = { row: rec.from_row, col: rec.from_col };
					const to = { row: rec.to_row, col: rec.to_col };
					const ok = engineRef.current.moverPieza(from, to);
					if (!ok) {
						const piece = engineRef.current.board[from.row][from.col];
						engineRef.current.board[to.row][to.col] = piece;
						engineRef.current.board[from.row][from.col] = null;
					}
					setBoard(engineRef.current.obtenerTablero());
					setLastMove({ from, to });
				} catch (e) { console.warn('remote move handler', e); }
			}));

			// load participants and subscribe to changes
			loadParticipants(loadedSharedId).then(() => subscribeToParticipants(loadedSharedId, (evt) => {
				// reload participants on any event
				loadParticipants(loadedSharedId);
				if (evt && evt.action === 'INSERT') {
					// if second participant joined, clear waiting flag
					const parts = participantsChannelRef.current; // just for trace
					setWaitingForOpponent(false);
				}
			}));
		}
	}, [loadedSharedId]);

	// --- Participants helpers (wait room) ---

	async function loadParticipants(roomId) {
		try {
				const { data, error } = await supabase.from('shared_game_participants').select('*').eq('room_id', roomId).order('joined_at', { ascending: true });
				if (error) {
					console.warn('loadParticipants error', error);
					return;
				}
				setParticipants(data || []);
				console.log('loadParticipants ->', data || []);
				const parts = data || [];
				setWaitingForOpponent(parts.length < 2);
				// determine my color if I'm a participant
				try {
					const myId = myUserRef.current?.id || null;
					if (myId) {
						const mine = parts.find(p => String(p.user_id) === String(myId));
						if (mine && mine.color) {
							setMyColor(mine.color);
							// flip board for black players
							setFlipBoard(mine.color === 'b');
						} else {
							setMyColor(null);
						}
					}
					// If there are now 2 or more participants, ensure the room is initialized and subscribed
					if (parts.length >= 2) {
						setWaitingForOpponent(false);
						try {
							if (!roomChannelRef.current) {
								await loadRoomState(roomId);
								subscribeToRoom(roomId, async (rec) => {
									try {
										console.log('remote move received', rec);
										const myId2 = myUserRef.current?.id || null;
										if (rec.by_user && myId2 && rec.by_user === myId2) return;
										const from = { row: rec.from_row, col: rec.from_col };
										const to = { row: rec.to_row, col: rec.to_col };
										const ok = engineRef.current.moverPieza(from, to);
										if (!ok) {
											const piece = engineRef.current.board[from.row][from.col];
											engineRef.current.board[to.row][to.col] = piece;
											engineRef.current.board[from.row][from.col] = null;
										}
										setBoard(engineRef.current.obtenerTablero());
										setLastMove({ from, to });
									} catch (e) { console.warn('remote move handler', e); }
								});
							}
						} catch (e) { console.warn('ensure subscribe after participants', e); }
					}
				} catch (e) { console.warn('determine myColor error', e); }
			} catch (e) { console.warn('loadParticipants exception', e); }
	}

	function subscribeToParticipants(roomId, onEvent) {
		try {
			// unsubscribe if exists
			if (participantsChannelRef.current) {
				try { participantsChannelRef.current.unsubscribe(); } catch (_) {}
				participantsChannelRef.current = null;
			}
			const chan = supabase.channel(`room-participants:${roomId}`);
			chan.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shared_game_participants', filter: `room_id=eq.${roomId}` }, (payload) => {
				onEvent({ action: 'INSERT', record: payload.new });
			});
			chan.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'shared_game_participants', filter: `room_id=eq.${roomId}` }, (payload) => {
				onEvent({ action: 'DELETE', record: payload.old });
			});
			chan.subscribe();
			participantsChannelRef.current = chan;
			return chan;
		} catch (e) { console.warn('subscribeToParticipants error', e); }
	}

	function unsubscribeParticipants() {
		try {
			if (participantsChannelRef.current) {
				try { participantsChannelRef.current.unsubscribe(); } catch (_) {}
				participantsChannelRef.current = null;
			}
		} catch (e) { console.warn('unsubscribeParticipants', e); }
	}

	// --- Estado y helpers para guardar partida (local) ---
	const [saveModalVisible, setSaveModalVisible] = useState(false);
	const [saveName, setSaveName] = useState('');

	function buildLogFromHistory() {
		if (!engineRef.current) return '';
		const header = `Partida iniciada: ${new Date().toISOString()}`;
	const lines = (engineRef.current.historialMovimientos || []).map(m => {
			const tipo = m.piece && m.piece.type ? tipoPiezaEsp(m.piece.type) : '??';
			const pieceId = m.piece && m.piece.type ? `${m.piece.color}${tipo}` : '??';
			return `Movimiento ejecutado: ${pieceId} de ${m.from.row},${m.from.col} a ${m.to.row},${m.to.col}`;
		});
		return [header].concat(lines).join('\n');
	}

	// --- Notación algebraica (español) para historial ---
	function squareToAlgebraic({ row, col }) {
		if (row == null || col == null) return '??';
		const file = String.fromCharCode(97 + col); // a..h
		const rank = 8 - row; // row 0 -> 8
		return `${file}${rank}`;
	}

	function moveToSAN(move, engineInstance) {
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

		// Piece letter in Spanish (empty for pawns)
		const pieceLetter = type === 'p' ? '' : tipoPiezaEsp(type);

		// Disambiguation: check if other same-type pieces of same color can also reach dest
		let disamb = '';
		if (type !== 'p') {
			const board = engineInstance.obtenerTablero();
			const candidates = [];
			for (let r = 0; r < 8; r++) {
				for (let c = 0; c < 8; c++) {
					const p = board[r][c];
					if (p && p.type && p.type.toLowerCase() === type && p.color === color) {
						// skip the moving piece origin
						if (r === move.from.row && c === move.from.col) continue;
						// generate moves for this piece and see if it can reach dest
						const moves = engineInstance.generarMovimientos({ row: r, col: c }) || [];
						if (moves.find(m => m.row === move.to.row && m.col === move.to.col)) {
							candidates.push({ row: r, col: c });
						}
					}
				}
			}
			if (candidates.length > 0) {
				// If multiple, include file or rank as needed. Prefer file if files differ.
				const sameFile = candidates.every(x => x.col === move.from.col);
				const sameRank = candidates.every(x => x.row === move.from.row);
				if (!sameFile) disamb = String.fromCharCode(97 + move.from.col);
				else if (!sameRank) disamb = String(8 - move.from.row);
				else disamb = String.fromCharCode(97 + move.from.col);
			}
		}

		// Pawn captures include file of origin (exd5)
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

	function buildAlgebraicPairs() {
		const hist = engineRef.current ? (engineRef.current.historialMovimientos || []) : [];
		const tempEngine = new MotorAjedrez();
		const pairs = [];
		for (let i = 0; i < hist.length; i++) {
			const mv = hist[i];
			// Use tempEngine in current state to compute SAN for this move
			const san = moveToSAN(mv, tempEngine);
			// determine piece key for icon (e.g., 'wp','bq')
			const pieceKey = mv.piece && mv.piece.type ? `${mv.piece.color}${mv.piece.type}` : null;
			// apply the move on tempEngine to keep it in sync
			const ok = tempEngine.moverPieza(mv.from, mv.to);
			if (!ok) {
				// fallback: apply raw
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
				movesCount: engineRef.current ? (engineRef.current.historialMovimientos || []).length : 0,
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

	// --- Supabase remote (shared_games) ---
	async function createRemoteRoom() {
		try {
			setStatus('Creando sala remota...');
			// try v2 auth getUser() first
			let user = null;
			if (supabase.auth && typeof supabase.auth.getUser === 'function') {
				const res = await supabase.auth.getUser();
				user = res?.data?.user || res?.user || null;
			} else if (supabase.auth && typeof supabase.auth.user === 'function') {
				user = supabase.auth.user();
			}
			if (!user) {
				setStatus('Necesitas iniciar sesión para crear una sala remota');
				return;
			}
			const payload = {
				owner_id: user.id,
				name: saveName || `Partida ${new Date().toISOString()}`,
				log_text: buildLogFromHistory(),
				public: false,
				metadata: {}
			};
			const { data, error } = await supabase.from('shared_games').insert([payload]).select().single();
			if (error) {
				setStatus('Error creando sala remota: ' + (error.message || String(error)));
				return;
			}
			setLoadedSharedId(data.id);
			// set current user id ref
			try {
				const resUser = await supabase.auth.getUser();
				myUserRef.current = resUser?.data?.user || resUser?.user || null;
			} catch (_) { myUserRef.current = null; }
			// Copiar id al portapapeles
			try { await Clipboard.setStringAsync(String(data.id)); } catch (_) {}
			setStatus('Sala creada. ID copiado al portapapeles: ' + String(data.id));
			// After creating, if in multiplayer mode, initialize room state and subscribe
			if (mode === 'multiplayer') {
				// small delay to allow DB to register the room
				setTimeout(() => {
					loadRoomState(data.id).then(() => subscribeToRoom(data.id, async (rec) => {
						// handle remote move event
						try {
							const myId = myUserRef.current?.id || null;
							if (rec.by_user && myId && rec.by_user === myId) return; // ignore own inserts
							const from = { row: rec.from_row, col: rec.from_col };
							const to = { row: rec.to_row, col: rec.to_col };
							const ok = engineRef.current.moverPieza(from, to);
							if (!ok) {
								const piece = engineRef.current.board[from.row][from.col];
								engineRef.current.board[to.row][to.col] = piece;
								engineRef.current.board[from.row][from.col] = null;
							}
							setBoard(engineRef.current.obtenerTablero());
							setLastMove({ from, to });
						} catch (e) { console.warn('remote move handler', e); }
					}));
				}, 250);
			}
		} catch (e) {
			setStatus('Error creando sala remota: ' + String(e));
		}
	}

		// --- Real-time & room state helpers (moved to top-level of component) ---
		async function loadRoomState(roomId) {
			try {
				setStatus('Cargando estado de la sala...');
				// also try to load room metadata (invite code)
				try {
					const { data: gameMeta, error: gmErr } = await supabase.from('shared_games').select('metadata, owner_id').eq('id', roomId).maybeSingle();
					if (gmErr) console.warn('loadRoomState metadata error', gmErr);
					if (gameMeta && gameMeta.metadata && gameMeta.metadata.invite_code) setInviteCode(gameMeta.metadata.invite_code);
					if (gameMeta && gameMeta.owner_id) setRoomOwnerId(gameMeta.owner_id);
				} catch (me) { console.warn('metadata fetch error', me); }
				const { data, error } = await supabase
					.from('shared_game_moves')
					.select('*')
					.eq('room_id', roomId)
					.order('created_at', { ascending: true });
				if (error) {
					console.warn('Error loading room moves', error);
					setStatus('Error cargando movimientos de la sala');
					return;
				}
				// Recreate engine and apply moves sequentially
				const temp = new MotorAjedrez();
				for (const rec of data || []) {
					const from = { row: rec.from_row, col: rec.from_col };
					const to = { row: rec.to_row, col: rec.to_col };
					const ok = temp.moverPieza(from, to);
					if (!ok) {
						const piece = temp.board[from.row][from.col];
						temp.board[to.row][to.col] = piece;
						temp.board[from.row][from.col] = null;
					}
				}
				engineRef.current = temp;
				setBoard(engineRef.current.obtenerTablero());
				if (data && data.length) {
					const last = data[data.length - 1];
					setLastMove({ from: { row: last.from_row, col: last.from_col }, to: { row: last.to_row, col: last.to_col } });
				}
				setStatus('Estado de sala cargado');
			} catch (e) {
				console.warn('loadRoomState error', e);
				setStatus('Error cargando sala');
			}
		}

		function subscribeToRoom(roomId, onRemoteMove) {
			try {
				if (roomChannelRef.current) {
					try { roomChannelRef.current.unsubscribe(); } catch (_) {}
					roomChannelRef.current = null;
				}
				const chan = supabase.channel(`room:${roomId}`);
				chan.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shared_game_moves', filter: `room_id=eq.${roomId}` }, (payload) => {
					const rec = payload?.new;
					if (rec) onRemoteMove(rec);
				});
				chan.subscribe();
				roomChannelRef.current = chan;
				setStatus(s => (s ? s + ' · Suscrito a sala' : 'Suscrito a sala'));
				return chan;
			} catch (e) {
				console.warn('subscribeToRoom error', e);
				setStatus('Error suscribiendo a sala');
			}
		}

		function unsubscribeRoom() {
			try {
				if (roomChannelRef.current) {
					try { roomChannelRef.current.unsubscribe(); } catch (_) {}
					roomChannelRef.current = null;
				}
			} catch (e) { console.warn('unsubscribeRoom', e); }
		}

		async function sendMoveToRoom(roomId, move) {
			try {
				if (!roomId) return;
				const user = myUserRef.current;
				const payload = {
					room_id: roomId,
					from_row: move.from.row,
					from_col: move.from.col,
					to_row: move.to.row,
					to_col: move.to.col,
					piece_type: move.piece?.type || null,
					piece_color: move.piece?.color || null,
					san: move.san || null,
					by_user: user?.id || null
				};
				const { data, error } = await supabase.from('shared_game_moves').insert([payload]).select();
				if (error) {
					console.warn('sendMoveToRoom error', error);
					setStatus('Error enviando movimiento');
				}
			} catch (e) {
				console.warn('sendMoveToRoom exception', e);
				setStatus('Error enviando movimiento');
			}
		}

	async function updateRemoteRoom() {
		try {
			if (!loadedSharedId) {
				setStatus('No hay sala remota cargada para actualizar');
				return;
			}

		
			setStatus('Actualizando sala remota...');
			let user = null;
			if (supabase.auth && typeof supabase.auth.getUser === 'function') {
				const res = await supabase.auth.getUser();
				user = res?.data?.user || res?.user || null;
			} else if (supabase.auth && typeof supabase.auth.user === 'function') {
				user = supabase.auth.user();
			}
			if (!user) {
				setStatus('Necesitas iniciar sesión para actualizar la sala remota');
				return;
			}
			const updates = { log_text: buildLogFromHistory() };
			if (saveName) updates.name = saveName;
			const { data, error } = await supabase.from('shared_games').update(updates).eq('id', loadedSharedId).eq('owner_id', user.id).select().single();
			if (error) {
				setStatus('Error actualizando sala remota: ' + (error.message || String(error)));
				return;
			}
			setStatus('Sala remota actualizada: ' + String(loadedSharedId));
			// if we haven't subscribed yet and in multiplayer, initialize
			if (mode === 'multiplayer' && loadedSharedId && !roomChannelRef.current) {
				loadRoomState(loadedSharedId).then(() => subscribeToRoom(loadedSharedId, async (rec) => {
					try {
						const myId = myUserRef.current?.id || null;
						if (rec.by_user && myId && rec.by_user === myId) return;
						const from = { row: rec.from_row, col: rec.from_col };
						const to = { row: rec.to_row, col: rec.to_col };
						const ok = engineRef.current.moverPieza(from, to);
						if (!ok) {
							const piece = engineRef.current.board[from.row][from.col];
							engineRef.current.board[to.row][to.col] = piece;
							engineRef.current.board[from.row][from.col] = null;
						}
						setBoard(engineRef.current.obtenerTablero());
						setLastMove({ from, to });
					} catch (e) { console.warn('remote move handler', e); }
				}));
			}
		} catch (e) {
			setStatus('Error actualizando sala remota: ' + String(e));
		}
	}

	// --- Replayer state ---
	const [replayMoves, setReplayMoves] = useState([]);
	const [isPlaying, setIsPlaying] = useState(false);
	const [menuVisible, setMenuVisible] = useState(false);
	const [historyModalVisible, setHistoryModalVisible] = useState(false);
	const [actionsModalVisible, setActionsModalVisible] = useState(false);
	const [flipBoard, setFlipBoard] = useState(false);
	const [autoRotateEnabled, setAutoRotateEnabled] = useState(true);
	const isMultiplayer = mode === 'multiplayer';

	function tipoPiezaEsp(type) {
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
		// reset engine
		engineRef.current = new MotorAjedrez();
		setBoard(engineRef.current.obtenerTablero());
		for (let i = 0; i < moves.length; i++) {
			if (!isPlaying) break;
			const m = moves[i];
			// intentar mover con el engine (valida reglas)
			const ok = engineRef.current.moverPieza(m.from, m.to);
			if (!ok) {
				// si falla, aplicar directamente (fallback)
				const piece = engineRef.current.board[m.from.row][m.from.col];
				engineRef.current.board[m.to.row][m.to.col] = piece;
				engineRef.current.board[m.from.row][m.from.col] = null;
			}
			setBoard(engineRef.current.obtenerTablero());
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

		// If we're waiting for opponent, block board interactions
		if (mode === 'multiplayer' && waitingForOpponent) {
			setStatus('Esperando oponente — las acciones del tablero están deshabilitadas');
			return;
		}

		// In multiplayer, ensure user has a color and it's their turn
		if (mode === 'multiplayer') {
			if (!myColor) {
				setStatus('Aún no tienes color asignado');
				return;
			}
			const turnoActual = engineRef.current.turnoActual || 'w';
			if (turnoActual !== myColor) {
				setStatus('No es tu turno');
				return;
			}
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
    const turnoActual = engineRef.current.turnoActual || 'w';
	    if (pieceColor !== turnoActual) {
				setStatus("No es el turno de esa pieza");
				return;
			}

			setSelected({ row, col });
					// Calcular movimientos posibles y resaltar
					const possible = engineRef.current.generarMovimientos({ row, col });
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
		if (piece && piece.color === engineRef.current.turnoActual) {
			setSelected({ row, col });
			const possible = engineRef.current.generarMovimientos({ row, col });
			setHighlights(possible);
			setAttackers([]);
			setStatus('Pieza seleccionada');
			return;
		}

		// Intentar mover desde selected -> {row,col}
		const moved = engineRef.current.moverPieza(selected, { row, col });
		if (moved) {
			setBoard(engineRef.current.obtenerTablero());
			setSelected(null);
			setHighlights([]);
			setLastMove({ from: selected, to: { row, col } });

			// If multiplayer mode and we have a loadedSharedId, send the move to the room
			if (mode === 'multiplayer' && loadedSharedId) {
				// build move object
				const mv = {
					from: selected,
					to: { row, col },
					piece: engineRef.current.board[row] && engineRef.current.board[row][col] ? engineRef.current.board[row][col] : null,
					san: moveToSAN({ from: selected, to: { row, col }, piece: engineRef.current.board[row] && engineRef.current.board[row][col] ? engineRef.current.board[row][col] : null }, engineRef.current)
				};
				await sendMoveToRoom(loadedSharedId, mv);
			}

			// Si estamos en modo local (pass-and-play) y la rotación automática está activada,
			// girar la vista tras cada movimiento
			if (mode === 'local' && autoRotateEnabled) {
				setFlipBoard(s => !s);
			}

			// Comprobar empate por solo reyes
			if (engineRef.current.soloQuedanReyes && engineRef.current.soloQuedanReyes()) {
				setStatus('Empate: solo quedan los reyes');
				setAttackers([]);
				setGameOver(true);
				return;
			}
			// Después del movimiento, comprobar jaque / jaque mate para el oponente
			const opponent = engineRef.current.turnoActual; // ya fue cambiado en moverPieza
			// Nota: el motor no elimina al rey ni debe permitir capturarlo.
			// Confiamos en la detección de jaque mate para terminar la partida.
			if (engineRef.current.estaReyEnJaque(opponent)) {
				const attackersList = engineRef.current.obtenerAtacantesDelRey(opponent);
				setAttackers(attackersList);
				if (engineRef.current.esJaqueMate(opponent)) {
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
			const wouldBeInCheck = eng && typeof eng._estariaEnJaqueTrasMovimiento === 'function' && eng._estariaEnJaqueTrasMovimiento(selected, { row, col });
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
					attackersList = eng.obtenerAtacantesDeCasilla(to, opponent) || [];
					setStatus(`Movimiento inválido: la casilla estaría atacada por ${attackersList.length} pieza(s)`);
				} else {
					// Si es otra pieza: calculamos atacantes del rey después del movimiento
					const kingAttackers = eng.obtenerAtacantesDelRey(movingPiece.color) || [];
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
		engineRef.current = new MotorAjedrez();
		setBoard(engineRef.current.obtenerTablero());
		// Limpiar todo el estado visual para evitar marcas residuales
		setSelected(null);
		setHighlights([]);
		setAttackers([]);
		setLastMove(null);
		setGameOver(false);
		setStatus('');
		// Restaurar orientación por defecto (blancas abajo)
		setFlipBoard(false);
	};

	const undoLastMove = () => {
		if (!engineRef.current) return;
		const undone = engineRef.current.deshacerMovimiento();
		if (undone) {
			// Actualizar tablero y limpiar resaltados
			setBoard(engineRef.current.obtenerTablero());
			setSelected(null);
			setHighlights([]);
			setAttackers([]);
			setGameOver(false);
			setStatus('Movimiento deshecho');
			// Actualizar lastMove al movimiento anterior en el historial (o null si no hay)
			const mh = engineRef.current.historialMovimientos;
			if (mh && mh.length) {
				const lm = mh[mh.length - 1];
				setLastMove({ from: lm.from, to: lm.to });
			} else {
				setLastMove(null);
			}

			// Comprobar empate por solo reyes tras deshacer
			if (engineRef.current.soloQuedanReyes && engineRef.current.soloQuedanReyes()) {
				setStatus('Empate: solo quedan los reyes');
				setGameOver(true);
			} else {
				setGameOver(false);
			}

			// Si estamos en modo local (pass-and-play) y la rotación automática está activada,
			// al deshacer también rotamos la vista para mantener la orientación correcta
			if (mode === 'local' && autoRotateEnabled) setFlipBoard(s => !s);
		} else {
			setStatus('No hay movimientos para deshacer');
		}
	};

	return (
		<View style={styles.container}>

			{mode === 'replay' && savedName ? <Text style={{ fontWeight: '600', marginBottom: 8 }}>Reproduciendo: {savedName}</Text> : null}
			{mode === 'replay' && replayLog ? (
				<View style={{ flexDirection: 'row', marginBottom: 8 }}>
					<TouchableOpacity style={styles.ctrlBtn} onPress={() => { if (!isPlaying) playReplay(replayLog); }}>
						<Text style={styles.ctrlText}>{isPlaying ? 'Reproduciendo...' : 'Reproducir'}</Text>
					</TouchableOpacity>
					<TouchableOpacity style={[styles.ctrlBtn, { backgroundColor: '#575555ff' }]} onPress={() => { setIsPlaying(false); }}>
						<Text style={styles.ctrlText}>Pausar</Text>
					</TouchableOpacity>
					<TouchableOpacity style={[styles.ctrlBtn, { backgroundColor: '#575555ff' }]} onPress={() => { onExit && onExit(); }}>
						<Text style={styles.ctrlText}>Salir</Text>
					</TouchableOpacity>
				</View>
			) : null}
			<Text style={styles.status}>{status}</Text>

			{/* Layout: capturas izquierda - tablero - capturas derecha */}
			{/* Capturas superiores */}
			<View style={styles.capturesTop}>
				<Text style={styles.captureLabel}>Capturadas (negras)</Text>
				<View style={styles.captureRow}>
					{engineRef.current && engineRef.current.obtenerPiezasCapturadas().b.map((p, i) => {
						const key = `${p.color}${p.type}`;
						const src = PIECE_IMAGES[key];
						return src ? (
							<View key={i} style={[styles.captureBadge, p.color === 'w' ? styles.captureBadgeWhiteBg : styles.captureBadgeBlackBg]}>
								<Image source={src} style={styles.captureImg} resizeMode="contain" />
							</View>
						) : <Text key={i}>{key}</Text>;
					})}
				</View>
			</View>

			{/* Tablero central */}
			<View style={styles.boardContainer}>
				<Board board={board} onSquarePress={handleSquarePress} selected={selected} highlights={highlights} attackers={attackers} lastMove={attackers && attackers.length > 0 ? null : lastMove} flipped={flipBoard} />
			</View>

			{/* Overlay que bloquea toda la pantalla mientras esperamos al oponente */}
			{mode === 'multiplayer' && waitingForOpponent ? (
				<View style={styles.screenOverlay} pointerEvents="auto">
					<View style={styles.waitingContainer}>
						<Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Esperando oponente</Text>
						<Text style={{ marginBottom: 12 }}>Comparte este código para que se unan:</Text>
						<Text selectable style={styles.inviteCode}>{inviteCode || loadedSharedId || savedId || '---'}</Text>
						{/* Participants debug info */}
						<View style={{ marginTop: 12, width: '100%', alignItems: 'center' }}>
							<Text style={{ marginBottom: 6 }}>Participantes: {participants ? participants.length : 0}</Text>
							{participants && participants.map((p, i) => (
								<Text key={i} style={{ fontSize: 12, color: '#333' }}>{p.color?.toUpperCase() || '?'} • {String(p.user_id).slice(0, 8)}{myUserRef.current && String(p.user_id) === String(myUserRef.current.id) ? ' (tú)' : ''}</Text>
							))}
						</View>
							<View style={{ flexDirection: 'row', marginTop: 12 }}>
							<TouchableOpacity style={[styles.btn, { marginRight: 8 }]} onPress={async () => { try { await Clipboard.setStringAsync(String(inviteCode || loadedSharedId || savedId)); setStatus('Código copiado'); } catch(e){}}}>
								<Text style={styles.btnText}>Copiar código</Text>
							</TouchableOpacity>
							<TouchableOpacity style={[styles.btn, { marginRight: 8, backgroundColor: '#c94a4a' }]} onPress={async () => {
								// Close room (only owner allowed)
								try {
									const myId = myUserRef.current?.id || null;
									if (!myId) { setStatus('Necesitas estar autenticado para cerrar la sala'); return; }
									if (!roomOwnerId || String(myId) !== String(roomOwnerId)) { setStatus('Solo el creador puede cerrar la sala'); return; }
									setStatus('Cerrando sala...');
									// delete participants first
									await supabase.from('shared_game_participants').delete().eq('room_id', loadedSharedId);
									// delete room
									await supabase.from('shared_games').delete().eq('id', loadedSharedId);
									unsubscribeParticipants(); unsubscribeRoom();
									setStatus('Sala cerrada');
									if (onExit) onExit();
								} catch (e) {
									console.warn('Error closing room', e);
									setStatus('Error cerrando sala');
								}
							}}>
								<Text style={styles.btnText}>Cerrar partida</Text>
							</TouchableOpacity>
							<TouchableOpacity style={[styles.btn, styles.btnClose]} onPress={() => { unsubscribeParticipants(); unsubscribeRoom(); if (onExit) onExit(); }}>
								<Text style={styles.btnText}>Salir</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			) : null}

			{/* Capturas inferiores */}
			<View style={styles.capturesBottom}>
				<Text style={styles.captureLabel}>Capturadas (blancas)</Text>
				<View style={styles.captureRow}>
					{engineRef.current && engineRef.current.obtenerPiezasCapturadas().w.map((p, i) => {
						const key = `${p.color}${p.type}`;
						const src = PIECE_IMAGES[key];
						return src ? (
							<View key={i} style={[styles.captureBadge, p.color === 'w' ? styles.captureBadgeWhiteBg : styles.captureBadgeBlackBg]}>
								<Image source={src} style={styles.captureImg} resizeMode="contain" />
							</View>
						) : <Text key={i}>{key}</Text>;
					})}
				</View>
			</View>
			{/* Controls bar */}
			<View style={styles.controls}>
				{/* Botón único que abre modal compacto de acciones */}
				<TouchableOpacity style={[styles.ctrlBtn, { backgroundColor: '#444' }]} onPress={() => {
					if (mode === 'multiplayer' && waitingForOpponent) { setStatus('Acciones no disponibles hasta que entre el oponente'); return; }
					setActionsModalVisible(true);
				}}>
					<Text style={styles.ctrlText}>Acciones</Text>
				</TouchableOpacity>
				<TouchableOpacity style={[styles.ctrlBtn, { backgroundColor: '#666' }]} onPress={() => { if (typeof onExit === 'function') onExit(); }}>
					<Text style={styles.ctrlText}>Salir</Text>
				</TouchableOpacity>
			</View>

			{/* Modal compacto con las acciones principales (botones grandes) */}
			<Modal visible={actionsModalVisible} transparent animationType="fade">
				<View style={styles.modalBackdrop}>
					<View style={[styles.modalCard, { width: '86%', alignItems: 'stretch' }] }>
						<Text style={styles.modalTitle}>Acciones</Text>
						<View style={styles.modalDivider} />
						<TouchableOpacity
							style={[styles.actionBigBtn, isMultiplayer ? styles.disabledBtn : null]}
							onPress={() => {
								if (isMultiplayer) { setStatus('Acción no disponible en modo multijugador'); return; }
								setActionsModalVisible(false);
								undoLastMove();
							}}
							disabled={isMultiplayer}
						>
							<Text style={styles.actionBigBtnText}>Deshacer</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={[styles.actionBigBtn, isMultiplayer ? styles.disabledBtn : null]}
							onPress={() => {
								if (isMultiplayer) { setStatus('Acción no disponible en modo multijugador'); return; }
								setActionsModalVisible(false);
								restartGame();
							}}
							disabled={isMultiplayer}
						>
							<Text style={styles.actionBigBtnText}>Reiniciar</Text>
						</TouchableOpacity>
						<TouchableOpacity style={[styles.actionBigBtn, { backgroundColor: '#2a7f2a' }]} onPress={() => { setActionsModalVisible(false); if (loadedSavedId) updateToLocal(); else setSaveModalVisible(true); }}>
							<Text style={[styles.actionBigBtnText, { color: '#fff' }]}>Guardar</Text>
						</TouchableOpacity>
						{/* "Actualizar en la nube" eliminado según solicitud del usuario */}
						<TouchableOpacity style={[styles.actionBigBtn, { backgroundColor: '#666' }]} onPress={() => { setActionsModalVisible(false); setHistoryModalVisible(true); }}>
							<Text style={[styles.actionBigBtnText, { color: '#fff' }]}>Historial</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={[styles.actionBigBtn, { backgroundColor: '#2b2b2b' }, isMultiplayer ? styles.disabledBtn : null]}
							onPress={() => {
								if (isMultiplayer) { setStatus('Rotación no disponible en modo multijugador'); return; }
								setActionsModalVisible(false);
								setAutoRotateEnabled(s => !s);
								setStatus(autoRotateEnabled ? 'Rotación automática desactivada' : 'Rotación automática activada');
							}}
							disabled={isMultiplayer}
						>
							<Text style={[styles.actionBigBtnText, { color: '#fff' }]}>{autoRotateEnabled ? 'Desactivar rotación automática' : 'Activar rotación automática'}</Text>
						</TouchableOpacity>
						<TouchableOpacity style={[styles.btn, styles.btnClose, { marginTop: 10 }]} onPress={() => setActionsModalVisible(false)}>
							<Text style={styles.btnText}>Cerrar</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>

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
			{/* El tablero ahora se renderiza dentro del bloque con capturas */}

			{/* Historial en modal (se abre desde el menú) */}
			<Modal visible={historyModalVisible} transparent animationType="fade">
				<View style={[styles.modalBackdrop, { zIndex: 60 }] }>
					<View style={[styles.modalCard, styles.historyModalCard, { width: '90%' }] }>
						<Text style={[styles.modalTitle, styles.historyModalTitle]}>Historial de Movimientos</Text>
						<ScrollView style={{ maxHeight: 360, width: '100%' }}>
							{(() => {
								const pairs = buildAlgebraicPairs();
								return pairs.map((p, i) => (
									<View key={i} style={styles.historyRow}>
										<Text style={styles.historyNo}>{p.no}.</Text>
										<View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
											{p.whitePiece && PIECE_IMAGES[p.whitePiece] ? <Image source={PIECE_IMAGES[p.whitePiece]} style={styles.historyPieceImg} /> : null}
											<Text style={styles.historyMove}>{p.white || ''}</Text>
										</View>
										<View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
											{p.blackPiece && PIECE_IMAGES[p.blackPiece] ? <Image source={PIECE_IMAGES[p.blackPiece]} style={styles.historyPieceImg} /> : null}
											<Text style={styles.historyMove}>{p.black || ''}</Text>
										</View>
									</View>
								));
							})()}
						</ScrollView>
						<View style={{ flexDirection: 'row', marginTop: 12, width: '100%' }}>
							<TouchableOpacity style={styles.btn} onPress={() => setHistoryModalVisible(false)}><Text style={styles.btnText}>Cerrar</Text></TouchableOpacity>
						</View>
					</View>
				</View>
			</Modal>

			{/* Modal de fin de partida */}
			<Modal visible={gameOver} transparent animationType="fade">
				<View style={styles.modalBackdrop}>
					<View style={styles.modalCard}>
						<Text style={styles.modalTitle}>Partida terminada</Text>
						<Text style={styles.modalText}>{status || 'Jaque mate'}</Text>
						<View style={styles.modalButtons}>
							<TouchableOpacity
								style={[styles.btn, isMultiplayer ? styles.disabledBtn : null]}
								onPress={() => { if (isMultiplayer) { setStatus('Acción no disponible en modo multijugador'); return; } restartGame(); }}
								disabled={isMultiplayer}
							>
								<Text style={styles.btnText}>Reiniciar</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[styles.btn, isMultiplayer ? styles.disabledBtn : null]}
								onPress={() => { if (isMultiplayer) { setStatus('Acción no disponible en modo multijugador'); return; } undoLastMove(); }}
								disabled={isMultiplayer}
							>
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
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: 'rgba(0,0,0,0.45)',
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 9999,
		elevation: 20,
	},
	modalCard: {
		width: '80%',
		backgroundColor: '#f2f2f2',
		padding: 18,
		borderRadius: 8,
		elevation: 6,
		alignItems: 'stretch',
		maxHeight: '85%'
	},
	modalTitle: {
		fontSize: 18,
		fontWeight: '700',
		marginBottom: 8,
		textAlign: 'center'
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
	captureBadge: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: 'center',
		justifyContent: 'center',
		margin: 4,
		padding: 2,
		borderWidth: 1,
		borderColor: '#e0e0e0'
	},
	captureBadgeWhiteBg: {
		backgroundColor: '#222',
		borderColor: '#111'
	},
	captureBadgeBlackBg: {
		backgroundColor: '#fff',
		borderColor: '#ccc'
	},
	menuWrapper: {
		position: 'absolute',
		top: 12,
		right: 18,
		zIndex: 40,
	},
	menuButton: {
		padding: 8,
		backgroundColor: '#444',
		borderRadius: 6,
	},
	menuDropdown: {
		position: 'absolute',
		top: 44,
		right: 0,
		backgroundColor: '#fff',
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 6,
		elevation: 8,
		padding: 6,
	},
	menuItem: {
		paddingVertical: 8,
		paddingHorizontal: 12,
	},
	menuItemText: {
		color: '#222',
		fontWeight: '600'
	},

	historyContainer: {
		width: '100%',
		maxHeight: 140,
		marginTop: 10,
		borderTopWidth: 1,
		borderTopColor: '#797777ff',
		paddingTop: 8,
	},
	historyTitle: {
		fontWeight: '700',
		marginBottom: 6,
		textAlign: 'center'
	},
	historyRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'flex-start',
		paddingVertical: 6,
		borderBottomWidth: 1,
		borderBottomColor: '#f0f0f0'
	},
	historyNo: {
		width: 34,
		fontWeight: '700',
		textAlign: 'right',
		marginRight: 10
	},
	historyMove: {
		flex: 1,
		textAlign: 'left',
		color: '#222'
	},
	historyPieceImg: {
		width: 20,
		height: 20,
		marginRight: 6,
		resizeMode: 'contain'
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
	historyModalCard: {
		backgroundColor: '#888787ff'
	},
	historyModalTitle: {
		color: '#222'
	},
	actionBigBtn: {
		width: '100%',
		paddingVertical: 12,
		paddingHorizontal: 12,
		borderRadius: 8,
		marginVertical: 6,
		backgroundColor: '#444',
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 44
	},
	actionBigBtnText: {
		color: '#fff',
		fontWeight: '700'
	},
	modalDivider: {
		width: '100%',
		height: 10,
		backgroundColor: 'transparent'
	},

	boardWithCaptures: {
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'center',
		width: '100%',
		marginVertical: 8,
	},
	capturesTop: {
		width: '100%',
		alignItems: 'center',
		marginBottom: 6,
	},
	capturesBottom: {
		width: '100%',
		alignItems: 'center',
		marginTop: 6,
	},
	captureRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'center'
	},
	boardContainer: {
		alignItems: 'center',
		justifyContent: 'center'
	},
	waitingContainer: {
		alignItems: 'center',
		justifyContent: 'center',
		padding: 16,
		backgroundColor: '#f7f7f7',
		borderRadius: 8,
		width: '90%'
	},
	screenOverlay: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: 'rgba(255,255,255,0.95)',
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 9999,
		elevation: 30,
	},
	inviteCode: {
		fontSize: 16,
		fontWeight: '700',
		padding: 8,
		backgroundColor: '#fff',
		borderRadius: 6,
		borderWidth: 1,
		borderColor: '#ddd'
	},
	disabledBtn: {
		backgroundColor: '#999',
		opacity: 0.75,
	},
});
