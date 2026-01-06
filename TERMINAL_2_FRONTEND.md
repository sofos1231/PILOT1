# TERMINAL 2 - FRONTEND TASKS ONLY
# Run this prompt in Cursor/Claude Code for frontend work
# DO NOT modify any backend files

---

Complete the frontend tasks for club search, gold shop, and table join. Work ONLY on frontend files.

## TASK 0: Install Dependencies First

Before starting, run this command:

```bash
cd backgammon-mobile
npm install lodash @types/lodash --legacy-peer-deps
```

---

## TASK 1: Club Search Polish (1 file to modify)

### File: backgammon-mobile/app/(tabs)/clubs.tsx

#### Step 1: Add imports at the top of the file

```typescript
import { useCallback } from 'react';
import debounce from 'lodash/debounce';
```

#### Step 2: Add debounced search function inside the component

Find the existing handleSearch function and replace it with this pattern:

```typescript
// Create debounced search function
const debouncedSearch = useCallback(
  debounce((text: string) => {
    if (text.trim()) {
      searchClubs(text);
    } else {
      // Clear search results or fetch all clubs
      fetchClubs();
    }
  }, 400),
  []
);

// Update handleSearch to use debounce
const handleSearch = (text: string) => {
  setSearchQuery(text);
  debouncedSearch(text);
};
```

#### Step 3: Update the ListEmptyComponent in the FlatList

Find the FlatList in the Discover tab and update its ListEmptyComponent:

```typescript
ListEmptyComponent={() => (
  <View style={styles.emptyContainer}>
    <Text style={styles.emptyIcon}>
      {searchQuery.trim() ? '🔍' : '🏠'}
    </Text>
    <Text style={styles.emptyTitle}>
      {searchQuery.trim() 
        ? `No clubs matching "${searchQuery}"` 
        : 'No Clubs Found'}
    </Text>
    <Text style={styles.emptySubtitle}>
      {searchQuery.trim()
        ? 'Try a different search term'
        : 'Be the first to create a club!'}
    </Text>
  </View>
)}
```

#### Step 4: Add styles if they don't exist

```typescript
emptyContainer: {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 60,
  paddingHorizontal: 20,
},
emptyIcon: {
  fontSize: 48,
  marginBottom: 16,
},
emptyTitle: {
  fontSize: 18,
  fontWeight: '600',
  color: '#fff',
  textAlign: 'center',
  marginBottom: 8,
},
emptySubtitle: {
  fontSize: 14,
  color: '#999',
  textAlign: 'center',
},
```

---

## TASK 2: Gold Shop Purchase UI (2 files to modify)

### File 1: backgammon-mobile/services/api/goldApi.ts

Add this method to the goldApi object/class:

```typescript
async demoPurchase(packageId: string): Promise<{
  success: boolean;
  message: string;
  goldAdded: number;
  newBalance: number;
}> {
  const response = await api.post('/gold/demo-purchase', { packageId });
  return response.data;
}
```

### File 2: backgammon-mobile/app/(tabs)/shop.tsx

Find the handlePurchase function and replace it with this implementation:

```typescript
const handlePurchase = async (pkg: GoldPackage) => {
  const totalGold = pkg.goldAmount + (pkg.bonusAmount || 0);
  
  Alert.alert(
    'Confirm Purchase',
    `Buy ${pkg.goldAmount.toLocaleString()} gold${pkg.bonusAmount ? ` (+${pkg.bonusAmount.toLocaleString()} bonus)` : ''} for $${pkg.price.toFixed(2)}?`,
    [
      {
        text: 'Cancel',
        style: 'cancel'
      },
      {
        text: 'Buy Now',
        onPress: async () => {
          try {
            setLoading(true);
            
            const result = await goldApi.demoPurchase(pkg.id);
            
            // Update local balance
            if (result.newBalance !== undefined) {
              // Update authStore or local state with new balance
              updateGoldBalance(result.newBalance);
            } else {
              // Refresh balance from server
              await refreshBalance();
            }
            
            // Show success message
            Toast.show({
              type: 'success',
              text1: 'Purchase Successful! 🎉',
              text2: `You received ${totalGold.toLocaleString()} gold!`
            });
            
          } catch (error: any) {
            console.error('Purchase error:', error);
            Toast.show({
              type: 'error',
              text1: 'Purchase Failed',
              text2: error.response?.data?.message || error.message || 'Please try again'
            });
          } finally {
            setLoading(false);
          }
        }
      }
    ]
  );
};
```

