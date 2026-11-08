import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { Alert, Text } from "react-native";

import { useAppStore } from "@/lib/store";
import { NativeActionButton, NativeFieldGroup, NativeFieldSection } from "@/ui/native";
import { GlassPanel, NativeScreen, SectionHeader, TwilightButton, useTwilightTheme } from "@/ui/surface";

async function shareTextFile(filename: string, contents: string) {
  const file = new File(Paths.cache, filename);
  file.create({ intermediates: true, overwrite: true });
  await file.write(contents);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri);
  }
}

export default function DataManagementModal() {
  const [busy, setBusy] = useState(false);
  const exportCsv = useAppStore((state) => state.exportCsv);
  const exportMarkdown = useAppStore((state) => state.exportMarkdown);
  const exportBackup = useAppStore((state) => state.exportBackup);
  const previewImport = useAppStore((state) => state.previewImport);
  const importBackup = useAppStore((state) => state.importBackup);
  const { theme } = useTwilightTheme();

  async function handleImport() {
    try {
      setBusy(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const json = await new File(result.assets[0].uri).text();
      const preview = await previewImport(json);
      Alert.alert(
        "Import Backup",
        [
          `Sessions: ${preview.sessionCount} total, ${preview.newSessions} new, ${preview.updatedSessions} updated.`,
          preview.settingsChanges > 0 ? `Sleep settings changes: ${preview.settingsChanges}.` : "",
          preview.appearanceChanges > 0 ? `Appearance changes: ${preview.appearanceChanges}.` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Import",
            onPress: () => {
              importBackup(json).catch((error: Error) => Alert.alert("Import failed", error.message));
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert("Data error", error instanceof Error ? error.message : "Unknown error.");
    } finally {
      setBusy(false);
    }
  }

  async function handleExport(type: "csv" | "markdown" | "backup") {
    try {
      setBusy(true);
      if (type === "csv") {
        await shareTextFile("twilight_sessions.csv", await exportCsv());
      } else if (type === "markdown") {
        await shareTextFile("twilight_sessions.md", await exportMarkdown());
      } else {
        await shareTextFile("twilight_backup.json", await exportBackup());
      }
    } catch (error) {
      Alert.alert("Export failed", error instanceof Error ? error.message : "Unknown error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <NativeScreen>
      <SectionHeader title="Data Management" subtitle="CSV export, AI-friendly Markdown export, and full JSON backups." />
      <GlassPanel padded={false} style={{ paddingVertical: 8 }}>
        <NativeFieldGroup>
          <NativeFieldSection title="Export">
            <NativeActionButton title="Export CSV" disabled={busy} onPress={() => void handleExport("csv")} />
            <NativeActionButton title="Export Markdown" disabled={busy} onPress={() => void handleExport("markdown")} />
            <NativeActionButton title="Export Full Backup" disabled={busy} onPress={() => void handleExport("backup")} />
          </NativeFieldSection>
          <NativeFieldSection title="Import" footer="Imports preview changes before merging with current local data.">
            <NativeActionButton title="Import Backup" variant="filled" disabled={busy} onPress={() => void handleImport()} />
          </NativeFieldSection>
        </NativeFieldGroup>
      </GlassPanel>
      <GlassPanel>
        <Text style={{ color: theme.textSecondary, textAlign: "center", fontSize: 14, lineHeight: 21 }}>
        Full backups merge with current data and automatically create a pre-import backup first.
      </Text>
      </GlassPanel>
      <TwilightButton title="Close" subtle onPress={() => router.back()} />
    </NativeScreen>
  );
}
