import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  delta?: string;
}

export function StatCard({ label, value, icon, delta }: StatCardProps) {
  const isPositive = delta && delta.startsWith("+");
  const isNegative = delta && delta.startsWith("-");

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {icon}
        {delta && (
          <Text
            style={[
              styles.delta,
              isPositive && styles.deltaPositive,
              isNegative && styles.deltaNegative,
            ]}
          >
            {delta}
          </Text>
        )}
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    flex: 1,
    minWidth: "45%",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  value: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    color: "#6B7280",
  },
  delta: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  deltaPositive: {
    color: "#22C55E",
  },
  deltaNegative: {
    color: "#EF4444",
  },
});