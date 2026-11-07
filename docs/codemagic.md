# Compilar Marea en Codemagic (sin Mac)

Es el mismo procedimiento que ya usas con Bacco: Codemagic compila en una Mac en la nube y sube a TestFlight.
Lo que cambia es el proyecto: Marea es Next.js + Capacitor 8 (iOS con Swift Package Manager, sin CocoaPods).
Configuración: `codemagic.yaml` en la raíz del repo `ferinicf/yoga`.

> Los secretos (llaves, contraseñas) **nunca** se pegan en el chat ni se suben al repo: se guardan en Codemagic.

## Una sola vez

### 1. Conectar el repo
1. Entra a **codemagic.io** con tu cuenta (la misma de Bacco).
2. **Add application** → GitHub → elige **ferinicf/yoga**. Si no aparece, dale a Codemagic acceso a ese repo en GitHub
   (Settings → Applications → Codemagic → Repository access).
3. Tipo de proyecto: **Capacitor** (o "Other"); Codemagic detecta `codemagic.yaml`.

### 2. Firma de Apple (iPhone/iPad)
- **Integración de App Store Connect**: es de tu cuenta de Apple y sirve para todas tus apps. En Bacco se llama
  `Bacco-AppStoreConnect`. Si en tu Codemagic tiene otro nombre, cámbialo en `codemagic.yaml` (línea `app_store_connect:`).
- **Grupo de variables `marea`** (en la app de Marea en Codemagic → Environment variables):
  - `CERTIFICATE_PRIVATE_KEY` (marcada como **Secure**): la llave privada del certificado de distribución de Apple.
    Usa **la misma** que pusiste en el grupo `bacco` de Bacco (el archivo de llave que generaste aquella vez).
    Si ya no la tienes, avísame y te digo cómo crear una nueva sin Mac.

### 3. Crear la app en App Store Connect
1. Corre una vez el flujo **ios-testflight** (crea el Bundle ID `mx.marea.app` en tu cuenta de Apple).
   Es normal que esa primera vez falle al final ("subir a App Store Connect") porque la app todavía no existe allá.
2. En **appstoreconnect.apple.com** → Apps → **+** → Nueva app: plataforma iOS, nombre **Marea**, idioma Español (México),
   Bundle ID **mx.marea.app**, SKU `marea-ios`.
3. Copia el **Apple ID** numérico de la app (Información de la app) y ponlo en `codemagic.yaml` → `APP_STORE_APPLE_ID`.
4. Vuelve a correr **ios-testflight**. En 2–10 min aparece en TestFlight.

### 4. Llave de Android (Google Play)
1. Corre el flujo **android-generar-llave** (una sola vez).
2. En esa compilación → **Artifacts**: descarga `marea-upload.jks` y `LEEME-llave.txt` (trae alias y contraseña).
3. Codemagic → **Team settings → Code signing identities → Android keystores → Add keystore**:
   sube el `.jks`, escribe la contraseña y el alias `marea_upload`, y como **Reference name** pon `marea_upload`.
4. Guarda una copia del `.jks` y del `.txt` en un lugar seguro (por ejemplo tu gestor de contraseñas).
   Con *Play App Signing* de Google, si algún día se pierde, se puede restablecer.

## Cada vez que quieras una versión nueva
- **iPhone/iPad**: Start new build → rama `claude/nifty-gates-32j863` (o `main` cuando exista) → **ios-testflight**.
- **Android**: Start new build → **android-play** → descarga el `.aab` de Artifacts y súbelo en Play Console
  (la primera vez es a mano; después se puede automatizar).
- Recuerda: en TestFlight cada compilación caduca a los 90 días.
