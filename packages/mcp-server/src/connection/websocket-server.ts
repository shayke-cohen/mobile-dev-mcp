/**
 * WebSocket Server for mobile app connections
 */

import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';

export interface WebSocketServerOptions {
  port: number;
}

export class WebSocketServer extends EventEmitter {
  private wss: WSServer;

  constructor(options: WebSocketServerOptions) {
    super();

    this.wss = new WSServer({ port: options.port });

    this.wss.on('connection', (ws, req) => {
      console.error(`[WebSocket] New connection from ${req.socket.remoteAddress}`);
      this.emit('connection', ws, req);
    });

    this.wss.on('error', (error) => {
      console.error('[WebSocket] Server error:', error);
      this.emit('error', error);
    });

    this.wss.on('listening', () => {
      console.error(`[WebSocket] Server listening on port ${options.port}`);
    });
  }

  broadcast(message: string): void {
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  close(): void {
    this.wss.close();
  }

  get clients(): Set<WebSocket> {
    return this.wss.clients;
  }
}
