# HidroCalc UNI · APK para Android

La aplicación web se empaqueta dentro de un contenedor nativo mínimo (un `WebView` a pantalla
completa) y se compila como APK. **No usa Node ni librerías de terceros**: solo el SDK de Android.

```
CODEX/
├── index.html, css/, js/          ← la aplicación web (fuente única)
├── manifest.webmanifest, icono.svg
├── android/                       ← proyecto Gradle del APK
│   ├── settings.gradle · build.gradle · gradle.properties
│   └── app/
│       ├── build.gradle           ← copia la web a assets/www en cada compilación
│       └── src/main/
│           ├── AndroidManifest.xml
│           ├── java/pe/hidrocalc/uni/MainActivity.java
│           └── res/               ← tema, colores, icono adaptativo
└── .github/workflows/build-apk.yml ← compilación en la nube (sin instalar nada)
```

| Dato | Valor |
|---|---|
| Paquete | `pe.hidrocalc.uni` |
| Nombre visible | HidroCalc UNI |
| Versión | 1.0.0 (versionCode 1) |
| Android mínimo | 8.0 (API 26) |
| Android objetivo | 14 (API 34) |
| Peso aproximado | ~1,5 MB |

---

## Camino A · Compilar en la nube (no requiere instalar nada)

1. Crea un repositorio (GitHub, público o privado) y sube el proyecto completo.
2. Entra en **Actions → Compilar APK → Run workflow** (también se ejecuta solo al hacer push a `main`).
3. Al terminar (~3 min), abre la ejecución y descarga el artefacto **`hidrocalc-uni-apk`**:
   dentro está `hidrocalc-uni-1.0.0.apk`.
4. Pasa el archivo al teléfono, permite *"Instalar apps de origen desconocido"* y ábrelo.

> El APK de depuración ya viene firmado con la clave de depuración, así que se instala sin pasos extra.

## Camino B · Android Studio (compilación local)

1. Instala **Android Studio** (incluye JDK 17 y el SDK).
2. `File → Open…` y elige la carpeta **`android/`** (no la raíz del repositorio).
3. Espera la sincronización de Gradle: descargará Gradle 8.7 y AGP 8.5.2, y pedirá aceptar el SDK 34.
4. Menú **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
5. El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`.
6. Para probarlo: activa *Depuración USB* en el teléfono, conéctalo y pulsa **Run ▶**.

Con la línea de comandos (Gradle instalado):

```powershell
cd android
gradle assembleDebug        # genera el APK
gradle installDebug         # lo instala en el teléfono conectado
```

Si Android Studio avisa que falta el *Gradle wrapper* (`gradle-wrapper.jar`), ejecuta una vez
`gradle wrapper --gradle-version 8.7` dentro de `android/` (o acepta la corrección automática del IDE).

## Camino C · Sin compilar: instalar como PWA

El proyecto ya es una PWA. Sirviéndolo por HTTPS (o `localhost`), en Chrome del teléfono:
**menú ⋮ → Instalar aplicación / Añadir a pantalla de inicio**. Queda como una app con icono propio,
sin APK ni tienda.

---

## Cómo se integra la web con Android

`app/build.gradle` registra la tarea `copiarWeb`, que en cada compilación copia `index.html`,
`css/`, `js/`, `manifest.webmanifest` e `icono.svg` a `app/src/main/assets/www`. **No hay que
duplicar archivos**: al editar la web basta con recompilar.

`MainActivity.java` aporta lo que un navegador no da:

- Pantalla completa sin barra de título, barras del sistema en color de marca.
- Botón **atrás**: navega en el historial y, en la pantalla principal, pide doble pulsación para salir.
- Enlaces externos se abren en el navegador del teléfono.
- `localStorage` habilitado, así que los datos y el tema se conservan entre sesiones.
- Puente `window.HidroCalcAndroid.imprimir()`: el botón **PDF** abre el diálogo de impresión de
  Android, desde donde se puede *Guardar como PDF*. Si el puente no existe (navegador), la web usa
  `window.print()`.
- Rotación y cambio de tema del sistema no recargan la app (`configChanges`).

## Personalizar

| Qué | Dónde |
|---|---|
| Nombre de la app | `android/app/src/main/res/values/strings.xml` → `app_name` |
| Icono | `res/drawable/ic_launcher_foreground.xml` y `ic_launcher_background.xml` |
| Colores de barras / fondo | `res/values/colors.xml` y `res/values/themes.xml` |
| Versión | `android/app/build.gradle` → `versionCode` / `versionName` |
| Identificador de tienda | `android/app/build.gradle` → `applicationId` |
| Pantalla completa, orientación | `android/app/src/main/AndroidManifest.xml` |

## Firmar para publicar en Play Store

```powershell
keytool -genkey -v -keystore hidrocalc.keystore -alias hidrocalc `
        -keyalg RSA -keysize 2048 -validity 10000
```

Añade en `android/app/build.gradle` dentro de `android { }`:

```groovy
signingConfigs {
    release {
        storeFile file("../hidrocalc.keystore")
        storePassword System.getenv("KEYSTORE_PASS")
        keyAlias "hidrocalc"
        keyPassword System.getenv("KEY_PASS")
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
    }
}
```

Y genera el paquete: `gradle bundleRelease` → `app/build/outputs/bundle/release/app-release.aab`.

## Notas y limitaciones

- **Primer arranque con internet**: Tailwind y las tipografías se cargan desde un CDN. Después quedan
  en la caché del WebView. Sin red, la app lo avisa y muestra una versión legible sin estilos
  (`html.sin-tailwind` en `css/estilos.css`), pero los cálculos siguen funcionando.
- El APK no pide permisos sensibles: solo `INTERNET` y `ACCESS_NETWORK_STATE`.
- `minSdk 26` permite usar icono adaptativo y evita generar PNG por densidad.
- La impresión usa el servicio del sistema; en emuladores sin servicio de impresión puede no abrirse.

## Problemas frecuentes

| Síntoma | Solución |
|---|---|
| `SDK location not found` | Crea `android/local.properties` con `sdk.dir=C\:\\Users\\<usuario>\\AppData\\Local\\Android\\Sdk` |
| `Unsupported class file major version` | Configura Gradle JDK 17 en *Settings → Build Tools → Gradle* |
| Pantalla en blanco en el APK | Verifica que exista `app/src/main/assets/www/index.html`; ejecuta `gradle copiarWeb` |
| `gradlew` no encontrado / no ejecutable | Usa `gradle` directamente o genera el wrapper con `gradle wrapper --gradle-version 8.7` |
