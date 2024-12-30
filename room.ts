import { WebSocket } from "ws";
import { MutedUsers, PlayerObject } from "./types";
import * as messages from "./static-messages/messages";
import HaxballJS from "haxball.js";
import { RoomUtils } from "./roomUtils";

HaxballJS.then((HBInit) => {
  const room = HBInit({
    roomName: "dev mode",
    maxPlayers: 8,
    public: false,
    noPlayer: true,
    token: "thr1.AAAAAGdx77uydWGGnvmfYw.EGF3bEE9aMk",
  });

  room.setDefaultStadium("Small");
  room.setScoreLimit(1);
  room.setTimeLimit(0);
  room.startGame();

  let players_joined: Player[] = [];
  let lastPlayerTouchedBall: Player;
  let preLastTouchedBall: Player;
  let webSocket = new WebSocket("ws://127.0.0.1:8000/ws");

  webSocket.on("open", () => {
    console.log("Conexión WebSocket abierta");
  });

  webSocket.on("message", async (event: any) => {
    const response = JSON.parse(event);
    console.log(response)

    // If response.success if false, send message to the user with the details
    if (!response.success) {
      return room.sendAnnouncement(`${response.detail}`, response.data, 888888);
    }

    // !stats
    if (response.type === "player_stats" && response.data) {
      try {
        const data: Player = response.data;
        let player = players_joined.find((p) => p.name === data.name);
        room.sendAnnouncement(
          `✅:  Wins: ${data.wins} | 😥 Perdidas: ${data.loses} | ⚽ Goles: ${data.goals} | 🤣 Autogoles: ${data.own_goals} | 🦵 Asistencias: ${data.assists} | 🥅 Arcos en cero: ${data.cs}`,
          player.id,
          838388,
          "bold",
          0,);

        return data;
      } catch (err) {
        console.error(err);
      }
    }

    if (response.type === "update_top" && response.payload) {
      // This is the data that is coming from the backend
      if (!response.success) {
        return console.log(response.detail);
      }

      try {
        const payload: any = response.payload;
        game.top(null, null, payload);
      } catch (error) {
        console.error("Error al actualizar la base de datos:", error);
      }
    }
  });

  webSocket.on("error", (error) => {
    console.error("Error de WebSocket:", error);
  });

  webSocket.on("close", () => {
    console.log("Conexión WebSocket cerrada");
  });
  enum TeamID {
    Spectators = 0,
    RedTeam = 1,
    BlueTeam = 2,
  }

  interface PlayerOptions {
    isVip?: boolean;
    goals?: number;
    cs?: number;
    assists?: number;
    own_goals?: number;
    name: string;
    team: TeamID;
    admin: boolean;
    auth: string;
    id: number;
    conn: string;
    position: { x: number; y: number };
    wins?: number;
    loses?: number;
    isMuted?: boolean;
  }

  class Player extends PlayerObject {
    isVip: boolean;
    isMuted: boolean;
    goals: number;
    cs: number;
    assists: number;
    own_goals: number;
    wins: number;
    loses: number;

    constructor(options: PlayerOptions) {
      super();
      this.id = options.id ?? 0;
      this.name = options.name ?? "Unknown"; // Asegúrate de que 'name' esté presente
      this.team = options.team ?? 0;
      this.admin = options.admin ?? false;
      this.position = options.position ?? null;
      this.auth = options.auth ?? "";
      this.conn = options.conn ?? "";
      this.cs = options.cs ?? 0;
      this.assists = options.assists ?? 0;
      this.own_goals = options.own_goals ?? 0;
      this.wins = options.wins ?? 0;
      this.loses = options.loses ?? 0;
      this.isVip = options.isVip ?? false;
      this.isMuted = options.isMuted ?? false;
      this.goals = options.goals ?? 0;
    }

    resetStats() {
      this.goals = 0;
      this.cs = 0;
      this.assists = 0;
      this.own_goals = 0;
      this.wins = 0;
      this.loses = 0;
      this.isMuted = false;
    }
  }

  class Game {
    muted_users: MutedUsers[] = [];
    cooldown = false;
    cooldownTime = 10000;

    // MESSAGE FLOOD SYSTEM

    opts: any = {
      p: { N: 5, TM: 0.6, TW: 0.3, NW: 2 },
      players_chatted: [],
    };

    find_user_index(pId: number): number {
      for (let i = 0; i < this.opts.players_chatted.length; i += 1) {
        if (pId === this.opts.players_chatted[i].id) {
          return i;
        }
      }
      return -1;
    }

    async stats(message: string, player: Player) {
      let data = {
        type: "player_stats",
        user: { ...player },
      };

      webSocket.send(JSON.stringify(data));
    }

    async register(message: string, player: Player) {
      const parts = message.split(" ");
      const password = parts[1];

      const player_auth = players_joined?.find((p) => p.id === player.id)?.auth;
      const data = {
        type: "register_user",
        user: {
          name: player.name,
          password: password,
          auth: player_auth,
        },
      };

      webSocket.send(JSON.stringify(data));
    }

    spamFilter(player: Player, message: string) {
      if (player.admin === true) {
        return;
      }
      let timestamp = Date.now();
      let ind = this.find_user_index(player.id);
      // If ind = -1 it means that the player wasn't found on the
      // players_chatted. Only then is when we are adding a new user to
      // avoid duplicate users. Also update ind to the length of the
      // opts.players_chatted.length - 1 so when it tries to access, it
      // doesnt access -1, it access 1 or 2 or the new index.
      if (ind === -1) {
        this.opts.players_chatted.push({
          id: player.id,
          lm: [timestamp],
          tw: [],
        });
        ind = this.opts.players_chatted.length - 1;
      } else {
        this.opts.players_chatted[ind].lm.push(timestamp);
      }

      // If the length of the last messages of the user exceeds the
      // opts.p.N (the maximum numbers until a flood flag is sent), remove
      // the elements from 0 to the length of the lm minus opts.p.N
      // example: lm.length = 5 and opts.p.N = 3, 5 - 3 = 2, from 0 to 2
      // and leave the last 3 messages alone
      if (this.opts.players_chatted[ind].lm.length >= this.opts.p.N) {
        this.opts.players_chatted[ind].lm.splice(
          0,
          this.opts.players_chatted[ind].lm.length - this.opts.p.N,
        );
      }

      if (
        Array.isArray(this.opts.players_chatted[ind].lm) &&
        this.opts.players_chatted[ind].lm.length >= this.opts.p.N
      ) {
        const timeDiff =
          this.opts.players_chatted[ind].lm[
          this.opts.players_chatted[ind].lm.length - 1
          ] - this.opts.players_chatted[ind].lm[0];
        const messageRate =
          this.opts.players_chatted[ind].lm.length / (timeDiff / 1000);
        console.log(messageRate);
        if (messageRate > this.opts.p.TM) {
          room.sendAnnouncement(
            `${player.name} escribe mas lento careverga`,
            player.id,
            838388,
            "bold",
          );
          this.opts.players_chatted[ind].tw.push(timestamp);
        }
      }

      if (this.opts.players_chatted[ind].tw.length >= this.opts.p.NW) {
        const warningTimeDiff =
          (this.opts.players_chatted[ind].tw[
            this.opts.players_chatted[ind].tw.length - 1
          ] -
            this.opts.players_chatted[ind].tw[
            this.opts.players_chatted[ind].tw.length - 2
            ]) /
          1000;
        if (warningTimeDiff > this.opts.p.TW) {
          room.kickPlayer(player.id, "flood de mensajes", false);
        }
      }
    }

    afk(message: string, player: Player) {
      if (player.team != 0) {
        room.sendAnnouncement(
          `${player.name} fue a tirar paja!`,
          undefined,
          585858,
          "bold",
        );

        room.setPlayerTeam((playerID = player.id), (team = 0));
        return;
      } else {
        room.sendAnnouncement(
          `${player.name} ya regreso, cual video te viste?`,
          undefined,
          585858,
          "bold",
        );
        room.setPlayerTeam(player.id, availableTeam());
      }
    }

    validateMuteFormat(parts: string[]) {
      if (parts.length !== 3 || parts[0] !== "!mute") {
        return "Formato incorrecto. Formato correcto: !mute (duracion) (id: #numero)";
      }

      const duration = parseInt(parts[1]);
      if (isNaN(duration)) {
        return "Duracion invalida. Debe ser un numero.";
      }

      let id = parts[2];
      if (!id.startsWith("#")) {
        return "ID invalida. ID deberia tener un numero despues del '#'.";
      }

      id = id.slice(1);
      if (isNaN(parseInt(id))) {
        return "ID invalida. ID deberia tener un numero despues del '#'.";
      }

      return null;
    }

    async top(
      message?: string,
      originPlayer?: Player,
      payload?: any,
    ) {

      const commandMapping: {
        [key: string]: { property: string; label: string };
      } = {
        "!topgoles": { property: "goals", label: "goles" },
        "!topautogoles": { property: "own_goals", label: "autogoles" },
        "!topasistencias": { property: "assists", label: "asistencias" },
        "!topwins": { property: "wins", label: "ganadas" },
        "!topperdidas": { property: "loses", label: "perdidas" },
        "!topcs": { property: "cs", label: "arcos en cero" },
      };

      let property;
      let label;

      if (message) {
        // Find the commandMapping key (command) that is equal to the message (command)
        let command = Object.keys(commandMapping).find((k) =>
          message.startsWith(k),
        );

        let { property: p, label: l } = commandMapping[command];
        property = p;
        label = l;
        getUpdatedDbTop([property]);
      }

      if (payload) {
        let topUsers: any = [];

        if (payload.data.topResults) {
          topUsers = payload.data.topResults.map((top) => {
            const key = Object.keys(top)[0];
            const value = Object.values(top)[0];
            return { name: key, value };
          });
          let messageOutput = topUsers[0]?.value
            .map((u) => `${u.name}: ${u.value}`)
            .join("\n");
          room.sendAnnouncement(
            `Tabla de personas con mas ${payload.data.top}:\n${messageOutput}`,
            null,
            0xff0000,
            "bold",
          );
        }

      }

    }

    mute(message: string, player: Player) {
      const parts = message.split(" ");
      let pId: string | number = parts[2];

      let duration = parseInt(parts[1]);

      if (pId.includes("#")) {
        pId = parseInt(pId.replace("#", ""));
      }

      this.validateMuteFormat(parts);
      const originPlayerId = player.id;

      // Check if the player that used the mute comand is an admin
      let admin = room
        .getPlayerList()
        .find((p: Player) => p.admin && p.id === originPlayerId);

      if (!admin) return;

      // Check if the player that is being muted exists or is not the same
      // id as the administrator id
      let targetPlayer = room
        .getPlayerList()
        .find((p: Player) => !p.admin && p.id === pId);

      if (!targetPlayer)
        return room.sendAnnouncement(
          "Esa ID no existe o quiza estas tratando de mutear a un admin!",
          originPlayerId,
          787878,
          "bold",
        );

      this.muted_users.push({
        player: targetPlayer,
        mutedBy: originPlayerId,
        duration: duration,
        mutedAt: Date.now(),
      });

      room.sendAnnouncement(
        `${targetPlayer.name} fue muteado por ${admin.name}`,
        undefined,
        999888,
        "bold",
      );

      setTimeout(() => {
        this.muted_users = this.muted_users.filter(
          (muted) => muted.player.id !== targetPlayer.id,
        );
        room.sendAnnouncement(
          `El muteo de ${targetPlayer.name} ha expirado, ya puede hablar`,
          undefined,
          787878,
          "bold",
        );
      }, duration * 60000);
    }

    unmute(message: string) {
      // Get the ID
      const parts = message.split(" ");
      let pId;
      if (parts.length === 2) {
        pId = parts[1]; // The ID should be the second part after the command
        if (pId.includes("#")) {
          pId = parseInt(pId.replace("#", ""));
        }
      }

      // Get the player that is being unmuted
      const player = room.getPlayerList().find((p: Player) => p.id === pId);

      if (player.admin === true) {
        return;
      }

      let user_to_unmute = this.muted_users.find((p) => p.player.id === pId);
      if (!user_to_unmute || !player) {
        return room.sendAnnouncement(
          `Usuario no encontrado`,
          undefined,
          999888,
          "bold",
        );
      }
      room.sendAnnouncement(
        `${user_to_unmute.player.name} fue desmuteado!`,
        undefined,
        999888,
        "bold",
      );

      let userToUnmuteId = this.find_user_index(user_to_unmute.player.id);
      this.muted_users.splice(userToUnmuteId);
    }
  }

  class EventHandler {
    messages_leaving: string[];
    messages_joining: string[];

    constructor(leaveMessages: string[], joiningMessages: string[]) {
      this.messages_leaving = leaveMessages;
      this.messages_joining = joiningMessages;
    }

    randomMessage(whichMessage: any) {
      return whichMessage[Math.floor(Math.random() * whichMessage.length)];
    }

    playerJoinMessage(player: Player) {
      let randomMessage = this.randomMessage(this.messages_joining);
      room.sendAnnouncement(
        `${player.name} ${randomMessage}`,
        undefined,
        0xff0000,
        "bold",
      );
    }

    playerLeaveMessage(player: Player) {
      let randomMessage = this.randomMessage(this.messages_leaving);
      // Print welcome message
      room.sendAnnouncement(
        `${player.name} ${randomMessage}`,
        undefined,
        0xff0000,
        "bold",
      );
    }

    playerAssist(player: Player) {
      if (lastPlayerTouchedBall) {
        preLastTouchedBall = lastPlayerTouchedBall;
      }
      lastPlayerTouchedBall = player;
    }

    playerGoal(team) {
      const player = players_joined.find(
        (p) => p.name === lastPlayerTouchedBall.name,
      );

      if (player) {
        if (player.team !== team) {
          player.own_goals += 1;
          room.sendAnnouncement(
            `${lastPlayerTouchedBall.name} se hizo un AUTOGOL! JAJAJAJAJA!!!!!`,
            null,
            0xff0000,
          );
        } else {
          room.sendAnnouncement(
            `${lastPlayerTouchedBall.name} hizo un GOLAZO!!!!!`,
            null,
            0xff0000,
          );
          player.goals += 1;
        }
      }
    }

    playerJoined(playerJoined: Player) {
      roomUtils.updateAdmins();
      const player = new Player({
        id: playerJoined.id,
        name: playerJoined.name,
        team: playerJoined.team,
        admin: playerJoined.admin,
        position: playerJoined.position,
        auth: playerJoined.auth,
        conn: playerJoined.conn,
      });
      players_joined.push(player);
      this.playerJoinMessage(playerJoined);
      room.setPlayerTeam(player.id, roomUtils.availableTeam());
    }

    playerLeft(player: Player) {
      players_joined = players_joined.filter((p) => p.name !== player.name);
      roomUtils.updateAdmins();
      resetSinglePlayerStats(player);
      eventHandler.playerLeaveMessage(player);
    }

    teamVictory(score: ScoresObject) {
      let winningTeam: number = 0;
      if (score.red > score.blue) {
        winningTeam = 1;
      } else {
        winningTeam = 2;
      }
      for (let index = 0; index < players_joined.length; index++) {
        const player = players_joined[index];
        if (player.team === winningTeam) {
          player.wins += 1;
        } else if (player.team !== 0) {
          player.loses += 1;
        }
        updatePlayerData(player as Player);
      }
    }

    playerTeamChange(changedPlayer: Player, byPlayer: Player) {
      // If the team's player changes, update the players_joined[player] with the new team
      const player = players_joined.find((p) => p.id === changedPlayer.id);
      if (player) {
        player.team = changedPlayer.team;
      }
    }
  }

  class ChatManager {
    playerChat(player: Player, message: string) {
      message = message.toLowerCase().trim();
      setTimeout(() => {
        // Spam system
        for (let i = 0; i < game.muted_users.length; i++) {
          if (game.muted_users[i].player.name === player.name) {
            return false;
          }
        }

        game.spamFilter(player, message);

        const parts = message.split(" ");

        for (let i = 0; i < messageFunctions.length; i++) {
          if (parts[0] === messageFunctions[i].alias) {
            messageFunctions[i].cmd(message, player);
          }
        }

        if (game.cooldown) {
          room.sendAnnouncement(
            "Debes esperar 10 segundos para enviar otra bandera!",
            player.id,
            2500505,
            "bold",
          );
          return;
        }

        // For each flag in the flags array
        flags.forEach((flag) => {
          // Get the key of every flag
          Object.keys(flag).forEach((key) => {
            if (message == key && !game.cooldown) {
              // If the message is equal to the key, reply with the value
              // associated to that key
              room.sendAnnouncement(`${flag[key]}`, undefined, 323232, "bold");
              game.cooldown = true;
              setTimeout(() => {
                game.cooldown = false;
              }, game.cooldownTime);
            }
          });
        });
      }, 0);
      return true;
    }
  }

  let game = new Game();
  let eventHandler = new EventHandler(
    messages.leave_messages.messages,
    messages.welcome_messages.messages,
  );
  let roomUtils = new RoomUtils(room);
  let chatManager = new ChatManager();

  const flags = [
    { wepa: messages.wepaText },
    { ole: messages.oleText },
    { ole: messages.oleText },
  ];

  const messageFunctions = [
    {
      alias: "!mute",
      description: "Mutea un usuario",
      cmd: game.mute.bind(game),
    },
    {
      alias: "!unmute",
      description: "Desmutea un usuario",
      cmd: game.unmute.bind(game),
    },
    { alias: "!afk", description: "Ir AFK", cmd: game.afk.bind(game) },
    {
      alias: "!register",
      description: "Registrarse",
      cmd: game.register.bind(game),
    },
    {
      alias: "!topgoles",
      description: "Tabla de goleadores",
      cmd: game.top.bind(game),
    },
    {
      alias: "!topautogoles",
      description: "Tabla de personas con mas autogoles",
      cmd: game.top.bind(game),
    },
    {
      alias: "!topasistencias",
      description: "Tabla de personas con mas asistencias",
      cmd: game.top.bind(game),
    },
    {
      alias: "!topwins",
      description: "Tabla de personas con mas partidas ganadas",
      cmd: game.top.bind(game),
    },
    {
      alias: "!topperdidas",
      description: "Tabla de personas con partidas perdidas",
      cmd: game.top.bind(game),
    },
    {
      alias: "!topcs",
      description: "Tabla de mejors arqueros",
      cmd: game.top.bind(game),
    },
    { alias: "!stats", description: "Tus stats", cmd: game.stats.bind(game) },
  ];

  room.onPlayerChat = function(player: Player, message: string) {
    chatManager.playerChat(player, message);
  };

  room.onPlayerBallKick = function(player: Player) {
    eventHandler.playerAssist(player);
  };

  room.onTeamGoal = function(team: TeamID) {
    eventHandler.playerGoal(team);
  };

  room.onPlayerTeamChange = async function(
    changedPlayer: Player,
    byPlayer: Player,
  ) {
    eventHandler.playerTeamChange(changedPlayer, byPlayer);
  };

  room.onGameStart = async function() {
    resetAllPlayerStats();
  };

  room.onRoomLink = function(link) {
    console.log(link);
  };

  room.onPlayerJoin = async function(playerJoined: Player) {
    eventHandler.playerJoined(playerJoined);
  };

  room.onPlayerLeave = function(player: Player) {
    eventHandler.playerLeft(player);
  };

  room.onTeamVictory = async function(score) {
    eventHandler.teamVictory(score);
  };

  async function updatePlayerData(player: Player) {
    const data = {
      type: "update_player_data",
      user: {
        ...player,
      },
      quantity: {
        goals: player?.goals || 0,
        assists: player?.assists || 0,
        loses: player?.loses || 0,
        wins: player?.wins || 0,
        cs: player?.cs || 0,
        own_goals: player?.own_goals || 0,
      },
    };

    webSocket.send(JSON.stringify(data));
  }

  async function getUpdatedDbTop(properties: any) {
    console.log("se obtuvo el top")
    const data = {
      type: "update_top",
      tops: properties[0],
    };
    webSocket.send(JSON.stringify(data));
  }

  async function resetAllPlayerStats() {
    for (let index = 0; index < players_joined.length; index++) {
      let player = players_joined[index];
      player.resetStats();
    }
  }

  async function resetSinglePlayerStats(player_data: Player) {
    let player = players_joined.find((p) => p.id === player_data.id);
    player?.resetStats();
  }
});
