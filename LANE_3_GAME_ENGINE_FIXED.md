# 🎮 LANE 3: GAME ENGINE (FIXED)
## Backgammon Rules Engine + Board Rendering
## ✅ ALL ISSUES PATCHED

---

## YOUR MISSION
Build the complete backgammon game engine:
- Backend: Game rules, move validation, dice rolling
- Frontend: Board rendering, piece movement, animations

---

## PREREQUISITES
- **Lane 1 must be complete** (backend running)
- **Lane 2 must be complete** (frontend running)

---

## PHASE 1: Backend Game Types

### Step 1.1: Create Game Types
Create `src/types/game.types.ts` in backend:
```typescript
export type Color = 'white' | 'black';

export interface Point {
  pieces: number;
  color: Color | null;
}

export interface Dice {
  value: number;
  used: boolean;
}

export interface DoublingCube {
  value: number;
  owner: Color | 'center';
}

export interface GameState {
  board: Point[]; // 24 points (0-23)
  bar: { white: number; black: number };
  off: { white: number; black: number };
  current_turn: Color;
  dice: Dice[];
  doubling_cube: DoublingCube;
  move_deadline?: string; // ISO timestamp
}

export interface Move {
  from: number; // 0-23 for board, -1 for bar
  to: number;   // 0-23 for board, -1 for bearing off
  die_value: number;
}

export interface Match {
  match_id: string;
  match_type: 'gold' | 'club';
  status: 'waiting' | 'ready' | 'in_progress' | 'completed' | 'abandoned';
  player_white_id: string | null;
  player_black_id: string | null;
  player_white_ready: boolean;
  player_black_ready: boolean;
  stake_amount: number;
  club_id: string | null;
  doubling_cube_enabled: boolean;
  game_state: GameState | null;
  winner_id: string | null;
  final_cube_value: number;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  last_move_at: Date | null;
}

export interface CreateMatchData {
  match_type: 'gold' | 'club';
  stake_amount: number;
  club_id?: string;
  doubling_cube_enabled?: boolean;
}

export type WinType = 'normal' | 'gammon' | 'backgammon';

export interface GameResult {
  winner: Color;
  win_type: WinType;
  multiplier: number; // 1 for normal, 2 for gammon, 3 for backgammon
}
```

---

## PHASE 2: Backend Game Engine Service

