import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function MainMenu({ onNavigate, user, onSignOut }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ajedrez — Menú</Text>
      {user ? (
        <View style={{ width: '100%', marginBottom: 12, alignItems: 'center' }}>
          <Text style={{ fontSize: 16 }}>Hola, {user?.user_metadata?.full_name || user?.email || 'Jugador'}</Text>
          {onSignOut ? (
            <TouchableOpacity style={[styles.btn, { backgroundColor: '#aa4444', marginTop: 8 }]} onPress={onSignOut}>
              <Text style={styles.btnText}>Cerrar sesión</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      <TouchableOpacity style={styles.btn} onPress={() => onNavigate('new') }>
        <Text style={styles.btnText}>Nueva partida</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btn} onPress={() => onNavigate('saved') }>
        <Text style={styles.btnText}>Partida guardada</Text>
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Multijugador</Text>
        <TouchableOpacity style={[styles.btn, styles.smallBtn]} onPress={() => onNavigate('multiplayer_create')}>
          <Text style={styles.btnText}>Crear partida</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.smallBtn]} onPress={() => onNavigate('multiplayer_join')}>
          <Text style={styles.btnText}>Unirse a partida</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 24 },
  section: { width: '100%', marginTop: 12, alignItems: 'center' },
  sectionTitle: { fontSize: 22, fontWeight: '700', marginBottom: 8, color: '#333' },
  smallBtn: { width: '100%', paddingVertical: 10, backgroundColor: '#4a7bd4' },
  btn: { width: '100%', padding: 14, backgroundColor: '#2f95dc', borderRadius: 8, marginVertical: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' }
});
