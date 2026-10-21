package dev.renatomf.nextbank

import android.os.Bundle
import android.view.WindowManager
import io.flutter.embedding.android.FlutterFragmentActivity

// A FragmentActivity: Android's biometric prompt (BiometricPrompt), used by
// local_auth and by flutter_secure_storage for the kept PIN, needs one
// (v1.1.0 plan, task 2).
class MainActivity : FlutterFragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // MOB-14 (v1.1.0 plan, task 7): in a release build Android blocks
        // screenshots, blacks out recordings and hides the recents thumbnail.
        // Set before super, so the first frame is already secure. By build
        // type, not BuildConfig.DEBUG: profile is not debug either, and stays
        // open for the demo videos (D8).
        if (BuildConfig.BUILD_TYPE == "release") {
            window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
        super.onCreate(savedInstanceState)
    }
}
