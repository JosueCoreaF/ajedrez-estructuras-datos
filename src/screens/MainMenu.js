import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function MainMenu({ onNavigate }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ajedrez — Menú</Text>
      <TouchableOpacity style={styles.btn} onPress={() => onNavigate('new') }>
        <Text style={styles.btnText}>Nueva partida</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btn} onPress={() => onNavigate('saved') }>
        <Text style={styles.btnText}>Partida guardada</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btn} onPress={() => onNavigate('multiplayer') }>
        <Text style={styles.btnText}>Multijugador (Web ↔ Android)</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 24 },
  btn: { width: '100%', padding: 14, backgroundColor: '#2f95dc', borderRadius: 8, marginVertical: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' }
});
