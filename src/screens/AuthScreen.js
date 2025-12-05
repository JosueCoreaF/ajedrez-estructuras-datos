import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import supabase from '../utils/supabaseClient';

export default function AuthScreen({ onSignedIn, onBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    try {
      setLoading(true);
      setStatus('Creando cuenta...');
      // supabase-js v2 API
      if (supabase.auth && typeof supabase.auth.signUp === 'function') {
        const res = await supabase.auth.signUp({ email, password }, { data: { full_name: fullName } });
        if (res.error) {
          setStatus('Error: ' + res.error.message);
        } else {
          setStatus('Registro enviado. Revisa tu correo para confirmar (si aplica).');
          if (onSignedIn) onSignedIn(res.data?.user || null);
        }
      } else {
        // fallback generic
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) setStatus('Error: ' + error.message);
        else { setStatus('Registro creado'); if (onSignedIn) onSignedIn(data.user || null); }
      }
    } catch (e) {
      setStatus('Error: ' + String(e));
    } finally { setLoading(false); }
  }

  async function handleSignIn() {
    try {
      setLoading(true);
      setStatus('Iniciando sesión...');
      if (supabase.auth && typeof supabase.auth.signInWithPassword === 'function') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setStatus('Error: ' + error.message);
        else { setStatus('Sesión iniciada'); if (onSignedIn) onSignedIn(data.user || null); }
      } else if (supabase.auth && typeof supabase.auth.signIn === 'function') {
        const { user, session, error } = await supabase.auth.signIn({ email, password });
        if (error) setStatus('Error: ' + error.message);
        else { setStatus('Sesión iniciada'); if (onSignedIn) onSignedIn(user || null); }
      } else {
        setStatus('API de Auth no disponible');
      }
    } catch (e) {
      setStatus('Error: ' + String(e));
    } finally { setLoading(false); }
  }

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
      setStatus('Sesión cerrada');
    } catch (e) {
      setStatus('Error cerrando sesión: ' + String(e));
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Iniciar sesión / Registrarse</Text>
      <TextInput placeholder="Nombre completo (opcional al registrarse)" value={fullName} onChangeText={setFullName} style={styles.input} />
      <TextInput placeholder="Correo electrónico" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.input} />
      <TextInput placeholder="Contraseña" secureTextEntry value={password} onChangeText={setPassword} style={styles.input} />

      <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between' }}>
        <TouchableOpacity style={styles.btn} onPress={handleSignIn} disabled={loading}>
          <Text style={styles.btnText}>Iniciar sesión</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor: '#2a7f2a' }]} onPress={handleSignUp} disabled={loading}>
          <Text style={styles.btnText}>Registrarse</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.btn, styles.backBtn]} onPress={() => onBack && onBack()}>
        <Text style={styles.btnText}>Volver</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, styles.signoutBtn]} onPress={handleSignOut}>
        <Text style={styles.btnText}>Cerrar sesión</Text>
      </TouchableOpacity>

      <Text style={{ marginTop: 12, color: '#333' }}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  input: { width: '100%', borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 8, marginBottom: 8 },
  btn: { flex: 1, padding: 12, backgroundColor: '#2f95dc', borderRadius: 8, alignItems: 'center', margin: 6 },
  btnText: { color: '#fff', fontWeight: '600' },
  backBtn: { backgroundColor: '#999', width: '100%', marginTop: 8 },
  signoutBtn: { backgroundColor: '#aa4444', width: '100%', marginTop: 8 }
});
