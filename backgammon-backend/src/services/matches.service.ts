import pool from '../db/connection';
import { matchesRepository } from '../repositories/matches.repository';
import { usersRepository } from '../repositories/users.repository';
import { goldRepository } from '../repositories/gold.repository';
import { gameEngineService } from './game-engine.service';
import { wsUtils } from '../websocket';
import { Match, GameState, Move, Color } from '../types/game.types';
import { ValidationError, NotFoundError, ForbiddenError } from '../errors/AppError';

export class MatchesService {
  /**
   * Get match details
   */
  async getMatch(matchId: string, userId?: string): Promise<Match & { your_color?: Color }> {
    const match = await matchesRepository.findById(matchId);
    if (!match) {
      throw new NotFoundError('Match');
    }

    let result: any = { ...match };

    if (userId) {
      if (match.player_white_id === userId) {
        result.your_color = 'white';
      } else if (match.player_black_id === userId) {
        result.your_color = 'black';
      }
    }

    return result;
  }

  /**
   * Set player ready
   */
  async setReady(matchId: string, userId: string): Promise<{ both_ready: boolean; game_state?: GameState }> {
    const match = await matchesRepository.findById(matchId);
    if (!match) {
      throw new NotFoundError('Match');
    }

    if (match.status !== 'ready' && match.status !== 'waiting') {
      throw new ValidationError('Match already started or completed');
    }

    const isWhite = match.player_white_id === userId;
    const isBlack = match.player_black_id === userId;

    if (!isWhite && !isBlack) {
      throw new ForbiddenError('Not a player in this match');
    }

    await matchesRepository.setPlayerReady(matchId, userId, isWhite);

    // Notify opponent
    wsUtils.emitToMatch(matchId, 'player_ready_status', {
      match_id: matchId,
      user_id: userId,
      ready: true,
    });

    // Check if both ready
    const updatedMatch = await matchesRepository.findById(matchId);
    const bothReady = updatedMatch!.player_white_ready && updatedMatch!.player_black_ready;

    if (bothReady) {
      // Initialize game and start
      const gameState = gameEngineService.initializeGame();
      const dice = gameEngineService.rollDice();
      gameState.dice = dice;

      await matchesRepository.updateGameState(matchId, gameState);
      await matchesRepository.updateStatus(matchId, 'in_progress');

      // Notify both players
      wsUtils.emitToMatch(matchId, 'match_started', {
        match_id: matchId,
        game_state: gameState,
      } as any);

      return { both_ready: true, game_state: gameState };
    }

    return { both_ready: false };
  }

