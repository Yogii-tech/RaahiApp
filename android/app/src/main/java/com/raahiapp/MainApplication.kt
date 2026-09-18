package com.raahiapp

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    createNotificationChannel()
  }

  /**
   * Creates the high-importance notification channel used by all GoRaahi push notifications.
   * Required on Android 8.0 (API 26+) — without this, the FCM channelId in the payload has
   * no matching channel and notifications may be silenced.
   *
   * Settings:
   *   - IMPORTANCE_HIGH   → shows a heads-up banner even when the screen is on
   *   - enableVibration   → vibrates on delivery (pattern: 250ms on, 250ms off, 250ms on)
   *   - setSound          → plays the system default notification sound
   */
  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channelId   = "raahi_high_importance"
      val channelName = "GoRaahi Notifications"
      val description = "Booking updates, ride alerts and important GoRaahi notifications"
      val importance  = NotificationManager.IMPORTANCE_HIGH

      val channel = NotificationChannel(channelId, channelName, importance).apply {
        this.description = description
        enableVibration(true)
        vibrationPattern = longArrayOf(0L, 250L, 250L, 250L)

        // Use the system default notification sound
        val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val audioAttr = AudioAttributes.Builder()
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .setUsage(AudioAttributes.USAGE_NOTIFICATION)
          .build()
        setSound(soundUri, audioAttr)
      }

      val manager = getSystemService(NotificationManager::class.java)
      manager.createNotificationChannel(channel)
    }
  }
}
