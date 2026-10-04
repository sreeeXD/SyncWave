package com.syncwave.audiosync

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.BroadcastReceiver
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import android.os.Process
import android.util.Log
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import android.view.WindowManager
import com.getcapacitor.BridgeActivity
import com.syncwave.audiosync.plugins.SyncWaveAudioPlugin
import com.syncwave.audiosync.service.AudioCaptureService

class MainActivity : BridgeActivity() {
    private val TAG = "[AndroidLifecycle]"
    private val BT_TAG = "[Bluetooth]"
    private val WV_TAG = "[WebView]"
    private val pid = Process.myPid()
    private lateinit var audioManager: AudioManager

    private val mediaProjectionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            val serviceIntent = Intent(this, AudioCaptureService::class.java).apply {
                action = AudioCaptureService.ACTION_START_CAPTURE
                putExtra(AudioCaptureService.EXTRA_PROJECTION_DATA, result.data)
            }
            startForegroundService(serviceIntent)
        }
    }

    private val heartbeatHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private val heartbeatRunnable = object : Runnable {
        override fun run() {
            ProcessDeathMarker.heartbeat()
            heartbeatHandler.postDelayed(this, 5000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ProcessDeathMarker.init(applicationContext)
        Log.i(TAG, "Activity onCreate | PID=$pid | savedInstanceState=${savedInstanceState != null}")
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        registerPlugin(SyncWaveAudioPlugin::class.java)

        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager

        // Register audio device callback to track Bluetooth connect/disconnect
        audioManager.registerAudioDeviceCallback(object : AudioDeviceCallback() {
            override fun onAudioDevicesAdded(addedDevices: Array<out AudioDeviceInfo>?) {
                addedDevices?.forEach {
                    Log.i(BT_TAG, "Device Added: ${it.productName} (type: ${it.type}) | PID=$pid")
                }
            }
            override fun onAudioDevicesRemoved(removedDevices: Array<out AudioDeviceInfo>?) {
                removedDevices?.forEach {
                    Log.i(BT_TAG, "Device Removed: ${it.productName} (type: ${it.type}) | PID=$pid")
                }
            }
        }, null)

        val btReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                Log.i(BT_TAG, "Broadcast: ${intent?.action} | PID=$pid")
            }
        }
        val filter = IntentFilter().apply {
            addAction("android.bluetooth.device.action.ACL_CONNECTED")
            addAction("android.bluetooth.device.action.ACL_DISCONNECTED")
            addAction("android.media.ACTION_SCO_AUDIO_STATE_UPDATED")
            addAction(AudioManager.ACTION_AUDIO_BECOMING_NOISY)
        }
        registerReceiver(btReceiver, filter)
    }

    override fun onStart() {
        super.onStart()
        ProcessDeathMarker.recordLifecycle("onStart")
        Log.i(TAG, "Activity onStart | PID=$pid")
    }

    override fun onResume() {
        super.onResume()
        ProcessDeathMarker.recordLifecycle("onResume")
        heartbeatHandler.removeCallbacks(heartbeatRunnable)
        heartbeatHandler.post(heartbeatRunnable)
        Log.i(TAG, "Activity onResume | PID=$pid")

        // Subclass Capacitor's own WebViewClient so we add onRenderProcessGone diagnostics
        // WITHOUT replacing the Capacitor bridge asset-interception logic.
        // Installing a bare WebViewClient() here (as done in P1-B.7) removes Capacitor's
        // shouldInterceptRequest(), which serves http://localhost/ — causing a white screen.
        try {
            val bridge = bridge ?: return
            val webView = bridge.webView ?: return
            val existing = webView.webViewClient ?: return
            if (existing !is DiagnosticWebViewClient) {
                webView.webViewClient = DiagnosticWebViewClient(existing, WV_TAG, pid)
                Log.i(WV_TAG, "DiagnosticWebViewClient installed over ${existing.javaClass.simpleName} | PID=$pid")
            }
        } catch (e: Exception) {
            Log.e(WV_TAG, "Failed to install DiagnosticWebViewClient: ${e.message}")
        }
    }

    override fun onPause() {
        super.onPause()
        ProcessDeathMarker.recordLifecycle("onPause(isFinishing=$isFinishing)")
        heartbeatHandler.removeCallbacks(heartbeatRunnable)
        Log.i(TAG, "Activity onPause | PID=$pid | isFinishing=$isFinishing")
    }

    override fun onStop() {
        super.onStop()
        ProcessDeathMarker.recordLifecycle("onStop(isFinishing=$isFinishing, isChangingConfig=$isChangingConfigurations)")
        Log.i(TAG, "Activity onStop | PID=$pid | isFinishing=$isFinishing | isChangingConfigurations=$isChangingConfigurations")
    }

    override fun onDestroy() {
        super.onDestroy()
        ProcessDeathMarker.recordLifecycle("onDestroy(isFinishing=$isFinishing, isChangingConfig=$isChangingConfigurations)")
        heartbeatHandler.removeCallbacks(heartbeatRunnable)
        Log.i(TAG, "Activity onDestroy | PID=$pid | isFinishing=$isFinishing | isChangingConfigurations=$isChangingConfigurations")
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        ProcessDeathMarker.recordLifecycle("onSaveInstanceState")
        Log.i(TAG, "Activity onSaveInstanceState | PID=$pid")
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        ProcessDeathMarker.recordLifecycle("onNewIntent(${intent.action})")
        Log.i(TAG, "Activity onNewIntent | PID=$pid | action=${intent.action}")
    }

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        val levelName = when (level) {
            5 -> "TRIM_MEMORY_RUNNING_MODERATE(5)"
            10 -> "TRIM_MEMORY_RUNNING_LOW(10)"
            15 -> "TRIM_MEMORY_RUNNING_CRITICAL(15)"
            20 -> "TRIM_MEMORY_UI_HIDDEN(20)"
            40 -> "TRIM_MEMORY_BACKGROUND(40)"
            60 -> "TRIM_MEMORY_MODERATE(60)"
            80 -> "TRIM_MEMORY_COMPLETE(80)"
            else -> "level=$level"
        }
        ProcessDeathMarker.recordLifecycle("onTrimMemory($levelName)")
        Log.w(TAG, "onTrimMemory: $levelName | PID=$pid")
    }

    fun requestMediaProjection() {
        val mpManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        mediaProjectionLauncher.launch(mpManager.createScreenCaptureIntent())
    }

    fun stopBroadcastService() {
        val serviceIntent = Intent(this, AudioCaptureService::class.java).apply {
            action = AudioCaptureService.ACTION_STOP_CAPTURE
        }
        startService(serviceIntent)
    }
}
