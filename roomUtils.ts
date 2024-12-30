export class RoomUtils {
  room: RoomObject;
  constructor(room: RoomObject) {
    this.room = room
  }
  // If there are no admins left in the room give admin to one of the remaining players.
  updateAdmins() {
    // Get all players
    var players = this.room.getPlayerList();
    if (players.length == 0) return; // No players left, do nothing.
    if (players.find((player: PlayerObject) => player.admin) != null) return; // There's an admin left so do nothing.
    this.room.setPlayerAdmin(players[0].id, true); // Give admin to the first non admin player in the list
  }

  // Get best team to put a player
  // used when !afk a new player joined
  availableTeam() {
    var players = this.room.getPlayerList();
    // Get the team that has less players than the other
    // If both teams have the same players, random team
    const redTeam = players.filter((player: PlayerObject) => player.team == 1);
    const blueTeam = players.filter((player: PlayerObject) => player.team == 2);
    return redTeam.length <= blueTeam.length ? 1 : 2;
  }
}


