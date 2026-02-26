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
  const [currentSessionId, setCurrentSessionId] = useState('');
  const [inputSessionId, setInputSessionId] = useState('');
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [prosekhoLogs, setProsekhoLogs] = useState([]);
  const [variemaiLogs, setVariemaiLogs] = useState([]);

  // Έλεγχος για Student ID στην εκκίνηση
  useEffect(() => {
    checkStudentId();
  }, []);

  // Φόρτωση logs όταν επιλέγεται session
  useEffect(() => {
    if (currentSessionId) {
      loadSessionLogs(currentSessionId);
    }
  }, [currentSessionId]);

  const checkStudentId = async () => {
    try {
      const savedId = await AsyncStorage.getItem('studentId');
      if (savedId) {
        setStudentId(savedId);
        await loadSessions(savedId);
      }
    } catch (error) {
      console.error('Error loading student ID:', error);
      Alert.alert('Σφάλμα', 'Αποτυχία φόρτωσης Student ID');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSessions = async (studentId) => {
    try {
      const sessionsData = await AsyncStorage.getItem(`${studentId}_sessions`);
      if (sessionsData) {
        setSessions(JSON.parse(sessionsData));
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const loadSessionLogs = async (sessionId) => {
    try {
      const prosekhoData = await AsyncStorage.getItem(`${studentId}_${sessionId}_prosekho`);
      const variemaiData = await AsyncStorage.getItem(`${studentId}_${sessionId}_variemai`);
      
      setProsekhoLogs(prosekhoData ? JSON.parse(prosekhoData) : []);
      setVariemaiLogs(variemaiData ? JSON.parse(variemaiData) : []);
    } catch (error) {
      console.error('Error loading session logs:', error);
      Alert.alert('Σφάλμα', 'Αποτυχία φόρτωσης logs');
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
      await loadSessions(inputStudentId.trim());
    } catch (error) {
      console.error('Error saving student ID:', error);
      Alert.alert('Σφάλμα', 'Αποτυχία αποθήκευσης Student ID');
    }
  };

  const createOrSelectSession = async () => {
    if (!inputSessionId.trim()) {
      Alert.alert('Σφάλμα', 'Παρακαλώ εισάγετε το Session ID');
      return;
    }

    const sessionId = inputSessionId.trim();
    
    try {
      // Έλεγχος αν υπάρχει ήδη το session
      const existingSession = sessions.find(s => s.id === sessionId);
      
      if (!existingSession) {
        // Δημιουργία νέου session
        const newSession = {
          id: sessionId,
          createdAt: new Date().toISOString(),
          lastAccessed: new Date().toISOString(),
        };
        
        const updatedSessions = [...sessions, newSession];
        await AsyncStorage.setItem(`${studentId}_sessions`, JSON.stringify(updatedSessions));
        setSessions(updatedSessions);
      } else {
        // Ενημέρωση lastAccessed
        const updatedSessions = sessions.map(s => 
          s.id === sessionId ? { ...s, lastAccessed: new Date().toISOString() } : s
        );
        await AsyncStorage.setItem(`${studentId}_sessions`, JSON.stringify(updatedSessions));
        setSessions(updatedSessions);
      }
      
      setCurrentSessionId(sessionId);
    } catch (error) {
      console.error('Error creating/selecting session:', error);
      Alert.alert('Σφάλμα', 'Αποτυχία δημιουργίας session');
    }
  };

  const addLog = async (action) => {
    const timestamp = new Date().toISOString().slice(0, 19);
    const newLog = { timestamp, action };

    try {
      if (action === 'ΠΡΟΣΕΧΩ') {
        const updated = [newLog, ...prosekhoLogs].slice(0, 200); // Μέγιστο 200 items
        setProsekhoLogs(updated);
        await AsyncStorage.setItem(`${studentId}_${currentSessionId}_prosekho`, JSON.stringify(updated));
      } else {
        const updated = [newLog, ...variemaiLogs].slice(0, 200); // Μέγιστο 200 items
        setVariemaiLogs(updated);
        await AsyncStorage.setItem(`${studentId}_${currentSessionId}_variemai`, JSON.stringify(updated));
      }
    } catch (error) {
      console.error('Error saving log:', error);
      Alert.alert('Σφάλμα', 'Αποτυχία αποθήκευσης log');
    }
  };

  const undoLastLog = async () => {
    try {
      // Βρίσκουμε ποια λίστα έχει το πιο πρόσφατο log
      const lastProsekho = prosekhoLogs[0];
      const lastVariemai = variemaiLogs[0];

      if (!lastProsekho && !lastVariemai) {
        Alert.alert('Πληροφορία', 'Δεν υπάρχουν logs για αναίρεση');
        return;
      }

      let action;
      if (!lastVariemai || (lastProsekho && lastProsekho.timestamp > lastVariemai.timestamp)) {
        action = 'ΠΡΟΣΕΧΩ';
      } else {
        action = 'ΒΑΡΙΕΜΑΙ';
      }

      Alert.alert(
        'Αναίρεση',
        `Διαγραφή του τελευταίου log: ${action}?`,
        [
          {
            text: 'Ακύρωση',
            style: 'cancel',
          },
          {
            text: 'Διαγραφή',
            style: 'destructive',
            onPress: async () => {
              if (action === 'ΠΡΟΣΕΧΩ') {
                const updated = prosekhoLogs.slice(1);
                setProsekhoLogs(updated);
                await AsyncStorage.setItem(`${studentId}_${currentSessionId}_prosekho`, JSON.stringify(updated));
              } else {
                const updated = variemaiLogs.slice(1);
                setVariemaiLogs(updated);
                await AsyncStorage.setItem(`${studentId}_${currentSessionId}_variemai`, JSON.stringify(updated));
              }
              Alert.alert('Επιτυχία', 'Το τελευταίο log διαγράφηκε');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error undoing log:', error);
      Alert.alert('Σφάλμα', 'Αποτυχία αναίρεσης');
    }
  };

  const deleteSession = async (sessionId) => {
    Alert.alert(
      'Διαγραφή Session',
      `Είστε σίγουροι ότι θέλετε να διαγράψετε το session "${sessionId}" και όλα τα δεδομένα του;`,
      [
        {
          text: 'Ακύρωση',
          style: 'cancel',
        },
        {
          text: 'Διαγραφή',
          style: 'destructive',
          onPress: async () => {
            try {
              // Διαγραφή logs του session
              await AsyncStorage.removeItem(`${studentId}_${sessionId}_prosekho`);
              await AsyncStorage.removeItem(`${studentId}_${sessionId}_variemai`);

              // Διαγραφή session από τη λίστα
              const updatedSessions = sessions.filter(s => s.id !== sessionId);
              await AsyncStorage.setItem(`${studentId}_sessions`, JSON.stringify(updatedSessions));
              setSessions(updatedSessions);

              // Αν είναι το τρέχον session, επιστροφή στην επιλογή
              if (currentSessionId === sessionId) {
                setCurrentSessionId('');
                setProsekhoLogs([]);
                setVariemaiLogs([]);
              }

              Alert.alert('Επιτυχία', 'Το session διαγράφηκε');
            } catch (error) {
              console.error('Error deleting session:', error);
              Alert.alert('Σφάλμα', 'Αποτυχία διαγραφής session');
            }
          },
        },
      ]
    );
  };

  const resetStudentId = async () => {
    Alert.alert(
      'Επαναφορά Student ID',
      'ΠΡΟΣΟΧΗ: Αυτό θα διαγράψει το Student ID και ΟΛΑ τα sessions και δεδομένα. Είστε σίγουροι;',
      [
        {
          text: 'Ακύρωση',
          style: 'cancel',
        },
        {
          text: 'Διαγραφή Όλων',
          style: 'destructive',
          onPress: async () => {
            try {
              // Διαγραφή όλων των sessions και logs
              for (const session of sessions) {
                await AsyncStorage.removeItem(`${studentId}_${session.id}_prosekho`);
                await AsyncStorage.removeItem(`${studentId}_${session.id}_variemai`);
              }
              await AsyncStorage.removeItem(`${studentId}_sessions`);
              await AsyncStorage.removeItem('studentId');

              // Reset state
              setStudentId('');
              setCurrentSessionId('');
              setSessions([]);
              setProsekhoLogs([]);
              setVariemaiLogs([]);
              setInputStudentId('');
              setInputSessionId('');

              Alert.alert('Επιτυχία', 'Όλα τα δεδομένα διαγράφηκαν');
            } catch (error) {
              console.error('Error resetting student ID:', error);
              Alert.alert('Σφάλμα', 'Αποτυχία επαναφοράς');
            }
          },
        },
      ]
    );
  };

  const exportToCSV = async () => {
    try {
      if (sessions.length === 0) {
        Alert.alert('Σφάλμα', 'Δεν υπάρχουν sessions για εξαγωγή');
        return;
      }

      // Επιλογή session για export
      Alert.alert(
        'Επιλογή Session',
        'Ποιο session θέλετε να εξάγετε;',
        [
          ...sessions.map(session => ({
            text: `${session.id} (${new Date(session.createdAt).toLocaleDateString()})`,
            onPress: () => exportSessionToCSV(session.id),
          })),
          {
            text: 'Όλα τα Sessions',
            onPress: () => exportAllSessionsToCSV(),
          },
          {
            text: 'Ακύρωση',
            style: 'cancel',
          },
        ]
      );
    } catch (error) {
      console.error('Error exporting CSV:', error);
      Alert.alert('Σφάλμα', `Αποτυχία εξαγωγής CSV: ${error.message}`);
    }
  };

  const exportSessionToCSV = async (sessionId) => {
    try {
      // Φόρτωση logs του συγκεκριμένου session
      const prosekhoData = await AsyncStorage.getItem(`${studentId}_${sessionId}_prosekho`);
      const variemaiData = await AsyncStorage.getItem(`${studentId}_${sessionId}_variemai`);
      
      const prosekhoLogs = prosekhoData ? JSON.parse(prosekhoData) : [];
      const variemaiLogs = variemaiData ? JSON.parse(variemaiData) : [];

      const allLogs = [
        ...prosekhoLogs.map((log) => ({
          student_id: studentId,
          session_id: sessionId,
          action: log.action,
          timestamp: log.timestamp,
        })),
        ...variemaiLogs.map((log) => ({
          student_id: studentId,
          session_id: sessionId,
          action: log.action,
          timestamp: log.timestamp,
        })),
      ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      if (allLogs.length === 0) {
        Alert.alert('Πληροφορία', 'Δεν υπάρχουν δεδομένα για εξαγωγή');
        return;
      }

      await createAndShareCSV(allLogs, `logs_${studentId}_${sessionId}_${Date.now()}.csv`);
    } catch (error) {
      console.error('Error exporting session CSV:', error);
      Alert.alert('Σφάλμα', `Αποτυχία εξαγωγής: ${error.message}`);
    }
  };

  const exportAllSessionsToCSV = async () => {
    try {
      const allLogs = [];

      for (const session of sessions) {
        const prosekhoData = await AsyncStorage.getItem(`${studentId}_${session.id}_prosekho`);
        const variemaiData = await AsyncStorage.getItem(`${studentId}_${session.id}_variemai`);
        
        const prosekhoLogs = prosekhoData ? JSON.parse(prosekhoData) : [];
        const variemaiLogs = variemaiData ? JSON.parse(variemaiData) : [];

        allLogs.push(
          ...prosekhoLogs.map((log) => ({
            student_id: studentId,
            session_id: session.id,
            action: log.action,
            timestamp: log.timestamp,
          })),
          ...variemaiLogs.map((log) => ({
            student_id: studentId,
            session_id: session.id,
            action: log.action,
            timestamp: log.timestamp,
          }))
        );
      }

      if (allLogs.length === 0) {
        Alert.alert('Πληροφορία', 'Δεν υπάρχουν δεδομένα για εξαγωγή');
        return;
      }

      const sortedLogs = allLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      await createAndShareCSV(sortedLogs, `logs_${studentId}_all_sessions_${Date.now()}.csv`);
    } catch (error) {
      console.error('Error exporting all sessions:', error);
      Alert.alert('Σφάλμα', `Αποτυχία εξαγωγής: ${error.message}`);
    }
  };

  const createAndShareCSV = async (data, fileName) => {
    try {
      // Δημιουργία CSV
      const csv = Papa.unparse(data, {
        header: true,
        columns: ['student_id', 'session_id', 'action', 'timestamp'],
      });

      // Δημιουργία αρχείου στο cache directory
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
          `Το αρχείο δημιουργήθηκε!\nΣύνολο εγγραφών: ${data.length}\nΤοποθεσία: ${fileUri}`
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

  // Οθόνη επιλογής Session
  if (!currentSessionId) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="dark-content" />
          <View style={styles.inputContainer}>
            <Text style={styles.inputTitle}>Επιλογή Session</Text>
            <View style={styles.studentIdRow}>
              <Text style={styles.headerText}>Student: {studentId}</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.smallResetButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={resetStudentId}
              >
                <Text style={styles.smallResetButtonText}>🗑️</Text>
              </Pressable>
            </View>
            <Text style={styles.inputSubtitle}>Δημιουργήστε νέο ή επιλέξτε υπάρχον session</Text>
            
            <TextInput
              style={styles.textInput}
              placeholder="Session ID (π.χ. Μάθημα_24-02-2026)"
              value={inputSessionId}
              onChangeText={setInputSessionId}
              autoCapitalize="none"
              autoFocus
            />
            
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={createOrSelectSession}
            >
              <Text style={styles.submitButtonText}>Συνέχεια</Text>
            </Pressable>

            {sessions.length > 0 && (
              <View style={styles.sessionsListContainer}>
                <Text style={styles.sessionListTitle}>Υπάρχοντα Sessions:</Text>
                <Text style={styles.sessionListHint}>Πατήστε παρατεταμένα για διαγραφή</Text>
                <FlatList
                  data={sessions}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <Pressable
                      style={({ pressed }) => [
                        styles.sessionItem,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={() => {
                        setInputSessionId(item.id);
                        setCurrentSessionId(item.id);
                      }}
                      onLongPress={() => deleteSession(item.id)}
                    >
                      <Text style={styles.sessionItemTitle}>{item.id}</Text>
                      <Text style={styles.sessionItemDate}>
                        Δημιουργήθηκε: {new Date(item.createdAt).toLocaleString('el-GR')}
                      </Text>
                      <Text style={styles.sessionItemDate}>
                        Τελευταία πρόσβαση: {new Date(item.lastAccessed).toLocaleString('el-GR')}
                      </Text>
                    </Pressable>
                  )}
                />
              </View>
            )}
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
        <Text style={styles.sessionText}>Session: {currentSessionId}</Text>
        <Pressable
          style={({ pressed }) => [
            styles.changeSessionButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => setCurrentSessionId('')}
        >
          <Text style={styles.changeSessionText}>🔄 Αλλαγή Session</Text>
        </Pressable>
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

      {/* Κουμπιά Ενεργειών */}
      <View style={styles.actionButtonsRow}>
        <Pressable
          style={({ pressed }) => [
            styles.undoButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={undoLastLog}
        >
          <Text style={styles.undoButtonText}>↶ Αναίρεση</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.deleteSessionButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => deleteSession(currentSessionId)}
        >
          <Text style={styles.deleteSessionButtonText}>🗑️ Διαγραφή Session</Text>
        </Pressable>
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
  sessionText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
  },
  changeSessionButton: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: '#2196F3',
    borderRadius: 5,
    alignSelf: 'center',
  },
  changeSessionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
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
  sessionsListContainer: {
    marginTop: 30,
    width: '100%',
    maxWidth: 500,
    maxHeight: 300,
  },
  sessionListTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  sessionItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  sessionItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  sessionItemDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  sessionListHint: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 15,
    paddingVertical: 10,
    gap: 10,
  },
  undoButton: {
    flex: 1,
    backgroundColor: '#FF9800',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 2,
  },
  undoButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  deleteSessionButton: {
    flex: 1,
    backgroundColor: '#F44336',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 2,
  },
  deleteSessionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  resetButton: {
    backgroundColor: '#F44336',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginTop: 15,
    elevation: 3,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  studentIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 5,
  },
  smallResetButton: {
    backgroundColor: '#F44336',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  smallResetButtonText: {
    color: '#fff',
    fontSize: 14,
  },
});
