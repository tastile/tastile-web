export type ActorType = 'system' | 'human' | 'agent'

export interface Actor {
  type: ActorType
  id: string
}

export const Actor = {
  system: (): Actor => ({ type: 'system', id: 'system' }),
  human: (id: string): Actor => ({ type: 'human', id }),
  agent: (id: string): Actor => ({ type: 'agent', id }),
}
