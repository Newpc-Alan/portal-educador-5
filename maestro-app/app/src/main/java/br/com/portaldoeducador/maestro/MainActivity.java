package br.com.portaldoeducador.maestro;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

// Portal Maestro · Aluno: abre a página do aluno em tela cheia, sem depender do Chrome instalado no tablet.
public class MainActivity extends Activity {
    private static final String INICIO = "https://sala.portaldoeducador.com.br/aluno/";
    private WebView web;
    private FrameLayout raiz;
    private View telaCheia;
    private WebChromeClient.CustomViewCallback telaCheiaCb;
    private PermissionRequest pedidoCamera;
    private static final int PEDIDO_CAMERA = 7;

    @Override
    protected void onCreate(Bundle salvo) {
        super.onCreate(salvo);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        raiz = new FrameLayout(this);
        raiz.setBackgroundColor(Color.parseColor("#0F2C4A"));
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0F2C4A"));
        raiz.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(raiz);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setUserAgentString(s.getUserAgentString() + " PortalMaestroApp/1");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                String h = u.getHost() == null ? "" : u.getHost();
                if ("https".equals(u.getScheme()) && (h.endsWith("portaldoeducador.com.br") || h.endsWith("firebaseio.com") || h.endsWith("googleapis.com"))) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { /* sem app para abrir */ }
                return true;
            }
            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) semInternet();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback cb) {
                if (telaCheia != null) { cb.onCustomViewHidden(); return; }
                telaCheia = view; telaCheiaCb = cb;
                raiz.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                web.setVisibility(View.GONE);
            }
            @Override
            public void onHideCustomView() { sairTelaCheia(); }
            // câmera: só para as páginas do Portal (entrada do aluno por QR); pede a permissão do Android na primeira vez
            @Override
            public void onPermissionRequest(final PermissionRequest r) {
                runOnUiThread(() -> {
                    String h = r.getOrigin() == null || r.getOrigin().getHost() == null ? "" : r.getOrigin().getHost();
                    boolean video = false;
                    for (String x : r.getResources()) if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(x)) video = true;
                    if (!video || !h.endsWith("portaldoeducador.com.br")) { r.deny(); return; }
                    if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                        r.grant(new String[]{ PermissionRequest.RESOURCE_VIDEO_CAPTURE });
                    } else {
                        pedidoCamera = r;
                        requestPermissions(new String[]{ Manifest.permission.CAMERA }, PEDIDO_CAMERA);
                    }
                });
            }
        });

        if (salvo != null) web.restoreState(salvo); else web.loadUrl(INICIO);
        esconderBarras();
    }

    private void semInternet() {
        String html = "<html><body style='margin:0;background:#0F2C4A;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center'>"
            + "<div><h2>Sem conexão</h2><p>Confira o Wi-Fi do tablet.</p><p><a href='" + INICIO + "' style='display:inline-block;background:#8DC63F;color:#0F2C4A;padding:14px 26px;border-radius:12px;font-weight:bold;text-decoration:none'>Tentar de novo</a></p></div></body></html>";
        web.loadDataWithBaseURL(INICIO, html, "text/html", "UTF-8", null);
    }

    private void sairTelaCheia() {
        if (telaCheia == null) return;
        raiz.removeView(telaCheia); telaCheia = null;
        if (telaCheiaCb != null) telaCheiaCb.onCustomViewHidden();
        telaCheiaCb = null;
        web.setVisibility(View.VISIBLE);
    }

    @SuppressWarnings("deprecation")
    private void esconderBarras() {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean foco) { super.onWindowFocusChanged(foco); if (foco) esconderBarras(); }

    @Override
    public void onRequestPermissionsResult(int cod, String[] perms, int[] res) {
        super.onRequestPermissionsResult(cod, perms, res);
        if (cod != PEDIDO_CAMERA || pedidoCamera == null) return;
        if (res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED) pedidoCamera.grant(new String[]{ PermissionRequest.RESOURCE_VIDEO_CAPTURE });
        else pedidoCamera.deny();
        pedidoCamera = null;
    }

    @Override
    protected void onSaveInstanceState(Bundle b) { super.onSaveInstanceState(b); web.saveState(b); }

    @Override
    protected void onResume() { super.onResume(); web.onResume(); }

    @Override
    protected void onPause() { web.onPause(); super.onPause(); }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (telaCheia != null) { sairTelaCheia(); return; }
        if (web.canGoBack()) { web.goBack(); return; }
        moveTaskToBack(true);
    }

    @Override
    protected void onDestroy() { if (web != null) { web.destroy(); } super.onDestroy(); }
}
