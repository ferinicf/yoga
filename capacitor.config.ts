/// <reference types="@capacitor/splash-screen" />
/// <reference types="@capacitor/status-bar" />
/// <reference types="@capacitor/keyboard" />
/// <reference types="@capacitor/local-notifications" />
import type { CapacitorConfig } from "@capacitor/cli";

/**
 * App nativa de Marea (iOS y Android) con Capacitor.
 *
 * La interfaz va EMPAQUETADA dentro de la app: `webDir` apunta al export estático de Next
 * (`npm run build:app` → `out/`). No usamos `server.url` (sitio remoto): Apple lo rechaza
 * por la regla 4.2 y la documentación de Capacitor dice que no es para producción.
 *
 * Los IDs se pueden cambiar antes de la primera subida a las tiendas; después ya no.
 */
const config: CapacitorConfig = {
  appId: "mx.marea.app",
  appName: "Marea",
  webDir: "out",
  // Mismo fondo que la app (--bg) para que no haya destellos al abrir o al hacer scroll elástico.
  backgroundColor: "#F7F5F1",
  server: {
    // Android sirve la app como https://localhost (contexto seguro: localStorage, crypto, etc.).
    androidScheme: "https",
  },
  ios: {
    // El CSS ya respeta las áreas seguras con env(safe-area-inset-*) y viewport-fit=cover.
    contentInset: "never",
    // Sin vista previa de enlaces al mantener presionado (se siente más nativo).
    allowsLinkPreview: false,
  },
  plugins: {
    SplashScreen: {
      // Se oculta desde <NativeBridge/> cuando la app terminó de cargar (con un tope de seguridad).
      launchAutoHide: false,
      launchFadeOutDuration: 250,
      backgroundColor: "#F7F5F1",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
      splashFullScreen: false,
      splashImmersive: false,
    },
    // Android 15+ (edge-to-edge): Capacitor pasa las áreas seguras al CSS.
    SystemBars: {
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
      style: "LIGHT",
    },
    StatusBar: {
      // Texto oscuro sobre el fondo claro de la app.
      style: "LIGHT",
    },
    Keyboard: {
      // iOS ya redimensiona el WebView por omisión ("native"); esto lo hace también en Android
      // con edge-to-edge (Android 15+), para que el teclado no tape los campos.
      resizeOnFullScreen: true,
      autoBackdropColor: "auto",
    },
    LocalNotifications: {
      smallIcon: "ic_stat_marea",
      iconColor: "#5B7F6E",
      presentationOptions: ["badge", "sound", "banner", "list"],
    },
  },
};

export default config;
