package com.syncwave.audiosync.service

import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.service.notification.NotificationListenerService

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
        CurrentTrackHolder.lastTrackTitle = title
        CurrentTrackHolder.lastArtistName = artist
    }

    private fun broadcastPlaybackState(isPlaying: Boolean, positionMs: Long) {
        CurrentTrackHolder.isPlaying = isPlaying
    }
}

object CurrentTrackHolder {
    var lastTrackTitle: String = "Live System Audio"
    var lastArtistName: String = "Android Device Audio"
    var isPlaying: Boolean = false
}