  /**
   * Roll dice
   */
  async rollDice(matchId: string, userId: string): Promise<{ dice: any[]; legal_moves: Move[] }> {
    const match = await matchesRepository.findById(matchId);
    if (!match) {
      throw new NotFoundError('Match');
    }

    if (match.status !== 'in_progress') {
      throw new ValidationError('Match not in progress');
    }

    const isWhite = match.player_white_id === userId;
    const isBlack = match.player_black_id === userId;

    if (!isWhite && !isBlack) {
      throw new ForbiddenError('Not a player in this match');
    }

    const playerColor: Color = isWhite ? 'white' : 'black';
    const gameState = match.game_state!;

    if (gameState.current_turn !== playerColor) {
      throw new ValidationError('Not your turn');
    }

    if (gameState.dice.length > 0 && gameState.dice.some(d => !d.used)) {
      throw new ValidationError('Dice already rolled, make your moves');
    }

    // Roll dice
    const dice = gameEngineService.rollDice();
    gameState.dice = dice;

    await matchesRepository.updateGameState(matchId, gameState);

    // Get legal moves
    const legalMoves = gameEngineService.getLegalMoves(gameState);

    // Notify opponent
    wsUtils.emitToMatch(matchId, 'turn_changed', {
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
  async makeMove(matchId: string, userId: string, moves: Move[]): Promise<{
    game_state: GameState;
    legal_moves: Move[];
    turn_complete: boolean;
    game_over: boolean;
    winner?: string;
  }> {
    const match = await matchesRepository.findById(matchId);
    if (!match) {
      throw new NotFoundError('Match');
    }

    if (match.status !== 'in_progress') {
      throw new ValidationError('Match not in progress');
    }

    const isWhite = match.player_white_id === userId;
    const playerColor: Color = isWhite ? 'white' : 'black';
    let gameState = match.game_state!;

    if (gameState.current_turn !== playerColor) {
      throw new ValidationError('Not your turn');
    }

    // Apply each move
    for (const move of moves) {
      const legalMoves = gameEngineService.getLegalMoves(gameState);
      const isLegal = legalMoves.some(
        m => m.from === move.from && m.to === move.to && m.die_value === move.die_value
      );

      if (!isLegal) {
        throw new ValidationError('Illegal move');
      }

      gameState = gameEngineService.applyMove(gameState, move);
    }

    // Check if turn is complete (all dice used or no legal moves)
    const remainingMoves = gameEngineService.getLegalMoves(gameState);
    const turnComplete = remainingMoves.length === 0;

    // Check for game over
    const gameOver = gameEngineService.isGameOver(gameState);
    let winner: string | undefined;

    if (gameOver) {
      const opponentId = isWhite ? match.player_black_id : match.player_white_id;
      if (!opponentId) {
        throw new ValidationError('Invalid match state: missing opponent');
      }
      winner = gameState.off[playerColor] === 15 ? userId : opponentId;

      await this.completeMatch(matchId, winner, match);
    } else if (turnComplete) {
      // Switch turns
      gameState.current_turn = playerColor === 'white' ? 'black' : 'white';
      gameState.dice = [];
    }

    await matchesRepository.updateGameState(matchId, gameState);

    // Record move
    const moveNumber = await this.getMoveNumber(matchId);
    await matchesRepository.recordMove(
      matchId,
      userId,
      moveNumber,
      moves.map(m => m.die_value),
      moves,
      gameState
    );

    // Notify opponent
    wsUtils.emitToMatch(matchId, 'move_made', {
      match_id: matchId,
      moves: moves,
      game_state: gameState,
    } as any);

    if (gameOver) {
      wsUtils.emitToMatch(matchId, 'match_completed', {
        match_id: matchId,
        winner_id: winner,
      } as any);
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
  private async completeMatch(matchId: string, winnerId: string, match: Match): Promise<void> {
    const loserId = winnerId === match.player_white_id
      ? match.player_black_id
      : match.player_white_id;

    if (!loserId) {
      throw new ValidationError('Invalid match state: missing loser');
    }

    const stakeAmount = match.stake_amount * (match.final_cube_value || 1);

    await matchesRepository.setWinner(matchId, winnerId, match.final_cube_value || 1);

    if (match.match_type === 'gold') {
      // Transfer gold
      await this.transferGold(winnerId, loserId, stakeAmount, matchId);
    } else if (match.match_type === 'club' && match.club_id) {
      // Transfer chips
      await this.transferChips(match.club_id, winnerId, loserId, stakeAmount);
    }

    // Update user stats
    await pool.query(
      'UPDATE users SET wins = wins + 1, total_matches = total_matches + 1 WHERE user_id = $1',
      [winnerId]
    );
    await pool.query(
      'UPDATE users SET losses = losses + 1, total_matches = total_matches + 1 WHERE user_id = $1',
      [loserId]
    );
  }

  private async transferGold(winnerId: string, loserId: string, amount: number, matchId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current balances
      const winner = await usersRepository.findById(winnerId);
      const loser = await usersRepository.findById(loserId);

      if (!winner || !loser) {
        throw new Error('Player not found');
      }

      const actualAmount = Math.min(amount, loser.gold_balance);

      // Deduct from loser
      const newLoserBalance = loser.gold_balance - actualAmount;
      await client.query(
        'UPDATE users SET gold_balance = $1, total_gold_spent = total_gold_spent + $2 WHERE user_id = $3',
        [newLoserBalance, actualAmount, loserId]
      );

      // Add to winner
      const newWinnerBalance = winner.gold_balance + actualAmount;
      await client.query(
        'UPDATE users SET gold_balance = $1, total_gold_earned = total_gold_earned + $2 WHERE user_id = $3',
        [newWinnerBalance, actualAmount, winnerId]
      );

      // Record transactions
      await goldRepository.createTransaction({
        user_id: loserId,
        type: 'match_loss',
        amount: -actualAmount,
        balance_after: newLoserBalance,
        description: 'Match loss',
        related_match_id: matchId,
      });

      await goldRepository.createTransaction({
        user_id: winnerId,
        type: 'match_win',
        amount: actualAmount,
        balance_after: newWinnerBalance,
        description: 'Match win',
        related_match_id: matchId,
      });

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async transferChips(clubId: string, winnerId: string, loserId: string, amount: number): Promise<void> {
    // Get loser's chip balance
    const loserMembership = await pool.query(
      'SELECT chip_balance FROM club_memberships WHERE club_id = $1 AND user_id = $2',
      [clubId, loserId]
    );

    const actualAmount = Math.min(amount, loserMembership.rows[0]?.chip_balance || 0);

    // Transfer chips
    await pool.query(
      'UPDATE club_memberships SET chip_balance = chip_balance - $1 WHERE club_id = $2 AND user_id = $3',
      [actualAmount, clubId, loserId]
    );
    await pool.query(
      'UPDATE club_memberships SET chip_balance = chip_balance + $1 WHERE club_id = $2 AND user_id = $3',
      [actualAmount, clubId, winnerId]
    );
  }

  private async getMoveNumber(matchId: string): Promise<number> {
    const result = await pool.query(
      'SELECT COALESCE(MAX(move_number), 0) + 1 as next FROM match_moves WHERE match_id = $1',
      [matchId]
    );
    return result.rows[0].next;
  }

  /**
   * Get user's match history
   */
  async getMatchHistory(userId: string, limit: number = 20): Promise<Match[]> {
    return matchesRepository.getUserMatches(userId, undefined, limit);
  }

  /**
   * Forfeit match
   */
  async forfeit(matchId: string, userId: string): Promise<void> {
    const match = await matchesRepository.findById(matchId);
    if (!match) {
      throw new NotFoundError('Match');
    }

    if (match.status !== 'in_progress') {
      throw new ValidationError('Match not in progress');
    }

    const isWhite = match.player_white_id === userId;
    const isBlack = match.player_black_id === userId;

    if (!isWhite && !isBlack) {
      throw new ForbiddenError('Not a player in this match');
    }

    const winnerId = isWhite ? match.player_black_id : match.player_white_id;
    if (!winnerId) {
      throw new ValidationError('Invalid match state: missing opponent');
    }

    await this.completeMatch(matchId, winnerId, match);

    wsUtils.emitToMatch(matchId, 'match_completed', {
      match_id: matchId,
      winner_id: winnerId,
      reason: 'forfeit',
    } as any);
  }
}

export const matchesService = new MatchesService();
