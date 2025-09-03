
export type TopLevelErrorMessageType = (typeof digestMap)[keyof typeof digestMap];

export const digestMap = {
  '101': 'Unauthorized',
  '102': 'Forbidden',
  '103': 'Blocked',
} as const;

const digestMapReverse = Object.entries(digestMap).reduce(
  (acc, [key, value]) => {
    acc[value] = key;

    return acc;
  },
  {} as Record<TopLevelErrorMessageType, string>
);

export class TopLevelError extends Error {
  public digest: string;

  constructor(message: TopLevelErrorMessageType) {
    super(message);
    this.name = 'TopLevelError';
    this.digest = digestMapReverse[message];
  }
}
