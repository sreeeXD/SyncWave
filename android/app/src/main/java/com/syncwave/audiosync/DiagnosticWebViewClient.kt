package com.syncwave.audiosync

import android.graphics.Bitmap
import android.net.http.SslError
import android.os.Message
import android.util.Log
import android.webkit.*

/**
 * Wraps Capacitor's existing WebViewClient (which handles http://localhost/ asset-loading
 * and JavaScript bridge injection) and adds diagnostic overrides on top.
 *
 * IMPORTANT: Do NOT call `bridge.webView.webViewClient = plain WebViewClient()` anywhere
 * in MainActivity.  That discards Capacitor's shouldInterceptRequest(), which serves
 * all bundled web assets — causing an immediate white screen.
 *
 * This class delegates every method to [delegate] (the original Capacitor client),
 * only intercepting the events we need for diagnostics.
 */
class DiagnosticWebViewClient(
    private val delegate: WebViewClient,
    private val tag: String,
    private val pid: Int
) : WebViewClient() {

    // ── Page lifecycle ────────────────────────────────────────────────────────

    override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
        return delegate.shouldInterceptRequest(view, request)
    }

    @Deprecated("Deprecated in Java")
    override fun shouldInterceptRequest(view: WebView?, url: String?): WebResourceResponse? {
        return delegate.shouldInterceptRequest(view, url)
    }

    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
        return delegate.shouldOverrideUrlLoading(view, request)
    }

    @Deprecated("Deprecated in Java")
    override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
        return delegate.shouldOverrideUrlLoading(view, url)
    }

    override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
        Log.i(tag, "onPageStarted | url=$url | PID=$pid")
        ProcessDeathMarker.recordWebView("onPageStarted($url)")
        delegate.onPageStarted(view, url, favicon)
    }

    override fun onPageFinished(view: WebView?, url: String?) {
        Log.i(tag, "onPageFinished | url=$url | PID=$pid")
        ProcessDeathMarker.recordWebView("onPageFinished($url)")
        delegate.onPageFinished(view, url)
    }

    override fun onPageCommitVisible(view: WebView?, url: String?) {
        Log.i(tag, "onPageCommitVisible | url=$url | PID=$pid")
        ProcessDeathMarker.recordWebView("onPageCommitVisible($url)")
        delegate.onPageCommitVisible(view, url)
    }

    // ── Error handling ────────────────────────────────────────────────────────

    override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
        val errorCode = error?.errorCode ?: -1
        val errorDesc = error?.description ?: "unknown"
        val url = request?.url?.toString() ?: "unknown"
        Log.e(tag, "onReceivedError | code=$errorCode | desc=$errorDesc | url=$url | PID=$pid")
        ProcessDeathMarker.recordWebView("onReceivedError(code=$errorCode, desc=$errorDesc, url=$url)")
        delegate.onReceivedError(view, request, error)
    }

    override fun onReceivedHttpError(view: WebView?, request: WebResourceRequest?, errorResponse: WebResourceResponse?) {
        val url = request?.url?.toString() ?: "unknown"
        val status = errorResponse?.statusCode ?: -1
        Log.e(tag, "onReceivedHttpError | status=$status | url=$url | PID=$pid")
        ProcessDeathMarker.recordWebView("onReceivedHttpError(status=$status, url=$url)")
        delegate.onReceivedHttpError(view, request, errorResponse)
    }

    override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) {
        Log.e(tag, "onReceivedSslError | error=$error | PID=$pid")
        ProcessDeathMarker.recordWebView("onReceivedSslError(error=$error)")
        delegate.onReceivedSslError(view, handler, error)
    }

    // ── Renderer death — the whole point of this wrapper ─────────────────────

    override fun onRenderProcessGone(view: WebView?, detail: RenderProcessGoneDetail?): Boolean {
        val crashed = detail?.didCrash() ?: false
        val priority = detail?.rendererPriorityAtExit() ?: -1
        Log.e(tag, "onRenderProcessGone | PID=$pid | didCrash=$crashed | rendererPriority=$priority")
        ProcessDeathMarker.recordWebView("onRenderProcessGone(didCrash=$crashed, priority=$priority)")
        // Delegate first so Capacitor can do its own cleanup if it handles this.
        // If delegate returns true it means recovery was attempted; propagate that.
        return try {
            delegate.onRenderProcessGone(view, detail)
        } catch (e: Exception) {
            // Capacitor's client doesn't override this — default is false (kills Activity).
            false
        }
    }
}
