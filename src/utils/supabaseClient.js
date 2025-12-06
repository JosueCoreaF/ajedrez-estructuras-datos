import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// Configura estas variables en tu entorno (app.json / .env)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jczygwgbeazwvbongjft.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjenlnd2diZWF6d3Zib25namZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4Nzc3NTUsImV4cCI6MjA4MDQ1Mzc1NX0.obyoQu58587oLbMQU2A3BpTjuz6l8t1EyestvG7e9aE';

// SecureStore adapter para que supabase-js persista tokens en React Native
const SecureStoreAdapter = {
	getItem: async (key) => {
		try {
			const v = await SecureStore.getItemAsync(key);
			return v;
		} catch (e) {
			return null;
		}
	},
	setItem: async (key, value) => {
		try {
			await SecureStore.setItemAsync(key, value);
		} catch (e) {
			// ignore
		}
	},
	removeItem: async (key) => {
		try {
			await SecureStore.deleteItemAsync(key);
		} catch (e) {
			// ignore
		}
	}
};

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
	auth: {
		storage: SecureStoreAdapter
	}
});

export default supabase;