### Step 2.1: Create Game Engine Service (FIXED - complete implementation)
Create `src/services/game-engine.service.ts`:
```typescript
import { GameState, Move, Dice, Color, Point, GameResult, WinType } from '../types/game.types';
import { randomUtils } from '../utils/random.utils';

export class GameEngineService {
  /**
   * Create initial board setup - standard backgammon position
   */
  initializeGame(firstPlayer: Color = 'white'): GameState {
    const board: Point[] = new Array(24).fill(null).map(() => ({
      pieces: 0,
      color: null,
    }));

    // Standard backgammon starting position
    // White moves from point 1 (index 0) towards point 24 (index 23), bearing off past 24
    // Black moves from point 24 (index 23) towards point 1 (index 0), bearing off past 1
    
    // White pieces (15 total)
    board[0] = { pieces: 2, color: 'white' };   // Point 1 (2 pieces)
    board[11] = { pieces: 5, color: 'white' };  // Point 12 (5 pieces)
    board[16] = { pieces: 3, color: 'white' };  // Point 17 (3 pieces)
    board[18] = { pieces: 5, color: 'white' };  // Point 19 (5 pieces)

    // Black pieces (15 total)
    board[23] = { pieces: 2, color: 'black' };  // Point 24 (2 pieces)
    board[12] = { pieces: 5, color: 'black' };  // Point 13 (5 pieces)
    board[7] = { pieces: 3, color: 'black' };   // Point 8 (3 pieces)
    board[5] = { pieces: 5, color: 'black' };   // Point 6 (5 pieces)

    return {
      board,
      bar: { white: 0, black: 0 },
      off: { white: 0, black: 0 },
      current_turn: firstPlayer,
      dice: [],
      doubling_cube: { value: 1, owner: 'center' },
    };
  }

  /**
   * Roll dice for opening (each player rolls one die)
   */
  rollForFirst(): { white: number; black: number; first: Color | 'tie' } {
    const white = randomUtils.rollDie();
    const black = randomUtils.rollDie();
    
    let first: Color | 'tie' = 'tie';
    if (white > black) first = 'white';
    else if (black > white) first = 'black';
    
    return { white, black, first };
  }

  /**
   * Roll dice - cryptographically secure
   */
  rollDice(): Dice[] {
    const die1 = randomUtils.rollDie();
    const die2 = randomUtils.rollDie();

    // Doubles = 4 moves instead of 2
    if (die1 === die2) {
      return [
        { value: die1, used: false },
        { value: die1, used: false },
        { value: die1, used: false },
        { value: die1, used: false },
      ];
    }

    return [
      { value: die1, used: false },
      { value: die2, used: false },
    ];
  }

  /**
   * Set dice on game state and return available dice values
   */
  setDice(gameState: GameState): GameState {
    const dice = this.rollDice();
    return { ...gameState, dice };
  }

  /**
   * Get all legal moves for current player
   */
  getLegalMoves(gameState: GameState): Move[] {
    const color = gameState.current_turn;
    const moves: Move[] = [];
    const availableDice = gameState.dice.filter(d => !d.used);

    if (availableDice.length === 0) return [];

    // Get unique die values to avoid duplicate moves
    const uniqueDieValues = [...new Set(availableDice.map(d => d.value))];

    // If pieces on bar, must enter first
    if (gameState.bar[color] > 0) {
      return this.getBarEntryMoves(gameState, color, uniqueDieValues);
    }

    // Check if can bear off
    const canBearOff = this.canBearOff(gameState, color);

    // Check all points for possible moves
    for (let from = 0; from < 24; from++) {
      const point = gameState.board[from];
      
      if (point.color !== color || point.pieces === 0) continue;

      for (const dieValue of uniqueDieValues) {
        // Calculate destination based on color direction
        const to = color === 'white' ? from + dieValue : from - dieValue;

        // Check bearing off
        if (canBearOff) {
          if (this.isValidBearOff(gameState, color, from, dieValue)) {
            moves.push({ from, to: -1, die_value: dieValue });
          }
        }

        // Normal move (within board)
        if (to >= 0 && to < 24) {
          if (this.isValidDestination(gameState, color, to)) {
            moves.push({ from, to, die_value: dieValue });
          }
        }
      }
    }

    return moves;
  }

  /**
   * Get moves for entering from bar
   */
  private getBarEntryMoves(gameState: GameState, color: Color, dieValues: number[]): Move[] {
    const moves: Move[] = [];
    
    for (const dieValue of dieValues) {
      // White enters on points 1-6 (indices 0-5) based on die value
      // Black enters on points 19-24 (indices 18-23) based on die value
      const enterPoint = color === 'white' ? dieValue - 1 : 24 - dieValue;
      
      if (this.isValidDestination(gameState, color, enterPoint)) {
        moves.push({ from: -1, to: enterPoint, die_value: dieValue });
      }
    }

    return moves;
  }

  /**
   * Check if a destination point is valid for moving to
   */
  private isValidDestination(gameState: GameState, color: Color, to: number): boolean {
    if (to < 0 || to > 23) return false;
    
    const destPoint = gameState.board[to];
    const opponent = color === 'white' ? 'black' : 'white';
    
    // Open point (empty or same color) - always valid
    if (!destPoint.color || destPoint.color === color) return true;
    
    // Can hit single opponent piece (blot)
    if (destPoint.color === opponent && destPoint.pieces === 1) return true;
    
    // Blocked by opponent (2+ pieces)
    return false;
  }

  /**
   * Check if player can bear off (all pieces in home board)
   */
  canBearOff(gameState: GameState, color: Color): boolean {
    // Must have no pieces on bar
    if (gameState.bar[color] > 0) return false;

    // All pieces must be in home board
    // White home: points 19-24 (indices 18-23)
    // Black home: points 1-6 (indices 0-5)
    
    for (let i = 0; i < 24; i++) {
      const point = gameState.board[i];
      if (point.color === color && point.pieces > 0) {
        if (color === 'white' && i < 18) return false; // White piece outside home
        if (color === 'black' && i > 5) return false;  // Black piece outside home
      }
    }

    return true;
  }

  /**
   * Check if specific bearing off move is valid
   */
  private isValidBearOff(gameState: GameState, color: Color, from: number, dieValue: number): boolean {
    // Verify the piece is in home board
    if (color === 'white' && from < 18) return false;
    if (color === 'black' && from > 5) return false;

    // Calculate exact bear off requirement
    // White: needs die value that would take piece to index 24+ (past the board)
    // Black: needs die value that would take piece to index -1 (past the board)
    
    if (color === 'white') {
      const targetIndex = from + dieValue;
      
      // Exact bear off (piece lands exactly on point 25, i.e., index 24)
      if (targetIndex === 24) return true;
      
      // Over-bearing: only allowed if no pieces on higher points
      if (targetIndex > 24) {
        // Check if there are any pieces on lower points in home board
        for (let i = 18; i < from; i++) {
          if (gameState.board[i].color === 'white' && gameState.board[i].pieces > 0) {
            return false; // Must move a piece from a lower point first
          }
        }
        return true;
      }
    } else {
      // Black
      const targetIndex = from - dieValue;
      
      // Exact bear off
      if (targetIndex === -1) return true;
      
      // Over-bearing
      if (targetIndex < -1) {
        for (let i = from + 1; i <= 5; i++) {
          if (gameState.board[i].color === 'black' && gameState.board[i].pieces > 0) {
            return false;
          }
        }
        return true;
      }
    }

    return false;
  }

  /**
   * Apply a move to the game state
   */
  applyMove(gameState: GameState, move: Move): GameState {
    const newState = this.cloneGameState(gameState);
    const color = newState.current_turn;
    const opponent = color === 'white' ? 'black' : 'white';

    // Mark die as used
    const dieIndex = newState.dice.findIndex(d => !d.used && d.value === move.die_value);
    if (dieIndex !== -1) {
      newState.dice[dieIndex].used = true;
    }

    // Handle source
    if (move.from === -1) {
      // Moving from bar
      newState.bar[color]--;
    } else {
      // Moving from board
      newState.board[move.from].pieces--;
      if (newState.board[move.from].pieces === 0) {
        newState.board[move.from].color = null;
      }
    }

    // Handle destination
    if (move.to === -1) {
      // Bearing off
      newState.off[color]++;
    } else {
      // Moving to board
      const destPoint = newState.board[move.to];
      
      // Check for hit (blot)
      if (destPoint.color === opponent && destPoint.pieces === 1) {
        destPoint.pieces = 0;
        destPoint.color = null;
        newState.bar[opponent]++;
      }
      
      // Place piece
      destPoint.pieces++;
      destPoint.color = color;
    }

    return newState;
  }

  /**
   * Check if current player has any legal moves
   */
  hasLegalMoves(gameState: GameState): boolean {
    return this.getLegalMoves(gameState).length > 0;
  }

  /**
   * End current turn and switch to opponent
   */
  endTurn(gameState: GameState): GameState {
    const newState = this.cloneGameState(gameState);
    newState.current_turn = newState.current_turn === 'white' ? 'black' : 'white';
    newState.dice = []; // Clear dice for next turn
    return newState;
  }

  /**
   * Check if the game is over
   */
  isGameOver(gameState: GameState): boolean {
    return gameState.off.white === 15 || gameState.off.black === 15;
  }

  /**
   * Get game result (assumes game is over)
   */
  getGameResult(gameState: GameState): GameResult | null {
    if (!this.isGameOver(gameState)) return null;

    const winner: Color = gameState.off.white === 15 ? 'white' : 'black';
    const loser: Color = winner === 'white' ? 'black' : 'white';

    // Check for backgammon (opponent has piece on bar or in winner's home)
    const hasOnBar = gameState.bar[loser] > 0;
    const hasInWinnerHome = this.hasPieceInOpponentHome(gameState, loser, winner);
    
    if (hasOnBar || hasInWinnerHome) {
      return { winner, win_type: 'backgammon', multiplier: 3 };
    }

    // Check for gammon (opponent hasn't borne off any pieces)
    if (gameState.off[loser] === 0) {
      return { winner, win_type: 'gammon', multiplier: 2 };
    }

    // Normal win
    return { winner, win_type: 'normal', multiplier: 1 };
  }

  /**
   * Check if loser has any piece in winner's home board
   */
  private hasPieceInOpponentHome(gameState: GameState, loser: Color, winner: Color): boolean {
    // Winner's home board
    const homeStart = winner === 'white' ? 18 : 0;
    const homeEnd = winner === 'white' ? 24 : 6;

    for (let i = homeStart; i < homeEnd; i++) {
      if (gameState.board[i].color === loser && gameState.board[i].pieces > 0) {
        return true;
      }
    }
    return false;
  }

  /**
   * Deep clone game state
   */
  private cloneGameState(gameState: GameState): GameState {
    return {
      board: gameState.board.map(p => ({ ...p })),
      bar: { ...gameState.bar },
      off: { ...gameState.off },
      current_turn: gameState.current_turn,
      dice: gameState.dice.map(d => ({ ...d })),
      doubling_cube: { ...gameState.doubling_cube },
      move_deadline: gameState.move_deadline,
    };
  }

  /**
   * Validate a sequence of moves
   */
  validateMoves(gameState: GameState, moves: Move[]): { valid: boolean; error?: string } {
    let currentState = this.cloneGameState(gameState);

    for (const move of moves) {
      const legalMoves = this.getLegalMoves(currentState);
      const isLegal = legalMoves.some(
        m => m.from === move.from && m.to === move.to && m.die_value === move.die_value
      );

      if (!isLegal) {
        return { valid: false, error: `Invalid move: ${move.from} -> ${move.to}` };
      }

      currentState = this.applyMove(currentState, move);
    }

    return { valid: true };
  }
}

export const gameEngineService = new GameEngineService();
```

