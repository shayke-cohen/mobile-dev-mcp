pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
    // Include local MCP auto-trace plugin (disabled in app build.gradle.kts until Java version conflicts resolved)
    // includeBuild("../../packages/mcp-android-gradle-plugin")
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "MCPDemoApp"
include(":app")
