import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { ArrowLeft, Database, CheckCircle, AlertCircle } from "lucide-react-native";
import { trpc } from "@/lib/trpc";

export default function TestFinancialsSimpleScreen() {
  const [status, setStatus] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Queries
  const countQuery = trpc.financials.countOverview.useQuery();
  const listQuery = trpc.financials.list.useQuery();
  
  // Mutations
  const insertReceiptsMut = trpc.financials.insertHardcodedReceipts.useMutation();
  const insertStatementsMut = trpc.financials.insertHardcodedStatements.useMutation();
  
  const handleTestReceipts = async () => {
    setIsProcessing(true);
    setStatus("Processing receipts...");
    
    try {
      const result = await insertReceiptsMut.mutateAsync();
      setStatus(`Receipts: ${result.inserted} inserted`);
      await countQuery.refetch();
      await listQuery.refetch();
    } catch (error) {
      console.error("Error processing receipts:", error);
      setStatus(`Error: ${error instanceof Error ? error.message : 'Failed'}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleTestStatements = async () => {
    setIsProcessing(true);
    setStatus("Processing statements...");
    
    try {
      const result = await insertStatementsMut.mutateAsync();
      setStatus(`Statements: ${result.inserted} line items created`);
      await countQuery.refetch();
      await listQuery.refetch();
    } catch (error) {
      console.error("Error processing statements:", error);
      setStatus(`Error: ${error instanceof Error ? error.message : 'Failed'}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const counts = countQuery.data || {
    tripItEvents: 0,
    receipts: 0,
    statements: 0,
    financialRows: 0,
    totalStatementLineItems: 0
  };
  
  const financialRows = listQuery.data || [];
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#1E3A8A" />
        </TouchableOpacity>
        <Text style={styles.title}>Test Financials Simple</Text>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Current Database Status</Text>
        <Text style={styles.stat}>Financial Records: {counts.financialRows}</Text>
        <Text style={styles.stat}>Receipts: {counts.receipts}</Text>
        <Text style={styles.stat}>Statements: {counts.statements}</Text>
        <Text style={styles.stat}>Statement Line Items: {counts.totalStatementLineItems}</Text>
        <Text style={styles.stat}>Actual Rows in Memory: {financialRows.length}</Text>
      </View>
      
      {status ? (
        <View style={styles.statusCard}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      ) : null}
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, isProcessing && styles.buttonDisabled]}
          onPress={handleTestReceipts}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Database size={20} color="#FFFFFF" />
          )}
          <Text style={styles.buttonText}>Test Insert Receipts</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, isProcessing && styles.buttonDisabled]}
          onPress={handleTestStatements}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Database size={20} color="#FFFFFF" />
          )}
          <Text style={styles.buttonText}>Test Insert Statements</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Sample Financial Records</Text>
        {financialRows.slice(0, 5).map((row, index) => (
          <View key={index} style={styles.recordItem}>
            <Text style={styles.recordText}>
              {row.sourceType} - {row.cruiseId} - ${row.amount || row.lineTotal || 0}
            </Text>
          </View>
        ))}
      </View>
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
  card: {
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
  statusCard: {
    backgroundColor: "#FEF3C7",
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  statusText: {
    fontSize: 14,
    color: "#92400E",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 12,
  },
  stat: {
    fontSize: 14,
    color: "#4B5563",
    marginBottom: 4,
  },
  buttonContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  button: {
    backgroundColor: "#3B82F6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 8,
    gap: 8,
    marginBottom: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  recordItem: {
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  recordText: {
    fontSize: 12,
    color: "#6B7280",
  },
});