---

## PHASE 3: Backend Match Service & Routes

### Step 3.1: Create Matches Repository
Create `src/repositories/matches.repository.ts`:
```typescript
import pool from '../db/connection';
import { Match, CreateMatchData, GameState } from '../types/game.types';

export class MatchesRepository {
  async create(data: CreateMatchData & { player_white_id?: string; player_black_id?: string }): Promise<Match> {
    const query = `
      INSERT INTO matches (
        match_type, stake_amount, club_id, doubling_cube_enabled,
        player_white_id, player_black_id
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [
      data.match_type,
      data.stake_amount,
      data.club_id || null,
      data.doubling_cube_enabled ?? true,
      data.player_white_id || null,
      data.player_black_id || null,
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async findById(matchId: string): Promise<Match | null> {
    const query = 'SELECT * FROM matches WHERE match_id = $1';
    const result = await pool.query(query, [matchId]);
    return result.rows[0] || null;
  }

  async findWaitingMatches(matchType: 'gold' | 'club', stakeAmount: number, clubId?: string): Promise<Match[]> {
    let query = `
      SELECT * FROM matches 
      WHERE status = 'waiting' 
      AND match_type = $1 
      AND stake_amount = $2
    `;
    const values: any[] = [matchType, stakeAmount];

    if (clubId) {
      query += ' AND club_id = $3';
      values.push(clubId);
    } else {
      query += ' AND club_id IS NULL';
    }

    query += ' ORDER BY created_at ASC LIMIT 10';
    
    const result = await pool.query(query, values);
    return result.rows;
  }

  async updateStatus(matchId: string, status: string): Promise<void> {
    await pool.query(
      'UPDATE matches SET status = $1 WHERE match_id = $2',
      [status, matchId]
    );
  }

  async setPlayers(matchId: string, whiteId: string, blackId: string): Promise<void> {
    await pool.query(
      'UPDATE matches SET player_white_id = $1, player_black_id = $2 WHERE match_id = $3',
      [whiteId, blackId, matchId]
    );
  }

  async setPlayerReady(matchId: string, playerId: string, isWhite: boolean): Promise<void> {
    const column = isWhite ? 'player_white_ready' : 'player_black_ready';
    await pool.query(
      `UPDATE matches SET ${column} = TRUE WHERE match_id = $1`,
      [matchId]
    );
  }

  async updateGameState(matchId: string, gameState: GameState): Promise<void> {
    await pool.query(
      'UPDATE matches SET game_state = $1, last_move_at = NOW() WHERE match_id = $2',
      [JSON.stringify(gameState), matchId]
    );
  }

  async startMatch(matchId: string, gameState: GameState): Promise<void> {
    await pool.query(
      `UPDATE matches 
       SET status = 'in_progress', 
           started_at = NOW(), 
           game_state = $1 
       WHERE match_id = $2`,
      [JSON.stringify(gameState), matchId]
    );
  }

  async completeMatch(matchId: string, winnerId: string, finalCubeValue: number): Promise<void> {
    await pool.query(
      `UPDATE matches 
       SET status = 'completed', 
           completed_at = NOW(), 
           winner_id = $1,
           final_cube_value = $2
       WHERE match_id = $3`,
      [winnerId, finalCubeValue, matchId]
    );
  }

  async getUserMatches(userId: string, status?: string, limit: number = 20): Promise<Match[]> {
    let query = `
      SELECT * FROM matches 
      WHERE (player_white_id = $1 OR player_black_id = $1)
    `;
    const values: any[] = [userId];

    if (status) {
      query += ` AND status = $2`;
      values.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (values.length + 1);
    values.push(limit);

    const result = await pool.query(query, values);
    return result.rows;
  }
}

export const matchesRepository = new MatchesRepository();
```

### Step 3.2: Create Matches Service (FIXED - includes pool import)
Create `src/services/matches.service.ts`:
```typescript
import pool from '../db/connection';
import { matchesRepository } from '../repositories/matches.repository';
import { usersRepository } from '../repositories/users.repository';
import { goldRepository } from '../repositories/gold.repository';
import { gameEngineService } from './game-engine.service';
import { Match, CreateMatchData, GameState, Move, Color } from '../types/game.types';
import { ValidationError, NotFoundError, ForbiddenError } from '../errors/AppError';

export class MatchesService {
  /**
   * Create a new match or join existing one
   */
  async findOrCreateMatch(userId: string, data: CreateMatchData): Promise<Match> {
    // Verify user has enough gold for stake
    const user = await usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    if (data.match_type === 'gold' && user.gold_balance < data.stake_amount) {
      throw new ValidationError('Insufficient gold balance');
    }

    // Look for existing waiting match
    const waitingMatches = await matchesRepository.findWaitingMatches(
      data.match_type,
      data.stake_amount,
      data.club_id
    );

    // Find a match not created by this user
    const availableMatch = waitingMatches.find(m => 
      m.player_white_id !== userId && m.player_black_id !== userId
    );

    if (availableMatch) {
      // Join existing match as second player
      const isWhite = !availableMatch.player_white_id;
      
      if (isWhite) {
        await matchesRepository.setPlayers(
          availableMatch.match_id,
          userId,
          availableMatch.player_black_id!
        );
      } else {
        await matchesRepository.setPlayers(
          availableMatch.match_id,
          availableMatch.player_white_id!,
          userId
        );
      }

      await matchesRepository.updateStatus(availableMatch.match_id, 'ready');
      return matchesRepository.findById(availableMatch.match_id) as Promise<Match>;
    }

    // Create new match - randomly assign as white or black
    const isWhite = Math.random() < 0.5;
    const match = await matchesRepository.create({
      ...data,
      player_white_id: isWhite ? userId : undefined,
      player_black_id: isWhite ? undefined : userId,
    });

    return match;
  }

  /**
   * Get match by ID with player validation
   */
  async getMatch(matchId: string, userId?: string): Promise<Match> {
    const match = await matchesRepository.findById(matchId);
    if (!match) {
      throw new NotFoundError('Match');
    }

    // Optionally verify user is a participant
    if (userId && match.player_white_id !== userId && match.player_black_id !== userId) {
      throw new ForbiddenError('You are not a participant in this match');
    }

    return match;
  }

  /**
   * Mark player as ready
   */
  async setPlayerReady(matchId: string, userId: string): Promise<Match> {
    const match = await this.getMatch(matchId, userId);

    if (match.status !== 'ready') {
      throw new ValidationError('Match is not in ready state');
    }

    const isWhite = match.player_white_id === userId;
    await matchesRepository.setPlayerReady(matchId, userId, isWhite);

    // Refresh match
    const updatedMatch = await matchesRepository.findById(matchId) as Match;

    // Check if both players are ready to start
    if (updatedMatch.player_white_ready && updatedMatch.player_black_ready) {
      return this.startMatch(matchId);
    }

    return updatedMatch;
  }

  /**
   * Start the match
   */
  async startMatch(matchId: string): Promise<Match> {
    const match = await matchesRepository.findById(matchId);
    if (!match) {
      throw new NotFoundError('Match');
    }

    // Roll for first - determine who goes first
    const { first } = gameEngineService.rollForFirst();
    const firstPlayer: Color = first === 'tie' ? 'white' : first;

    // Initialize game state
    const gameState = gameEngineService.initializeGame(firstPlayer);
    
    // Roll initial dice for first player
    const stateWithDice = gameEngineService.setDice(gameState);

    await matchesRepository.startMatch(matchId, stateWithDice);

    return matchesRepository.findById(matchId) as Promise<Match>;
  }

  /**
   * Submit moves for current turn
   */
  async submitMoves(matchId: string, userId: string, moves: Move[]): Promise<Match> {
    const match = await this.getMatch(matchId, userId);

    if (match.status !== 'in_progress') {
      throw new ValidationError('Match is not in progress');
    }

    if (!match.game_state) {
      throw new ValidationError('Game state not initialized');
    }

    // Verify it's this player's turn
    const playerColor: Color = match.player_white_id === userId ? 'white' : 'black';
    if (match.game_state.current_turn !== playerColor) {
      throw new ValidationError('Not your turn');
    }

    // Validate and apply moves
    const validation = gameEngineService.validateMoves(match.game_state, moves);
    if (!validation.valid) {
      throw new ValidationError(validation.error || 'Invalid moves');
    }

    // Apply all moves
    let gameState = match.game_state;
    for (const move of moves) {
      gameState = gameEngineService.applyMove(gameState, move);
    }

    // Check for game over
    if (gameEngineService.isGameOver(gameState)) {
      return this.completeMatch(matchId, match, gameState);
    }

    // End turn and roll dice for next player
    gameState = gameEngineService.endTurn(gameState);
    gameState = gameEngineService.setDice(gameState);

    // If next player has no legal moves, they must pass
    if (!gameEngineService.hasLegalMoves(gameState)) {
      gameState = gameEngineService.endTurn(gameState);
      gameState = gameEngineService.setDice(gameState);
    }

    await matchesRepository.updateGameState(matchId, gameState);

    return matchesRepository.findById(matchId) as Promise<Match>;
  }

  /**
   * Complete the match and transfer gold/chips
   */
  private async completeMatch(matchId: string, match: Match, finalState: GameState): Promise<Match> {
    const result = gameEngineService.getGameResult(finalState);
    if (!result) {
      throw new ValidationError('Game is not over');
    }

    const winnerId = result.winner === 'white' ? match.player_white_id! : match.player_black_id!;
    const loserId = result.winner === 'white' ? match.player_black_id! : match.player_white_id!;

    const cubeValue = finalState.doubling_cube.value;
    const totalMultiplier = result.multiplier * cubeValue;
    const winAmount = match.stake_amount * totalMultiplier;

    // Transfer gold
    if (match.match_type === 'gold') {
      await this.transferGold(winnerId, loserId, winAmount, matchId);
    }

    await matchesRepository.updateGameState(matchId, finalState);
    await matchesRepository.completeMatch(matchId, winnerId, cubeValue);

    return matchesRepository.findById(matchId) as Promise<Match>;
  }

  /**
   * Transfer gold between players
   */
  private async transferGold(
    winnerId: string,
    loserId: string,
    amount: number,
    matchId: string
  ): Promise<void> {
    // Deduct from loser
    const loser = await usersRepository.findById(loserId);
    if (loser) {
      const newLoserBalance = Math.max(0, loser.gold_balance - amount);
      await usersRepository.updateGoldBalance(loserId, newLoserBalance);
      
      await goldRepository.createTransaction({
        user_id: loserId,
        type: 'match_loss',
        amount: -amount,
        balance_after: newLoserBalance,
        description: 'Match loss',
        related_match_id: matchId,
      });
    }

    // Add to winner
    const winner = await usersRepository.findById(winnerId);
    if (winner) {
      const newWinnerBalance = winner.gold_balance + amount;
      await usersRepository.updateGoldBalance(winnerId, newWinnerBalance);
      
      await goldRepository.createTransaction({
        user_id: winnerId,
        type: 'match_win',
        amount: amount,
        balance_after: newWinnerBalance,
        description: 'Match win',
        related_match_id: matchId,
      });
    }
  }

  /**
   * Get user's match history
   */
  async getUserMatches(userId: string, status?: string): Promise<Match[]> {
    return matchesRepository.getUserMatches(userId, status);
  }
}

export const matchesService = new MatchesService();
```

### Step 3.3: Create Matches Controller (FIXED - complete implementation)
Create `src/controllers/matches.controller.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';
import { matchesService } from '../services/matches.service';

export class MatchesController {
  async findOrCreate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const match = await matchesService.findOrCreateMatch(req.user!.userId, req.body);
      res.status(201).json({ success: true, match });
    } catch (error) {
      next(error);
    }
  }

  async getMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const match = await matchesService.getMatch(req.params.id, req.user!.userId);
      res.status(200).json({ success: true, match });
    } catch (error) {
      next(error);
    }
  }

  async setReady(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const match = await matchesService.setPlayerReady(req.params.id, req.user!.userId);
      res.status(200).json({ success: true, match });
    } catch (error) {
      next(error);
    }
  }

  async submitMoves(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { moves } = req.body;
      const match = await matchesService.submitMoves(req.params.id, req.user!.userId, moves);
      res.status(200).json({ success: true, match });
    } catch (error) {
      next(error);
    }
  }

  async getUserMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status } = req.query;
      const matches = await matchesService.getUserMatches(
        req.user!.userId, 
        status as string | undefined
      );
      res.status(200).json({ success: true, matches });
    } catch (error) {
      next(error);
    }
  }
}

