import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { HistoryEntry } from "../types";

interface Props {
  entry: HistoryEntry;
  onDelete: (id: string) => void;
}

export default function HistoryItem({ entry, onDelete }: Props) {
  const date = new Date(entry.timestamp);
  const timeStr = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {entry.title}
        </Text>
        <Text style={styles.url} numberOfLines={1}>
          {entry.url}
        </Text>
        <Text style={styles.meta}>
          {timeStr}
          {entry.status === "error" && (
            <Text style={styles.error}> — failed</Text>
          )}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => onDelete(entry.id)}
        style={styles.deleteButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.deleteText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  content: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
    color: "#222",
  },
  url: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  meta: {
    fontSize: 12,
    color: "#aaa",
    marginTop: 4,
  },
  error: {
    color: "#e52929",
  },
  deleteButton: {
    padding: 4,
  },
  deleteText: {
    fontSize: 18,
    color: "#999",
  },
});
