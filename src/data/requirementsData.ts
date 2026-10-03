export interface RequirementItem {
  id: string;
  category: 'System & OS' | 'Permissions & Security' | 'Network & Sync' | 'Audio Pipeline' | 'DRM & Policy Constraints';
  title: string;
  requirement: string;
  whyNeeded: string;
  mitigationOrSolution: string;
  iconName: string;
}

export interface ArchitecturePhase {
  phase: number;
  title: string;
  headline: string;
  description: string;
  technicalComponents: string[];
  codeHighlight: string;
  diagramAscii: string;
}

export const APP_REQUIREMENTS: RequirementItem[] = [
  {
    id: 'req-1',
    category: 'System & OS',
    title: 'Minimum Android 10 (API Level 29) + Android 14 Compliance',
    requirement: 'Android 10+ is mandatory for capturing audio from other installed applications without rooting the device.',
    whyNeeded: 'Prior to Android 10, apps could only record from the physical microphone. Android 10 introduced AudioPlaybackCapture API.',
    mitigationOrSolution: 'Target SDK 34 (Android 14) with minimum SDK 29. Include Foreground Service type FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION on Android 14.',
    iconName: 'Smartphone',
  },
  {
    id: 'req-2',
    category: 'Permissions & Security',
    title: 'MediaProjection Token & User Consent Dialog',
    requirement: 'The user must explicitly approve screen/audio capture through Android’s system-level MediaProjection prompt.',
    whyNeeded: 'Android security sandbox prevents stealth recording of background app audio. User must tap "Start now" once per session.',
    mitigationOrSolution: 'Launch MediaProjectionManager.createScreenCaptureIntent() and pass the resulting Intent to an active Foreground Service.',
    iconName: 'ShieldAlert',
  },
  {
    id: 'req-3',
    category: 'Permissions & Security',
    title: 'Audio Recording & Notification Listener Permissions',
    requirement: 'android.permission.RECORD_AUDIO, BIND_NOTIFICATION_LISTENER_SERVICE, and POST_NOTIFICATIONS.',
    whyNeeded: 'RECORD_AUDIO is required by AudioRecord. NotificationListenerService allows reading metadata (song title, artist, art) from Spotify, YouTube Music, Apple Music.',
    mitigationOrSolution: 'Declare in AndroidManifest.xml and request dynamic runtime permissions with clear explanatory in-app rationale.',
    iconName: 'Key',
  },
  {
    id: 'req-4',
    category: 'Network & Sync',
    title: 'Sub-20ms Clock Synchronization (NTP / Christian’s Algorithm)',
    requirement: 'Millisecond-accurate time alignment across all listener devices over Wi-Fi / 5G / LAN.',
    whyNeeded: 'Human ears perceive stereo echo / comb filtering if audio from two phone speakers drifts by more than 15–20 milliseconds.',
    mitigationOrSolution: 'High-frequency 4-timestamp ping exchange with median filter and dynamic phase adjustment (speeding/slowing playback rate by ±4% without pitch change).',
    iconName: 'Clock',
  },
  {
    id: 'req-5',
    category: 'Audio Pipeline',
    title: 'Ultra-Low Latency Opus Audio Codec via WebRTC or UDP',
    requirement: 'Raw PCM 16-bit 48kHz audio buffer compression into 20ms Opus frames with adaptive jitter buffer.',
    whyNeeded: 'Uncompressed audio requires ~1.5 Mbps bandwidth and causes buffering stutters on mobile data. Opus provides pristine audio at 64–128 kbps.',
    mitigationOrSolution: 'Use Google WebRTC native Android SDK or Android NDK with libopus, feeding an AudioTrack playback buffer with adaptive time-stretching.',
    iconName: 'Radio',
  },
  {
    id: 'req-6',
    category: 'DRM & Policy Constraints',
    title: 'Widevine DRM & AudioAttributes.ALLOW_CAPTURE_BY_NONE',
    requirement: 'Handling apps that explicitly prohibit audio capture (e.g. Netflix or high-tier DRM tracks).',
    whyNeeded: 'In Android, an app developer can specify AudioAttributes.FLAG_CONTENT_MUTED or AudioPlaybackCaptureConfiguration policy rules.',
    mitigationOrSolution: 'Dual-Engine approach: (1) System Audio Capture for 95% of music apps (YouTube, SoundCloud, Games, Browser, Spotify free/standard), AND (2) MediaSession Remote Sync for DRM tracks where both devices stream from source in lockstep.',
    iconName: 'Lock',
  },
];

