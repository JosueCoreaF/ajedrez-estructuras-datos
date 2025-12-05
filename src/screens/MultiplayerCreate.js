import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import supabase from '../utils/supabaseClient';

export default function MultiplayerCreate({ onNavigate }) {
  const [name, setName] = useState('Partida compartida');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState(null);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      // get current user (require auth to participate)
      let user = null;
      try { const r = await supabase.auth.getUser(); user = r?.data?.user || r?.user || null; } catch (_) { user = null; }
      if (!user) {
        setError('Debes iniciar sesión antes de crear una partida.');
        setLoading(false);
        onNavigate('auth');
        return;
      }
      // generate a short invite code (6 chars) and store it inside metadata to avoid DB schema changes
      const makeCode = (len = 6) => {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // avoid ambiguous chars
        let s = '';
        for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
        return s;
      };
      const inviteCode = makeCode(6);
      const payload = { owner_id: user.id, name: name || `Partida ${new Date().toISOString()}`, log_text: '', public: true, metadata: { invite_code: inviteCode } };
      const { data, error } = await supabase.from('shared_games').insert([payload]).select().single();
      if (error) throw error;
      setCreated(data);
      // add creator to participants as white
      try {
        if (user && data?.id) {
          await supabase.from('shared_game_participants').insert([{ room_id: data.id, user_id: user.id, color: 'w' }]);
        }
      } catch (e) { console.warn('Error adding participant', e); }
      // navigate to game in multiplayer mode (creator enters waiting room) and pass invite code
      onNavigate('game', { mode: 'multiplayer', roomId: data.id, savedName: data.name, savedId: data.id, inviteCode });
    } catch (e) {
      console.warn('Error creating shared game', e);
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crear partida (multijugador)</Text>
      <Text style={styles.label}>Nombre de la sala</Text>
      <TextInput value={name} onChangeText={setName} style={styles.input} />
      <TouchableOpacity style={styles.btn} onPress={handleCreate} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff"/> : <Text style={styles.btnText}>Crear</Text>}
      </TouchableOpacity>

      {created ? (
        <View style={styles.result}>
          <Text style={styles.resultLabel}>Sala creada:</Text>
          <Text selectable style={styles.resultId}>ID: {created.id}</Text>
          <Text selectable style={[styles.resultId, { marginTop: 6 }]}>Código: {created.metadata?.invite_code || inviteCode}</Text>
          <TouchableOpacity style={[styles.btn, { marginTop: 10 }]} onPress={() => onNavigate('game', { mode: 'multiplayer', roomId: created.id, savedName: created.name, savedId: created.id, inviteCode: created.metadata?.invite_code || inviteCode })}>
            <Text style={styles.btnText}>Entrar a la sala</Text>
              </TouchableOpacity>
        </View>
      ) : null}

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
  result: { marginTop: 16, alignItems: 'center' },
  resultLabel: { fontWeight: '700' },
  resultId: { marginTop: 6, color: '#222' },
  btnClose: { backgroundColor: '#777' }
});
