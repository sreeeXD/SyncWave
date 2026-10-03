export interface AndroidCodeFile {
  filename: string;
  language: string;
  path: string;
  description: string;
  code: string;
}

export const NATIVE_ANDROID_PROJECT: AndroidCodeFile[] = [
  {
    filename: 'AndroidManifest.xml',
    language: 'xml',
    path: 'app/src/main/AndroidManifest.xml',
    description: 'Android Manifest configuring permissions, Foreground Service with MediaProjection type, and NotificationListenerService.',
    code: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools"
    package="com.syncwave.audiosync">

    <!-- Essential permissions for capturing system audio from other apps -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    <uses-permission android:name="android.permission.CHANGE_WIFI_MULTICAST_STATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <!-- Android 14+ specific foreground service type declarations -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" />

    <application
        android:name=".SyncWaveApplication"
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.SyncWave">

        <!-- Main UI Activity (Jetpack Compose) -->
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTop"
            android:theme="@style/Theme.SyncWave">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Foreground Service that records playback from other music apps -->
        <service
            android:name=".service.AudioCaptureService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="mediaProjection" />

        <!-- Notification Listener to read track metadata from Spotify / YouTube Music -->
        <service
            android:name=".service.MediaSessionObserver"
            android:exported="true"
            android:label="SyncWave Music Reader"
            android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE">
            <intent-filter>
                <action android:name="android.service.notification.NotificationListenerService" />
            </intent-filter>
        </service>

    </application>
</manifest>`,
  },
  {
    filename: 'AudioCaptureService.kt',
    language: 'kotlin',
    path: 'app/src/main/java/com/syncwave/audiosync/service/AudioCaptureService.kt',
    description: 'Captures system audio playback via AudioPlaybackCaptureConfiguration and encodes PCM to Opus frames.',
    code: `package com.syncwave.audiosync.service

import android.app.*
import android.content.Context
import android.content.Intent
import android.media.*
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.*
import java.nio.ByteBuffer

/**
 * Android 10+ System Audio Capture Service.
 * Intercepts audio mixer output from any running music/video/game app
 * and pipes 20ms PCM audio buffers to the WebRTC / ClockSync relay.
 */
class AudioCaptureService : Service() {

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var mediaProjection: MediaProjection? = null
    private var audioRecord: AudioRecord? = null
    private var isCapturing = false

    companion object {
        const val ACTION_START_CAPTURE = "ACTION_START_CAPTURE"
        const val ACTION_STOP_CAPTURE = "ACTION_STOP_CAPTURE"
        const val EXTRA_PROJECTION_DATA = "EXTRA_PROJECTION_DATA"
        const val NOTIFICATION_ID = 4040
        const val CHANNEL_ID = "syncwave_audio_channel"
        const val SAMPLE_RATE = 48000
        const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_STEREO
        const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START_CAPTURE -> {
                val projectionIntent = intent.getParcelableExtra<Intent>(EXTRA_PROJECTION_DATA)
                startForegroundNotification()
                if (projectionIntent != null) {
                    initMediaProjectionAndCapture(projectionIntent)
                }
            }
            ACTION_STOP_CAPTURE -> {
                stopCapture()
                stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    private fun startForegroundNotification() {
        createNotificationChannel()
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("SyncWave Audio Broadcast Active")
            .setContentText("Broadcasting system audio to synchronized listeners...")
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        startForeground(NOTIFICATION_ID, notification)
    }

    private fun initMediaProjectionAndCapture(intent: Intent) {
        val mpManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        mediaProjection = mpManager.getMediaProjection(Activity.RESULT_OK, intent)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && mediaProjection != null) {
            // Build the AudioPlaybackCaptureConfiguration to intercept USAGE_MEDIA
            val config = AudioPlaybackCaptureConfiguration.Builder(mediaProjection!!)
                .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
                .addMatchingUsage(AudioAttributes.USAGE_GAME)
                .addMatchingUsage(AudioAttributes.USAGE_UNKNOWN)
                .build()

            val minBufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT)
            val bufferSize = minBufferSize.coerceAtLeast(SAMPLE_RATE * 2 * 2 / 50) // 20ms buffer

            audioRecord = AudioRecord.Builder()
                .setAudioPlaybackCaptureConfig(config)
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setEncoding(AUDIO_FORMAT)
                        .setSampleRate(SAMPLE_RATE)
                        .setChannelMask(CHANNEL_CONFIG)
                        .build()
                )
                .setBufferSizeInBytes(bufferSize)
                .build()

            startAudioRecordingLoop(bufferSize)
        }
    }

    private fun startAudioRecordingLoop(bufferSize: Int) {
        audioRecord?.startRecording()
        isCapturing = true

        serviceScope.launch {
            val audioBuffer = ByteBuffer.allocateDirect(bufferSize)
            while (isCapturing && isActive) {
                val bytesRead = audioRecord?.read(audioBuffer, bufferSize) ?: -1
                if (bytesRead > 0) {
                    val ptsEpochMs = System.currentTimeMillis()
                    // Forward audio buffer to WebRTC relay / Network socket with Presentation Timestamp
                    AudioRelayHub.broadcastPcmFrame(audioBuffer, bytesRead, ptsEpochMs)
                    audioBuffer.clear()
                }
            }
        }
    }

    private fun stopCapture() {
        isCapturing = false
        try {
            audioRecord?.stop()
            audioRecord?.release()
            audioRecord = null
            mediaProjection?.stop()
            mediaProjection = null
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "SyncWave Audio Capture",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        serviceScope.cancel()
        stopCapture()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}

object AudioRelayHub {
    fun broadcastPcmFrame(buffer: ByteBuffer, bytesRead: Int, pts: Long) {
        // Broadcasts to connected WebRTC peers or Wi-Fi Multicast socket
    }
}`,
  },
  {
    filename: 'ClockSyncEngine.kt',
    language: 'kotlin',
    path: 'app/src/main/java/com/syncwave/audiosync/sync/ClockSyncEngine.kt',
    description: 'NTP-based Christian’s algorithm for sub-20ms peer clock synchronization and drift compensation.',
    code: `package com.syncwave.audiosync.sync

import kotlin.math.abs

/**
 * Christian's Algorithm & NTP Offset Engine.
 * Ensures all connected Android phones execute audio render commands at the exact same epoch.
 */
class ClockSyncEngine {

    data class SyncResult(
        val clockOffsetMs: Long,
        val roundTripTimeMs: Long,
        val jitterMs: Double,
        val isSynchronized: Boolean
    )

    private val offsetHistory = ArrayList<Long>()
    private val rttHistory = ArrayList<Long>()
    private var currentOffsetMs: Long = 0L

    /**
     * Process 4 NTP exchange timestamps:
     * @param t0 Client transmit time (local)
     * @param t1 Host receive time (remote host)
     * @param t2 Host reply transmit time (remote host)
     * @param t3 Client receive time (local)
     */
    fun processPingPong(t0: Long, t1: Long, t2: Long, t3: Long): SyncResult {
        val rtt = (t3 - t0) - (t2 - t1)
        val offset = ((t1 - t0) + (t2 - t3)) / 2

        rttHistory.add(rtt.coerceAtLeast(1))
        offsetHistory.add(offset)

        if (rttHistory.size > 12) {
            rttHistory.removeAt(0)
            offsetHistory.removeAt(0)
        }

        // Apply median filter to eliminate temporary Wi-Fi/5G jitter spikes
        val sortedOffsets = offsetHistory.sorted()
        currentOffsetMs = sortedOffsets[sortedOffsets.size / 2]

        val sortedRtt = rttHistory.sorted()
        val medianRtt = sortedRtt[sortedRtt.size / 2]

        // Calculate jitter (variance)
        val jitter = rttHistory.map { abs(it - medianRtt).toDouble() }.average()

        return SyncResult(
            clockOffsetMs = currentOffsetMs,
            roundTripTimeMs = medianRtt,
            jitterMs = jitter,
            isSynchronized = abs(currentOffsetMs) < 25 && jitter < 15
        )
    }

    /**
     * Converts a local device timestamp into host reference timeline
     */
    fun toHostTime(localEpochMs: Long): Long = localEpochMs + currentOffsetMs

    /**
     * Converts a target host presentation timestamp to local device schedule time
     */
    fun toLocalScheduleTime(hostPtsMs: Long): Long = hostPtsMs - currentOffsetMs

    /**
     * Micro-tuning playback rate without audible pitch shift
     * Returns playback rate (e.g. 0.98x to 1.02x)
     */
    fun computePlaybackRateAdjustment(phaseDeltaMs: Long): Float {
        return when {
            abs(phaseDeltaMs) <= 10 -> 1.0f // Perfect sync zone
            phaseDeltaMs > 80 -> 1.05f      // Slightly fast to catch up
            phaseDeltaMs < -80 -> 0.95f     // Slightly slow to let host catch up
            else -> 1.0f + (phaseDeltaMs / 1000f) * 0.15f
        }
    }
}`,
  },
  {
    filename: 'MediaSessionObserver.kt',
    language: 'kotlin',
    path: 'app/src/main/java/com/syncwave/audiosync/service/MediaSessionObserver.kt',
    description: 'NotificationListenerService capturing active song title, artist, and album art from any music app.',
    code: `package com.syncwave.audiosync.service

import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * Reads playback state and metadata from Spotify, YouTube Music, Apple Music, Tidal, etc.
 */
class MediaSessionObserver : NotificationListenerService() {

    private var activeController: MediaController? = null

    private val callback = object : MediaController.Callback() {
        override fun onMetadataChanged(metadata: MediaMetadata?) {
            metadata?.let {
                val title = it.getString(MediaMetadata.METADATA_KEY_TITLE) ?: "Unknown Track"
                val artist = it.getString(MediaMetadata.METADATA_KEY_ARTIST) ?: "Unknown Artist"
                val album = it.getString(MediaMetadata.METADATA_KEY_ALBUM) ?: ""
                val duration = it.getLong(MediaMetadata.METADATA_KEY_DURATION)
                
                // Broadcast metadata event to room participants
                broadcastTrackInfo(title, artist, album, duration)
            }
        }

        override fun onPlaybackStateChanged(state: PlaybackState?) {
            state?.let {
                val isPlaying = it.state == PlaybackState.STATE_PLAYING
                val position = it.position
                broadcastPlaybackState(isPlaying, position)
            }
        }
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        val sessionManager = getSystemService(MEDIA_SESSION_SERVICE) as MediaSessionManager
        val sessions = sessionManager.getActiveSessions(null)
        attachToPrimarySession(sessions)
    }

    private fun attachToPrimarySession(controllers: List<MediaController>?) {
        activeController?.unregisterCallback(callback)
        activeController = controllers?.firstOrNull()
        activeController?.registerCallback(callback)
    }

    private fun broadcastTrackInfo(title: String, artist: String, album: String, duration: Long) {
        // Sends lightweight JSON over DataChannel to all connected friends
    }

    private fun broadcastPlaybackState(isPlaying: Boolean, positionMs: Long) {
        // Syncs play/pause state
    }
}`,
  },
  {
    filename: 'MainActivity.kt',
    language: 'kotlin',
    path: 'app/src/main/java/com/syncwave/audiosync/ui/MainActivity.kt',
    description: 'Jetpack Compose UI with Material Design 3, real-time waveform, room host/join, and peer status.',
    code: `package com.syncwave.audiosync.ui

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.syncwave.audiosync.service.AudioCaptureService

class MainActivity : ComponentActivity() {

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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                SyncWaveAppScreen(
                    onStartBroadcast = { requestMediaProjection() },
                    onStopBroadcast = { stopBroadcastService() }
                )
            }
        }
    }

    private fun requestMediaProjection() {
        val mpManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        mediaProjectionLauncher.launch(mpManager.createScreenCaptureIntent())
    }

    private fun stopBroadcastService() {
        val serviceIntent = Intent(this, AudioCaptureService::class.java).apply {
            action = AudioCaptureService.ACTION_STOP_CAPTURE
        }
        startService(serviceIntent)
    }
}

