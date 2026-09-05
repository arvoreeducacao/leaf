import { Redirect, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LeafButton } from '@/components/LeafButton'
import { useSession } from '@/contexts/SessionContext'
import { useThemeColors } from '@/hooks/useThemeColors'

const emailDomainErrorCode = 'EMAIL_DOMAIN_NOT_ALLOWED'

const copy = {
  title: 'Bem-vindo ao Leaf',
  subtitle: 'Entre na sua conta para escrever e compartilhar documentos.',
  submit: 'Entrar',
  failed: 'Não foi possível entrar. Tente de novo.',
  domainBlocked:
    'A conta que você usou não tem acesso ao Leaf. Entre com outra conta.',
}

function messageForErrorCode(code: string | undefined): string | null {
  if (!code) {
    return null
  }

  return code === emailDomainErrorCode ? copy.domainBlocked : copy.failed
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets()
  const { colors } = useThemeColors()
  const { status, signIn } = useSession()
  const { error: errorCode } = useLocalSearchParams<{ error?: string }>()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(messageForErrorCode(errorCode))
  }, [errorCode])

  if (status === 'signed-in') {
    return <Redirect href="/" />
  }

  async function handleSignIn() {
    setError(null)
    setPending(true)

    try {
      const outcome = await signIn()

      if (outcome === 'failed') {
        setError(copy.failed)
      }
    } catch {
      setError(copy.failed)
    } finally {
      setPending(false)
    }
  }

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.ground,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.brandRow}>
          <Image
            accessibilityIgnoresInvertColors
            accessible={false}
            source={require('../assets/icon.png')}
            style={styles.mark}
          />
          <Text style={[styles.brandName, { color: colors.contentStrong }]}>Leaf</Text>
        </View>

        <Text accessibilityRole="header" style={[styles.title, { color: colors.contentStrong }]}>
          {copy.title}
        </Text>
        <Text style={[styles.subtitle, { color: colors.content }]}>{copy.subtitle}</Text>

        {error ? (
          <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <LeafButton busy={pending} label={copy.submit} onPress={handleSignIn} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    width: '100%',
    maxWidth: 360,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mark: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  brandName: {
    fontSize: 18,
    fontWeight: '600',
  },
  title: {
    marginTop: 40,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    marginTop: 24,
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#c1302f',
    backgroundColor: '#fdebec',
  },
  actions: {
    marginTop: 32,
    gap: 12,
  },
})
