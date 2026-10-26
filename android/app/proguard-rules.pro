# Reglas de ProGuard/R8.
# La compilación de release no ofusca (minifyEnabled false), pero estas reglas
# evitan romper el puente JavaScript si en el futuro se activa la minificación.
-keepattributes JavascriptInterface
-keepclassmembers class pe.hidrocalc.uni.MainActivity$PuenteNativo {
    public *;
}
-keep class android.webkit.JavascriptInterface
