package com.syncwave.audiosync

import android.content.Context
import android.content.SharedPreferences
import android.os.Debug
import android.os.Process
import android.util.Log
import java.io.File

/**
 * Lightweight persistent process & memory marker that survives SIGKILL / process death.
 * Records process lifecycle, webview state, live playback, and high-resolution memory trajectory
 * (RSS, Java Heap, Native Heap).
 * On every launch, it inspects whether the previous PID died without running onDestroy,
 * dumping the full forensic evidence.
 */
object ProcessDeathMarker {
    private const val TAG = "[ProcessDeathMarker]"
    private const val PREFS_NAME = "syncwave_death_marker"

    private const val KEY_PID = "pid"
    private const val KEY_START_TIME = "start_time"
    private const val KEY_LAST_HEARTBEAT = "last_heartbeat"
    private const val KEY_UPTIME_SEC = "uptime_sec"
    private const val KEY_LAST_LIFECYCLE = "last_lifecycle"
    private const val KEY_LAST_WEBVIEW = "last_webview"
    private const val KEY_LAST_PLAYBACK = "last_playback"

    private const val KEY_START_RSS = "start_rss"
    private const val KEY_MIN_RSS = "min_rss"
    private const val KEY_MAX_RSS = "max_rss"
    private const val KEY_LAST_RSS = "last_rss"
    private const val KEY_LAST_JAVA_HEAP = "last_java_heap"
    private const val KEY_LAST_NATIVE_HEAP = "last_native_heap"
    private const val KEY_RSS_SAMPLES = "rss_samples"

    private var prefs: SharedPreferences? = null
    private var currentPid: Int = -1
    private var startTimeMs: Long = 0L

    private var startRssMb: Long = 0L
    private var minRssMb: Long = Long.MAX_VALUE
    private var maxRssMb: Long = 0L
    private var lastSampleUptimeSec: Long = -15L
    private val rssSamplesBuilder = StringBuilder()

    @Synchronized
    fun init(context: Context) {
        prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        currentPid = Process.myPid()
        startTimeMs = System.currentTimeMillis()

        val p = prefs ?: return
        val prevPid = p.getInt(KEY_PID, -1)

        if (prevPid != -1 && prevPid != currentPid) {
            val prevHeartbeat = p.getLong(KEY_LAST_HEARTBEAT, 0L)
            val prevUptime = p.getLong(KEY_UPTIME_SEC, 0L)
            val prevLifecycle = p.getString(KEY_LAST_LIFECYCLE, "unknown")
            val prevWebView = p.getString(KEY_LAST_WEBVIEW, "unknown")
            val prevPlayback = p.getString(KEY_LAST_PLAYBACK, "unknown")

            val prevStartRss = p.getLong(KEY_START_RSS, 0L)
            val prevMinRss = p.getLong(KEY_MIN_RSS, 0L)
            val prevMaxRss = p.getLong(KEY_MAX_RSS, 0L)
            val prevLastRss = p.getLong(KEY_LAST_RSS, 0L)
            val prevJavaHeap = p.getLong(KEY_LAST_JAVA_HEAP, 0L)
            val prevNativeHeap = p.getLong(KEY_LAST_NATIVE_HEAP, 0L)
            val prevSamples = p.getString(KEY_RSS_SAMPLES, "none")

            val timeSinceHeartbeatMs = if (prevHeartbeat > 0) startTimeMs - prevHeartbeat else -1L

            Log.e(
                TAG,
                "=== SURVIVED CRASH/DEATH EVIDENCE ===\n" +
                "PREVIOUS PID: $prevPid\n" +
                "PREVIOUS TOTAL UPTIME: ${prevUptime}s\n" +
                "TIME UNTIL NEXT LAUNCH: ${timeSinceHeartbeatMs}ms\n" +
                "LAST RECORDED LIFECYCLE EVENT: $prevLifecycle\n" +
                "LAST RECORDED WEBVIEW STATE: $prevWebView\n" +
                "LAST RECORDED PLAYBACK STATE: $prevPlayback\n" +
                "--- MEMORY TRAJECTORY AT DEATH ---\n" +
                "Start RSS: ${prevStartRss}MB | Min RSS: ${prevMinRss}MB | Max RSS: ${prevMaxRss}MB | Final RSS: ${prevLastRss}MB\n" +
                "Final Java Heap Used: ${prevJavaHeap}MB | Final Native Heap: ${prevNativeHeap}MB\n" +
                "Memory Samples (Uptime): [$prevSamples]\n" +
                "====================================="
            )
        }

        // Sample initial memory for current process
        startRssMb = readProcessRssMb()
        minRssMb = if (startRssMb > 0) startRssMb else 0L
        maxRssMb = startRssMb
        rssSamplesBuilder.setLength(0)
        rssSamplesBuilder.append("${startRssMb}MB@0s")

        val javaHeapMb = getJavaHeapUsedMb()
        val nativeHeapMb = getNativeHeapMb()

        p.edit()
            .putInt(KEY_PID, currentPid)
            .putLong(KEY_START_TIME, startTimeMs)
            .putLong(KEY_LAST_HEARTBEAT, startTimeMs)
            .putLong(KEY_UPTIME_SEC, 0L)
            .putString(KEY_LAST_LIFECYCLE, "onCreate")
            .putString(KEY_LAST_WEBVIEW, "init")
            .putString(KEY_LAST_PLAYBACK, "idle")
            .putLong(KEY_START_RSS, startRssMb)
            .putLong(KEY_MIN_RSS, minRssMb)
            .putLong(KEY_MAX_RSS, maxRssMb)
            .putLong(KEY_LAST_RSS, startRssMb)
            .putLong(KEY_LAST_JAVA_HEAP, javaHeapMb)
            .putLong(KEY_LAST_NATIVE_HEAP, nativeHeapMb)
            .putString(KEY_RSS_SAMPLES, rssSamplesBuilder.toString())
            .apply()

        Log.i(TAG, "ProcessDeathMarker initialized for PID=$currentPid | Initial RSS=${startRssMb}MB | JavaHeap=${javaHeapMb}MB | NativeHeap=${nativeHeapMb}MB")
    }

