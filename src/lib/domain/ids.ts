export type TileId = string & { readonly __brand: 'TileId' }
export type UserId = string & { readonly __brand: 'UserId' }

export function createTileId(id: string): TileId {
  return id as TileId
}

export function createUserId(id: string): UserId {
  return id as UserId
}
