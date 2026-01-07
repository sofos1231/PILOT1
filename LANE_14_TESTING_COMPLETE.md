# 🧪 LANE 14: TESTING & BUG FIXES - COMPLETE
## Comprehensive Testing Checklist & Common Bug Fixes
## Test Every Feature End-to-End

---

## OVERVIEW

**Goal:**
- Test every feature manually
- Find and fix bugs
- Ensure everything works end-to-end
- Document any issues

**Time:** 60 minutes

**Prerequisites:**
- Lanes 8-13 complete
- Backend running on port 8000
- Frontend running in Expo
- Physical device or emulator ready

---

## PHASE 1: SETUP VERIFICATION

### Step 1.1: Verify Backend is Running

```bash
cd ~/PILOT1/backgammon-backend
npm run dev
```

Expected output:
```
Server running on port 8000
Database connected
WebSocket server initialized
Matchmaking queue processor started
```

### Step 1.2: Verify Database Connection

```bash
# Test health endpoint
curl http://localhost:8000/v1/health
```

Expected: `{"success":true,"message":"Server is healthy"}`

### Step 1.3: Verify Frontend is Running

```bash
cd ~/PILOT1/backgammon-mobile
npx expo start --clear
```

Scan QR code with Expo Go app.

---

## PHASE 2: AUTHENTICATION TESTING

### Test 2.1: Fresh Registration

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 1 | Open app | Welcome screen shows | ☐ |
| 2 | Tap "Get Started" | Registration form shows | ☐ |
| 3 | Enter email: test@test.com | Field accepts input | ☐ |
| 4 | Enter username: testuser | Field accepts input | ☐ |
| 5 | Enter password: password123 | Field accepts input (masked) | ☐ |
| 6 | Select country | Dropdown works | ☐ |
| 7 | Check age confirmation | Checkbox works | ☐ |
| 8 | Tap Register | Loading indicator shows | ☐ |
| 9 | Wait for response | Navigate to Home tab | ☐ |
| 10 | Check gold balance | Shows 10,000 gold | ☐ |

### Test 2.2: Login with Existing User

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 1 | Logout from app | Back to Welcome screen | ☐ |
| 2 | Tap "Login" | Login form shows | ☐ |
| 3 | Enter credentials | Fields accept input | ☐ |
| 4 | Tap Login | Loading indicator shows | ☐ |
| 5 | Wait for response | Navigate to Home tab | ☐ |
| 6 | Check profile | Correct user data shows | ☐ |

### Test 2.3: Invalid Credentials

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 1 | Try login with wrong password | Error message shows | ☐ |
| 2 | Try login with non-existent email | Error message shows | ☐ |
| 3 | Try register with existing email | Error message shows | ☐ |
| 4 | Try register with existing username | Error message shows | ☐ |

### Common Auth Bugs & Fixes:

**Bug:** Login succeeds but navigates to wrong screen
```typescript
// Fix in login handler:
router.replace('/(tabs)');  // Use replace, not push
```

**Bug:** Token not persisting after app restart
```typescript
// Fix: Ensure AsyncStorage is properly configured in authStore
storage: createJSONStorage(() => AsyncStorage),
```

---

## PHASE 3: PROFILE TESTING

### Test 3.1: Profile Data Display

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 1 | Navigate to Profile tab | Profile loads | ☐ |
| 2 | Check username | Correct username shows | ☐ |
| 3 | Check email | Correct email shows | ☐ |
| 4 | Check gold balance | Correct amount (not 0) | ☐ |
| 5 | Check level | Shows level 1+ | ☐ |
| 6 | Check game stats | Shows wins/losses/matches | ☐ |
| 7 | Pull to refresh | Data refreshes | ☐ |

### Common Profile Bugs & Fixes:

**Bug:** Gold balance shows 0
```typescript
// Fix: Ensure getProfile is called on mount
useEffect(() => {
  fetchProfile();
}, []);
```

**Bug:** Username shows "Player" or "Unknown"
```typescript
// Fix: Check user object exists before rendering
<Text>{user?.username || 'Loading...'}</Text>
```

---

## PHASE 4: SHOP & GOLD TESTING

### Test 4.1: Shop Display

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 1 | Navigate to Shop tab | Shop loads | ☐ |
| 2 | Check gold packages | List of packages shows | ☐ |
| 3 | Check prices | Prices display correctly | ☐ |
| 4 | Check current balance | Balance shows in header | ☐ |

### Test 4.2: Daily Bonus

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 1 | Find Daily Bonus section | Section visible | ☐ |
| 2 | Tap "Claim 500 Gold" | Button responds | ☐ |
| 3 | Wait for response | Success alert shows | ☐ |
| 4 | Check balance | Increased by 500 | ☐ |
| 5 | Try claiming again | "Already claimed" shows | ☐ |

### Test 4.3: Transaction History

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 1 | Tap "Transaction History" | Modal opens | ☐ |
| 2 | Check transactions | List shows past transactions | ☐ |
| 3 | Verify daily bonus transaction | Shows +500 entry | ☐ |

### Common Shop Bugs & Fixes:

