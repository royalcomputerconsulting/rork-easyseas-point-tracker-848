import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { ArrowLeft, CheckCircle, AlertCircle, Server } from "lucide-react-native";
import { getBaseUrl, isBackendEnabled } from "@/lib/trpc";

export default function TestFinancialsBackendScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<{
    health?: { status: string; message?: string };
    trpcHealth?: { status: string; message?: string };
    financialsCount?: { status: string; data?: any; error?: string };
    financialsList?: { status: string; data?: any; error?: string };
  }>({});

  const baseUrl = getBaseUrl();
  const apiUrl = `${baseUrl}/api`;
  const trpcUrl = `${baseUrl}/api/trpc`;

  const testEndpoint = async (
    name: string,
    url: string,
    method: string = "GET",
    body?: any
  ) => {
    console.log(`[Test] Testing ${name} at ${url}`);
    try {
      const options: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);
      const contentType = response.headers.get("content-type") || "";
      
      console.log(`[Test] ${name} response:`, {
        status: response.status,
        contentType,
      });

      if (contentType.includes("text/html")) {
        const html = await response.text();
        console.error(`[Test] ${name} returned HTML:`, html.substring(0, 200));
        return {
          status: "error",
          error: "Received HTML instead of JSON",
          html: html.substring(0, 200),
        };
      }

      if (!response.ok) {
        const text = await response.text();
        return {
          status: "error",
          error: `HTTP ${response.status}: ${text.substring(0, 200)}`,
        };
      }

      const data = await response.json();
      return {
        status: "success",
        data,
      };
    } catch (error) {
      console.error(`[Test] ${name} error:`, error);
      return {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };

  const runTests = async () => {
    setIsLoading(true);
    setResults({});

    try {
      // Test 1: Basic API health
      const healthResult = await testEndpoint("API Health", apiUrl);
      setResults((prev) => ({ ...prev, health: healthResult }));

      // Test 2: tRPC health
      const trpcHealthResult = await testEndpoint("tRPC Health", trpcUrl);
      setResults((prev) => ({ ...prev, trpcHealth: trpcHealthResult }));

      // Test 3: Financials count via tRPC
      const countPayload = {
        "0": {
          json: null,
          meta: { values: { undefined: ["undefined"] } },
        },
      };
      const countResult = await testEndpoint(
        "Financials Count",
        `${trpcUrl}/financials.countOverview`,
        "POST",
        countPayload
      );
      setResults((prev) => ({ ...prev, financialsCount: countResult }));

      // Test 4: Financials list via tRPC
      const listPayload = {
        "0": {
          json: null,
          meta: { values: { undefined: ["undefined"] } },
        },
      };
      const listResult = await testEndpoint(
        "Financials List",
        `${trpcUrl}/financials.list`,
        "POST",
        listPayload
      );
      setResults((prev) => ({ ...prev, financialsList: listResult }));

    } catch (error) {
      console.error("[Test] Test suite error:", error);
      Alert.alert("Error", "Failed to complete tests");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status?: string) => {
    if (!status) return <AlertCircle size={20} color="#6B7280" />;
    if (status === "success") return <CheckCircle size={20} color="#10B981" />;
    return <AlertCircle size={20} color="#EF4444" />;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#1E3A8A" />
        </TouchableOpacity>
        <Text style={styles.title}>Test Financials Backend</Text>
      </View>

      {/* Backend Info */}
      <View style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Backend Configuration</Text>
        <Text style={styles.infoText}>Base URL: {baseUrl}</Text>
        <Text style={styles.infoText}>API URL: {apiUrl}</Text>
        <Text style={styles.infoText}>tRPC URL: {trpcUrl}</Text>
        <Text style={styles.infoText}>
          Backend Enabled: {isBackendEnabled ? "✅ Yes" : "❌ No"}
        </Text>
      </View>

      {/* Test Button */}
      <View style={styles.actionSection}>
        <TouchableOpacity
          style={[styles.testButton, isLoading && styles.buttonDisabled]}
          onPress={runTests}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Server size={20} color="#FFFFFF" />
          )}
          <Text style={styles.buttonText}>Run Backend Tests</Text>
        </TouchableOpacity>
      </View>

      {/* Test Results */}
      {Object.keys(results).length > 0 && (
        <View style={styles.resultsSection}>
          <Text style={styles.sectionTitle}>Test Results</Text>

          {/* API Health */}
          {results.health && (
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                {getStatusIcon(results.health.status)}
                <Text style={styles.resultTitle}>API Health Check</Text>
              </View>
              {results.health.status === "success" ? (
                <Text style={styles.successText}>
                  {JSON.stringify(results.health.data, null, 2)}
                </Text>
              ) : (
                <Text style={styles.errorText}>{results.health.error}</Text>
              )}
            </View>
          )}

          {/* tRPC Health */}
          {results.trpcHealth && (
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                {getStatusIcon(results.trpcHealth.status)}
                <Text style={styles.resultTitle}>tRPC Health Check</Text>
              </View>
              {results.trpcHealth.status === "success" ? (
                <Text style={styles.successText}>
                  {JSON.stringify(results.trpcHealth.data, null, 2)}
                </Text>
              ) : (
                <Text style={styles.errorText}>{results.trpcHealth.error}</Text>
              )}
            </View>
          )}

          {/* Financials Count */}
          {results.financialsCount && (
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                {getStatusIcon(results.financialsCount.status)}
                <Text style={styles.resultTitle}>Financials Count</Text>
              </View>
              {results.financialsCount.status === "success" ? (
                <Text style={styles.successText}>
                  {JSON.stringify(results.financialsCount.data, null, 2)}
                </Text>
              ) : (
                <Text style={styles.errorText}>
                  {results.financialsCount.error}
                </Text>
              )}
            </View>
          )}

          {/* Financials List */}
          {results.financialsList && (
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                {getStatusIcon(results.financialsList.status)}
                <Text style={styles.resultTitle}>Financials List</Text>
              </View>
              {results.financialsList.status === "success" ? (
                <Text style={styles.successText}>
                  Records: {results.financialsList.data?.result?.data?.json?.length || 0}
                </Text>
              ) : (
                <Text style={styles.errorText}>
                  {results.financialsList.error}
                </Text>
              )}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E3A8A",
    flex: 1,
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 12,
  },
  infoText: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
    fontFamily: "monospace",
  },
  actionSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  testButton: {
    backgroundColor: "#3B82F6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  resultsSection: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  resultCard: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  successText: {
    fontSize: 12,
    color: "#10B981",
    fontFamily: "monospace",
  },
  errorText: {
    fontSize: 12,
    color: "#EF4444",
    fontFamily: "monospace",
  },
});