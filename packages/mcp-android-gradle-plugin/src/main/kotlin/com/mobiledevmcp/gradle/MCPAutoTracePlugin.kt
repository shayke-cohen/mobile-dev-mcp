/**
 * MCP Auto-Trace Gradle Plugin
 *
 * Automatically instruments Android/Kotlin code with trace calls for debugging.
 *
 * Usage in app/build.gradle.kts:
 *   plugins {
 *       id("com.mobiledevmcp.autotrace") version "1.0.0"
 *   }
 *
 *   mcpAutoTrace {
 *       enabled = true
 *       include = listOf("com.myapp.**")
 *       exclude = listOf("com.myapp.generated.**")
 *   }
 */

package com.mobiledevmcp.gradle

import com.android.build.api.instrumentation.AsmClassVisitorFactory
import com.android.build.api.instrumentation.ClassContext
import com.android.build.api.instrumentation.ClassData
import com.android.build.api.instrumentation.FramesComputationMode
import com.android.build.api.instrumentation.InstrumentationParameters
import com.android.build.api.instrumentation.InstrumentationScope
import com.android.build.api.variant.AndroidComponentsExtension
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.provider.ListProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.Optional
import org.objectweb.asm.ClassVisitor
import org.objectweb.asm.MethodVisitor
import org.objectweb.asm.Opcodes
import org.objectweb.asm.Type
import org.objectweb.asm.commons.AdviceAdapter

/**
 * Extension for configuring auto-trace behavior
 */
interface MCPAutoTraceExtension {
    /** Enable/disable instrumentation (default: true for debug builds) */
    val enabled: Property<Boolean>
    
    /** Package patterns to include (e.g., "com.myapp.**") */
    val include: ListProperty<String>
    
    /** Package patterns to exclude (e.g., "com.myapp.generated.**") */
    val exclude: ListProperty<String>
    
    /** Minimum method size to trace (in bytecode instructions, default: 5) */
    val minInstructions: Property<Int>
    
    /** Trace private methods (default: false) */
    val tracePrivate: Property<Boolean>
}

/**
 * Main plugin class
 */
class MCPAutoTracePlugin : Plugin<Project> {
    
    override fun apply(project: Project) {
        // Create extension
        val extension = project.extensions.create(
            "mcpAutoTrace",
            MCPAutoTraceExtension::class.java
        )
        
        // Set defaults
        extension.enabled.convention(true)
        extension.include.convention(emptyList())
        extension.exclude.convention(listOf(
            "**.R",
            "**.R$*",
            "**.BuildConfig",
            "**.*_Factory",
            "**.*_MembersInjector",
            "**.Dagger*",
            "**.*_Impl",
            "**.databinding.*"
        ))
        extension.minInstructions.convention(5)
        extension.tracePrivate.convention(false)
        
        // Register with Android build
        project.plugins.withId("com.android.application") {
            registerTransform(project, extension)
        }
        project.plugins.withId("com.android.library") {
            registerTransform(project, extension)
        }
    }
    
    private fun registerTransform(project: Project, extension: MCPAutoTraceExtension) {
        val androidComponents = project.extensions.getByType(AndroidComponentsExtension::class.java)
        
        androidComponents.onVariants { variant ->
            // Only instrument debug builds by default
            val isDebug = variant.name.contains("debug", ignoreCase = true)
            
            if (!isDebug && extension.enabled.getOrElse(true)) {
                // Skip release builds unless explicitly enabled
                return@onVariants
            }
            
            variant.instrumentation.transformClassesWith(
                MCPAutoTraceTransform::class.java,
                InstrumentationScope.PROJECT
            ) { params ->
                params.include.set(extension.include)
                params.exclude.set(extension.exclude)
                params.minInstructions.set(extension.minInstructions)
                params.tracePrivate.set(extension.tracePrivate)
            }
            
            variant.instrumentation.setAsmFramesComputationMode(
                FramesComputationMode.COMPUTE_FRAMES_FOR_INSTRUMENTED_METHODS
            )
        }
    }
}

/**
 * Parameters for the transform
 */
interface MCPAutoTraceParams : InstrumentationParameters {
    @get:Input
    val include: ListProperty<String>
    
    @get:Input
    val exclude: ListProperty<String>
    
    @get:Input
    val minInstructions: Property<Int>
    
    @get:Input
    val tracePrivate: Property<Boolean>
}

/**
 * ASM ClassVisitor factory for instrumentation
 */
abstract class MCPAutoTraceTransform : AsmClassVisitorFactory<MCPAutoTraceParams> {
    
