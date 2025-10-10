"use client";
import React, {
  Component,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import PropertyCard from "./cards/property-card";
import SpecialCard from "./cards/special-card";
import CornerCard from "./cards/corner-card";
import {
  Game,
  GameProperty,
  Property,
  Player,
  PROPERTY_ACTION,
  CardTypes,
} from "@/types/game";
import { useAccount } from "wagmi";
import { getPlayerSymbol } from "@/lib/types/symbol";
import { apiClient } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ApiResponse } from "@/types/api";

/* ---------- Types ---------- */
interface GameProps {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  my_properties: Property[];
  me: Player | null;
  loading?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/* ---------- ErrorBoundary ---------- */
class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="text-red-400 text-center">
          Something went wrong. Please refresh the page.
        </div>
      );
    }
    return this.props.children;
  }
}

/* ---------- Constants ---------- */
const BOARD_SQUARES = 40;
const ROLL_ANIMATION_MS = 1200;

/* ---------- Dice helper ---------- */
const getDiceValues = (): { die1: number; die2: number; total: number } | null => {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  const total = die1 + die2;
  if (total === 12) return null; // e.g. rolling double six → roll again
  return { die1, die2, total };
};

/* ---------- Component ---------- */
const GameBoard = ({
  game,
  properties,
  my_properties,
  me,
  loading = false,
}: GameProps) => {
  const { address } = useAccount();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // local state initialised from props and kept in sync with effects below
  const [players, setPlayers] = useState<Player[]>(game?.players ?? []);
  const [boardData, setBoardData] = useState<Property[]>(properties ?? []);
  const [error, setError] = useState<string | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [rollAgain, setRollAgain] = useState(false);
  const [rollAction, setRollAction] = useState<CardTypes | null>(null);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [roll, setRoll] = useState<{ die1: number; die2: number; total: number } | null>(null);
  const [canRoll, setCanRoll] = useState<boolean>(false);

  /* ---------- Action Lock ---------- */
  const [actionLock, setActionLock] = useState<"ROLL" | "END" | null>(null);
  const lockAction = useCallback(
    (type: "ROLL" | "END") => {
      if (actionLock) return false;
      setActionLock(type);
      return true;
    },
    [actionLock]
  );
  const unlockAction = useCallback(() => setActionLock(null), []);

  /* ---------- Utilities ---------- */
  const forceRefetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["game", game.code] });
  }, [queryClient, game.code]);

  const safeSetPlayers = useCallback(
    (updater: (prev: Player[]) => Player[]) => {
      if (!isMountedRef.current) return;
      setPlayers((prev) => updater(prev));
    },
    []
  );

  // Return the game DTO (resp.data) not the raw axios response
  const fetchUpdatedGame = useCallback(async () => {
    const resp = await apiClient.get<Game>(`/games/code/${game.code}`);
    return resp.data;
  }, [game.code]);

  /* ---------- Keep local state synced with incoming props ---------- */
  useEffect(() => {
    if (!isMountedRef.current) return;
    setPlayers(game?.players ?? []);
  }, [game?.players]);

  useEffect(() => {
    if (!isMountedRef.current) return;
    setBoardData(properties ?? []);
  }, [properties]);

  /* ---------- CAN_ROLL ---------- */
  const checkCanRoll = useCallback(async () => {
    if (!me?.user_id) return;
    try {
      const res = await apiClient.post<ApiResponse<{ canRoll: boolean }>>("/game-players/can-roll", {
        user_id: me.user_id,
        game_id: game.id,
      });

      // backend might return { canRoll: true } or { data: { canRoll: true } }
      const allowed =
        (res?.data as any)?.canRoll ?? (res?.data as any)?.data?.canRoll ?? false;

      setCanRoll(Boolean(allowed));
      // show a subtle toast only when allowed becomes true
      if (allowed) toast.success("🎲 It's your turn — roll the dice!");
    } catch (err: any) {
      console.error("checkCanRoll error:", err);
      setCanRoll(false);
      // don't spam error toasts while polling — show once
      toast.error("Failed to check roll eligibility");
    }
  }, [me?.user_id, game.id]);

  useEffect(() => {
    // initial check and polling to stay in sync
    checkCanRoll();
    const interval = setInterval(() => checkCanRoll(), 7000);
    return () => clearInterval(interval);
  }, [checkCanRoll]);

  /* ---------- UPDATE_GAME_PLAYER_POSITION ---------- */
  const UPDATE_GAME_PLAYER_POSITION = useCallback(
    async (id: number | undefined | null, position: number, rolled: number) => {
      if (!id) return;
      setError(null);

      // optimistic visual move (kept minimal)
      const prevPlayers = players;
      safeSetPlayers((prev) =>
        prev.map((p) => (p.user_id === id ? { ...p, position } : p))
      );

      try {
        const resp = await apiClient.post<ApiResponse>("/game-players/change-position", {
          position,
          user_id: id,
          game_id: game.id,
          rolled,
        });

        // respect backend rejected responses
        if (!resp?.data?.success) {
          throw new Error(resp?.data?.message || "Server rejected position update.");
        }

        // fetch authoritative game state
        const updatedGame = await fetchUpdatedGame();
        if (updatedGame?.players && isMountedRef.current) {
          setPlayers(updatedGame.players);
          setPropertyId(position);
          setRollAction(PROPERTY_ACTION(position));
        }

        // keep react-query in sync
        queryClient.invalidateQueries({ queryKey: ["game", game.code] });
      } catch (err: any) {
        console.error("UPDATE_GAME_PLAYER_POSITION error:", err);
        if (isMountedRef.current) {
          // rollback to previous players
          setPlayers(prevPlayers);
          const msg = err?.response?.data?.message || err?.message || "Failed to update position.";
          setError(msg);
          toast.error(msg);
          forceRefetch();
        }
      }
    },
    [players, safeSetPlayers, game.id, fetchUpdatedGame, queryClient, game.code, forceRefetch]
  );

  /* ---------- END_TURN ---------- */
  const END_TURN = useCallback(
    async (id?: number) => {
      if (!id) return;
      if (!lockAction("END")) return;

      try {
        const resp = await apiClient.post<ApiResponse>("/game-players/end-turn", {
          user_id: id,
          game_id: game.id,
        });

        if (!resp?.data?.success) {
          throw new Error(resp?.data?.message || "Server rejected turn end.");
        }

        const updatedGame = await fetchUpdatedGame();
        if (updatedGame?.players && isMountedRef.current) {
          setPlayers(updatedGame.players);
          toast.success("✅ Turn ended. Waiting for next player...");
          // After ending the turn, obviously you cannot roll
          setCanRoll(false);
        }
        queryClient.invalidateQueries({ queryKey: ["game", game.code] });
      } catch (err: any) {
        console.error("END_TURN error:", err);
        toast.error(err?.response?.data?.message || err?.message || "Failed to end turn. Resyncing...");
        forceRefetch();
      } finally {
        unlockAction();
      }
    },
    [game.id, fetchUpdatedGame, queryClient, game.code, lockAction, unlockAction, forceRefetch]
  );

  /* ---------- ROLL_DICE ---------- */
  const ROLL_DICE = useCallback(async () => {
    // don't start if already rolling or locked
    if (isRolling || actionLock || !lockAction("ROLL")) return;
    setError(null);
    setRollAgain(false);
    setIsRolling(true);

    try {
      // 1) Ask backend if we can roll
      const res = await apiClient.post<ApiResponse<{ canRoll: boolean }>>("/game-players/can-roll", {
        user_id: me?.user_id,
        game_id: game.id,
      });
      const allowed = (res?.data as any)?.canRoll ?? (res?.data as any)?.data?.canRoll ?? false;

      if (!allowed) {
        toast.error("⏳ Not your turn! Wait for your turn to roll.");
        setIsRolling(false);
        unlockAction();
        // refresh to reflect true state if we were out-of-sync
        forceRefetch();
        return;
      }

      // 2) animate & compute dice
      setTimeout(async () => {
        const value = getDiceValues();
        if (!isMountedRef.current) {
          unlockAction();
          return;
        }

        if (!value) {
          setRollAgain(true);
          setIsRolling(false);
          unlockAction();
          return;
        }

        setRoll(value);

        const currentPos = me?.position ?? 0;
        const newPosition = (currentPos + value.total) % BOARD_SQUARES;

        // UI move optimistic
        safeSetPlayers((prev) =>
          prev.map((p) => (p.user_id === me?.user_id ? { ...p, position: newPosition } : p))
        );

        try {
          // persist move
          const updateResp = await apiClient.post<ApiResponse>("/game-players/change-position", {
            position: newPosition,
            user_id: me?.user_id,
            game_id: game.id,
            rolled: value.total,
          });

          if (!updateResp?.data?.success) {
            throw new Error(updateResp?.data?.message || "Move rejected by server");
          }

          // fetch authoritative state
          const updatedGame = await fetchUpdatedGame();
          if (updatedGame?.players && isMountedRef.current) {
            setPlayers(updatedGame.players);
            setPropertyId(newPosition);
            setRollAction(PROPERTY_ACTION(newPosition));
          }
          // prevent further roll until next turn is set by endTurn
          setCanRoll(false);
        } catch (err: any) {
          console.error("Persist move error:", err);
          toast.error(err?.response?.data?.message || err?.message || "Position update failed, syncing...");
          forceRefetch();
        } finally {
          if (isMountedRef.current) setIsRolling(false);
          unlockAction();
        }
      }, ROLL_ANIMATION_MS);
    } catch (err: any) {
      console.error("ROLL_DICE error:", err);
      toast.error("Failed to verify roll eligibility.");
      setIsRolling(false);
      unlockAction();
      forceRefetch();
    }
  }, [
    isRolling,
    actionLock,
    lockAction,
    unlockAction,
    me?.user_id,
    me?.position,
    safeSetPlayers,
    fetchUpdatedGame,
    forceRefetch,
    game.id,
  ]);

  /* ---------- Helpers ---------- */
  const playersByPosition = useMemo(() => {
    const map = new Map<number, Player[]>();
    players.forEach((p) => {
      const pos = Number(p.position ?? 0);
      if (!map.has(pos)) map.set(pos, []);
      map.get(pos)!.push(p);
    });
    return map;
  }, [players]);

  // is it currently this player's turn (authoritative via `game` prop)
  const isMyTurn = me?.user_id != null && game?.next_player_id === me.user_id;

  /* ---------- Render ---------- */
  return (
    <ErrorBoundary>
      <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 text-white p-4 flex flex-col lg:flex-row gap-4 items-start justify-center relative">
        <div className="flex justify-center items-start w-full lg:w-2/3 max-w-[900px] mt-[-1rem]">
          <div className="w-full bg-[#010F10] aspect-square rounded-lg relative shadow-2xl shadow-cyan-500/10">
            <div className="grid grid-cols-11 grid-rows-11 w-full h-full gap-[2px] box-border">
              <div className="col-start-2 col-span-9 row-start-2 row-span-9 flex flex-col justify-center items-center p-4 relative">
                <h1 className="text-3xl lg:text-5xl font-bold text-[#F0F7F7] font-orbitron text-center mb-4">
                  Blockopoly
                </h1>

                {/* Show controls if it's my turn (so End Turn remains visible after rolling) */}
                {isMyTurn && (
                  <div className="flex flex-col gap-2">
                    {/* Show Roll button when there's no roll result yet */}
                    {!roll ? (
                      <button
                        type="button"
                        onClick={ROLL_DICE}
                        disabled={isRolling || actionLock === "END" || !canRoll}
                        className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm rounded-full hover:scale-105 transition-all disabled:opacity-60"
                      >
                        {isRolling ? "Rolling..." : "Roll Dice"}
                      </button>
                    ) : (
                      // After rolling, show End Turn (so player can finish their move)
                      <button
                        type="button"
                        onClick={() => END_TURN(me?.user_id)}
                        disabled={actionLock === "ROLL"}
                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white text-sm rounded-full hover:scale-105 transition-all disabled:opacity-60"
                      >
                        End Turn
                      </button>
                    )}

                    {rollAgain && (
                      <p className="text-xs text-red-600">
                        You rolled double 6 🎯 — roll again!
                      </p>
                    )}
                    {roll && !rollAgain && (
                      <p className="text-gray-300 text-sm">
                        🎲 Rolled:{" "}
                        <span className="font-bold text-white">
                          {roll.die1} + {roll.die2} = {roll.total}
                        </span>
                      </p>
                    )}
                    {error && (
                      <p className="text-red-400 text-sm text-center mt-1">
                        ⚠️ {error}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Render each board square */}
              {boardData.map((square, index) => {
                const playersHere = playersByPosition.get(index) ?? [];
                return (
                  <div
                    key={square.id}
                    style={{
                      gridRowStart: square.grid_row,
                      gridColumnStart: square.grid_col,
                    }}
                    className="w-full h-full p-[2px] relative box-border group"
                  >
                    {square.type === "property" && (
                      <PropertyCard
                        square={square}
                        owner={
                          my_properties.find((p) => p.id === square.id)
                            ? me?.username ?? null
                            : null
                        }
                      />
                    )}
                    {square.type === "special" && <SpecialCard square={square} />}
                    {square.type === "corner" && <CornerCard square={square} />}
                    <div className="absolute bottom-1 left-1 flex flex-wrap gap-1 z-10">
                      {playersHere.map((p) => (
                        <button
                          key={String(p.user_id)}
                          className={`text-lg md:text-2xl ${p.user_id === game.next_player_id
                              ? "border-2 border-cyan-300 rounded animate-pulse"
                              : ""
                            }`}
                          aria-label={p.username ?? `Player ${p.user_id}`}
                        >
                          {getPlayerSymbol(p.symbol)}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default GameBoard;
