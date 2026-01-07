# 🎲 LANE 12: CLUB TABLES & GAMES - COMPLETE
## Wire Club Table Creation and Display
## Copy-Paste Ready Code

---

## OVERVIEW

**Problem:**
- Can't create tables in clubs
- clubsApi.createTable() exists but never called
- No UI to start matches at club tables
- Tables tab shows "Coming Soon"

**Solution:**
- Add table creation modal
- Display active tables
- Allow joining tables
- Wire to backend API

**Time:** 45 minutes

**Prerequisites:**
- Lane 11 complete
- Backend running on port 8000

---

## PHASE 1: Update Club Detail Screen with Tables

### Step 1.1: Add Tables Functionality

Update the Tables tab section in `app/club/[id].tsx`. Replace the Tables tab section with the following code.

Find this section in your current file:
```typescript
{/* ==================== TABLES TAB ==================== */}
{isMember && activeTab === 'tables' && (
```

And replace the entire tables tab section with:

```typescript
{/* ==================== TABLES TAB ==================== */}
{isMember && activeTab === 'tables' && (
  <View style={styles.tablesContainer}>
    {/* Create Table Button */}
    <TouchableOpacity
      style={styles.createTableHeader}
      onPress={() => setShowCreateTableModal(true)}
    >
      <View style={styles.createTableIcon}>
        <Ionicons name="add-circle" size={24} color="#667eea" />
      </View>
      <View style={styles.createTableInfo}>
        <Text style={styles.createTableTitle}>Create New Table</Text>
        <Text style={styles.createTableSubtitle}>Start a game with club members</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </TouchableOpacity>

    {/* Tables List */}
    <ScrollView
      style={styles.tablesList}
      refreshControl={
        <RefreshControl refreshing={refreshingTables} onRefresh={handleRefreshTables} />
      }
    >
      {loadingTables ? (
        <ActivityIndicator style={{ padding: 32 }} color="#667eea" />
      ) : tables.length === 0 ? (
        <View style={styles.tablesEmpty}>
          <Ionicons name="grid-outline" size={48} color="#D1D5DB" />
          <Text style={styles.tablesEmptyText}>No active tables</Text>
          <Text style={styles.tablesEmptySubtext}>
            Create a table to start playing!
          </Text>
        </View>
      ) : (
        tables.map((table) => (
          <View key={table.table_id} style={styles.tableCard}>
            <View style={styles.tableLeft}>
              <View style={styles.tableIconContainer}>
                <Ionicons name="game-controller" size={24} color="#667eea" />
              </View>
              <View style={styles.tableInfo}>
                <Text style={styles.tableStake}>💰 {table.stake_amount} chips</Text>
                <Text style={styles.tableStatus}>
                  {table.status === 'waiting' ? 'Waiting for player...' : 
                   table.status === 'playing' ? 'Game in progress' : table.status}
                </Text>
                <Text style={styles.tableCreator}>
                  Created by {table.creator_username || 'Unknown'}
                </Text>
              </View>
            </View>
            <View style={styles.tableRight}>
              {table.status === 'waiting' && table.creator_id !== user?.user_id ? (
                <TouchableOpacity
                  style={styles.joinTableButton}
                  onPress={() => handleJoinTable(table)}
                >
                  <Text style={styles.joinTableButtonText}>Join</Text>
                </TouchableOpacity>
              ) : table.status === 'waiting' && table.creator_id === user?.user_id ? (
                <TouchableOpacity
                  style={styles.cancelTableButton}
                  onPress={() => handleCancelTable(table.table_id)}
                >
                  <Text style={styles.cancelTableButtonText}>Cancel</Text>
                </TouchableOpacity>
              ) : table.status === 'playing' ? (
                <View style={styles.playingBadge}>
                  <Text style={styles.playingBadgeText}>Playing</Text>
                </View>
              ) : null}
            </View>
          </View>
        ))
      )}
      <View style={{ height: 100 }} />
    </ScrollView>

    {/* Create Table Modal */}
    <Modal
      visible={showCreateTableModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowCreateTableModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create Table</Text>
            <TouchableOpacity onPress={() => setShowCreateTableModal(false)}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalSubtitle}>
            Set the chip stake for this table. Players must have enough chips to join.
          </Text>

          {/* Stake Options */}
          <View style={styles.stakeOptions}>
            {[100, 500, 1000, 5000].map((amount) => (
              <TouchableOpacity
                key={amount}
                style={[
                  styles.stakeOption,
                  tableStake === String(amount) && styles.stakeOptionSelected,
                ]}
                onPress={() => setTableStake(String(amount))}
              >
                <Text
                  style={[
                    styles.stakeOptionText,
                    tableStake === String(amount) && styles.stakeOptionTextSelected,
                  ]}
                >
                  💰 {amount}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom Input */}
          <TextInput
            style={styles.stakeInput}
            placeholder="Or enter custom amount"
            placeholderTextColor="#9CA3AF"
            value={tableStake}
            onChangeText={(text) => setTableStake(text.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={6}
          />

          {/* Chip Balance */}
          <View style={styles.chipBalanceRow}>
            <Text style={styles.chipBalanceLabel}>Your chips:</Text>
            <Text style={styles.chipBalanceValue}>💰 {myChipBalance.toLocaleString()}</Text>
          </View>

          {/* Warning */}
          {parseInt(tableStake) > myChipBalance && (
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={18} color="#DC2626" />
              <Text style={styles.warningText}>Insufficient chips</Text>
            </View>
          )}

          {/* Create Button */}
          <TouchableOpacity
            style={[
              styles.createButton,
              (parseInt(tableStake) > myChipBalance || creatingTable) && styles.createButtonDisabled,
            ]}
            onPress={handleCreateTable}
            disabled={parseInt(tableStake) > myChipBalance || creatingTable}
          >
            {creatingTable ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.createButtonText}>Create Table</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  </View>
)}
```

