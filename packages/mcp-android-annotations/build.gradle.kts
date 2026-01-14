plugins {
    kotlin("jvm") version "1.9.22"
    `maven-publish`
}

group = "com.mobiledevmcp"
version = "0.1.0"

repositories {
    mavenCentral()
}

kotlin {
    jvmToolchain(17)
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            groupId = "com.mobiledevmcp"
            artifactId = "annotations"
            version = "0.1.0"
            from(components["java"])
        }
    }
}
