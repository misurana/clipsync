# ClipSync ProGuard Rules

# Keep Firebase models
-keep class com.clipsync.sync.FirebaseHelper$ClipboardEntry { *; }

# Keep Gson serialization
-keepattributes Signature
-keepattributes *Annotation*
-dontwarn sun.misc.**
-keep class com.google.gson.** { *; }

# Keep ZXing
-keep class com.google.zxing.** { *; }
-keep class com.journeyapps.** { *; }
