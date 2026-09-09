import "server-only";

import { Pool } from "pg";
import type { PoolClient } from "pg";

import { FusionStore, fusionStore } from "./fusion";

type StoreOperation<T> = (store: FusionStore) => T;

interface StateRow {
  state: unknown;
}

export interface FusionRepositoryOptions {
  databaseUrl?: string;
  memoryStore?: FusionStore;
}

export class FusionRepository {
  private readonly databaseUrl?: string;
  private readonly memoryStore: FusionStore;
  private pool?: Pool;
  private schemaReady?: Promise<void>;

  constructor({ databaseUrl = process.env.DATABASE_URL, memoryStore = fusionStore }: FusionRepositoryOptions = {}) {
    this.databaseUrl = databaseUrl?.trim() || undefined;
    this.memoryStore = memoryStore;
  }

  async read<T>(operation: StoreOperation<T>): Promise<T> {
    if (this.databaseUrl === undefined) {
      return operation(this.memoryStore);
    }

    return operation(FusionStore.fromState(await this.loadState()));
  }

  async mutate<T>(operation: StoreOperation<T>): Promise<T> {
    if (this.databaseUrl === undefined) {
      return operation(this.memoryStore);
    }

    await this.ensureSchema();
    const client = await this.getPool().connect();
    try {
      await client.query("BEGIN");
      const state = await this.loadState(client, true);
      const store = FusionStore.fromState(state);
      const before = JSON.stringify(store.exportState());
      const result = operation(store);
      const after = JSON.stringify(store.exportState());
      if (after !== before) {
        await client.query("UPDATE fusion_control_plane_state SET state = $1::jsonb, updated_at = now() WHERE id = true", [after]);
      }
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private getPool(): Pool {
    if (this.pool === undefined) {
      this.pool = new Pool({ connectionString: this.databaseUrl });
    }

    return this.pool;
  }

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady === undefined) {
      this.schemaReady = this.getPool()
        .query(
          `CREATE TABLE IF NOT EXISTS fusion_control_plane_state (
             id boolean PRIMARY KEY DEFAULT true CHECK (id),
             state jsonb NOT NULL,
             updated_at timestamptz NOT NULL DEFAULT now()
           )`,
        )
        .then(() => undefined);
    }

    await this.schemaReady;
  }

  private async loadState(client: Pool | PoolClient = this.getPool(), lock = false): Promise<unknown> {
    await this.ensureSchema();
    await client.query(
      "INSERT INTO fusion_control_plane_state (id, state) VALUES (true, $1::jsonb) ON CONFLICT (id) DO NOTHING",
      [JSON.stringify(this.memoryStore.exportState())],
    );
    const result = await client.query<StateRow>(
      `SELECT state FROM fusion_control_plane_state WHERE id = true${lock ? " FOR UPDATE" : ""}`,
    );
    const state = result.rows[0]?.state;
    if (state === undefined) {
      throw new Error("Fusion control-plane state could not be initialized.");
    }

    return state;
  }
}

// ponytail: a locked JSONB snapshot preserves the existing domain model; normalize state and add an outbox when control-plane data or write throughput grows.
export const fusionRepository = new FusionRepository();
