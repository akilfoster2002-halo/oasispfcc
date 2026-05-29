import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { colors, spacing, radius } from '../lib/theme'

export default function LoginScreen() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)

  async function signIn() {
    if (!email.trim() || !password) return
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) Alert.alert('Sign in failed', error.message)
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.wordmark}>Aquila</Text>
        <Text style={styles.tagline}>by Oasis PFCC</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textTertiary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />
          <TouchableOpacity style={styles.button} onPress={signIn} disabled={loading} activeOpacity={0.8}>
            {loading
              ? <ActivityIndicator color="#111318" />
              : <Text style={styles.buttonText}>Sign in</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base,
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  wordmark: {
    fontSize: 42,
    fontWeight: '500',
    color: colors.textPrimary,
    letterSpacing: -1,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 12,
    color: colors.gold,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.xxl * 2,
    fontWeight: '500',
  },
  form: {
    width: '100%',
    gap: spacing.md,
  },
  input: {
    backgroundColor: colors.elevated,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    fontSize: 15,
    color: colors.textPrimary,
  },
  button: {
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonText: {
    color: '#111318',
    fontSize: 15,
    fontWeight: '500',
  },
})
