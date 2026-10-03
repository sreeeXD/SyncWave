package com.syncwave.audiosync.plugins

import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.syncwave.audiosync.MainActivity
import com.syncwave.audiosync.service.AudioRelayHub
import com.syncwave.audiosync.service.CurrentTrackHolder

@CapacitorPlugin(name = "SyncWaveNative")
class SyncWaveAudioPlugin : Plugin() {

    @PluginMethod
    fun getNativeStatus(call: PluginCall) {
        val context = context
        val enabledPackages = NotificationManagerCompat.getEnabledListenerPackages(context)
        val isNotificationPermissionGranted = enabledPackages.contains(context.packageName)

        val deviceModel = "${Build.MANUFACTURER.replaceFirstChar { it.uppercase() }} ${Build.MODEL}"

        val ret = JSObject()
        ret.put("isNativeAndroid", true)
        ret.put("isCapturing", AudioRelayHub.isRecordingActive)
        ret.put("currentTrack", CurrentTrackHolder.lastTrackTitle)
        ret.put("currentArtist", CurrentTrackHolder.lastArtistName)
        ret.put("isPlaying", CurrentTrackHolder.isPlaying)
        ret.put("deviceModel", deviceModel)
        ret.put("osVersion", "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
        ret.put("isNotificationPermissionGranted", isNotificationPermissionGranted)
        call.resolve(ret)
    }

    @PluginMethod
    fun openNotificationListenerSettings(call: PluginCall) {
        try {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            val ret = JSObject()
            ret.put("opened", true)
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Could not open Notification Settings: ${e.message}")
        }
    }

    @PluginMethod
    fun startSystemAudioCapture(call: PluginCall) {
        val activity = activity as? MainActivity
        if (activity != null) {
            activity.requestMediaProjection()
            val ret = JSObject()
            ret.put("requested", true)
            call.resolve(ret)
        } else {
            call.reject("MainActivity not available")
        }
    }

    @PluginMethod
    fun stopSystemAudioCapture(call: PluginCall) {
        val activity = activity as? MainActivity
        if (activity != null) {
            activity.stopBroadcastService()
            val ret = JSObject()
            ret.put("stopped", true)
            call.resolve(ret)
        } else {
            call.reject("MainActivity not available")
        }
    }
}
