// App.js
import React, { useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GameScreen from './src/screens/GameScreen';
import MainMenu from './src/screens/MainMenu';
import SavedGamesScreen from './src/screens/SavedGamesScreen';
import MultiplayerCreate from './src/screens/MultiplayerCreate';
import MultiplayerJoin from './src/screens/MultiplayerJoin';
import AuthScreen from './src/screens/AuthScreen';

export default function App() {
  const [screen, setScreen] = useState('menu');
  const [screenProps, setScreenProps] = useState({});
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // load current user from AsyncStorage on app start
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('current_user');
        if (raw) {
          setCurrentUser(JSON.parse(raw));
          setScreen('menu');
        } else {
          setScreen('auth');
        }
      } catch (e) {
        console.warn('Error loading current_user', e);
        setScreen('auth');
      }
    })();
  }, []);

  function navigateTo(route, props = {}) {
    setScreen(route);
    setScreenProps(props);
  }

  async function handleSignedIn(user) {
    try {
      if (user) {
        await AsyncStorage.setItem('current_user', JSON.stringify(user));
        setCurrentUser(user);
      }
      setScreen('menu');
    } catch (e) {
      console.warn('Error saving current_user', e);
      setScreen('menu');
    }
  }

  async function handleSignOut() {
    try {
      await AsyncStorage.removeItem('current_user');
      setCurrentUser(null);
      setScreen('auth');
    } catch (e) {
      console.warn('Error removing current_user', e);
    }
  }

  function handleOpenSaved(saved) {
    // abrir GameScreen en modo resume con el log (continuar la partida)
    setScreen('game');
    setScreenProps({ mode: 'resume', replayLog: saved.log, savedName: saved.name, savedId: saved.id });
  }

  return (
    <SafeAreaView style={styles.container}>
      {screen === 'menu' && <MainMenu onNavigate={(r) => navigateTo(r)} user={currentUser} onSignOut={handleSignOut} />}
      {screen === 'auth' && <AuthScreen onSignedIn={(u) => handleSignedIn(u)} onBack={() => navigateTo('menu')} />}
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