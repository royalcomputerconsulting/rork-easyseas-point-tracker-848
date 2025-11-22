import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { Stack, router } from "expo-router";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ArrowLeft, Check, AlertCircle } from "lucide-react-native";

type Brand = "royal" | "celebrity";

interface SessionData {
  token: string;
  accountId: string;
  loyaltyId: string;
  username: string;
  expiresAt: string;
}

export default function ConnectClubRoyaleScreen() {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [showWebView, setShowWebView] = useState<boolean>(false);
  const [manualMode, setManualMode] = useState<boolean>(false);
  const [manualJson, setManualJson] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const webViewRef = useRef<WebView>(null);

  const webViewUrl =
    brand === "royal"
      ? "https://www.royalcaribbean.com/club-royale/"
      : "https://www.celebritycruises.com/blue-chip-club/";

  const injectedJavaScript = `
    (function() {
      try {
        const persistSession = localStorage.getItem('persist:session');
        if (persistSession) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'session',
            data: persistSession
          }));
        }
      } catch (error) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'error',
          error: error.message
        }));
      }
    })();
    true;
  `;

  const handleWebViewMessage = async (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      if (message.type === "session") {
        const sessionData = JSON.parse(message.data);
        await saveSession(sessionData);
      } else if (message.type === "error") {
        console.error("[ConnectClubRoyale] WebView error:", message.error);
        setError("Failed to capture session data from website");
      }
    } catch (error) {
      console.error("[ConnectClubRoyale] Error processing message:", error);
      setError("Error processing session data");
    }
  };

  const saveSession = async (sessionData: any) => {
    try {
      setLoading(true);
      setError("");

      const token = sessionData.token || sessionData.accessToken;
      const accountId = sessionData.accountId || sessionData.account_id;
      const loyaltyId = sessionData.loyaltyId || sessionData.loyalty_id;
      const username =
        sessionData.username || sessionData.userName || "default";
      const expiresAt =
        sessionData.expiresAt ||
        sessionData.expires_at ||
        new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      if (!token || !accountId || !loyaltyId) {
        throw new Error("Missing required session data");
      }

      const savedData: SessionData = {
        token,
        accountId,
        loyaltyId,
        username,
        expiresAt,
      };

      const key = `gobo-${username}`;
      await AsyncStorage.setItem(key, JSON.stringify(savedData));
      await AsyncStorage.setItem(
        "gobo-active-profile",
        JSON.stringify({ key, brand })
      );

      console.log("[ConnectClubRoyale] Session saved successfully:", key);

      Alert.alert("Success", `Connected to ${brand} Club Royale account!`, [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error("[ConnectClubRoyale] Error saving session:", error);
      setError(
        error instanceof Error ? error.message : "Failed to save session"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async () => {
    try {
      setLoading(true);
      setError("");

      const sessionData = JSON.parse(manualJson);
      await saveSession(sessionData);
    } catch (error) {
      console.error("[ConnectClubRoyale] Error parsing manual JSON:", error);
      setError("Invalid JSON format. Please check your input.");
      setLoading(false);
    }
  };

  if (!brand) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: "Connect Casino Rewards",
            headerShown: true,
          }}
        />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.header}>
            <Text style={styles.title}>🎰 Connect Casino Rewards</Text>
            <Text style={styles.subtitle}>
              Choose your cruise line to connect your casino rewards account
            </Text>
          </View>

          <Pressable
            style={styles.brandButton}
            onPress={() => setBrand("royal")}
          >
            <View style={styles.brandContent}>
              <Text style={styles.brandTitle}>⚓ Royal Caribbean</Text>
              <Text style={styles.brandSubtitle}>Club Royale</Text>
            </View>
          </Pressable>

          <Pressable
            style={styles.brandButton}
            onPress={() => setBrand("celebrity")}
          >
            <View style={styles.brandContent}>
              <Text style={styles.brandTitle}>🛳 Celebrity Cruises</Text>
              <Text style={styles.brandSubtitle}>Blue Chip Club</Text>
            </View>
          </Pressable>

          <View style={styles.infoBox}>
            <AlertCircle size={20} color="#0066cc" />
            <Text style={styles.infoText}>
              Your login credentials are never stored. We only capture your
              session token to fetch offers on your behalf.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (manualMode) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: "Manual Connection",
            headerShown: true,
            headerLeft: () => (
              <Pressable onPress={() => setManualMode(false)}>
                <ArrowLeft size={24} color="#0066cc" />
              </Pressable>
            ),
          }}
        />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.header}>
            <Text style={styles.title}>📋 Manual Connection</Text>
            <Text style={styles.subtitle}>
              Paste your session data from the browser console
            </Text>
          </View>

          <View style={styles.instructionsBox}>
            <Text style={styles.instructionsTitle}>Instructions:</Text>
            <Text style={styles.instructionsText}>
              1. Open {webViewUrl} in your browser{"\n"}
              2. Login to your account{"\n"}
              3. Open browser console (F12){"\n"}
              4. Type: localStorage.getItem(&apos;persist:session&apos;){"\n"}
              5. Copy the entire output{"\n"}
              6. Paste it below
            </Text>
          </View>

          <TextInput
            style={styles.jsonInput}
            placeholder="Paste session JSON here..."
            multiline
            numberOfLines={10}
            value={manualJson}
            onChangeText={setManualJson}
            textAlignVertical="top"
          />

          {error ? (
            <View style={styles.errorBox}>
              <AlertCircle size={20} color="#dc2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={[
              styles.submitButton,
              (!manualJson || loading) && styles.submitButtonDisabled,
            ]}
            onPress={handleManualSubmit}
            disabled={!manualJson || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Check size={20} color="#fff" />
                <Text style={styles.submitButtonText}>Connect</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  if (Platform.OS === "web") {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: "Connect via Browser",
            headerShown: true,
            headerLeft: () => (
              <Pressable onPress={() => setBrand(null)}>
                <ArrowLeft size={24} color="#0066cc" />
              </Pressable>
            ),
          }}
        />
        <View style={styles.webFallback}>
          <Text style={styles.title}>🌐 Web Browser Required</Text>
          <Text style={styles.subtitle}>
            On web, please use manual connection method
          </Text>

          <Pressable
            style={styles.manualButton}
            onPress={() => setManualMode(true)}
          >
            <Text style={styles.manualButtonText}>Use Manual Connection</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!showWebView) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: `Connect to ${brand === "royal" ? "Club Royale" : "Blue Chip Club"}`,
            headerShown: true,
            headerLeft: () => (
              <Pressable onPress={() => setBrand(null)}>
                <ArrowLeft size={24} color="#0066cc" />
              </Pressable>
            ),
          }}
        />
        <View style={styles.readyScreen}>
          <Text style={styles.title}>Ready to Connect</Text>
          <Text style={styles.subtitle}>
            You will be taken to the{" "}
            {brand === "royal" ? "Royal Caribbean" : "Celebrity Cruises"}{" "}
            website to login.
          </Text>

          <View style={styles.infoBox}>
            <AlertCircle size={20} color="#0066cc" />
            <Text style={styles.infoText}>
              After logging in, we will automatically capture your session and
              return you to the app.
            </Text>
          </View>

          <Pressable
            style={styles.connectButton}
            onPress={() => setShowWebView(true)}
          >
            <Text style={styles.connectButtonText}>Open Login Page</Text>
          </Pressable>

          <Pressable
            style={styles.manualButton}
            onPress={() => setManualMode(true)}
          >
            <Text style={styles.manualButtonText}>
              Or use manual connection
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Login",
          headerShown: true,
          headerLeft: () => (
            <Pressable onPress={() => setShowWebView(false)}>
              <ArrowLeft size={24} color="#0066cc" />
            </Pressable>
          ),
        }}
      />
      {loading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Saving session...</Text>
        </View>
      ) : null}
      <WebView
        source={{ uri: webViewUrl }}
        injectedJavaScript={injectedJavaScript}
        onMessage={handleWebViewMessage}
        onNavigationStateChange={(navState) => {
          if (navState.url.includes("/casino-offers")) {
            setTimeout(() => {
              if (Platform.OS === "ios" && webViewRef.current) {
                webViewRef.current.injectJavaScript(injectedJavaScript);
              }
            }, 2000);
          }
        }}
        ref={webViewRef}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#64748b",
    lineHeight: 24,
  },
  brandButton: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  brandContent: {
    gap: 4,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1e293b",
  },
  brandSubtitle: {
    fontSize: 14,
    color: "#64748b",
  },
  infoBox: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#eff6ff",
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: "#1e40af",
    lineHeight: 20,
  },
  readyScreen: {
    flex: 1,
    padding: 20,
  },
  connectButton: {
    backgroundColor: "#0066cc",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 24,
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  manualButton: {
    padding: 16,
    alignItems: "center",
    marginTop: 16,
  },
  manualButtonText: {
    fontSize: 14,
    color: "#64748b",
    textDecorationLine: "underline",
  },
  webFallback: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  instructionsBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 12,
  },
  instructionsText: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 22,
  },
  jsonInput: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    minHeight: 200,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  errorBox: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fef2f2",
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: "#dc2626",
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: "#0066cc",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: "#cbd5e1",
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
  webview: {
    flex: 1,
  },
});
