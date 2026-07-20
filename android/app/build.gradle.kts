plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.compose.compiler)
}

android {
    namespace = "com.conxius.wallet"
    compileSdk = 35

    // The directory is generated only by the explicit native build task. An empty directory keeps
    // normal Gradle configuration/builds independent of Rust, cargo-ndk, and the Android NDK.
    sourceSets["main"].jniLibs.directories.add(
        layout.buildDirectory.get().asFile.resolve("generated/silent-payments/jniLibs").absolutePath
    )

    val keystorePath = System.getenv("KEYSTORE_PATH")
    val keystorePassword = System.getenv("KEYSTORE_PASSWORD")
    val keyAlias = System.getenv("KEY_ALIAS")
    val keyPassword = System.getenv("KEY_PASSWORD")
    val versionCodeEnv = System.getenv("VERSION_CODE")

    defaultConfig {
        applicationId = "com.conxius.wallet"
        minSdk = 26
        targetSdk = 35
        versionCode = versionCodeEnv?.toIntOrNull() ?: 1
        versionName = "1.9.5"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    signingConfigs {
        create("release") {
            storeFile = keystorePath?.let { file(it) }
            storePassword = keystorePassword
            this.keyAlias = keyAlias
            this.keyPassword = keyPassword
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }
    kotlin {
        compilerOptions {
            jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_21)
        }
    }
    buildFeatures {
        compose = true
        viewBinding = true
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

tasks.register<Exec>("buildSilentPaymentsNative") {
    group = "native"
    description = "Build arm64-v8a and x86_64 silent-payment JNI libraries with cargo-ndk."
    val outputDirectory = layout.buildDirectory.dir("generated/silent-payments/jniLibs")
    inputs.file(rootProject.file("../scripts/build-silent-payments-android.sh"))
    outputs.dir(outputDirectory)
    doFirst {
        commandLine(
            "bash",
            rootProject.file("../scripts/build-silent-payments-android.sh").absolutePath,
            outputDirectory.get().asFile.absolutePath,
        )
    }
}

tasks.register<Delete>("cleanSilentPaymentsNative") {
    delete(layout.buildDirectory.dir("generated/silent-payments/jniLibs"))
}

dependencies {
    implementation(project(":core-crypto"))
    implementation(project(":core-bitcoin"))
    implementation(project(":core-database"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.biometric)
    implementation(libs.androidx.security.crypto)
    implementation(libs.androidx.navigation.compose)
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.11.0")

    implementation(libs.bdk.android)
    implementation(libs.androidx.room.runtime)

    implementation("com.google.android.material:material:1.14.0")

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}
