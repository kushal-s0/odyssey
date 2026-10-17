import { resolveSrv, lookup } from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "../config.js";
function tcp(host: string, port: number): Promise<unknown> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, family: 4 });
    socket.setTimeout(7000);
    socket.once("connect", () => {
      socket.destroy();
      resolve({ ok: true });
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve({ ok: false, code: "TIMEOUT" });
    });
    socket.once("error", (error: any) => {
      socket.destroy();
      resolve({ ok: false, code: error.code ?? error.name });
    });
  });
}
function secure(host: string, port: number, force12 = false): Promise<unknown> {
  return new Promise((resolve) => {
    const socket = tls.connect({
      host,
      port,
      servername: host,
      rejectUnauthorized: true,
      ...(force12
        ? { minVersion: "TLSv1.2" as const, maxVersion: "TLSv1.2" as const }
        : {}),
    });
    socket.setTimeout(7000);
    socket.once("secureConnect", () => {
      const protocol = socket.getProtocol();
      socket.destroy();
      resolve({ ok: true, protocol });
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve({ ok: false, code: "TIMEOUT" });
    });
    socket.once("error", (error: any) => {
      socket.destroy();
      resolve({ ok: false, code: error.code ?? error.name });
    });
  });
}
const uri = new URL(config.MONGODB_URI);
const nodes = await resolveSrv(`_mongodb._tcp.${uri.hostname}`);
const results: any = { srvRecords: nodes.length, nodes: [] };
for (let i = 0; i < nodes.length; i++) {
  const node = nodes[i]!;
  const addresses = await lookup(node.name, { all: true });
  const [transport, handshake, handshake12] = await Promise.all([
    tcp(node.name, node.port),
    secure(node.name, node.port),
    secure(node.name, node.port, true),
  ]);
  results.nodes.push({
    node: i + 1,
    ipv4: addresses.filter((a) => a.family === 4).length,
    ipv6: addresses.filter((a) => a.family === 6).length,
    tcp: transport,
    tls: handshake,
    tls12: handshake12,
  });
}
results.httpsTls = await secure("generativelanguage.googleapis.com", 443);
const root = process.cwd().endsWith("server")
  ? resolve(process.cwd(), "..")
  : process.cwd();
await mkdir(resolve(root, ".planning"), { recursive: true });
await writeFile(
  resolve(root, ".planning/atlas-network-check.json"),
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results));
