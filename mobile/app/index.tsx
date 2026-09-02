import * as Linking from 'expo-linking'
import * as NavigationBar from 'expo-navigation-bar'
import { Redirect, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BackHandler, Platform, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import WebView, {
  type WebViewMessageEvent,
  type WebViewNavigation,
} from 'react-native-webview'
import type {
  ShouldStartLoadRequest,
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
} from 'react-native-webview/lib/WebViewTypes'

import { PageSkeleton } from '@/components/PageSkeleton'
import { config } from '@/constants/config'
import { useSession } from '@/contexts/SessionContext'
import { useThemeColors } from '@/hooks/useThemeColors'
import { requestWebViewEntry } from '@/lib/session-handoff'

const connectionErrorCodes = new Set([-1009, -1001, -999, -2, -6, -7])
const connectionErrorDescriptions = [
  'net::ERR_INTERNET_DISCONNECTED',
  'net::ERR_NAME_NOT_RESOLVED',
  'net::ERR_CONNECTION_REFUSED',
  'net::ERR_NETWORK_CHANGED',
  'net::ERR_CONNECTION_TIMED_OUT',
]

const bridgeScript = `
(function () {
  if (window.__leafAppBridge) return;
  window.__leafAppBridge = true;
  window.leafApp = { platform: '${Platform.OS}' };
  window.addEventListener('DOMContentLoaded', function () {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
  });
})();
true;
`

function isLeafOrigin(url: string): boolean {
  try {
    return new URL(url).origin === config.leafUrl
  } catch {
    return false
  }
}

function isLoginPage(url: string): boolean {
  try {
    return new URL(url).pathname === config.loginPath
  } catch {
    return false
  }
}

function isConnectionError(code: number | undefined, description: string | undefined): boolean {
  if (code !== undefined && connectionErrorCodes.has(code)) {
    return true
  }

  return connectionErrorDescriptions.some((fragment) => description?.includes(fragment))
}

export default function LeafScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors, isDark } = useThemeColors()
  const { status, signInCount, sessionDropped } = useSession()
  const webViewRef = useRef<WebView>(null)
  const [entryUrl, setEntryUrl] = useState<string | null>(null)
  const [canGoBack, setCanGoBack] = useState(false)
  const [firstPaintDone, setFirstPaintDone] = useState(false)

  const goOffline = useCallback(() => {
    router.replace('/no-connection')
  }, [router])

  useEffect(() => {
    if (status !== 'signed-in') return

    let active = true
    setEntryUrl(null)
    setFirstPaintDone(false)

    requestWebViewEntry()
      .catch(() => ({ kind: 'unreachable' as const }))
      .then((handoff) => {
        if (!active) return

        if (handoff.kind === 'entry') {
          setEntryUrl(handoff.url)
        } else if (handoff.kind === 'signed-out') {
          sessionDropped().catch(() => {})
        } else {
          goOffline()
        }
      })

    return () => {
      active = false
    }
  }, [status, signInCount, sessionDropped, goOffline])

  useEffect(() => {
    if (Platform.OS !== 'android') return

    NavigationBar.setBackgroundColorAsync(colors.ground).catch(() => {})
    NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark').catch(() => {})
  }, [colors.ground, isDark])

  useEffect(() => {
    if (Platform.OS !== 'android') return

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack()
        return true
      }

      return false
    })

    return () => subscription.remove()
  }, [canGoBack])

  const handleShouldStartLoad = useCallback(
    (request: ShouldStartLoadRequest) => {
      if (request.isTopFrame === false) {
        return true
      }

      if (!isLeafOrigin(request.url)) {
        Linking.openURL(request.url).catch(() => {})
        return false
      }

      if (isLoginPage(request.url)) {
        sessionDropped().catch(() => {})
        return false
      }

      return true
    },
    [sessionDropped],
  )

  const handleNavigationStateChange = useCallback(
    (navigation: WebViewNavigation) => {
      setCanGoBack(navigation.canGoBack)

      if (isLoginPage(navigation.url)) {
        sessionDropped().catch(() => {})
      }
    },
    [sessionDropped],
  )

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { type?: string }

      if (message.type === 'ready') {
        setFirstPaintDone(true)
      }
    } catch {
      setFirstPaintDone(true)
    }
  }, [])

  const handleError = useCallback(
    (event: WebViewErrorEvent) => {
      const { code, description } = event.nativeEvent

      if (isConnectionError(code, description)) {
        goOffline()
      }
    },
    [goOffline],
  )

  const handleHttpError = useCallback(
    (event: WebViewHttpErrorEvent) => {
      const { statusCode, url } = event.nativeEvent

      if (statusCode === 401 && url.startsWith(`${config.leafUrl}${config.mobileEntryPath}`)) {
        sessionDropped().catch(() => {})
        return
      }

      if (statusCode >= 502 && statusCode <= 504) {
        goOffline()
      }
    },
    [goOffline, sessionDropped],
  )

  if (status === 'loading') {
    return <View style={[styles.screen, { backgroundColor: colors.ground }]} />
  }

  if (status === 'signed-out') {
    return <Redirect href="/login" />
  }

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.ground,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {entryUrl ? (
        <WebView
          key={entryUrl}
          ref={webViewRef}
          source={{ uri: entryUrl }}
          style={[styles.webView, { backgroundColor: colors.ground }]}
          allowsBackForwardNavigationGestures
          allowsInlineMediaPlayback
          applicationNameForUserAgent={config.userAgentSuffix}
          bounces={false}
          cacheEnabled
          domStorageEnabled
          javaScriptEnabled
          injectedJavaScriptBeforeContentLoaded={bridgeScript}
          limitsNavigationsToAppBoundDomains={config.isProductionHost}
          mediaPlaybackRequiresUserAction={false}
          nestedScrollEnabled={false}
          onContentProcessDidTerminate={() => webViewRef.current?.reload()}
          onError={handleError}
          onHttpError={handleHttpError}
          onLoadEnd={() => setFirstPaintDone(true)}
          onMessage={handleMessage}
          onNavigationStateChange={handleNavigationStateChange}
          onRenderProcessGone={() => webViewRef.current?.reload()}
          onShouldStartLoadWithRequest={handleShouldStartLoad}
          overScrollMode="never"
          pullToRefreshEnabled={false}
          setSupportMultipleWindows={false}
          sharedCookiesEnabled
          textZoom={100}
          thirdPartyCookiesEnabled
          webviewDebuggingEnabled={__DEV__}
        />
      ) : null}
      {!firstPaintDone ? <PageSkeleton /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
})
