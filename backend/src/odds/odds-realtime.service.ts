import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { createHash } from 'crypto';
import { IncomingMessage } from 'http';
import { Socket } from 'net';

@Injectable()
export class OddsRealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OddsRealtimeService.name);
  private readonly clients = new Set<Socket>();
  private readonly websocketPaths = ['/api/v1/odds/ws', '/api/odds/ws', '/odds/ws'];
  private upgradeHandler?: (
    request: IncomingMessage,
    socket: Socket,
    head: Buffer,
  ) => void;

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  onModuleInit(): void {
    const httpServer = this.httpAdapterHost.httpAdapter?.getHttpServer?.();
    if (!httpServer?.on) {
      return;
    }

    this.upgradeHandler = (request, socket) => {
      if (!this.isOddsWebSocketRequest(request)) {
        return;
      }

      const key = request.headers['sec-websocket-key'];
      if (!key || Array.isArray(key)) {
        socket.destroy();
        return;
      }

      const accept = createHash('sha1')
        .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
        .digest('base64');

      socket.write(
        [
          'HTTP/1.1 101 Switching Protocols',
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Accept: ${accept}`,
          '\r\n',
        ].join('\r\n'),
      );

      socket.on('data', (frame) => this.handleClientFrame(socket, frame));
      socket.on('close', () => this.clients.delete(socket));
      socket.on('end', () => this.clients.delete(socket));
      socket.on('error', () => this.clients.delete(socket));

      this.clients.add(socket);
      this.sendToSocket(socket, {
        type: 'odds.connected',
        connectedAt: new Date().toISOString(),
        websocketPath: this.getWebSocketPath(),
      });
      this.logger.log(
        `Odds websocket client connected (${this.clients.size} active)`,
      );
    };

    httpServer.on('upgrade', this.upgradeHandler);
  }

  onModuleDestroy(): void {
    const httpServer = this.httpAdapterHost.httpAdapter?.getHttpServer?.();
    if (httpServer?.removeListener && this.upgradeHandler) {
      httpServer.removeListener('upgrade', this.upgradeHandler);
    }

    for (const client of this.clients) {
      client.destroy();
    }
    this.clients.clear();
  }

  getWebSocketPath(): string {
    return this.websocketPaths[0];
  }

  broadcast(payload: Record<string, unknown>): void {
    if (this.clients.size === 0) {
      return;
    }

    const frame = this.createFrame(JSON.stringify(payload));
    for (const client of [...this.clients]) {
      if (client.destroyed) {
        this.clients.delete(client);
        continue;
      }

      try {
        client.write(frame);
      } catch {
        this.clients.delete(client);
        client.destroy();
      }
    }
  }

  private isOddsWebSocketRequest(request: IncomingMessage): boolean {
    const url = request.url || '';
    return this.websocketPaths.some((path) => url.startsWith(path));
  }

  private handleClientFrame(socket: Socket, frame: Buffer): void {
    if (frame.length < 2) {
      return;
    }

    const opcode = frame[0] & 0x0f;
    if (opcode === 0x8) {
      socket.write(this.createFrame(Buffer.alloc(0), 0x8));
      this.clients.delete(socket);
      socket.end();
      return;
    }

    if (opcode === 0x9) {
      const payload = this.decodePayload(frame);
      socket.write(this.createFrame(payload, 0xA));
    }
  }

  private sendToSocket(socket: Socket, payload: Record<string, unknown>): void {
    socket.write(this.createFrame(JSON.stringify(payload)));
  }

  private createFrame(payload: string | Buffer, opcode: number = 0x1): Buffer {
    const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    const length = body.length;

    if (length < 126) {
      return Buffer.concat([Buffer.from([0x80 | opcode, length]), body]);
    }

    if (length < 65536) {
      const header = Buffer.alloc(4);
      header[0] = 0x80 | opcode;
      header[1] = 126;
      header.writeUInt16BE(length, 2);
      return Buffer.concat([header, body]);
    }

    const header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
    return Buffer.concat([header, body]);
  }

  private decodePayload(frame: Buffer): Buffer {
    const masked = (frame[1] & 0x80) === 0x80;
    let payloadLength = frame[1] & 0x7f;
    let offset = 2;

    if (payloadLength === 126) {
      payloadLength = frame.readUInt16BE(offset);
      offset += 2;
    } else if (payloadLength === 127) {
      payloadLength = Number(frame.readBigUInt64BE(offset));
      offset += 8;
    }

    if (!masked) {
      return frame.subarray(offset, offset + payloadLength);
    }

    const maskingKey = frame.subarray(offset, offset + 4);
    offset += 4;
    const payload = frame.subarray(offset, offset + payloadLength);
    const decoded = Buffer.alloc(payload.length);

    for (let index = 0; index < payload.length; index += 1) {
      decoded[index] = payload[index] ^ maskingKey[index % 4];
    }

    return decoded;
  }
}
