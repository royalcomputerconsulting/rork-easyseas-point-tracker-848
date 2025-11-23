import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { 
  Plus, 
  Search, 
  Calculator, 
  TrendingUp, 
  Calendar, 
  Zap
} from 'lucide-react-native';
import { router } from 'expo-router';

interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  route: string;
  color: string;
  backgroundColor: string;
}

const quickActions: QuickAction[] = [
  {
    id: 'add-cruise',
    title: 'Add Cruise',
    subtitle: 'Book new cruise',
    icon: <Plus size={12} color="#FFFFFF" />,
    route: '/add-cruise',
    color: '#FFFFFF',
    backgroundColor: '#2563EB',
  },
  {
    id: 'roi-calculator',
    title: 'ROI Calculator',
    subtitle: 'Calculate returns',
    icon: <Calculator size={12} color="#FFFFFF" />,
    route: '/roi-calculator',
    color: '#FFFFFF',
    backgroundColor: '#059669',
  },
  {
    id: 'smart-recommendations',
    title: 'Smart Picks',
    subtitle: 'AI recommendations',
    icon: <Zap size={12} color="#FFFFFF" />,
    route: '/smart-recommendations',
    color: '#FFFFFF',
    backgroundColor: '#DC2626',
  },
  {
    id: 'advanced-analytics',
    title: 'Analytics',
    subtitle: 'Performance insights',
    icon: <TrendingUp size={12} color="#FFFFFF" />,
    route: '/advanced-analytics',
    color: '#FFFFFF',
    backgroundColor: '#7C3AED',
  },
  {
    id: 'ai-search',
    title: 'AI Search',
    subtitle: 'Find cruises',
    icon: <Search size={12} color="#FFFFFF" />,
    route: '/ai-search',
    color: '#FFFFFF',
    backgroundColor: '#EA580C',
  },
  {
    id: 'calendar',
    title: 'Calendar',
    subtitle: 'View schedule',
    icon: <Calendar size={12} color="#FFFFFF" />,
    route: '/(tabs)/(calendar)',
    color: '#FFFFFF',
    backgroundColor: '#0891B2',
  },
];

interface QuickActionsProps {
  title?: string;
  showTitle?: boolean;
  maxItems?: number;
}

export default function QuickActions({ 
  title = 'Quick Actions', 
  showTitle = true,
  maxItems 
}: QuickActionsProps) {
  const displayActions = maxItems ? quickActions.slice(0, maxItems) : quickActions;

  const handleActionPress = (route: string) => {
    console.log('Navigating to:', route);
    router.push(route as any);
  };

  return (
    <View style={styles.container}>
      {showTitle && (
        <Text style={styles.title}>{title}</Text>
      )}
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {displayActions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={[
              styles.actionCard,
              { backgroundColor: action.backgroundColor }
            ]}
            onPress={() => handleActionPress(action.route)}
            testID={`quick-action-${action.id}`}
          >
            <View style={styles.iconContainer}>
              {action.icon}
            </View>
            <Text style={[styles.actionTitle, { color: action.color }]}>
              {action.title}
            </Text>
            <Text style={[styles.actionSubtitle, { color: action.color, opacity: 0.8 }]}>
              {action.subtitle}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  title: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 6,
    paddingHorizontal: 16,
  },
  scrollView: {
    paddingLeft: 16,
  },
  scrollContent: {
    paddingRight: 16,
  },
  actionCard: {
    width: 48,
    height: 40,
    borderRadius: 4,
    padding: 4,
    marginRight: 6,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.04,
    shadowRadius: 1,
    elevation: 1,
  },
  iconContainer: {
    alignSelf: 'flex-start',
  },
  actionTitle: {
    fontSize: 8,
    fontWeight: '600' as const,
    marginBottom: 0,
  },
  actionSubtitle: {
    fontSize: 6,
    fontWeight: '400' as const,
  },
});