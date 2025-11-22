import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import {
  Calculator,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Target,
  Zap,
  Ticket,
} from "lucide-react-native";
import { trpc } from "@/lib/trpc";
import { useFinancials } from "@/state/FinancialsProvider";

interface ROICalculation {
  cruise: {
    id: string;
    ship: string;
    itinerary: string;
    departureDate: string;
    nights: number;
    cabinType: string;
  };
  offer: {
    code: string;
    type: string;
    name: string;
    expires: string;
  } | null;
  payTableEntry: {
    points: number;
    reward: string;
    nextCruiseBonus: string;
    cabinTypes: string[];
  };
  financial: {
    retailValue: number;
    cruiseSavings: number;
    freePlayValue: number;
    perksValue: number;
    totalValue: number;
    coinInRequired: number;
    travelCost: number;
    totalOutOfPocket: number;
    netSavings: number;
    roi: number;
    costPerPoint: number;
    valuePerPoint: number;
    breakEvenPoints: number;
    profitMargin: number;
  };
  analysis: {
    riskLevel: "low" | "medium" | "high";
    recommendations: string[];
    scenarios: {
      conservative: { roi: number; totalValue: number; description: string };
      optimistic: { roi: number; totalValue: number; description: string };
      worstCase: { roi: number; totalValue: number; description: string };
    };
  };
  breakdown: {
    baseCruisePrice: number;
    taxes: number;
    travelCost: number;
    coinIn: number;
    savings: number;
    freePlay: number;
    perks: number;
  };
}