export const matchesController = new MatchesController();
```

### Step 3.4: Create Matches Validator
Create `src/validators/matches.validator.ts`:
```typescript
import { z } from 'zod';

export const createMatchSchema = z.object({
  match_type: z.enum(['gold', 'club']),
  stake_amount: z.number().int().min(100).max(1000000),
  club_id: z.string().uuid().optional(),
  doubling_cube_enabled: z.boolean().optional().default(true),
});

export const submitMovesSchema = z.object({
  moves: z.array(z.object({
    from: z.number().int().min(-1).max(23),
    to: z.number().int().min(-1).max(23),
    die_value: z.number().int().min(1).max(6),
  })).min(0).max(4),
});
```

### Step 3.5: Create Matches Routes
Create `src/routes/matches.routes.ts`:
```typescript
import { Router } from 'express';
import { matchesController } from '../controllers/matches.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { createMatchSchema, submitMovesSchema } from '../validators/matches.validator';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

router.post('/', validateRequest(createMatchSchema), matchesController.findOrCreate.bind(matchesController));
router.get('/my', matchesController.getUserMatches.bind(matchesController));
router.get('/:id', matchesController.getMatch.bind(matchesController));
router.post('/:id/ready', matchesController.setReady.bind(matchesController));
router.post('/:id/moves', validateRequest(submitMovesSchema), matchesController.submitMoves.bind(matchesController));

