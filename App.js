// App.js
import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import GameScreen from './src/screens/GameScreen';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <GameScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});