export default function ROICalculatorScreen() {
  const params = useLocalSearchParams<{ cruiseId?: string; cabinType?: string; points?: string }>();
  const [cruiseId, setCruiseId] = React.useState<string>("");
  const [cabinType, setCabinType] = React.useState<
    "Interior" | "Oceanview" | "Balcony" | "Suite" | "Junior Suite"
  >("Suite");
  const [pointsToSpend, setPointsToSpend] = React.useState<string>("15000");
  const [usdPerPoint, setUsdPerPoint] = React.useState<string>("0.01");
  const [customTravelCost, setCustomTravelCost] = React.useState<string>("");
  const [isCalculating, setIsCalculating] = React.useState<boolean>(false);
  const [calculation, setCalculation] = React.useState<ROICalculation | null>(null);
  const [webPricingLoading, setWebPricingLoading] = React.useState<boolean>(false);

  const { certificates, getCruiseSummary, getAllSummaries } = useFinancials();
  console.log("[ROICalculator] Component mounted");

  React.useEffect(() => {
    try {
      const pCruise =
        typeof params.cruiseId === "string"
          ? params.cruiseId
          : Array.isArray(params.cruiseId)
          ? params.cruiseId[0]
          : undefined;
      const pCabin =
        typeof params.cabinType === "string"
          ? params.cabinType
          : Array.isArray(params.cabinType)
          ? params.cabinType[0]
          : undefined;
      const pPoints =
        typeof params.points === "string"
          ? params.points
          : Array.isArray(params.points)
          ? params.points[0]
          : undefined;

      if (pCruise) setCruiseId(pCruise);
      if (pCabin) {
        const normalized = pCabin.toLowerCase();
        const map: Record<string, "Interior" | "Oceanview" | "Balcony" | "Suite" | "Junior Suite"> = {
          interior: "Interior",
          oceanview: "Oceanview",
          balcony: "Balcony",
          suite: "Suite",
          juniorsuite: "Junior Suite",
          "junior suite": "Junior Suite",
        };
        const key = normalized.replace(/\s+/g, "");
        if (map[key]) setCabinType(map[key]);
      }
      if (pPoints && /^\d+$/.test(pPoints)) setPointsToSpend(pPoints);
      console.log("[ROICalculator] Pre-filled from params", { pCruise, pCabin, pPoints });
    } catch (e) {
      console.log("[ROICalculator] Params parse error", e);
    }
  }, [params]);

  const localCruises = React.useMemo(() => {
    try {
      const list = getAllSummaries();
      return list.map((s) => ({
        id: s.cruiseId,
        ship: s.ship,
        itineraryName: "",
        departureDate: s.date,
        nights: 0,
      }));
    } catch (e) {
      console.log("[ROICalculator] Failed to load local cruises", e);
      return [] as { id: string; ship: string; itineraryName: string; departureDate: string; nights: number }[];
    }
  }, [getAllSummaries]);

  const handleGetWebPricing = async () => {
    console.log("[ROICalculator] Getting web pricing for all cruises");
    setWebPricingLoading(true);

    try {
      const { trpcClient } = await import("@/lib/trpc");

      const result = await trpcClient.cruises.webPricing.query({
        forceRefresh: true,
      });

      console.log("[ROICalculator] Web pricing complete:", result.summary);
      Alert.alert(
        "Web Pricing Complete",
        `Updated pricing for ${result.summary.totalCruisesChecked} cruises from ${result.summary.sourcesUsed.length} sources. Generated ${result.summary.totalAlerts} alerts.`
      );
    } catch (error) {
      console.error("[ROICalculator] Error getting web pricing:", error);
      Alert.alert(
        "Error",
        `Failed to get web pricing: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setWebPricingLoading(false);
    }
  };

  const handleCalculateROI = async () => {
    if (!cruiseId) {
      Alert.alert("Error", "Please select a cruise first");
      return;
    }

    const points = parseInt(pointsToSpend);
    if (isNaN(points) || points <= 0) {
      Alert.alert("Error", "Please enter valid points to spend");
      return;
    }

    const usdPerPt = parseFloat(usdPerPoint);
    if (isNaN(usdPerPt) || usdPerPt <= 0) {
      Alert.alert("Error", "Enter a valid $ per point value (e.g. 0.01)");
      return;
    }

    console.log("[ROICalculator] Calculating ROI (local) for:", {
      cruiseId,
      cabinType,
      points,
      usdPerPt,
    });
    setIsCalculating(true);

    try {
      const summary = getCruiseSummary(cruiseId);
      if (!summary) {
        throw new Error("Cruise summary not found");
      }

      const appliedCerts = certificates.filter(
        (c) => (c.redeemedOnCruiseId ?? "") === cruiseId
      );
      const certOffset = appliedCerts.reduce((s, c) => s + (c.valueUSD || 0), 0);
      const travelCost = customTravelCost ? Math.max(0, parseFloat(customTravelCost)) : 0;

      const totalOutOfPocket = Math.max(0, summary.outOfPocket + travelCost - certOffset);
      const pointsDollarValue = points * usdPerPt;
      const baseValue = summary.retailCabinValue + summary.extrasValue + summary.winningsBroughtHome;
      const totalValue = baseValue + pointsDollarValue;
      const netSavings = totalValue - totalOutOfPocket;
      const roi = totalOutOfPocket > 0 ? (totalValue / totalOutOfPocket) * 100 : 0;
      const costPerPoint = points > 0 ? totalOutOfPocket / points : 0;
      const valuePerPoint = usdPerPt;
      const breakEvenPoints = valuePerPoint > 0 ? Math.ceil(totalOutOfPocket / valuePerPoint) : 0;
      const profitMargin = totalValue > 0 ? (netSavings / totalValue) * 100 : 0;

      const conservativeAdj = 0.85;
      const optimisticAdj = 1.15;

      const result: ROICalculation = {
        cruise: {
          id: summary.cruiseId,
          ship: summary.ship,
          itinerary: "",
          departureDate: summary.date,
          nights: 0,
          cabinType,
        },
        offer: null,
        payTableEntry: {
          points,
          reward: "Points Redemption",
          nextCruiseBonus: "N/A",
          cabinTypes: [cabinType],
        },
        financial: {
          retailValue: baseValue,
          cruiseSavings: summary.retailCabinValue,
          freePlayValue: 0,
          perksValue: summary.extrasValue,
          totalValue,
          coinInRequired: 0,
          travelCost,
          totalOutOfPocket,
          netSavings,
          roi,
          costPerPoint,
          valuePerPoint,
          breakEvenPoints,
          profitMargin,
        },
        analysis: {
          riskLevel: roi >= 150 ? "low" : roi >= 80 ? "medium" : "high",
          recommendations: [
            netSavings >= 0
              ? "Good value at current points redemption."
              : "Consider reducing points or choosing a different sailing.",
            certOffset > 0
              ? `Certificates reduce OOP by ${formatCurrency(certOffset)}`
              : "Link certificates to improve ROI.",
          ],
          scenarios: {
            conservative: {
              roi:
                totalOutOfPocket > 0
                  ? ((totalValue * conservativeAdj) / totalOutOfPocket) * 100
                  : 0,
              totalValue: Math.round(totalValue * conservativeAdj),
              description: "Conservative scenario (value -15%)",
            },
            optimistic: {
              roi:
                totalOutOfPocket > 0
                  ? ((totalValue * optimisticAdj) / totalOutOfPocket) * 100
                  : 0,
              totalValue: Math.round(totalValue * optimisticAdj),
              description: "Optimistic scenario (value +15%)",
            },
            worstCase: {
              roi:
                totalOutOfPocket > 0
                  ? summary.retailCabinValue / totalOutOfPocket * 100
                  : 0,
              totalValue: Math.round(summary.retailCabinValue),
              description: "Worst case (only cabin value realized)",
            },
          },
        },
        breakdown: {
          baseCruisePrice: summary.outOfPocket,
          taxes: 0,
          travelCost,
          coinIn: 0,
          savings: summary.retailCabinValue,
          freePlay: 0,
          perks: summary.extrasValue,
        },
      };

      setCalculation(result);
      console.log(
        "[ROICalculator] ROI calculation complete (local):",
        result.financial.roi.toFixed(1) + "%"
      );
    } catch (error) {
      console.error("[ROICalculator] Error calculating ROI (local):", error);
      Alert.alert(
        "Error",
        `Failed to calculate ROI: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`
      );
    } finally {
      setIsCalculating(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getRiskColor = (riskLevel: "low" | "medium" | "high") => {
    switch (riskLevel) {
      case "low":
        return "#22C55E";
      case "medium":
        return "#F59E0B";
      case "high":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  const getRiskIcon = (riskLevel: "low" | "medium" | "high") => {
    const color = getRiskColor(riskLevel);

    switch (riskLevel) {
      case "low":
        return <CheckCircle size={20} color={color} />;
      case "medium":
        return <AlertTriangle size={20} color={color} />;
      case "high":
        return <AlertTriangle size={20} color={color} />;
      default:
        return <AlertTriangle size={20} color={color} />;
    }
  };

  const cruises = localCruises;

  return (
    <>
      <Stack.Screen
        options={{
          title: "ROI Calculator",
          headerBackTitle: "Back",
        }}
      />
      <ScrollView style={styles.container} testID="roi-calculator-screen">
        <View style={styles.inputSection}>
          <Text style={styles.sectionTitle}>🧮 Calculate ROI</Text>

          <TouchableOpacity
            style={[styles.webPricingButton, webPricingLoading && styles.webPricingButtonDisabled]}
            onPress={handleGetWebPricing}
            disabled={isCalculating || webPricingLoading}
            testID="web-pricing-button"
          >
            {webPricingLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.webPricingButtonText}>
                GET PRICING FOR ALL CRUISES FROM THE WEB
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Select Cruise</Text>
            <View style={styles.cruiseSelector}>
              {cruises.length > 0 ? (
                cruises.slice(0, 5).map((cruise) => (
                  <TouchableOpacity
                    key={cruise.id}
                    style={[
                      styles.cruiseOption,
                      cruiseId === cruise.id && styles.cruiseOptionSelected,
                    ]}
                    onPress={() => setCruiseId(cruise.id)}
                    testID={`cruise-option-${cruise.id}`}
                  >
                    <Text
                      style={[
                        styles.cruiseOptionText,
                        cruiseId === cruise.id && styles.cruiseOptionTextSelected,
                      ]}
                    >
                      {cruise.ship}
                    </Text>
                    <Text style={styles.cruiseOptionSubtext}>
                      {cruise.itineraryName} • {formatDate(cruise.departureDate)}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noCruisesText}>
                  No cruises available. Import cruise data first.
                </Text>
              )}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Cabin Type</Text>
            <View style={styles.cabinTypeSelector}>
              {(["Suite", "Junior Suite", "Balcony", "Oceanview", "Interior"] as const).map(
                (type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.cabinTypeButton,
                      cabinType === type && styles.cabinTypeButtonSelected,
                    ]}
                    onPress={() => setCabinType(type)}
                    testID={`cabin-type-${type}`}
                  >
                    <Text
                      style={[
                        styles.cabinTypeButtonText,
                        cabinType === type && styles.cabinTypeButtonTextSelected,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Points to Spend</Text>
            <TextInput
              style={styles.textInput}
              value={pointsToSpend}
              onChangeText={setPointsToSpend}
              placeholder="15000"
              keyboardType="numeric"
              testID="points-input"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>$ per Point</Text>
            <TextInput
              style={styles.textInput}
              value={usdPerPoint}
              onChangeText={setUsdPerPoint}
              placeholder="0.01"
              keyboardType={Platform.OS === "web" ? ("decimal" as any) : "decimal-pad"}
              testID="usd-per-point-input"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Custom Travel Cost (Optional)</Text>
            <TextInput
              style={styles.textInput}
              value={customTravelCost}
              onChangeText={setCustomTravelCost}
              placeholder="Auto-calculated based on departure port"
              keyboardType={Platform.OS === "web" ? ("decimal" as any) : "decimal-pad"}
              testID="travel-cost-input"
            />
          </View>

          <TouchableOpacity
            style={[styles.calculateButton, isCalculating && styles.calculateButtonDisabled]}
            onPress={handleCalculateROI}
            disabled={isCalculating}
            testID="calculate-button"
          >
            {isCalculating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Calculator size={20} color="#FFFFFF" />
            )}
            <Text style={styles.calculateButtonText}>
              {isCalculating ? "Calculating..." : "Calculate ROI"}
            </Text>
          </TouchableOpacity>
        </View>

        {calculation && (
          <>
            {(() => {
              const applied = certificates.filter(
                (c) => (c.redeemedOnCruiseId ?? "") === calculation.cruise.id
              );
              const totalCerts = applied.reduce(
                (s, c) => s + (c.valueUSD || 0),
                0
              );
              if (applied.length === 0 || totalCerts <= 0) return null;
              const adjustedNet = calculation.financial.netSavings + totalCerts;
              const adjustedRoi =
                calculation.financial.totalOutOfPocket > 0
                  ? ((calculation.financial.totalValue + totalCerts) /
                      calculation.financial.totalOutOfPocket) *
                    100
                  : calculation.financial.roi;
              return (
                <View style={styles.resultsSection}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Ticket size={18} color="#065F46" />
                    <Text style={styles.sectionTitle}>Certificates Applied</Text>
                  </View>
                  <View style={styles.metricsGrid}>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricNumber}>${totalCerts.toLocaleString()}</Text>
                      <Text style={styles.metricLabel}>Total Certificates</Text>
                    </View>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricNumber}>{adjustedRoi.toFixed(1)}%</Text>
                      <Text style={styles.metricLabel}>Adj. ROI</Text>
                    </View>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricNumber}>
                        {
                          new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: "USD",
                            maximumFractionDigits: 0,
                          }).format(adjustedNet)
                        }
                      </Text>
                      <Text style={styles.metricLabel}>Adj. Net</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 8 }}>
                    Linked certificates: {applied.map((a) => a.code ?? a.id).join(", ")}
                  </Text>
                </View>
              );
            })()}

            {(calculation as any).actualData && (
              <View style={styles.dataSourceSection}>
                <Text style={styles.sectionTitle}>
                  {(calculation as any).actualData.hasReceiptData ||
                  (calculation as any).actualData.hasStatementData
                    ? "📊 Based on Actual Data"
                    : "📈 Estimated Data"}
                </Text>
                <View style={styles.dataSourceInfo}>
                  {(calculation as any).actualData.hasReceiptData && (
                    <Text style={styles.dataSourceItem}>✅ Receipt data available</Text>
                  )}
                  {(calculation as any).actualData.hasStatementData && (
                    <Text style={styles.dataSourceItem}>
                      ✅ Statement data available {" "}
                      {(calculation as any).actualData.lineItemsCount}
                      {" "} line items
                    </Text>
                  )}
                  {(calculation as any).actualData.actualCasinoSpend > 0 && (
                    <Text style={styles.dataSourceItem}>
                      🎰 Actual casino spend: {formatCurrency((calculation as any).actualData.actualCasinoSpend)}
                    </Text>
                  )}
                  {!(calculation as any).actualData.hasReceiptData &&
                    !(calculation as any).actualData.hasStatementData && (
                      <Text style={styles.dataSourceItem}>
                        ⚠️ Upload receipts/statements for accurate calculations
                      </Text>
                    )}
                </View>
              </View>
            )}

            <View style={styles.resultsSection}>
              <Text style={styles.sectionTitle}>📊 Key Metrics</Text>

              <View style={styles.metricsGrid}>
                <View style={styles.metricCard}>
                  <TrendingUp size={24} color="#22C55E" />
                  <Text style={styles.metricNumber}>
                    {calculation.financial.roi.toFixed(1)}%
                  </Text>
                  <Text style={styles.metricLabel}>ROI</Text>
                </View>
                <View style={styles.metricCard}>
                  <DollarSign size={24} color="#3B82F6" />
                  <Text style={styles.metricNumber}>
                    {formatCurrency(calculation.financial.totalValue)}
                  </Text>
                  <Text style={styles.metricLabel}>Total Value</Text>
                </View>
                <View style={styles.metricCard}>
                  <Target size={24} color="#F59E0B" />
                  <Text style={styles.metricNumber}>
                    {formatCurrency(calculation.financial.totalOutOfPocket)}
                  </Text>
                  <Text style={styles.metricLabel}>Total Out of Pocket</Text>
                </View>
                <View style={styles.metricCard}>
                  <Zap size={24} color="#8B5CF6" />
                  <Text style={styles.metricNumber}>
                    ${calculation.financial.valuePerPoint.toFixed(2)}
                  </Text>
                  <Text style={styles.metricLabel}>Value/Point</Text>
                </View>
              </View>
            </View>

            <View style={styles.riskSection}>
              <Text style={styles.sectionTitle}>⚖️ Risk Assessment</Text>

              <View style={styles.riskCard}>
                <View style={styles.riskHeader}>
                  {getRiskIcon(calculation.analysis.riskLevel)}
                  <Text
                    style={[
                      styles.riskLevel,
                      { color: getRiskColor(calculation.analysis.riskLevel) },
                    ]}
                  >
                    {calculation.analysis.riskLevel.toUpperCase()} RISK
                  </Text>
                </View>

                <View style={styles.riskMetrics}>
                  <View style={styles.riskMetric}>
                    <Text style={styles.riskMetricLabel}>Cost per Point</Text>
                    <Text style={styles.riskMetricValue}>
                      ${calculation.financial.costPerPoint.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.riskMetric}>
                    <Text style={styles.riskMetricLabel}>Break-even Points</Text>
                    <Text style={styles.riskMetricValue}>
                      {calculation.financial.breakEvenPoints.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.riskMetric}>
                    <Text style={styles.riskMetricLabel}>Profit Margin</Text>
                    <Text style={styles.riskMetricValue}>
                      {calculation.financial.profitMargin.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {(calculation as any).actualData &&
              (calculation as any).actualData.spendingBreakdown &&
              Object.keys((calculation as any).actualData.spendingBreakdown).length > 0 && (
                <View style={styles.spendingBreakdownSection}>
                  <Text style={styles.sectionTitle}>💳 Actual Spending by Category</Text>

                  <View style={styles.spendingGrid}>
                    {Object.entries((calculation as any).actualData.spendingBreakdown).map(
                      ([category, amount]) => (
                        <View key={category} style={styles.spendingItem}>
                          <Text style={styles.spendingCategory}>
                            {category.replace("_", " ").toUpperCase()}
                          </Text>
                          <Text style={styles.spendingAmount}>
                            {formatCurrency(amount as number)}
                          </Text>
                        </View>
                      )
                    )}
                  </View>
                </View>
              )}

            <View style={styles.breakdownSection}>
              <Text style={styles.sectionTitle}>💰 Financial Breakdown</Text>

              <View style={styles.breakdownGrid}>
                <View style={styles.breakdownCategory}>
                  <Text style={styles.breakdownCategoryTitle}>Costs</Text>
                  <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>Coin-In Required</Text>
                    <Text style={styles.breakdownValue}>
                      {formatCurrency(calculation.breakdown.coinIn)}
                    </Text>
                  </View>
                  <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>Travel Cost</Text>
                    <Text style={styles.breakdownValue}>
                      {formatCurrency(calculation.breakdown.travelCost)}
                    </Text>
                  </View>
                  <View style={[styles.breakdownItem, styles.breakdownTotal]}>
                    <Text style={styles.breakdownTotalLabel}>Total Out of Pocket</Text>
                    <Text style={styles.breakdownTotalValue}>
                      {formatCurrency(calculation.financial.totalOutOfPocket)}
                    </Text>
                  </View>
                </View>

                <View style={styles.breakdownCategory}>
                  <Text style={styles.breakdownCategoryTitle}>Value</Text>
                  <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>Cruise Savings</Text>
                    <Text style={styles.breakdownValue}>
                      {formatCurrency(calculation.breakdown.savings)}
                    </Text>
                  </View>
                  <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>Free Play</Text>
                    <Text style={styles.breakdownValue}>
                      {formatCurrency(calculation.breakdown.freePlay)}
                    </Text>
                  </View>
                  <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>Perks Value</Text>
                    <Text style={styles.breakdownValue}>
                      {formatCurrency(calculation.breakdown.perks)}
                    </Text>
                  </View>
                  <View style={[styles.breakdownItem, styles.breakdownTotal]}>
                    <Text style={styles.breakdownTotalLabel}>Total Value</Text>
                    <Text style={styles.breakdownTotalValue}>
                      {formatCurrency(calculation.financial.totalValue)}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.netSavingsCard}>
                <Text style={styles.netSavingsLabel}>Net Savings</Text>
                <Text
                  style={[
                    styles.netSavingsValue,
                    { color: calculation.financial.netSavings >= 0 ? "#22C55E" : "#EF4444" },
                  ]}
                >
                  {formatCurrency(calculation.financial.netSavings)}
                </Text>
              </View>
            </View>

            <View style={styles.scenarioSection}>
              <Text style={styles.sectionTitle}>📈 Scenario Analysis</Text>

              {Object.entries(calculation.analysis.scenarios).map(([key, scenario]) => (
                <View key={key} style={styles.scenarioCard}>
                  <Text style={styles.scenarioTitle}>{scenario.description}</Text>
                  <View style={styles.scenarioMetrics}>
                    <View style={styles.scenarioMetric}>
                      <Text style={styles.scenarioMetricLabel}>ROI</Text>
                      <Text
                        style={[
                          styles.scenarioMetricValue,
                          { color: scenario.roi >= 0 ? "#22C55E" : "#EF4444" },
                        ]}
                      >
                        {scenario.roi.toFixed(1)}%
                      </Text>
                    </View>
                    <View style={styles.scenarioMetric}>
                      <Text style={styles.scenarioMetricLabel}>Total Value</Text>
                      <Text style={styles.scenarioMetricValue}>
                        {formatCurrency(scenario.totalValue)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>🚢 Cruise & Offer Details</Text>

              <View style={styles.detailsCard}>
                <Text style={styles.detailsTitle}>{calculation.cruise.ship}</Text>
                <Text style={styles.detailsSubtitle}>{calculation.cruise.itinerary}</Text>
                <Text style={styles.detailsInfo}>
                  {formatDate(calculation.cruise.departureDate)} • {calculation.cruise.nights} nights • {calculation.cruise.cabinType}
                </Text>

                {calculation.offer && (
                  <View style={styles.offerDetails}>
                    <Text style={styles.offerTitle}>Casino Offer: {calculation.offer.code}</Text>
                    <Text style={styles.offerInfo}>{calculation.offer.name}</Text>
                    <Text style={styles.offerExpiry}>
                      Expires: {formatDate(calculation.offer.expires)}
                    </Text>
                  </View>
                )}

                <View style={styles.payTableInfo}>
                  <Text style={styles.payTableTitle}>Pay Table Entry</Text>
                  <Text style={styles.payTableReward}>{calculation.payTableEntry.reward}</Text>
                  <Text style={styles.payTableBonus}>{calculation.payTableEntry.nextCruiseBonus}</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  inputSection: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  cruiseSelector: {
    gap: 8,
  },
  cruiseOption: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cruiseOptionSelected: {
    backgroundColor: "#EEF2FF",
    borderColor: "#6366F1",
  },
  cruiseOptionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  cruiseOptionTextSelected: {
    color: "#6366F1",
  },
  cruiseOptionSubtext: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  noCruisesText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    padding: 16,
  },
  cabinTypeSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cabinTypeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cabinTypeButtonSelected: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
  },
  cabinTypeButtonText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  cabinTypeButtonTextSelected: {
    color: "#FFFFFF",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#FFFFFF",
  },
  calculateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6366F1",
    borderRadius: 8,
    padding: 16,
    gap: 8,
    marginTop: 8,
  },
  calculateButtonDisabled: {
    backgroundColor: "#9CA3AF",
    opacity: 0.6,
  },
  calculateButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  resultsSection: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  metricNumber: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginTop: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
  },
  riskSection: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  riskCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 16,
  },
  riskHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  riskLevel: {
    fontSize: 16,
    fontWeight: "700",
  },
  riskMetrics: {
    flexDirection: "row",
    gap: 16,
  },
  riskMetric: {
    flex: 1,
  },
  riskMetricLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
  },
  riskMetricValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  recommendationsSection: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  recommendationItem: {
    backgroundColor: "#F0F9FF",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  recommendationText: {
    fontSize: 14,
    color: "#0369A1",
  },
  breakdownSection: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  breakdownGrid: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
  },
  breakdownCategory: {
    flex: 1,
  },
  breakdownCategoryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  breakdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  breakdownLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  breakdownValue: {
    fontSize: 12,
    fontWeight: "500",
    color: "#111827",
  },
  breakdownTotal: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    marginTop: 8,
    paddingTop: 8,
  },
  breakdownTotalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  breakdownTotalValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  netSavingsCard: {
    backgroundColor: "#F0FDF4",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  netSavingsLabel: {
    fontSize: 14,
    color: "#166534",
    marginBottom: 4,
  },
  netSavingsValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  scenarioSection: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  scenarioCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  scenarioTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  scenarioMetrics: {
    flexDirection: "row",
    gap: 16,
  },
  scenarioMetric: {
    flex: 1,
  },
  scenarioMetricLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
  },
  scenarioMetricValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  detailsSection: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  detailsCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 16,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  detailsSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
  detailsInfo: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 8,
  },
  offerDetails: {
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  offerTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#92400E",
  },
  offerInfo: {
    fontSize: 12,
    color: "#92400E",
    marginTop: 2,
  },
  offerExpiry: {
    fontSize: 11,
    color: "#92400E",
    marginTop: 4,
  },
  payTableInfo: {
    backgroundColor: "#EEF2FF",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  payTableTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3730A3",
  },
  payTableReward: {
    fontSize: 12,
    color: "#3730A3",
    marginTop: 2,
  },
  payTableBonus: {
    fontSize: 11,
    color: "#3730A3",
    marginTop: 4,
  },
  dataSourceSection: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  dataSourceInfo: {
    gap: 8,
  },
  dataSourceItem: {
    fontSize: 14,
    color: "#374151",
    paddingVertical: 2,
  },
  spendingBreakdownSection: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  spendingGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  spendingItem: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  spendingCategory: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    textAlign: "center",
  },
  spendingAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginTop: 4,
  },
  webPricingButton: {
    backgroundColor: "#10B981",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  webPricingButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  webPricingButtonDisabled: {
    backgroundColor: "#9CA3AF",
    opacity: 0.6,
  },
});