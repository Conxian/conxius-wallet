plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.compose.compiler)
}

android {
    namespace = "com.conxius.wallet"
    compileSdk = 36

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
    val configuredVersionCode = versionCodeEnv?.toIntOrNull()?.takeIf { it > 0 }

    defaultConfig {
        applicationId = "com.conxius.wallet"
        minSdk = 26
        targetSdk = 35
        // Debug/developer builds retain a harmless local default. Release tasks
        // are guarded below and fail closed when VERSION_CODE is absent/invalid.
        versionCode = configuredVersionCode ?: 1
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
            isDebuggable = false
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    gradle.taskGraph.whenReady {
        val releaseTaskRequested = allTasks.any { task ->
            task.path.substringAfterLast(':').contains("release", ignoreCase = true)
        }
        if (releaseTaskRequested && configuredVersionCode == null) {
            throw GradleException(
                "VERSION_CODE must be a positive integer for Android release builds; " +
                    "derive it with scripts/ci/derive_android_version_code.mjs and export it before Gradle.",
            )
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
        buildConfig = true
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

val silentPaymentsNativeOutput = layout.buildDirectory.dir("generated/silent-payments/jniLibs")
val silentPaymentsNativeArm64Library = silentPaymentsNativeOutput.map {
    it.file("arm64-v8a/libconxius_silent_payments_jni.so").asFile
}
val silentPaymentsNativeX8664Library = silentPaymentsNativeOutput.map {
    it.file("x86_64/libconxius_silent_payments_jni.so").asFile
}
val silentPaymentsNativeRepositoryDir = rootProject.file("..")
val silentPaymentsNativeCrateDir = silentPaymentsNativeRepositoryDir.resolve("native/silent-payments-jni")
val silentPaymentsNativeManifest = silentPaymentsNativeCrateDir.resolve("Cargo.toml")
val silentPaymentsNativeScript = rootProject.file("../scripts/build-silent-payments-android.sh")
val silentPaymentsNativeInputs = fileTree(rootProject.file("../native")) {
    include("**/*.rs")
    include("**/Cargo.toml")
    include("**/Cargo.lock")
    exclude("**/target/**")
}

val buildSilentPaymentsNative = tasks.register<Exec>("buildSilentPaymentsNative") {
    group = "native"
    description = "Build arm64-v8a and x86_64 silent-payment JNI libraries with cargo-ndk."
    inputs.files(silentPaymentsNativeInputs)
    inputs.file(silentPaymentsNativeManifest)
    inputs.file(silentPaymentsNativeScript)
    inputs.files(
        rootProject.file("../rust-toolchain"),
        rootProject.file("../rust-toolchain.toml"),
        rootProject.file("../.cargo/config"),
        rootProject.file("../.cargo/config.toml"),
    ).optional()
    workingDir(silentPaymentsNativeRepositoryDir)
    inputs.property("androidNdkHome", providers.environmentVariable("ANDROID_NDK_HOME").orNull ?: "")
    inputs.property("androidNdkRoot", providers.environmentVariable("ANDROID_NDK_ROOT").orNull ?: "")
    inputs.property("androidHome", providers.environmentVariable("ANDROID_HOME").orNull ?: "")
    inputs.property("androidSdkRoot", providers.environmentVariable("ANDROID_SDK_ROOT").orNull ?: "")
    outputs.file(silentPaymentsNativeArm64Library)
    outputs.file(silentPaymentsNativeX8664Library)
    doFirst {
        delete(silentPaymentsNativeOutput)
        commandLine(
            "bash",
            silentPaymentsNativeScript.absolutePath,
            silentPaymentsNativeOutput.get().asFile.absolutePath,
        )
    }
}

val verifySilentPaymentsNative = tasks.register("verifySilentPaymentsNative") {
    group = "native"
    description = "Verify every packaged ABI contains a non-empty silent-payment JNI library."
    dependsOn(buildSilentPaymentsNative)
    inputs.files(buildSilentPaymentsNative)
    doLast {
        val requiredLibraries = listOf(
            silentPaymentsNativeOutput.get().asFile.resolve("arm64-v8a/libconxius_silent_payments_jni.so"),
            silentPaymentsNativeOutput.get().asFile.resolve("x86_64/libconxius_silent_payments_jni.so"),
        )
        requiredLibraries.forEach { library ->
            if (!library.isFile || library.length() == 0L) {
                throw GradleException(
                    "Silent-payment JNI packaging verification failed: missing or empty ${library.absolutePath}. " +
                        "Install cargo-ndk, the Android NDK, and both Android Rust targets, then rerun the package task.",
                )
            }
        }
    }
}

tasks.configureEach {
    if (name in setOf(
            "preDebugBuild",
            "preReleaseBuild",
            "packageDebug",
            "packageRelease",
            "bundleDebug",
            "bundleRelease",
        )
    ) {
        dependsOn(verifySilentPaymentsNative)
    }
}

tasks.register<Delete>("cleanSilentPaymentsNative") {
    delete(silentPaymentsNativeOutput)
}

dependencies {
    implementation(project(":capacitor-android"))
    implementation(project(":capacitor-browser"))
    implementation(project(":capacitor-local-notifications"))
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
    implementation("androidx.compose.material:material-icons-extended")
    implementation(libs.androidx.biometric)
    implementation(libs.androidx.security.crypto)
    implementation(libs.androidx.navigation.compose)
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.10.0")

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
