"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchesService = exports.MatchesService = void 0;
const connection_1 = __importDefault(require("../db/connection"));
const matches_repository_1 = require("../repositories/matches.repository");
const users_repository_1 = require("../repositories/users.repository");
const gold_repository_1 = require("../repositories/gold.repository");
const game_engine_service_1 = require("./game-engine.service");
const websocket_1 = require("../websocket");
const AppError_1 = require("../errors/AppError");
class MatchesService {
    /**
     * Get match details
     */
    async getMatch(matchId, userId) {
        const match = await matches_repository_1.matchesRepository.findById(matchId);
        if (!match) {
            throw new AppError_1.NotFoundError('Match');
        }
        let result = { ...match };
        if (userId) {
            if (match.player_white_id === userId) {
                result.your_color = 'white';
            }
            else if (match.player_black_id === userId) {
                result.your_color = 'black';
            }
        }
        return result;
    }
    /**
     * Set player ready
     */
    async setReady(matchId, userId) {
        const match = await matches_repository_1.matchesRepository.findById(matchId);
        if (!match) {
            throw new AppError_1.NotFoundError('Match');
        }
        if (match.status !== 'ready' && match.status !== 'waiting') {
            throw new AppError_1.ValidationError('Match already started or completed');
        }
        const isWhite = match.player_white_id === userId;
        const isBlack = match.player_black_id === userId;
        if (!isWhite && !isBlack) {
            throw new AppError_1.ForbiddenError('Not a player in this match');
        }
        await matches_repository_1.matchesRepository.setPlayerReady(matchId, userId, isWhite);
        // Notify opponent
        websocket_1.wsUtils.emitToMatch(matchId, 'player_ready_status', {
            match_id: matchId,
            user_id: userId,
            ready: true,
        });
        // Check if both ready
        const updatedMatch = await matches_repository_1.matchesRepository.findById(matchId);
        const bothReady = updatedMatch.player_white_ready && updatedMatch.player_black_ready;
        if (bothReady) {
            // Initialize game and start
            const gameState = game_engine_service_1.gameEngineService.initializeGame();
            const dice = game_engine_service_1.gameEngineService.rollDice();
            gameState.dice = dice;
            await matches_repository_1.matchesRepository.updateGameState(matchId, gameState);
            await matches_repository_1.matchesRepository.updateStatus(matchId, 'in_progress');
            // Notify both players
            websocket_1.wsUtils.emitToMatch(matchId, 'match_started', {
                match_id: matchId,
                game_state: gameState,
            });
            return { both_ready: true, game_state: gameState };
        }
        return { both_ready: false };
    }
    /**
     * Roll dice
     */
    async rollDice(matchId, userId) {
        const match = await matches_repository_1.matchesRepository.findById(matchId);
        if (!match) {
            throw new AppError_1.NotFoundError('Match');
        }
        if (match.status !== 'in_progress') {
            throw new AppError_1.ValidationError('Match not in progress');
        }
        const isWhite = match.player_white_id === userId;
        const isBlack = match.player_black_id === userId;
        if (!isWhite && !isBlack) {
            throw new AppError_1.ForbiddenError('Not a player in this match');
        }
        const playerColor = isWhite ? 'white' : 'black';
        const gameState = match.game_state;
        if (gameState.current_turn !== playerColor) {
            throw new AppError_1.ValidationError('Not your turn');
        }
        if (gameState.dice.length > 0 && gameState.dice.some(d => !d.used)) {
            throw new AppError_1.ValidationError('Dice already rolled, make your moves');
        }
        // Roll dice
        const dice = game_engine_service_1.gameEngineService.rollDice();
        gameState.dice = dice;
        await matches_repository_1.matchesRepository.updateGameState(matchId, gameState);
        // Get legal moves
        const legalMoves = game_engine_service_1.gameEngineService.getLegalMoves(gameState);
        // Notify opponent
        websocket_1.wsUtils.emitToMatch(matchId, 'turn_changed', {
            match_id: matchId,
            current_turn: playerColor,
            dice: dice,
            deadline: new Date(Date.now() + 60000).toISOString(), // 60 second turn
        });
        return { dice, legal_moves: legalMoves };
    }
    /**
     * Make a move
     */
    async makeMove(matchId, userId, moves) {
        const match = await matches_repository_1.matchesRepository.findById(matchId);
        if (!match) {
            throw new AppError_1.NotFoundError('Match');
        }
        if (match.status !== 'in_progress') {
            throw new AppError_1.ValidationError('Match not in progress');
        }
        const isWhite = match.player_white_id === userId;
        const playerColor = isWhite ? 'white' : 'black';
        let gameState = match.game_state;
        if (gameState.current_turn !== playerColor) {
            throw new AppError_1.ValidationError('Not your turn');
        }
        // Apply each move
        for (const move of moves) {
            const legalMoves = game_engine_service_1.gameEngineService.getLegalMoves(gameState);
            const isLegal = legalMoves.some(m => m.from === move.from && m.to === move.to && m.die_value === move.die_value);
            if (!isLegal) {
                throw new AppError_1.ValidationError('Illegal move');
            }
            gameState = game_engine_service_1.gameEngineService.applyMove(gameState, move);
        }
        // Check if turn is complete (all dice used or no legal moves)
        const remainingMoves = game_engine_service_1.gameEngineService.getLegalMoves(gameState);
        const turnComplete = remainingMoves.length === 0;
        // Check for game over
        const gameOver = game_engine_service_1.gameEngineService.isGameOver(gameState);
        let winner;
        if (gameOver) {
            const opponentId = isWhite ? match.player_black_id : match.player_white_id;
            if (!opponentId) {
                throw new AppError_1.ValidationError('Invalid match state: missing opponent');
            }
            winner = gameState.off[playerColor] === 15 ? userId : opponentId;
            await this.completeMatch(matchId, winner, match);
        }
        else if (turnComplete) {
            // Switch turns
            gameState.current_turn = playerColor === 'white' ? 'black' : 'white';
            gameState.dice = [];
        }
        await matches_repository_1.matchesRepository.updateGameState(matchId, gameState);
        // Record move
        const moveNumber = await this.getMoveNumber(matchId);
        await matches_repository_1.matchesRepository.recordMove(matchId, userId, moveNumber, moves.map(m => m.die_value), moves, gameState);
        // Notify opponent
        websocket_1.wsUtils.emitToMatch(matchId, 'move_made', {
            match_id: matchId,
            moves: moves,
            game_state: gameState,
        });
        if (gameOver) {
            websocket_1.wsUtils.emitToMatch(matchId, 'match_completed', {
                match_id: matchId,
                winner_id: winner,
            });
        }
        return {
            game_state: gameState,
            legal_moves: remainingMoves,
            turn_complete: turnComplete,
            game_over: gameOver,
            winner,
        };
    }
    /**
     * Complete match and transfer gold/chips
     */
    async completeMatch(matchId, winnerId, match) {
        const loserId = winnerId === match.player_white_id
            ? match.player_black_id
            : match.player_white_id;
        if (!loserId) {
            throw new AppError_1.ValidationError('Invalid match state: missing loser');
        }
        const stakeAmount = match.stake_amount * (match.final_cube_value || 1);
        await matches_repository_1.matchesRepository.setWinner(matchId, winnerId, match.final_cube_value || 1);
        if (match.match_type === 'gold') {
            // Transfer gold
            await this.transferGold(winnerId, loserId, stakeAmount, matchId);
        }
        else if (match.match_type === 'club' && match.club_id) {
            // Transfer chips
            await this.transferChips(match.club_id, winnerId, loserId, stakeAmount);
        }
        // Update user stats
        await connection_1.default.query('UPDATE users SET wins = wins + 1, total_matches = total_matches + 1 WHERE user_id = $1', [winnerId]);
        await connection_1.default.query('UPDATE users SET losses = losses + 1, total_matches = total_matches + 1 WHERE user_id = $1', [loserId]);
    }
    async transferGold(winnerId, loserId, amount, matchId) {
        const client = await connection_1.default.connect();
        try {
            await client.query('BEGIN');
            // Get current balances
            const winner = await users_repository_1.usersRepository.findById(winnerId);
            const loser = await users_repository_1.usersRepository.findById(loserId);
            if (!winner || !loser) {
                throw new Error('Player not found');
            }
            const actualAmount = Math.min(amount, loser.gold_balance);
            // Deduct from loser
            const newLoserBalance = loser.gold_balance - actualAmount;
            await client.query('UPDATE users SET gold_balance = $1, total_gold_spent = total_gold_spent + $2 WHERE user_id = $3', [newLoserBalance, actualAmount, loserId]);
            // Add to winner
            const newWinnerBalance = winner.gold_balance + actualAmount;
            await client.query('UPDATE users SET gold_balance = $1, total_gold_earned = total_gold_earned + $2 WHERE user_id = $3', [newWinnerBalance, actualAmount, winnerId]);
            // Record transactions
            await gold_repository_1.goldRepository.createTransaction({
                user_id: loserId,
                type: 'match_loss',
                amount: -actualAmount,
                balance_after: newLoserBalance,
                description: 'Match loss',
                related_match_id: matchId,
            });
            await gold_repository_1.goldRepository.createTransaction({
                user_id: winnerId,
                type: 'match_win',
                amount: actualAmount,
                balance_after: newWinnerBalance,
                description: 'Match win',
                related_match_id: matchId,
            });
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async transferChips(clubId, winnerId, loserId, amount) {
        // Get loser's chip balance
        const loserMembership = await connection_1.default.query('SELECT chip_balance FROM club_memberships WHERE club_id = $1 AND user_id = $2', [clubId, loserId]);
        const actualAmount = Math.min(amount, loserMembership.rows[0]?.chip_balance || 0);
        // Transfer chips
        await connection_1.default.query('UPDATE club_memberships SET chip_balance = chip_balance - $1 WHERE club_id = $2 AND user_id = $3', [actualAmount, clubId, loserId]);
        await connection_1.default.query('UPDATE club_memberships SET chip_balance = chip_balance + $1 WHERE club_id = $2 AND user_id = $3', [actualAmount, clubId, winnerId]);
    }
    async getMoveNumber(matchId) {
        const result = await connection_1.default.query('SELECT COALESCE(MAX(move_number), 0) + 1 as next FROM match_moves WHERE match_id = $1', [matchId]);
        return result.rows[0].next;
    }
    /**
     * Get user's match history
     */
    async getMatchHistory(userId, limit = 20) {
        return matches_repository_1.matchesRepository.getUserMatches(userId, undefined, limit);
    }
    /**
     * Forfeit match
     */
    async forfeit(matchId, userId) {
        const match = await matches_repository_1.matchesRepository.findById(matchId);
        if (!match) {
            throw new AppError_1.NotFoundError('Match');
        }
        if (match.status !== 'in_progress') {
            throw new AppError_1.ValidationError('Match not in progress');
        }
        const isWhite = match.player_white_id === userId;
        const isBlack = match.player_black_id === userId;
        if (!isWhite && !isBlack) {
            throw new AppError_1.ForbiddenError('Not a player in this match');
        }
        const winnerId = isWhite ? match.player_black_id : match.player_white_id;
        if (!winnerId) {
            throw new AppError_1.ValidationError('Invalid match state: missing opponent');
        }
        await this.completeMatch(matchId, winnerId, match);
        websocket_1.wsUtils.emitToMatch(matchId, 'match_completed', {
            match_id: matchId,
            winner_id: winnerId,
            reason: 'forfeit',
        });
    }
}
exports.MatchesService = MatchesService;
exports.matchesService = new MatchesService();
