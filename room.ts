import HaxballJS from "haxball.js";
import { PlayerObject } from "./types";
import { WebSocket } from 'ws';
import { MutedUsers } from "./types";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import Dexie from "dexie";

const db = new Dexie("HaxballDatabase", { indexedDB: indexedDB, IDBKeyRange: IDBKeyRange });

HaxballJS.then((HBInit) => {
  const room = HBInit({
    roomName: "dev mode",
    maxPlayers: 8,
    public: false,
    noPlayer: true,
    token: "thr1.AAAAAGdwYaNuALG9cMJhSw.UT7fdlHbM10",
  });

  room.setDefaultStadium("Small");
  room.setScoreLimit(5);
  room.setTimeLimit(0);

  room.onRoomLink = function(link) {
    console.log(link)
  }

  let webSocket = new WebSocket('ws://127.0.0.1:8000/ws');

  function initializeDB() {
    db.version(1).stores({
      goals: '++id, name, goals',
      own_goals: '++id, name, own_goals',
      assists: '++id, name, assists',
      cs: '++id, name, cs',
      wins: '++id, name, wins',
      loses: '++id, name, loses',
    });
  }


  initializeDB();


  webSocket.on('open', () => {
    console.log('Conexión WebSocket abierta');
    getUpdatedDbTop();
  })

  webSocket.on('message', async (event: any) => {
    const response = JSON.parse(event);

    // If response.success if false, send message to the user with the details
    if (!response.success) {
      return room.sendAnnouncement(`${response.detail}`, response.data, 888888)
    }

    // !stats
    if (response.type === 'player_stats' && response.data) {

      try {
        const data: Player = response.data
        let player = players_joined.find((p) => p.name === data.name)
        room.sendAnnouncement(
          `✅:  Wins: ${data.wins} | 😥 Perdidas: ${data.loses} | ⚽ Goles: ${data.goals} | 🤣 Autogoles: ${data.own_goals} | 🦵 Asistencias: ${data.assists} | 🥅 Arcos en cero: ${data.cs}`,
          player.id,
          838388,
          "bold",
          0
        );

        return data
      } catch (err) {
        console.error(err)
      }


    }
    function capitalizeFirstLetter(string) {
      return string.charAt(0).toUpperCase() + string.slice(1);
    }
    // !top
    if (response.type === 'update_top' && response.data) {
      // This is the data that is coming from the backend
      const data = response.data;

      try {
        if (Array.isArray(data)) {
          data.forEach(async (top) => {
            let key = Object.keys(top)[0]
            let value = Object.values(top)[0] as any
            let store = db.table(key);

            if (store) {

              value.map((p) => {
                store.add(
                  {
                    name: p.name,
                    value: p.value
                  }
                ).catch(error => {
                  console.error('Error al agregar datos:', error);
                });
              })

            }
            // store.toCollection().each(function(top) {
            //   console.log(`from store: ${key} found:`, top)
            // })
          });
        }
        // console.log('Datos actualizados en la base de datos:', data);
      } catch (error) {
        console.error('Error al actualizar la base de datos:', error);
      }
    }
  });

  webSocket.on('error', (error) => {
    console.error('Error de WebSocket:', error);
  });

  webSocket.on('close', () => {
    console.log('Conexión WebSocket cerrada');
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
    position: { x: number, y: number }
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
      super()
      this.id = options.id ?? 0;
      this.name = options.name ?? 'Unknown';  // Asegúrate de que 'name' esté presente
      this.team = options.team ?? 0;
      this.admin = options.admin ?? false;
      this.position = options.position ?? null;
      this.auth = options.auth ?? '';
      this.conn = options.conn ?? '';
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
        user: { ...player }
      }

      webSocket.send(JSON.stringify(data))
    }

    async register(message: string, player: Player) {
      const parts = message.split(" ")
      const password = parts[1]

      const player_auth = players_joined?.find((p) => p.id === player.id)?.auth
      const data = {
        type: "register_user",
        user: {
          name: player.name,
          password: password,
          auth: player_auth,
        },
      }

      webSocket.send(JSON.stringify(data))
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
        this.opts.players_chatted.push({ id: player.id, lm: [timestamp], tw: [] });
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
          this.opts.players_chatted[ind].lm.length - this.opts.p.N
        );
      }

      if (
        Array.isArray(this.opts.players_chatted[ind].lm) &&
        this.opts.players_chatted[ind].lm.length >= this.opts.p.N
      ) {
        const timeDiff =
          this.opts.players_chatted[ind].lm[this.opts.players_chatted[ind].lm.length - 1] -
          this.opts.players_chatted[ind].lm[0];
        const messageRate = this.opts.players_chatted[ind].lm.length / (timeDiff / 1000);
        console.log(messageRate);
        if (messageRate > this.opts.p.TM) {
          room.sendAnnouncement(
            `${player.name} escribe mas lento careverga`,
            player.id,
            838388,
            "bold"
          );
          this.opts.players_chatted[ind].tw.push(timestamp);
        }
      }

      if (this.opts.players_chatted[ind].tw.length >= this.opts.p.NW) {
        const warningTimeDiff =
          (this.opts.players_chatted[ind].tw[this.opts.players_chatted[ind].tw.length - 1] -
            this.opts.players_chatted[ind].tw[this.opts.players_chatted[ind].tw.length - 2]) /
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
          "bold"
        );

        room.setPlayerTeam((playerID = player.id), (team = 0));
        return;
      } else {
        room.sendAnnouncement(
          `${player.name} ya regreso, cual video te viste?`,
          undefined,
          585858,
          "bold"
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

    async top(message: string, originPlayer: Player) {
      // [command]: {endpoint, property, label}
      const commandMapping: { [key: string]: { store: string; property: string; label: string } } = {
        "!topgoles": { store: "goals", property: "goals", label: "goles" },
        "!topautogoles": { store: "own_goals", property: "own_goals", label: "autogoles" },
        "!topasistencias": { store: "assists", property: "assists", label: "asistencias" },
        "!topwins": { store: "wins", property: "wins", label: "ganadas" },
        "!topperdidas": { store: "loses", property: "loses", label: "perdidas" },
        "!topcs": { store: "cs", property: "cs", label: "arcos en cero" },
      };

      // Find the commandMapping key (command) that is equal to the message (command)
      const command = Object.keys(commandMapping).find((k) => message.startsWith(k))
      if (!command) return

      const { store, property, label } = commandMapping[command]

      const topPlayers = await db.table(store).limit(7).sortBy(property)
      let messageOutput = topPlayers.map((player) => `${player.name}: ${player.value}`).join("\n")

      room.sendAnnouncement(`Tabla de personas con mas ${label}:\n${messageOutput}`, originPlayer.id, 0xFF0000, "bold");
    }

    mute(message: string, player: Player) {
      const parts = message.split(" ")
      let pId: string | number = parts[2]

      let duration = parseInt(parts[1])


      if (pId.includes("#")) {
        pId = parseInt(pId.replace("#", ""));
      }

      this.validateMuteFormat(parts)
      const originPlayerId = player.id

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
          "bold"
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
        "bold"
      );

      setTimeout(() => {
        this.muted_users = this.muted_users.filter(
          (muted) => muted.player.id !== targetPlayer.id
        );
        room.sendAnnouncement(
          `El muteo de ${targetPlayer.name} ha expirado, ya puede hablar`,
          undefined,
          787878,
          "bold"
        );
      }, duration * 60000);
    }

    unmute(message: string) {
      // Get the ID
      const parts = message.split(" ");
      let pId
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
          "bold"
        );
      }
      room.sendAnnouncement(
        `${user_to_unmute.player.name} fue desmuteado!`,
        undefined,
        999888,
        "bold"
      );

      let userToUnmuteId = this.find_user_index(user_to_unmute.player.id);
      this.muted_users.splice(userToUnmuteId);
    }
  }

  var game = new Game();

  const welcome_messages = {
    messages: [
      "Un nuevo raton ha llegado!",
      "Vienes a jugar o a insultar? Espero que a la segunda.",
      "Unete a nuestro... nah mentira, no tenemos discord.",
    ],
  };

  const leave_messages = {
    messages: [
      "se fue! ya lo mando a dormir la mamita?",
      "tiene que camellar :(.",
    ],
  };

  const wepaText = `
██╗    ██╗███████╗██████╗  █████╗  █████╗  █████╗ 
██║    ██║██╔════╝██╔══██╗██╔══██╗██╔══██╗██╔══██╗
██║ █╗ ██║█████╗  ██████╔╝███████║███████║███████║
██║███╗██║██╔══╝  ██╔═══╝ ██╔══██║██╔══██║██╔══██║
╚███╔███╔╝███████╗██║     ██║  ██║██║  ██║██║  ██║
 ╚══╝╚══╝ ╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝
                                                                  
`;
  const oleText = `
 ██████╗ ██╗     ███████╗███████╗███████╗███████╗
██╔═══██╗██║     ██╔════╝██╔════╝██╔════╝██╔════╝
██║   ██║██║     █████╗  █████╗  █████╗  █████╗  
██║   ██║██║     ██╔══╝  ██╔══╝  ██╔══╝  ██╔══╝  
╚██████╔╝███████╗███████╗███████╗███████╗███████╗
 ╚═════╝ ╚══════╝╚══════╝╚══════╝╚══════╝╚══════╝
                                                                         
`;

  const flags = [{ wepa: wepaText }, { ole: oleText }, { ole: oleText }];

  const messageFunctions = [
    { alias: "!mute", description: "Mutea un usuario", cmd: game.mute.bind(game) },
    {
      alias: "!unmute",
      description: "Desmutea un usuario",
      cmd: game.unmute.bind(game),
    },
    { alias: "!afk", description: "Ir AFK", cmd: game.afk.bind(game) },
    { alias: "!register", description: "Registrarse", cmd: game.register.bind(game) },
    { alias: "!topgoles", description: "Tabla de goleadores", cmd: game.top.bind(game) },
    { alias: "!topautogoles", description: "Tabla de personas con mas autogoles", cmd: game.top.bind(game) },
    { alias: "!topasistencias", description: "Tabla de personas con mas asistencias", cmd: game.top.bind(game) },
    { alias: "!topwins", description: "Tabla de personas con mas partidas ganadas", cmd: game.top.bind(game) },
    { alias: "!topperdidas", description: "Tabla de personas con partidas perdidas", cmd: game.top.bind(game) },
    { alias: "!topcs", description: "Tabla de mejors arqueros", cmd: game.top.bind(game) },
    { alias: "!stats", description: "Tus stats", cmd: game.stats.bind(game) }
  ];

  function playerJoinMessage(player: Player) {
    let m = Math.floor(Math.random() * welcome_messages.messages.length);
    room.sendAnnouncement(
      `${player.name} ${welcome_messages.messages[m]}`,
      undefined,
      0xFF00000,
      "bold"
    );
  }

  function playerLeaveMessage(player: Player) {
    let m = Math.floor(Math.random() * leave_messages.messages.length);
    // Print welcome message
    room.sendAnnouncement(
      `${player.name} ${leave_messages.messages[m]}`,
      undefined,
      0xFF00000,
      "bold"
    );
  }

  // If there are no admins left in the room give admin to one of the remaining players.
  function updateAdmins() {
    // Get all players
    var players = room.getPlayerList();
    if (players.length == 0) return; // No players left, do nothing.
    if (players.find((player: Player) => player.admin) != null) return; // There's an admin left so do nothing.
    room.setPlayerAdmin(players[0].id, true); // Give admin to the first non admin player in the list
  }

  // Get best team to put a player
  // used when !afk a new player joined
  function availableTeam() {
    var players = room.getPlayerList();
    // Get the team that has less players than the other
    // If both teams have the same players, random team
    const redTeam = players.filter((player: Player) => player.team == 1);
    const blueTeam = players.filter((player: Player) => player.team == 2);
    return redTeam.length <= blueTeam.length ? 1 : 2;
  }


  const rankOpts = {
    ranks: {
      Meme: 0,
      Bronze: 5,
      Plata: 15,
      Lamparita: 30,
      Pamparita: 100,
      Estrellita: 150,
      Diva: 200,
    },
  };

  function rankSystem(player) { }

  room.onPlayerChat = async function(player: any, message: string) {
    message = message.toLowerCase().trim();
    setTimeout(() => {
      // Spam system
      for (let i = 0; i < game.muted_users.length; i++) {
        if (game.muted_users[i].player.name === player.name) {
          return false;
        }
      }

      game.spamFilter(player, message);


      const parts = message.split(" ")

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
          "bold"
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

    return true
  };

  let players_joined: Player[] = []
  let lastPlayerTouchedBall: Player;
  let preLastTouchedBall: Player;

  room.onPlayerBallKick = async function(player: Player) {

    if (lastPlayerTouchedBall) {
      preLastTouchedBall = lastPlayerTouchedBall
    }
    lastPlayerTouchedBall = player
  }

  room.onTeamGoal = async function(team: TeamID) {
    const player = players_joined.find((p) => p.name === lastPlayerTouchedBall.name)

    if (player) {
      if (player.team !== team) {
        player.own_goals += 1
        room.sendAnnouncement(`${lastPlayerTouchedBall.name} se hizo un AUTOGOL! JAJAJAJAJA!!!!!`, null, 0xFF0000)

      } else {
        room.sendAnnouncement(`${lastPlayerTouchedBall.name} hizo un GOLAZO!!!!!`, null, 0xFF0000)
        player.goals += 1
      }
    }

  }

  room.onPlayerTeamChange = async function(changedPlayer: Player, byPlayer: Player) {
    // If the team's player changes, update the players_joined[player] with the new team 
    const player = players_joined.find((p) => p.id === changedPlayer.id)
    if (player) {
      player.team = changedPlayer.team
    }
  }

  room.onTeamVictory = async function(score) {
    for (let index = 0; index < players_joined.length; index++) {
      const player = players_joined[index];
      updatePlayerData(player as Player)
    }
  }

  async function updatePlayerData(player: Player) {
    const data = {
      type: "update_player_data",
      user: {
        ...player
      },
      quantity: {
        goals: player?.goals || 0,
        assists: player?.assists || 0,
        loses: player?.loses || 0,
        wins: player?.wins || 0,
        cs: player?.cs || 0,
        own_goals: player?.own_goals || 0
      }
    }

    webSocket.send(JSON.stringify(data))

  }


  async function getUpdatedDbTop() {
    const data = {
      type: "update_top",
      tops: ['goals', 'assists', 'own_goals', 'loses', 'wins', 'cs']
    }

    webSocket.send(JSON.stringify(data))
  }

  async function resetAllPlayerStats() {
    for (let index = 0; index < players_joined.length; index++) {
      let player = players_joined[index];
      player.resetStats()
    }
  }

  async function resetSinglePlayerStats(player_data: Player) {
    let player = players_joined.find((p) => p.id === player_data.id)
    player?.resetStats()
  }

  room.onGameStart = async function() {
    resetAllPlayerStats()
  }



  room.onPlayerJoin = async function(playerJoined: Player) {
    updateAdmins();
    const player = new Player({
      id: playerJoined.id,
      name: playerJoined.name,
      team: playerJoined.team,
      admin: playerJoined.admin,
      position: playerJoined.position,
      auth: playerJoined.auth,
      conn: playerJoined.conn,
    })
    players_joined.push(player)
    playerJoinMessage(playerJoined);
    room.setPlayerTeam(player.id, availableTeam());
  };

  room.onPlayerLeave = function(player: Player) {
    players_joined = players_joined.filter((p) => p.name !== player.name)
    updateAdmins();
    resetSinglePlayerStats(player)
    playerLeaveMessage(player);
  };

});
