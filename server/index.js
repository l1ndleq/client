import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

const app = express();
app.use(cors({ origin: true, credentials: true }));

app.get("/", (_, res) => res.send("Re Cards server OK"));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });

// Супер-простой матч: комнаты по коду, синхронизация сообщений.
// Сейчас это “каркас онлайна”; гейм-логику добавим следом.
const rooms = new Map(); // code -> { players: [socketId...], state: {} }

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

io.on("connection", (socket) => {
  socket.on("create_room", () => {
    let code = makeCode();
    while (rooms.has(code)) code = makeCode();

    rooms.set(code, { players: [socket.id], state: { log: ["Room created"] } });
    socket.join(code);
    socket.emit("room_created", { code, seat: 0 });
    socket.emit("state", rooms.get(code).state);
  });

  socket.on("join_room", ({ code }) => {
    const room = rooms.get(code);
    if (!room) return socket.emit("error_msg", { message: "Room not found" });
    if (room.players.length >= 2) return socket.emit("error_msg", { message: "Room is full" });

    room.players.push(socket.id);
    socket.join(code);
    socket.emit("room_joined", { code, seat: 1 });
    io.to(code).emit("state", room.state);
  });

  socket.on("action", ({ code, payload }) => {
    const room = rooms.get(code);
    if (!room) return;

    // Пока просто логируем действия, потом сюда вставим game-engine.
    room.state.log = [...(room.state.log ?? []), JSON.stringify(payload)];
    io.to(code).emit("state", room.state);
  });

  socket.on("disconnect", () => {
    // Для MVP можно не усложнять cleanup.
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log("Server listening on", PORT));
