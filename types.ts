export class MutedUsers {
  player: PlayerObject;
  mutedBy: number;
  duration: number;
  mutedAt: number;
};

export class PlayerObject {
  id: number;
  name: string;
  team: TeamID;
  admin: boolean;
  position: { "x": number; "y": number };
  auth: string;
  conn: string;
}
