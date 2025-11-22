import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { router } from 'expo-router';

import { trpc } from '@/lib/trpc';
import { useAppState } from '@/state/AppStateProvider';
import { useCruiseStore } from '@/state/CruiseStore';
import { useUser } from '@/state/UserProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { GradientButton } from '@/components/ui/GradientButton';
import { ThemedCard } from '@/components/ui/ThemedCard';
import { HeroHeaderCompact } from '@/components/HeroHeaderCompact';
import { COLORS } from '@/constants/theme';
import { getTierByPoints } from '@/constants/clubRoyaleTiers';
import { getCrownAnchorLevel } from '@/constants/crownAnchor';


export default function SettingsScreen() {
  const [isUploading, setIsUploading] = React.useState<boolean>(false);
  const [isFetchingPricing, setIsFetchingPricing] = React.useState<boolean>(false);
  const [pricingProgress, setPricingProgress] = React.useState<{ current: number; total: number; verified: number }>({ current: 0, total: 0, verified: 0 });

  const { localData, refreshLocalData, addPoints, userPoints } = useAppState();
  const { currentUserId } = useUser();
  const { cruises: storedCruises, reload: reloadCruiseStore } = useCruiseStore();
  const { addUser } = useUser();
  const [showAddPointsModal, setShowAddPointsModal] = React.useState<boolean>(false);
  const [showAddUserModal, setShowAddUserModal] = React.useState<boolean>(false);
  const [showClubRoyaleModal, setShowClubRoyaleModal] = React.useState<boolean>(false);
  const [pointsInput, setPointsInput] = React.useState<string>('');
  const [newUserName, setNewUserName] = React.useState<string>('');
  const [isForceReloading, setIsForceReloading] = React.useState<boolean>(false);
  const [verifyStatus, setVerifyStatus] = React.useState<string>('');
  const [verifyPercent, setVerifyPercent] = React.useState<number>(0);
  const queryClient = useQueryClient();

  const [userProfile, setUserProfile] = React.useState<{
    name: string;
    crownAnchorNumber: string;
    clubRoyalePoints: string;
    loyaltyPoints: string;
  }>({ name: '', crownAnchorNumber: '', clubRoyalePoints: '0', loyaltyPoints: '0' });
  const [isEditingProfile, setIsEditingProfile] = React.useState<boolean>(false);

  const backupCreate = trpc.backup.create.useMutation();
  const backupRestore = trpc.backup.restore.useMutation();
  const backupsQuery = trpc.backup.list.useQuery(undefined, { staleTime: 1000 * 30 });
  const batchFetchPricing = trpc.cruises.batchFetchWebPricing.useMutation();

  React.useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const userKey = currentUserId || 'owner';
        const key = `${userKey}:@user_profile`;
        console.log('[Settings] Loading user profile from key:', key);
        
        const stored = await AsyncStorage.getItem(key);
        if (stored) {
          const profile = JSON.parse(stored);
          console.log('[Settings] ✅ Loaded user profile:', profile);
          setUserProfile(profile);
        } else {
          console.log('[Settings] No user profile found for user:', userKey);
        }
      } catch (error) {
        console.error('[Settings] Failed to load user profile:', error);
      }
    };
    loadUserProfile();
  }, [currentUserId]);



  const handleSaveSnapshot = async () => {
    console.log('[Settings] Save Snapshot pressed');
    try {
      const res = await backupCreate.mutateAsync({ name: 'Manual Snapshot', description: 'Created from Settings', persistToDisk: true });
      if (res.success) {
        await backupsQuery.refetch();
        Alert.alert('Snapshot Saved', `ID: ${res.backupId}\nCruises: ${res.stats?.cruises ?? 0}\nOffers: ${res.stats?.offers ?? 0}\nFinancial rows: ${res.stats?.financials ?? 0}`);
      } else {
        Alert.alert('Snapshot Failed', 'Could not create snapshot');
      }
    } catch (e: any) {
      Alert.alert('Snapshot Failed', e?.message ?? 'Unknown error');
    }
  };

  const handleLoadSnapshot = async () => {
    console.log('[Settings] Load Snapshot pressed');
    try {
      const list = backupsQuery.data?.backups ?? [];
      if (list.length === 0) {
        Alert.alert('No Snapshots', 'No backups found yet. Save a snapshot first.');
        return;
      }
      const latest = list[0];
      Alert.alert(
        'Restore Snapshot',
        `Restore "${latest.name}" from ${new Date(latest.timestamp).toLocaleString()}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              try {
                const res = await backupRestore.mutateAsync({ backupId: latest.id });
                if (res.success) {
                  await queryClient.invalidateQueries();
                  await refreshLocalData();
                  await reloadCruiseStore();
                  console.log('[Settings] Reloaded CruiseStore after restore');
                  Alert.alert('Restored', res.message ?? 'Snapshot restored');
                } else {
                  Alert.alert('Restore Failed', res.error ?? 'Unknown error');
                }
              } catch (err: any) {
                Alert.alert('Restore Error', err?.message ?? 'Unknown error');
              }
            },
          },
        ]
      );
    } catch (e: any) {
      Alert.alert('Load Failed', e?.message ?? 'Unknown error');
    }
  };

  const handleBatchFetchPricing = async () => {
    console.log('[Settings] GET ALL CURRENT PRICING pressed');
    try {
      setIsFetchingPricing(true);
      
      const bookedCruises = localData.booked.filter(c => !(c as any).verified);
      const completedCruises = localData.cruises.filter(c => (c as any).status === 'completed' && !(c as any).verified);
      const smartCruises = localData.cruises.filter(c => (c as any).isSmart && !(c as any).verified && (c as any).status !== 'completed');
      const availableCruises = localData.cruises.filter(c => !(c as any).isSmart && !(c as any).verified && (c as any).status !== 'completed');
      
      const orderedCruises = [
        ...bookedCruises,
        ...completedCruises,
        ...smartCruises,
        ...availableCruises,
      ];
      
      if (orderedCruises.length === 0) {
        Alert.alert('All Verified', 'All cruises already have verified pricing and itineraries.');
        setIsFetchingPricing(false);
        return;
      }
      
      setPricingProgress({ current: 0, total: orderedCruises.length, verified: 0 });
      
      Alert.alert(
        'GET ALL CURRENT PRICING',
        `Fetch current pricing and itineraries for ${orderedCruises.length} unverified cruises?\n\nOrder: Booked (${bookedCruises.length}) → Completed (${completedCruises.length}) → Smart (${smartCruises.length}) → Available (${availableCruises.length})\n\nThis will take approximately ${Math.ceil(orderedCruises.length * 2 / 60)} minutes.\n\nSource: Gangwaze.com (primary), then CruiseCritic, Cruises.com, CruiseAway, and Expedia.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setIsFetchingPricing(false) },
          {
            text: 'Start',
            onPress: async () => {
              try {
                const cruiseIds = orderedCruises.map(c => c.id);
                let verifiedCount = 0;
                
                for (let i = 0; i < cruiseIds.length; i++) {
                  const cruiseId = cruiseIds[i];
                  
                  try {
                    const input = {
                      cruiseIds: [cruiseId] as string[],
                      fetchItinerary: true,
                      limit: 1,
                    };
                    const result = await batchFetchPricing.mutateAsync(input);
                    
                    if ((result as any)?.successCount > 0) {
                      verifiedCount++;
                    }
                    
                    setPricingProgress({
                      current: i + 1,
                      total: cruiseIds.length,
                      verified: verifiedCount,
                    });
                  } catch (err: any) {
                    console.error(`[Settings] Failed to fetch pricing for cruise ${cruiseId}:`, err);
                  }
                  
                  await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
                await queryClient.invalidateQueries();
                await refreshLocalData();
                
                Alert.alert(
                  'Complete',
                  `Successfully verified ${verifiedCount} out of ${cruiseIds.length} cruises.`
                );
              } catch (err: any) {
                Alert.alert('Fetch Error', err?.message ?? 'Unknown error');
              } finally {
                setIsFetchingPricing(false);
                setPricingProgress({ current: 0, total: 0, verified: 0 });
              }
            },
          },
        ]
      );
    } catch (e: any) {
      Alert.alert('Fetch Failed', e?.message ?? 'Unknown error');
      setIsFetchingPricing(false);
    }
  };

  const handleClearAllData = React.useCallback(async () => {
    try {
      setIsUploading(true);
      console.log('[Settings] Starting data clear (preserving financials and user profile)...');

      const allKeys = await AsyncStorage.getAllKeys();
      console.log(`[Settings] Found ${allKeys.length} AsyncStorage keys`);
      
      const keysToPreserve = [
        '@local_financials',
        '@local_userProfile',
        '@club_royale_profile',
        '@user_points',
        '@loyalty_points',
        '@app_settings',
        '@local_cruises',
        '@local_booked',
        '@local_offers',
        '@local_calendar',
        '@local_tripit',
        '@local_last_import',
      ];
      
      const shouldPreserve = (key: string) => {
        if (keysToPreserve.includes(key)) return true;
        return keysToPreserve.some(base => key.includes(base));
      };
      
      const keysToRemove = allKeys.filter(key => !shouldPreserve(key));
      console.log(`[Settings] Removing ${keysToRemove.length} keys, preserving pattern-matched local data keys`);
      
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        console.log(`[Settings] ✅ Cleared ${keysToRemove.length} AsyncStorage keys`);
      }

      try {
        const { trpcClient } = await import('@/lib/trpc');
        console.log('[Settings] Clearing backend memory store...');
        
        // Call the backend clearAllData method directly
        await trpcClient.import.clearBackendData.mutate();
        
        console.log('[Settings] ✅ Backend memory store cleared');
      } catch (backendError) {
        console.warn('[Settings] Backend clear failed (continuing):', backendError);
      }

      try {
        await queryClient.clear();
        console.log('[Settings] ✅ React Query cache cleared');
      } catch (queryError) {
        console.warn('[Settings] Query clear failed (continuing):', queryError);
      }

      await refreshLocalData();
      console.log('[Settings] ✅ Local data state refreshed');

      await new Promise((r) => setTimeout(r, 200));

      if (Platform.OS === 'web') {
        console.log('[Settings] Cleared!');
      }

      Alert.alert('Cleared!', 'Cruise, booked, offers, calendar, and TripIt data has been cleared. Financials and user profile data preserved.');
    } catch (error: any) {
      console.error('[Settings] CRITICAL: Failed to clear app data:', error);
      Alert.alert('Clear Failed', error?.message ?? 'Unknown error');
    } finally {
      setIsUploading(false);
    }
  }, [queryClient, refreshLocalData]);

  const handleAddPoints = React.useCallback(async () => {
    const points = parseInt(pointsInput, 10);
    if (isNaN(points) || points <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid positive number');
      return;
    }
    try {
      await addPoints(points);
      setPointsInput('');
      setShowAddPointsModal(false);
      Alert.alert('Success', `Added ${points.toLocaleString()} points to your total`);
    } catch (error) {
      console.error('[Settings] Failed to add points:', error);
      Alert.alert('Error', 'Failed to add points. Please try again.');
    }
  }, [pointsInput, addPoints]);

  const handleAddUser = React.useCallback(async () => {
    if (!newUserName.trim()) {
      Alert.alert('Invalid Input', 'Please enter a name for the new user');
      return;
    }
    try {
      const newUser = await addUser({ name: newUserName.trim() });
      setNewUserName('');
      setShowAddUserModal(false);
      Alert.alert('Success', `Added user "${newUser.name}"`);
    } catch (error) {
      console.error('[Settings] Failed to add user:', error);
      Alert.alert('Error', 'Failed to add user. Please try again.');
    }
  }, [newUserName, addUser]);

  const handleVerifyAllData = React.useCallback(async () => {
    console.log('[Settings] VERIFY ALL DATA pressed');
    
    Alert.alert(
      'Verify All Data',
      'Run comprehensive verification across cruises, booked cruises, and casino offers. This will not delete data. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Verify',
          onPress: async () => {
            try {
              setIsForceReloading(true);
              setVerifyStatus('Initializing...');
              setVerifyPercent(0.1);
              try {
                setVerifyStatus('Verifying cruises...');
                setVerifyPercent(0.35);
                const { trpcClient } = await import('@/lib/trpc');
                const result = await trpcClient.cruises.verifyData.query();
                setVerifyStatus('Refreshing caches...');
                setVerifyPercent(0.7);
                await queryClient.invalidateQueries();
                await refreshLocalData();
                await reloadCruiseStore();
                setVerifyStatus('Finalizing...');
                setVerifyPercent(0.9);
                const summary =
                  `Cruises: ${result.totalCruises}\n` +
                  `Booked: ${result.totalBookedCruises}\n` +
                  `Offers: ${result.totalOffers}\n` +
                  `Valid: ${result.validCruises}\n` +
                  `Linked: ${result.linkedCruises}\n` +
                  `Issues: ${result.totalIssues}\n` +
                  (result.validationIssues?.length ? `\nFirst issues:\n- ${result.validationIssues.map(i => `${i.ship}: ${i.issues[0]}`).join('\n- ')}` : '');
                setVerifyPercent(1);
                setVerifyStatus('Complete');
                Alert.alert('Verification Complete', summary);
              } catch (e:any) {
                console.error('[Settings] Verify error:', e);
                setVerifyStatus('Failed');
                setVerifyPercent(0);
                Alert.alert('Verify Failed', e?.message ?? 'Unknown error');
              }
            } catch (error: any) {
              console.error('[Settings] Verify all data error:', error);
              setVerifyStatus('Failed');
              setVerifyPercent(0);
              Alert.alert('Verification Failed', error?.message || 'Unknown error');
            } finally {
              setTimeout(() => {
                setIsForceReloading(false);
                setVerifyStatus('');
                setVerifyPercent(0);
              }, 400);
            }
          },
        },
      ]
    );
  }, [queryClient, refreshLocalData, reloadCruiseStore]);

  const handleResetAccount = React.useCallback(async () => {
    Alert.alert(
      'Reset Account',
      'This will delete all cruises, events, booked cruises, and analytics data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsUploading(true);
              console.log('[Settings] Resetting account...');

              const keysToRemove = [
                '@local_cruises',
                '@local_booked',
                '@local_offers',
                '@local_calendar',
                '@local_tripit',
                '@local_financials',
                '@user_points',
                '@loyalty_points',
              ];

              await AsyncStorage.multiRemove(keysToRemove);
              console.log('[Settings] ✅ Account data cleared');

              try {
                const { trpcClient } = await import('@/lib/trpc');
                await trpcClient.import.clearBackendData.mutate();
                console.log('[Settings] ✅ Backend cleared');
              } catch (backendError) {
                console.warn('[Settings] Backend clear failed:', backendError);
              }

              await queryClient.clear();
              await refreshLocalData();
              await reloadCruiseStore();

              Alert.alert('Reset Complete', 'Your account has been reset to zero.');
            } catch (error: any) {
              console.error('[Settings] Failed to reset account:', error);
              Alert.alert('Reset Failed', error?.message ?? 'Unknown error');
            } finally {
              setIsUploading(false);
            }
          },
        },
      ]
    );
  }, [queryClient, refreshLocalData, reloadCruiseStore]);

  const handleSaveProfile = React.useCallback(async () => {
    try {
      const userKey = currentUserId || 'owner';
      const key = `${userKey}:@user_profile`;
      
      console.log('[Settings] Saving user profile to key:', key, userProfile);
      await AsyncStorage.setItem(key, JSON.stringify(userProfile));
      
      // Verify persistence
      const verify = await AsyncStorage.getItem(key);
      if (verify) {
        const parsed = JSON.parse(verify);
        console.log('[Settings] ✅ Verified user profile persistence:', parsed);
      } else {
        console.error('[Settings] ❌ User profile verification failed');
      }
      
      setIsEditingProfile(false);
      Alert.alert('Saved', 'Profile saved successfully');
    } catch (error) {
      console.error('[Settings] Failed to save profile:', error);
      Alert.alert('Error', 'Failed to save profile');
    }
  }, [userProfile, currentUserId]);



  return (
    <ScrollView style={styles.container} testID="settings-screen">
      <HeroHeaderCompact totalCruises={storedCruises.length} />

      <View style={styles.section}>
        <ThemedCard variant="oceanicElevated">
          <Text style={styles.sectionTitle}>Data Overview</Text>
          <View style={styles.miniStats}>
            <View style={styles.miniStatItem}>
              <Text style={styles.miniStatNumber}>{storedCruises.length}</Text>
              <Text style={styles.miniStatLabel}>cruises</Text>
            </View>
            <View style={styles.miniStatItem}>
              <Text style={styles.miniStatNumber}>{localData.booked.length}</Text>
              <Text style={styles.miniStatLabel}>booked</Text>
            </View>
            <View style={styles.miniStatItem}>
              <Text style={styles.miniStatNumber}>{localData.offers.length}</Text>
              <Text style={styles.miniStatLabel}>offers</Text>
            </View>
            <View style={styles.miniStatItem}>
              <Text style={styles.miniStatNumber}>{localData.calendar.length}</Text>
              <Text style={styles.miniStatLabel}>events</Text>
            </View>
          </View>

          {isFetchingPricing && pricingProgress.total > 0 && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${(pricingProgress.current / pricingProgress.total) * 100}%` }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>
                {pricingProgress.current} / {pricingProgress.total} cruises processed
              </Text>
              <Text style={styles.progressText}>
                ✓ {pricingProgress.verified} verified
              </Text>
            </View>
          )}
          
          <GradientButton 
            title="OPEN CLUB ROYALE" 
            onPress={() => setShowClubRoyaleModal(true)} 
            variant="royal" 
            testID="open-club-royale-button"
            style={{ marginTop: 16 }}
          />
        </ThemedCard>
      </View>

      <View style={styles.section}>
        <ThemedCard variant="oceanic">
          <Text style={styles.sectionTitle}>Data Actions</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/import')} testID="import-data-button">
              <View style={styles.actionIconContainer}>
                <Text style={styles.refreshIcon}>📥</Text>
              </View>
              <Text style={styles.actionButtonText}>Import</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => setShowAddPointsModal(true)} testID="add-club-royale-points-button">
              <View style={styles.actionIconContainer}>
                <Text style={styles.refreshIcon}>➕</Text>
              </View>
              <Text style={styles.actionButtonText}>CR Points</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleVerifyAllData} disabled={isForceReloading} testID="verify-all-data-button">
              <View style={styles.actionIconContainer}>
                <Text style={styles.refreshIcon}>✓</Text>
              </View>
              <Text style={styles.actionButtonText}>Verify</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.helperText}>Current total: {userPoints.toLocaleString()} points</Text>
          <Text style={styles.helperText}>Runs verification across cruises, booked cruises, and offers. No data is deleted.</Text>
        </ThemedCard>
      </View>

      <View style={styles.section}>
        <ThemedCard variant="oceanic">
          <Text style={styles.sectionTitle}>User Management</Text>
          
          <GradientButton 
            title="RESET ACCOUNT" 
            onPress={handleResetAccount} 
            variant="danger" 
            testID="reset-account-button"
            style={{ marginBottom: 20 }}
          />
          
          <Text style={styles.profileSectionTitle}>User Profile</Text>
          
          <View style={styles.currentValuesContainer}>
            <Text style={styles.currentValuesTitle}>Current Values</Text>
            <View style={styles.currentValueRow}>
              <Text style={styles.currentValueLabel}>Name:</Text>
              <Text style={styles.currentValue}>{userProfile.name || 'Not set'}</Text>
            </View>
            <View style={styles.currentValueRow}>
              <Text style={styles.currentValueLabel}>C&A #:</Text>
              <Text style={styles.currentValue}>{userProfile.crownAnchorNumber || 'Not set'}</Text>
            </View>
            <View style={styles.currentValueRow}>
              <Text style={styles.currentValueLabel}>Club Royale Points:</Text>
              <Text style={styles.currentValue}>{userProfile.clubRoyalePoints ? parseInt(userProfile.clubRoyalePoints).toLocaleString() : '0'}</Text>
            </View>
            <View style={styles.currentValueRow}>
              <Text style={styles.currentValueLabel}>Club Royale Tier:</Text>
              <Text style={[styles.currentValue, { color: getTierByPoints(parseInt(userProfile.clubRoyalePoints || '0')).color }]}>
                {getTierByPoints(parseInt(userProfile.clubRoyalePoints || '0')).name}
              </Text>
            </View>
            <View style={styles.currentValueRow}>
              <Text style={styles.currentValueLabel}>Loyalty Points:</Text>
              <Text style={styles.currentValue}>{userProfile.loyaltyPoints ? parseInt(userProfile.loyaltyPoints).toLocaleString() : '0'}</Text>
            </View>
            <View style={styles.currentValueRow}>
              <Text style={styles.currentValueLabel}>Crown & Anchor Level:</Text>
              <Text style={[styles.currentValue, { color: getCrownAnchorLevel(parseInt(userProfile.loyaltyPoints || '0')).color }]}>
                {getCrownAnchorLevel(parseInt(userProfile.loyaltyPoints || '0')).name}
              </Text>
            </View>
          </View>
          
          <View style={styles.profileField}>
            <Text style={styles.profileLabel}>Name</Text>
            <TextInput
              style={styles.profileInput}
              value={userProfile.name}
              onChangeText={(text) => setUserProfile({ ...userProfile, name: text })}
              placeholder="Enter your name"
              editable={isEditingProfile}
            />
          </View>
          
          <View style={styles.profileField}>
            <Text style={styles.profileLabel}>Crown & Anchor #</Text>
            <TextInput
              style={styles.profileInput}
              value={userProfile.crownAnchorNumber}
              onChangeText={(text) => setUserProfile({ ...userProfile, crownAnchorNumber: text })}
              placeholder="Enter Crown & Anchor number"
              editable={isEditingProfile}
            />
          </View>
          
          <View style={styles.profileField}>
            <Text style={styles.profileLabel}>Current Club Royale Points</Text>
            <TextInput
              style={styles.profileInput}
              value={userProfile.clubRoyalePoints}
              onChangeText={(text) => setUserProfile({ ...userProfile, clubRoyalePoints: text })}
              placeholder="0"
              keyboardType="numeric"
              editable={isEditingProfile}
            />
          </View>
          
          <View style={styles.profileField}>
            <Text style={styles.profileLabel}>Current Loyalty Points</Text>
            <TextInput
              style={styles.profileInput}
              value={userProfile.loyaltyPoints}
              onChangeText={(text) => setUserProfile({ ...userProfile, loyaltyPoints: text })}
              placeholder="0"
              keyboardType="numeric"
              editable={isEditingProfile}
            />
          </View>
          
          {!isEditingProfile ? (
            <GradientButton 
              title="Edit Profile" 
              onPress={() => setIsEditingProfile(true)} 
              variant="royalOutline" 
              testID="edit-profile-button"
            />
          ) : (
            <View style={styles.profileActions}>
              <TouchableOpacity 
                style={[styles.profileActionButton, styles.profileActionCancel]}
                onPress={() => setIsEditingProfile(false)}
              >
                <Text style={styles.profileActionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.profileActionButton, styles.profileActionSave]}
                onPress={handleSaveProfile}
              >
                <Text style={[styles.profileActionText, { color: '#FFFFFF' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          )}
        </ThemedCard>
      </View>

      <View style={styles.section}>
        <ThemedCard variant="oceanic">
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity style={styles.actionButton} onPress={handleSaveSnapshot} testID="qa-save-snapshot">
              <View style={styles.actionIconContainer}>
                <Text style={styles.refreshIcon}>💾</Text>
              </View>
              <Text style={styles.actionButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleLoadSnapshot} testID="qa-load-snapshot">
              <View style={styles.actionIconContainer}>
                <Text style={styles.refreshIcon}>📂</Text>
              </View>
              <Text style={styles.actionButtonText}>Load</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleBatchFetchPricing} disabled={isFetchingPricing} testID="qa-verify-pricing">
              <View style={styles.actionIconContainer}>
                <Text style={styles.refreshIcon}>💲</Text>
              </View>
              <Text style={styles.actionButtonText}>Pricing</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/backend-diagnostic')} testID="qa-backend">
              <View style={styles.actionIconContainer}>
                <Text style={styles.refreshIcon}>🔧</Text>
              </View>
              <Text style={styles.actionButtonText}>Backend</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/connection-status')} testID="qa-connection">
              <View style={styles.actionIconContainer}>
                <Text style={styles.refreshIcon}>🔌</Text>
              </View>
              <Text style={styles.actionButtonText}>Status</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleClearAllData} disabled={isUploading} testID="qa-clear">
              <View style={styles.actionIconContainer}>
                <Text style={styles.refreshIcon}>🗑️</Text>
              </View>
              <Text style={styles.actionButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </ThemedCard>
      </View>

      {isForceReloading && (
        <View style={styles.verifyOverlay} testID="verify-progress-overlay">
          <View style={styles.verifyCard}>
            <Text style={styles.verifyTitle}>Verifying All Data</Text>
            <Text style={styles.verifyMessage}>{verifyStatus || 'Working...'}</Text>
            <View style={styles.verifyBar}>
              <View style={[styles.verifyFill, { width: `${Math.max(5, Math.min(100, Math.round(verifyPercent * 100)))}%` }]} />
            </View>
            <ActivityIndicator size="small" color="#10B981" style={{ marginTop: 8 }} />
          </View>
        </View>
      )}

      <Modal
        visible={showAddPointsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddPointsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Points</Text>
              <TouchableOpacity onPress={() => setShowAddPointsModal(false)} style={styles.modalCloseButton}>
                <Text>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDescription}>Current total: {userPoints.toLocaleString()} points</Text>
            <TextInput
              style={styles.pointsInput}
              value={pointsInput}
              onChangeText={setPointsInput}
              placeholder="Enter points to add"
              keyboardType="numeric"
              autoFocus={true}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => { setPointsInput(''); setShowAddPointsModal(false); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalAddButton} onPress={handleAddPoints}>
                <Text style={styles.modalAddText}>Add Points</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAddUserModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddUserModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add User</Text>
              <TouchableOpacity onPress={() => setShowAddUserModal(false)} style={styles.modalCloseButton}>
                <Text>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDescription}>Enter a name for the new user</Text>
            <TextInput
              style={styles.pointsInput}
              value={newUserName}
              onChangeText={setNewUserName}
              placeholder="User name"
              autoFocus={true}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => { setNewUserName(''); setShowAddUserModal(false); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalAddButton} onPress={handleAddUser}>
                <Text style={styles.modalAddText}>Add User</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showClubRoyaleModal}
        animationType="slide"
        onRequestClose={() => setShowClubRoyaleModal(false)}
      >
        <View style={styles.webViewContainer}>
          <View style={styles.webViewHeader}>
            <Text style={styles.webViewTitle}>Club Royale</Text>
            <TouchableOpacity 
              onPress={() => setShowClubRoyaleModal(false)} 
              style={styles.webViewCloseButton}
            >
              <Text style={styles.webViewCloseText}>✕ Close</Text>
            </TouchableOpacity>
          </View>
          <WebView
            source={{ uri: 'https://www.royalcaribbean.com/club-royale' }}
            style={styles.webView}
          />
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E6F2FF',
  },
  section: {
    backgroundColor: '#F0F8FF',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#B3D9FF',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    minWidth: '30%',
    alignItems: 'center',
    gap: 6,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F5F5DC',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  refreshIcon: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
  },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: '31%',
    marginBottom: 8,
  },
  primarySmall: {
    backgroundColor: COLORS.royalBlue,
  },
  outlineSmall: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.royalBlue,
  },
  dangerSmall: {
    backgroundColor: '#EF4444',
  },
  smallBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  outlineText: {
    color: COLORS.royalBlue,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
    flex: 1,
  },
  fullWidthButton: {
    flex: 0,
    width: '100%',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.royalBlue,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButtonText: {
    color: COLORS.royalBlue,
  },
  helperText: {
    fontSize: 12,
    color: '#FFFFFF',
    lineHeight: 18,
    marginTop: 8,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  progressContainer: {
    marginTop: 12,
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#D1D5DB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.electricAqua,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#000000',
    marginBottom: 4,
  },
  diagnosticCard: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  diagnosticRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  diagnosticName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  diagnosticUrl: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  diagnosticMeta: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
  },
  diagnosticError: {
    fontSize: 11,
    color: '#DC2626',
    textAlign: 'right',
  },
  ok: { color: '#059669' },
  fail: { color: '#DC2626' },

  bookedListContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  bookedListTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  bookedListHeader: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 6,
  },
  bookedListHeaderText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  bookedList: {
    maxHeight: 320,
  },
  bookedRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },

  debugPanel: {
    marginTop: 12,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    padding: 12,
  },
  debugHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#003B6F',
  },
  debugClearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#D1D5DB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B0B5BA',
  },
  debugClearText: {
    color: '#003B6F',
    fontSize: 12,
    fontWeight: '700',
  },
  debugHint: {
    color: '#003B6F',
    fontSize: 11,
    marginBottom: 8,
  },
  debugList: {
    maxHeight: 300,
  },
  debugItem: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
    marginTop: 8,
  },
  debugItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  debugItemTitle: {
    color: '#003B6F',
    fontSize: 13,
    fontWeight: '700',
  },
  debugItemTime: {
    color: '#003B6F',
    fontSize: 11,
  },
  debugJson: {
    color: '#003B6F',
    fontFamily: Platform.select({ web: 'monospace', default: undefined }) as any,
    fontSize: 12,
    lineHeight: 16,
    backgroundColor: '#D1D5DB',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#B0B5BA',
  },
  emptyDebug: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDebugText: {
    color: '#003B6F',
    fontSize: 12,
  },

  bookedShip: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  bookedSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  bookedCategory: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F766E',
    backgroundColor: '#ECFEFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  bookedPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'right',
  },
  bookedSource: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'right',
  },
  emptyBooked: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBookedText: {
    fontSize: 12,
    color: '#6B7280',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalDescription: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 20,
    textAlign: 'center',
  },
  pointsInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F5F5DC',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  modalAddButton: {
    flex: 1,
    backgroundColor: '#10B981',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalAddText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  miniStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5DC',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    gap: 12,
  },
  miniStatItem: {
    alignItems: 'center',
    minWidth: '22%',
    gap: 4,
  },
  miniStat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  miniStatNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  miniStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
  },
  miniStatDivider: {
    fontSize: 16,
    color: '#D1D5DB',
    marginHorizontal: 12,
  },
  userList: {
    marginBottom: 16,
  },
  userItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5DC',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  currentBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currentBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
  },
  userActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#003B6F',
    borderRadius: 8,
  },
  userActionDanger: {
    backgroundColor: '#EF4444',
  },
  userActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userActionDangerText: {
    color: '#FFFFFF',
  },






  verifyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  verifyCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#F5F5DC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  verifyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 6,
    textAlign: 'center',
  },
  verifyMessage: {
    fontSize: 13,
    color: '#000000',
    textAlign: 'center',
    marginBottom: 10,
  },
  verifyBar: {
    height: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  verifyFill: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  profileSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
    marginTop: 8,
  },
  profileField: {
    marginBottom: 16,
  },
  profileLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  profileInput: {
    backgroundColor: '#F5F5DC',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
  },
  profileActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  profileActionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  profileActionCancel: {
    backgroundColor: '#F5F5DC',
    borderColor: '#D1D5DB',
  },
  profileActionSave: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  profileActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  currentValuesContainer: {
    backgroundColor: '#F5F5DC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  currentValuesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#003B6F',
    marginBottom: 12,
    textAlign: 'center',
  },
  currentValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  currentValueLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#003B6F',
  },
  currentValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webViewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#003B6F',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  webViewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  webViewCloseButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  webViewCloseText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#003B6F',
  },
  webView: {
    flex: 1,
  },
});