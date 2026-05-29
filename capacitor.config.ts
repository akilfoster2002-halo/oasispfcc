import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId:   'com.oasispfcc.aquila',
  appName: 'Aquila',
  webDir:  'out',
  server: {
    url:             'https://aquilachms.com',
    cleartext:       false,
    allowNavigation: ['aquilachms.com', '*.aquilachms.com', 'lfjqlqedeispdwpfnlva.supabase.co'],
  },
  ios: {
    backgroundColor:       '#111318',
    contentInset:          'always',
    preferredContentMode:  'mobile',
  },
}

export default config
