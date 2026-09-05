import { expoClient } from '@better-auth/expo/client'
import { oneTimeTokenClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import * as SecureStore from 'expo-secure-store'

import { config } from '@/constants/config'

export const ssoProviderId = config.ssoProviderId

export const authClient = createAuthClient({
  baseURL: config.leafUrl,
  plugins: [
    oneTimeTokenClient(),
    expoClient({
      scheme: config.appScheme,
      storagePrefix: 'leaf',
      storage: SecureStore,
    }),
  ],
})
