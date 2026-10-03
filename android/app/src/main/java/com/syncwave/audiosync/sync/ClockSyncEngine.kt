package com.syncwave.audiosync.sync

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

    fun processPingPong(t0: Long, t1: Long, t2: Long, t3: Long): SyncResult {
        val rtt = (t3 - t0) - (t2 - t1)
        val offset = ((t1 - t0) + (t2 - t3)) / 2

        rttHistory.add(rtt.coerceAtLeast(1))
        offsetHistory.add(offset)

        if (rttHistory.size > 12) {
            rttHistory.removeAt(0)
            offsetHistory.removeAt(0)
        }

        val sortedOffsets = offsetHistory.sorted()
        currentOffsetMs = sortedOffsets[sortedOffsets.size / 2]

        val sortedRtt = rttHistory.sorted()
        val medianRtt = sortedRtt[sortedRtt.size / 2]

        val jitter = rttHistory.map { abs(it - medianRtt).toDouble() }.average()

        return SyncResult(
            clockOffsetMs = currentOffsetMs,
            roundTripTimeMs = medianRtt,
            jitterMs = jitter,
            isSynchronized = abs(currentOffsetMs) < 25 && jitter < 15
        )
    }

    fun toHostTime(localEpochMs: Long): Long = localEpochMs + currentOffsetMs

    fun toLocalScheduleTime(hostPtsMs: Long): Long = hostPtsMs - currentOffsetMs

    fun computePlaybackRateAdjustment(phaseDeltaMs: Long): Float {
        return when {
            abs(phaseDeltaMs) <= 10 -> 1.0f
            phaseDeltaMs > 80 -> 1.05f
            phaseDeltaMs < -80 -> 0.95f
            else -> 1.0f + (phaseDeltaMs / 1000f) * 0.15f
        }
    }
}