**Bug:** goldApi not found
```typescript
// Fix: Ensure goldApi.ts exists and is imported correctly
import { goldApi } from '../../services/api/goldApi';
```

**Bug:** Daily bonus API returns 404
```bash
# Check backend route exists
curl -X POST -H "Authorization: Bearer TOKEN" http://localhost:8000/v1/gold/daily-bonus/claim
```

---

## PHASE 5: PLAY TAB & MATCHMAKING TESTING

### Test 5.1: Play Tab Display

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 1 | Navigate to Play tab | Tab loads | ☐ |
| 2 | Check welcome message | Shows username | ☐ |
| 3 | Check stats | Shows level/wins/matches | ☐ |
| 4 | Check Quick Match button | Button visible | ☐ |
| 5 | Check Practice button | Button visible | ☐ |
| 6 | Check Private Match button | Button visible | ☐ |

### Test 5.2: Quick Match Flow

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 1 | Tap Quick Match | Stake modal opens | ☐ |
| 2 | Select 100 gold stake | Option highlights | ☐ |
| 3 | Tap "Find Match" | Searching state shows | ☐ |
| 4 | Check queue position | Position displays | ☐ |
| 5 | Tap "Cancel" | Returns to normal state | ☐ |

### Test 5.3: Match History

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 1 | Check Recent Matches section | Section visible | ☐ |
| 2 | If no matches | "No matches yet" shows | ☐ |
| 3 | If matches exist | List displays | ☐ |
| 4 | Check match details | Opponent, result, gold change | ☐ |

### Test 5.4: Coming Soon Buttons

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 1 | Tap Practice button | "Coming Soon" alert | ☐ |
| 2 | Tap Private Match button | "Coming Soon" alert | ☐ |

### Common Play Tab Bugs & Fixes:

**Bug:** Match history always empty
```typescript
// Fix: Ensure matchApi.getHistory is called
const { data } = await matchApi.getHistory(10);
```

**Bug:** Stake modal doesn't open
```typescript
// Fix: Check state and handler
const [showStakeModal, setShowStakeModal] = useState(false);
onPress={() => setShowStakeModal(true)}
```

---

## PHASE 6: CLUBS TESTING

### Test 6.1: Clubs Tab Display

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 1 | Navigate to Clubs tab | Tab loads | ☐ |
| 2 | Check "My Clubs" section | Section visible | ☐ |
| 3 | Check "Discover" section | Section visible | ☐ |
| 4 | Search for clubs | Results appear | ☐ |

### Test 6.2: Join Club

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 1 | Find a public club | Club card visible | ☐ |
| 2 | Tap on club | Club detail opens | ☐ |
| 3 | Tap "Join Club" | Join succeeds | ☐ |
| 4 | Check welcome chips | Chips received | ☐ |
| 5 | Check membership | Now a member | ☐ |

### Test 6.3: Club Chat

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 1 | Navigate to Chat tab | Chat loads | ☐ |
| 2 | Check message history | Messages display | ☐ |
| 3 | Type a message | Input accepts text | ☐ |
| 4 | Tap Send | Message appears | ☐ |
| 5 | Refresh chat | Message persists | ☐ |

### Test 6.4: Club Tables

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 1 | Navigate to Tables tab | Tables load | ☐ |
| 2 | Tap "Create Table" | Modal opens | ☐ |
| 3 | Select stake | Option highlights | ☐ |
| 4 | Tap "Create Table" | Table created | ☐ |
| 5 | Check tables list | New table shows | ☐ |
| 6 | Cancel table | Table removed | ☐ |

### Test 6.5: Leave Club

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 1 | Tap leave button | Confirmation shows | ☐ |
| 2 | Confirm leave | Leave succeeds | ☐ |
| 3 | Check My Clubs | Club removed | ☐ |

### Common Club Bugs & Fixes:

**Bug:** Chat messages don't appear in real-time
```typescript
// Fix: Ensure WebSocket is connected and listening
useEffect(() => {
  wsService.joinClub(clubId);
  const unsubscribe = wsService.on('club_chat_message', handleMessage);
  return () => {
    unsubscribe();
    wsService.leaveClub(clubId);
  };
}, [clubId]);
```

**Bug:** Tables list doesn't refresh after creation
```typescript
// Fix: Call fetchTables after successful creation
if (data.success) {
  setShowCreateTableModal(false);
  fetchTables(); // <-- Add this
}
```

---

## PHASE 7: LEADERBOARD TESTING

### Test 7.1: Leaderboard Display

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 1 | Navigate to Leaderboard tab | Tab loads | ☐ |
| 2 | Check rankings list | Users display | ☐ |
| 3 | Check sort by Wins | List re-sorts | ☐ |
| 4 | Check sort by Level | List re-sorts | ☐ |
| 5 | Check sort by Gold | List re-sorts | ☐ |
| 6 | Check sort by Win Rate | List re-sorts | ☐ |
| 7 | Find own rank | Highlighted in list | ☐ |

### Common Leaderboard Bugs & Fixes:

