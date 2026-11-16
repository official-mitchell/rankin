// Worker bindings. CREATE_KEY is a secret; LOG_LEVEL is a plain var.
export interface Env {
  SESSION: DurableObjectNamespace;
  ASSETS: Fetcher;
  CREATE_KEY: string;
  LOG_LEVEL: string;
}
