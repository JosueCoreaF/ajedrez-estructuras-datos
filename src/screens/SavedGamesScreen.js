import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Pantalla mínima para conectar a Supabase (o cualquier REST) y listar partidas guardadas.
// Se asume una tabla `saved_games` con columnas: id, name, log_text

export default function SavedGamesScreen({ onBack, onOpenSaved }) {
  const [partidas, setPartidas] = useState([]);

  useEffect(() => {
    cargarPartidasLocal();
  }, []);

  async function cargarPartidasLocal() {
    try {
      const raw = await AsyncStorage.getItem('saved_games');
      const arr = raw ? JSON.parse(raw) : [];
      // ordenar por savedAt desc
      arr.sort((a,b) => (b.savedAt || '') < (a.savedAt || '') ? -1 : 1);
      setPartidas(arr);
    } catch (e) {
      console.warn('Error leyendo partidas locales', e);
      setPartidas([]);
    }
  }

  function confirmarYAbrir(item) {
    // Abrir en modo 'resume'
    onOpenSaved && onOpenSaved({ id: item.id, name: item.name, log: item.log_text });
  }

  async function borrarPartida(item) {
    Alert.alert('Borrar partida', `¿Borrar "${item.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: async () => {
        try {
          const raw = await AsyncStorage.getItem('saved_games');
          const arr = raw ? JSON.parse(raw) : [];
          const filtered = arr.filter(g => g.id !== item.id);
          await AsyncStorage.setItem('saved_games', JSON.stringify(filtered));
          cargarPartidasLocal();
        } catch (e) { console.warn(e); }
      }}
    ]);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Partidas guardadas (local)</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity style={styles.btn} onPress={cargarPartidasLocal}><Text style={styles.btnText}>Recargar</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnAlt]} onPress={onBack}><Text style={styles.btnText}>Volver</Text></TouchableOpacity>
      </View>

      <FlatList data={partidas} keyExtractor={item => String(item.id)} style={{ marginTop: 12 }} renderItem={({ item }) => (
        <View style={styles.gameItem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.gameTitle}>{item.name || `Partida ${item.id}`}</Text>
            <Text style={styles.gameSmall}>{item.savedAt}</Text>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity style={[styles.btn, { marginRight: 8 }]} onPress={() => confirmarYAbrir(item)}><Text style={styles.btnText}>Cargar y continuar</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnAlt]} onPress={() => borrarPartida(item)}><Text style={styles.btnText}>Borrar</Text></TouchableOpacity>
          </View>
        </View>
      )} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 6, marginBottom: 8 },
  btn: { padding: 10, backgroundColor: '#2f95dc', borderRadius: 6, marginRight: 8 },
  btnAlt: { backgroundColor: '#999' },
  btnText: { color: '#fff' },
  gameItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  gameTitle: { fontWeight: '700' },
  gameSmall: { color: '#666' }
});
