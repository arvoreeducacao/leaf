import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { SessionProvider, useSession } from '@/contexts/SessionContext'
import { useThemeColors } from '@/hooks/useThemeColors'

SplashScreen.preventAutoHideAsync().catch(() => {})

function Navigator() {
  const { status } = useSession()
  const { colors, isDark } = useThemeColors()

  useEffect(() => {
    if (status !== 'loading') {
      SplashScreen.hideAsync().catch(() => {})
    }
  }, [status])

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.ground },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="no-connection" />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  )
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <Navigator />
      </SessionProvider>
    </SafeAreaProvider>
  )
}
