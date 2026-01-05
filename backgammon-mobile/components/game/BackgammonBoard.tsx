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
