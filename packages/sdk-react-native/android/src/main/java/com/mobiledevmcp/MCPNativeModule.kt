/**
 * MCPNativeModule - Android implementation of native functionality for React Native SDK
 */

package com.mobiledevmcp

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Rect
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Base64
import android.view.InputDevice
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.TextView
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.ByteArrayOutputStream
import java.text.SimpleDateFormat
import java.util.*

class MCPNativeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val mainHandler = Handler(Looper.getMainLooper())
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }

    override fun getName(): String = "MCPNativeModule"

    // MARK: - Screenshot Capture

    @ReactMethod
    fun captureScreenshot(promise: Promise) {
        mainHandler.post {
            try {
                val activity = currentActivity
                if (activity == null) {
                    promise.reject("NO_ACTIVITY", "No activity available")
                    return@post
                }

                val rootView = activity.window.decorView.rootView
                rootView.isDrawingCacheEnabled = true
                rootView.buildDrawingCache(true)

                val bitmap = Bitmap.createBitmap(rootView.drawingCache)
                rootView.isDrawingCacheEnabled = false

                val baos = ByteArrayOutputStream()
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, baos)
                val base64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP)

                val result = Arguments.createMap().apply {
                    putString("image", base64)
                    putString("format", "png")
                    putInt("width", bitmap.width)
                    putInt("height", bitmap.height)
                    putDouble("density", activity.resources.displayMetrics.density.toDouble())
                    putString("timestamp", dateFormat.format(Date()))
                }

                bitmap.recycle()
                promise.resolve(result)

            } catch (e: Exception) {
                promise.reject("CAPTURE_FAILED", "Failed to capture screenshot: ${e.message}", e)
            }
        }
    }

    // MARK: - View Hierarchy

    @ReactMethod
    fun getViewHierarchy(options: ReadableMap, promise: Promise) {
        mainHandler.post {
            try {
                val activity = currentActivity
                if (activity == null) {
                    promise.reject("NO_ACTIVITY", "No activity available")
                    return@post
                }

                val maxDepth = if (options.hasKey("maxDepth")) options.getInt("maxDepth") else 20
                val includeHidden = if (options.hasKey("includeHidden")) options.getBoolean("includeHidden") else false

                val rootView = activity.window.decorView.rootView
                val tree = serializeView(rootView, 0, maxDepth, includeHidden)

                val result = Arguments.createMap().apply {
                    putMap("tree", tree)
                    putString("timestamp", dateFormat.format(Date()))
                }

                promise.resolve(result)

            } catch (e: Exception) {
                promise.reject("HIERARCHY_FAILED", "Failed to get view hierarchy: ${e.message}", e)
            }
        }
    }

    private fun serializeView(view: View, depth: Int, maxDepth: Int, includeHidden: Boolean): WritableMap {
        val result = Arguments.createMap()

        result.putString("type", view.javaClass.simpleName)
        result.putString("className", view.javaClass.name)

        // Frame in parent coordinates
        val frame = Arguments.createMap().apply {
            putDouble("x", view.x.toDouble())
            putDouble("y", view.y.toDouble())
            putInt("width", view.width)
            putInt("height", view.height)
        }
        result.putMap("frame", frame)

        // Global position on screen
        val location = IntArray(2)
        view.getLocationOnScreen(location)
        val screenPosition = Arguments.createMap().apply {
            putInt("x", location[0])
            putInt("y", location[1])
        }
        result.putMap("screenPosition", screenPosition)

        // Visibility
        result.putString("visibility", when (view.visibility) {
            View.VISIBLE -> "visible"
            View.INVISIBLE -> "invisible"
            View.GONE -> "gone"
            else -> "unknown"
        })
        result.putDouble("alpha", view.alpha.toDouble())
        result.putBoolean("isClickable", view.isClickable)
        result.putBoolean("isFocusable", view.isFocusable)
        result.putBoolean("isEnabled", view.isEnabled)

        // Resource ID
        if (view.id != View.NO_ID) {
            try {
                result.putString("resourceId", view.resources.getResourceEntryName(view.id))
            } catch (e: Exception) {
                result.putInt("id", view.id)
            }
        }

        // Content description (testID for React Native)
        view.contentDescription?.let {
            result.putString("testID", it.toString())
        }

        // Tag
        view.tag?.let {
            result.putString("tag", it.toString())
        }

        // Text content for common views
        when (view) {
            is TextView -> {
                result.putString("text", view.text?.toString())
                if (view is EditText) {
                    result.putString("hint", view.hint?.toString())
                }
            }
        }

        // React Native tag
        try {
            val reactTag = view.getTag(com.facebook.react.R.id.view_tag_native_id)
            if (reactTag != null) {
                result.putString("nativeID", reactTag.toString())
            }
        } catch (e: Exception) {
            // React tag not available
        }

        // Children
        if (view is ViewGroup && depth < maxDepth) {
            val children = Arguments.createArray()
            for (i in 0 until view.childCount) {
                val child = view.getChildAt(i)
                if (includeHidden || child.visibility == View.VISIBLE) {
                    children.pushMap(serializeView(child, depth + 1, maxDepth, includeHidden))
                }
            }
            result.putArray("children", children)
        }

        return result
    }

    // MARK: - Touch Simulation

    @ReactMethod
    fun simulateTap(x: Double, y: Double, promise: Promise) {
        mainHandler.post {
            try {
                val activity = currentActivity
                if (activity == null) {
                    promise.reject("NO_ACTIVITY", "No activity available")
                    return@post
                }

                val downTime = SystemClock.uptimeMillis()
                val eventTime = SystemClock.uptimeMillis()

                val downEvent = MotionEvent.obtain(
                    downTime, eventTime, MotionEvent.ACTION_DOWN,
                    x.toFloat(), y.toFloat(), 0
                ).apply {
                    source = InputDevice.SOURCE_TOUCHSCREEN
                }

                val upEvent = MotionEvent.obtain(
                    downTime, eventTime + 100, MotionEvent.ACTION_UP,
                    x.toFloat(), y.toFloat(), 0
                ).apply {
                    source = InputDevice.SOURCE_TOUCHSCREEN
                }

                activity.window.decorView.dispatchTouchEvent(downEvent)
                mainHandler.postDelayed({
                    activity.window.decorView.dispatchTouchEvent(upEvent)
                    downEvent.recycle()
                    upEvent.recycle()
                }, 100)

                val result = Arguments.createMap().apply {
                    putBoolean("success", true)
                    putMap("point", Arguments.createMap().apply {
                        putDouble("x", x)
                        putDouble("y", y)
                    })
                    putString("timestamp", dateFormat.format(Date()))
                }

                promise.resolve(result)

            } catch (e: Exception) {
                promise.reject("TAP_FAILED", "Failed to simulate tap: ${e.message}", e)
            }
        }
    }

    @ReactMethod
    fun simulateLongPress(x: Double, y: Double, duration: Double, promise: Promise) {
        mainHandler.post {
            try {
                val activity = currentActivity
                if (activity == null) {
                    promise.reject("NO_ACTIVITY", "No activity available")
                    return@post
                }

                val downTime = SystemClock.uptimeMillis()

                val downEvent = MotionEvent.obtain(
                    downTime, downTime, MotionEvent.ACTION_DOWN,
                    x.toFloat(), y.toFloat(), 0
                ).apply {
                    source = InputDevice.SOURCE_TOUCHSCREEN
                }

                activity.window.decorView.dispatchTouchEvent(downEvent)

                mainHandler.postDelayed({
                    val upEvent = MotionEvent.obtain(
                        downTime, SystemClock.uptimeMillis(), MotionEvent.ACTION_UP,
                        x.toFloat(), y.toFloat(), 0
                    ).apply {
                        source = InputDevice.SOURCE_TOUCHSCREEN
                    }

                    activity.window.decorView.dispatchTouchEvent(upEvent)
                    downEvent.recycle()
                    upEvent.recycle()

                    val result = Arguments.createMap().apply {
                        putBoolean("success", true)
                        putMap("point", Arguments.createMap().apply {
                            putDouble("x", x)
                            putDouble("y", y)
                        })
                        putDouble("duration", duration)
                        putString("timestamp", dateFormat.format(Date()))
                    }

                    promise.resolve(result)

                }, duration.toLong())

            } catch (e: Exception) {
                promise.reject("LONG_PRESS_FAILED", "Failed to simulate long press: ${e.message}", e)
            }
        }
    }

    @ReactMethod
    fun simulateSwipe(startX: Double, startY: Double, endX: Double, endY: Double, duration: Double, promise: Promise) {
        mainHandler.post {
            try {
                val activity = currentActivity
                if (activity == null) {
                    promise.reject("NO_ACTIVITY", "No activity available")
                    return@post
                }

                val downTime = SystemClock.uptimeMillis()
                val steps = 10
                val stepDuration = (duration / steps).toLong()

                val downEvent = MotionEvent.obtain(
                    downTime, downTime, MotionEvent.ACTION_DOWN,
                    startX.toFloat(), startY.toFloat(), 0
                ).apply {
                    source = InputDevice.SOURCE_TOUCHSCREEN
                }

                activity.window.decorView.dispatchTouchEvent(downEvent)

                for (i in 1..steps) {
                    val progress = i.toFloat() / steps
                    val currentX = startX + (endX - startX) * progress
                    val currentY = startY + (endY - startY) * progress

                    mainHandler.postDelayed({
                        val moveEvent = MotionEvent.obtain(
                            downTime, SystemClock.uptimeMillis(), MotionEvent.ACTION_MOVE,
                            currentX.toFloat(), currentY.toFloat(), 0
                        ).apply {
                            source = InputDevice.SOURCE_TOUCHSCREEN
                        }
                        activity.window.decorView.dispatchTouchEvent(moveEvent)
                        moveEvent.recycle()
                    }, stepDuration * i)
                }

                mainHandler.postDelayed({
                    val upEvent = MotionEvent.obtain(
                        downTime, SystemClock.uptimeMillis(), MotionEvent.ACTION_UP,
                        endX.toFloat(), endY.toFloat(), 0
                    ).apply {
                        source = InputDevice.SOURCE_TOUCHSCREEN
                    }
                    activity.window.decorView.dispatchTouchEvent(upEvent)
                    downEvent.recycle()
                    upEvent.recycle()

                    val result = Arguments.createMap().apply {
                        putBoolean("success", true)
                        putMap("from", Arguments.createMap().apply {
                            putDouble("x", startX)
                            putDouble("y", startY)
                        })
                        putMap("to", Arguments.createMap().apply {
                            putDouble("x", endX)
                            putDouble("y", endY)
                        })
                        putDouble("duration", duration)
                        putString("timestamp", dateFormat.format(Date()))
                    }

                    promise.resolve(result)

                }, duration.toLong() + stepDuration)

            } catch (e: Exception) {
                promise.reject("SWIPE_FAILED", "Failed to simulate swipe: ${e.message}", e)
            }
        }
    }

    @ReactMethod
    fun typeText(text: String, promise: Promise) {
        mainHandler.post {
            try {
                val activity = currentActivity
                if (activity == null) {
                    promise.reject("NO_ACTIVITY", "No activity available")
                    return@post
                }

                val focusedView = activity.currentFocus
                if (focusedView is EditText) {
                    focusedView.append(text)

                    val result = Arguments.createMap().apply {
                        putBoolean("success", true)
                        putString("text", text)
                        putString("targetType", "EditText")
                        putString("timestamp", dateFormat.format(Date()))
                    }

                    promise.resolve(result)
                } else {
                    promise.reject("NO_FOCUS", "No EditText is currently focused")
                }

            } catch (e: Exception) {
                promise.reject("TYPE_FAILED", "Failed to type text: ${e.message}", e)
            }
        }
    }

    @ReactMethod
    fun findElementByTestId(testId: String, promise: Promise) {
        mainHandler.post {
            try {
                val activity = currentActivity
                if (activity == null) {
                    promise.reject("NO_ACTIVITY", "No activity available")
                    return@post
                }

                val rootView = activity.window.decorView.rootView
                val view = findViewWithTestId(rootView, testId)

                if (view != null) {
                    val location = IntArray(2)
                    view.getLocationOnScreen(location)

                    val result = Arguments.createMap().apply {
                        putBoolean("found", true)
                        putString("type", view.javaClass.simpleName)
                        putMap("frame", Arguments.createMap().apply {
                            putInt("x", location[0])
                            putInt("y", location[1])
                            putInt("width", view.width)
                            putInt("height", view.height)
                        })
                        putMap("center", Arguments.createMap().apply {
                            putDouble("x", location[0] + view.width / 2.0)
                            putDouble("y", location[1] + view.height / 2.0)
                        })
                        putBoolean("isVisible", view.visibility == View.VISIBLE && view.alpha > 0)
                        putString("timestamp", dateFormat.format(Date()))
                    }

                    promise.resolve(result)
                } else {
                    val result = Arguments.createMap().apply {
                        putBoolean("found", false)
                        putString("testId", testId)
                        putString("timestamp", dateFormat.format(Date()))
                    }

                    promise.resolve(result)
                }

            } catch (e: Exception) {
                promise.reject("FIND_FAILED", "Failed to find element: ${e.message}", e)
            }
        }
    }

    private fun findViewWithTestId(view: View, testId: String): View? {
        if (view.contentDescription?.toString() == testId) {
            return view
        }

        // Check React Native nativeID
        try {
            val nativeId = view.getTag(com.facebook.react.R.id.view_tag_native_id)
            if (nativeId?.toString() == testId) {
                return view
            }
        } catch (e: Exception) {
            // Tag not available
        }

        if (view is ViewGroup) {
            for (i in 0 until view.childCount) {
                val found = findViewWithTestId(view.getChildAt(i), testId)
                if (found != null) {
                    return found
                }
            }
        }

        return null
    }

    // MARK: - Event Emitter

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
}
