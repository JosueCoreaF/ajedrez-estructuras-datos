// App.js
import React, { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import GameScreen from './src/screens/GameScreen';
import MainMenu from './src/screens/MainMenu';
import SavedGamesScreen from './src/screens/SavedGamesScreen';
import MultiplayerCreate from './src/screens/MultiplayerCreate';
import MultiplayerJoin from './src/screens/MultiplayerJoin';
import AuthScreen from './src/screens/AuthScreen';

export default function App() {
  const [screen, setScreen] = useState('menu');
  const [screenProps, setScreenProps] = useState({});

  function navigateTo(route, props = {}) {
    setScreen(route);
    setScreenProps(props);
  }

  function handleOpenSaved(saved) {
    // abrir GameScreen en modo resume con el log (continuar la partida)
    setScreen('game');
    setScreenProps({ mode: 'resume', replayLog: saved.log, savedName: saved.name, savedId: saved.id });
  }

  return (
    <SafeAreaView style={styles.container}>
      {screen === 'menu' && <MainMenu onNavigate={(r) => navigateTo(r)} />}
      {screen === 'auth' && <AuthScreen onSignedIn={() => navigateTo('menu')} onBack={() => navigateTo('menu')} />}
      {screen === 'saved' && <SavedGamesScreen onBack={() => navigateTo('menu')} onOpenSaved={handleOpenSaved} />}
      {screen === 'game' && <GameScreen {...screenProps} onExit={() => navigateTo('menu')} />}
      {screen === 'new' && <GameScreen mode={'local'} onExit={() => navigateTo('menu')} />}
      {screen === 'multiplayer' && <GameScreen mode={'multiplayer'} onExit={() => navigateTo('menu')} />}
      {screen === 'multiplayer_create' && <MultiplayerCreate onNavigate={(r, p) => navigateTo(r, p)} />}
      {screen === 'multiplayer_join' && <MultiplayerJoin onNavigate={(r, p) => navigateTo(r, p)} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});