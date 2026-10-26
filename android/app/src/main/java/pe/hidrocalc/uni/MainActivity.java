package pe.hidrocalc.uni;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/**
 * Contenedor nativo de la aplicación web de HidroCalc UNI.
 *
 * La interfaz completa (HTML + Tailwind + JavaScript) se empaqueta en
 * assets/www y se ejecuta en un WebView a pantalla completa. La clase
 * nativa solo aporta lo que la web no puede hacer por sí sola:
 * pantalla completa, botón atrás y el diálogo de impresión/PDF de Android.
 */
public class MainActivity extends Activity {

    private static final String URL_INICIO = "file:///android_asset/www/index.html";
    private static final long INTERVALO_SALIDA_MS = 2000L;

    private WebView visor;
    private long ultimoAtras = 0L;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle estadoGuardado) {
        super.onCreate(estadoGuardado);
        configurarVentana();

        visor = new WebView(this);
        visor.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        visor.setBackgroundColor(Color.parseColor("#F8FAFC"));
        visor.setOverScrollMode(View.OVER_SCROLL_NEVER);

        configurarAjustes(visor.getSettings());

        // Puente mínimo: window.HidroCalcAndroid.imprimir()
        visor.addJavascriptInterface(new PuenteNativo(), "HidroCalcAndroid");

        visor.setWebViewClient(new VisorCliente());
        visor.setWebChromeClient(new WebChromeClient());

        setContentView(visor);

        if (estadoGuardado != null) {
            visor.restoreState(estadoGuardado);
        } else {
            visor.loadUrl(URL_INICIO);
        }
    }

    /** Barras del sistema con el color de marca (el contenido web va debajo). */
    private void configurarVentana() {
        Window ventana = getWindow();
        ventana.setStatusBarColor(getColor(R.color.marca_700));
        ventana.setNavigationBarColor(getColor(R.color.marca_800));
    }

    private void configurarAjustes(WebSettings ajustes) {
        ajustes.setJavaScriptEnabled(true);
        ajustes.setDomStorageEnabled(true);
        ajustes.setDatabaseEnabled(true);
        ajustes.setAllowFileAccess(true);
        ajustes.setAllowContentAccess(true);
        ajustes.setLoadsImagesAutomatically(true);
        ajustes.setUseWideViewPort(true);
        ajustes.setLoadWithOverviewMode(true);
        ajustes.setSupportZoom(false);
        ajustes.setBuiltInZoomControls(false);
        ajustes.setDisplayZoomControls(false);
        ajustes.setSupportMultipleWindows(false);
        ajustes.setMediaPlaybackRequiresUserGesture(false);
        ajustes.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        ajustes.setCacheMode(WebSettings.LOAD_DEFAULT);
    }

    @Override
    protected void onSaveInstanceState(Bundle salida) {
        super.onSaveInstanceState(salida);
        if (visor != null) {
            visor.saveState(salida);
        }
    }

    @Override
    public void onBackPressed() {
        if (visor != null && visor.canGoBack()) {
            visor.goBack();
            return;
        }

        long ahora = System.currentTimeMillis();
        if (ahora - ultimoAtras < INTERVALO_SALIDA_MS) {
            super.onBackPressed();
        } else {
            ultimoAtras = ahora;
            Toast.makeText(this, R.string.pulsa_para_salir, Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onDestroy() {
        if (visor != null) {
            visor.loadUrl("about:blank");
            visor.removeJavascriptInterface("HidroCalcAndroid");
            visor.destroy();
            visor = null;
        }
        super.onDestroy();
    }

    /** Abre en el navegador cualquier enlace que no sea local. */
    private class VisorCliente extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView vista, WebResourceRequest solicitud) {
            Uri destino = solicitud.getUrl();
            String esquema = destino.getScheme() == null ? "" : destino.getScheme();

            if ("file".equals(esquema) || "about".equals(esquema) || "data".equals(esquema)) {
                return false;
            }

            try {
                startActivity(new Intent(Intent.ACTION_VIEW, destino));
            } catch (Exception error) {
                Toast.makeText(MainActivity.this, R.string.no_se_pudo_abrir, Toast.LENGTH_SHORT).show();
            }
            return true;
        }
    }

    /** Métodos expuestos al JavaScript de la app. */
    private class PuenteNativo {

        @JavascriptInterface
        public void imprimir() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    abrirDialogoImpresion();
                }
            });
        }
    }

    /** Permite "Imprimir / Guardar como PDF" usando el servicio de Android. */
    private void abrirDialogoImpresion() {
        if (visor == null) {
            return;
        }
        PrintManager gestor = (PrintManager) getSystemService(PRINT_SERVICE);
        if (gestor == null) {
            Toast.makeText(this, R.string.no_se_pudo_abrir, Toast.LENGTH_SHORT).show();
            return;
        }

        String nombreTrabajo = getString(R.string.nombre_impresion);
        PrintDocumentAdapter adaptador = visor.createPrintDocumentAdapter(nombreTrabajo);
        PrintAttributes atributos = new PrintAttributes.Builder()
                .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                .build();

        gestor.print(nombreTrabajo, adaptador, atributos);
    }
}
