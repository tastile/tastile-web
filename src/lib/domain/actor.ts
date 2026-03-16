export type ActorType = 'system' | 'human' | 'agent'

export interface Actor {
  type: ActorType
  id: string
}

export const Actor = {
  system: (): Actor => ({ type: 'system', id: 'system' }),
  human: (userId: string): Actor => ({ type: 'human', id: userId }),
  agent: (agentId: string): Actor => ({ type: 'agent', id: agentId }),
}
