/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

/**
 * The part of the PM2 API the runtime binaries reach for. The published surface is
 * types/index.d.ts; this is deliberately smaller, and says only what pm2-runtime, pm2-dev and
 * pm2-docker call — those three load pm2 through require, so nothing else describes it for
 * them.
 */
export type ApiCallback = (err: unknown, result?: unknown) => void;

export interface Pm2Client {
  connect(cb: (err: unknown, meta?: unknown) => void): void;
  disconnect(cb?: () => void): void;
  start(script: unknown, opts: unknown, cb: (err: unknown, procs?: Pm2Process[]) => void): void;
  delete(target: string, cb?: ApiCallback): void;
  list(cb: (err: unknown, apps?: Pm2Process[]) => void): void;
  kill(cb?: () => void): void;
  destroy(cb?: () => void): void;
  attach(id: unknown, cb?: () => void): void;
  web(port: number | string): void;
  Client: unknown;
  connected?: boolean;
}

export interface Pm2Process {
  name?: string;
  pm_id?: number | string;
  pm2_env: {
    status?: string;
    pmx_module?: boolean;
    pm_id?: number | string;
    [key: string]: unknown;
  };
}

export interface Pm2Module {
  custom: new (opts: Record<string, unknown>) => Pm2Client;
}

export interface LogStreamer {
  stream(
    client: unknown,
    id: string,
    raw: boolean,
    timestamp?: unknown,
    exclusive?: unknown,
    highlight?: unknown,
  ): void;
  jsonStream(client: unknown, id: string | number): void;
  formatStream(
    client: unknown,
    id: string | number,
    raw: boolean,
    timestamp?: unknown,
    exclusive?: unknown,
    highlight?: unknown,
  ): void;
  devStream(
    client: unknown,
    id: string,
    raw?: boolean,
    timestamp?: unknown,
    exclusive?: unknown,
  ): void;
}

/** The option bag pm2-dev hands to `run`. */
export interface DevOptions {
  autoExit?: boolean;
  autorestart?: boolean;
  autostart?: boolean;
  ignore?: string;
  ignore_watch?: string | string[];
  postExec?: string;
  raw?: boolean;
  restart_delay?: number;
  testMode?: boolean;
  timestamp?: string | boolean;
  watch?: boolean;
  [key: string]: unknown;
}

/**
 * The commander instance these binaries drive, and the option bag it hands their actions. Only
 * the flags this codebase reads are named; the parser will happily carry more.
 */
export interface CommanderCli extends DevOptions {
  version(v: string): CommanderCli;
  description(d: string): CommanderCli;
  option(flags: string, description?: string, defaultValue?: unknown): CommanderCli;
  usage(u: string): CommanderCli;
  allowUnknownOption(): CommanderCli;
  command(name: string): CommanderCli;
  action(handler: (...args: never[]) => void): CommanderCli;
  parse(argv: string[]): void;
  outputHelp(): void;

  autoManage?: boolean;
  delay?: number;
  fastBoot?: boolean;
  format?: boolean;
  formatted?: boolean;
  instances?: number | string;
  json?: boolean;
  machineName?: string;
  public?: string;
  secret?: string;
  silentExec?: boolean;
  timestamp?: string | boolean;
  web?: boolean | number | string;
}