    override fun createClassVisitor(
        classContext: ClassContext,
        nextClassVisitor: ClassVisitor
    ): ClassVisitor {
        return MCPAutoTraceClassVisitor(
            api = Opcodes.ASM9,
            classVisitor = nextClassVisitor,
            className = classContext.currentClassData.className,
            minInstructions = parameters.get().minInstructions.get(),
            tracePrivate = parameters.get().tracePrivate.get()
        )
    }
    
    override fun isInstrumentable(classData: ClassData): Boolean {
        val className = classData.className
        
        // Check excludes
        val excludes = parameters.get().exclude.get()
        for (pattern in excludes) {
            if (matchesPattern(className, pattern)) {
                return false
            }
        }
        
        // Check includes (if specified)
        val includes = parameters.get().include.get()
        if (includes.isNotEmpty()) {
            return includes.any { matchesPattern(className, it) }
        }
        
        // Default: instrument all non-excluded classes
        return true
    }
    
    private fun matchesPattern(className: String, pattern: String): Boolean {
        val regex = pattern
            .replace(".", "\\.")
            .replace("**", ".*")
            .replace("*", "[^.]*")
        return className.matches(Regex(regex))
    }
}

/**
 * Class visitor that adds tracing to methods
 */
class MCPAutoTraceClassVisitor(
    api: Int,
    classVisitor: ClassVisitor,
    private val className: String,
    private val minInstructions: Int,
    private val tracePrivate: Boolean
) : ClassVisitor(api, classVisitor) {
    
    private val simpleClassName = className.substringAfterLast('.')
    
    override fun visitMethod(
        access: Int,
        name: String,
        descriptor: String,
        signature: String?,
        exceptions: Array<out String>?
    ): MethodVisitor {
        val mv = super.visitMethod(access, name, descriptor, signature, exceptions)
        
        // Skip constructors, static initializers, and synthetic methods
        if (name == "<init>" || name == "<clinit>" || 
            (access and Opcodes.ACC_SYNTHETIC) != 0) {
            return mv
        }
        
        // Skip private methods unless configured
        if (!tracePrivate && (access and Opcodes.ACC_PRIVATE) != 0) {
            return mv
        }
        
        // Skip abstract/native methods
        if ((access and Opcodes.ACC_ABSTRACT) != 0 ||
            (access and Opcodes.ACC_NATIVE) != 0) {
            return mv
        }
        
        return MCPAutoTraceMethodVisitor(
            api = api,
            methodVisitor = mv,
            access = access,
            methodName = name,
            descriptor = descriptor,
            fullMethodName = "$simpleClassName.$name"
        )
    }
}

/**
 * Method visitor that injects trace calls
 */
class MCPAutoTraceMethodVisitor(
    api: Int,
    methodVisitor: MethodVisitor,
    access: Int,
    private val methodName: String,
    descriptor: String,
    private val fullMethodName: String
) : AdviceAdapter(api, methodVisitor, access, methodName, descriptor) {
    
    companion object {
        // MCPBridge is a Kotlin object, so we access via INSTANCE field
        private const val MCP_BRIDGE = "com/mobiledevmcp/MCPBridge"
    }
    
    override fun onMethodEnter() {
        // MCPBridge.INSTANCE.trace("ClassName.methodName")
        // For Kotlin objects: get the INSTANCE field, then call the method
        mv.visitFieldInsn(
            Opcodes.GETSTATIC,
            MCP_BRIDGE,
            "INSTANCE",
            "L$MCP_BRIDGE;"
        )
        mv.visitLdcInsn(fullMethodName)
        mv.visitMethodInsn(
            Opcodes.INVOKEVIRTUAL,
            MCP_BRIDGE,
            "trace",
            "(Ljava/lang/String;)Ljava/lang/String;",
            false
        )
        // Discard the returned trace ID
        mv.visitInsn(Opcodes.POP)
    }
    
    override fun onMethodExit(opcode: Int) {
        // Don't add trace on ATHROW - let the exception propagate
        if (opcode == Opcodes.ATHROW) {
            return
        }
        
        // MCPBridge.INSTANCE.traceReturn("ClassName.methodName")
        mv.visitFieldInsn(
            Opcodes.GETSTATIC,
            MCP_BRIDGE,
            "INSTANCE",
            "L$MCP_BRIDGE;"
        )
        mv.visitLdcInsn(fullMethodName)
        mv.visitMethodInsn(
            Opcodes.INVOKEVIRTUAL,
            MCP_BRIDGE,
            "traceReturn",
            "(Ljava/lang/String;)V",
            false
        )
    }
}
