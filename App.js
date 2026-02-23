import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  FlatList,
  TextInput,
  Alert,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Papa from 'papaparse';

export default function App() {
  const [studentId, setStudentId] = useState('');
  const [inputStudentId, setInputStudentId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [prosekhoLogs, setProsekhoLogs] = useState([]);
  const [variemaiLogs, setVariemaiLogs] = useState([]);

  // Έλεγχος για Student ID στην εκκίνηση
  useEffect(() => {
    checkStudentId();
  }, []);

  const checkStudentId = async () => {
    try {
      const savedId = await AsyncStorage.getItem('studentId');
      if (savedId) {
        setStudentId(savedId);
      }
    } catch (error) {
      console.error('Error loading student ID:', error);
      Alert.alert('Σφάλμα', 'Αποτυχία φόρτωσης Student ID');
    } finally {
      setIsLoading(false);
    }
  };

  const saveStudentId = async () => {
    if (!inputStudentId.trim()) {
      Alert.alert('Σφάλμα', 'Παρακαλώ εισάγετε το Student ID');
      return;
    }

    try {
      await AsyncStorage.setItem('studentId', inputStudentId.trim());
      setStudentId(inputStudentId.trim());
    } catch (error) {
      console.error('Error saving student ID:', error);
      Alert.alert('Σφάλμα', 'Αποτυχία αποθήκευσης Student ID');
    }
  };

  const addLog = (action) => {
    const timestamp = new Date().toISOString().slice(0, 19);
    const newLog = { timestamp, action };

    if (action === 'ΠΡΟΣΕΧΩ') {
      setProsekhoLogs((prev) => {
        const updated = [newLog, ...prev];
        return updated.slice(0, 50); // Μέγιστο 50 items
      });
    } else {
      setVariemaiLogs((prev) => {
        const updated = [newLog, ...prev];
        return updated.slice(0, 50); // Μέγιστο 50 items
      });
    }
  };

  const exportToCSV = async () => {
    try {
      // Ανάκτηση Student ID
      const savedId = await AsyncStorage.getItem('studentId');
      if (!savedId) {
        Alert.alert('Σφάλμα', 'Δεν βρέθηκε Student ID');
        return;
      }

      // Συνδυασμός όλων των logs
      const allLogs = [
        ...prosekhoLogs.map((log) => ({
          student_id: savedId,
          action: log.action,
          timestamp: log.timestamp,
        })),
        ...variemaiLogs.map((log) => ({
          student_id: savedId,
          action: log.action,
          timestamp: log.timestamp,
        })),
      ].sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // Ταξινόμηση από νεότερο σε παλαιότερο

      if (allLogs.length === 0) {
        Alert.alert('Πληροφορία', 'Δεν υπάρχουν δεδομένα για εξαγωγή');
        return;
      }

      // Δημιουργία CSV
      const csv = Papa.unparse(allLogs, {
        header: true,
        columns: ['student_id', 'action', 'timestamp'],
      });

      // Δημιουργία αρχείου στο cache directory
      const fileName = `logs_${savedId}_${Date.now()}.csv`;
      const fileUri = FileSystem.cacheDirectory + fileName;
      
      // Εγγραφή δεδομένων
      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: 'utf8',
      });

      // Sharing API για να μοιραστεί/αποθηκευτεί το αρχείο
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Αποθήκευση CSV',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert(
          'Επιτυχία',
          `Το αρχείο δημιουργήθηκε!\nΣύνολο εγγραφών: ${allLogs.length}\nΤοποθεσία: ${fileUri}`
        );
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
      Alert.alert('Σφάλμα', `Αποτυχία εξαγωγής CSV: ${error.message}`);
    }
  };

  const renderLogItem = ({ item }, color) => (
    <View style={[styles.logItem, { borderLeftColor: color }]}>
      <Text style={styles.logTimestamp}>{item.timestamp}</Text>
      <Text style={[styles.logAction, { color }]}>{item.action}</Text>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="dark-content" />
          <ActivityIndicator size="large" color="#4CAF50" />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // Οθόνη εισαγωγής Student ID
  if (!studentId) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="dark-content" />
          <View style={styles.inputContainer}>
            <Text style={styles.inputTitle}>Καλώς ήρθατε!</Text>
            <Text style={styles.inputSubtitle}>Παρακαλώ εισάγετε το Student ID σας</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Student ID"
              value={inputStudentId}
              onChangeText={setInputStudentId}
              autoCapitalize="none"
              autoFocus
            />
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={saveStudentId}
            >
              <Text style={styles.submitButtonText}>Εντάξει</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // Κύρια οθόνη
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.headerText}>Student: {studentId}</Text>
      </View>

      {/* Κουμπιά Δράσης */}
      <View style={styles.buttonContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            styles.prosekhoButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => addLog('ΠΡΟΣΕΧΩ')}
        >
          <Text style={styles.actionButtonText}>ΠΡΟΣΕΧΩ</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            styles.variemaiButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => addLog('ΒΑΡΙΕΜΑΙ')}
        >
          <Text style={styles.actionButtonText}>ΒΑΡΙΕΜΑΙ</Text>
        </Pressable>
      </View>

      {/* Λίστες Logs */}
      <View style={styles.logsContainer}>
        <View style={styles.logSection}>
          <Text style={[styles.logSectionTitle, { color: '#4CAF50' }]}>
            ΠΡΟΣΕΧΩ ({prosekhoLogs.length})
          </Text>
          <FlatList
            data={prosekhoLogs}
            keyExtractor={(item, index) => `prosekho-${index}`}
            renderItem={(props) => renderLogItem(props, '#4CAF50')}
            style={styles.logList}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Δεν υπάρχουν καταχωρήσεις</Text>
            }
          />
        </View>

        <View style={styles.logSection}>
          <Text style={[styles.logSectionTitle, { color: '#F44336' }]}>
            ΒΑΡΙΕΜΑΙ ({variemaiLogs.length})
          </Text>
          <FlatList
            data={variemaiLogs}
            keyExtractor={(item, index) => `variemai-${index}`}
            renderItem={(props) => renderLogItem(props, '#F44336')}
            style={styles.logList}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Δεν υπάρχουν καταχωρήσεις</Text>
            }
          />
        </View>
      </View>

      {/* Κουμπί Εξαγωγής CSV */}
      <Pressable
        style={({ pressed }) => [
          styles.exportButton,
          pressed && styles.buttonPressed,
        ]}
        onPress={exportToCSV}
      >
        <Text style={styles.exportButtonText}>📥 Εξαγωγή CSV</Text>
      </Pressable>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: StatusBar.currentHeight || 0,
  },
  header: {
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  inputContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  inputTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  inputSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  textInput: {
    width: '100%',
    maxWidth: 400,
    height: 50,
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
  },
  actionButton: {
    width: 150,
    height: 150,
    borderRadius: 75,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  prosekhoButton: {
    backgroundColor: '#4CAF50',
  },
  variemaiButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  logsContainer: {
    flex: 1,
    flexDirection: 'row',
    padding: 10,
    gap: 10,
  },
  logSection: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    elevation: 2,
  },
  logSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  logList: {
    flex: 1,
  },
  logItem: {
    padding: 10,
    marginBottom: 5,
    backgroundColor: '#f9f9f9',
    borderRadius: 5,
    borderLeftWidth: 4,
  },
  logTimestamp: {
    fontSize: 12,
    color: '#666',
  },
  logAction: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 3,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    marginTop: 20,
  },
  exportButton: {
    backgroundColor: '#2196F3',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
