import { io, type Socket } from "socket.io-client";

/**
 * When unset (local dev), Socket.IO uses the current page origin and Vite proxies `/socket.io` to the API.
 * For internet play, set `VITE_SERVER_URL` to your public API origin, e.g. `https://api.yourdomain.com`
 * (no trailing slash).
 */
export function createSocket(): Socket {
  const serverUrl = import.meta.env.VITE_SERVER_URL?.trim() || undefined;

  return io(serverUrl, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    autoConnect: true,
  });
}
