import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Animated } from 'react-native';
import PIECE_IMAGES from './icons';

/**
 * Board component
 * Props:
 * - board: 8x8 matrix with piece symbols or null
 * - onSquarePress: function({ row, col })
 */
export default function Board({ board = [], onSquarePress = () => {}, selected = null, highlights = [], attackers = [], lastMove = null }) {
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animar aparición de resaltados cuando cambian
    overlayAnim.setValue(0);
    Animated.timing(overlayAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [highlights]);
  // Helper to render a single square
  const renderSquare = (piece, row, col) => {
    const isLight = (row + col) % 2 === 0;
    const backgroundColor = isLight ? styles.lightSquare.backgroundColor : styles.darkSquare.backgroundColor;
  const pieceKey = piece ? `${piece.color}${piece.type}` : null;
  const pieceImage = pieceKey ? PIECE_IMAGES[pieceKey] : null;
  const isSelected = selected && selected.row === row && selected.col === col;
  const hl = highlights.find(h => h.row === row && h.col === col);
  const isHighlighted = !!hl;
  const isAttacker = attackers.some(a => a.row === row && a.col === col);
  const isLastMoveFrom = lastMove && lastMove.from && lastMove.from.row === row && lastMove.from.col === col;
  const isLastMoveTo = lastMove && lastMove.to && lastMove.to.row === row && lastMove.to.col === col;

    return (
      <TouchableOpacity
        key={`${row}-${col}`}
        style={[
          styles.square,
          { backgroundColor },
          isSelected && styles.selected,
          isAttacker && styles.attacker,
          isLastMoveFrom && styles.lastMoveFrom,
          isLastMoveTo && styles.lastMoveTo,
        ]}
        onPress={() => onSquarePress({ row, col })}
        activeOpacity={0.8}
      >
        {pieceImage ? (
          <Image source={pieceImage} style={styles.pieceImage} resizeMode="contain" />
        ) : (
          <Text style={styles.pieceText}>{piece ? (piece.color + piece.type) : ''}</Text>
        )}

        {/* Overlay para resaltar movimientos (detrás de badges/indicadores) */}
        {isHighlighted && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.overlay,
              { backgroundColor: hl.capture ? 'rgba(200,20,20,0.35)' : 'rgba(0,180,80,0.22)', opacity: overlayAnim },
            ]}
          />
        )}

        {/* (badge removed) attackers are indicated by the attacker border style */}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.board}>
      {board.map((rowArr, row) => (
        <View key={`r-${row}`} style={styles.row}>
          {rowArr.map((piece, col) => renderSquare(piece, row, col))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    width: 320,
    height: 320,
    borderWidth: 2,
    borderColor: '#333',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  square: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightSquare: {
    backgroundColor: '#f0d9b5',
  },
  darkSquare: {
    backgroundColor: '#b58863',
  },
  pieceText: {
    fontSize: 20,
    fontWeight: '600',
  },
  pieceImage: {
    width: '70%',
    height: '70%',
  },
  highlight: {
    borderWidth: 3,
    borderColor: 'rgba(0,200,0,0.6)',
  },
  selected: {
    borderWidth: 3,
    borderColor: 'rgba(0,120,255,0.9)',
  },
  attacker: {
    borderWidth: 3,
    borderColor: 'rgba(255,215,0,0.95)',
  },
  lastMoveFrom: {
    borderWidth: 2,
    borderColor: 'rgba(250,180,0,0.95)'
  },
  lastMoveTo: {
    borderWidth: 3,
    borderColor: 'rgba(250,120,0,0.95)'
  },
  
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 4,
  },
});
