import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pulse.app',
  appName: 'Pulse',
  webDir: 'dist',
  server: {
    // For handling OAuth redirects
    androidScheme: 'https',
    iosScheme: 'https',
    hostname: 'pulse.app'
  }
};

export default config;
