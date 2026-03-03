import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useShareIntentContext } from "expo-share-intent";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { sendMeMail } from "../services/api";
import {
  getEmail,
  getHistory,
  addHistoryEntry,
  deleteHistoryEntry,
  clearHistory,
} from "../services/storage";
import { HistoryEntry } from "../types";
import HistoryItem from "../components/HistoryItem";
import SendingOverlay from "../components/SendingOverlay";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function HomeScreen({ navigation }: Props) {
  const { hasShareIntent, shareIntent, resetShareIntent } =
    useShareIntentContext();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [overlayStatus, setOverlayStatus] = useState<
    "sending" | "sent" | "error" | null
  >(null);
  const [overlayUrl, setOverlayUrl] = useState<string | undefined>();

  const refreshHistory = useCallback(async () => {
    setHistory(await getHistory());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshHistory();
    }, [refreshHistory])
  );

  useEffect(() => {
    if (hasShareIntent && shareIntent) {
      handleShareIntent();
    }
  }, [hasShareIntent]);

  async function handleShareIntent() {
    const url = shareIntent.webUrl || shareIntent.text || "";
    if (!url) {
      resetShareIntent();
      return;
    }

    const title = shareIntent.meta?.title || url;
    const email = await getEmail();

    if (!email) {
      navigation.navigate("Settings", { pendingUrl: url, pendingTitle: title });
      resetShareIntent();
      return;
    }

    setOverlayUrl(url);
    setOverlayStatus("sending");

    const success = await sendMeMail(email, title, url);
    const status = success ? "success" : "error";

    await addHistoryEntry({
      id: Date.now().toString(),
      title,
      url,
      timestamp: Date.now(),
      status,
    });

    setOverlayStatus(success ? "sent" : "error");
    await refreshHistory();

    setTimeout(() => {
      setOverlayStatus(null);
      setOverlayUrl(undefined);
      resetShareIntent();
    }, 1500);
  }

  async function handleDelete(id: string) {
    await deleteHistoryEntry(id);
    await refreshHistory();
  }

  async function handleClearAll() {
    await clearHistory();
    setHistory([]);
  }

  return (
    <View style={styles.container}>
      {overlayStatus && (
        <SendingOverlay status={overlayStatus} url={overlayUrl} />
      )}

      {history.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No emails sent yet</Text>
          <Text style={styles.emptySubtext}>
            Share a link from any app to get started
          </Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <HistoryItem entry={item} onDelete={handleDelete} />
          )}
        />
      )}

      {history.length > 0 && (
        <TouchableOpacity style={styles.clearButton} onPress={handleClearAll}>
          <Text style={styles.clearText}>Clear All</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "500",
    color: "#666",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#aaa",
    marginTop: 8,
    textAlign: "center",
  },
  clearButton: {
    padding: 16,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e0e0e0",
  },
  clearText: {
    fontSize: 16,
    color: "#e52929",
  },
});
