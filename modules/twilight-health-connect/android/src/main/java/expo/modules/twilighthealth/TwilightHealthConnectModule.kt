package expo.modules.twilighthealth

import android.content.Intent
import android.net.Uri
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.request.ChangesTokenRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.health.connect.client.changes.UpsertionChange
import androidx.health.connect.client.changes.DeletionChange
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.time.Instant
import java.time.ZoneOffset

class TwilightHealthConnectModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext)
  private val client get() = HealthConnectClient.getOrCreate(context)
  private val read = HealthPermission.getReadPermission(SleepSessionRecord::class)
  private val write = HealthPermission.getWritePermission(SleepSessionRecord::class)
  private var accessPromise: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("TwilightHealthConnect")
    AsyncFunction("getStatus") Coroutine { ->
      val sdk = HealthConnectClient.getSdkStatus(context)
      val permissions = if (sdk == HealthConnectClient.SDK_AVAILABLE) client.permissionController.getGrantedPermissions() else emptySet()
      mapOf("availability" to when (sdk) {
        HealthConnectClient.SDK_AVAILABLE -> "available"
        HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "updateRequired"
        else -> "unavailable"
      }, "read" to permissions.contains(read), "write" to permissions.contains(write), "packageName" to context.packageName)
    }
    AsyncFunction("requestAccess") { promise: Promise ->
      if (accessPromise != null) { promise.reject("BUSY", "An access request is already open", null); return@AsyncFunction }
      val activity = appContext.currentActivity
      if (activity == null) { promise.reject("NO_ACTIVITY", "Open Twilight before requesting access", null); return@AsyncFunction }
      try {
        val intent = PermissionController.createRequestPermissionResultContract().createIntent(activity, setOf(read, write))
        accessPromise = promise
        activity.startActivityForResult(intent, 9421)
      } catch (error: Exception) { accessPromise = null; promise.reject("ACCESS", error.message, error) }
    }
    OnActivityResult { _, result ->
      if (result.requestCode == 9421) { accessPromise?.resolve(null); accessPromise = null }
    }
    OnDestroy { accessPromise?.reject("CLOSED", "Access request closed", null); accessPromise = null }
    AsyncFunction("openSettings") {
      val sdk = HealthConnectClient.getSdkStatus(context)
      val intent = if (sdk == HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=com.google.android.apps.healthdata")) else HealthConnectClient.getHealthConnectManageDataIntent(context)
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
    AsyncFunction("getToken") Coroutine { ->
      client.getChangesToken(ChangesTokenRequest(setOf(SleepSessionRecord::class)))
    }
    AsyncFunction("read") Coroutine { start: String, end: String, page: String? ->
      val response = client.readRecords(ReadRecordsRequest(SleepSessionRecord::class, TimeRangeFilter.between(Instant.parse(start), Instant.parse(end)), pageSize = 500, pageToken = page))
      mapOf("records" to response.records.map { serialize(it) }, "page" to response.pageToken)
    }
    AsyncFunction("changes") Coroutine { token: String ->
      val result = client.getChanges(token)
      mapOf("records" to result.changes.filterIsInstance<UpsertionChange>().mapNotNull { (it.record as? SleepSessionRecord)?.let { record -> serialize(record) } },
        "deleted" to result.changes.filterIsInstance<DeletionChange>().map { it.recordId },
        "token" to result.nextChangesToken, "hasMore" to result.hasMore, "expired" to result.changesTokenExpired)
    }
    AsyncFunction("write") Coroutine { id: String, version: Long, start: String, end: String, startOffset: Int?, endOffset: Int? ->
      require(id.startsWith("twilight:"))
      val record = SleepSessionRecord(startTime = Instant.parse(start), endTime = Instant.parse(end),
        startZoneOffset = startOffset?.let { ZoneOffset.ofTotalSeconds(it) }, endZoneOffset = endOffset?.let { ZoneOffset.ofTotalSeconds(it) },
        metadata = Metadata.manualEntry(clientRecordId = id, clientRecordVersion = version),
        stages = listOf(SleepSessionRecord.Stage(Instant.parse(start), Instant.parse(end), SleepSessionRecord.STAGE_TYPE_SLEEPING)))
      client.insertRecords(listOf(record)).recordIdsList.first()
    }
    AsyncFunction("delete") Coroutine { id: String ->
      require(id.startsWith("twilight:"))
      client.deleteRecords(SleepSessionRecord::class, recordIdsList = emptyList(), clientRecordIdsList = listOf(id))
    }
  }
  private fun serialize(record: SleepSessionRecord): Map<String, Any?> = mapOf(
    "id" to record.metadata.id, "source" to record.metadata.dataOrigin.packageName, "clientId" to record.metadata.clientRecordId,
    "startTime" to record.startTime.toString(), "endTime" to record.endTime.toString(),
    "startOffset" to record.startZoneOffset?.totalSeconds, "endOffset" to record.endZoneOffset?.totalSeconds,
    "stages" to record.stages.map { mapOf("startTime" to it.startTime.toString(), "endTime" to it.endTime.toString(), "stage" to it.stage) })
}
