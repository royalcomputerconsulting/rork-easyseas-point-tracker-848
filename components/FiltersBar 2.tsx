import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Filter as FilterIcon, X } from "lucide-react-native";
import { useFilters } from "@/state/FiltersProvider";

export default function FiltersBar() {
  const { filters, update, clearAll } = useFilters();

  const chips = useMemo(() => {
    const out: Array<{ key: string; label: string }> = [];
    if (filters.cohort === 'last12m') out.push({ key: 'cohort', label: 'Last 12 months' });
    if (filters.cohort === 'custom' && (filters.dateFrom || filters.dateTo)) out.push({ key: 'cohort', label: `${filters.dateFrom ?? '…'} → ${filters.dateTo ?? '…'}` });
    if (filters.ships.length > 0) out.push({ key: 'ships', label: `${filters.ships.length} ship${filters.ships.length>1?'s':''}` });
    if (filters.ports.length > 0) out.push({ key: 'ports', label: `${filters.ports.length} port${filters.ports.length>1?'s':''}` });
    if (filters.cabinTypes.length > 0) out.push({ key: 'cabinTypes', label: filters.cabinTypes.join(', ') });
    if (filters.tags.length > 0) out.push({ key: 'tags', label: `${filters.tags.length} tag${filters.tags.length>1?'s':''}` });
    if (filters.hasReceipts !== null) out.push({ key: 'hasReceipts', label: filters.hasReceipts ? 'Has Receipts' : 'No Receipts' });
    if (filters.hasStatements !== null) out.push({ key: 'hasStatements', label: filters.hasStatements ? 'Has Statements' : 'No Statements' });
    return out;
  }, [filters]);

  const clearKey = (key: string) => {
    if (key === 'cohort') update({ cohort: 'all', dateFrom: null, dateTo: null });
    else if (key === 'ships') update({ ships: [] });
    else if (key === 'ports') update({ ports: [] });
    else if (key === 'cabinTypes') update({ cabinTypes: [] });
    else if (key === 'tags') update({ tags: [] });
    else if (key === 'hasReceipts') update({ hasReceipts: null });
    else if (key === 'hasStatements') update({ hasStatements: null });
  };

  if (chips.length === 0) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.filterButton} testID="filters-add">
          <FilterIcon size={16} color="#6C5CE7" />
          <Text style={styles.filterButtonText}>Add Filters</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="filters-bar"
    >
      {chips.map((chip) => (
        <TouchableOpacity key={chip.key} style={styles.chip} onPress={() => clearKey(chip.key)} testID={`filter-chip-${chip.key}`}>
          <Text style={styles.chipText}>{chip.label}</Text>
          <X size={14} color="#6C5CE7" />
        </TouchableOpacity>
      ))}
      {chips.length > 1 && (
        <TouchableOpacity style={styles.clearButton} onPress={clearAll} testID="filters-clear-all">
          <Text style={styles.clearText}>Clear All</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  content: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    margin: 12,
  },
  filterButtonText: {
    fontSize: 14,
    color: "#6C5CE7",
    fontWeight: "500",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EDE9FE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipText: {
    fontSize: 12,
    color: "#6C5CE7",
    fontWeight: "500",
  },
  clearButton: {
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  clearText: {
    fontSize: 12,
    color: "#EF4444",
    fontWeight: "500",
  },
});