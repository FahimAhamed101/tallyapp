plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.workbuddy.tallyclone"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.workbuddy.tallyclone"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"

        // Where the app talks to, baked in at build time so no source edit is
        // needed to retarget it:
        //
        //   ./gradlew :app:assembleDebug -PapiBase=http://127.0.0.1:4000/api --rerun-tasks
        //   adb reverse tcp:4000 tcp:4000        # then the phone reaches your host
        //
        // `--rerun-tasks` is NOT optional when retargeting. `API_BASE` is a
        // compile-time constant that Kotlin inlines into `ApiClient`, so it
        // lands in two dex shards (BuildConfig and ApiClient). Gradle's
        // incremental dexing will happily rebuild one shard and leave the other
        // holding the *previous* URL — producing an APK that contains both, with
        // the runtime winner decided by dex order. Observed: flipping the
        // property and rebuilding incrementally left the old URL in
        // classes3.dex and the new one in classes4.dex. A forced rebuild always
        // yields exactly one value; verify with:
        //
        //   unzip -o -q app-debug.apk -d /tmp/apk && grep -rl "<url>" /tmp/apk
        //
        // The default is the deployed API, so an unqualified build behaves
        // exactly as it did before this property existed.
        val apiBase = (project.findProperty("apiBase") as String?)
            ?: "http://127.0.0.1:4000/api"
        buildConfigField("String", "API_BASE", "\"$apiBase\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        // Needed for BuildConfig.API_BASE below.
        buildConfig = true
    }

    testOptions {
        unitTests {
            // android.jar's org.json is a throwing stub; the real implementation
            // is supplied by the testImplementation dependency below.
            isReturnDefaultValues = true
            // Robolectric renders real Compose UI off-device, which needs the
            // merged resources and manifest rather than the stub android.jar.
            isIncludeAndroidResources = true
        }
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

/**
 * Forward `-Dapi.base=…` to the test JVM.
 *
 * Gradle's own `-D` flags set properties on the *Gradle* JVM, so without this
 * `./gradlew testDebugUnitTest -Dapi.base=http://127.0.0.1:4000/api` silently
 * leaves `ApiContractTest` pointed at the deployed API — the flag looks like it
 * worked and the suite tests the wrong server. `API_BASE` in the environment
 * also works, because Gradle test tasks inherit the parent environment.
 */
tasks.withType<Test>().configureEach {
    System.getProperty("api.base")?.let { systemProperty("api.base", it) }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-compose:1.9.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.2")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    implementation(platform("androidx.compose:compose-bom:2024.06.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")

    // JVM unit tests: a real org.json so the API models can be parsed off-device.
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")

    // Robolectric renders the Compose UI on the JVM, so the business switcher
    // sheet can be executed (and asserted on) without a device attached.
    testImplementation("org.robolectric:robolectric:4.13")
    testImplementation("androidx.test:core-ktx:1.6.1")
    testImplementation("androidx.test.ext:junit:1.2.1")
    testImplementation(platform("androidx.compose:compose-bom:2024.06.00"))
    testImplementation("androidx.compose.ui:ui-test-junit4")
    // Supplies the host Activity that `createComposeRule` launches.
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
