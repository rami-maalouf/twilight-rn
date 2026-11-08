package expo.modules.twilighthealth

import android.app.Activity
import android.os.Bundle
import android.widget.TextView

class HealthRationaleActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(TextView(this).apply {
      text = "Twilight and Health Connect\n\nTwilight reads sleep sessions to show your sleep history and writes finished sessions you create or edit. Imported originals belong to their source app. Deleting an import in Twilight keeps the original in Health Connect.\n\nSync runs while Twilight is open. Recent history is limited to the last 29 days. You can grant reading and writing independently, or revoke access in Health Connect settings. Your backups do not include permission grants."
      textSize = 18f
      setPadding(32, 48, 32, 32)
    })
  }
}
