import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { Stack, router } from "expo-router";
import { trpc } from "@/lib/trpc";

export default function AddCasinoActivity() {
  const [ship, setShip] = useState("Radiance of the Seas");
  const [points, setPoints] = useState("1009");
  const [winnings, setWinnings] = useState("780");
  const [date, setDate] = useState("");

  const addMutation = trpc.casino.addActivity.useMutation();
  const totalQuery = trpc.casino.getTotal.useQuery();

  const handleSubmit = async () => {
    if (!ship || !points || !winnings) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    try {
      const result = await addMutation.mutateAsync({
        ship,
        points: parseInt(points, 10),
        winnings: parseFloat(winnings),
        date: date || new Date().toISOString(),
      });

      Alert.alert("Success", result.message);
      await totalQuery.refetch();
      
      setShip("");
      setPoints("");
      setWinnings("");
      setDate("");
    } catch (error) {
      Alert.alert("Error", "Failed to add casino activity");
      console.error(error);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Add Casino Activity",
          headerStyle: { backgroundColor: "#1a1a2e" },
          headerTintColor: "#fff",
        }}
      />
      
      <ScrollView style={styles.content}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Current Total Points</Text>
          <Text style={styles.summaryValue}>
            {totalQuery.data?.totalPoints.toLocaleString() || "0"}
          </Text>
          <Text style={styles.summarySubtext}>
            Total Winnings: ${totalQuery.data?.totalWinnings.toLocaleString() || "0"}
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Ship Name *</Text>
            <TextInput
              style={styles.input}
              value={ship}
              onChangeText={setShip}
              placeholder="e.g., Radiance of the Seas"
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Points Earned *</Text>
            <TextInput
              style={styles.input}
              value={points}
              onChangeText={setPoints}
              placeholder="e.g., 1009"
              keyboardType="numeric"
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Winnings ($) *</Text>
            <TextInput
              style={styles.input}
              value={winnings}
              onChangeText={setWinnings}
              placeholder="e.g., 780"
              keyboardType="numeric"
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Date (optional)</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#666"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, addMutation.isPending && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={addMutation.isPending}
          >
            <Text style={styles.buttonText}>
              {addMutation.isPending ? "Adding..." : "Add Activity"}
            </Text>
          </TouchableOpacity>
        </View>

        {totalQuery.data?.activities && totalQuery.data.activities.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>Recent Activity</Text>
            {totalQuery.data.activities.slice(-5).reverse().map((activity, index) => (
              <View key={index} style={styles.activityCard}>
                <Text style={styles.activityShip}>{activity.ship}</Text>
                <View style={styles.activityRow}>
                  <Text style={styles.activityPoints}>
                    +{activity.points.toLocaleString()} pts
                  </Text>
                  <Text style={styles.activityWinnings}>
                    ${activity.winnings.toLocaleString()}
                  </Text>
                </View>
                <Text style={styles.activityDate}>
                  {new Date(activity.date).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f1e",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  summaryCard: {
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    alignItems: "center",
  },
  summaryLabel: {
    color: "#888",
    fontSize: 14,
    marginBottom: 8,
  },
  summaryValue: {
    color: "#4CAF50",
    fontSize: 36,
    fontWeight: "700" as const,
    marginBottom: 4,
  },
  summarySubtext: {
    color: "#aaa",
    fontSize: 14,
  },
  form: {
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600" as const,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#0f0f1e",
    borderRadius: 8,
    padding: 12,
    color: "#fff",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#333",
  },
  button: {
    backgroundColor: "#4CAF50",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700" as const,
  },
  historySection: {
    marginBottom: 24,
  },
  historyTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700" as const,
    marginBottom: 12,
  },
  activityCard: {
    backgroundColor: "#1a1a2e",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  activityShip: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600" as const,
    marginBottom: 8,
  },
  activityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  activityPoints: {
    color: "#4CAF50",
    fontSize: 14,
    fontWeight: "600" as const,
  },
  activityWinnings: {
    color: "#2196F3",
    fontSize: 14,
    fontWeight: "600" as const,
  },
  activityDate: {
    color: "#888",
    fontSize: 12,
  },
});
