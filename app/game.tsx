import { authService } from '@/services/auth';
import { gameApi } from '@/services/gameApi';
import { getUserIdFromToken, getUsernameFromToken, tokenStorage } from '@/utils/tokenStorage';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, findNodeHandle, StyleSheet, Text, TouchableOpacity, UIManager, useWindowDimensions, View } from 'react-native';

type GridMetrics = { pageX: number; pageY: number; cellSize: number; gridSize: number };
type AttackCell = { row: number; col: number; sunk?: boolean };

type PlacedShapeRender = { id: string; cells: { row: number; col: number }[] };

function Grid({
  label,
  scale = 1,
  onMetrics,
  preview,
  placed,
  shots,
  onPlacedDragStart,
  onPlacedDragMove,
  onPlacedDragEnd,
  liftingId,
  onCellPress,
  pendingAttack,
}: {
  label: string;
  scale?: number;
  onMetrics?: (m: GridMetrics) => void;
  preview?: { cells: { row: number; col: number }[]; valid: boolean } | null;
  placed?: PlacedShapeRender[];
  shots?: {
    hits?: { row: number; col: number; sunk?: boolean }[];
    misses?: { row: number; col: number }[];
    sunk?: { row: number; col: number }[];
  };
  onPlacedDragStart?: (id: string, pageX: number, pageY: number) => void;
  onPlacedDragMove?: (pageX: number, pageY: number) => void;
  onPlacedDragEnd?: () => void;
  liftingId?: string | null;
  onCellPress?: (row: number, col: number) => void;
  pendingAttack?: { row: number; col: number } | null;
}) {
  const { width, height } = useWindowDimensions();

  const availableWidth = width * 0.45; // each grid uses ~45% of width
  const availableHeight = height * 0.9; // leave a bit of vertical margin
  const gridSize = Math.min(availableWidth, availableHeight) * scale;
  const cellSize = Math.floor(gridSize / 10);
  const normalizedGridSize = cellSize * 10; // ensure perfect 10x10

  const rows = Array.from({ length: 10 }, (_, row) => row);
  const cols = Array.from({ length: 10 }, (_, col) => col);

  const gridRef = useRef<View | null>(null);

  function handleCellPress(row: number, col: number) {
    if (!onCellPress) {
      return;
    }
    onCellPress(row, col);
  }

  function reportMetrics() {
    const node = findNodeHandle(gridRef.current);
    if (!node) return;
    UIManager.measureInWindow(node, (px: number, py: number, _w: number, _h: number) => {
      onMetrics?.({ pageX: px, pageY: py, cellSize, gridSize: normalizedGridSize });
    });
  }

  return (
    <View style={styles.gridContainer}>
      <Text style={styles.gridLabel}>{label}</Text>
      <View
        style={[
          styles.grid,
          { width: normalizedGridSize, height: normalizedGridSize },
        ]}
        ref={gridRef}
        onLayout={reportMetrics}
      >
        {rows.map((r) => (
          <View key={`r-${r}`} style={[styles.row, { height: cellSize }]}>
            {cols.map((c) => {
              const isPending = pendingAttack?.row === r && pendingAttack?.col === c;
              return (
                <TouchableOpacity
                  key={`c-${c}`}
                  activeOpacity={onCellPress ? 0.65 : 1}
                  onPress={() => handleCellPress(r, c)}
                  style={[styles.cell, { width: cellSize, height: cellSize }]}
                >
                  {isPending ? <View style={styles.pendingMarker} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
        {placed?.filter(ps => ps && ps.id && ps.cells && ps.cells.length > 0).map((ps) => {
          const minRow = Math.min(...ps.cells.map(c => c.row));
          const minCol = Math.min(...ps.cells.map(c => c.col));
          const maxRow = Math.max(...ps.cells.map(c => c.row));
          const maxCol = Math.max(...ps.cells.map(c => c.col));
          const boxLeft = minCol * cellSize;
          const boxTop = minRow * cellSize;
          const boxW = (maxCol - minCol + 1) * cellSize;
          const boxH = (maxRow - minRow + 1) * cellSize;
          return (
            <View
              key={`ps-${ps.id}-${minRow}-${minCol}`}
              style={[styles.placedBox, { left: boxLeft, top: boxTop, width: boxW, height: boxH, opacity: liftingId === ps.id ? 0 : 1 }]}
              onStartShouldSetResponder={() => true}
              onResponderGrant={(e) => onPlacedDragStart?.(ps.id, e.nativeEvent.pageX, e.nativeEvent.pageY)}
              onResponderMove={(e) => onPlacedDragMove?.(e.nativeEvent.pageX, e.nativeEvent.pageY)}
              onResponderRelease={() => onPlacedDragEnd?.()}
              onResponderTerminate={() => onPlacedDragEnd?.()}
            >
              {ps.cells.map((cell, idx) => (
                <View
                  key={`psc-${ps.id}-${idx}`}
                  pointerEvents="none"
                  style={[
                    styles.placedCell,
                    {
                      left: (cell.col - minCol) * cellSize,
                      top: (cell.row - minRow) * cellSize,
                      width: cellSize,
                      height: cellSize,
                    },
                  ]}
                />
              ))}
            </View>
          );
        })}
        {shots?.misses
          ?.filter((cell) => typeof cell?.row === 'number' && typeof cell?.col === 'number')
          .map((cell, idx) => (
            <View
              key={`miss-${idx}`}
              pointerEvents="none"
              style={[
                styles.shotMarker,
                styles.missMarker,
                {
                  left: cell.col * cellSize,
                  top: cell.row * cellSize,
                  width: cellSize,
                  height: cellSize,
                },
              ]}
            />
          ))}
        {shots?.hits
          ?.filter((cell) => typeof cell?.row === 'number' && typeof cell?.col === 'number')
          .map((cell, idx) => (
            <View
              key={`hit-${idx}`}
              pointerEvents="none"
              style={[
                styles.shotMarker,
                cell?.sunk ? styles.sunkMarker : styles.hitMarker,
                {
                  left: cell.col * cellSize,
                  top: cell.row * cellSize,
                  width: cellSize,
                  height: cellSize,
                },
              ]}
            />
          ))}
        {shots?.sunk
          ?.filter((cell) => typeof cell?.row === 'number' && typeof cell?.col === 'number')
          .map((cell, idx) => (
            <View
              key={`sunk-${idx}`}
              pointerEvents="none"
              style={[
                styles.shotMarker,
                styles.sunkMarker,
                {
                  left: cell.col * cellSize,
                  top: cell.row * cellSize,
                  width: cellSize,
                  height: cellSize,
                },
              ]}
            />
          ))}
        {preview?.cells?.map((cell, idx) => (
          <View
            key={`p-${idx}`}
            pointerEvents="none"
            style={[
              styles.previewCell,
              {
                left: cell.col * cellSize,
                top: cell.row * cellSize,
                width: cellSize,
                height: cellSize,
                backgroundColor: preview.valid ? 'rgba(46, 204, 113, 0.35)' : 'rgba(231, 76, 60, 0.35)',
                borderColor: preview.valid ? '#2ecc71' : '#e74c3c',
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

type Shape = { id: string; name: string; cells: { x: number; y: number }[] };

function getShapeBounds(cells: { x: number; y: number }[]) {
  const maxX = Math.max(...cells.map(c => c.x));
  const maxY = Math.max(...cells.map(c => c.y));
  return { width: maxX + 1, height: maxY + 1 };
}

type PlayerCombatSnapshot = {
  uuid: string | null;
  name: string | null;
  boardSubmitted: boolean;
  hits: AttackCell[];
  misses: AttackCell[];
  sunk: AttackCell[];
};

const normalizeCells = (value: unknown): AttackCell[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (Array.isArray(item)) {
        if (item.length < 2) {
          return null;
        }
        const [xRaw, yRaw, extra] = item as unknown[];
        if (xRaw == null || yRaw == null || xRaw === '' || yRaw === '') {
          return null;
        }
        const col = Number(xRaw);
        const row = Number(yRaw);
        if (!Number.isFinite(col) || !Number.isFinite(row)) {
          return null;
        }
        const sunk = extra === true || extra === 'sunk';
        return sunk ? ({ row, col, sunk: true } as AttackCell) : ({ row, col } as AttackCell);
      }
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        const rowSource = record.row ?? record.y;
        const colSource = record.col ?? record.x;
        if (rowSource == null || colSource == null || rowSource === '' || colSource === '') {
          return null;
        }
        const row = typeof rowSource === 'number' ? rowSource : Number(rowSource);
        const col = typeof colSource === 'number' ? colSource : Number(colSource);
        const sunk =
          record.sunk === true ||
          record.isSunk === true ||
          record.status === 'sunk' ||
          record.sank === true;
        return { row, col, sunk } as AttackCell;
      }
      return null;
    })
    .filter((cell): cell is AttackCell => cell != null);
};

export default function GameScreen() {
  const { gameId, playerTokens: playerTokensParam, opponentName: opponentNameParam, opponentUuid: opponentUuidParam } =
    useLocalSearchParams<{ gameId: string; playerTokens?: string; opponentName?: string; opponentUuid?: string }>();
  const { height: screenHeight } = useWindowDimensions();
  const matchTokens = useMemo<string[]>(() => {
    if (!playerTokensParam) {
      return [];
    }
    try {
      const decodedParam = Array.isArray(playerTokensParam)
        ? playerTokensParam[0]
        : playerTokensParam;
      const parsed = JSON.parse(decodedParam);
      return Array.isArray(parsed) ? parsed.filter((token) => typeof token === 'string') : [];
    } catch (error) {
      console.warn('Failed to parse player tokens from params', error);
      return [];
    }
  }, [playerTokensParam]);
  const opponentName = useMemo(() => {
    if (!opponentNameParam) {
      return '';
    }
    const value = Array.isArray(opponentNameParam) ? opponentNameParam[0] : opponentNameParam;
    return typeof value === 'string' ? value : '';
  }, [opponentNameParam]);
  const opponentUuid = useMemo(() => {
    if (!opponentUuidParam) {
      return '';
    }
    const value = Array.isArray(opponentUuidParam) ? opponentUuidParam[0] : opponentUuidParam;
    return typeof value === 'string' ? value : '';
  }, [opponentUuidParam]);
  const displayGameId = useMemo(() => {
    if (!gameId) {
      return '';
    }
    const value = Array.isArray(gameId) ? gameId[0] : gameId;
    return typeof value === 'string' ? value : '';
  }, [gameId]);
  const verticalShiftValue = useMemo(() => {
    if (!screenHeight) {
      return 0;
    }
    const desiredShift = screenHeight * 0.045;
    return Math.max(0, Math.min(60, Math.round(desiredShift)));
  }, [screenHeight]);
  const contentShiftStyle = useMemo(
    () => ({
      marginTop: verticalShiftValue ? -verticalShiftValue : 0,
    }),
    [verticalShiftValue]
  );
  
  const shapes: Shape[] = useMemo(
    () => [
      { id: 's-3x1', name: '3x1', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] },
      { id: 's-2x1', name: '2x1', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
      { id: 's-2x2', name: '2x2', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
      { id: 's-4x1', name: '4x1', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }] },
      { id: 's-u', name: 'U', cells: [
        { x: 0, y: 0 }, { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: 2 }, { x: 1, y: 2 },
      ] },
    ],
    []
  );

  const shapesById = useMemo(() => {
    const map: Record<string, Shape> = {};
    shapes.forEach((shape) => {
      map[shape.id] = shape;
    });
    return map;
  }, [shapes]);

  const [draggingShape, setDraggingShape] = useState<Shape | null>(null);
  const dragPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dragOffset = useRef({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [playerSelfName, setPlayerSelfName] = useState<string>('Player 1');
  const [selfToken, setSelfToken] = useState<string | null>(null);
  const [selfUserId, setSelfUserId] = useState<string | null>(null);
  const [playerIndex, setPlayerIndex] = useState<number | null>(null);
  const [playerOneLabel, setPlayerOneLabel] = useState<string>('Player 1');
  const [playerTwoLabel, setPlayerTwoLabel] = useState<string>('Player 2');
  const [playerOneUuid, setPlayerOneUuid] = useState<string | null>(null);
  const [playerTwoUuid, setPlayerTwoUuid] = useState<string | null>(null);
  const [opponentDisplayName, setOpponentDisplayName] = useState<string>(
    opponentName ? opponentName : 'Opponent'
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [currentTurnLabel, setCurrentTurnLabel] = useState<string | null>(null);
  const [selfCombatSnapshot, setSelfCombatSnapshot] = useState<PlayerCombatSnapshot | null>(null);
  const [opponentCombatSnapshot, setOpponentCombatSnapshot] = useState<PlayerCombatSnapshot | null>(null);
  const [gamePhaseLabel, setGamePhaseLabel] = useState<string | null>(null);
  const [gameResult, setGameResult] = useState<{ winner: string | null; loser: string | null } | null>(null);
  const [isCurrentTurnSelf, setIsCurrentTurnSelf] = useState(false);
  const [pendingAttack, setPendingAttack] = useState<{ row: number; col: number } | null>(null);
  const [isSubmittingAttack, setIsSubmittingAttack] = useState(false);
  const [attackFeedback, setAttackFeedback] = useState<string | null>(null);
  const [selfAttackHistory, setSelfAttackHistory] = useState<{ hits: AttackCell[]; misses: AttackCell[] }>({
    hits: [],
    misses: [],
  });
  const [opponentAttackHistory, setOpponentAttackHistory] = useState<{ hits: AttackCell[]; misses: AttackCell[] }>({
    hits: [],
    misses: [],
  });
  const [hasBothBoardsSubmitted, setHasBothBoardsSubmitted] = useState(false);
  const [manualAttackMarkers, setManualAttackMarkers] = useState<{ row: number; col: number }[]>([]);
  const [leftGridMetrics, setLeftGridMetrics] = useState<GridMetrics | null>(null);
  const [hoverPreview, setHoverPreview] = useState<{ cells: { row: number; col: number }[]; valid: boolean } | null>(null);
  const [placedShapesLeft, setPlacedShapesLeft] = useState<{ id: string; cells: { row: number; col: number }[] }[]>([]);
  const [usedShapeIds, setUsedShapeIds] = useState<Set<string>>(new Set());
  const [dragSource, setDragSource] = useState<'palette' | 'grid' | null>(null);
  const liftedPrevCellsRef = useRef<{ id: string; cells: { row: number; col: number }[] } | null>(null);
  const [paletteMetrics, setPaletteMetrics] = useState<{ pageX: number; pageY: number; width: number; height: number } | null>(null);
  const paletteRef = useRef<View | null>(null);
  const [liftingId, setLiftingId] = useState<string | null>(null);
  const lastDragCoords = useRef<{ x: number; y: number } | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isSubmittingBoard, setIsSubmittingBoard] = useState(false);
  const [isIntrospecting, setIsIntrospecting] = useState(true);
  //const [gameSocketStatus, setGameSocketStatus] = useState<GameSocketStatus>('disconnected');
  //const [gameStatusSocketStatus, setGameStatusSocketStatus] = useState<GameStatusSocketState>('disconnected');
  const [authReady, setAuthReady] = useState(false);
  const [gameReady, setGameReady] = useState(false);
  const allPlaced = usedShapeIds.size === shapes.length;

  useEffect(() => {
    setSelfAttackHistory({ hits: [], misses: [] });
    setOpponentAttackHistory({ hits: [], misses: [] });
    setHasBothBoardsSubmitted(false);
    setManualAttackMarkers([]);
  }, [displayGameId]);

  useEffect(() => {
    if (!matchTokens.length) {
      return;
    }
    if (!selfToken && !selfUserId) {
      return;
    }
    let foundIndex = -1;
    matchTokens.forEach((candidate, idx) => {
      if (foundIndex !== -1) {
        return;
      }
      if (selfToken && candidate === selfToken) {
        foundIndex = idx;
        return;
      }
      if (selfUserId) {
        try {
          const candidateUserId = getUserIdFromToken(candidate);
          if (candidateUserId === selfUserId) {
            foundIndex = idx;
          }
        } catch {
          // ignore decoding errors for other tokens
        }
      }
    });
    if (foundIndex !== -1 && playerIndex !== foundIndex + 1) {
      setPlayerIndex(foundIndex + 1);
    }
  }, [matchTokens, selfToken, selfUserId, playerIndex]);

  // Call introspect and connect to game socket when game screen loads
  useEffect(() => {
    const initializeGame = async () => {
      try {
        setIsIntrospecting(true);
        setAuthReady(false);
        setGameReady(false);
        // Get token from storage
        const token = await tokenStorage.getToken();
        if (!token) {
          Alert.alert('Authentication Error', 'No token found. Please login again.', [
            { text: 'OK', onPress: () => router.replace('/login') }
          ]);
          return;
        }
        setSelfToken(token);
        let resolvedUserId: string | null = null;
        try {
          const extractedUserId = getUserIdFromToken(token);
          setSelfUserId(extractedUserId);
          resolvedUserId = extractedUserId;
        } catch (error) {
          console.warn('Failed to extract user id from token', error);
        }
        const tokenUsername = getUsernameFromToken(token);
        if (tokenUsername) {
          setPlayerSelfName(tokenUsername);
        }
        // Call introspect with the token
        const result = await authService.introspect(token);
        if (!result.active) {
          Alert.alert('Authentication Error', 'Your session is invalid. Please login again.', [
            { text: 'OK', onPress: () => router.replace('/login') }
          ]);
          return;
        }
        const detectedName =
          (typeof result.username === 'string' && result.username.trim()) ||
          (typeof result.user?.username === 'string' && result.user.username.trim()) ||
          (typeof result.user?.name === 'string' && result.user.name.trim()) ||
          (typeof result.name === 'string' && result.name.trim()) ||
          (typeof result.profile?.username === 'string' && result.profile.username.trim()) ||
          (typeof result.profile?.name === 'string' && result.profile.name.trim()) ||
          (typeof result.account?.username === 'string' && result.account.username.trim()) ||
          '';
        if (detectedName) {
          setPlayerSelfName(detectedName);
        }
        if (typeof result.sub === 'string' && result.sub.trim()) {
          const trimmed = result.sub.trim();
          setSelfUserId((prev) => prev ?? trimmed);
          if (!resolvedUserId) {
            resolvedUserId = trimmed;
          }
        }
        const introspectionUuidCandidates = [
          result?.user?.sub,
          result?.user?.id,
          result?.user?.uuid,
          result?.profile?.sub,
          result?.profile?.id,
          result?.profile?.uuid,
        ];
        if (!resolvedUserId) {
          const candidate = introspectionUuidCandidates.find(
            (value) => typeof value === 'string' && value.trim().length > 0
          );
          if (candidate) {
            resolvedUserId = (candidate as string).trim();
            setSelfUserId((prev) => prev ?? resolvedUserId);
          }
        }
        if (!resolvedUserId) {
          throw new Error('Could not resolve your player id (uuid) for the game connection.');
        }
        setAuthReady(true);
      } catch (error: any) {
        setAuthReady(false);
        setGameReady(false);
        Alert.alert('Authentication Error', error.message || 'Failed to verify session. Please login again.', [
          { text: 'OK', onPress: () => router.replace('/login') }
        ]);
        return;
      } finally {
        setIsIntrospecting(false);
      }
    };

    initializeGame();
  }, [displayGameId, matchTokens]);

  const resolveTurnLabel = useCallback(
    (turnValue: unknown) => {
      if (turnValue === undefined || turnValue === null) {
        return null;
      }

      let numericValue: number | null = null;
      let candidateUuid: string | null = null;

      if (typeof turnValue === 'string') {
        const trimmed = turnValue.trim();
        if (!trimmed) {
          return null;
        }
        if (/^\d+$/.test(trimmed)) {
          const parsed = Number(trimmed);
          if (!Number.isNaN(parsed)) {
            numericValue = parsed;
          }
        } else {
          candidateUuid = trimmed;
        }
      } else if (typeof turnValue === 'number' && !Number.isNaN(turnValue)) {
        numericValue = turnValue;
      }

      if (candidateUuid) {
        if (playerOneUuid && candidateUuid === playerOneUuid) {
          return playerOneLabel;
        }
        if (playerTwoUuid && candidateUuid === playerTwoUuid) {
          return playerTwoLabel;
        }
      }

      if (numericValue != null) {
        if (numericValue === 1) {
          return playerOneLabel;
        }
        if (numericValue === 2) {
          return playerTwoLabel;
        }
        return `Player ${numericValue}`;
      }

      if (typeof turnValue === 'string') {
        return turnValue;
      }
      return String(turnValue);
    },
    [playerOneLabel, playerTwoLabel, playerOneUuid, playerTwoUuid]
  );

  const deriveStatusMessage = useCallback(
    (payload: any, explicitStatus?: string | null) => {
      const statusValue =
        explicitStatus ??
        (typeof payload?.status === 'string' ? payload.status : null);
      if (statusValue) {
        const normalized = statusValue.toLowerCase();
        if (normalized === 'active' || normalized === 'game_started' || normalized === 'started') {
          return null;
        }
        if (normalized.includes('wait')) {
          return 'Waiting for opponent...';
        }
        if (typeof payload?.message === 'string' && payload.message.trim()) {
          return payload.message.trim();
        }
        return statusValue;
      }
      if (typeof payload?.message === 'string') {
        const trimmed = payload.message.trim();
        if (!trimmed) {
          return null;
        }
        if (trimmed.toLowerCase().includes('meciul a inceput')) {
          return null;
        }
        return trimmed;
      }
      if (payload?.type === 'board_submitted') {
        if (payload.player && playerIndex != null) {
          if (payload.player === playerIndex) {
            return 'Board submitted. Waiting for opponent...';
          }
          return 'Opponent submitted their board.';
        }
        return 'Board submitted.';
      }
      return null;
    },
    [playerIndex]
  );

  const applyGameStateUpdate = useCallback(
    (payload: any) => {
      if (!payload) {
        return;
      }

      let statusValue: string | null = null;
      if (typeof payload.status === 'string') {
        statusValue = payload.status;
      } else if (typeof payload.status === 'number') {
        statusValue = String(payload.status);
      }

      const candidateTurn = payload.currentTurn ?? payload.turn ?? payload.nextTurn;
      let nextCurrentTurnLabel: string | null = null;

      if (candidateTurn !== undefined) {
        nextCurrentTurnLabel = resolveTurnLabel(candidateTurn);
      } else if (payload.type === 'game_started') {
        nextCurrentTurnLabel = resolveTurnLabel(payload.currentTurn);
      } else if (statusValue && statusValue.toLowerCase().includes('wait')) {
        nextCurrentTurnLabel = null;
      }

      const players = payload.type === 'game_status' ? payload.players ?? {} : {};
      const mapSnapshot = (data: any): PlayerCombatSnapshot => ({
        uuid: typeof data?.uuid === 'string' ? data.uuid : null,
        name: typeof data?.name === 'string' && data.name.trim() ? data.name.trim() : null,
        boardSubmitted: Boolean(data?.boardSubmitted),
        hits: normalizeCells(data?.hits),
        misses: normalizeCells(data?.misses),
        sunk: normalizeCells(data?.sunk ?? data?.sinks ?? data?.sank),
      });

      const playerOneSnapshot: PlayerCombatSnapshot | null =
        payload.type === 'game_status' ? mapSnapshot(players['1'] ?? players[1]) : null;
      const playerTwoSnapshot: PlayerCombatSnapshot | null =
        payload.type === 'game_status' ? mapSnapshot(players['2'] ?? players[2]) : null;

      const nextPlayerOneLabel = playerOneSnapshot?.name?.trim() || playerOneLabel || 'Player 1';
      const nextPlayerTwoLabel = playerTwoSnapshot?.name?.trim() || playerTwoLabel || 'Player 2';
      const nextPlayerOneUuid = playerOneSnapshot?.uuid ?? playerOneUuid;
      const nextPlayerTwoUuid = playerTwoSnapshot?.uuid ?? playerTwoUuid;

      if (payload.type === 'game_status') {
        setPlayerOneLabel(nextPlayerOneLabel);
        setPlayerTwoLabel(nextPlayerTwoLabel);
        setPlayerOneUuid(nextPlayerOneUuid ?? null);
        setPlayerTwoUuid(nextPlayerTwoUuid ?? null);

        if (candidateTurn !== undefined) {
          if (candidateTurn === 1) {
            nextCurrentTurnLabel = nextPlayerOneLabel;
          } else if (candidateTurn === 2) {
            nextCurrentTurnLabel = nextPlayerTwoLabel;
          } else if (typeof candidateTurn === 'string') {
            if (nextPlayerOneUuid && candidateTurn === nextPlayerOneUuid) {
              nextCurrentTurnLabel = nextPlayerOneLabel;
            } else if (nextPlayerTwoUuid && candidateTurn === nextPlayerTwoUuid) {
              nextCurrentTurnLabel = nextPlayerTwoLabel;
            }
          }
        }
      }

      const labelForValue = (value: any): string | null => {
        if (value === undefined || value === null) {
          return null;
        }
        if (value === 1 || value === '1') {
          return nextPlayerOneLabel;
        }
        if (value === 2 || value === '2') {
          return nextPlayerTwoLabel;
        }
        if (typeof value === 'string') {
          if (nextPlayerOneUuid && value === nextPlayerOneUuid) {
            return nextPlayerOneLabel;
          }
          if (nextPlayerTwoUuid && value === nextPlayerTwoUuid) {
            return nextPlayerTwoLabel;
          }
          return value.trim() || null;
        }
        if (typeof value === 'number') {
          return `Player ${value}`;
        }
        return String(value);
      };

      const winnerLabel = labelForValue(payload.winner);
      const loserLabel = labelForValue(payload.loser);
      const normalizedStatus = typeof statusValue === 'string' ? statusValue.toLowerCase() : null;
      let message = deriveStatusMessage(payload, statusValue);
      let gameEnded = false;
      if (normalizedStatus?.includes('ended') || payload.type === 'game_ended') {
        gameEnded = true;
        if (winnerLabel && loserLabel) {
          message = `${winnerLabel} defeated ${loserLabel}`;
        } else if (winnerLabel) {
          message = `${winnerLabel} won the game`;
        } else if (loserLabel) {
          message = `${loserLabel} has been eliminated`;
        } else if (!message) {
          message = 'Game ended';
        }
        nextCurrentTurnLabel = loserLabel ? `${loserLabel} eliminated` : null;
      }

      let selfSnapshot: PlayerCombatSnapshot | null = null;
      let enemySnapshot: PlayerCombatSnapshot | null = null;

      if (playerIndex === 1) {
        selfSnapshot = playerOneSnapshot;
        enemySnapshot = playerTwoSnapshot;
      } else if (playerIndex === 2) {
        selfSnapshot = playerTwoSnapshot;
        enemySnapshot = playerOneSnapshot;
      } else if (selfUserId && payload.type === 'game_status') {
        if (playerOneSnapshot?.uuid === selfUserId) {
          selfSnapshot = playerOneSnapshot;
          enemySnapshot = playerTwoSnapshot;
        } else if (playerTwoSnapshot?.uuid === selfUserId) {
          selfSnapshot = playerTwoSnapshot;
          enemySnapshot = playerOneSnapshot;
        }
      }

      if (selfSnapshot) {
        setSelfCombatSnapshot(selfSnapshot);
        if (selfSnapshot.boardSubmitted) {
          setIsConfirmed((prev) => (prev ? prev : true));
        }
        const trimmedSelfName = selfSnapshot.name?.trim();
        if (trimmedSelfName && trimmedSelfName !== playerSelfName) {
          setPlayerSelfName(trimmedSelfName);
        }
      }
      if (enemySnapshot) {
        setOpponentCombatSnapshot(enemySnapshot);
        const trimmedEnemyName = enemySnapshot.name?.trim();
        if (trimmedEnemyName) {
          setOpponentDisplayName((prev) => (prev === trimmedEnemyName ? prev : trimmedEnemyName));
        }
      }

      if (selfSnapshot && enemySnapshot) {
        setHasBothBoardsSubmitted(Boolean(selfSnapshot.boardSubmitted && enemySnapshot.boardSubmitted));
      }

      const getIndexForUuid = (uuid: string | null | undefined): number | null => {
        if (!uuid) {
          return null;
        }
        if (playerOneSnapshot?.uuid && playerOneSnapshot.uuid === uuid) {
          return 1;
        }
        if (playerTwoSnapshot?.uuid && playerTwoSnapshot.uuid === uuid) {
          return 2;
        }
        return null;
      };

      const resolvedSelfIndex =
        playerIndex ??
        getIndexForUuid(selfSnapshot?.uuid ?? selfUserId ?? null) ??
        getIndexForUuid(selfUserId ?? null);
      const resolvedOpponentIndex =
        resolvedSelfIndex != null
          ? resolvedSelfIndex === 1
            ? 2
            : resolvedSelfIndex === 2
            ? 1
            : null
          : getIndexForUuid(enemySnapshot?.uuid ?? opponentUuid ?? null);

      const isSelfTurnNow =
        candidateTurn !== undefined &&
        resolvedSelfIndex != null &&
        ((typeof candidateTurn === 'string' &&
          ((nextPlayerOneUuid && candidateTurn === nextPlayerOneUuid) ||
            (nextPlayerTwoUuid && candidateTurn === nextPlayerTwoUuid))) ||
          candidateTurn === resolvedSelfIndex);
      setIsCurrentTurnSelf(Boolean(isSelfTurnNow));

      const eventsArray = Array.isArray(payload.events) ? payload.events : [];
      if (eventsArray.length && resolvedSelfIndex != null) {
        const toCell = (event: any): AttackCell | null => {
          if (event?.type !== 'attack') {
            return null;
          }
          if (event?.x == null || event?.y == null) {
            return null;
          }
          const col = Number(event.x);
          const row = Number(event.y);
          if (!Number.isFinite(col) || !Number.isFinite(row)) {
            return null;
          }
          const sunk = event.result === 'hit' && (event.sunk === true || event.hitCode);
          return sunk ? { row, col, sunk: true } : { row, col };
        };

        const mergeCells = (base: AttackCell[], additions: AttackCell[]): AttackCell[] => {
          const next = [...base];
          additions.forEach((cell) => {
            if (!next.some((existing) => existing.row === cell.row && existing.col === cell.col)) {
              next.push(cell);
            }
          });
          return next;
        };

        setSelfAttackHistory((prev) => {
          const newHits: AttackCell[] = [];
          const newMisses: AttackCell[] = [];
          eventsArray.forEach((event: any) => {
            if (event?.player !== resolvedSelfIndex) {
              return;
            }
            const cell = toCell(event);
            if (!cell) {
              return;
            }
            if (event?.result === 'hit') {
              newHits.push(cell);
            } else if (event?.result === 'miss') {
              newMisses.push(cell);
            }
          });
          if (!newHits.length && !newMisses.length) {
            return prev;
          }
          return {
            hits: mergeCells(prev.hits, newHits),
            misses: mergeCells(prev.misses, newMisses),
          };
        });

        if (resolvedOpponentIndex != null) {
          setOpponentAttackHistory((prev) => {
            const newHits: AttackCell[] = [];
            const newMisses: AttackCell[] = [];
            eventsArray.forEach((event: any) => {
              if (event?.player !== resolvedOpponentIndex) {
                return;
              }
              const cell = toCell(event);
              if (!cell) {
                return;
              }
              if (event?.result === 'hit') {
                newHits.push(cell);
              } else if (event?.result === 'miss') {
                newMisses.push(cell);
              }
            });
            if (!newHits.length && !newMisses.length) {
              return prev;
            }
            return {
              hits: mergeCells(prev.hits, newHits),
              misses: mergeCells(prev.misses, newMisses),
            };
          });
        }
      }

      const opponentLabel = enemySnapshot?.name?.trim() || opponentDisplayName || nextPlayerTwoLabel;

      const sanitizePlayerReferences = (text: string | null): string | null => {
        if (!text) {
          return text;
        }
        let hideForSelf = false;
        let output = text.replace(/player\s*(\d+)/gi, (match, group) => {
          const idx = Number(group);
          if (!Number.isFinite(idx)) {
            return match;
          }
          if (resolvedSelfIndex != null && idx === resolvedSelfIndex) {
            hideForSelf = true;
            return '';
          }
          if (resolvedOpponentIndex != null && idx === resolvedOpponentIndex) {
            return opponentLabel;
          }
          if (idx === 1) {
            return nextPlayerOneLabel;
          }
          if (idx === 2) {
            return nextPlayerTwoLabel;
          }
          return match;
        });
        if (hideForSelf) {
          return null;
        }
        output = output.replace(/\bopponent\b/gi, opponentLabel);
        if (/^waiting\s+(?!for\b)/i.test(output)) {
          output = output.replace(/^waiting\s+/i, 'Waiting for ');
        }
        output = output.replace(/\s+/g, ' ').trim();
        return output || null;
      };

      let sanitizedStatus = sanitizePlayerReferences(statusValue);
      let sanitizedMessage = sanitizePlayerReferences(message);

      if (!gameEnded && payload.type === 'game_status') {
        const awaitingSelfBoard = Boolean(selfSnapshot) && selfSnapshot?.boardSubmitted === false;
        const awaitingOpponentBoard =
          Boolean(enemySnapshot) && enemySnapshot?.boardSubmitted === false;

        if (awaitingSelfBoard && !awaitingOpponentBoard) {
          sanitizedMessage = null;
          sanitizedStatus = null;
        } else if (!awaitingSelfBoard && awaitingOpponentBoard) {
          sanitizedMessage = `Waiting for ${opponentLabel} to submit board`;
          sanitizedStatus = sanitizedMessage;
        } else if (
          candidateTurn !== undefined &&
          resolvedSelfIndex != null &&
          resolvedOpponentIndex != null
        ) {
          if (candidateTurn === resolvedSelfIndex) {
            sanitizedMessage = null;
          } else if (candidateTurn === resolvedOpponentIndex) {
            sanitizedMessage = `Waiting for ${opponentLabel} to move`;
          }
        }
      }

      if (gameEnded && !sanitizedMessage) {
        if (winnerLabel && loserLabel) {
          sanitizedMessage = `${winnerLabel} defeated ${loserLabel}`;
        } else if (winnerLabel) {
          sanitizedMessage = `${winnerLabel} won the game`;
        } else if (loserLabel) {
          sanitizedMessage = `${loserLabel} has been eliminated`;
        } else {
          sanitizedMessage = 'Game ended';
        }
      }

      setCurrentTurnLabel(nextCurrentTurnLabel);
      setStatusMessage(sanitizedMessage);
      setGameResult(gameEnded ? { winner: winnerLabel ?? null, loser: loserLabel ?? null } : null);
      setGamePhaseLabel(sanitizedStatus);
    },
    [
      deriveStatusMessage,
      resolveTurnLabel,
      playerIndex,
      selfUserId,
      opponentDisplayName,
      opponentUuid,
      playerSelfName,
      playerOneLabel,
      playerTwoLabel,
      playerOneUuid,
      playerTwoUuid,
    ]
  );

  useEffect(() => {
    if (!authReady || !displayGameId || displayGameId === 'pending') {
      if (gameReady) {
        setGameReady(false);
      }
      return;
    }
    if (gameReady) {
      return;
    }
    let cancelled = false;

    const maxAttempts = 8;
    const fetchStateWithRetry = async () => {
      for (let attempt = 0; attempt < maxAttempts && !cancelled; attempt += 1) {
        try {
          const state = await gameApi.getState(displayGameId);
          if (cancelled) {
            return;
          }
          applyGameStateUpdate(state);
          setGameReady(true);
          return;
        } catch (error) {
          if (attempt === maxAttempts - 1) {
            console.warn('Failed to fetch game state after multiple attempts', error);
            return;
          }
          const backoff = Math.min(1500, Math.round(200 * Math.pow(1.5, attempt)));
          await new Promise((resolve) => setTimeout(resolve, backoff));
        }
      }
    };

    fetchStateWithRetry();

    return () => {
      cancelled = true;
    };
  }, [authReady, displayGameId, gameReady, applyGameStateUpdate]);

  useEffect(() => {
    if (!displayGameId || displayGameId === 'pending') {
      return;
    }

    const url = `ws://10.0.2.2:3002/ws/status?gameId=${encodeURIComponent(displayGameId)}`;
    const statusSocket = new WebSocket(url);

    statusSocket.onopen = () => {
      console.log('Status socket connected');
    };

    statusSocket.onmessage = ({ data }) => {
      if (typeof data !== 'string') {
        return;
      }
      try {
        const payload = JSON.parse(data);
        console.log('Game status update:', payload);
        applyGameStateUpdate(payload);
      } catch (error) {
        console.error('Failed to parse status payload', error);
      }
    };

    statusSocket.onerror = (err) => {
      console.error('Status socket error', err);
    };

    statusSocket.onclose = () => {
      console.log('Status socket closed');
    };

    return () => {
      if (statusSocket.readyState === WebSocket.OPEN || statusSocket.readyState === WebSocket.CONNECTING) {
        statusSocket.close();
      }
    };
  }, [displayGameId, applyGameStateUpdate]);

  useEffect(() => {
    if (!authReady || !gameReady || !displayGameId || displayGameId === 'pending') {
      return;
    }
    if (!selfToken) {
      console.warn('Cannot connect to game socket: missing auth token');
      return;
    }
    if (!selfUserId) {
      console.warn('Cannot connect to game socket: missing player uuid');
      return;
    }
    let cancelled = false;

    return () => {
      cancelled = true;
    };
  }, [authReady, gameReady, displayGameId, selfToken, selfUserId]);

  // Set up game socket event handlers
  useEffect(() => {
    

    return () => {
      // Handlers will be replaced on subsequent renders; socket lifecycle handled elsewhere.
    };
  }, [applyGameStateUpdate]);

  const selfHits = useMemo(() => selfAttackHistory.hits, [selfAttackHistory.hits]);
  const selfMisses = useMemo(() => selfAttackHistory.misses, [selfAttackHistory.misses]);
  const selfDisplayHits = useMemo(() => {
    const combined = [...selfHits];
    manualAttackMarkers.forEach((marker) => {
      if (!combined.some((cell) => cell.row === marker.row && cell.col === marker.col)) {
        combined.push(marker);
      }
    });
    return combined;
  }, [selfHits, manualAttackMarkers]);
  const selfSunk = useMemo(() => selfAttackHistory.hits.filter((cell) => cell.sunk), [selfAttackHistory.hits]);
  const opponentHits = useMemo(() => opponentAttackHistory.hits, [opponentAttackHistory.hits]);
  const opponentMisses = useMemo(() => opponentAttackHistory.misses, [opponentAttackHistory.misses]);
  const opponentSunk = useMemo(() => opponentAttackHistory.hits.filter((cell) => cell.sunk), [opponentAttackHistory.hits]);

  const isMyTurn = useMemo(() => {
    if (gameResult) {
      return false;
    }
    return isCurrentTurnSelf;
  }, [isCurrentTurnSelf, gameResult]);

  const canFire = useMemo(() => {
    if (!isConfirmed) {
      return false;
    }
    if (!hasBothBoardsSubmitted) {
      return false;
    }
    if (!isCurrentTurnSelf) {
      return false;
    }
    if (isSubmittingAttack || pendingAttack) {
      return false;
    }
    return true;
  }, [
    isConfirmed,
    hasBothBoardsSubmitted,
    isCurrentTurnSelf,
    isSubmittingAttack,
    pendingAttack,
  ]);

  const handleFireAt = useCallback(
    async (row: number, col: number) => {
      if (!canFire) {
        return;
      }
      if (!displayGameId || displayGameId === 'pending') {
        return;
      }
      const alreadyAttacked =
        selfHits.some((cell) => cell.row === row && cell.col === col) ||
        selfMisses.some((cell) => cell.row === row && cell.col === col);
      if (alreadyAttacked) {
        setAttackFeedback('Ai atacat deja acea celulă.');
        return;
      }
      const x = col;
      const y = row;
      try {
        setIsSubmittingAttack(true);
        setPendingAttack({ row, col });
        setAttackFeedback(null);
        const response = await gameApi.fireAttack({ gameId: displayGameId, x, y });
        const sunkFlag =
          response?.result === 'hit' && (response?.sunk === true || Boolean(response?.hitCode));
        const firedCell: AttackCell = sunkFlag ? { row, col, sunk: true } : { row, col };
        if (response?.message) {
          setAttackFeedback(response.message);
        } else if (response?.result === 'hit') {
          setAttackFeedback('Lovit!');
        } else if (response?.result === 'miss') {
          setAttackFeedback('Ratare.');
        }
        if (response?.result === 'hit') {
          setSelfAttackHistory((prev) => {
            if (prev.hits.some((cell) => cell.row === row && cell.col === col)) {
              return prev;
            }
            return {
              hits: [...prev.hits, firedCell],
              misses: prev.misses,
            };
          });
        } else if (response?.result === 'miss') {
          setSelfAttackHistory((prev) => {
            if (prev.misses.some((cell) => cell.row === row && cell.col === col)) {
              return prev;
            }
            return {
              hits: prev.hits,
              misses: [...prev.misses, firedCell],
            };
          });
        }
        if (response?.nextTurn !== undefined) {
          const newLabel = resolveTurnLabel(response.nextTurn);
          setCurrentTurnLabel(newLabel ?? null);
          if (playerIndex != null) {
            const nextIndex = typeof response.nextTurn === 'number' ? response.nextTurn : Number(response.nextTurn);
            if (!Number.isNaN(nextIndex)) {
              setIsCurrentTurnSelf(nextIndex === playerIndex);
            }
          }
          if (typeof response.nextTurn === 'string') {
            if (selfUserId && response.nextTurn === selfUserId) {
              setIsCurrentTurnSelf(true);
            } else if (playerOneUuid && response.nextTurn === playerOneUuid) {
              setIsCurrentTurnSelf(playerIndex === 1);
            } else if (playerTwoUuid && response.nextTurn === playerTwoUuid) {
              setIsCurrentTurnSelf(playerIndex === 2);
            } else {
              setIsCurrentTurnSelf(false);
            }
          }
        }
      } catch (error: any) {
        const message =
          error?.message ||
          (typeof error === 'string' ? error : null) ||
          'Could not fire attack.';
        setAttackFeedback(message);
      } finally {
        setIsSubmittingAttack(false);
      }
    }, [
      canFire,
      displayGameId,
      resolveTurnLabel,
      playerIndex,
      selfUserId,
      playerOneUuid,
      playerTwoUuid,
      selfHits,
      selfMisses,
    ]
  );

  useEffect(() => {
    if (!attackFeedback) {
      return;
    }
    const timeout = setTimeout(() => {
      setAttackFeedback(null);
    }, 2500);
    return () => clearTimeout(timeout);
  }, [attackFeedback]);

  useEffect(() => {
    if (!manualAttackMarkers.length) {
      return;
    }
    setManualAttackMarkers((prev) =>
      prev.filter(
        (cell) =>
          !selfHits.some((hit) => hit.row === cell.row && hit.col === cell.col) &&
          !selfMisses.some((miss) => miss.row === cell.row && miss.col === cell.col)
      )
    );
  }, [manualAttackMarkers, selfHits, selfMisses]);

  function startDrag(shape: Shape, pageX: number, pageY: number) {
    if (isConfirmed) return;
    setDraggingShape(shape);
    setIsDragging(true);
    setDragSource('palette');
    dragOffset.current = { x: pageX, y: pageY };
    dragPosition.setValue({ x: pageX, y: pageY });
    lastDragCoords.current = { x: pageX, y: pageY };
  }

  function moveDrag(pageX: number, pageY: number) {
    if (isConfirmed) return;
    if (pageX == null || pageY == null || Number.isNaN(pageX) || Number.isNaN(pageY)) {
      if (draggingShape) {
        if (dragSource === 'grid') {
          setPlacedShapesLeft((prev) => prev.filter((ps) => ps.id !== draggingShape.id));
          setUsedShapeIds((prev) => { const next = new Set(prev); next.delete(draggingShape.id); return next; });
        }
      }
      setIsDragging(false);
      setDraggingShape(null);
      setHoverPreview(null);
      setDragSource(null);
      liftedPrevCellsRef.current = null;
      setLiftingId(null);
      dragPosition.setValue({ x: 0, y: 0 });
      dragOffset.current = { x: 0, y: 0 };
      lastDragCoords.current = null;
      return;
    }

    dragPosition.setValue({ x: pageX, y: pageY });
    lastDragCoords.current = { x: pageX, y: pageY };
    if (draggingShape && leftGridMetrics) {
      const { pageX: gx, pageY: gy, cellSize, gridSize } = leftGridMetrics;
      const withinX = pageX >= gx && pageX <= gx + gridSize;
      const withinY = pageY >= gy && pageY <= gy + gridSize;
      if (withinX && withinY) {
        const col0 = Math.floor((pageX - gx) / cellSize);
        const row0 = Math.floor((pageY - gy) / cellSize);
        const cells = draggingShape.cells.map((c) => ({ row: row0 + c.y, col: col0 + c.x }));
        const inBounds = cells.every((c) => c.row >= 0 && c.row < 10 && c.col >= 0 && c.col < 10);
        const overlaps = cells.some((c) => placedShapesLeft.some((ps) => ps.cells.some((p) => p.row === c.row && p.col === c.col)));
        const valid = inBounds && !overlaps;
        setHoverPreview({ cells, valid });
      } else {
        setHoverPreview(null);
      }
    } else {
      setHoverPreview(null);
    }
  }

  function endDrag() {
    if (isConfirmed) {
      setIsDragging(false);
      setDraggingShape(null);
      dragPosition.setValue({ x: 0, y: 0 });
      dragOffset.current = { x: 0, y: 0 };
      setHoverPreview(null);
      setDragSource(null);
      liftedPrevCellsRef.current = null;
      setLiftingId(null);
      lastDragCoords.current = null;
      return;
    }
    let handled = false;
    if (hoverPreview && hoverPreview.valid && draggingShape) {
      if (dragSource === 'palette') {
        setPlacedShapesLeft((prev) => [...prev, { id: draggingShape.id, cells: hoverPreview.cells }]);
        setUsedShapeIds((prev) => new Set(prev).add(draggingShape.id));
      } else if (dragSource === 'grid') {
        const prevId = liftedPrevCellsRef.current?.id;
        if (prevId) {
          setPlacedShapesLeft((prev) => prev.map(ps => (ps.id === prevId ? { ...ps, cells: hoverPreview.cells } : ps)));
        }
      }
      handled = true;
    }
    if (!handled && paletteMetrics && draggingShape) {
      const x = lastDragCoords.current?.x;
      const y = lastDragCoords.current?.y;
      const withinPalette = typeof x === 'number' && typeof y === 'number' && x >= paletteMetrics.pageX && x <= paletteMetrics.pageX + paletteMetrics.width && y >= paletteMetrics.pageY && y <= paletteMetrics.pageY + paletteMetrics.height;
      if (withinPalette) {
        if (dragSource === 'grid') {
          setPlacedShapesLeft((prev) => prev.filter(ps => ps.id !== draggingShape.id));
          setUsedShapeIds((prev) => { const next = new Set(prev); next.delete(draggingShape.id); return next; });
        }
        handled = true;
      }
    }
    setIsDragging(false);
    setDraggingShape(null);
    dragPosition.setValue({ x: 0, y: 0 });
    dragOffset.current = { x: 0, y: 0 };
    setHoverPreview(null);
    setDragSource(null);
    liftedPrevCellsRef.current = null;
    setLiftingId(null);
    lastDragCoords.current = null;
  }

  const centered = isConfirmed;

  function buildBoardMatrix() {
    const board: (string | null)[][] = Array.from({ length: 10 }, () => Array(10).fill(null));
    placedShapesLeft.forEach((shape) => {
      const definition = shapesById[shape.id];
      const label = definition?.name ?? shape.id;
      shape.cells.forEach(({ row, col }) => {
        if (row >= 0 && row < 10 && col >= 0 && col < 10) {
          board[row][col] = label;
        }
      });
    });
    return board;
  }

  const handleConfirmBoard = async () => {
    if (isConfirmed || isSubmittingBoard) return;
    if (placedShapesLeft.length === 0) {
      Alert.alert('Board Incomplete', 'Place your ships before confirming.');
      return;
    }
    if (!displayGameId || displayGameId === 'pending') {
      Alert.alert('Game Not Ready', 'Game session is not ready yet.');
      return;
    }
    try {
      setIsSubmittingBoard(true);
      const token = await tokenStorage.getToken();
      if (!token) {
        throw new Error('Missing authentication token.');
      }
      const board = buildBoardMatrix();
      const response = await gameApi.submitBoard({ gameId: displayGameId, board, token });
      applyGameStateUpdate(response);
      setIsConfirmed(true);
    } catch (error: any) {
      const message =
        error?.message ||
        (typeof error === 'string' ? error : null) ||
        'Could not submit board.';
      Alert.alert('Submit Failed', message);
    } finally {
      setIsSubmittingBoard(false);
    }
  };

  useEffect(() => {
    if (!pendingAttack) {
      return;
    }
    const alreadyRecorded =
      selfHits.some((cell) => cell.row === pendingAttack.row && cell.col === pendingAttack.col) ||
      selfMisses.some((cell) => cell.row === pendingAttack.row && cell.col === pendingAttack.col);
    if (alreadyRecorded || !isMyTurn) {
      setPendingAttack(null);
    }
  }, [pendingAttack, selfHits, selfMisses, isMyTurn]);

  // Show loading while introspecting
  if (isIntrospecting) {
    return (
      <View style={[styles.root, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#4F8EF7" />
        <Text style={styles.loadingText}>Verifying session...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, centered && styles.centeredRoot]}>
      <TouchableOpacity style={styles.surrenderBtn} onPress={() => router.replace('/(tabs)/profile')}>
        <Text style={styles.surrenderText}>Surrender</Text>
      </TouchableOpacity>
      {displayGameId ? (
        <View style={styles.gameIdBadge}>
          <Text style={styles.gameIdValue} numberOfLines={1} ellipsizeMode="tail">
            <Text style={styles.gameIdLabel}>Game ID: </Text>
            {displayGameId === 'pending' ? 'in queue' : displayGameId}
          </Text>
        </View>
      ) : null}
      {currentTurnLabel || (gameResult && (gameResult.winner || gameResult.loser)) ? (
        <View pointerEvents="none" style={styles.turnOverlay}>
          {currentTurnLabel ? (
            <View style={styles.turnBanner}>
              <Text style={styles.turnHeading}>Turn</Text>
              <Text style={styles.turnValue}>{currentTurnLabel}</Text>
            </View>
          ) : null}
          {gameResult && (gameResult.winner || gameResult.loser) ? (
            <View style={styles.resultBanner}>
              {gameResult.winner ? (
                <Text style={styles.resultWinner}>{`Winner: ${gameResult.winner}`}</Text>
              ) : null}
              {gameResult.loser ? (
                <Text style={styles.resultLoser}>{`Eliminated: ${gameResult.loser}`}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
      {attackFeedback ? (
        <View style={styles.attackToast} pointerEvents="none">
          <Text style={styles.attackToastText}>{attackFeedback}</Text>
        </View>
      ) : null}
      {!isConfirmed ? (
        <View
          style={[styles.palette, !centered && contentShiftStyle]}
          ref={paletteRef}
          onLayout={() => {
            const node = findNodeHandle(paletteRef.current);
            if (!node) return;
            UIManager.measureInWindow(node, (px: number, py: number, w: number, h: number) => {
              setPaletteMetrics({ pageX: px, pageY: py, width: w, height: h });
            });
          }}
        >
          <Text style={styles.paletteTitle}>Ships</Text>
          <View style={styles.paletteList}>
            {shapes.filter(s => !usedShapeIds.has(s.id)).map((shape) => {
              const { width, height } = getShapeBounds(shape.cells);
              return (
                <View key={shape.id} style={styles.paletteItemWrapper}>
                  <View
                    style={[styles.shapeContainer, { width: width * 18, height: height * 18 }]}
                    onStartShouldSetResponder={() => true}
                    onResponderGrant={(e) => startDrag(shape, e.nativeEvent.pageX, e.nativeEvent.pageY)}
                    onResponderMove={(e) => moveDrag(e.nativeEvent.pageX, e.nativeEvent.pageY)}
                    onResponderRelease={endDrag}
                    onResponderTerminate={endDrag}
                  >
                    {shape.cells.map((c, idx) => (
                      <View
                        key={`${shape.id}-cell-${idx}`}
                        style={[styles.shapeCell, { left: c.x * 18, top: c.y * 18, width: 18, height: 18 }]}
                      />
                    ))}
                  </View>
                  <Text style={styles.shipLabel}>{shape.name}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={[styles.gridsContainer, centered && styles.centeredGrids, !centered && contentShiftStyle]}>
        <View style={[styles.gridsRow, centered && styles.centeredRow]}>
          <Grid
            label={playerSelfName || 'Player 1'}
            scale={0.8}
            onMetrics={setLeftGridMetrics}
            preview={hoverPreview}
            placed={placedShapesLeft}
            shots={
              opponentCombatSnapshot
                ? { hits: opponentHits, misses: opponentMisses, sunk: opponentSunk }
                : undefined
            }
            liftingId={liftingId}
            onPlacedDragStart={(id, x, y) => {
              if (isConfirmed) return;
              const ps = placedShapesLeft.find((p) => p.id === id);
              if (!ps) return;
              const shape = shapes.find((s) => s.id === id);
              if (!shape) return;
              liftedPrevCellsRef.current = { id, cells: ps.cells };
              setLiftingId(id);
              setDraggingShape(shape);
              setIsDragging(true);
              setDragSource('grid');
              dragPosition.setValue({ x, y });
            }}
            onPlacedDragMove={(x, y) => !isConfirmed && moveDrag(x, y)}
            onPlacedDragEnd={() => !isConfirmed && endDrag()}
          />
          <Grid
            label={opponentDisplayName || 'Opponent'}
            scale={0.8}
            shots={
              selfCombatSnapshot
                ? { hits: selfDisplayHits, misses: selfMisses, sunk: selfSunk }
                : { hits: selfDisplayHits, misses: selfMisses }
            }
            onCellPress={(row, col) => {
              if (canFire) {
                handleFireAt(row, col);
              }
              setManualAttackMarkers((prev) => {
                if (prev.some((cell) => cell.row === row && cell.col === col)) {
                  return prev;
                }
                return [...prev, { row, col }];
              });
            }}
            pendingAttack={pendingAttack}
          />
        </View>
      </View>

      {isDragging && draggingShape != null ? (
        <Animated.View
          style={[
            styles.dragPreview,
            (() => {
              const { width, height } = getShapeBounds(draggingShape.cells);
              const unit = leftGridMetrics?.cellSize ?? 18;
              return {
                width: width * unit,
                height: height * unit,
                transform: [{ translateX: dragPosition.x }, { translateY: dragPosition.y }],
              };
            })(),
          ]}
        >
          {(() => {
            const unit = leftGridMetrics?.cellSize ?? 18;
            return draggingShape.cells.map((c, idx) => (
              <View
                key={`drag-${draggingShape.id}-cell-${idx}`}
                style={[styles.shapeCell, { left: c.x * unit, top: c.y * unit, width: unit, height: unit }]}
              />
            ));
          })()}
        </Animated.View>
      ) : null}

      {!isConfirmed && (usedShapeIds.size === shapes.length) ? (
        <View style={styles.footerBar}>
          <TouchableOpacity onPress={handleConfirmBoard} style={[styles.confirmButton, isSubmittingBoard && styles.confirmButtonDisabled]} disabled={isSubmittingBoard}>
            {isSubmittingBoard ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.confirmButtonText}>Confirm Ships</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    position: 'relative',
  },
  centeredRoot: {
    justifyContent: 'center',
  },
  turnOverlay: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 8,
    zIndex: 15,
  },
  turnBanner: {
    backgroundColor: 'rgba(52, 152, 219, 0.85)',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 8,
    alignItems: 'center',
  },
  turnHeading: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ecf0f1',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  turnValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  resultBanner: {
    backgroundColor: 'rgba(241, 196, 15, 0.85)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: 'center',
    gap: 2,
  },
  resultWinner: {
    color: '#2c3e50',
    fontWeight: '700',
    fontSize: 13,
  },
  resultLoser: {
    color: '#2c3e50',
    fontSize: 12,
  },
  palette: {
    width: 110,
    height: '100%',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fafafa',
    gap: 12,
  },
  paletteTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  paletteList: {
    gap: 10,
  },
  paletteItemWrapper: {
    alignItems: 'center',
    gap: 4,
  },
  shapeContainer: {
    position: 'relative',
  },
  shapeCell: {
    position: 'absolute',
    backgroundColor: '#4F8EF7',
    borderRadius: 3,
  },
  shipLabel: {
    fontSize: 12,
    color: '#333',
  },
  gridsContainer: {
    flex: 1,
    alignSelf: 'stretch',
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 16,
  },
  centeredGrids: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: 20,
  },
  centeredRow: {
    justifyContent: 'center',
    gap: 40,
  },
  gridContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  gridLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  grid: {
    borderWidth: 2,
    borderColor: '#888',
    backgroundColor: '#f7f7f7',
  },
  previewCell: {
    position: 'absolute',
    borderWidth: 1,
  },
  shotMarker: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 4,
  },
  hitMarker: {
    backgroundColor: 'rgba(231, 76, 60, 0.6)',
    borderColor: '#c0392b',
  },
  missMarker: {
    backgroundColor: 'rgba(189, 195, 199, 0.45)',
    borderColor: '#95a5a6',
  },
  sunkMarker: {
    backgroundColor: 'rgba(155, 89, 182, 0.7)',
    borderColor: '#8e44ad',
  },
  pendingMarker: {
    flex: 1,
    backgroundColor: 'rgba(52, 152, 219, 0.45)',
  },
  attackToast: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    zIndex: 30,
  },
  attackToastText: {
    color: '#fff',
    fontWeight: '700',
  },
  placedCell: {
    position: 'absolute',
    backgroundColor: 'rgba(79, 142, 247, 0.6)',
    borderColor: '#1f5fd1',
    borderWidth: 1,
  },
  placedBox: {
    position: 'absolute',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#bbb',
    backgroundColor: '#fff',
  },
  dragPreview: {
    position: 'absolute',
    left: 0,
    top: 0,
    backgroundColor: '#4F8EF7',
    opacity: 0.8,
    borderRadius: 3,
  },
  footerBar: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButton: {
    backgroundColor: '#2ecc71',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: '700',
  },
  surrenderBtn: {
    position: 'absolute',
    top: 10,
    right: 12,
    backgroundColor: '#e74c3c',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 10,
  },
  surrenderText: {
    color: 'white',
    fontWeight: '700',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  gameIdBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    maxWidth: '60%',
    alignItems: 'flex-end',
  },
  gameIdLabel: {
    color: '#fff',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  gameIdValue: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
});