export const ARCHITECTURE_PHASES: ArchitecturePhase[] = [
  {
    phase: 1,
    title: 'System Audio Ingestion (Any App Capture)',
    headline: 'Capturing Audio from Spotify, YouTube, SoundCloud, or Games',
    description: 'The Host device activates an Android Foreground Service with MediaProjection. It constructs an AudioPlaybackCaptureConfiguration to intercept the audio mixer streams matching USAGE_MEDIA, USAGE_GAME, and USAGE_UNKNOWN.',
    technicalComponents: [
      'MediaProjectionManager & MediaProjection',
      'AudioPlaybackCaptureConfiguration.Builder()',
      'AudioRecord (48kHz, 16-bit PCM Stereo)',
      'ForegroundService with FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION',
    ],
    codeHighlight: `val config = AudioPlaybackCaptureConfiguration.Builder(mediaProjection)
    .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
    .addMatchingUsage(AudioAttributes.USAGE_GAME)
    .build()

val audioRecord = AudioRecord.Builder()
    .setAudioPlaybackCaptureConfig(config)
    .setAudioFormat(AudioFormat.Builder()
        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
        .setSampleRate(48000)
        .setChannelMask(AudioFormat.CHANNEL_IN_STEREO)
        .build())
    .build()`,
    diagramAscii: `[ Spotify / YT Music / Game ]
            │ (AudioAttributes.USAGE_MEDIA)
            ▼
[ Android AudioSystem Mixer ]
            │ (Intercepted by AudioPlaybackCaptureConfig)
            ▼
[ AudioRecord (PCM 48kHz Stereo) ]
            │ (20ms PCM Buffers)
            ▼
[ Hardware Opus MediaCodec Encoder ]`,
  },
  {
    phase: 2,
    title: 'Clock Synchronization & Timestamp Tagging',
    headline: 'Christian’s Algorithm for Millisecond-Accurate Alignment',
    description: 'Every captured audio packet is tagged with a target Presentation Time Stamp (PTS) on the host reference timeline. Listener devices compute network round-trip time (RTT) and device clock offset, calculating the exact millisecond when the speaker must emit the sound.',
    technicalComponents: [
      'NTP 4-Timestamp ping packets (T0, T1, T2, T3)',
      'Median filter & Outlier rejection',
      'Presentation Time Stamp (PTS) Header (RTP)',
      'Dynamic Jitter Buffer with phase micro-stretching',
    ],
    codeHighlight: `// Calculate clock offset between Listener and Host
val rtt = (t3 - t0) - (t2 - t1)
val clockOffset = ((t1 - t0) + (t2 - t3)) / 2

// Schedule audio playback at target synchronized epoch
val presentationTimeHost = packet.pts
val presentationTimeLocal = presentationTimeHost - clockOffset
val waitTimeMs = presentationTimeLocal - System.currentTimeMillis()`,
    diagramAscii: `Listener (T0) ──────── ping ────────> Host (T1)
Listener (T3) <─────── pong ──────── Host (T2)

Offset = ((T1 - T0) + (T2 - T3)) / 2
Drift is compensated by micro-adjusting AudioTrack sample rate (e.g. 48,050 Hz)`,
  },
  {
    phase: 3,
    title: 'Low-Latency Mesh Audio Distribution',
    headline: 'WebRTC Audio Relay or Multicast Local Wi-Fi',
    description: 'Audio packets are encoded into 20ms Opus frames (at 64 to 320 kbps) and distributed via WebRTC DataChannel/MediaStream or local UDP multicast if devices are connected to the same Wi-Fi router. STUN/TURN servers handle NAT traversal across cellular 5G networks.',
    technicalComponents: [
      'WebRTC PeerConnection & AudioTrack relay',
      'Adaptive Bitrate (64kbps on cellular, 320kbps on Wi-Fi 6)',
      'Wi-Fi MulticastLock for zero-latency local LAN',
      'Packet Loss Concealment (PLC) built into Opus',
    ],
    codeHighlight: `// Create WebRTC PeerConnection for low-latency audio transmission
val rtcConfig = PeerConnection.RTCConfiguration(iceServers).apply {
    bundlePolicy = PeerConnection.BundlePolicy.MAXBUNDLE
    sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
}
val audioSource = peerConnectionFactory.createAudioSource(MediaConstraints())
val localAudioTrack = peerConnectionFactory.createAudioTrack("SYNC_AUDIO", audioSource)`,
    diagramAscii: `[ Host Device (Pixel 8) ]
       │  (WebRTC PeerConnection / Opus 48kHz)
       ├─────────────────────┬─────────────────────┐
       ▼                     ▼                     ▼
[ Friend 1 (Galaxy S24) ] [ Friend 2 (OnePlus 12) ] [ Friend 3 (Pixel 7) ]
(Sync drift: 1.2ms)       (Sync drift: 2.4ms)       (Sync drift: 0.8ms)`,
  },
  {
    phase: 4,
    title: 'MediaSession & Remote Control Fallback',
    headline: 'Metadata Display & Shared Playback Commands',
    description: 'A companion NotificationListenerService inspects MediaSessionCompat from Android system. It extracts real-time metadata (Album art Bitmap, Track title, Artist, PlaybackState position) and broadcasts seek/play/pause controls so all participants have synchronized lock-screen notifications.',
    technicalComponents: [
      'NotificationListenerService & MediaSessionManager',
      'MediaControllerCompat.TransportControls',
      'RemoteViews / Android 13+ MediaNotification',
      'ReplayGain & hardware volume synchronization',
    ],
    codeHighlight: `class NotificationService : NotificationListenerService() {
    override fun onActiveSessionsChanged(controllers: List<MediaController>?) {
        controllers?.firstOrNull()?.let { controller ->
            val metadata = controller.metadata
            val title = metadata?.getString(MediaMetadata.METADATA_KEY_TITLE)
            val artist = metadata?.getString(MediaMetadata.METADATA_KEY_ARTIST)
            syncRoom.broadcastMetadata(title, artist)
        }
    }
}`,
    diagramAscii: `[ Spotify / Apple Music Notification ]
                   │
                   ▼
[ NotificationListenerService ]
                   │ (Extracts: Title, Artist, Art, Seek Position)
                   ▼
[ SyncWave Lockscreen Player & Remote Transport ]`,
  },
];
