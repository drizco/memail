import { View, Text, ActivityIndicator, StyleSheet } from "react-native";

interface Props {
  status: "sending" | "sent" | "error";
  url?: string;
}

export default function SendingOverlay({ status, url }: Props) {
  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        {status === "sending" && (
          <>
            <ActivityIndicator size="large" color="#e52929" />
            <Text style={styles.text}>Sending...</Text>
          </>
        )}
        {status === "sent" && <Text style={styles.text}>MEmail sent!</Text>}
        {status === "error" && (
          <Text style={[styles.text, styles.errorText]}>
            Something went wrong
          </Text>
        )}
        {url && (
          <Text style={styles.url} numberOfLines={1}>
            {url}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    minWidth: 220,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  text: {
    fontSize: 20,
    fontWeight: "600",
    color: "#222",
    marginTop: 12,
  },
  errorText: {
    color: "#e52929",
  },
  url: {
    fontSize: 13,
    color: "#888",
    marginTop: 8,
    maxWidth: 240,
  },
});
