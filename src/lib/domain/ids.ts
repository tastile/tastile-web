import { v4 as uuidv4, validate as isUuid } from 'uuid';

export type TileId = string & { readonly __brand: 'TileId' };
export type EventId = string & { readonly __brand: 'EventId' };
export type CommandId = string & { readonly __brand: 'CommandId' };
export type SegmentId = string & { readonly __brand: 'SegmentId' };
export type PromptId = string & { readonly __brand: 'PromptId' };

function createId<T extends string>(): T {
  return uuidv4() as T;
}

function parseId<T extends string>(s: string, typeName?: string): T {
  if (!isUuid(s)) {
    const ctx = typeName ? ` for ${typeName}` : '';
    throw new Error(`Invalid UUID format${ctx}: ${s}`);
  }
  return s as T;
}

export const TileId = {
  new: () => createId<TileId>(),
  fromString: (s: string) => parseId<TileId>(s, 'TileId'),
};

export const EventId = {
  new: () => createId<EventId>(),
  fromString: (s: string) => parseId<EventId>(s, 'EventId'),
};

export const CommandId = {
  new: () => createId<CommandId>(),
  fromString: (s: string) => parseId<CommandId>(s, 'CommandId'),
};

export const SegmentId = {
  new: () => createId<SegmentId>(),
  fromString: (s: string) => parseId<SegmentId>(s, 'SegmentId'),
};

export const PromptId = {
  new: () => createId<PromptId>(),
  fromString: (s: string) => parseId<PromptId>(s, 'PromptId'),
};