**Bug:** Leaderboard empty
```typescript
// Fix: Check API call
const { data } = await leaderboardApi.getLeaderboard(sortBy, 50);
```

---

## PHASE 8: GAMEPLAY TESTING (Requires 2 Users)

### Test 8.1: Full Match Flow

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 1 | User A: Join queue (100 gold) | Searching shows | ☐ |
| 2 | User B: Join queue (100 gold) | Match found | ☐ |
| 3 | Both: See match screen | Ready screen shows | ☐ |
| 4 | Both: Tap Ready | Ready status updates | ☐ |
| 5 | Game starts | Board displays | ☐ |
| 6 | Current player: Roll dice | Dice values show | ☐ |
| 7 | Current player: Make move | Move executes | ☐ |
| 8 | Turn switches | Other player's turn | ☐ |
| 9 | Continue until game ends | Winner announced | ☐ |
| 10 | Check gold transfer | Winner gained, loser lost | ☐ |

### Test 8.2: Forfeit

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 1 | Start a match | Game begins | ☐ |
| 2 | Tap Forfeit button | Confirmation shows | ☐ |
| 3 | Confirm forfeit | Match ends | ☐ |
| 4 | Opponent wins | Gold transferred | ☐ |

### Common Gameplay Bugs & Fixes:

**Bug:** Board doesn't update after move
```typescript
// Fix: Ensure state updates from WebSocket
wsService.on('move_made', (data) => {
  setGameState(data.game_state);
});
```

**Bug:** Dice roll doesn't work
```typescript
// Fix: Check API call and response handling
const { data } = await matchApi.roll(matchId);
if (data.success) {
  setDice(data.dice);
}
```

---

## PHASE 9: ERROR HANDLING TESTING

### Test 9.1: Network Errors

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 1 | Turn on airplane mode | Offline alert shows | ☐ |
| 2 | Try to refresh data | Error handled gracefully | ☐ |
| 3 | Turn off airplane mode | "Back online" shows | ☐ |
| 4 | Data refreshes | Works normally | ☐ |

### Test 9.2: Error Boundaries

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 1 | Trigger an error (dev) | Error boundary catches | ☐ |
| 2 | "Try Again" button | App recovers | ☐ |

---

## PHASE 10: BUG TRACKING TEMPLATE

### Found Bugs

| # | Screen | Description | Severity | Status |
|---|--------|-------------|----------|--------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |

### Severity Levels:
- 🔴 **Critical** - App crashes or major feature broken
- 🟠 **High** - Feature doesn't work but app runs
- 🟡 **Medium** - Feature works but incorrectly
- 🟢 **Low** - Minor UI or cosmetic issue

---

## PHASE 11: COMMON FIXES REFERENCE

### Fix 1: API Call Not Working

```typescript
// Check 1: Is the API function defined?
// Check 2: Is it imported correctly?
// Check 3: Is the endpoint URL correct?
// Check 4: Is auth token being sent?

// Debug with console.log:
try {
  console.log('Calling API...');
  const { data } = await api.someFunction();
  console.log('Response:', data);
} catch (error) {
  console.error('Error:', error.response?.data || error.message);
}
```

### Fix 2: State Not Updating

```typescript
// Wrong: Mutating state directly
state.items.push(newItem);

// Correct: Creating new state
setItems([...items, newItem]);
```

### Fix 3: useEffect Running Too Often

```typescript
// Wrong: Missing dependency array
useEffect(() => {
  fetchData();
}); // Runs on every render!

// Correct: With dependencies
useEffect(() => {
  fetchData();
}, []); // Runs once on mount

// Or with specific dependencies
useEffect(() => {
  fetchData();
}, [userId]); // Runs when userId changes
```

### Fix 4: Navigation Not Working

```typescript
// Ensure router is imported
import { useRouter } from 'expo-router';
const router = useRouter();

// Use correct navigation method
router.push('/path');     // Add to stack
router.replace('/path');  // Replace current
router.back();            // Go back
```

### Fix 5: WebSocket Not Connecting

```typescript
// Check 1: Is token valid?
// Check 2: Is WebSocket URL correct?
// Check 3: Is socket.connect() called?

// Debug:
socket.on('connect', () => console.log('WS Connected'));
socket.on('connect_error', (err) => console.log('WS Error:', err));
```

---

## ✅ LANE 14 VERIFICATION CHECKLIST

After testing, verify:

- [ ] All auth flows work (register, login, logout)
- [ ] Profile shows correct data
- [ ] Shop loads packages and daily bonus works
- [ ] Play tab shows match history
- [ ] Quick Match flow works
- [ ] Clubs can be joined/left
- [ ] Club chat sends and receives messages
- [ ] Club tables can be created
- [ ] Leaderboard displays rankings
- [ ] Error handling is graceful
- [ ] All found bugs documented

---

## 📁 FILES CREATED/MODIFIED

| File | Action |
|------|--------|
| Various | Bug fixes as needed |

---

## 🚀 READY FOR LANE 15

After Lane 14 is complete:
- All features tested
- Bugs identified and fixed
- App is stable

Proceed to **Lane 15: Final Integration**
