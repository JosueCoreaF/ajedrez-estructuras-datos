import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Image, Animated } from 'react-native';
import Board from '../components/Board';
import { MotorAjedrez } from '../engine/ChessEngine';
import PIECE_IMAGES from '../components/icons';
import { TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from '../utils/supabaseClient';
import * as Clipboard from 'expo-clipboard';
import { tipoPiezaEsp, casillaAAlgebraica, movimientoASAN, construirParesAlgebricos, parsearMovimientosDeLog, construirLogHistorial } from '../utils/gameUtils';

export default function GameScreen({ mode = 'local', replayLog = null, savedName = null, savedId = null, roomId = null, inviteCode: inviteCodeProp = null, onExit = null }) {
	const engineRef = useRef();
	const [board, setBoard] = useState([]);
	const [selected, setSelected] = useState(null);
	const [status, setStatus] = useState('');
	const [loadedSavedId, setLoadedSavedId] = useState(null);
	const [loadedSharedId, setLoadedSharedId] = useState(null); // id en shared_games (Supabase)
    const roomChannelRef = useRef(null);
    const myUserRef = useRef(null);
	const participantsChannelRef = useRef(null);
	const [participantes, setParticipantes] = useState([]);
	// start in waiting state for multiplayer to avoid flashing the board briefly
	const [esperandoOponente, setEsperandoOponente] = useState(mode === 'multiplayer');
	const [codigoInvitacion, setCodigoInvitacion] = useState(inviteCodeProp || null);
	const [idPropietarioSala, setIdPropietarioSala] = useState(null);
	const [miColor, setMiColor] = useState(null);
		const [highlights, setHighlights] = useState([]);
		const [attackers, setAttackers] = useState([]);
		const [juegoTerminado, setJuegoTerminado] = useState(false);
		const [ultimoMovimiento, setUltimoMovimiento] = useState(null);

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
			const moves = parsearMovimientosDeLog(replayLog);
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
				setUltimoMovimiento({ from: lm.from, to: lm.to });
			}
			// guardar metadata de la partida cargada para permitir actualizarla
			if (savedName) setNombrePartida(savedName);
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

		// cleanup on unmount: desuscribir realtime y participantes
		return () => {
			try { desuscribirSala(); } catch (_) {}
			try { desuscribirParticipantes(); } catch (_) {}
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
			cargarEstadoSala(loadedSharedId).then(() => suscribirASala(loadedSharedId, async (rec) => {
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
					setUltimoMovimiento({ from, to });
				} catch (e) { console.warn('remote move handler', e); }
			}));

			// load participants and subscribe to changes
			loadParticipants(loadedSharedId).then(() => suscribirParticipantes(loadedSharedId, (evt) => {
				// reload participants on any event
				loadParticipants(loadedSharedId);
				if (evt && evt.action === 'INSERT') {
					// if second participant joined, clear waiting flag
					const parts = participantsChannelRef.current; // just for trace
					setEsperandoOponente(false);
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
				setParticipantes(data || []);
				console.log('loadParticipants ->', data || []);
				const parts = data || [];
				setEsperandoOponente(parts.length < 2);
				// determine my color if I'm a participant
				try {
					const myId = myUserRef.current?.id || null;
					if (myId) {
						const mine = parts.find(p => String(p.user_id) === String(myId));
						if (mine && mine.color) {
							setMiColor(mine.color);
							// flip board for black players
							setFlipBoard(mine.color === 'b');
						} else {
							setMiColor(null);
						}
					}
					// If there are now 2 or more participants, ensure the room is initialized and subscribed
						if (parts.length >= 2) {
						setEsperandoOponente(false);
						try {
								if (!roomChannelRef.current) {
								await cargarEstadoSala(roomId);
								suscribirASala(roomId, async (rec) => {
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
										setUltimoMovimiento({ from, to });
									} catch (e) { console.warn('remote move handler', e); }
								});
							}
						} catch (e) { console.warn('ensure subscribe after participants', e); }
					}
				} catch (e) { console.warn('error determinando miColor', e); }
			} catch (e) { console.warn('loadParticipants exception', e); }
	}

	function suscribirParticipantes(roomId, onEvent) {
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
		} catch (e) { console.warn('suscribirParticipantes error', e); }
	}

	function desuscribirParticipantes() {
		try {
			if (participantsChannelRef.current) {
				try { participantsChannelRef.current.unsubscribe(); } catch (_) {}
				participantsChannelRef.current = null;
			}
		} catch (e) { console.warn('desuscribirParticipantes', e); }
	}

	// --- Estado y helpers para guardar partida (local) ---
	const [modalGuardarVisible, setModalGuardarVisible] = useState(false);
	const [nombrePartida, setNombrePartida] = useState('');
	// buildLogFromHistory moved to src/utils/gameUtils.js

	// Notación algebraica y helpers moved to src/utils/gameUtils.js

	async function finalizeMatch(winnerColor) {
		try {
			const winnerName = winnerColor === 'w' ? 'Blancas' : 'Negras';
			const finalLog = construirLogHistorial(engineRef.current) + `\nPartida finalizada: ${new Date().toISOString()}\nResultado: Ganador: ${winnerName}`;
				const payload = {
				id: `match-${Date.now()}`,
				name: nombrePartida || `Partida ${new Date().toISOString()}`,
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

	async function guardarLocal() {
			const payload = { id: `local-${Date.now()}`, name: nombrePartida || `Partida ${new Date().toISOString()}`, log_text: construirLogHistorial(engineRef.current), savedAt: new Date().toISOString() };
		try {
			setStatus('Guardando localmente...');
			const raw = await AsyncStorage.getItem('saved_games');
			const arr = raw ? JSON.parse(raw) : [];
			arr.push(payload);
			await AsyncStorage.setItem('saved_games', JSON.stringify(arr));
			setStatus('Partida guardada localmente');
			setModalGuardarVisible(false);
			// Marcar que ahora la partida actual corresponde a la guardada (para futuras actualizaciones)
			setLoadedSavedId(payload.id);
		} catch (e) {
			setStatus('Error guardando localmente: ' + String(e));
		}
	}

	async function actualizarLocal() {
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
			arr[idx].log_text = construirLogHistorial(engineRef.current);
			arr[idx].savedAt = new Date().toISOString();
			// keep name unless user changed it
			arr[idx].name = nombrePartida || arr[idx].name;
			await AsyncStorage.setItem('saved_games', JSON.stringify(arr));
			setStatus('Partida actualizada');
		} catch (e) {
			setStatus('Error actualizando: ' + String(e));
		}
	}

	// --- Supabase remote (shared_games) ---
	async function crearSalaRemota() {
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
				name: nombrePartida || `Partida ${new Date().toISOString()}`,
				log_text: construirLogHistorial(engineRef.current),
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
					cargarEstadoSala(data.id).then(() => suscribirASala(data.id, async (rec) => {
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
							setUltimoMovimiento({ from, to });
						} catch (e) { console.warn('remote move handler', e); }
					}));
				}, 250);
			}
		} catch (e) {
			setStatus('Error creando sala remota: ' + String(e));
		}
	}

		// --- Real-time & room state helpers (moved to top-level of component) ---
		async function cargarEstadoSala(roomId) {
			try {
				setStatus('Cargando estado de la sala...');
				// also try to load room metadata (invite code)
				try {
					const { data: gameMeta, error: gmErr } = await supabase.from('shared_games').select('metadata, owner_id').eq('id', roomId).maybeSingle();
					if (gmErr) console.warn('cargarEstadoSala metadata error', gmErr);
					if (gameMeta && gameMeta.metadata && gameMeta.metadata.invite_code) setCodigoInvitacion(gameMeta.metadata.invite_code);
					if (gameMeta && gameMeta.owner_id) setIdPropietarioSala(gameMeta.owner_id);
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
					setUltimoMovimiento({ from: { row: last.from_row, col: last.from_col }, to: { row: last.to_row, col: last.to_col } });
				}
				setStatus('Estado de sala cargado');
			} catch (e) {
				console.warn('cargarEstadoSala error', e);
				setStatus('Error cargando sala');
			}
		}

		function suscribirASala(roomId, onRemoteMove) {
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
				console.warn('suscribirASala error', e);
				setStatus('Error suscribiendo a sala');
			}
		}

		function desuscribirSala() {
			try {
				if (roomChannelRef.current) {
					try { roomChannelRef.current.unsubscribe(); } catch (_) {}
					roomChannelRef.current = null;
				}
			} catch (e) { console.warn('desuscribirSala', e); }
		}

		async function enviarMovimientoSala(roomId, move) {
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
					console.warn('enviarMovimientoSala error', error);
					setStatus('Error enviando movimiento');
				}
			} catch (e) {
				console.warn('enviarMovimientoSala exception', e);
				setStatus('Error enviando movimiento');
			}
		}

	async function actualizarSalaRemota() {
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
			const updates = { log_text: construirLogHistorial(engineRef.current) };
			if (nombrePartida) updates.name = nombrePartida;
			const { data, error } = await supabase.from('shared_games').update(updates).eq('id', loadedSharedId).eq('owner_id', user.id).select().single();
			if (error) {
				setStatus('Error actualizando sala remota: ' + (error.message || String(error)));
				return;
			}
			setStatus('Sala remota actualizada: ' + String(loadedSharedId));
			// if we haven't subscribed yet and in multiplayer, initialize
			if (mode === 'multiplayer' && loadedSharedId && !roomChannelRef.current) {
				cargarEstadoSala(loadedSharedId).then(() => suscribirASala(loadedSharedId, async (rec) => {
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
						setUltimoMovimiento({ from, to });
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
	const [promotionModalVisible, setPromotionModalVisible] = useState(false);
	const [promotionCandidate, setPromotionCandidate] = useState(null);
	const promotionAnim = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (promotionModalVisible) {
			promotionAnim.setValue(0);
			Animated.timing(promotionAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
		} else {
			Animated.timing(promotionAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start();
		}
	}, [promotionModalVisible]);
	const isMultiplayer = mode === 'multiplayer';

	// tipoPiezaEsp & parseMovesFromLog moved to src/utils/gameUtils.js

	async function reproducirPartida(logText, speed = 500) {
		if (!logText) return;
		const moves = parsearMovimientosDeLog(logText);
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
			setUltimoMovimiento({ from: m.from, to: m.to });
			await new Promise(res => setTimeout(res, speed));
		}
		setIsPlaying(false);
	}

	const handleSquarePress = async ({ row, col }) => {
		if (!engineRef.current) return;
		if (juegoTerminado) {
			// Partida terminada: ignorar interacciones posteriores (status ya indica resultado)
			return;
		}

		// If we're waiting for opponent, block board interactions
		if (mode === 'multiplayer' && esperandoOponente) {
			setStatus('Esperando oponente — las acciones del tablero están deshabilitadas');
			return;
		}

		// In multiplayer, ensure user has a color and it's their turn
		if (mode === 'multiplayer') {
			if (!miColor) {
				setStatus('Aún no tienes color asignado');
				return;
			}
			const turnoActual = engineRef.current.turnoActual || 'w';
			if (turnoActual !== miColor) {
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

		// Antes de ejecutar el movimiento, comprobar si es una promoción de peón
		const movingPiece = engineRef.current.board[selected.row][selected.col];
		if (movingPiece && movingPiece.type === 'p') {
			const isPromotion = (movingPiece.color === 'w' && row === 0) || (movingPiece.color === 'b' && row === 7);
			if (isPromotion) {
				setPromotionCandidate({ from: selected, to: { row, col } });
				setPromotionModalVisible(true);
				return;
			}
		}

		// Ejecutamos ejecutarMovimiento y dejamos que esa función gestione el resultado
		await ejecutarMovimiento(selected, { row, col });
	};

	// Función auxiliar que ejecuta el movimiento en el motor y realiza las acciones posteriores
	async function ejecutarMovimiento(from, to, promotionType = null) {
		if (!engineRef.current) return;
		const moved = engineRef.current.moverPieza(from, to, promotionType);
		if (moved) {
			setBoard(engineRef.current.obtenerTablero());
			setSelected(null);
			setHighlights([]);
			setUltimoMovimiento({ from, to });

			// If multiplayer mode and we have a loadedSharedId, send the move to the room
			if (mode === 'multiplayer' && loadedSharedId) {
				const pieceObj = engineRef.current.board[to.row] && engineRef.current.board[to.row][to.col] ? engineRef.current.board[to.row][to.col] : null;
				const mv = {
					from,
					to,
					piece: pieceObj,
					san: movimientoASAN({ from, to, piece: pieceObj }, engineRef.current)
				};
				await enviarMovimientoSala(loadedSharedId, mv);
			}

			if (mode === 'local' && autoRotateEnabled) setFlipBoard(s => !s);

			if (engineRef.current.soloQuedanReyes && engineRef.current.soloQuedanReyes()) {
				setStatus('Empate: solo quedan los reyes');
				setAttackers([]);
				setJuegoTerminado(true);
				return;
			}

			const opponent = engineRef.current.turnoActual;
			if (engineRef.current.estaReyEnJaque(opponent)) {
				const attackersList = engineRef.current.obtenerAtacantesDelRey(opponent);
				setAttackers(attackersList);
				if (engineRef.current.esJaqueMate(opponent)) {
					const winner = opponent === 'w' ? 'b' : 'w';
					setStatus('Jaque mate');
					setJuegoTerminado(true);
					await finalizeMatch(winner);
				} else {
					setStatus('Jaque');
				}
			} else {
				setStatus('Movimiento ejecutado');
				setAttackers([]);
			}
		} else {
			setStatus('Movimiento inválido');
		}
	}

	const restartGame = () => {
		engineRef.current = new MotorAjedrez();
		setBoard(engineRef.current.obtenerTablero());
		// Limpiar todo el estado visual para evitar marcas residuales
		setSelected(null);
		setHighlights([]);
		setAttackers([]);
		setUltimoMovimiento(null);
		setJuegoTerminado(false);
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
			setJuegoTerminado(false);
			setStatus('Movimiento deshecho');
			// Actualizar lastMove al movimiento anterior en el historial (o null si no hay)
			const mh = engineRef.current.historialMovimientos;
			if (mh && mh.length) {
				const lm = mh[mh.length - 1];
				setUltimoMovimiento({ from: lm.from, to: lm.to });
			} else {
				setUltimoMovimiento(null);
			}

			// Comprobar empate por solo reyes tras deshacer
			if (engineRef.current.soloQuedanReyes && engineRef.current.soloQuedanReyes()) {
				setStatus('Empate: solo quedan los reyes');
				setJuegoTerminado(true);
			} else {
				setJuegoTerminado(false);
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
					<TouchableOpacity style={styles.ctrlBtn} onPress={() => { if (!isPlaying) reproducirPartida(replayLog); }}>
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
				<Board board={board} onSquarePress={handleSquarePress} selected={selected} highlights={highlights} attackers={attackers} ultimoMovimiento={attackers && attackers.length > 0 ? null : ultimoMovimiento} flipped={flipBoard} />
			</View>

			{/* Overlay que bloquea toda la pantalla mientras esperamos al oponente */}
			{mode === 'multiplayer' && esperandoOponente ? (
				<View style={styles.screenOverlay} pointerEvents="auto">
					<View style={styles.waitingContainer}>
						<Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Esperando oponente</Text>
						<Text style={{ marginBottom: 12 }}>Comparte este código para que se unan:</Text>
						<Text selectable style={styles.inviteCode}>{codigoInvitacion || loadedSharedId || savedId || '---'}</Text>
						{/* Participants debug info */}
						<View style={{ marginTop: 12, width: '100%', alignItems: 'center' }}>
							<Text style={{ marginBottom: 6 }}>Participantes: {participantes ? participantes.length : 0}</Text>
							{participantes && participantes.map((p, i) => (
								<Text key={i} style={{ fontSize: 12, color: '#333' }}>{p.color?.toUpperCase() || '?'} • {String(p.user_id).slice(0, 8)}{myUserRef.current && String(p.user_id) === String(myUserRef.current.id) ? ' (tú)' : ''}</Text>
							))}
						</View>
							<View style={{ flexDirection: 'row', marginTop: 12 }}>
							<TouchableOpacity style={[styles.btn, { marginRight: 8 }]} onPress={async () => { try { await Clipboard.setStringAsync(String(codigoInvitacion || loadedSharedId || savedId)); setStatus('Código copiado'); } catch(e){}}}>
								<Text style={styles.btnText}>Copiar código</Text>
							</TouchableOpacity>
							<TouchableOpacity style={[styles.btn, { marginRight: 8, backgroundColor: '#c94a4a' }]} onPress={async () => {
								// Close room (only owner allowed)
								try {
									const myId = myUserRef.current?.id || null;
									if (!myId) { setStatus('Necesitas estar autenticado para cerrar la sala'); return; }
									if (!idPropietarioSala || String(myId) !== String(idPropietarioSala)) { setStatus('Solo el creador puede cerrar la sala'); return; }
									setStatus('Cerrando sala...');
									// delete participants first
									await supabase.from('shared_game_participants').delete().eq('room_id', loadedSharedId);
									// delete room
									await supabase.from('shared_games').delete().eq('id', loadedSharedId);
									desuscribirParticipantes(); desuscribirSala();
									setStatus('Sala cerrada');
									if (onExit) onExit();
								} catch (e) {
									console.warn('Error closing room', e);
									setStatus('Error cerrando sala');
								}
							}}>
								<Text style={styles.btnText}>Cerrar partida</Text>
							</TouchableOpacity>
							<TouchableOpacity style={[styles.btn, styles.btnClose]} onPress={() => { desuscribirParticipantes(); desuscribirSala(); if (onExit) onExit(); }}>
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
					if (mode === 'multiplayer' && esperandoOponente) { setStatus('Acciones no disponibles hasta que entre el oponente'); return; }
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
						<TouchableOpacity style={[styles.actionBigBtn, { backgroundColor: '#2a7f2a' }]} onPress={() => { setActionsModalVisible(false); if (loadedSavedId) actualizarLocal(); else setModalGuardarVisible(true); }}>
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
			<Modal visible={modalGuardarVisible} transparent animationType="fade">
				<View style={styles.modalBackdrop}>
					<View style={[styles.modalCard, { width: '90%' }] }>
						<Text style={styles.modalTitle}>Guardar partida (local)</Text>
						<TextInput placeholder="Nombre de la partida" value={nombrePartida} onChangeText={setNombrePartida} style={{ width: '100%', borderWidth: 1, borderColor:'#ddd', padding:8, borderRadius:6, marginBottom:12 }} />
						<View style={{ flexDirection:'row', width:'100%' }}>
							<TouchableOpacity style={styles.btn} onPress={guardarLocal}><Text style={styles.btnText}>Guardar</Text></TouchableOpacity>
							<TouchableOpacity style={[styles.btn, styles.btnClose, { marginLeft: 8 }]} onPress={() => setModalGuardarVisible(false)}><Text style={styles.btnText}>Cancelar</Text></TouchableOpacity>
						</View>
					</View>
				</View>
			</Modal>
			{/* El tablero ahora se renderiza dentro del bloque con capturas */}

			{/* Modal para selección de promoción de peón */}
			<Modal visible={promotionModalVisible} transparent animationType="none">
				<View style={styles.modalBackdrop}>
					<Animated.View style={[styles.modalCard, { width: '86%', alignItems: 'center', opacity: promotionAnim, transform: [{ scale: promotionAnim.interpolate({ inputRange: [0,1], outputRange: [0.9,1] }) }] }]}>
						<Text style={styles.modalTitle}>Promocionar peón</Text>
						<Text style={{ marginBottom: 12 }}>Elige la pieza para la promoción</Text>
						<View style={styles.promoOptionsRow}>
							{(() => {
								// determinar color del peón que promociona
								let color = 'w';
								try {
									if (promotionCandidate && engineRef.current && engineRef.current.board && engineRef.current.board[promotionCandidate.from.row]) {
										color = engineRef.current.board[promotionCandidate.from.row][promotionCandidate.from.col].color || 'w';
									}
								} catch (_) { color = 'w'; }
								const opts = [ ['q','Dama'], ['r','Torre'], ['b','Alfil'], ['n','Caballo'] ];
								return opts.map(([type,label]) => {
									const key = `${color}${type}`;
									const src = PIECE_IMAGES[key];
									const optionStyle = [
										styles.promoOption,
										color === 'w' ? styles.promoOptionLightPiece : styles.promoOptionDarkPiece
									];
									const labelStyle = [styles.promoOptionLabel, color === 'w' ? { color: '#fff' } : {}];
									return (
										<TouchableOpacity key={type} style={optionStyle} onPress={async () => { setPromotionModalVisible(false); if (promotionCandidate) await ejecutarMovimiento(promotionCandidate.from, promotionCandidate.to, type); setPromotionCandidate(null); }}>
											{src ? <Image source={src} style={styles.promoOptionImg} /> : <Text style={styles.actionBigBtnText}>{label}</Text>}
											<Text style={labelStyle}>{label}</Text>
										</TouchableOpacity>
									);
								});
							})()}
						</View>
						<TouchableOpacity style={[styles.btn, styles.btnClose, { marginTop: 10 }]} onPress={() => { setPromotionModalVisible(false); setPromotionCandidate(null); setSelected(null); setHighlights([]); setStatus('Promoción cancelada'); }}>
							<Text style={styles.btnText}>Cancelar</Text>
						</TouchableOpacity>
					</Animated.View>
				</View>
			</Modal>

			{/* Historial en modal (se abre desde el menú) */}
			<Modal visible={historyModalVisible} transparent animationType="fade">
				<View style={[styles.modalBackdrop, { zIndex: 60 }] }>
					<View style={[styles.modalCard, styles.historyModalCard, { width: '90%' }] }>
						<Text style={[styles.modalTitle, styles.historyModalTitle]}>Historial de Movimientos</Text>
						<ScrollView style={{ maxHeight: 360, width: '100%' }}>
							{(() => {
								const pairs = construirParesAlgebricos(engineRef.current);
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
			<Modal visible={juegoTerminado} transparent animationType="fade">
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
							<TouchableOpacity style={[styles.btn, styles.btnClose]} onPress={() => setJuegoTerminado(false)}>
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
	promoOptionsRow: {
		flexDirection: 'row',
		justifyContent: 'space-around',
		width: '100%',
		marginBottom: 8,
	},
	promoOption: {
		alignItems: 'center',
		justifyContent: 'center',
		padding: 8,
		flex: 1,
		marginHorizontal: 6,
		borderRadius: 8,
		elevation: 4,
	},
	promoOptionLightPiece: {
		backgroundColor: '#222',
	},
	promoOptionDarkPiece: {
		backgroundColor: '#fff',
		borderWidth: 1,
		borderColor: '#e6e6e6'
	},
	promoOptionImg: {
		width: 48,
		height: 48,
		marginBottom: 6,
		resizeMode: 'contain'
	},
	promoOptionLabel: {
		fontWeight: '700',
		color: '#222'
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
