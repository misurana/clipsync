plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

android {
    namespace   = "com.clipsync"
    compileSdk  = 34

    defaultConfig {
        applicationId   = "com.clipsync"
        minSdk          = 24
        targetSdk       = 34
        versionCode     = 1
        versionName     = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }

    kotlinOptions {
        jvmTarget = "1.8"
    }
}

dependencies {
    // Firebase Realtime Database
    implementation(platform("com.google.firebase:firebase-bom:32.7.4"))
    implementation("com.google.firebase:firebase-database-ktx")

    // JSON serialization
    implementation("com.google.code.gson:gson:2.10.1")

    // QR code generation
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")

    // Kotlin Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.7.3")

    // AppCompat for themes/styles
    implementation("androidx.appcompat:appcompat:1.6.1")
}
