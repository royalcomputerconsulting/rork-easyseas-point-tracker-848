import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { 
  ArrowLeft,
  CreditCard,
  Upload,

  Hash,
  Calendar,
  Ship,
  MapPin,
  Users,

} from 'lucide-react-native';
import { trpc } from '@/lib/trpc';
import { useAppState } from '@/state/AppStateProvider';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import type { Cruise } from '@/types/models';

type BookingMethod = 'booking_number' | 'offer_code' | 'receipt';

export default function BookCruiseScreen() {
  const params = useLocalSearchParams<{ cruiseId?: string }>();
  const cruiseId = params.cruiseId;
  
  console.log('[BookCruise] URL params:', params);
  console.log('[BookCruise] Cruise ID:', cruiseId);
  const [bookingMethod, setBookingMethod] = React.useState<BookingMethod>('booking_number');
  const [bookingNumber, setBookingNumber] = React.useState<string>('');
  const [offerName, setOfferName] = React.useState<string>('');
  const [offerCode, setOfferCode] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [selectedImages, setSelectedImages] = React.useState<string[]>([]);
  
  console.log('[BookCruise] Booking cruise:', cruiseId);
  
  const { localData, hasLocalData, refreshLocalData } = useAppState();
  
  const cruiseQuery = trpc.cruises.get.useQuery(
    { id: cruiseId! },
    { 
      enabled: !!cruiseId && !hasLocalData,
      retry: 1
    }
  );
  
  // Log cruise query errors
  React.useEffect(() => {
    if (cruiseQuery.error) {
      console.error('[BookCruise] Cruise query error:', cruiseQuery.error);
    }
  }, [cruiseQuery.error]);
  
  const handleImagePicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        base64: true,
      });
      
      if (!result.canceled && result.assets) {
        const imageUris = result.assets.map(asset => asset.uri);
        setSelectedImages(prev => [...prev, ...imageUris]);
      }
    } catch (error) {
      console.error('[BookCruise] Image picker error:', error);
      Alert.alert('Error', 'Failed to select images');
    }
  };
  
  const handleDocumentPicker = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        multiple: true,
      });
      
      if (!result.canceled && result.assets) {
        const documentUris = result.assets.map(asset => asset.uri);
        setSelectedImages(prev => [...prev, ...documentUris]);
      }
    } catch (error) {
      console.error('[BookCruise] Document picker error:', error);
      Alert.alert('Error', 'Failed to select documents');
    }
  };
  
  const utils = trpc.useContext();
  const createBookedCruiseMutation = trpc.bookedCruises.create.useMutation({
    onSuccess: async (result) => {
      console.log('[BookCruise] ✅ Mutation successful, result:', result);
      console.log('[BookCruise] Created booked cruise with ID:', result.id);
      
      // Handle both Cruise and BookedCruise types
      const startDate = 'startDate' in result ? result.startDate : result.departureDate;
      const reservationNumber = 'reservationNumber' in result ? result.reservationNumber : '';
      
      console.log('[BookCruise] Booked cruise details:', {
        ship: result.ship,
        startDate,
        reservationNumber
      });
      
      // Invalidate all relevant queries to refresh data
      console.log('[BookCruise] Invalidating queries...');
      try {
        await Promise.all([
          utils.bookedCruises.list.invalidate(),
          utils.directBookedCruises.list.invalidate(),
          utils.cruises.list.invalidate(),
          utils.directCruises.list.invalidate(),
          // Also invalidate any analytics queries that might be affected
          utils.analytics.getCasinoAnalytics.invalidate(),
          utils.directAnalytics.getCasinoAnalytics.invalidate()
        ]);
        console.log('[BookCruise] All queries invalidated successfully');
      } catch (invalidateError) {
        console.error('[BookCruise] Error invalidating queries:', invalidateError);
      }
      
      // Also refresh app state if using local data
      if (hasLocalData) {
        console.log('[BookCruise] Refreshing app state...');
        try {
          await refreshLocalData();
          console.log('[BookCruise] App state refreshed successfully');
        } catch (refreshError) {
          console.error('[BookCruise] Error refreshing app state:', refreshError);
        }
      }
    },
    onError: (error) => {
      console.error('[BookCruise] ❌ Mutation error:', error);
      console.error('[BookCruise] Error details:', {
        message: error.message,
        data: error.data,
        shape: error.shape
      });
    }
  });

  const handleSubmit = async () => {
    console.log('[BookCruise] Submit button pressed');
    
    if (!cruiseId) {
      console.log('[BookCruise] No cruise ID');
      Alert.alert('Error', 'No cruise selected');
      return;
    }
    
    if (!cruise) {
      console.log('[BookCruise] No cruise data');
      Alert.alert('Error', 'Cruise data not available');
      return;
    }
    
    console.log('[BookCruise] Starting submission process...');
    setIsSubmitting(true);
    
    try {
      // Validate input based on booking method
      console.log('[BookCruise] Validating booking method:', bookingMethod);
      switch (bookingMethod) {
        case 'booking_number':
          if (!bookingNumber.trim()) {
            console.log('[BookCruise] No booking number entered');
            Alert.alert('Error', 'Please enter a booking number');
            setIsSubmitting(false);
            return;
          }
          console.log('[BookCruise] Booking number:', bookingNumber.trim());
          break;
          
        case 'offer_code':
          if (!offerCode.trim()) {
            console.log('[BookCruise] No offer code entered');
            Alert.alert('Error', 'Please enter an offer code');
            setIsSubmitting(false);
            return;
          }
          console.log('[BookCruise] Offer code:', offerCode.trim());
          break;
          
        case 'receipt':
          if (selectedImages.length === 0) {
            console.log('[BookCruise] No receipt images selected');
            Alert.alert('Error', 'Please upload at least one receipt image');
            setIsSubmitting(false);
            return;
          }
          console.log('[BookCruise] Selected images:', selectedImages.length);
          break;
      }
      
      // Calculate dates
      const startDate = cruise.departureDate;
      const endDate = cruise.returnDate;
      const nights = cruise.nights;
      
      console.log('[BookCruise] Cruise dates:', { startDate, endDate, nights });
      
      // Calculate days to go
      const today = new Date();
      const departureDate = new Date(startDate);
      const daysToGo = Math.ceil((departureDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      console.log('[BookCruise] Days to go:', daysToGo);
      
      // Create booked cruise data
      const bookedCruiseData = {
        cruiseId: cruise.id,
        ship: cruise.ship,
        startDate,
        endDate,
        nights,
        itineraryName: cruise.itineraryName,
        departurePort: cruise.departurePort,
        portsRoute: cruise.region || '',
        reservationNumber: bookingMethod === 'booking_number' ? bookingNumber.trim() : '',
        guests: 2, // Default to 2 guests
        daysToGo,
      };
      
      console.log('[BookCruise] Creating booked cruise with data:', bookedCruiseData);
      
      // Call the backend API
      console.log('[BookCruise] Calling mutation with data:', bookedCruiseData);
      const result = await createBookedCruiseMutation.mutateAsync(bookedCruiseData);
      
      console.log('[BookCruise] ✅ Mutation successful! Result:', result);
      
      // Wait a moment for backend to process
      console.log('[BookCruise] Waiting for backend processing...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Force refetch to ensure we have the latest data
      console.log('[BookCruise] Force refetching all data...');
      try {
        await Promise.all([
          utils.directBookedCruises.list.refetch(),
          utils.bookedCruises.list.refetch(),
          utils.directCruises.list.refetch(),
          utils.cruises.list.refetch()
        ]);
        console.log('[BookCruise] All data refetched successfully');
        
        // Wait a bit more for the data to propagate
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Force one more refetch to be absolutely sure
        await utils.directBookedCruises.list.refetch();
        console.log('[BookCruise] Final refetch completed');
      } catch (refetchError) {
        console.error('[BookCruise] Error during refetch:', refetchError);
      }
      
      console.log('[BookCruise] Showing success alert...');
      
      // Show success message with celebration
      const resultReservationNumber = 'reservationNumber' in result ? result.reservationNumber : '';
      
      Alert.alert(
        '🎉 Cruise Booked Successfully!',
        `Your cruise has been successfully booked and saved!\n\n🚢 ${cruise.ship}\n🗺️ ${cruise.itineraryName}\n📅 ${formatDate(cruise.departureDate)}\n\n🎫 Booking ID: ${result.id}\n📋 Reservation: ${resultReservationNumber || bookingNumber.trim() || 'To be assigned'}\n\n✅ This cruise is now in your booked cruises list and will appear on your calendar!`,
        [
          {
            text: 'View My Bookings',
            onPress: () => {
              console.log('[BookCruise] Navigating to booked cruises');
              router.push('/(tabs)/(booked)');
            }
          },
          {
            text: 'Perfect!',
            onPress: () => {
              console.log('[BookCruise] Going back');
              router.back();
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('[BookCruise] ❌ Submit error:', error);
      console.error('[BookCruise] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        error
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[BookCruise] Full error object:', error);
      
      Alert.alert(
        'Booking Error', 
        `Failed to submit booking: ${errorMessage}\n\nPlease try again. If the problem persists, check your internet connection or try using a different booking method.`,
        [
          {
            text: 'Try Again',
            onPress: () => {
              console.log('[BookCruise] User chose to try again');
            }
          },
          {
            text: 'Go Back',
            onPress: () => {
              console.log('[BookCruise] User chose to go back');
              router.back();
            }
          }
        ]
      );
    } finally {
      console.log('[BookCruise] Setting isSubmitting to false');
      setIsSubmitting(false);
    }
  };
  
  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };
  
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Date TBD';
    try {
      return new Date(dateString).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch {
      return 'Date TBD';
    }
  };
  
  if (cruiseQuery.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }
  
  // Try to find cruise in local data first
  let cruise: Cruise | null = null;
  if (hasLocalData && localData.cruises) {
    cruise = localData.cruises.find((c: any) => c.id === cruiseId) || null;
    console.log('[BookCruise] Found cruise in local data:', !!cruise);
  } else if (cruiseQuery.data) {
    cruise = cruiseQuery.data;
    console.log('[BookCruise] Using cruise from backend:', !!cruise);
  }
  
  if ((hasLocalData && !cruise) || (!hasLocalData && cruiseQuery.error) || (!hasLocalData && !cruiseQuery.isLoading && !cruiseQuery.data)) {
    return (
      <>
        <Stack.Screen 
          options={{
            title: 'Cruise Not Found',
            headerStyle: {
              backgroundColor: '#FFFFFF',
            },
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()} style={styles.headerBackButton}>
                <ArrowLeft size={24} color="#111827" />
              </TouchableOpacity>
            ),
          }} 
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Cruise not found</Text>
          <TouchableOpacity 
            style={styles.errorBackButton}
            onPress={() => router.back()}
          >
            <Text style={styles.errorBackButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }
  
  if (!cruise) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Cruise not found</Text>
        <TouchableOpacity 
          style={styles.errorBackButton}
          onPress={() => router.back()}
        >
          <Text style={styles.errorBackButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Book Cruise',
          headerStyle: {
            backgroundColor: '#FFFFFF',
          },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBackButton}>
              <ArrowLeft size={24} color="#111827" />
            </TouchableOpacity>
          ),
        }} 
      />
      <ScrollView style={styles.container}>
        {/* Cruise Summary */}
        <View style={styles.cruiseSummary}>
          <View style={styles.cruiseHeader}>
            <Ship size={24} color="#3B82F6" />
            <View style={styles.cruiseInfo}>
              <Text style={styles.cruiseTitle}>{cruise.ship}</Text>
              <Text style={styles.cruiseSubtitle}>{cruise.itineraryName}</Text>
            </View>
          </View>
          
          <View style={styles.cruiseDetails}>
            <View style={styles.detailItem}>
              <Calendar size={16} color="#6B7280" />
              <Text style={styles.detailText}>
                {cruise.departureDate ? new Date(cruise.departureDate).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                }) : 'Date TBD'}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <MapPin size={16} color="#6B7280" />
              <Text style={styles.detailText}>{cruise.departurePort}</Text>
            </View>
            <View style={styles.detailItem}>
              <Users size={16} color="#6B7280" />
              <Text style={styles.detailText}>{cruise.nights} nights</Text>
            </View>
          </View>
        </View>
        
        {/* Booking Method Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How would you like to book?</Text>
          
          <TouchableOpacity 
            style={[
              styles.methodCard,
              bookingMethod === 'booking_number' && styles.methodCardActive
            ]}
            onPress={() => setBookingMethod('booking_number')}
          >
            <View style={styles.methodHeader}>
              <Hash size={20} color={bookingMethod === 'booking_number' ? '#3B82F6' : '#6B7280'} />
              <Text style={[
                styles.methodTitle,
                bookingMethod === 'booking_number' && styles.methodTitleActive
              ]}>Booking Number</Text>
            </View>
            <Text style={styles.methodDescription}>
              Enter your existing booking confirmation number
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.methodCard,
              bookingMethod === 'offer_code' && styles.methodCardActive
            ]}
            onPress={() => setBookingMethod('offer_code')}
          >
            <View style={styles.methodHeader}>
              <CreditCard size={20} color={bookingMethod === 'offer_code' ? '#3B82F6' : '#6B7280'} />
              <Text style={[
                styles.methodTitle,
                bookingMethod === 'offer_code' && styles.methodTitleActive
              ]}>Offer Code</Text>
            </View>
            <Text style={styles.methodDescription}>
              Use a casino offer or promotional code
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.methodCard,
              bookingMethod === 'receipt' && styles.methodCardActive
            ]}
            onPress={() => setBookingMethod('receipt')}
          >
            <View style={styles.methodHeader}>
              <Upload size={20} color={bookingMethod === 'receipt' ? '#3B82F6' : '#6B7280'} />
              <Text style={[
                styles.methodTitle,
                bookingMethod === 'receipt' && styles.methodTitleActive
              ]}>Upload Receipt</Text>
            </View>
            <Text style={styles.methodDescription}>
              Upload booking receipt or confirmation documents
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Booking Form */}
        <View style={styles.section}>
          {bookingMethod === 'booking_number' && (
            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>Booking Number *</Text>
              <TextInput
                style={styles.textInput}
                value={bookingNumber}
                onChangeText={setBookingNumber}
                placeholder="Enter your booking confirmation number"
                autoCapitalize="characters"
                testID="booking-number-input"
              />
              <Text style={styles.inputHint}>
                This is typically a 6-8 character alphanumeric code
              </Text>
            </View>
          )}
          
          {bookingMethod === 'offer_code' && (
            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>Offer Name (Optional)</Text>
              <TextInput
                style={styles.textInput}
                value={offerName}
                onChangeText={setOfferName}
                placeholder="e.g., ACE OF DIAMONDS"
                testID="offer-name-input"
              />
              
              <Text style={styles.inputLabel}>Offer Code *</Text>
              <TextInput
                style={styles.textInput}
                value={offerCode}
                onChangeText={setOfferCode}
                placeholder="e.g., 25VAR706"
                autoCapitalize="characters"
                testID="offer-code-input"
              />
              <Text style={styles.inputHint}>
                Enter the offer code from your casino flyer or email
              </Text>
            </View>
          )}
          
          {bookingMethod === 'receipt' && (
            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>Upload Receipt(s) *</Text>
              
              <View style={styles.uploadButtons}>
                <TouchableOpacity 
                  style={styles.uploadButton}
                  onPress={handleImagePicker}
                >
                  <Upload size={20} color="#3B82F6" />
                  <Text style={styles.uploadButtonText}>Choose from Photos</Text>
                </TouchableOpacity>
                
                {Platform.OS !== 'web' && (
                  <TouchableOpacity 
                    style={styles.uploadButton}
                    onPress={handleDocumentPicker}
                  >
                    <Upload size={20} color="#3B82F6" />
                    <Text style={styles.uploadButtonText}>Choose Files</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {selectedImages.length > 0 && (
                <View style={styles.selectedImages}>
                  <Text style={styles.selectedImagesTitle}>
                    Selected Files ({selectedImages.length})
                  </Text>
                  {selectedImages.map((uri, index) => (
                    <View key={index} style={styles.selectedImageItem}>
                      <Text style={styles.selectedImageName} numberOfLines={1}>
                        {uri.split('/').pop() || `File ${index + 1}`}
                      </Text>
                      <TouchableOpacity 
                        onPress={() => removeImage(index)}
                        style={styles.removeImageButton}
                      >
                        <Text style={styles.removeImageText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              
              <Text style={styles.inputHint}>
                Upload booking confirmation, receipt, or related documents. Multiple files supported.
              </Text>
            </View>
          )}
        </View>
        
        {/* Submit Button */}
        <View style={styles.submitSection}>
          <TouchableOpacity 
            style={[
              styles.submitButton,
              isSubmitting && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            testID="submit-booking-button"
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <CreditCard size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Submit Booking</Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.receiptButton}
            onPress={() => {
              console.log('[BookCruise] Navigate to receipt screen');
              router.push('/receipts-admin');
            }}
            testID="add-receipt-button"
          >
            <Upload size={20} color="#6C5CE7" />
            <Text style={styles.receiptButtonText}>Add Receipt</Text>
          </TouchableOpacity>
          
          <Text style={styles.submitHint}>
            Your booking will be processed and you&apos;ll receive a confirmation email within 24 hours.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    fontSize: 18,
    color: '#EF4444',
    marginBottom: 16,
  },
  headerBackButton: {
    padding: 8,
  },
  errorBackButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  errorBackButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  cruiseSummary: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cruiseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  cruiseInfo: {
    flex: 1,
  },
  cruiseTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  cruiseSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  cruiseDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  methodCard: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  methodCardActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#EBF8FF',
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  methodTitleActive: {
    color: '#3B82F6',
  },
  methodDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  formSection: {
    gap: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  inputHint: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderRadius: 8,
    borderStyle: 'dashed',
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  selectedImages: {
    marginTop: 12,
  },
  selectedImagesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  selectedImageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    marginBottom: 4,
  },
  selectedImageName: {
    flex: 1,
    fontSize: 12,
    color: '#374151',
  },
  removeImageButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  removeImageText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '500',
  },
  submitSection: {
    padding: 16,
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  submitHint: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
  },
  receiptButton: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#6C5CE7',
    gap: 8,
    marginBottom: 12,
  },
  receiptButtonText: {
    color: '#6C5CE7',
    fontSize: 16,
    fontWeight: '600',
  },
});