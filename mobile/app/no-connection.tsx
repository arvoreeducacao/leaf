import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LeafButton } from '@/components/LeafButton'
import { useConnectivity } from '@/hooks/useConnectivity'
import { useThemeColors } from '@/hooks/useThemeColors'

const copy = {
  title: 'Sem conexão',
  body: 'O Leaf precisa de internet para abrir esta página. Documentos que você já abriu continuam disponíveis quando a conexão voltar.',
  retry: 'Tentar de novo',
}

const firstAutoRetryMs = 3000
const maxAutoRetryMs = 60000

export default function NoConnectionScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { colors } = useThemeColors()
  const { isConnected, probe } = useConnectivity()
  const [retrying, setRetrying] = useState(false)
  const autoRetryDelay = useRef(firstAutoRetryMs)

  async function retry() {
    setRetrying(true)
    const reachable = await probe()
    setRetrying(false)

    if (reachable) {
      router.replace('/')
    }
  }

  useEffect(() => {
    if (!isConnected) return

    let cancelled = false
    const timer = setTimeout(async () => {
      const reachable = await probe()

      if (cancelled) return

      if (reachable) {
        router.replace('/')
      } else {
        autoRetryDelay.current = Math.min(autoRetryDelay.current * 2, maxAutoRetryMs)
      }
    }, autoRetryDelay.current)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [isConnected, probe, router])

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
        <Image
          accessibilityIgnoresInvertColors
          accessible={false}
          source={require('../assets/icon.png')}
          style={styles.mark}
        />
        <Text accessibilityRole="header" style={[styles.title, { color: colors.contentStrong }]}>
          {copy.title}
        </Text>
        <Text style={[styles.body, { color: colors.content }]}>{copy.body}</Text>
        <View style={styles.actions}>
          <LeafButton busy={retrying} label={copy.retry} onPress={retry} />
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
    alignItems: 'center',
  },
  mark: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  title: {
    marginTop: 20,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  actions: {
    marginTop: 28,
    alignSelf: 'stretch',
  },
})
