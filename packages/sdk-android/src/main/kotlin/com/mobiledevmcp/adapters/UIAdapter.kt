/**
 * UIAdapter - Handles UI inspection for Android
 */

package com.mobiledevmcp.adapters

import android.app.Activity
import android.content.Context
import android.graphics.Bitmap
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.view.View
import android.view.ViewGroup
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.lang.ref.WeakReference
import java.text.SimpleDateFormat
import java.util.*

class UIAdapter {
    
    private var contextRef: WeakReference<Context>? = null
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    
    fun setContext(context: Context) {
        contextRef = WeakReference(context)
    }
    
    suspend fun captureScreenshot(): Map<String, Any?> = withContext(Dispatchers.Main) {
        val context = contextRef?.get()
            ?: return@withContext mapOf("error" to "Context not available")
        
        val activity = context as? Activity
            ?: return@withContext mapOf("error" to "Activity context required")
        
        try {
            val rootView = activity.window.decorView.rootView
            rootView.isDrawingCacheEnabled = true
            
            val bitmap = Bitmap.createBitmap(rootView.drawingCache)
            rootView.isDrawingCacheEnabled = false
            
            val baos = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, baos)
            val base64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP)
            
            mapOf(
                "image" to base64,
                "format" to "png",
                "dimensions" to mapOf(
                    "width" to rootView.width,
                    "height" to rootView.height
                ),
                "timestamp" to dateFormat.format(Date())
            )
        } catch (e: Exception) {
            mapOf("error" to "Failed to capture screenshot: ${e.message}")
        }
    }
    
    fun getViewHierarchy(): Map<String, Any?> {
        val context = contextRef?.get()
            ?: return mapOf("error" to "Context not available")
        
        val activity = context as? Activity
            ?: return mapOf("error" to "Activity context required")
        
        val rootView = activity.window.decorView.rootView
        
        return mapOf(
            "tree" to serializeView(rootView),
            "timestamp" to dateFormat.format(Date())
        )
    }
    
    private fun serializeView(view: View, depth: Int = 0): Map<String, Any?> {
        val result = mutableMapOf<String, Any?>(
            "type" to view.javaClass.simpleName,
            "id" to (if (view.id != View.NO_ID) view.resources.getResourceEntryName(view.id) else null),
            "bounds" to mapOf(
                "x" to view.x,
                "y" to view.y,
                "width" to view.width,
                "height" to view.height
            ),
            "visibility" to when (view.visibility) {
                View.VISIBLE -> "visible"
                View.INVISIBLE -> "invisible"
                View.GONE -> "gone"
                else -> "unknown"
            },
            "alpha" to view.alpha
        )
        
        // Add content description if available
        view.contentDescription?.let {
            result["contentDescription"] = it.toString()
        }
        
        // Add tag if available
        view.tag?.let {
            result["tag"] = it.toString()
        }
        
        // Recursively add children (with depth limit)
        if (view is ViewGroup && depth < 10) {
            val children = mutableListOf<Map<String, Any?>>()
            for (i in 0 until view.childCount) {
                children.add(serializeView(view.getChildAt(i), depth + 1))
            }
            result["children"] = children
        }
        
        return result
    }
}
