import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Animated, useWindowDimensions } from 'react-native';
import PIECE_IMAGES from './icons';

/**
 * Board component
 * Props:
 * - board: 8x8 matrix with piece symbols or null
 * - onSquarePress: function({ row, col })
 */
export default function Board({ board = [], onSquarePress = () => {}, selected = null, highlights = [], attackers = [], ultimoMovimiento = null, flipped = false }) {
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const moveAnim = useRef(new Animated.Value(0)).current;

  // Responsive board sizing: use full available window dimensions and reserve space
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const MAX_BOARD = Math.min(720, Math.max(windowWidth, windowHeight));
  const SIDE_MARGIN = 140; // espacio estimado para paneles y paddings
  const VERTICAL_MARGIN = 260; // estimado para encabezado, controles y historial
  const availWidth = Math.max(240, windowWidth - SIDE_MARGIN);
  const availHeight = Math.max(240, windowHeight - VERTICAL_MARGIN);
  const boardSize = Math.min(MAX_BOARD, availWidth, availHeight);
  const squareSize = boardSize / 8;

  useEffect(() => {
    // Animar aparición de resaltados cuando cambian
    overlayAnim.setValue(0);
    Animated.timing(overlayAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [highlights]);

  useEffect(() => {
    if (ultimoMovimiento && ultimoMovimiento.to) {
      // Animate the moved piece: rotateY 0 -> 180deg
      moveAnim.setValue(0);
      Animated.timing(moveAnim, {
        toValue: 1,
        duration: 480,
        useNativeDriver: true,
      }).start();
    }
  }, [ultimoMovimiento]);
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
    const isLastMoveFrom = ultimoMovimiento && ultimoMovimiento.from && ultimoMovimiento.from.row === row && ultimoMovimiento.from.col === col;
    const isLastMoveTo = ultimoMovimiento && ultimoMovimiento.to && ultimoMovimiento.to.row === row && ultimoMovimiento.to.col === col;

    return (
      <TouchableOpacity
        key={`${row}-${col}`}
        style={[
          styles.square,
          { backgroundColor, width: squareSize, height: squareSize },
          isSelected && styles.selected,
          isAttacker && styles.attacker,
          isLastMoveFrom && styles.lastMoveFrom,
          isLastMoveTo && styles.lastMoveTo,
        ]}
        onPress={() => onSquarePress({ row, col })}
        activeOpacity={0.8}
      >
        {pieceImage ? (
          (() => {
            const isMovedDest = ultimoMovimiento && ultimoMovimiento.to && ultimoMovimiento.to.row === row && ultimoMovimiento.to.col === col;
            const AniImage = Animated.createAnimatedComponent(Image);
            const rotate = moveAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
            const imgStyle = [{ width: squareSize * 0.78, height: squareSize * 0.78 }];
            if (isMovedDest) {
              imgStyle.push({ transform: [{ perspective: 800 }, { rotateY: rotate }] });
            }
            return <AniImage source={pieceImage} style={imgStyle} resizeMode="contain" />;
          })()
        ) : (
          <Text style={[styles.pieceText, { fontSize: Math.max(12, squareSize * 0.32) }]}>{piece ? (piece.color + piece.type) : ''}</Text>
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

        {/* attackers indicated by border styles */}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.boardWrapper}>
      {/* Top file labels */}
      <View style={{ alignItems: 'center', marginBottom: 4 }}>
        <View style={{ width: boardSize + 48, alignItems: 'center' }}>
          <View style={{ width: boardSize, flexDirection: 'row' }}>
                {(flipped ? ['H','G','F','E','D','C','B','A'] : ['A','B','C','D','E','F','G','H']).map((f, idx) => (
                  <View key={`file-top-${idx}`} style={{ width: squareSize, alignItems: 'center' }}>
                    <Text style={styles.fileLabelText}>{f}</Text>
                  </View>
                ))}
          </View>
        </View>
      </View>

      {/* Board with rank labels */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Left ranks */}
        <View style={{ width: 28 }}>
          {(flipped ? ([...Array(8)].map((_,i)=> i+1)) : ([...Array(8)].map((_,i)=> 8-i))).map((rLabel, i) => (
            <View key={`rank-l-${i}`} style={{ width: 28, height: squareSize, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={styles.rankLabelText}>{rLabel}</Text>
            </View>
          ))}
        </View>

        {/* Board */}
        <View style={{ width: boardSize, height: boardSize, borderWidth: 2, borderColor: '#333' }}>
          {(flipped ? [...board].slice().reverse() : board).map((rowArr, displayRowIdx) => {
            return (
              <View key={`r-${displayRowIdx}`} style={{ flexDirection: 'row' }}>
                {(flipped ? [...rowArr].slice().reverse() : rowArr).map((piece, displayColIdx) => {
                  // Map displayed coordinates to actual board coordinates
                  const actualRow = flipped ? (7 - displayRowIdx) : displayRowIdx;
                  const actualCol = flipped ? (7 - displayColIdx) : displayColIdx;
                  return renderSquare(piece, actualRow, actualCol);
                })}
              </View>
            );
          })}
        </View>

        {/* Right ranks */}
        <View style={{ width: 28 }}>
          {(flipped ? ([...Array(8)].map((_,i)=> i+1)) : ([...Array(8)].map((_,i)=> 8-i))).map((rLabel, i) => (
            <View key={`rank-r-${i}`} style={{ width: 28, height: squareSize, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={styles.rankLabelText}>{rLabel}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Bottom file labels */}
      <View style={{ alignItems: 'center', marginTop: 4 }}>
        <View style={{ width: boardSize + 48, alignItems: 'center' }}>
          <View style={{ width: boardSize, flexDirection: 'row' }}>
              {(flipped ? ['H','G','F','E','D','C','B','A'] : ['A','B','C','D','E','F','G','H']).map((f, idx) => (
                <View key={`file-b-${idx}`} style={{ width: squareSize, alignItems: 'center' }}>
                  <Text style={styles.fileLabelText}>{f}</Text>
                </View>
              ))}
            </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  boardWrapper: {
    alignItems: 'center',
  },
  board: {
    width: 320,
    height: 320,
    borderWidth: 2,
    borderColor: '#333',
  },
  row: {
    height: 40,
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
  pieceFlipped: {
    transform: [{ rotate: '180deg' }],
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
  fileLabelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  filesContainer: {
    flexDirection: 'row',
  },
  fileLabelCell: {
    width: 40,
    alignItems: 'center',
  },
  fileLabelText: {
    fontWeight: '700',
  },
  cornerLabel: {
    width: 24,
  },
  boardRowWithRanks: {
    flexDirection: 'column',
  },
  rowWithRank: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankLabel: {
    width: 24,
    alignItems: 'center',
  },
  rankLabelText: {
    fontWeight: '700',
  },
});
