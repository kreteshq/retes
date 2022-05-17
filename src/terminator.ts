import { Server } from "http";
import { Socket } from "net";

interface TerminatorInput {
  server: Server;
  terminationTimeout: number;
}

interface TimeoutOptions {
  timeout: number;
}

type Condition = () => Promise<any>;

const timeout = (cond: Condition, { timeout }: TimeoutOptions) => {
  let timer;
  return Promise.race([
    cond(),
    new Promise((_r, rej) => (timer = setTimeout(rej, timeout))),
  ]).finally(() => clearTimeout(timer));
};

export const createHTTPTerminator = ({
  server,
  terminationTimeout = 2000,
}: TerminatorInput) => {
  const sockets = new Set<Socket>();

  let termination;

  server.on("connection", (socket) => {
    if (termination) {
      socket.destroy();
    } else {
      sockets.add(socket);

      socket.once("close", () => {
        sockets.delete(socket);
      });
    }
  });

  const destroySocket = (socket: Socket) => {
    socket.destroy();
    sockets.delete(socket);
  };

  return {
    async terminate() {
      if (termination) {
        return termination;
      }

      let terminationResolve: Function;
      let terminationReject: Function;

      termination = new Promise((resolve, reject) => {
        terminationResolve = resolve;
        terminationReject = reject;
      });

      server.on("request", (_incomingMessage, outgoingMessage) => {
        if (!outgoingMessage.headersSent) {
          outgoingMessage.setHeader("connection", "close");
        }
      });

      for (const socket of sockets) {
        destroySocket(socket);
      }

      const isSocketSetEmpty = async () => sockets.size === 0;
      try {
        await timeout(isSocketSetEmpty, {
          timeout: terminationTimeout,
        });
      } catch {
        // ignore
      } finally {
        for (const socket of sockets) {
          destroySocket(socket);
        }
      }

      server.close((error) => {
        if (error) {
          terminationReject(error);
        } else {
          terminationResolve();
        }
      });

      return termination;
    },
  };
};
