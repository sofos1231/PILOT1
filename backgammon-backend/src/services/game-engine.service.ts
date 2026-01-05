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
