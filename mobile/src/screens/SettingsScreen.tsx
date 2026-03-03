import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Keyboard,
} from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { getEmail, saveEmail } from "../services/storage";
import { sendMeMail } from "../services/api";

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
};

export default function SettingsScreen({ navigation, route }: Props) {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const pendingUrl = route.params?.pendingUrl as string | undefined;
  const pendingTitle = route.params?.pendingTitle as string | undefined;

  useEffect(() => {
    getEmail().then((stored) => {
      if (stored) setEmail(stored);
    });
  }, []);

  async function handleSave() {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }

    Keyboard.dismiss();
    setSaving(true);
    await saveEmail(trimmed);

    if (pendingUrl) {
      const success = await sendMeMail(
        trimmed,
        pendingTitle || pendingUrl,
        pendingUrl
      );
      setSaving(false);
      if (success) {
        Alert.alert("Sent!", "MEmail sent successfully.", [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert("Error", "Failed to send email. Please try again.", [
          { text: "OK" },
        ]);
      }
    } else {
      setSaving(false);
      navigation.goBack();
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Your email address</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={!email}
      />
      <Text style={styles.hint}>
        Shared links will be emailed to this address.
      </Text>

      <TouchableOpacity
        style={[styles.button, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.buttonText}>
          {saving ? "Saving..." : pendingUrl ? "Save & Send" : "Save"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    color: "#222",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: "#222",
  },
  hint: {
    fontSize: 13,
    color: "#999",
    marginTop: 8,
  },
  button: {
    backgroundColor: "#e52929",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
