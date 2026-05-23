import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.overload.fantasy',
  appName: 'Overload Fantasy',
<<<<<<< HEAD
  webDir: 'dist'
=======
  webDir: 'dist',
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
>>>>>>> 6bc6cc2 (Version 2.2)
};

export default config;