export default router;
```

### Step 3.6: Update Routes Index
Add to `src/routes/index.ts`:
```typescript
import matchesRoutes from './matches.routes';

// Add after auth routes
router.use('/matches', matchesRoutes);
```

---

## PHASE 4: Frontend Game Components

### Step 4.1: Create Frontend Game Types
Create `types/game.types.ts` in frontend:
```typescript
export type Color = 'white' | 'black';

export interface Point {
  pieces: number;
  color: Color | null;
}

export interface Dice {
  value: number;
  used: boolean;
}

export interface GameState {
  board: Point[];
  bar: { white: number; black: number };
  off: { white: number; black: number };
  current_turn: Color;
  dice: Dice[];
  doubling_cube: {
    value: number;
    owner: Color | 'center';
  };
}

export interface Move {
  from: number;
  to: number;
  die_value: number;
}

export interface Match {
  match_id: string;
  match_type: 'gold' | 'club';
  status: 'waiting' | 'ready' | 'in_progress' | 'completed' | 'abandoned';
  player_white_id: string | null;
  player_black_id: string | null;
  player_white_ready: boolean;
  player_black_ready: boolean;
  stake_amount: number;
  club_id: string | null;
  game_state: GameState | null;
  winner_id: string | null;
}
```

### Step 4.2: Create Board Component (FIXED - no Text inside SVG)
Create `components/game/BackgammonBoard.tsx`:
```typescript
import React, { useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Dimensions } from 'react-native';
import Svg, { Polygon, Circle, Rect, G, Text as SvgText } from 'react-native-svg';
import { GameState, Move, Color } from '../../types/game.types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BOARD_PADDING = 16;
const BOARD_WIDTH = SCREEN_WIDTH - (BOARD_PADDING * 2);
const BOARD_HEIGHT = BOARD_WIDTH * 1.1;
const BAR_WIDTH = BOARD_WIDTH / 15;
const POINT_WIDTH = (BOARD_WIDTH - BAR_WIDTH) / 12;
const POINT_HEIGHT = BOARD_HEIGHT * 0.4;
const PIECE_RADIUS = POINT_WIDTH * 0.4;