Make sure these are imported/available:
- Alert from 'react-native'
- Toast (your toast component)
- goldApi with demoPurchase method
- setLoading state setter
- updateGoldBalance or refreshBalance function

If Toast is not set up, you can use Alert for success too:

```typescript
// Alternative without Toast:
Alert.alert('Success! 🎉', `You received ${totalGold.toLocaleString()} gold!`);
```

---

## TASK 3: Club Table Join Frontend (2 files to modify)

### File 1: backgammon-mobile/services/api/clubsApi.ts

Add this method to the clubsApi object/class:

```typescript
async joinTable(clubId: string, tableId: string): Promise<{
  success: boolean;
  message: string;
  table: any;
}> {
  const response = await api.post(`/clubs/${clubId}/tables/${tableId}/join`);
  return response.data;
}
```

### File 2: backgammon-mobile/app/club/[id].tsx

Find where the tables are rendered and update the Join button handler:

```typescript
const handleJoinTable = async (tableId: string) => {
  try {
    setJoiningTableId(tableId); // Or use general loading state
    
    const result = await clubsApi.joinTable(clubId, tableId);
    
    // Refresh the tables list
    await fetchTables();
    
    // Show success message
    Toast.show({
      type: 'success',
      text1: 'Joined Table! 🎮',
      text2: 'Game is starting...'
    });
    
    // Optionally navigate to game screen
    // router.push(`/game/${result.table.id}`);
    
  } catch (error: any) {
    console.error('Join table error:', error);
    Toast.show({
      type: 'error',
      text1: 'Failed to Join',
      text2: error.response?.data?.message || error.message || 'Please try again'
    });
  } finally {
    setJoiningTableId(null);
  }
};
```

Make sure the Join button calls this handler:

```typescript
<TouchableOpacity
  style={[
    styles.joinButton,
    joiningTableId === table.id && styles.joinButtonDisabled
  ]}
  onPress={() => handleJoinTable(table.id)}
  disabled={joiningTableId === table.id}
>
  {joiningTableId === table.id ? (
    <ActivityIndicator size="small" color="#fff" />
  ) : (
    <Text style={styles.joinButtonText}>Join</Text>
  )}
</TouchableOpacity>
```

Add state for tracking which table is being joined:

```typescript
const [joiningTableId, setJoiningTableId] = useState<string | null>(null);
```

---

## VERIFICATION AFTER COMPLETION

1. App compiles without errors:
```bash
cd backgammon-mobile
npx expo start -c
```

2. Test each feature in the app:

### Club Search Test:
- Go to Clubs tab → Discover
- Type in search box
- Wait 400ms (should not search on every keystroke)
- Results should appear
- Search for something that doesn't exist → see "No clubs matching 'xyz'" message

### Gold Shop Test:
- Go to Shop tab
- Tap "Buy" on any package
- See confirmation dialog with price and amount
- Tap "Buy Now"
- See loading state
- See success message
- Balance should update

### Table Join Test:
- Go to a club you're a member of
- Go to Tables tab
- Find a table created by another user
- Tap "Join"
- See loading state
- See success message
- Table should show as "playing"

---

## FILES MODIFIED SUMMARY

| File | Changes |
|------|---------|
| app/(tabs)/clubs.tsx | Added debounce, improved empty state |
| services/api/goldApi.ts | Added demoPurchase method |
| app/(tabs)/shop.tsx | Implemented purchase flow |
| services/api/clubsApi.ts | Added joinTable method |
| app/club/[id].tsx | Implemented table join handler |

---

## ⚠️ IMPORTANT

- Do NOT touch any files in backgammon-backend/
- Make sure all imports are added at the top of files
- If Toast component doesn't exist, use Alert.alert() instead
- Adapt the code to match your existing patterns (state management, API calls, etc.)
- Test on a real device or emulator, not just web
