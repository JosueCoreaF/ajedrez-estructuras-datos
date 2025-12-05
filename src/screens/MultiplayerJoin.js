import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import supabase from '../utils/supabaseClient';

export default function MultiplayerJoin({ onNavigate }) {
  const [roomId, setRoomId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleJoin() {
      setLoading(true);
      setError(null);
      try {
        // require authenticated user
        let user = null;
        try { const r = await supabase.auth.getUser(); user = r?.data?.user || r?.user || null; } catch (_) { user = null; }
        if (!user) {
          setError('Debes iniciar sesión antes de unirte a una partida.');
          setLoading(false);
          onNavigate('auth');
          return;
        }
        // Only allow joining by short invite code (metadata.invite_code)
        const code = String(roomId || '').trim().toUpperCase();
        if (!code || code.length < 3 || code.length > 12) {
          setError('Código inválido. Usa el código corto proporcionado por el creador.');
          setLoading(false);
          return;
        }
        let game = null;
        try {
          const { data: byCode, error: eCode } = await supabase.from('shared_games').select('*').filter('metadata->>invite_code', 'eq', code).maybeSingle();
          if (eCode) throw eCode;
          if (byCode) game = byCode;
        } catch (err) {
          console.warn('search by invite_code error', err);
          throw err;
        }
        if (!game) {
          setError('Sala no encontrada con ese código. Asegúrate de usar el código corto.');
          setLoading(false);
          return;
        }
        // compute color assignment simplistic: check participants by actual game id
        const roomUuid = game.id;
        const partsRes = await supabase.from('shared_game_participants').select('*').eq('room_id', roomUuid).order('joined_at', { ascending: true });
        const participants = partsRes?.data || [];
        if (partsRes?.error) console.warn('participants select error', partsRes.error);
        const hasWhite = (participants || []).some(p => p.color === 'w');
        const assignColor = hasWhite ? 'b' : 'w';
        const insertRes = await supabase.from('shared_game_participants').insert([{ room_id: roomUuid, user_id: user.id, color: assignColor }]).select().single();
        if (insertRes?.error) {
          console.warn('Error inserting participant', insertRes.error);
          setError('No se pudo añadir participante: ' + (insertRes.error.message || String(insertRes.error)));
          setLoading(false);
          return;
        }
        // try to mark started (optional)
        try { await supabase.from('shared_games').update({ started: true }).eq('id', roomUuid); } catch (_) {}
      // navegar a GameScreen en modo multiplayer y pasar el roomId para suscribirse
      // pass roomId as the actual game id so GameScreen subscribes correctly
      onNavigate('game', { mode: 'multiplayer', replayLog: game?.log_text || null, savedName: game?.name || null, savedId: game?.id || null, roomId: game.id });
    } catch (e) {
      console.warn('Error joining shared game', e);
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Unirse a partida</Text>
      <Text style={styles.label}>Código de la sala (ID)</Text>
      <TextInput value={roomId} onChangeText={setRoomId} style={styles.input} placeholder="pegar el id de la sala" />
      <TouchableOpacity style={styles.btn} onPress={handleJoin} disabled={loading || !roomId}>
        {loading ? <ActivityIndicator color="#fff"/> : <Text style={styles.btnText}>Unirse</Text>}
      </TouchableOpacity>

      {error ? <Text style={{ color: 'red', marginTop: 8 }}>{error}</Text> : null}

      <TouchableOpacity style={[styles.btn, styles.btnClose, { marginTop: 16 }]} onPress={() => onNavigate('menu')}>
        <Text style={styles.btnText}>Volver</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  label: { alignSelf: 'flex-start', marginTop: 12, marginBottom: 6 },
  input: { width: '100%', padding: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 8 },
  btn: { width: '100%', padding: 12, backgroundColor: '#2f95dc', borderRadius: 8, marginTop: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
  btnClose: { backgroundColor: '#777' }
});
