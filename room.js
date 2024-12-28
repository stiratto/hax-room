// room.js
import HaxballJS from "haxball.js";
HaxballJS.then(function(HBInit) {
    // Same as in Haxball Headless Host Documentation
    var room = HBInit({
        roomName: "Haxball.JS",
        maxPlayers: 16,
        public: false,
        noPlayer: true,
        token: "thr1.AAAAAGdvOv2euO438pEdgw.CWHeqvlJlgo"
    });
    room.setDefaultStadium("Big");
    room.setScoreLimit(5);
    room.setTimeLimit(0);
    room.onRoomLink = function(link) {
        console.log(link);
    };
});

