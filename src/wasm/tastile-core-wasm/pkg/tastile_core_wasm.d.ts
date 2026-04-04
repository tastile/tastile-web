/* tslint:disable */
/* eslint-disable */

export class WasmCoreEngine {
    free(): void;
    [Symbol.dispose](): void;
    configure_sync_json(config_json: string): string;
    execute(command_json: string): void;
    execute_with_ack_json(command_json: string): string;
    export_tiles_json(): string;
    constructor();
    read_snapshot_json(now_iso_utc?: string | null): string;
    read_sync_status_json(): string;
    replace_event_log_json(events_json: string): string;
    replace_tiles_json(tiles_json: string): string;
    restore_sync_json(): string;
    trigger_sync_json(): string;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_wasmcoreengine_free: (a: number, b: number) => void;
    readonly wasmcoreengine_configure_sync_json: (a: number, b: number, c: number) => [number, number, number, number];
    readonly wasmcoreengine_execute: (a: number, b: number, c: number) => [number, number];
    readonly wasmcoreengine_execute_with_ack_json: (a: number, b: number, c: number) => [number, number, number, number];
    readonly wasmcoreengine_export_tiles_json: (a: number) => [number, number, number, number];
    readonly wasmcoreengine_new: () => number;
    readonly wasmcoreengine_read_snapshot_json: (a: number, b: number, c: number) => [number, number, number, number];
    readonly wasmcoreengine_read_sync_status_json: (a: number) => [number, number, number, number];
    readonly wasmcoreengine_replace_event_log_json: (a: number, b: number, c: number) => [number, number, number, number];
    readonly wasmcoreengine_replace_tiles_json: (a: number, b: number, c: number) => [number, number, number, number];
    readonly wasmcoreengine_restore_sync_json: (a: number) => [number, number, number, number];
    readonly wasmcoreengine_trigger_sync_json: (a: number) => [number, number, number, number];
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
