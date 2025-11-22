import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/theme';
import { trpc } from '@/lib/trpc';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Trophy, TrendingUp } from 'lucide-react-native';

export default function TestPointsSystemScreen() {
  const router = useRouter();
  const [cruiseId, setCruiseId] = useState('');
  const [pointsEarned, setPointsEarned] = useState('');
  const [amountWonOrLost, setAmountWonOrLost] = useState('');
  const [ship, setShip] = useState('');
  const [sailDate, setSailDate] = useState('');

  // Get points summary
  const pointsSummaryQuery = trpc.cruises.getPointsSummary.useQuery();
  const addPointsMutation = trpc.cruises.addCruisePoints.useMutation();

  const handleAddPoints = async () => {
    if (!cruiseId || !pointsEarned) {
      Alert.alert('Error', 'Please enter cruise ID and points earned');
      return;
    }

    try {
      await addPointsMutation.mutateAsync({
        cruiseId,
        pointsEarned: parseInt(pointsEarned),
        amountWonOrLost: amountWonOrLost ? parseFloat(amountWonOrLost) : 0,
        ship: ship || undefined,
        sailDate: sailDate || undefined,
        notes: 'Added via test interface'
      });

      Alert.alert('Success', 'Points added successfully!');
      
      // Clear form
      setCruiseId('');
      setPointsEarned('');
      setAmountWonOrLost('');
      setShip('');
      setSailDate('');
      
      // Refresh data
      pointsSummaryQuery.refetch();
    } catch (error) {
      Alert.alert('Error', 'Failed to add points');
      console.error('Error adding points:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Points System Test</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Current Points Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Points Summary</Text>
          {pointsSummaryQuery.isLoading ? (
            <Text style={styles.loadingText}>Loading...</Text>
          ) : pointsSummaryQuery.data ? (
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Points:</Text>
                <Text style={[styles.summaryValue, styles.highlight]}>
                  {pointsSummaryQuery.data.totalPoints.toLocaleString()}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Winnings:</Text>
                <Text style={[styles.summaryValue, { 
                  color: pointsSummaryQuery.data.totalWinnings >= 0 ? COLORS.success : COLORS.error 
                }]}>
                  ${pointsSummaryQuery.data.totalWinnings.toFixed(0)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Current Tier:</Text>
                <Text style={styles.summaryValue}>{pointsSummaryQuery.data.currentTier}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Points to Next Tier:</Text>
                <Text style={styles.summaryValue}>
                  {pointsSummaryQuery.data.pointsToNextTier.toLocaleString()}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Cruise Count:</Text>
                <Text style={styles.summaryValue}>{pointsSummaryQuery.data.cruiseCount}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.errorText}>Failed to load points summary</Text>
          )}
        </View>

        {/* Add Points Form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add/Update Cruise Points</Text>
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Cruise ID *</Text>
              <TextInput
                style={styles.input}
                value={cruiseId}
                onChangeText={setCruiseId}
                placeholder="e.g., 5207254"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Points Earned *</Text>
              <TextInput
                style={styles.input}
                value={pointsEarned}
                onChangeText={setPointsEarned}
                placeholder="e.g., 976"
                keyboardType="numeric"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Amount Won/Lost</Text>
              <TextInput
                style={styles.input}
                value={amountWonOrLost}
                onChangeText={setAmountWonOrLost}
                placeholder="e.g., 589 (positive for winnings)"
                keyboardType="numeric"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Ship Name</Text>
              <TextInput
                style={styles.input}
                value={ship}
                onChangeText={setShip}
                placeholder="e.g., Navigator of the Seas"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Sail Date</Text>
              <TextInput
                style={styles.input}
                value={sailDate}
                onChangeText={setSailDate}
                placeholder="e.g., 2025-09-15"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            <TouchableOpacity 
              style={styles.addButton} 
              onPress={handleAddPoints}
              disabled={addPointsMutation.isLoading}
            >
              <Plus size={20} color={COLORS.white} />
              <Text style={styles.addButtonText}>
                {addPointsMutation.isLoading ? 'Adding...' : 'Add Points'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Cruise Breakdown */}
        {pointsSummaryQuery.data?.cruiseBreakdown && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cruise Breakdown</Text>
            {pointsSummaryQuery.data.cruiseBreakdown.map((cruise) => (
              <View key={cruise.cruiseId} style={styles.cruiseCard}>
                <View style={styles.cruiseHeader}>
                  <Text style={styles.cruiseShip}>{cruise.ship}</Text>
                  <Text style={styles.cruiseDate}>{cruise.sailDate}</Text>
                </View>
                <View style={styles.cruiseMetrics}>
                  <View style={styles.metric}>
                    <Trophy size={16} color={COLORS.primary} />
                    <Text style={styles.metricText}>{cruise.pointsEarned} pts</Text>
                  </View>
                  <View style={styles.metric}>
                    <TrendingUp size={16} color={cruise.amountWonOrLost >= 0 ? COLORS.success : COLORS.error} />
                    <Text style={[styles.metricText, { 
                      color: cruise.amountWonOrLost >= 0 ? COLORS.success : COLORS.error 
                    }]}>
                      ${cruise.amountWonOrLost.toFixed(0)}
                    </Text>
                  </View>
                  <Text style={styles.verifiedBadge}>
                    {cruise.verified ? '✓ Verified' : '⚠ Calculated'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  highlight: {
    fontSize: 18,
    color: COLORS.primary,
  },
  form: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  addButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  cruiseCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cruiseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cruiseShip: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  cruiseDate: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  cruiseMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  verifiedBadge: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 'auto',
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    textAlign: 'center',
    padding: 20,
  },
});