### Step 1.2: Add Required State and Handlers

Add these state variables at the top of the component (with the other state declarations):

```typescript
// Tables state
const [tables, setTables] = useState<any[]>([]);
const [loadingTables, setLoadingTables] = useState(false);
const [refreshingTables, setRefreshingTables] = useState(false);
const [showCreateTableModal, setShowCreateTableModal] = useState(false);
const [tableStake, setTableStake] = useState('100');
const [creatingTable, setCreatingTable] = useState(false);
```

Add these handler functions:

```typescript
// Fetch tables
const fetchTables = useCallback(async () => {
  if (!id) return;

  setLoadingTables(true);
  try {
    const { data } = await clubsApi.getTables(id);
    if (data.success) {
      setTables(data.tables || []);
    }
  } catch (error) {
    console.error('Failed to load tables:', error);
  } finally {
    setLoadingTables(false);
    setRefreshingTables(false);
  }
}, [id]);

// Add useEffect to load tables when switching to tables tab
useEffect(() => {
  if (activeTab === 'tables' && isMember) {
    fetchTables();
  }
}, [activeTab, isMember, fetchTables]);

const handleRefreshTables = () => {
  setRefreshingTables(true);
  fetchTables();
};

const handleCreateTable = async () => {
  if (!id) return;

  const stake = parseInt(tableStake) || 100;

  if (stake > myChipBalance) {
    Alert.alert('Insufficient Chips', 'You don\'t have enough chips for this stake.');
    return;
  }

  setCreatingTable(true);
  try {
    const { data } = await clubsApi.createTable(id, stake);
    if (data.success) {
      setShowCreateTableModal(false);
      setTableStake('100');
      fetchTables();
      Alert.alert('Table Created!', `Your table with ${stake} chip stake is ready. Waiting for opponent...`);
    }
  } catch (error: any) {
    Alert.alert('Error', error.response?.data?.error || 'Failed to create table');
  } finally {
    setCreatingTable(false);
  }
};

const handleJoinTable = async (table: any) => {
  Alert.alert(
    'Join Table',
    `Join this table for ${table.stake_amount} chips?`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Join',
        onPress: async () => {
          try {
            const { data } = await clubsApi.joinTable(id as string, table.table_id);
            if (data.success && data.match_id) {
              router.push(`/match/${data.match_id}`);
            }
          } catch (error: any) {
            Alert.alert('Error', error.response?.data?.error || 'Failed to join table');
          }
        },
      },
    ]
  );
};

const handleCancelTable = async (tableId: string) => {
  Alert.alert(
    'Cancel Table',
    'Are you sure you want to cancel this table?',
    [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await clubsApi.deleteTable(id as string, tableId);
            fetchTables();
          } catch (error: any) {
            Alert.alert('Error', error.response?.data?.error || 'Failed to cancel table');
          }
        },
      },
    ]
  );
};
```

### Step 1.3: Add Additional Styles

Add these styles to the StyleSheet:

```typescript
// Tables Header
createTableHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: 'white',
  margin: 16,
  padding: 16,
  borderRadius: 12,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 4,
  elevation: 2,
},
createTableIcon: {
  width: 48,
  height: 48,
  borderRadius: 24,
  backgroundColor: '#EEF2FF',
  justifyContent: 'center',
  alignItems: 'center',
},
createTableInfo: {
  flex: 1,
  marginLeft: 12,
},
createTableTitle: {
  fontSize: 16,
  fontWeight: '600',
  color: '#1F2937',
},
createTableSubtitle: {
  fontSize: 12,
  color: '#6B7280',
  marginTop: 2,
},

// Tables List
tablesList: {
  flex: 1,
  paddingHorizontal: 16,
},
tableCard: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: 'white',
  padding: 16,
  borderRadius: 12,
  marginBottom: 8,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
  elevation: 1,
},
tableLeft: {
  flexDirection: 'row',
  alignItems: 'center',
  flex: 1,
},
tableIconContainer: {
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: '#EEF2FF',
  justifyContent: 'center',
  alignItems: 'center',
},
tableInfo: {
  marginLeft: 12,
  flex: 1,
},
tableStake: {
  fontSize: 16,
  fontWeight: '700',
  color: '#1F2937',
},
tableStatus: {
  fontSize: 12,
  color: '#6B7280',
  marginTop: 2,
},
tableCreator: {
  fontSize: 11,
  color: '#9CA3AF',
  marginTop: 2,
},
tableRight: {},
joinTableButton: {
  backgroundColor: '#667eea',
  paddingHorizontal: 20,
  paddingVertical: 10,
  borderRadius: 16,
},
joinTableButtonText: {
  color: 'white',
  fontWeight: '600',
},
cancelTableButton: {
  backgroundColor: '#FEE2E2',
  paddingHorizontal: 16,
  paddingVertical: 8,
  borderRadius: 16,
},
cancelTableButtonText: {
  color: '#DC2626',
  fontWeight: '600',
  fontSize: 12,
},
playingBadge: {
  backgroundColor: '#D1FAE5',
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 12,
},
playingBadgeText: {
  color: '#059669',
  fontWeight: '600',
  fontSize: 12,
},

// Modal
modalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  justifyContent: 'flex-end',
},
modalContent: {
  backgroundColor: 'white',
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
  padding: 24,
  paddingBottom: 40,
},
modalHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 8,
},
modalTitle: {
  fontSize: 22,
  fontWeight: 'bold',
  color: '#1F2937',
},
modalSubtitle: {
  fontSize: 14,
  color: '#6B7280',
  marginBottom: 20,
},
stakeOptions: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 10,
},
stakeOption: {
  flex: 1,
  minWidth: '45%',
  paddingVertical: 12,
  paddingHorizontal: 16,
  borderRadius: 12,
  borderWidth: 2,
  borderColor: '#E5E7EB',
  alignItems: 'center',
},
stakeOptionSelected: {
  borderColor: '#667eea',
  backgroundColor: '#EEF2FF',
},
stakeOptionText: {
  fontSize: 15,
  fontWeight: '600',
  color: '#6B7280',
},
stakeOptionTextSelected: {
  color: '#667eea',
},
stakeInput: {
  backgroundColor: '#F3F4F6',
  paddingHorizontal: 16,
  paddingVertical: 14,
  borderRadius: 12,
  marginTop: 16,
  fontSize: 16,
  textAlign: 'center',
  color: '#1F2937',
},
chipBalanceRow: {
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 8,
  marginTop: 16,
},
chipBalanceLabel: {
  fontSize: 14,
  color: '#6B7280',
},
chipBalanceValue: {
  fontSize: 16,
  fontWeight: '700',
  color: '#059669',
},
warningBox: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  backgroundColor: '#FEE2E2',
  padding: 10,
  borderRadius: 8,
  marginTop: 12,
},
warningText: {
  color: '#DC2626',
  fontSize: 13,
  fontWeight: '500',
},
createButton: {
  backgroundColor: '#667eea',
  paddingVertical: 16,
  borderRadius: 12,
  alignItems: 'center',
  marginTop: 20,
},
createButtonDisabled: {
  backgroundColor: '#D1D5DB',
},
createButtonText: {
  color: 'white',
  fontSize: 18,
  fontWeight: '700',
},
```

---

## PHASE 2: Add API Functions

### Step 2.1: Update clubsApi.ts

Ensure `services/api/clubsApi.ts` has these functions:

```typescript
getTables: (clubId: string) =>
  apiClient.get<{ success: boolean; tables: any[] }>(`/clubs/${clubId}/tables`),

createTable: (clubId: string, stakeAmount: number) =>
  apiClient.post<{ success: boolean; table: any }>(`/clubs/${clubId}/tables`, {
    stake_amount: stakeAmount,
  }),

joinTable: (clubId: string, tableId: string) =>
  apiClient.post<{ success: boolean; match_id: string }>(
    `/clubs/${clubId}/tables/${tableId}/join`
  ),

deleteTable: (clubId: string, tableId: string) =>
  apiClient.delete<{ success: boolean }>(`/clubs/${clubId}/tables/${tableId}`),
```

---

## PHASE 3: Add Modal Import

Ensure you have Modal imported at the top of the file:

```typescript
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Modal, // <-- Make sure this is imported
} from 'react-native';
```

---

## ✅ LANE 12 VERIFICATION CHECKLIST

After implementing, verify:

- [ ] Tables tab shows create table button
- [ ] Create table modal opens
- [ ] Can select predefined stake amounts
- [ ] Can enter custom stake
- [ ] Shows insufficient chips warning when appropriate
- [ ] Create table button creates table
- [ ] Tables list shows created tables
- [ ] Can join other players' tables
- [ ] Can cancel your own waiting tables
- [ ] Join navigates to match screen
- [ ] Pull-to-refresh updates tables list

---

## 📁 FILES CREATED/MODIFIED

| File | Action |
|------|--------|
| `app/club/[id].tsx` | UPDATE (Tables section) |
| `services/api/clubsApi.ts` | VERIFY/UPDATE |

---

## 🚀 READY FOR LANE 13

After Lane 12 is complete:
- Club tables can be created
- Tables display with status
- Can join and cancel tables
- Full club functionality working

Proceed to **Lane 13: Polish & Error Handling**
