/**
 * MCP Auto-Trace Gradle Plugin
 *
 * Automatically instruments Android/Kotlin bytecode with trace calls
 * for debugging with Mobile Dev MCP.
 */

plugins {
    `kotlin-dsl`
    `java-gradle-plugin`
    `maven-publish`
}

group = "com.mobiledevmcp"
version = "1.0.0"

repositories {
    mavenCentral()
    google()
}

dependencies {
    // Android Gradle Plugin API
    compileOnly("com.android.tools.build:gradle:8.1.0")
    compileOnly("com.android.tools.build:gradle-api:8.1.0")
    
    // ASM for bytecode manipulation
    implementation("org.ow2.asm:asm:9.6")
    implementation("org.ow2.asm:asm-commons:9.6")
    implementation("org.ow2.asm:asm-util:9.6")
    
    // Kotlin
    implementation("org.jetbrains.kotlin:kotlin-stdlib:1.9.0")
}

gradlePlugin {
    plugins {
        create("mcpAutoTrace") {
            id = "com.mobiledevmcp.autotrace"
            implementationClass = "com.mobiledevmcp.gradle.MCPAutoTracePlugin"
            displayName = "MCP Auto-Trace Plugin"
            description = "Automatically instruments code with trace calls for Mobile Dev MCP debugging"
        }
    }
}

// Handle duplicate resources
tasks.withType<ProcessResources>().configureEach {
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            groupId = "com.mobiledevmcp"
            artifactId = "mcp-autotrace-gradle-plugin"
            version = "1.0.0"
            
            from(components["java"])
            
            pom {
                name.set("MCP Auto-Trace Gradle Plugin")
                description.set("Zero-config auto-instrumentation for Mobile Dev MCP")
                url.set("https://github.com/anthropics/mobile-dev-mcp")
                
                licenses {
                    license {
                        name.set("MIT")
                        url.set("https://opensource.org/licenses/MIT")
                    }
                }
            }
        }
    }
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    jvmToolchain(17)
}
