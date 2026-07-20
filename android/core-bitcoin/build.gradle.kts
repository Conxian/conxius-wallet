plugins {
    alias(libs.plugins.android.library)
}

android {
    namespace = "com.conxius.wallet.bitcoin"
    compileSdk = 35

    defaultConfig {
        minSdk = 26
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
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
    implementation(libs.kotlinx.coroutines.android)
    testImplementation(libs.bdk.jvm)
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.espresso.core)
}
