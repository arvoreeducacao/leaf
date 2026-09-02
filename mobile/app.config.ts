import type { ConfigContext, ExpoConfig } from 'expo/config'

export const leafProductionHost = 'leaf.arvore.com.br'
export const leafAppScheme = 'app.leaf'

const leafUrl = process.env.EXPO_PUBLIC_LEAF_URL?.trim() || `https://${leafProductionHost}`
const pointsToProduction = new URL(leafUrl).host === leafProductionHost

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Leaf',
  slug: 'leaf',
  version: '0.1.0',
  orientation: 'default',
  scheme: leafAppScheme,
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  runtimeVersion: {
    policy: 'appVersion',
  },
  ios: {
    bundleIdentifier: 'br.com.arvore.leaf',
    supportsTablet: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      ...(pointsToProduction ? { WKAppBoundDomains: [leafProductionHost] } : {}),
    },
  },
  android: {
    package: 'br.com.arvore.leaf',
    edgeToEdgeEnabled: true,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-web-browser',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 160,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
        dark: {
          backgroundColor: '#191919',
        },
      },
    ],
  ],
  extra: {
    leafUrl,
  },
  owner: 'arvoreeducacao',
})
