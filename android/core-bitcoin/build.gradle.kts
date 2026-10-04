plugins {
    alias(libs.plugins.android.library)
}

android {
    namespace = "com.conxius.wallet.bitcoin"
    compileSdk = 37

    buildFeatures {
        buildConfig = true
    }

    defaultConfig {
        minSdk = 26
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    testOptions {
        unitTests {
            // `android.util.Log` is an Android framework class that throws "not mocked"
            // in JVM unit tests. Managers call it before their fail-closed guards, so
            // make framework calls return defaults (a no-op for Log) in tests.
            isReturnDefaultValues = true
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
}

dependencies {
    implementation(project(":core-crypto"))
    implementation(libs.androidx.core.ktx)
    implementation(libs.bdk.android)
    implementation(libs.bouncycastle)
    implementation(libs.kotlinx.coroutines.android)
    testImplementation(libs.bdk.jvm)
    testImplementation(libs.bouncycastle)
    testImplementation(libs.junit)
    // Real org.json implementation for JVM unit tests; Android's `org.json` is a
    // mockable framework stub that throws "not mocked" outside a device.
    testImplementation("org.json:json:20240303")
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.espresso.core)
}
