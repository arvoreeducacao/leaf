import Constants from 'expo-constants'

const extra = Constants.expoConfig?.extra ?? {}

const configuredUrl =
  (extra.leafUrl as string | undefined)?.trim() ||
  process.env.EXPO_PUBLIC_LEAF_URL?.trim() ||
  'http://localhost:3000'

const leafUrl = new URL(configuredUrl)

export const config = {
  leafUrl: leafUrl.origin,
  leafHost: leafUrl.host,
  isProductionHost: leafUrl.host === (extra.appBoundDomain as string | null),
  appScheme: Constants.expoConfig?.scheme?.toString() ?? 'app.leaf',
  ssoProviderId: (extra.ssoProviderId as string | undefined)?.trim() || 'sso',
  userAgentSuffix: 'LeafApp/1.0',
  connectivityProbePath: '/manifest.webmanifest',
  loginPath: '/login',
  mobileEntryPath: '/api/mobile/enter',
}

export const theme = {
  light: {
    ground: '#ffffff',
    surface: '#ffffff',
    content: '#37352f',
    contentStrong: '#191919',
    contentSubtle: '#787774',
    rule: '#e9e9e7',
    brand: '#2783de',
    brandStrong: '#1a73c7',
    skeleton: '#f1f1ef',
  },
  dark: {
    ground: '#191919',
    surface: '#191919',
    content: '#d4d4d4',
    contentStrong: '#ffffff',
    contentSubtle: '#9b9b9b',
    rule: '#2f2f2f',
    brand: '#4a9de8',
    brandStrong: '#2783de',
    skeleton: '#262626',
  },
} as const

export type ThemeColors = (typeof theme)[keyof typeof theme]
