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
} from 'react-native';
import { router, Stack } from 'expo-router';
import { ArrowLeft, Save, Calendar, MapPin, Ship, Clock } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';

type CruiseFormData = {
  ship: string;
  itineraryName: string;
  departurePort: string;
  departureDate: string;
  returnDate: string;
  nights: string;
  line: string;
  region: string;
  cabinType: string;
};

export default function AddCruiseScreen() {
  const [formData, setFormData] = React.useState<CruiseFormData>({
    ship: '',
    itineraryName: '',
    departurePort: '',
    departureDate: '',
    returnDate: '',
    nights: '7',
    line: 'Royal Caribbean',
    region: 'Caribbean',
    cabinType: 'Interior',
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  const createCruiseMutation = trpc.cruises.create.useMutation();
  
  const handleInputChange = (field: keyof CruiseFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Auto-calculate return date when departure date or nights change
    if (field === 'departureDate' || field === 'nights') {
      const depDate = field === 'departureDate' ? value : formData.departureDate;
      const nightsValue = field === 'nights' ? value : formData.nights;
      
      if (depDate && nightsValue && !isNaN(parseInt(nightsValue))) {
        const departureDate = new Date(depDate);
        const returnDate = new Date(departureDate);
        returnDate.setDate(returnDate.getDate() + parseInt(nightsValue));
        
        if (!isNaN(returnDate.getTime())) {
          setFormData(prev => ({ 
            ...prev, 
            [field]: value,
            returnDate: returnDate.toISOString().split('T')[0] 
          }));
          return;
        }
      }
    }
  };
  
  const handleSubmit = async () => {
    // Validate required fields
    const requiredFields: (keyof CruiseFormData)[] = [
      'ship', 'itineraryName', 'departurePort', 'departureDate', 'returnDate', 'nights'
    ];
    
    const missingFields = requiredFields.filter(field => !formData[field].trim());
    
    if (missingFields.length > 0) {
      Alert.alert(
        'Missing Information',
        `Please fill in the following fields: ${missingFields.join(', ')}`
      );
      return;
    }
    
    // Validate dates
    const departureDate = new Date(formData.departureDate);
    const returnDate = new Date(formData.returnDate);
    
    if (isNaN(departureDate.getTime()) || isNaN(returnDate.getTime())) {
      Alert.alert('Invalid Dates', 'Please enter valid departure and return dates.');
      return;
    }
    
    if (returnDate <= departureDate) {
      Alert.alert('Invalid Dates', 'Return date must be after departure date.');
      return;
    }
    
    // Validate nights
    const nights = parseInt(formData.nights);
    if (isNaN(nights) || nights <= 0) {
      Alert.alert('Invalid Duration', 'Please enter a valid number of nights.');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      await createCruiseMutation.mutateAsync({
        ship: formData.ship.trim(),
        itineraryName: formData.itineraryName.trim(),
        departurePort: formData.departurePort.trim(),
        departureDate: formData.departureDate,
        returnDate: formData.returnDate,
        nights,
        line: formData.line.trim(),
        region: formData.region.trim(),
        stateroomTypes: [formData.cabinType],
        status: 'on_sale' as const,
      });
      
      Alert.alert(
        'Cruise Added',
        `Successfully added ${formData.ship} - ${formData.itineraryName}`,
        [
          {
            text: 'Add Another',
            onPress: () => {
              setFormData({
                ship: '',
                itineraryName: '',
                departurePort: '',
                departureDate: '',
                returnDate: '',
                nights: '7',
                line: 'Royal Caribbean',
                region: 'Caribbean',
                cabinType: 'Interior',
              });
            }
          },
          {
            text: 'Done',
            onPress: () => router.back()
          }
        ]
      );
      
    } catch (error) {
      console.error('[AddCruise] Failed to create cruise:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to add cruise'
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Add Cruise',
          headerStyle: {
            backgroundColor: '#FFFFFF',
          },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
              <ArrowLeft size={24} color="#111827" />
            </TouchableOpacity>
          ),
        }} 
      />
      <ScrollView style={styles.container} testID="add-cruise-screen">
        <View style={styles.form}>
          {/* Ship Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ship Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ship Name *</Text>
              <View style={styles.inputContainer}>
                <Ship size={20} color="#6B7280" />
                <TextInput
                  style={styles.input}
                  value={formData.ship}
                  onChangeText={(value) => handleInputChange('ship', value)}
                  placeholder="e.g., Wonder of the Seas"
                  testID="ship-input"
                />
              </View>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Cruise Line</Text>
              <View style={styles.inputContainer}>
                <Ship size={20} color="#6B7280" />
                <TextInput
                  style={styles.input}
                  value={formData.line}
                  onChangeText={(value) => handleInputChange('line', value)}
                  placeholder="e.g., Royal Caribbean"
                  testID="line-input"
                />
              </View>
            </View>
          </View>
          
          {/* Itinerary Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Itinerary Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Itinerary Name *</Text>
              <View style={styles.inputContainer}>
                <MapPin size={20} color="#6B7280" />
                <TextInput
                  style={styles.input}
                  value={formData.itineraryName}
                  onChangeText={(value) => handleInputChange('itineraryName', value)}
                  placeholder="e.g., Eastern Caribbean"
                  testID="itinerary-input"
                />
              </View>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Departure Port *</Text>
              <View style={styles.inputContainer}>
                <MapPin size={20} color="#6B7280" />
                <TextInput
                  style={styles.input}
                  value={formData.departurePort}
                  onChangeText={(value) => handleInputChange('departurePort', value)}
                  placeholder="e.g., Fort Lauderdale"
                  testID="departure-port-input"
                />
              </View>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Region</Text>
              <View style={styles.inputContainer}>
                <MapPin size={20} color="#6B7280" />
                <TextInput
                  style={styles.input}
                  value={formData.region}
                  onChangeText={(value) => handleInputChange('region', value)}
                  placeholder="e.g., Caribbean, Mediterranean"
                  testID="region-input"
                />
              </View>
            </View>
          </View>
          
          {/* Date Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Departure Date *</Text>
              <View style={styles.inputContainer}>
                <Calendar size={20} color="#6B7280" />
                <TextInput
                  style={styles.input}
                  value={formData.departureDate}
                  onChangeText={(value) => handleInputChange('departureDate', value)}
                  placeholder="YYYY-MM-DD"
                  testID="departure-date-input"
                />
              </View>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Number of Nights *</Text>
              <View style={styles.inputContainer}>
                <Clock size={20} color="#6B7280" />
                <TextInput
                  style={styles.input}
                  value={formData.nights}
                  onChangeText={(value) => handleInputChange('nights', value)}
                  placeholder="7"
                  keyboardType="numeric"
                  testID="nights-input"
                />
              </View>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Return Date *</Text>
              <View style={styles.inputContainer}>
                <Calendar size={20} color="#6B7280" />
                <TextInput
                  style={styles.input}
                  value={formData.returnDate}
                  onChangeText={(value) => handleInputChange('returnDate', value)}
                  placeholder="YYYY-MM-DD (auto-calculated)"
                  testID="return-date-input"
                />
              </View>
            </View>
          </View>
          
          {/* Cabin Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cabin Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Primary Cabin Type</Text>
              <View style={styles.inputContainer}>
                <Ship size={20} color="#6B7280" />
                <TextInput
                  style={styles.input}
                  value={formData.cabinType}
                  onChangeText={(value) => handleInputChange('cabinType', value)}
                  placeholder="Interior, Oceanview, Balcony, Suite"
                  testID="cabin-type-input"
                />
              </View>
            </View>
          </View>
          
          {/* Submit Button */}
          <TouchableOpacity 
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            testID="submit-cruise-button"
          >
            {isSubmitting ? (
              <ActivityIndicator size={20} color="#FFFFFF" />
            ) : (
              <Save size={20} color="#FFFFFF" />
            )}
            <Text style={styles.submitButtonText}>
              {isSubmitting ? 'Adding Cruise...' : 'Add Cruise'}
            </Text>
          </TouchableOpacity>
          
          <Text style={styles.helperText}>
            * Required fields. Return date will be auto-calculated based on departure date and nights.
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
  headerButton: {
    padding: 8,
  },
  form: {
    padding: 16,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
  },
});