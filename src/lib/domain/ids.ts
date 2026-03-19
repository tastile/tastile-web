import { v4 as uuidv4 } from 'uuid'

export type TileId = string & { readonly __brand: 'TileId' }
export type UserId = string & { readonly __brand: 'UserId' }
export type EventId = string & { readonly __brand: 'EventId' }
export type CommandId = string & { readonly __brand: 'CommandId' }
export type RequestId = string & { readonly __brand: 'RequestId' }
export type SegmentId = string & { readonly __brand: 'SegmentId' }

function makeId<T extends string>(): T {
  return uuidv4() as T
}

export const TileId = {
  new: () => makeId<TileId>(),
  fromString: (value: string) => value as TileId,
}

export const EventId = {
  new: () => makeId<EventId>(),
  fromString: (value: string) => value as EventId,
}

export const CommandId = {
  new: () => makeId<CommandId>(),
  fromString: (value: string) => value as CommandId,
}

export const RequestId = {
  new: () => makeId<RequestId>(),
  fromString: (value: string) => value as RequestId,
}

export const SegmentId = {
  new: () => makeId<SegmentId>(),
  fromString: (value: string) => value as SegmentId,
}

export function createTileId(id: string): TileId {
  return TileId.fromString(id)
}

export function createUserId(id: string): UserId {
  return id as UserId
}
