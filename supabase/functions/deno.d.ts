// Deno global type shim for IDE TypeScript Language Server.
// These files run in the Deno runtime on Supabase Edge Functions —
// this file silences IDE errors that occur because the Node TS server
// doesn't know about Deno built-ins or esm.sh/deno.land URL imports.

declare namespace Deno {
  interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    has(key: string): boolean;
    toObject(): Record<string, string>;
  }

  const env: Env;

  function serve(
    handler: (req: Request) => Response | Promise<Response>,
    options?: {
      port?: number;
      hostname?: string;
      onListen?: (addr: { port: number; hostname: string }) => void;
    }
  ): void;

  function exit(code?: number): never;
  function readTextFile(path: string | URL): Promise<string>;
  function readFile(path: string | URL): Promise<Uint8Array>;
  function writeTextFile(path: string | URL, data: string): Promise<void>;
}

// ─── Supabase ESM shim ────────────────────────────────────────────────────────
// Provides just enough types for createClient() so the IDE doesn't error.
// Full types come from the runtime (Deno imports the real package).

interface SupabaseClientOptions {
  auth?: {
    storage?: any;
    persistSession?: boolean;
    autoRefreshToken?: boolean;
  };
  global?: {
    headers?: Record<string, string>;
  };
}

interface SupabaseClient {
  from: (table: string) => any;
  rpc: (fn: string, params?: Record<string, any>) => any;
  auth: {
    getUser: () => Promise<{ data: { user: any | null }; error: any | null }>;
    getSession: () => Promise<{ data: { session: any | null }; error: any | null }>;
    signInWithPassword: (credentials: any) => Promise<any>;
    signUp: (credentials: any) => Promise<any>;
    signOut: () => Promise<any>;
    resetPasswordForEmail: (email: string, options?: any) => Promise<any>;
    onAuthStateChange: (callback: (event: string, session: any) => void) => { data: { subscription: { unsubscribe: () => void } } };
    admin: {
      listUsers: (options?: any) => Promise<any>;
      getUserById: (id: string) => Promise<any>;
      deleteUser: (id: string) => Promise<any>;
    };
  };
  storage: {
    from: (bucket: string) => any;
  };
  functions: {
    invoke: (name: string, options?: any) => Promise<any>;
  };
}

declare function createClient(
  supabaseUrl: string,
  supabaseKey: string,
  options?: SupabaseClientOptions
): SupabaseClient;

// ─── URL module shims ─────────────────────────────────────────────────────────
declare module "https://esm.sh/@supabase/supabase-js@2" {
  export { createClient };
  export type { SupabaseClient };
}

declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(
    handler: (req: Request) => Response | Promise<Response>
  ): void;
}

declare module "https://deno.land/std@0.177.0/http/server.ts" {
  export function serve(
    handler: (req: Request) => Response | Promise<Response>
  ): void;
}

