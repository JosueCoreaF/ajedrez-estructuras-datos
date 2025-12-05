import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function MainMenu({ onNavigate }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ajedrez — Menú</Text>
      <TouchableOpacity style={[styles.btn, { backgroundColor: '#555' }]} onPress={() => onNavigate('auth')}>
        <Text style={styles.btnText}>Iniciar sesión / Registrarse</Text>
      </TouchableOpacity>
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
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, color: '#333' },
  smallBtn: { width: '80%', paddingVertical: 10, backgroundColor: '#4a7bd4' },
  btn: { width: '100%', padding: 14, backgroundColor: '#2f95dc', borderRadius: 8, marginVertical: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' }
});