interface Props {
  gameState: GameState;
  myColor: Color;
  isMyTurn: boolean;
  legalMoves: Move[];
  onMove: (move: Move) => void;
}

export default function BackgammonBoard({
  gameState,
  myColor,
  isMyTurn,
  legalMoves,
  onMove,
}: Props) {
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);

  // Get legal destinations for selected point
  const legalDestinations = useMemo(() => {
    if (selectedPoint === null) return [];
    return legalMoves
      .filter(m => m.from === selectedPoint)
      .map(m => m.to);
  }, [selectedPoint, legalMoves]);

  // Get points that have legal moves available
  const pointsWithMoves = useMemo(() => {
    return [...new Set(legalMoves.map(m => m.from))];
  }, [legalMoves]);

  const handlePointPress = (pointIndex: number) => {
    if (!isMyTurn) return;

    if (selectedPoint === null) {
      // Try to select this point
      const point = gameState.board[pointIndex];
      if (point.color === myColor && point.pieces > 0) {
        if (pointsWithMoves.includes(pointIndex)) {
          setSelectedPoint(pointIndex);
        }
      }
    } else {
      // Try to move to this point
      const move = legalMoves.find(
        m => m.from === selectedPoint && m.to === pointIndex
      );
      if (move) {
        onMove(move);
        setSelectedPoint(null);
      } else {
        // Deselect or select new point
        const point = gameState.board[pointIndex];
        if (point.color === myColor && pointsWithMoves.includes(pointIndex)) {
          setSelectedPoint(pointIndex);
        } else {
          setSelectedPoint(null);
        }
      }
    }
  };

  const handleBarPress = () => {
    if (!isMyTurn || gameState.bar[myColor] === 0) return;
    
    if (pointsWithMoves.includes(-1)) {
      setSelectedPoint(-1);
    }
  };

  const handleBearOffPress = () => {
    if (!isMyTurn || selectedPoint === null) return;
    
    const move = legalMoves.find(
      m => m.from === selectedPoint && m.to === -1
    );
    if (move) {
      onMove(move);
      setSelectedPoint(null);
    }
  };

  // Calculate point position
  const getPointX = (index: number): number => {
    if (index < 6) {
      // Bottom right (points 1-6, indices 0-5)
      return BOARD_WIDTH - ((index + 1) * POINT_WIDTH);
    } else if (index < 12) {
      // Bottom left (points 7-12, indices 6-11)
      return (11 - index) * POINT_WIDTH;
    } else if (index < 18) {
      // Top left (points 13-18, indices 12-17)
      return (index - 12) * POINT_WIDTH;
    } else {
      // Top right (points 19-24, indices 18-23)
      return BOARD_WIDTH - ((24 - index) * POINT_WIDTH);
    }
  };

  const isTopPoint = (index: number): boolean => index >= 12;

  const renderPoint = (index: number) => {
    const isTop = isTopPoint(index);
    const xPos = getPointX(index);
    const isLight = (index % 2 === 0) !== isTop;
    const point = gameState.board[index];
    const isSelected = selectedPoint === index;
    const isLegalDest = legalDestinations.includes(index);
    const hasMoves = pointsWithMoves.includes(index);

    const yStart = isTop ? 0 : BOARD_HEIGHT;
    const yEnd = isTop ? POINT_HEIGHT : BOARD_HEIGHT - POINT_HEIGHT;
    const yMid = isTop ? 0 : BOARD_HEIGHT;

    // Triangle points
    const trianglePoints = `${xPos},${yStart} ${xPos + POINT_WIDTH},${yStart} ${xPos + POINT_WIDTH / 2},${yEnd}`;

    return (
      <G key={index}>
        {/* Triangle background */}
        <Polygon
          points={trianglePoints}
          fill={isLight ? '#D4A574' : '#8B4513'}
          stroke={isSelected ? '#FFD700' : isLegalDest ? '#00FF00' : 'transparent'}
          strokeWidth={isSelected || isLegalDest ? 3 : 0}
          onPress={() => handlePointPress(index)}
        />

        {/* Pieces */}
        {point.pieces > 0 && Array.from({ length: Math.min(point.pieces, 5) }).map((_, i) => {
          const pieceY = isTop
            ? 20 + (i * PIECE_RADIUS * 2.2)
            : BOARD_HEIGHT - 20 - (i * PIECE_RADIUS * 2.2);
          
          return (
            <Circle
              key={i}
              cx={xPos + POINT_WIDTH / 2}
              cy={pieceY}
              r={PIECE_RADIUS}
              fill={point.color === 'white' ? '#FFFFFF' : '#1a1a1a'}
              stroke={point.color === 'white' ? '#333' : '#666'}
              strokeWidth={1}
              onPress={() => handlePointPress(index)}
            />
          );
        })}

        {/* Piece count if more than 5 */}
        {point.pieces > 5 && (
          <SvgText
            x={xPos + POINT_WIDTH / 2}
            y={isTop ? POINT_HEIGHT - 10 : BOARD_HEIGHT - POINT_HEIGHT + 20}
            fontSize={12}
            fontWeight="bold"
            fill={point.color === 'white' ? '#333' : '#FFF'}
            textAnchor="middle"
          >
            {point.pieces}
          </SvgText>
        )}

        {/* Highlight for selectable points */}
        {isMyTurn && hasMoves && !isSelected && (
          <Circle
            cx={xPos + POINT_WIDTH / 2}
            cy={isTop ? POINT_HEIGHT + 10 : BOARD_HEIGHT - POINT_HEIGHT - 10}
            r={4}
            fill="#667eea"
          />
        )}
      </G>
    );
  };

  return (
    <View style={styles.container}>
      <Svg width={BOARD_WIDTH} height={BOARD_HEIGHT}>
        {/* Board background */}
        <Rect x={0} y={0} width={BOARD_WIDTH} height={BOARD_HEIGHT} fill="#5D4037" rx={8} />

        {/* Playing surface */}
        <Rect x={4} y={4} width={BOARD_WIDTH - 8} height={BOARD_HEIGHT - 8} fill="#8D6E63" rx={4} />

        {/* Center bar */}
        <Rect
          x={(BOARD_WIDTH - BAR_WIDTH) / 2}
          y={0}
          width={BAR_WIDTH}
          height={BOARD_HEIGHT}
          fill="#4E342E"
          onPress={handleBarPress}
        />

        {/* Render all 24 points */}
        {Array.from({ length: 24 }).map((_, i) => renderPoint(i))}

        {/* Bar pieces */}
        {gameState.bar.white > 0 && (
          <G>
            <Circle
              cx={BOARD_WIDTH / 2}
              cy={BOARD_HEIGHT / 2 + 30}
              r={PIECE_RADIUS}
              fill="#FFFFFF"
              stroke="#333"
              strokeWidth={1}
              onPress={handleBarPress}
            />
            {gameState.bar.white > 1 && (
              <SvgText
                x={BOARD_WIDTH / 2}
                y={BOARD_HEIGHT / 2 + 35}
                fontSize={10}
                fontWeight="bold"
                fill="#333"
                textAnchor="middle"
              >
                {gameState.bar.white}
              </SvgText>
            )}
          </G>
        )}
        
        {gameState.bar.black > 0 && (
          <G>
            <Circle
              cx={BOARD_WIDTH / 2}
              cy={BOARD_HEIGHT / 2 - 30}
              r={PIECE_RADIUS}
              fill="#1a1a1a"
              stroke="#666"
              strokeWidth={1}
            />
            {gameState.bar.black > 1 && (
              <SvgText
                x={BOARD_WIDTH / 2}
                y={BOARD_HEIGHT / 2 - 25}
                fontSize={10}
                fontWeight="bold"
                fill="#FFF"
                textAnchor="middle"
              >
                {gameState.bar.black}
              </SvgText>
            )}
          </G>
        )}
      </Svg>

      {/* Dice display */}
      <View style={styles.diceContainer}>
        {gameState.dice.map((die, i) => (
          <View key={i} style={[styles.die, die.used && styles.dieUsed]}>
            <Text style={styles.dieText}>{die.value}</Text>
          </View>
        ))}
      </View>

      {/* Bear off area (when legal) */}
      {legalDestinations.includes(-1) && (
        <TouchableOpacity style={styles.bearOffButton} onPress={handleBearOffPress}>
          <Text style={styles.bearOffText}>Bear Off</Text>
        </TouchableOpacity>
      )}

      {/* Turn indicator */}
      <View style={[styles.turnIndicator, !isMyTurn && styles.turnIndicatorWaiting]}>
        <Text style={styles.turnText}>
          {isMyTurn ? 'Your Turn' : "Opponent's Turn"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: BOARD_PADDING,
  },
  diceContainer: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  die: {
    width: 50,
    height: 50,
    backgroundColor: '#FFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  dieUsed: {
    opacity: 0.3,
  },
  dieText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  bearOffButton: {
    marginTop: 16,
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  bearOffText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  turnIndicator: {
    marginTop: 16,
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  turnIndicatorWaiting: {
    backgroundColor: '#999',
  },
  turnText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});
```

### Step 4.3: Create Match API Service
Create `services/api/matchApi.ts`:
```typescript
import apiClient from './axiosInstance';
import { Match, Move } from '../../types/game.types';

export interface CreateMatchData {
  match_type: 'gold' | 'club';
  stake_amount: number;
  club_id?: string;
}

export const matchApi = {
  findOrCreate: (data: CreateMatchData) =>
    apiClient.post<{ success: boolean; match: Match }>('/matches', data),

  getMatch: (matchId: string) =>
    apiClient.get<{ success: boolean; match: Match }>(`/matches/${matchId}`),

  setReady: (matchId: string) =>
    apiClient.post<{ success: boolean; match: Match }>(`/matches/${matchId}/ready`),

  submitMoves: (matchId: string, moves: Move[]) =>
    apiClient.post<{ success: boolean; match: Match }>(`/matches/${matchId}/moves`, { moves }),

  getMyMatches: (status?: string) =>
    apiClient.get<{ success: boolean; matches: Match[] }>('/matches/my', {
      params: status ? { status } : undefined,
    }),
};
```

---

## ✅ LANE 3 COMPLETION CHECKLIST

### Backend
- [ ] Game types created (`src/types/game.types.ts`)
- [ ] Random utility exists (from Lane 1)
- [ ] Game engine service complete with all methods:
  - [ ] initializeGame()
  - [ ] rollDice()
  - [ ] getLegalMoves()
  - [ ] applyMove()
  - [ ] canBearOff()
  - [ ] isGameOver()
  - [ ] getGameResult()
  - [ ] validateMoves()
- [ ] Matches repository complete
- [ ] Matches service complete
- [ ] Matches controller complete
- [ ] Matches validator created
- [ ] Match routes added to index

### Frontend
- [ ] Game types created
- [ ] BackgammonBoard component renders correctly
- [ ] No SVG/Text errors
- [ ] Point triangles display
- [ ] Pieces render on points
- [ ] Piece selection works
- [ ] Legal moves highlight (green)
- [ ] Selected point highlights (gold)
- [ ] Dice display correctly
- [ ] Bear off button appears when legal
- [ ] Match API service created

**When all items are checked, LANE 3 IS COMPLETE!**

---

## 📁 FILES CREATED IN LANE 3

### Backend
```
src/
├── types/
│   └── game.types.ts
├── services/
│   └── game-engine.service.ts
├── repositories/
│   └── matches.repository.ts
├── services/
│   └── matches.service.ts
├── controllers/
│   └── matches.controller.ts
├── validators/
│   └── matches.validator.ts
└── routes/
    └── matches.routes.ts
```

### Frontend
```
types/
└── game.types.ts
components/
└── game/
    └── BackgammonBoard.tsx
services/
└── api/
    └── matchApi.ts
```
