"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wsUtils = void 0;
exports.initializeWebSocket = initializeWebSocket;
exports.getIO = getIO;
const socket_io_1 = require("socket.io");
const jwt_utils_1 = require("../utils/jwt.utils");
const users_repository_1 = require("../repositories/users.repository");
let io;
// Track user connections: userId -> Set of socketIds
const userSockets = new Map();
// Track which matches/clubs each socket is in
const socketRooms = new Map();
// Rate limiting for chat
const chatRateLimit = new Map();
const CHAT_RATE_LIMIT = 10; // messages
const CHAT_RATE_WINDOW = 10000; // 10 seconds
function initializeWebSocket(server) {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: process.env.CORS_ORIGIN === '*' ? '*' : process.env.CORS_ORIGIN?.split(','),
            credentials: true,
        },
        pingTimeout: 60000,
        pingInterval: 25000,
        transports: ['websocket', 'polling'],
    });
    // Authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication required'));
            }
            const decoded = (0, jwt_utils_1.verifyAccessToken)(token);
            const user = await users_repository_1.usersRepository.findById(decoded.userId);
            if (!user) {
                return next(new Error('User not found'));
            }
            if (!user.is_active || user.is_banned) {
                return next(new Error('Account is not active'));
            }
            // Attach user data to socket
            socket.data.userId = decoded.userId;
            socket.data.email = decoded.email;
            socket.data.username = user.username;
            next();
        }
        catch (error) {
            console.error('WebSocket auth error:', error);
            next(new Error('Authentication failed'));
        }
    });
    io.on('connection', (socket) => {
        const userId = socket.data.userId;
        const username = socket.data.username;
        console.log(`✅ User connected: ${username} (${userId}) - Socket: ${socket.id}`);
        // Track socket
        if (!userSockets.has(userId)) {
            userSockets.set(userId, new Set());
        }
        userSockets.get(userId).add(socket.id);
        socketRooms.set(socket.id, new Set());
        // Join user's personal room for notifications
        socket.join(`user:${userId}`);
        socketRooms.get(socket.id).add(`user:${userId}`);
        // Emit authenticated event
        socket.emit('authenticated', { user_id: userId, username });
        // ===== MATCH EVENTS =====
        socket.on('join_match', ({ match_id }) => {
            const room = `match:${match_id}`;
            socket.join(room);
            socketRooms.get(socket.id).add(room);
            console.log(`📍 ${username} joined match room: ${match_id}`);
            // Notify opponent
            socket.to(room).emit('player_joined', {
                match_id,
                user_id: userId,
                username,
            });
        });
        socket.on('leave_match', ({ match_id }) => {
            const room = `match:${match_id}`;
            socket.leave(room);
            socketRooms.get(socket.id)?.delete(room);
            console.log(`📍 ${username} left match room: ${match_id}`);
        });
        socket.on('player_ready', ({ match_id }) => {
            const room = `match:${match_id}`;
            io.to(room).emit('player_ready_status', {
                match_id,
                user_id: userId,
                ready: true,
            });
        });
        // ===== CLUB EVENTS =====
        socket.on('join_club_room', ({ club_id }) => {
            const room = `club:${club_id}`;
            socket.join(room);
            socketRooms.get(socket.id).add(room);
            console.log(`📍 ${username} joined club room: ${club_id}`);
            // Notify other club members
            socket.to(room).emit('club_member_online', {
                club_id,
                user_id: userId,
                username,
            });
        });
        socket.on('leave_club_room', ({ club_id }) => {
            const room = `club:${club_id}`;
            socket.leave(room);
            socketRooms.get(socket.id)?.delete(room);
            socket.to(room).emit('club_member_offline', {
                club_id,
                user_id: userId,
            });
        });
        socket.on('send_chat_message', ({ club_id, content }) => {
            // Rate limiting
            if (!checkChatRateLimit(userId)) {
                socket.emit('error', {
                    code: 'RATE_LIMITED',
                    message: 'Too many messages. Please slow down.'
                });
                return;
            }
            // Sanitize content (basic XSS prevention)
            const sanitizedContent = sanitizeMessage(content);
            if (!sanitizedContent || sanitizedContent.length > 500) {
                socket.emit('error', {
                    code: 'INVALID_MESSAGE',
                    message: 'Message is empty or too long'
                });
                return;
            }
            const message = {
                message_id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                user_id: userId,
                username,
                avatar_url: undefined, // Could fetch from user
                content: sanitizedContent,
                timestamp: new Date().toISOString(),
            };
            // Emit to all club members including sender
            io.to(`club:${club_id}`).emit('club_chat_message', {
                club_id,
                message,
            });
        });
        // ===== HEARTBEAT =====
        socket.on('ping', () => {
            socket.emit('pong');
        });
        // ===== DISCONNECT =====
        socket.on('disconnect', (reason) => {
            console.log(`❌ User disconnected: ${username} (${userId}) - Reason: ${reason}`);
            // Clean up tracking
            const userSocketSet = userSockets.get(userId);
            if (userSocketSet) {
                userSocketSet.delete(socket.id);
                if (userSocketSet.size === 0) {
                    userSockets.delete(userId);
                }
            }
            // Notify rooms the user was in
            const rooms = socketRooms.get(socket.id);
            if (rooms) {
                rooms.forEach(room => {
                    if (room.startsWith('match:')) {
                        const matchId = room.replace('match:', '');
                        socket.to(room).emit('opponent_disconnected', {
                            match_id: matchId,
                            user_id: userId,
                            reconnect_deadline: new Date(Date.now() + 60000).toISOString(), // 1 minute
                        });
                    }
                    else if (room.startsWith('club:')) {
                        const clubId = room.replace('club:', '');
                        socket.to(room).emit('club_member_offline', {
                            club_id: clubId,
                            user_id: userId,
                        });
                    }
                });
                socketRooms.delete(socket.id);
            }
        });
    });
    console.log('✅ WebSocket server initialized');
    return io;
}
// ===== UTILITY FUNCTIONS =====
function checkChatRateLimit(userId) {
    const now = Date.now();
    const userMessages = chatRateLimit.get(userId) || [];
    // Remove old messages outside window
    const recentMessages = userMessages.filter(time => now - time < CHAT_RATE_WINDOW);
    if (recentMessages.length >= CHAT_RATE_LIMIT) {
        return false;
    }
    recentMessages.push(now);
    chatRateLimit.set(userId, recentMessages);
    return true;
}
function sanitizeMessage(content) {
    return content
        .trim()
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
// ===== EXPORTED UTILITIES =====
function getIO() {
    if (!io) {
        throw new Error('WebSocket not initialized');
    }
    return io;
}
exports.wsUtils = {
    /**
     * Emit to a specific user (all their connected devices)
     */
    emitToUser(userId, event, data) {
        io.to(`user:${userId}`).emit(event, data);
    },
    /**
     * Emit to all participants in a match
     */
    emitToMatch(matchId, event, data) {
        io.to(`match:${matchId}`).emit(event, data);
    },
    /**
     * Emit to all members in a club
     */
    emitToClub(clubId, event, data) {
        io.to(`club:${clubId}`).emit(event, data);
    },
    /**
     * Check if a user is online
     */
    isUserOnline(userId) {
        const sockets = userSockets.get(userId);
        return !!sockets && sockets.size > 0;
    },
    /**
     * Get count of online users
     */
    getOnlineUserCount() {
        return userSockets.size;
    },
    /**
     * Get all socket IDs for a user
     */
    getUserSockets(userId) {
        return Array.from(userSockets.get(userId) || []);
    },
};