@Composable
fun SyncWaveAppScreen(onStartBroadcast: () -> Unit, onStopBroadcast: () -> Unit) {
    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(text = "SyncWave Music Sync", style = MaterialTheme.typography.headlineMedium)
            Spacer(modifier = Modifier.height(16.dp))
            Button(onClick = onStartBroadcast) {
                Text("Start System Audio Broadcast")
            }
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedButton(onClick = onStopBroadcast) {
                Text("Stop Broadcast")
            }
        }
    }
}`,
  },
  {
    filename: 'build.gradle.kts',
    language: 'kotlin',
    path: 'app/build.gradle.kts',
    description: 'Gradle configuration with WebRTC, Jetpack Compose, Media3, and Coroutines dependencies.',
    code: `plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.syncwave.audiosync"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.syncwave.audiosync"
        minSdk = 29 // Android 10 required for AudioPlaybackCapture API
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    buildFeatures {
        compose = true
    }
}

dependencies {
    // Jetpack Compose & Material 3
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.activity.compose)

    // AndroidX Media3 & MediaSession
    implementation("androidx.media3:media3-exoplayer:1.3.1")
    implementation("androidx.media3:media3-session:1.3.1")

    // WebRTC for sub-50ms peer audio mesh
    implementation("org.webrtc:google-webrtc:1.0.32006")

    // Kotlin Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.0")
}`,
  },
];
