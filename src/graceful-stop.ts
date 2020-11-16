import { Server, IncomingMessage, RequestListener } from "http";
import { Socket } from "net";

/**
 * Copyright 2020 Dashlane
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 *
 * Helper function to allow better handling of keep-alive connections for
 * graceful termination of a server. Calling `server.close()` will stop the server
 * from accepting new connections, but existing keep-alive aren't closed nor handled
 * in any special way by default. https://github.com/nodejs/node/issues/2642 shows
 * that this can keep a server for being shutdown cleanly after serving ongoing requests.
 *
 * This function will keep track of all opened connections and ongoing requests.
 *
 * The main idea is trying to serve all ongoing requests before shutting down the
 * server while trying to minimize the "socket hangup" or "connection reset"
 * errors on clients.
 *
 * Once the server starts being terminated, the server will reply with
 * Connection: close headers to signal clients not to send requests on existing
 * connections because they will be closed. This is done to minimize the chance
 * of closing a connection while there is an in-flight request to the server.
 *
 * All connections for which a Connection: close response has been sent, will be
 * terminated after handling the last request.
 *
 * After a timeout, all idle connections with no ongoing requests will be closed,
 * even if they haven't received the Connection: close header.
 *
 * After a bigger timeout, if some connections are still keeping the server
 * open, all connections will be forced closed and ongoing requests will not
 * send a response.
 */
const serverStoppingHelper = (
  server: Server
): ((cb: (err?: Error | undefined) => void) => void) => {
  // If the server needs to be stopped and it seems to be having trouble keeping up with pending requests
  // we should just force the closing of the connections
  const forcedStopTimeout = 30000;

  // In cases a client is sending no more requests, we won't have the opportunity to send Connection: close back
  // In these cases we should just end the connection as it has become idle.
  // Note that this could be achieved internally with server.keepAliveTimeout but
  // the normal runtime value might be different for what we'd like here
  const timeoutToTryEndIdle = 15000;

  // We need to keep track of requests per connection so that we can detect when we have responded
  // to a request in a keep-alive connection. This is the only way in node that we can close a
  // keep-alive connection after handling requests.
  const reqCountPerSocket = new Map<Socket, number>();

  // To minimize the chances of closing a connection while there is a request in-flight from the client
  // we respond with a Connection: close header once the server starts being terminated. We'll only
  // immediately close connections where we have responded this header. For others, we'll only
  // close them if they're still open after "timeoutToTryEndIdle"
  // This won't help against clients that don't respect the Connection: close header
  const hasRepliedClosedConnectionForSocket = new WeakMap<Socket, boolean>();
  let terminating = false;
  const trackConnections = (socket: Socket): void => {
    reqCountPerSocket.set(socket, 0);
    socket.once("close", () => {
      reqCountPerSocket.delete(socket);
    });
  };

  const checkAndCloseConnection = (req: IncomingMessage): void => {
    const socketPendingRequests = reqCountPerSocket.get(req.socket)! - 1;
    const hasSuggestedClosingConnection = hasRepliedClosedConnectionForSocket.get(
      req.socket
    );

    reqCountPerSocket.set(req.socket, socketPendingRequests);
    if (
      terminating &&
      socketPendingRequests === 0 &&
      hasSuggestedClosingConnection
    ) {
      req.socket.end();
    }
  };

  const trackRequests: RequestListener = (req, res) => {
    const currentCount = reqCountPerSocket.get(req.socket) ?? 0;
    reqCountPerSocket.set(req.socket, currentCount + 1);

    if (terminating && !res.headersSent) {
      res.setHeader("connection", "close");
      hasRepliedClosedConnectionForSocket.set(req.socket, true);
    }

    res.on("finish", () => checkAndCloseConnection(req));
  };

  const endAllConnections = ({ force }: { force: boolean }): void => {
    for (const [socket, reqCount] of reqCountPerSocket) {
      if (force || reqCount === 0) {
        socket.end();
      }
    }
  };

  server.on("connection", trackConnections);
  server.on("request", trackRequests);

  const stoppingFunction = (cb: (err?: Error) => void): void => {
    terminating = true;
    // cb won't be called as long as there are open connections
    // So here we're "implicitly" also waiting for the callbacks
    // that will close idle connections or force close all connections
    // after a delay
    server.close(cb);

    if (timeoutToTryEndIdle < forcedStopTimeout) {
      setTimeout(
        () => endAllConnections({ force: false }),
        timeoutToTryEndIdle
      );
    }
    setTimeout(() => endAllConnections({ force: true }), forcedStopTimeout);
  };

  return stoppingFunction;
};

export const getServerStopFunc = (server: Server): (() => Promise<void>) => {
  const serverStopperFunc = serverStoppingHelper(server);

  return (): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      serverStopperFunc(error => {
        if (error) {
          return reject(error);
        }

        return resolve();
      });
    });
};