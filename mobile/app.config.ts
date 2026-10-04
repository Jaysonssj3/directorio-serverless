export default {
  expo: {
    name: 'Directorio', slug: 'directorio-mobile', version: '1.0.0',
    orientation: 'portrait', userInterfaceStyle: 'light',
    android: { package: 'com.ejemplo.directoriomobile' },
    ios: { bundleIdentifier: 'com.ejemplo.directoriomobile', supportsTablet: true,
      infoPlist: { NSLocalNetworkUsageDescription: 'Conectar con la API de usuarios en tu computadora.', NSAppTransportSecurity: { NSAllowsLocalNetworking: true } } },
    plugins: [
      'expo-secure-store',
      ['expo-image-picker', { photosPermission: 'Selecciona una foto para tu perfil.', cameraPermission: false, microphonePermission: false }],
      ['expo-build-properties', { android: { usesCleartextTraffic: true } }]
    ]
  }
};
