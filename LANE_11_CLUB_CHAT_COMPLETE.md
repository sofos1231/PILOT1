# 💬 LANE 11: CLUB CHAT - COMPLETE
## Wire Real-Time Club Chat
## Copy-Paste Ready Code

---

## OVERVIEW

**Problem:**
- Club detail page says "Chat coming soon!"
- WebSocket chat is fully implemented on backend
- useClubSocket hook exists but not used
- clubsApi.getChatHistory() never called

**Solution:**
- Add chat UI section to club detail
- Load chat history on mount
- Send messages via WebSocket
- Display real-time incoming messages

**Time:** 30 minutes

**Prerequisites:**
- Lanes 8-10 complete
- Backend running on port 8000
- WebSocket service connected

---

## PHASE 1: Update Club Detail Screen

### Step 1.1: Replace club/[id].tsx

Replace the entire contents of `app/club/[id].tsx`:

```typescript
import { useEffect, useState, useCallback, useRef } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/authStore';
import { useClubStore } from '../../store/clubStore';
import { clubsApi } from '../../services/api/clubsApi';
import { wsService } from '../../services/websocket';

// ==================== TYPES ====================
interface ChatMessage {
  message_id: string;
  user_id: string;
  username: string;
  message: string;
  message_type: 'text' | 'system' | 'emote';
  created_at: string;
}

interface ClubMember {
  user_id: string;
  username: string;
  role: 'owner' | 'admin' | 'member';
  chip_balance: number;
  joined_at: string;
}

// ==================== COMPONENT ====================
export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { currentClub, setCurrentClub, leaveClub: leaveClubStore } = useClubStore();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'members' | 'tables'>('chat');
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatScrollRef = useRef<FlatList>(null);

  // Members state
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Membership state
  const [isMember, setIsMember] = useState(false);
  const [myRole, setMyRole] = useState<'owner' | 'admin' | 'member' | null>(null);
  const [myChipBalance, setMyChipBalance] = useState(0);

  // ==================== DATA FETCHING ====================
  const fetchClubDetails = useCallback(async () => {
    if (!id) return;

    try {
      const { data } = await clubsApi.getClubById(id);
      if (data.success) {
        setCurrentClub(data.club);
        
        // Check membership
        if (data.membership) {
          setIsMember(true);
          setMyRole(data.membership.role);
          setMyChipBalance(data.membership.chip_balance || 0);
        } else {
          setIsMember(false);
          setMyRole(null);
        }
      }
    } catch (error) {
      console.error('Failed to fetch club:', error);
      Alert.alert('Error', 'Failed to load club details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, setCurrentClub]);

  const fetchChatHistory = useCallback(async () => {
    if (!id || !isMember) return;

    setLoadingChat(true);
    try {
      const { data } = await clubsApi.getChatHistory(id, 50);
      if (data.success) {
        setChatMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Failed to load chat:', error);
    } finally {
      setLoadingChat(false);
    }
  }, [id, isMember]);

  const fetchMembers = useCallback(async () => {
    if (!id) return;

    setLoadingMembers(true);
    try {
      const { data } = await clubsApi.getMembers(id);
      if (data.success) {
        setMembers(data.members || []);
      }
    } catch (error) {
      console.error('Failed to load members:', error);
    } finally {
      setLoadingMembers(false);
    }
  }, [id]);

  // Initial load
  useEffect(() => {
    fetchClubDetails();
  }, [fetchClubDetails]);

  // Load chat when becoming member or switching to chat tab
  useEffect(() => {
    if (isMember && activeTab === 'chat') {
      fetchChatHistory();
    }
  }, [isMember, activeTab, fetchChatHistory]);

  // Load members when switching to members tab
  useEffect(() => {
    if (activeTab === 'members') {
      fetchMembers();
    }
  }, [activeTab, fetchMembers]);

  // ==================== WEBSOCKET ====================
  useEffect(() => {
    if (!id || !isMember) return;

    // Join club room
    wsService.joinClub(id);

    // Listen for new messages
    const unsubscribe = wsService.on('club_chat_message', (data: any) => {
      if (data.club_id === id) {
        const newMessage: ChatMessage = {
          message_id: data.message?.message_id || Date.now().toString(),
          user_id: data.message?.user_id || data.user_id,
          username: data.message?.username || data.username,
          message: data.message?.message || data.message,
          message_type: 'text',
          created_at: data.message?.timestamp || new Date().toISOString(),
        };
        setChatMessages((prev) => [...prev, newMessage]);
      }
    });

    return () => {
      unsubscribe();
      wsService.leaveClub(id);
    };
  }, [id, isMember]);

  // ==================== HANDLERS ====================
  const handleRefresh = () => {
    setRefreshing(true);
    fetchClubDetails();
    if (isMember) fetchChatHistory();
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || sendingMessage || !id) return;

    const messageText = chatInput.trim();
    setChatInput('');
    setSendingMessage(true);

    try {
      // Send via WebSocket
      wsService.sendClubMessage(id, messageText);
      
      // Optimistically add to local state
      const optimisticMessage: ChatMessage = {
        message_id: `temp-${Date.now()}`,
        user_id: user?.user_id || '',
        username: user?.username || 'You',
        message: messageText,
        message_type: 'text',
        created_at: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, optimisticMessage]);
      
      // Scroll to bottom
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert('Error', 'Failed to send message');
      setChatInput(messageText); // Restore input
    } finally {
      setSendingMessage(false);
    }
  };

  const handleJoinClub = async () => {
    if (!id) return;

    try {
      const { data } = await clubsApi.joinClub(id);
      if (data.success) {
        setIsMember(true);
        setMyRole('member');
        setMyChipBalance(data.chip_balance || 0);
        fetchClubDetails();
        Alert.alert('Welcome!', `You joined ${currentClub?.name}!\n\nYou received ${data.chip_balance || 0} welcome chips.`);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to join club');
    }
  };

  const handleLeaveClub = async () => {
    if (!id) return;

    Alert.alert(
      'Leave Club',
      `Are you sure you want to leave ${currentClub?.name}?\n\nYou will lose your chip balance.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveClubStore(id);
              setIsMember(false);
              setMyRole(null);
              fetchClubDetails();
              Alert.alert('Left Club', 'You have left the club.');
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.error || 'Failed to leave club');
            }
          },
        },
      ]
    );
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return '#F59E0B';
      case 'admin':
        return '#667eea';
      default:
        return '#9CA3AF';
    }
  };

  // ==================== RENDER ====================
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading club...</Text>
      </View>
    );
  }

  if (!currentClub) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#DC2626" />
        <Text style={styles.errorText}>Club not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: currentClub.name,
          headerRight: () =>
            isMember ? (
              <TouchableOpacity onPress={handleLeaveClub}>
                <Ionicons name="exit-outline" size={24} color="#DC2626" />
              </TouchableOpacity>
            ) : null,
        }}
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {/* ==================== HEADER INFO ==================== */}
        <View style={styles.header}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <Text style={styles.clubName}>{currentClub.name}</Text>
                <Text style={styles.clubMembers}>
                  {currentClub.member_count || 0} members
                </Text>
              </View>
              {isMember && (
                <View style={styles.chipBadge}>
                  <Text style={styles.chipText}>💰 {myChipBalance.toLocaleString()}</Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </View>

        {/* ==================== NOT A MEMBER ==================== */}
        {!isMember && (
          <View style={styles.joinPrompt}>
            <Text style={styles.joinPromptText}>
              Join this club to chat and play with members!
            </Text>
            <TouchableOpacity style={styles.joinButton} onPress={handleJoinClub}>
              <Ionicons name="add-circle" size={20} color="white" />
              <Text style={styles.joinButtonText}>Join Club</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ==================== TAB BAR ==================== */}
        {isMember && (
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'chat' && styles.tabActive]}
              onPress={() => setActiveTab('chat')}
            >
              <Ionicons
                name="chatbubbles"
                size={20}
                color={activeTab === 'chat' ? '#667eea' : '#9CA3AF'}
              />
              <Text style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>
                Chat
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'members' && styles.tabActive]}
              onPress={() => setActiveTab('members')}
            >
              <Ionicons
                name="people"
                size={20}
                color={activeTab === 'members' ? '#667eea' : '#9CA3AF'}
              />
              <Text style={[styles.tabText, activeTab === 'members' && styles.tabTextActive]}>
                Members
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'tables' && styles.tabActive]}
              onPress={() => setActiveTab('tables')}
            >
              <Ionicons
                name="grid"
                size={20}
                color={activeTab === 'tables' ? '#667eea' : '#9CA3AF'}
              />
              <Text style={[styles.tabText, activeTab === 'tables' && styles.tabTextActive]}>
                Tables
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ==================== CHAT TAB ==================== */}
        {isMember && activeTab === 'chat' && (
          <View style={styles.chatContainer}>
            {loadingChat ? (
              <View style={styles.chatLoading}>
                <ActivityIndicator color="#667eea" />
                <Text style={styles.chatLoadingText}>Loading messages...</Text>
              </View>
            ) : chatMessages.length === 0 ? (
              <View style={styles.chatEmpty}>
                <Ionicons name="chatbubble-outline" size={48} color="#D1D5DB" />
                <Text style={styles.chatEmptyText}>No messages yet</Text>
                <Text style={styles.chatEmptySubtext}>Be the first to say hello!</Text>
              </View>
            ) : (
              <FlatList
                ref={chatScrollRef}
                data={chatMessages}
                keyExtractor={(item) => item.message_id}
                contentContainerStyle={styles.chatList}
                onContentSizeChange={() => chatScrollRef.current?.scrollToEnd()}
                renderItem={({ item }) => {
                  const isMe = item.user_id === user?.user_id;
                  return (
                    <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
                      {!isMe && (
                        <View style={styles.messageAvatar}>
                          <Text style={styles.messageAvatarText}>
                            {item.username.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={[styles.messageBubble, isMe && styles.messageBubbleMe]}>
                        {!isMe && (
                          <Text style={styles.messageUsername}>{item.username}</Text>
                        )}
                        <Text style={[styles.messageText, isMe && styles.messageTextMe]}>
                          {item.message}
                        </Text>
                        <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>
                          {formatTime(item.created_at)}
                        </Text>
                      </View>
                    </View>
                  );
                }}
              />
            )}

            {/* Chat Input */}
            <View style={styles.chatInputContainer}>
              <TextInput
                style={styles.chatInput}
                placeholder="Type a message..."
                placeholderTextColor="#9CA3AF"
                value={chatInput}
                onChangeText={setChatInput}
                onSubmitEditing={handleSendMessage}
                returnKeyType="send"
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.sendButton, !chatInput.trim() && styles.sendButtonDisabled]}
                onPress={handleSendMessage}
                disabled={!chatInput.trim() || sendingMessage}
              >
                {sendingMessage ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="send" size={20} color="white" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ==================== MEMBERS TAB ==================== */}
        {isMember && activeTab === 'members' && (
          <ScrollView
            style={styles.membersContainer}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
          >
            {loadingMembers ? (
              <ActivityIndicator style={{ padding: 32 }} color="#667eea" />
            ) : (
              members.map((member) => (
                <View key={member.user_id} style={styles.memberCard}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>
                      {member.username.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <View style={styles.memberNameRow}>
                      <Text style={styles.memberName}>{member.username}</Text>
                      {member.user_id === user?.user_id && (
                        <Text style={styles.youBadge}>(You)</Text>
                      )}
                    </View>
                    <View style={styles.memberMeta}>
                      <View
                        style={[
                          styles.roleBadge,
                          { backgroundColor: getRoleBadgeColor(member.role) },
                        ]}
                      >
                        <Text style={styles.roleBadgeText}>{member.role}</Text>
                      </View>
                      <Text style={styles.memberChips}>
                        💰 {member.chip_balance.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* ==================== TABLES TAB ==================== */}
        {isMember && activeTab === 'tables' && (
          <View style={styles.tablesContainer}>
            <View style={styles.tablesEmpty}>
              <Ionicons name="grid-outline" size={48} color="#D1D5DB" />
              <Text style={styles.tablesEmptyText}>No tables yet</Text>
              <Text style={styles.tablesEmptySubtext}>
                Create a table to start playing!
              </Text>
              <TouchableOpacity
                style={styles.createTableButton}
                onPress={() => Alert.alert('Coming Soon', 'Table creation coming in Lane 12!')}
              >
                <Ionicons name="add" size={20} color="white" />
                <Text style={styles.createTableButtonText}>Create Table</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </>
  );
}

// ==================== STYLES ====================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    color: '#DC2626',
    marginTop: 12,
  },
  backButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#667eea',
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontWeight: '600',
  },

  // Header
  header: {
    overflow: 'hidden',
  },
  headerGradient: {
    padding: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {},
  clubName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  clubMembers: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  chipBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipText: {
    color: 'white',
    fontWeight: '600',
  },

  // Join Prompt
  joinPrompt: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  joinPromptText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  joinButtonText: {
    color: 'white',
    fontWeight: '600',
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#667eea',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  tabTextActive: {
    color: '#667eea',
  },

  // Chat
  chatContainer: {
    flex: 1,
  },
  chatLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatLoadingText: {
    marginTop: 12,
    color: '#6B7280',
  },
  chatEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatEmptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
  chatEmptySubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  chatList: {
    padding: 16,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  messageRowMe: {
    flexDirection: 'row-reverse',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  messageAvatarText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  messageBubble: {
    backgroundColor: 'white',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    maxWidth: '75%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageBubbleMe: {
    backgroundColor: '#667eea',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  messageUsername: {
    fontSize: 12,
    fontWeight: '600',
    color: '#667eea',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#1F2937',
  },
  messageTextMe: {
    color: 'white',
  },
  messageTime: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageTimeMe: {
    color: 'rgba(255,255,255,0.7)',
  },

  // Chat Input
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 14,
    color: '#1F2937',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },

  // Members
  membersContainer: {
    flex: 1,
    padding: 16,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  youBadge: {
    fontSize: 12,
    color: '#667eea',
  },
  memberMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  memberChips: {
    fontSize: 12,
    color: '#6B7280',
  },

  // Tables
  tablesContainer: {
    flex: 1,
  },
  tablesEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  tablesEmptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
  tablesEmptySubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  createTableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 20,
  },
  createTableButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});
```

---

## PHASE 2: Add WebSocket Methods

### Step 2.1: Ensure wsService has club methods

Check `services/websocket.ts` has these methods:

```typescript
joinClub(clubId: string) {
  if (this.socket?.connected) {
    this.socket.emit('join_club', { club_id: clubId });
  }
}

leaveClub(clubId: string) {
  if (this.socket?.connected) {
    this.socket.emit('leave_club', { club_id: clubId });
  }
}

sendClubMessage(clubId: string, message: string) {
  if (this.socket?.connected) {
    this.socket.emit('club_chat_message', { club_id: clubId, message });
  }
}
```

### Step 2.2: Add getChatHistory to clubsApi

Check `services/api/clubsApi.ts` has:

```typescript
getChatHistory: (clubId: string, limit?: number) =>
  apiClient.get<{ success: boolean; messages: any[] }>(
    `/clubs/${clubId}/chat`,
    { params: { limit } }
  ),
```

---

## ✅ LANE 11 VERIFICATION CHECKLIST

After implementing, verify:

- [ ] Club detail page loads without errors
- [ ] Non-members see "Join Club" prompt
- [ ] Members see tab bar (Chat, Members, Tables)
- [ ] Chat tab shows message history
- [ ] Can type and send messages
- [ ] Messages appear immediately (optimistic update)
- [ ] Other users' messages appear in real-time
- [ ] Members tab shows list of members with roles
- [ ] Tables tab shows empty state with create button
- [ ] Chip balance displays in header
- [ ] Leave club button works

---

## 📁 FILES CREATED/MODIFIED

| File | Action |
|------|--------|
| `app/club/[id].tsx` | REPLACE |
| `services/websocket.ts` | VERIFY/UPDATE |
| `services/api/clubsApi.ts` | VERIFY/UPDATE |

---

## 🚀 READY FOR LANE 12

After Lane 11 is complete:
- Club chat is fully functional
- Real-time messages work
- Members list displays
- Tables tab ready for Lane 12

Proceed to **Lane 12: Club Tables & Games**
