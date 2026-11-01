import { createServer, request as forward } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface SpiLink {
  /** Where the API calls the SPI: through this link. */
  url: string;
  /** The SPI is gone: every call is dropped without an answer. */
  down(): void;
  /** The SPI is back. */
  up(): void;
  close(): Promise<void>;
}

/**
 * The network between the API and the SPI, which the chaos test cuts and
 * mends (v1.2.0 plan, task 9, C5): each call is passed on to [target] as it
 * came, or dropped while the link is down. Nothing in the API nor in the
 * simulator changes to fake the outage.
 */
export async function spiLink(target: string): Promise<SpiLink> {
  const upstream = new URL(target);
  let isDown = false;
  const server = createServer((incoming, outgoing) => {
    if (isDown) {
      incoming.socket.destroy();
      return;
    }
    const call = forward(
      {
        hostname: upstream.hostname,
        port: upstream.port,
        method: incoming.method,
        path: incoming.url,
        headers: incoming.headers,
      },
      (answer) => {
        outgoing.writeHead(answer.statusCode ?? 502, answer.headers);
        answer.pipe(outgoing);
      },
    );
    // The SPI dropped the call (an injected timeout): so does the link.
    call.on('error', () => incoming.socket.destroy());
    incoming.pipe(call);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${String(port)}`,
    down: () => {
      isDown = true;
    },
    up: () => {
      isDown = false;
    },
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => {
          resolve();
        });
      }),
  };
}
