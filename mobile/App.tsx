import React from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function App(): JSX.Element {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Simplified Chinese Flashcards</Text>
        <Text style={styles.subtitle}>
          Mobile shell ready. Connect to the FastAPI backend to sync data.
        </Text>
        <Text style={styles.note}>
          Tip: set EXPO_PUBLIC_API_BASE to your backend URL.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f8f5ef"
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center"
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1f2933",
    marginBottom: 12
  },
  subtitle: {
    fontSize: 16,
    color: "#52616b",
    textAlign: "center",
    marginBottom: 8
  },
  note: {
    fontSize: 14,
    color: "#7d8b94",
    textAlign: "center"
  }
});