    @Synchronized
    fun heartbeat() {
        val p = prefs ?: return
        val now = System.currentTimeMillis()
        val uptimeSec = (now - startTimeMs) / 1000L

        val currentRss = readProcessRssMb()
        val javaHeap = getJavaHeapUsedMb()
        val nativeHeap = getNativeHeapMb()

        if (currentRss > 0) {
            if (currentRss < minRssMb) minRssMb = currentRss
            if (currentRss > maxRssMb) maxRssMb = currentRss

            // Sample every 15 seconds to prevent unbounded string growth
            if (uptimeSec - lastSampleUptimeSec >= 15) {
                lastSampleUptimeSec = uptimeSec
                if (rssSamplesBuilder.length > 300) {
                    // Truncate from front to keep latest history compact
                    val firstComma = rssSamplesBuilder.indexOf(',')
                    if (firstComma != -1) {
                        rssSamplesBuilder.delete(0, firstComma + 2)
                    }
                }
                rssSamplesBuilder.append(", ${currentRss}MB@${uptimeSec}s")

                Log.i(
                    TAG,
                    "[MemoryDiag] PID=$currentPid | Uptime=${uptimeSec}s | RSS=${currentRss}MB (start=${startRssMb}MB, min=${minRssMb}MB, max=${maxRssMb}MB) | JavaHeap=${javaHeap}MB | NativeHeap=${nativeHeap}MB"
                )
            }
        }

        p.edit()
            .putLong(KEY_LAST_HEARTBEAT, now)
            .putLong(KEY_UPTIME_SEC, uptimeSec)
            .putLong(KEY_MIN_RSS, minRssMb)
            .putLong(KEY_MAX_RSS, maxRssMb)
            .putLong(KEY_LAST_RSS, currentRss)
            .putLong(KEY_LAST_JAVA_HEAP, javaHeap)
            .putLong(KEY_LAST_NATIVE_HEAP, nativeHeap)
            .putString(KEY_RSS_SAMPLES, rssSamplesBuilder.toString())
            .apply()
    }

    @Synchronized
    fun recordLifecycle(event: String) {
        val p = prefs ?: return
        val now = System.currentTimeMillis()
        val uptimeSec = (now - startTimeMs) / 1000L
        p.edit()
            .putString(KEY_LAST_LIFECYCLE, event)
            .putLong(KEY_LAST_HEARTBEAT, now)
            .putLong(KEY_UPTIME_SEC, uptimeSec)
            .apply()
    }

    @Synchronized
    fun recordWebView(state: String) {
        val p = prefs ?: return
        p.edit()
            .putString(KEY_LAST_WEBVIEW, state)
            .apply()
    }

    @Synchronized
    fun recordPlayback(state: String) {
        val p = prefs ?: return
        p.edit()
            .putString(KEY_LAST_PLAYBACK, state)
            .apply()
    }

    private fun readProcessRssMb(): Long {
        return try {
            val file = File("/proc/self/status")
            if (!file.exists()) return -1L
            file.bufferedReader().use { reader ->
                var line: String? = reader.readLine()
                while (line != null) {
                    if (line.startsWith("VmRSS:")) {
                        val parts = line.split("\\s+".toRegex())
                        if (parts.size >= 2) {
                            val kb = parts[1].toLongOrNull() ?: 0L
                            return kb / 1024L
                        }
                    }
                    line = reader.readLine()
                }
            }
            -1L
        } catch (e: Exception) {
            -1L
        }
    }

    private fun getJavaHeapUsedMb(): Long {
        val rt = Runtime.getRuntime()
        return (rt.totalMemory() - rt.freeMemory()) / (1024L * 1024L)
    }

    private fun getNativeHeapMb(): Long {
        return Debug.getNativeHeapAllocatedSize() / (1024L * 1024L)
    }
}
