import { useEffect, useState } from "react";
import { socket } from "../net/socket";

type RoomState = {
  code: string;
  status: "lobby" | "playing" | string;
  players: { name: string; ready: boolean }[];
  match: null | { schemaVersion: number; turn: number; active: number; seed: number };
};

export default function Lobby() {
  const [name, setName] = useState("Player");
  const [joinCode, setJoinCode] = useState("");
  const [state, setState] = useState<RoomState | null>(null);
  const [ready, setReady] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const onRoomState = (s: RoomState) => setState(s);
    const onMatchStart = (s: RoomState) => setState(s);
    const onMatchSync = (s: RoomState) => setState(s);

    const onConnect = () => setLog((l) => [`connected: ${socket.id}`, ...l]);
    const onDisconnect = () => setLog((l) => [`disconnected`, ...l]);
    const onConnectError = (e: any) => setLog((l) => [`connect_error: ${e?.message ?? "unknown"}`, ...l]);

    socket.on("room:state", onRoomState);
    socket.on("match:start", onMatchStart);
    socket.on("match:sync", onMatchSync);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    return () => {
      socket.off("room:state", onRoomState);
      socket.off("match:start", onMatchStart);
      socket.off("match:sync", onMatchSync);

      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
    };
  }, []);

  const createRoom = () => {
    socket.emit("room:create", { name }, (res: any) => {
      if (!res?.ok) return setLog((l) => [`create failed`, ...l]);
      setState(res.state);
      setReady(false);
      setJoinCode(res.code);
      setLog((l) => [`created room ${res.code}`, ...l]);
    });
  };

  const joinRoom = () => {
    const code = joinCode.trim().toUpperCase();
    socket.emit("room:join", { code, name }, (res: any) => {
      if (!res?.ok) return setLog((l) => [`join failed: ${res.reason}`, ...l]);
      setState(res.state);
      setReady(false);
      setLog((l) => [`joined room ${code}`, ...l]);
    });
  };

  const toggleReady = () => {
    if (!state?.code) return;
    const next = !ready;
    setReady(next);

    socket.emit("room:ready", { code: state.code, ready: next }, (res: any) => {
      if (!res?.ok) setLog((l) => [`ready failed: ${res.reason}`, ...l]);
    });
  };

  const endTurn = () => {
    if (!state?.code) return;
    socket.emit("match:endTurn", { code: state.code }, (res: any) => {
      if (!res?.ok) setLog((l) => [`endTurn failed: ${res.reason}`, ...l]);
    });
  };

  const resetUI = () => {
    setState(null);
    setReady(false);
    setJoinCode("");
    setLog((l) => [`reset local ui`, ...l]);
  };

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", fontFamily: "system-ui" }}>
      <h2>Re Cards — Lobby</h2>

      {!state ? (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            <button onClick={createRoom}>Create room</button>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Code (e.g. ABC12)" />
            <button onClick={joinRoom}>Join</button>
          </div>
        </>
      ) : (
        <div style={{ marginTop: 20, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
          <div>
            <b>Room:</b> {state.code}
          </div>
          <div>
            <b>Status:</b> {state.status}
          </div>

          <div style={{ marginTop: 10 }}>
            <b>Players</b>
            <ul>
              {state.players.map((p, i) => (
                <li key={i}>
                  {p.name} — {p.ready ? "✅ ready" : "⏳ not ready"}
                </li>
              ))}
            </ul>
          </div>

          {state.status === "lobby" && <button onClick={toggleReady}>{ready ? "Unready" : "Ready"}</button>}

          {state.status === "playing" && (
            <>
              <div style={{ marginTop: 10 }}>
                <b>Match</b>
                <div>Turn: {state.match?.turn}</div>
                <div>Active player index: {state.match?.active}</div>
              </div>

              <button onClick={endTurn} style={{ marginTop: 10 }}>
                End Turn
              </button>
            </>
          )}

          <button onClick={resetUI} style={{ marginTop: 14 }}>
            Reset UI
          </button>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <b>Log</b>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, background: "#f7f7f7", padding: 10, borderRadius: 10 }}>
          {log.slice(0, 12).join("\n")}
        </pre>
      </div>
    </div>
  );
}
