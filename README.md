# HidroCalc UNI

Calculadora de caudales de diseño (**Qprom**, **Qmd**, **Qmh**) y volúmenes de cisterna y tanque
elevado para poblaciones universitarias. HTML + Tailwind CSS + JavaScript vanilla, con validaciones
y tabla resumen interactiva (orden, búsqueda, cambio de unidad y copiado).

El mismo `index.html` se empaqueta como **PWA** y como **APK de Android** (contenedor WebView).

---

## Generar el APK desde GitHub (sin instalar nada)

1. Crea un repositorio **nuevo** en GitHub (público o privado, sin README ni plantilla).
2. Sube **todo el contenido de esta carpeta**, incluida la carpeta oculta `.github`:

   - **GitHub Desktop** (más simple): *Add local repository* → elige esta carpeta → *Publish repository*.
   - **Git por consola**:
     ```bash
     git init
     git add .
     git commit -m "HidroCalc UNI"
     git branch -M main
     git remote add origin https://github.com/<usuario>/<repo>.git
     git push -u origin main
     ```
   - **Desde la web**: *Add file → Upload files* y arrastra todo. Si no ves `.github` (Windows oculta
     las carpetas que empiezan con punto), usa *Add file → Create new file*, escribe la ruta
     `.github/workflows/build-apk.yml` y pega el contenido de ese archivo.

3. En el repositorio entra en **Actions → Compilar APK → Run workflow**.
   (También se ejecuta solo al hacer *push* a `main`.)
4. Al terminar (~3 minutos), abre la ejecución y descarga el artefacto **`hidrocalc-uni-apk`**.
5. Descomprime el artefacto: obtendrás **`hidrocalc-uni-1.0.0.apk`**. Pásalo al teléfono, permite
   *"Instalar apps de origen desconocido"* y ábrelo.

> El APK de depuración ya viene firmado con la clave de depuración, por lo que se instala sin pasos extra.
> Para publicarlo en Play Store hay que firmarlo con un keystore propio (ver `README-ANDROID.md`).

## Compilar en tu PC con Android Studio

`File → Open` sobre la carpeta **`android/`** → *Build → Build APK(s)*.
El archivo aparece en `android/app/build/outputs/apk/debug/app-debug.apk`.
Detalles y solución de problemas en **[README-ANDROID.md](README-ANDROID.md)**.

## Usar sin APK (PWA)

Sirve la carpeta por HTTPS o `localhost` (por ejemplo `python -m http.server 5173`) y en Chrome del
teléfono elige **Instalar aplicación**. Queda con icono propio en la pantalla de inicio.

---

## Estructura

```
index.html                 Calculadora (HTML + Tailwind + JS)
css/estilos.css            Sliders, animaciones, respaldo sin CDN, estilos de impresión
js/calculos.js             Núcleo puro: fórmulas, validaciones y formato
js/app.js                  Interfaz: estado, validación, KPIs, tabla interactiva, memoria
manifest.webmanifest       Metadatos de la PWA
icono.svg                  Icono de la PWA
android/                   Proyecto Gradle del APK (WebView, sin dependencias externas)
.github/workflows/         CI que compila el APK en la nube
README-ANDROID.md          Guía detallada del APK
```

## Criterios de cálculo

```
Qprom = P · d / 86 400            [L/s]
Qmd   = K1 · Qprom                [L/s]      K1 ≈ 1.3
Qmh   = K2 · Qmd                  [L/s]      K2 ≈ 2.0
Vd    = P · d / 1 000             [m³/día]
Vt    = Vd · días de reserva      [m³]
Vc    = % cisterna · Vt           [m³]
Vte   = % tanque   · Vt           [m³]
Qb    = Vc / (horas de bombeo · 3.6)   [L/s]
```

Resultados referenciales basados en el RNE IS.010: deben ser verificados por el ingeniero responsable.

## Nota

Los estilos de Tailwind y las tipografías se cargan desde un CDN, así que el primer arranque necesita
internet (luego quedan en caché). Sin conexión, la app avisa y se muestra en un modo legible; los
cálculos siguen funcionando.
