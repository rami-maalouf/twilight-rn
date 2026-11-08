import { SegmentedControl } from "@expo/ui/community/segmented-control";
import React, { Fragment } from "react";
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type ViewStyle,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTwilightTheme } from "@/ui/surface";

/**
 * A standard React Native replacement for the previous native-only FieldGroup.
 */
export function NativeFieldGroup({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.fieldGroup, style]}>{children}</View>;
}

/**
 * A standard React Native replacement for the previous native-only FieldSection.
 */
export function NativeFieldSection({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: string;
  children: React.ReactNode;
}) {
  const { theme } = useTwilightTheme();
  const childrenArray = React.Children.toArray(children).filter(Boolean);

  return (
    <View style={styles.fieldSection}>
      {title ? (
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          {title.toUpperCase()}
        </Text>
      ) : null}
      <View style={[styles.sectionContent, { backgroundColor: theme.glass, borderColor: theme.outline }]}>
        {childrenArray.map((child, index) => (
          <Fragment key={index}>
            {child}
            {index < childrenArray.length - 1 && (
              <View style={[styles.divider, { backgroundColor: theme.outline }]} />
            )}
          </Fragment>
        ))}
      </View>
      {footer ? (
        <Text style={[styles.sectionFooter, { color: theme.textSecondary }]}>{footer}</Text>
      ) : null}
    </View>
  );
}

/**
 * A standard React Native row component.
 */
export function NativeRow({
  title,
  subtitle,
  trailing,
  onPress,
}: {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
}) {
  const { theme } = useTwilightTheme();
  const Container = onPress ? Pressable : View;

  return (
    <Container
      onPress={onPress}
      style={({ pressed }: any) => [
        styles.row,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={styles.rowLabel}>
        <Text style={[styles.rowTitle, { color: theme.textPrimary }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.rowSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
        ) : null}
      </View>
      <View style={styles.rowTrailingContainer}>
        {trailing}
        {onPress && !trailing && (
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        )}
      </View>
    </Container>
  );
}

export function NativeSwitchRow({
  title,
  subtitle,
  value,
  onValueChange,
  disabled,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { theme } = useTwilightTheme();
  return (
    <NativeRow
      title={title}
      subtitle={subtitle}
      trailing={
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: theme.outline, true: theme.accent }}
          thumbColor={Platform.OS === "ios" ? undefined : value ? theme.accent : "#f4f3f4"}
        />
      }
    />
  );
}

export function NativeActionButton({
  title,
  onPress,
  variant = "text",
  disabled,
}: {
  title: string;
  onPress?: () => void;
  variant?: "filled" | "outlined" | "text";
  disabled?: boolean;
}) {
  const { theme } = useTwilightTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionButton,
        variant === "filled" && { backgroundColor: theme.accent },
        variant === "outlined" && { borderWidth: 1, borderColor: theme.accent },
        pressed && { opacity: 0.7 },
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text
        style={[
          styles.actionButtonText,
          { color: variant === "filled" ? "#000" : theme.accent },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function NativeTextField({
  title,
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  title: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const { theme } = useTwilightTheme();
  return (
    <NativeRow
      title={title}
      trailing={
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          multiline={multiline}
          style={[
            styles.textField,
            { color: theme.textPrimary },
            multiline && { height: 80, textAlignVertical: "top" },
          ]}
        />
      }
    />
  );
}

export function NativeSegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return <SegmentedControl values={[...options]} selectedIndex={options.indexOf(value)} onChange={(event) => onChange(options[event.nativeEvent.selectedSegmentIndex])} />;
}

export function NativePickerRow<T extends string>({
  title,
  value,
  options,
  onChange,
}: {
  title: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.pickerRow}>
      <Text style={styles.pickerTitle}>{title}</Text>
      <NativeSegmentedControl options={options} value={value} onChange={onChange} />
    </View>
  );
}

export function NativeDateTimeRow({
  title,
  value,
  onPress,
}: {
  title: string;
  value: string;
  onPress?: () => void;
}) {
  const { theme } = useTwilightTheme();
  return (
    <NativeRow
      title={title}
      trailing={
        <Pressable
          onPress={onPress}
          style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.glass }}
        >
          <Text style={{ color: theme.accent, fontWeight: "600" }}>{value}</Text>
        </Pressable>
      }
    />
  );
}

// Dummy implementation for now to keep things running
export function NativeHost({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export const NativeList = NativeFieldGroup;
export const NativeScreen = View;

const styles = StyleSheet.create({
  fieldGroup: {
    gap: 20,
    marginVertical: 10,
  },
  fieldSection: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 16,
    letterSpacing: 0.5,
  },
  sectionContent: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  sectionFooter: {
    fontSize: 12,
    marginLeft: 16,
    marginRight: 16,
    lineHeight: 16,
    opacity: 0.8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 52,
  },
  rowPressed: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  rowLabel: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  rowSubtitle: {
    fontSize: 13,
    opacity: 0.7,
  },
  rowTrailingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 12,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  textField: {
    fontSize: 16,
    textAlign: "right",
    minWidth: 100,
    padding: 0,
  },
  segmentedControl: {
    flexDirection: "row",
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 2,
    gap: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
  },
  pickerRow: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pickerTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    opacity: 0.6,
  },
});
