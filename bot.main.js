
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest; //XHR instance

var secret_conf = require("./secret.json")

const Discord = require("discord.js"); //Discord instance
var client = new Discord.Client(); //Discord client

const fs = require("fs");
var config = new Map();

var friend_codes = require("./friend_codes.json")

var dirname = __dirname+"/config/";

fs.readdir(dirname, function(err, filenames) {
    if (err) throw err;
    filenames.forEach(function(filename) {
        fs.readFile(dirname + filename, "utf-8", function(err, content) {
            if (err) throw err;
            if (filename != "0.json") setConfig(filename, content);
        });
    });
});

function setConfig(filename, content) {
    config.set(filename.substring(0, filename.indexOf(".")), JSON.parse(content));
}

function editConfig(msg,conf) {
    if(conf){
        fs.writeFile(
            __dirname+"/config/" + msg.guild.id + ".json",
            JSON.stringify(conf),
            err => {
                if (err) throw err;
                log(msg.guild, "Config updated.");
            }
        );
        return;
    }
    else if (msg == null) {
        return;
    } else if (msg.content.toLowerCase() == "!config") {
        //show config
        var tmp = config.get(msg.guild.id);
        var orga = "";
        for (var i = 0; i < tmp.guild.organizers.length; i++) {
            orga += " " + msg.guild.roles.get(tmp.guild.organizers[i]).name;
        }
        var toorid = "";
        if (tmp.toornament.id != 1523895530663616512) toorid = tmp.toornament.id;
        var text =
        "Config serveur :" +
        "\nCommandes : " +
        msg.guild.channels.get(tmp.guild.cmd) +
        "\nLogs : " +
        msg.guild.channels.get(tmp.guild.log) +
        "\nLeader : " +
        msg.guild.roles.get(tmp.guild.leaders).name +
        "\nOrganisation :" +
        orga +
        "\n\nConfig Toornament :" +
        "\nID : " +
        toorid +
        "\nURL : <" +
        tmp.toornament.url +
        ">" +
        "\nStructure : " +
        tmp.toornament.struct +
        "";
        msg.channel.send(text);
    } else if (msg.content.includes("reset")) {
        //reset config
        fs.readFile("./config/0.json", "utf-8", function(err, content) {
            if (err) throw err;
            content = JSON.parse(content);
            content.guild.id = msg.guild.id;
            content.guild.name = msg.guild.name;
            content = JSON.stringify(content);
            fs.writeFile("./config/" + msg.guild.id + ".json", content, err => {
                if (err) throw err;
                console.log("Reseted configuration for " + msg.guild.name);
            });
        });
    } else if (msg.content.includes("help")) {
        //config help message
        var helptext =
        "```" +
        "\nDétails à propos de la commande !config" +
        "\n!config : affiche la configuration du bot sur ce serveur" +
        "\n!config command <channel> : définit le <channel> d'exécution des commandes. Il faut mentionner <channel>" +
        "\n!config help : affiche cette aide" +
        "\n!config log <channel> : définit le <channel> des logs. Il faut mentionner <channel>" +
        "\n!config struct <structure> : définit la structure du tournoi. Voir la documentation pour plus de détails." +
        "\n!config toornament <url> : définit l'ID du tournoi à partir de l'URL de celui-ci" +
        "\n\nNote : cette commande n'est accessible qu'aux administrateurs et peut être exécutée dans n'importe quel salon." +
        "\n```";
        msg.channel.send(helptext);
    } else {
        if (msg.content.includes("log")) {
            config.get(msg.guild.id).guild.log = msg.mentions.channels.first().id;
        } else if (msg.content.includes("command")) {
            config.get(msg.guild.id).guild.cmd = msg.mentions.channels.first().id;
        } else if (
            msg.content.includes("toornament") ||
            msg.content.includes("tournament")
        ) {
            var url = msg.content.substring(msg.content.indexOf("https://"));
            if (url[url.length - 1] == ">") url[url.length - 1] = "";
            try {
                var id = msg.content.substring(url.lastIndexOf("/"));
                id = id.substring(0, id.indexOf("/"));
                var test = parseInt(id);
            } catch (err) {
                log(
                    "Erreur : l'URL fournie ne permet pas de définir le tournoi en cours."
                );
            }
            var tmp = config.get(msg.guild.id);
            tmp.toornament.id = id;
            tmp.toornament.url = url;
            config.set(msg.guild.id, tmp);
        } else if (msg.content.includes("struct")) {
            var struct = msg.content.substring(15).split(" ");
            var tmp = config.get(msg.guild.id);
            tmp.toornament.struct = struct;
            config.set(msg.guild.id, tmp);
        } else if (msg.content.includes("leader")) {
            config.get(msg.guild.id).guild.leaders = msg.mentions.roles.first().id;
        } else if (msg.content.includes("caster")) {
            var obj = {};
            obj.id = msg.member.id;
            obj.fc = msg.content.substring(8);
            config.get(msg.guild.id).guild.casters.push(obj);
        } else if (msg.content.includes("organizer")) {
            var roles = msg.mentions.roles.array();
            var orga = [];
            for (var i = 0; i < roles.length; i++) {
                orga.push(roles[i].id);
            }
            config.get(msg.guild.id).guild.organizers = orga;
        }
    }
    fs.writeFile(
        __dirname+"/config/" + msg.guild.id + ".json",
        JSON.stringify(config.get(msg.guild.id)),
        err => {
            if (err) throw err;
            log(msg.guild, "Config updated.");
        }
    );
}

var stages = new Map(); //stages of a tournament

//help function
function help(msg) {
    //will be replaced by a RichEmbed for more readability
    var text =
    "Commandes :" +
    "\n```" +
    "\n!cast <team1> <team2> : créé un salon #cast dans la division des deux rôles d'équipe mentionnés; seuls eux et le staff y ont accès" +
    "\n!clearcast : supprime tous les salons #cast" +
    "\n!endandreset : supprime les rôles Dx_Cap ainsi que les salons de division" +
    //'\n!enroute : rend les salons #en-route-pour-la-sX visibles aux équipes' +
    "\n!help : affiche cette aide" +
    "\n!kill <role> [role,...] : retire les rôles mentionnés" +
    "\n!makegr : créé les salons/catégories/rôles de groupe avec les permissions correspondantes" +
    "\n!planif <team1> <team2> <AAAA-MM-JJ> <HH:MM> : planifie un match, le format des dates/horaires doit être celui indiqué; il faut mentionner team1 et team2." +
    "\n!result <team1> <score> <team2> : met le résultat d'un match sur Toornament; il faut mentionner team1 et team2; le score doit être au format 4-2 (exemple)" +
    "\n!setgr : assigne les rôles d'équipes à leur division";
    if (
        msg.member.hasPermission("ADMINISTRATOR") ||
        msg.member.id == secret_conf.MAIN_DEV_ID
    )
    text +=
    "\n" +
    "\nADMIN ONLY" +
    "\n!config : modifier la config du bot. Taper !config help pour plus de détails.";

    msg.channel.send(text + "\n```");
}

//create participant toornament
function createParticipant(guild, participant) {
    var p = {};
    p.name = participant.Equipes;
    // p.lineup=participant.Joueurs.split('\n');
    // for(var i=0;i<p.lineup.length;i++){
    //   p.lineup[i]=p.lineup[i].substring(0,p.lineup[i].indexOf(':')-1);
    // }

    const req = new XMLHttpRequest();
    var url =
    "https://api.toornament.com/organizer/v2/tournaments/" +
    config.get(guild.id).toornament.id +
    "/participants";
    req.open("POST", url);
    req.setRequestHeader("X-Api-Key", "" + secret_conf.TOORNAMENT_TOKEN);
    req.setRequestHeader(
        "Authorization",
        "Bearer " + secret_conf.TOORNAMENT_PAR_AUTHORIZATION
    );
    req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    req.addEventListener("load", function() {
        if (req.status < 200 && req.status >= 400)
        console.error(req.status + " " + req.statusText + " " + url);
    });
    req.addEventListener("error", function() {
        console.error("Error with URL " + url);
    });
    req.addEventListener("readystatechange", function() {
        if (req.readyState === 4) {
            //console.log("Added "+p.name+" to Toornament.");
        }
    });
    req.send('{"name": "' + p.name + '"}');
}

//toornament GET function
function toornamentGet(guild, data, range, callback) {
    const req = new XMLHttpRequest();
    var url =
    "https://api.toornament.com/viewer/v2/tournaments/" +
    config.get(guild.id).toornament.id +
    "/" +
    data;
    req.open("GET", url);
    req.setRequestHeader("X-Api-Key", "" + secret_conf.TOORNAMENT_TOKEN);
    req.setRequestHeader("Range", data + "=" + range);
    req.addEventListener("load", function() {
        if (req.status < 200 && req.status >= 400)
        console.error(req.status + " " + req.statusText + " " + url);
    });
    req.addEventListener("error", function() {
        console.error("Error with URL " + url);
    });
    req.addEventListener("readystatechange", function() {
        if (req.readyState === 4) {
            callback(JSON.parse(req.responseText));
        }
    });
    req.send(null);
}

//return groups id in group phase from a tournament (callback only); for this tournament, only used for divisions
function getGroupsId(guild, stage_id, response) {
    var groups = [];
    var struct = config.get(guild.id).toornament.struct;
    for (var i = 0; i < response.length; i++) {
        if (response[i].stage_id == stage_id) {
            groups.push(response[i].id);
        }
    }
    return groups;
}

//return stages from a tournament (same order as struct, but will be mapped)
function getStages(guild) {
    const req = new XMLHttpRequest();
    var url =
    "https://api.toornament.com/viewer/v2/tournaments/" +
    config.get(guild.id).toornament.id +
    "/stages";
    req.open("GET", url);
    req.setRequestHeader("X-Api-Key", "" + secret_conf.TOORNAMENT_TOKEN);
    req.addEventListener("load", function() {
        if (req.status < 200 && req.status >= 400)
        console.error(req.status + " " + req.statusText + " " + url);
    });
    req.addEventListener("error", function() {
        console.error("Error with URL " + url);
    });
    req.addEventListener("readystatechange", function() {
        if (req.readyState === 4) {
            stages.set(guild.id, JSON.parse(req.responseText));
        }
    });
    req.send(null);
}

//return a stage from its struct id
function getStage(guild, id, struct) {
    return stages.get(guild.id)[struct.indexOf(id)];
}

//get the match to schedule / set the result
function getMatch(team1, team2, data, /*div,*/ guild, callback, range) {
    var struct = config.get(guild.id).toornament.struct.split(" ");
    const req = new XMLHttpRequest();
    var url =
    "https://api.toornament.com/viewer/v2/tournaments/" +
    config.get(guild.id).toornament.id +
    "/matches"/*?stage_numbers=" +
    (struct.indexOf(div) + 1)*/;
    //if (div[0] == struct.indexOf('0')) url += '&group_numbers=' + (div[1] - 2);
    req.open("GET", url);
    req.setRequestHeader("X-Api-Key", "" + secret_conf.TOORNAMENT_TOKEN);
    if (range) req.setRequestHeader("Range", "matches=" + range);
    else req.setRequestHeader("Range", "matches=0-127");
    req.addEventListener("load", function() {
        if (req.status < 200 && req.status >= 400)
        console.error(req.status + " " + req.statusText + " " + url);
    });
    req.addEventListener("error", function() {
        console.error("Error with URL " + url);
    });
    req.addEventListener("readystatechange", function() {
        if (req.readyState === 4) {
            var matches = [];
            try {
                matches = JSON.parse(req.responseText);
            } catch (error) {
                console.error(error);
            }

            var match_id = 0;
            var opponent1;
            var opponent2;
            for (var i = 0; i < matches.length; i++) {
                var opp = matches[i].opponents;

                try {
                    //if (matches[i].status == "pending")
                    if (
                        (opp[0].participant.name.toLowerCase() == team1.toLowerCase() ||
                        opp[0].participant.name.toLowerCase() == team2.toLowerCase()) &&
                        (opp[1].participant.name.toLowerCase() == team1.toLowerCase() ||
                        opp[1].participant.name.toLowerCase() == team2.toLowerCase())
                    ) {
                        //Only search for pending matches
                        //check if match participants are the searched one
                        match_id = matches[i].id;
                        data.stage_id=matches[i].stage_id;
                        opponent1 = opp[0].participant;
                        opponent2 = opp[1].participant;
                        break;
                    }
                } catch (e) {
                    //console.log(matches[i]);
                }
            }
            if (match_id == 0 && (range=="0-127" || !range)) {
                getMatch(team1, team2, data, /*div,*/ guild, callback, "128-255");
            }
            //look first in group phase, then in brackets for some divisions
            // else if (match_id == 0 && div[1] == "G") {
            //     //winner bracket
            //     var divw = div[0] + "A";
            //     getMatch(team1, team2, data, divw, guild, callback);
            //     //loser bracket
            //     var divl = div[0] + "B";
            //     getMatch(team1, team2, data, divl, guild, callback);
            // }
            else {
                callback(data, match_id, team1, team2, guild, opponent1, opponent2);
            }
        }
    });
    try {
        req.send(null);
    } catch (error) {
        console.error(error);
    }
}

//schedule a match
function setPlanif(match_date, match_id, team1, team2, guild, op1, op2) {
    const req = new XMLHttpRequest();
    var url =
    "https://api.toornament.com/organizer/v2/tournaments/" +
    config.get(guild.id).toornament.id +
    "/matches/" +
    match_id;
    req.open("PATCH", url);
    req.setRequestHeader("X-Api-Key", "" + secret_conf.TOORNAMENT_TOKEN);
    req.setRequestHeader(
        "Authorization",
        "Bearer " + secret_conf.TOORNAMENT_RES_AUTHORIZATION
    );
    req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    req.addEventListener("load", function() {
        if (req.status < 200 && req.status >= 400)
        console.error(req.status + " " + req.statusText + " " + url);
    });
    req.addEventListener("error", function() {
        console.error("Error with URL " + url);
    });
    req.addEventListener("readystatechange", function() {
        if (req.readyState === 4) {
            //return JSON.parse(req.responseText);
            switch (req.status) {
                case 400:
                log(guild, "Requête invalide.");
                console.log(url);
                break;
                case 403:
                log(guild, "L'application n'est pas autorisée à accéder au tournoi.");
                break;
                case 404:
                log(guild, "Match non trouvé.");
                break;
                case 500:
                case 503:
                log(guild, "Erreur serveur. Veuillez réessayer plus tard.");
                break;
                default:
                if (match_date)
                log(
                    guild,
                    "Le match entre " +
                    team1 +
                    " et " +
                    team2 +
                    " a été planifié le " +
                    match_date.substring(0, 10) +
                    " à " +
                    match_date.substring(11, 16) +
                    "."
                );
                else
                log(
                    guild,
                    "Le match entre " + team1 + " et " + team2 + " a été annulé."
                );
            }
        }
    });
    console.log(url);
    if (match_date) req.send('{"scheduled_datetime": "' + match_date + '"}');
}

//set match result
function setResult(
    score,
    match_id,
    winner,
    loser,
    guild,
    opponent1,
    opponent2
) {
    const req = new XMLHttpRequest();
    var obj = {};
    var url =
    "https://api.toornament.com/organizer/v2/tournaments/" +
    config.get(guild.id).toornament.id +
    "/matches/" +
    match_id;
    req.open("PATCH", url);
    req.setRequestHeader("X-Api-Key", "" + secret_conf.TOORNAMENT_TOKEN);
    req.setRequestHeader(
        "Authorization",
        "Bearer " + secret_conf.TOORNAMENT_RES_AUTHORIZATION
    );
    req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    req.addEventListener("load", function() {
        if (req.status < 200 && req.status >= 400)
        console.error(req.status + " " + req.statusText + " " + url);
    });
    req.addEventListener("error", function() {
        console.error("Error with URL " + url);
    });
    req.addEventListener("readystatechange", function() {
        if (req.readyState === 4) {
            //return JSON.parse(req.responseText);
            switch (req.status) {
                case 400:
                log(guild, "Requête invalide.");
                console.log(url);
                break;
                case 403:
                log(guild, "L'application n'est pas autorisée à accéder au tournoi.");
                break;
                case 404:
                log(guild, "Match non trouvé.");
                break;
                case 500:
                case 503:
                log(guild, "Erreur serveur. Veuillez réessayer plus tard.");
                break;
                default:
                if (obj.status == "completed") {
                    score = "**" + score[0] + "**-" + score[2];
                    log(
                        guild,
                        "Résultat du match : **" + winner + "** " + score + " " + loser
                    );
                } else {
                    log(
                        guild,
                        "Erreur inconnue. Veuillez contacter " +
                        guild.members.get(secret_conf.MAIN_DEV_ID)
                    );
                }
            }
        }
    });
    if (score) {
        obj.status = "completed";
        if (parseInt(score[0]) < parseInt(score[2])) {
            score = score[2] + "-" + score[0];
        }
        try{
            if (opponent1.name.toLowerCase() == winner.toLowerCase()) {
                opponent1.result = "win";
                opponent2.result = "loss";
                opponent1.score = parseInt(score[0], 10);
                opponent2.score = parseInt(score[2], 10);
            } else if (opponent2.name.toLowerCase() == winner.toLowerCase()) {
                opponent2.result = "win";
                opponent1.result = "loss";
                opponent2.score = parseInt(score[0], 10);
                opponent1.score = parseInt(score[2], 10);
            } else {
                obj.status = "pending";
            }
            obj.opponents = [opponent1, opponent2];
            req.send(JSON.stringify(obj));
        }catch(err){
            log(guild,"Le match n'existe pas ou a déjà été joué.")
        }
    }

}

function cancelMatch(data, match_id, team1, team2, guild) {
    if (data) {
        log(guild, "Données invalides.");
        return;
    }
    const req = new XMLHttpRequest();
    var url =
    "https://api.toornament.com/organizer/v2/tournaments/" +
    config.get(guild.id).toornament.id +
    "/matches/" +
    match_id;
    req.open("PATCH", url);
    req.setRequestHeader("X-Api-Key", "" + secret_conf.TOORNAMENT_TOKEN);
    req.setRequestHeader(
        "Authorization",
        "Bearer " + secret_conf.TOORNAMENT_RES_AUTHORIZATION
    );
    req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    req.addEventListener("load", function() {
        if (req.status < 200 && req.status >= 400)
        console.error(req.status + " " + req.statusText + " " + url);
    });
    req.addEventListener("error", function() {
        console.error("Error with URL " + url);
    });
    req.addEventListener("readystatechange", function() {
        if (req.readyState === 4) {
            //return JSON.parse(req.responseText);
            switch (req.status) {
                case 400:
                log(guild, "Requête invalide.");
                console.log(url);
                break;
                case 403:
                log(guild, "L'application n'est pas autorisée à accéder au tournoi.");
                break;
                case 404:
                log(guild, "Match non trouvé.");
                break;
                case 500:
                case 503:
                log(guild, "Erreur serveur. Veuillez réessayer plus tard.");
                break;
                default:
                log(
                    guild,
                    "Le match entre " + team1 + " et " + team2 + " a été annulé."
                );
            }
        }
    });
    req.send(
        '{"scheduled_datetime":null,"opponents":[{"result":null,"score":null},{"result":null,"score":null}]}'
    );
}

//add a division role to the captains; also set permissions for teams in their division category
function setGroupParticipants(guild, groupsId, divnum) {
    var allcaptains = [];

    var caprole = guild.roles.find("name", "Capitaines");
    var captainmembers = caprole.members.array();

    for (var y = 0; y < groupsId.length; y++) {
        const req = new XMLHttpRequest();
        var url =
        "https://api.toornament.com/viewer/v2/tournaments/" +
        config.get(guild.id).toornament.id +
        "/matches?group_ids=" +
        groupsId[y];
        req.open("GET", url);
        req.setRequestHeader("X-Api-Key", "" + secret_conf.TOORNAMENT_TOKEN);
        req.setRequestHeader("Range", "matches=0-127");
        req.addEventListener("load", function() {
            if (req.status < 200 || req.status >= 400)
            console.error(req.status + " " + req.statusText + " " + url);
        });
        req.addEventListener("error", function() {
            console.error("Error with URL " + url);
        });
        req.addEventListener("readystatechange", function() {
            if (req.readyState === 4) {
                var matches = [];
                try {
                    matches = JSON.parse(req.responseText);
                } catch (error) {
                    matches = [];
                }
                var captains = [];
                var match;
                //returns all captains in a division
                for (var i = 0; i < matches.length; i++) {
                    try {
                        var user1 = matches[i].opponents[0].participant.name;
                        if (!captains.includes(user1)) {
                            captains.push(user1);
                        }
                    } catch (error) {}
                    try {
                        var user2 = matches[i].opponents[1].participant.name;
                        if (!captains.includes(user2)) {
                            captains.push(user2);
                        }
                    } catch (error) {}
                    match = matches[i]; //needed for group_id
                }

                //role assignation
                // var rolename = "D" + divnum + "_Cap";
                //
                // var role = guild.roles.find("name", rolename);
                // //can't do better (for now) because of server structure
                // for (var j = 0; j < 4; j++) {
                //     try {
                //         var nb = 0;
                //         for (var cap_m = 0; cap_m < captainmembers.length; cap_m++) {
                //             var c_roles = [];
                //             if (captains[j]) {
                //                 c_roles = captainmembers[cap_m].roles.array();
                //                 for (var rol = 0; rol < c_roles.length; rol++)
                //                 if (
                //                     c_roles[rol].name
                //                     .toLowerCase()
                //                     .includes(captains[j].toLowerCase())
                //                 ) {
                //                     captainmembers[cap_m].addRole(role);
                //                     nb++;
                //                     break;
                //                 }
                //             }
                //         }
                //     } catch (error) {
                //         console.error(error);
                //     }
                // }

                //permmissions for team roles
                var teams = [];
                for (var i = 0; i < matches.length; i++) {
                    try {
                        var user1 = matches[i].opponents[0].participant.name;
                        if (matches[i].opponents[1].participant)
                        var user2 = matches[i].opponents[1].participant.name;
                        if (!teams.includes(user1)) {
                            teams.push(user1);
                        }
                        if (!teams.includes(user2)) {
                            teams.push(user2);
                        }
                    } catch (e) {}
                }
                var cat = guild.channels.find("name", "DIVISION " + divnum);
                var chan = [];
                var channels = guild.channels.array();
                for (var i = 0; i < channels.length; i++) {
                    if (channels[i].type == "text" && channels[i].parent == cat)
                    chan.push(channels[i]);
                }
                var teamroles = [];
                for (var i = 0; i < teams.length; i++) {
                    try {
                        if (teams[i]) teamroles.push(guild.roles.find("name", teams[i]));
                    } catch (error) {}
                }
                for (var i = 0; i < teamroles.length; i++) {
                    if (teamroles[i]) {
                        cat
                        .overwritePermissions(teamroles[i].id, {
                            VIEW_CHANNEL: true,
                            SEND_MESSAGES: true
                        })
                        .catch(error => console.error(error));
                        for (var a = 0; a < chan.length; a++) {
                            chan[a]
                            .overwritePermissions(teamroles[i], {
                                VIEW_CHANNEL: true,
                                SEND_MESSAGES: true
                            })
                            .catch(error => console.error(error));
                            if (chan[a].name.toLowerCase().startsWith("division")) {
                                chan[a]
                                .overwritePermissions(teamroles[i], {
                                    VIEW_CHANNEL:true,
                                    SEND_MESSAGES: false
                                })
                                .catch(error => console.error(error));
                            }
                        }
                    }
                }
            }
        });
        req.send(null);
    }
}

//create a division channel & role associated
function createGroup(guild, j) {
    var caprole = guild.roles.get(config.get(guild.id).guild.leaders);
    var roles = [
        guild.roles.find("name", "@everyone"),
        guild.roles.find("name", "Staff Ligue"),
        guild.roles.find("name", "Bot")
    ];
    //category creation
    guild
    .createChannel("DIVISION " + j, "category")
    .then(channel =>
        channel.overwritePermissions(roles[0], {
            VIEW_CHANNEL: false
        })
    )
    .then(channel =>
        channel.overwritePermissions(roles[1], {
            VIEW_CHANNEL: true,
            SEND_MESSAGES:true
        })
    )
    .then(channel =>
        channel.overwritePermissions(roles[2], {
            VIEW_CHANNEL: true,
            SEND_MESSAGES: true
        })
    )

    //channels creation
    .then(channel =>
        guild
        .createChannel("division-" + j, "text", [
            {
                id: roles[0],
                denied: ["VIEW_CHANNEL", "SEND_MESSAGES"]
            },
            {
                id: roles[1],
                allow: ["VIEW_CHANNEL","SEND_MESSAGES"]
            },
            {
                id: roles[2],
                allow: ["VIEW_CHANNEL","SEND_MESSAGES"]
            }
        ])
        .then(chan => chan.setParent(channel))
    )
    .then(channel =>
        guild
        .createChannel("div" + j + "-planifications", "text", [
            {
                id: roles[0],
                deny: ["VIEW_CHANNEL"]
            },
            {
                id: roles[1],
                allow: ["VIEW_CHANNEL"]
            },
            {
                id: roles[2],
                allow: ["VIEW_CHANNEL"]
            }
        ])
        .then(chan => chan.setParent(channel.parent))
        .catch(error => console.error(error))
    )
    .then(channel =>
        guild
        .createChannel("div" + j + "-support", "text", [
            {
                id: roles[0],
                deny: ["VIEW_CHANNEL"]
            },
            {
                id: roles[1],
                allow: ["VIEW_CHANNEL"]
            },
            {
                id: roles[2],
                allow: ["VIEW_CHANNEL"]
            }
        ])
        .then(chan => chan.setParent(channel.parent).catch(err=> console.error(err)))
        .catch(error =>console.error(error))
    )
    .then(channel =>
        guild
        .createChannel("div" + j + "-récap-manches", "text", [
            {
                id: roles[0],
                deny: ["VIEW_CHANNEL"]
            },
            {
                id: roles[1],
                allow: ["VIEW_CHANNEL"]
            },
            {
                id: roles[2],
                allow: ["VIEW_CHANNEL"]
            }
        ])
        .then(chan => chan.setParent(channel.parent).catch(err=>console.error(err)))
        .catch(error =>console.error(error))
    )
    .then(channel =>
        guild
        .createChannel("div" + j + "-discussions", "text", [
            {
                id: roles[0],
                deny: ["VIEW_CHANNEL"]
            },
            {
                id: roles[1],
                allow: ["VIEW_CHANNEL"]
            },
            {
                id: roles[2],
                allow: ["VIEW_CHANNEL"]
            }
        ])
        .then(chan => chan.setParent(channel.parent).catch(err=>console.error(err)))
        .catch(error =>console.error(error))
    )

    //division role
    // .then(channel =>
    //     guild
    //     .createRole({
    //         name: "D" + j + "_Cap",
    //         hoist: false,
    //         mentionable: true,
    //         color: "GOLD",
    //         permissions: ["VIEW_CHANNEL", "SEND_MESSAGES"]
    //     })
    //     .then(role => {
    //         console.log(channel.name);
    //         channel.parent.overwritePermissions(role, {
    //             VIEW_CHANNEL: true,
    //             SEND_MESSAGES: true
    //         })
    //     })
    //     .catch(error => {
    //         console.error(error);
    //         console.log(channel.name);
    //     })
    // )
    .catch(error => console.error(error));
}

//get div number function
function getDivNumber(team1, team2, guild) {
    var div;
    //get div roles
    var roles = getDivRoles(guild);
    //get teams members
    var teams = team1.members.array();
    teams=teams.concat(team2.members.array());
    //get captains
    var capitaines = [];
    var caprole = guild.roles.find("name","Capitaines");
    for (var i = 0; i < teams.length; i++) {
        console.log(teams[i].displayName);
        var c_roles = teams[i].roles.array();
        for (var c = 0; c < c_roles.length; c++) {
            if (c_roles[c].name==caprole.name) {
                capitaines.push(teams[i]);
            }
        }
    }
    //get the division
    for (var i = 0; i < capitaines.length; i++) {
        var c_roles = capitaines[i].roles.array();
        //for (var j = 0; j < roles.length; j++) {
        for (var c = 0; c < c_roles.length; c++) {
            if (
                c_roles[c].name.toLowerCase().startsWith("d") &&
                c_roles[c].name.toLowerCase().endsWith("_cap")
            ) {
                div = c_roles[c].name[1];

                break;
            }
            if (div) break;
        }
        //}
        if (div) break;
    }
    console.log(div);
    return div;
}

//get struct division function
function getDiv(team1, team2, guild) {
    var div = getDivNumber(team1, team2, guild)+"";

    var struct = config.get(guild.id).toornament.struct.split(" ");
    for (var a = 0; a < struct.length; a++) {
        if ((struct[a].includes(div) && !struct[a].includes("A") &&! struct[a].includes("B")) ||
        (struct[a][0] <= div && struct[a][1] >= div && struct[a][0] < struct[a][1]) ||
        (struct[a][0] >= div && struct[a][1] <= div && struct[a][0] > struct[a][1])) {
            div = struct[a];
            break;
        }
    }

    return div;
}

//get div roles
function getDivRoles(guild) {
    var struct = config.get(guild.id).toornament.struct.split(" ");
    var roles = [];
    for (var j = 0; j < struct.length; j++) {
        try {
            if (struct[j][1].parseInt() === struct[j][1].parseInt() + 0)
            for (
                var i = struct[j][0].parseInt();
                i <= struct[j][1].parseInt();
                i++
            ) {
                roles.push(guild.roles.find("name", "D" + i + "_Cap"));
            }
        } catch (err) {
            var r = guild.roles.find("name", "D" + struct[j][1] + "_Cap");
            if (r && struct[j][1] != "A" && struct[j][1] != "B") roles.push(r);
        }
    }
    return roles;
}

function feedback(msg) {
    var cat = msg.guild.channels.find("name", "FEEDBACK");

    if (msg.content.includes("save")) {
        var channels = msg.guild.channels.array();
        for (var i = 0; i < channels.length; i++) {
            if (
                channels[i].name.toLowerCase().includes("feedback") &&
                channels[i].type == "text"
            ) {
                channels[i].setParent(cat);
            }
        }
    } else if (msg.content.includes("delete")) {
        var channels = cat.children.array();
        for (var i = 0; i < channels.length; i++) {
            channels[i].delete();
        }
    }
}

//returns today's date
function today() {
    var t = new Date();
    // t.setHours(t.getHours()+2);
    // if(t.getHours()<'2')t.setDate(t.getDate()+1);
    t.setDate(t.getDate() - 1);
    var dd = String(t.getUTCDate()).padStart(2, "0");
    var mm = String(t.getUTCMonth() + 1).padStart(2, "0"); //January is 0!
    var yyyy = t.getUTCFullYear();
    return yyyy + "-" + mm + "-" + dd + "T22:00:00+00:00";
}

function tomorrow() {
    var t = new Date();
    // t.setHours(t.getHours()+2);
    // if(t.getHours()<'2')t.setDate(t.getDate()+1);
    t.setDate(t.getDate() + 0);
    var dd = String(t.getUTCDate()).padStart(2, "0");
    var mm = String(t.getUTCMonth() + 1).padStart(2, "0"); //January is 0!
    var yyyy = t.getUTCFullYear();

    return yyyy + "-" + mm + "-" + dd + "T22:00:00+00:00";
}

function getTodayMatches(guild, m) {
    const req = new XMLHttpRequest();
    var url =
    "https://api.toornament.com/viewer/v2/tournaments/" +
    config.get(guild.id).toornament.id +
    "/matches";
    req.open("GET", url);
    req.setRequestHeader("X-Api-Key", "" + secret_conf.TOORNAMENT_TOKEN);
    req.setRequestHeader("Range", "matches=" + m.length + "-" + (m.length + 126));
    req.addEventListener("load", function() {
        if (req.status < 200 || req.status >= 400)
        console.error(req.status + " " + req.statusText + " " + url);
    });
    req.addEventListener("error", function() {
        console.error("Error with URL " + url);
    });
    req.addEventListener("readystatechange", function() {
        var m2 = [];
        try {
            m2 = JSON.parse(req.responseText);
        } catch (e) {
            m2 = [];
        }
        //		var array=[];
        //		var to=tomorrow();
        //		for(var m=0;m<matches.length;m++){
        //		if(matches[m].scheduled_datetime&&matches[m].scheduled_datetime<to){

        //		}
        //		}

        var matches = m.concat(m2);
        if (matches.length != 0 && matches.length % 128 == 0) {
            getTodayMatches(guild, matches);
        } else {
            setTodayMatches(guild, matches);
        }
    });
    var obj = {};
    obj.scheduled_after = today();
    req.send(JSON.stringify(obj));
}

//convert scheduled_datetime to paris time
function toParisTime(time) {
    var date = time.substring(0, 10).split("-");
    var hour = parseInt(time.substring(11, 13));
    hour += parseInt(secret_conf.UTC);
    if (hour < parseInt(secret_conf.UTC)) {
        date[2] = parseInt(date[2]);
        date[1] = parseInt(date[1]);
        date[0] = parseInt(date[0]);
        switch (date[1]) {
            case 2:
            if (
                (date[2] == 29 && date[0] % 4 == 0) ||
                (date[2] == 28 && date[0] % 4 != 0)
            ) {
                date[1] = 3;
                date[2] = 0;
            }
            break;
            case 4:
            case 6:
            case 9:
            case 11:
            if (date[2] == 30) {
                date[1]++;
                date[2] = 0;
            }
            break;
            case 12:
            if (date[2] == 31) date[1] = 0;
            case 1:
            case 3:
            case 5:
            case 7:
            case 8:
            case 10:
            if (date[2] == 31) {
                date[1]++;
                date[2] = 0;
            }
            break;
        }
        date[2]++;
        if (date[1] < 10) {
            date[1] = "0" + date[1];
        }
        if (date[2] < 10) {
            date[2] = "0" + date[2];
        }
    }
    if (hour < 10) {
        hour = "0" + hour;
    }
    return date.join("-") + "T" + hour + time.substring(13);
}

//edit the message
function setTodayMatches(guild, matches) {
    var conf_match = config.get(guild.id).guild.today;
    if (conf_match) {
        var text = "**Matchs du jour :**\n";
        var num = 0;
        matches.sort(function(a, b) {
            if (a.scheduled_datetime < b.scheduled_datetime) {
                return -1;
            } else if (a.scheduled_datetime > b.scheduled_datetime) {
                return 1;
            } else {
                return 0;
            }
        });
        for (var i = 0; i < matches.length; i++) {
            if (
                matches[i].scheduled_datetime &&
                matches[i].scheduled_datetime.substring(0, 10) >=
                today().substring(0, 10) &&
                matches[i].scheduled_datetime.substring(0, 10) <=
                tomorrow().substring(0, 10)
            ) {
                var team1 = matches[i].opponents[0].participant.name;
                var team2 = matches[i].opponents[1].participant.name;
                var time = toParisTime(matches[i].scheduled_datetime);
                time = time.substring(time.indexOf("T") + 1, time.indexOf("+") - 3);
                text += "\n" + team1 + " vs " + team2 + " à " + time;
                num++;
            }
        }
        if (num == 0) {
            text += "\nAucun match ne se joue aujourd'hui.";
        }
        text +=
        "\n\n**Liste complète des matchs planifiés : **<https://bit.ly/EBTVS10-planif>";
        if (conf_match.channel) {
            var chan = guild.channels.get(conf_match.channel);
            chan
            .fetchMessage(conf_match.msg)
            .then(message => editMessage(message, text));
        }
    }
}

function editMessage(msg, text) {
    msg.edit(text);
}

//log function
function log(guild, content) {
    var logChannel = guild.channels.get(config.get(guild.id).guild.log);
    if (logChannel != null && content != "") {
        return logChannel.send(content);
    }
}

//check cmd channel
function checkCmd(msg) {
    return msg.channel.id == config.get(msg.guild.id).guild.cmd;
}

//set Toornament authorization key in .env file (callback only)
function setToornamentKey(req, type) {
    var res = JSON.parse(req.responseText);
    if (type == "participant")
    secret_conf.TOORNAMENT_PAR_AUTHORIZATION = res.access_token;
    else if (type == "result")
    secret_conf.TOORNAMENT_RES_AUTHORIZATION = res.access_token;
}

//return Toornament authorization key
function getToornamentAuthorization(callback, type) {
    var scope;
    if (type == 0) scope = "participant";
    else if (type == 1) scope = "result";

    const req = new XMLHttpRequest();
    var url = "https://api.toornament.com/oauth/v2/token";
    req.open("POST", url);
    //req.setRequestHeader('X-Api-Key', '' + secret_conf.TOORNAMENT_TOKEN);
    req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    req.addEventListener("load", function() {
        if (req.status < 200 && req.status >= 400)
        console.error(req.status + " " + req.statusText + " " + url);
    });
    req.addEventListener("error", function() {
        console.error("Error with URL " + url);
    });
    req.addEventListener("readystatechange", function() {
        if (req.readyState === 4) {
            callback(req, scope);
        }
    });

    req.send(
        "grant_type=client_credentials&client_id=" +
        secret_conf.TOORNAMENT_ID +
        "&client_secret=" +
        secret_conf.TOORNAMENT_SECRET +
        "&scope=organizer:" +
        scope
    );
}

//create cast channel
function createCast(data, match_id, team1, team2, guild){
    //if(data.match.scheduled_datetime.substring(8,10)==new Date().getDate())
    let div;
    for (var i = 0; i < stages.get(guild.id).length; i++) {
        let s=stages.get(guild.id)[i];
        if(s.id==data.stage_id){
            div=s.name.substring(9);
            break;
        }
    }
    console.log(data);
    let caster = data.caster;

    let t1=guild.roles.find("name",team1);
    let t2=guild.roles.find("name",team2);

    var pb=config.get(guild.id).guild.maps.pickban>=div;
    var text;
    text="Bonjour "+t1+" "+t2+" !"+
    "\n\n"+caster+" va cast votre match";
    //if(argv[3])text+=" de "+argv[3];
    text+=" !";
    var fc=getFC(caster.id,guild);
    if(fc){
        text+="\nMerci de l'ajouter en ami si ce n'est pas déjà fait : **"+fc+"**";
    }else{
        text+="\nMerci de l'ajouter en ami si vous ne l'avez pas.";
    }

    text+="\n\nAvant toute chose, nous avons besoin de connaître quelques détails :"
    +"\nQui sont les filles/garçons dans l'équipe ? Pour éviter de dire il au lieu de elle et inversement."
    +"\nY a-t-il des pseudos difficiles à prononcer ?";

    if(pb){
        text+="\n\nEnfin, guerre de territoire ou de festival ? Si les deux équipes ne sont pas d'accord, ce sera guerre de territoire."
        text+="\n\nA tout à l'heure !";
    }

    var cat = guild.channels.find("name", "DIVISION " + div);
    var roles = [
        guild.roles.find("name", "@everyone"),
        guild.roles.find("name", "Staff Ligue"),
        guild.roles.find("name", "Caster"),
        guild.roles.find("name", "Bot"),
        t1,
        t2
    ];
    guild
    .createChannel(
        ("cast-" + team1 + "-" + team2).substring(0, 32),
        "text",
        [
            {
                id: roles[0],
                denied: ["VIEW_CHANNEL"],
                allow: ["SEND_MESSAGES"]
            },
            {
                id: roles[1],
                allow: ["VIEW_CHANNEL"]
            },
            {
                id: roles[2],
                allow: ["VIEW_CHANNEL"]
            },
            {
                id: roles[3],
                allow: ["VIEW_CHANNEL"]
            },
            {
                id: roles[4],
                allow: ["VIEW_CHANNEL"]
            },
            {
                id: roles[5],
                allow: ["VIEW_CHANNEL"]
            }
        ]
    )
    .then(channel => channel.setParent(cat))
    .then(channel => channel.send(text))
    //.then(channel => {if(showmaps)channel.send(msgmaps)})
    .then(msg => log(guild,"Salon créé : " + msg.channel));
}

function getFC(id,guild){
    try{
        for(var i=0;i<friend_codes.length;i++){
            if(friend_codes[i].id==id)return friend_codes[i].fc;
        }
    }catch(e){

    }
    //log(guild,"Ce membre n'est pas enregistré comme caster.");

}

function getParticipant(guild, pseudo, team, action, newpseudo){
    var struct = config.get(guild.id).toornament.struct.split(" ");
    const req = new XMLHttpRequest();
    var url =
    "https://api.toornament.com/viewer/v2/tournaments/" +
    config.get(guild.id).toornament.id +
    "/participants?name="+team/*?stage_numbers=" +
    (struct.indexOf(div) + 1)*/;
    //if (div[0] == struct.indexOf('0')) url += '&group_numbers=' + (div[1] - 2);
    req.open("GET", url);
    req.setRequestHeader("X-Api-Key", "" + secret_conf.TOORNAMENT_TOKEN);
    req.setRequestHeader("Range", "participants=0-9");
    req.addEventListener("load", function() {
        if (req.status < 200 && req.status >= 400)
        console.error(req.status + " " + req.statusText + " " + url);
    });
    req.addEventListener("error", function() {
        console.error("Error with URL " + url);
    });
    req.addEventListener("readystatechange", function() {
        if (req.readyState === 4) {
            let res = JSON.parse(req.responseText);
            let t;
            for (var i = 0; i < res.length; i++) {
                if(res[i].name.toLowerCase()==team.toLowerCase()){
                    t=res[i];
                    break;
                }
            }

            if(t.id){
                if(action=="n")renameParticipant(guild,t,pseudo,newpseudo);
                else editParticipant(guild,t,pseudo,action);
            }
            else log(guild,"Erreur : l'équipe n'a pas été trouvée.");
        }
    });
    try {
        req.send(null);
    } catch (error) {
        console.error(error);
    }
}

function renameParticipant(guild,team,old_p,new_p){
    let logmessage=old_p+" a été renommé "+new_p+".";
    let lineup=team.lineup;
    var i;
    for (i=0; i < lineup.length; i++) {
        let n=lineup[i].name.split(" (")[0];
        if(n.toLowerCase()==old_p.toLowerCase()){
            if(lineup[i].name.split(" (")[1])lineup[i].name=new_p+" ("+lineup[i].name.split(" (")[1];
            else lineup[i].name=new_p;
            break;
        }
    }
    if(i==lineup.length)return log(guild,"Erreur : le joueur n'est pas chez "+team.name+".")
    team.lineup=lineup;

    let leaders;
    if(team.custom_fields.leaders)leaders=team.custom_fields.leaders;
    else if(team.custom_fields.capitaines) leaders=team.custom_fields.capitaines;
    let l_list=leaders.split(", ");
    if(l_list.includes(old_p)){
        l_list.splice(l_list.indexOf(old_p),1,new_p)
    }
    leaders=l_list.join(", ");
    if(team.custom_fields.leaders)team.custom_fields.leaders=leaders;
    else if(team.custom_fields.capitaines)team.custom_fields.capitaines=leaders;

    patchParticipant(guild,team,logmessage);

}

function editParticipant(guild, team, pseudo, action){

    let logmessage="";

    if("atr".includes(action)){

        let full=pseudo+" ("+action.toUpperCase()+")";

        let lineup=team.lineup;
        var i;
        for (i = 0; i < lineup.length; i++) {
            let n=lineup[i].name.split(" (")[0];
            if(n.toLowerCase()==pseudo.toLowerCase()){
                lineup[i].name=full;
                break;
            }
        }
        if(i==lineup.length && action=="r")return log(guild,"Erreur : "+pseudo+" n'est pas chez "+team.name+".")
        switch(action){
            case 'a':
                logmessage=pseudo+" a été ajouté à "+team.name+".";
                lineup.push({name:full});
                team.lineup=lineup;
                break;
            case 't':
                logmessage=pseudo+" a été transféré à "+team.name+".";
                lineup.push({name:full});
                team.lineup=lineup;
                break;
            case 'r':
                logmessage=pseudo+" a été retiré de "+team.name+".";
                break;
        }
    }
    if("cr".includes(action)){
        var i;
        for (i = 0; i < team.lineup.length; i++){
            if(team.lineup[i].name.split(" (")[0].toLowerCase()==pseudo.toLowerCase())break;
        }
        if(i==team.lineup.length)return log(guild,"Erreur : le joueur n'est pas chez "+team.name+".")
        let leaders;
        if(team.custom_fields.leaders)leaders=team.custom_fields.leaders;
        else if(team.custom_fields.capitaines) leaders=team.custom_fields.capitaines;
        let l_list=leaders.split(", ");
        if(l_list.includes(pseudo)){
            l_list.splice(l_list.indexOf(pseudo),1);
            if(action=="c") logmessage=pseudo+" a été retiré comme capitaine de "+team.name+".";
        }else if(action=="c"){
            l_list.push(pseudo);
            logmessage=pseudo+" a été nommé capitaine de "+team.name+".";
        }
        leaders=l_list.join(", ");
        if(team.custom_fields.leaders)team.custom_fields.leaders=leaders;
        else if(team.custom_fields.capitaines)team.custom_fields.capitaines=leaders;
    }

    patchParticipant(guild,team,logmessage);

}

function patchParticipant(guild,team,logmessage){
    const req = new XMLHttpRequest();
    var obj = {};
    var url =
    "https://api.toornament.com/organizer/v2/tournaments/" +
    config.get(guild.id).toornament.id +
    "/participants/" +
    team.id;
    req.open("PATCH", url);
    req.setRequestHeader("X-Api-Key", "" + secret_conf.TOORNAMENT_TOKEN);
    req.setRequestHeader(
        "Authorization",
        "Bearer " + secret_conf.TOORNAMENT_PAR_AUTHORIZATION
    );
    req.setRequestHeader("Content-Type", "application/json");
    req.addEventListener("load", function() {
        if (req.status < 200 && req.status >= 400)
        console.error(req.status + " " + req.statusText + " " + url);
    });
    req.addEventListener("error", function() {
        console.error("Error with URL " + url);
    });
    req.addEventListener("readystatechange", function() {
        if (req.readyState === 4) {
            //return JSON.parse(req.responseText);
            switch (req.status) {
                case 400:
                log(guild, "Requête invalide.");
                console.log(url);
                break;
                case 403:
                log(guild, "L'application n'est pas autorisée à accéder au tournoi.");
                break;
                case 404:
                log(guild, "Equipe non trouvée.");
                break;
                case 500:
                case 503:
                log(guild, "Erreur serveur. Veuillez réessayer plus tard.");
                break;
                case 200:
                log(guild,logmessage);
                break;
                default:
                log(guild,"Une erreur inconnue est survenue.")
            }
        }
    });
    req.send(JSON.stringify(team));
}

//connection event
client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}.`);
    //alert that the bot has refreshed
    var guilds = client.guilds.array();
    for (var i = 0; i < guilds.length; i++) {
        getStages(guilds[i]);
        getTodayMatches(guilds[i], []);
    }
    //get toornament authorization key
    for (var type = 0; type < 2; type++)
    getToornamentAuthorization(setToornamentKey, type);
});

//message publication event
client.on("message", msg => {
    var guild = msg.guild;
    var m = msg.content;
    try {
        //testing that the command is write in a guild, not in a DM channel
        if (msg.channel.type == "text") {
            //testing the command prefix
            if (m.startsWith("!")) {
                //command used to remove roles from all concerned members
                if (m.toLowerCase().includes("kill") && checkCmd(msg)) {
                    var roles = msg.mentions.roles.array();
                    for (var j = 0; j < roles.length; j++) {
                        var members = guild.roles
                        .find("name", roles[j].name)
                        .members.array();
                        for (var i = 0; i < members.length; i++) {
                            members[i].removeRole(roles[j]);
                        }
                        log(guild, roles[j] + " was removed.");
                    }
                }
                //removes all cast channels
                else if (m.toLowerCase().includes("clearcast") && checkCmd(msg)) {
                    var channels = guild.channels.array();
                    for (var i = 0; i < channels.length; i++) {
                        if (channels[i].name.startsWith("cast-")) channels[i].delete();
                    }
                }
                //CASTS DE PRE SAISON
                else if (m.toLowerCase().includes("!castps") && msg.channel.name=="casts-pré-saison") {
                    var argv = msg.content.split(" ");
                    var team1 = msg.mentions.roles.first();
                    var team2 = msg.mentions.roles.last();
                    // console.log(team1.name);
                    // console.log(team2.name);
                    //var div = getDivNumber(team1, team1, guild);
                    //var div2 = getDivNumber(team2, team2, guild);
                    var caster = msg.author;
                    //var pb=config.get(msg.guild.id).guild.maps.pickban>=div;
                    if(msg.mentions.members.first()) caster=msg.mentions.members.first();

                    //var dcap = guild.roles.find("name","D"+div+"_Cap");

                    var text="";
                    text+="Bonjour "+team1+" "+team2+" !";
                    text+="\n\n"+caster+" va cast votre match";
                    if(argv[3])text+=" de "+argv[3];
                    text+=" !"
                    var fc=getFC(caster.id,msg.guild);
                    if(fc){
                        text+="\nMerci de l'ajouter en ami si ce n'est pas déjà fait : **"+fc+"**";
                    }else{
                        text+="\nMerci de l'ajouter en ami si vous ne l'avez pas, il va vous donner son code ami.";
                    }

                    text+="\n\nAvant toute chose, nous avons besoin de connaître quelques détails :"
                    +"\nQui sont les filles/garçons dans l'équipe ? Pour éviter de dire il au lieu de elle et inversement."
                    +"\nY a-t-il des pseudos difficiles à prononcer ?";

                    var cat = guild.channels.get("754972428807045121");
                    var roles = [
                        guild.roles.find("name", "@everyone"),
                        guild.roles.find("name", "Staff Ligue"),
                        guild.roles.find("name", "Staff Tribune"),
                        guild.roles.find("name", "Caster"),
                        guild.roles.find("name", "Bot"),
                        team1,
                        team2
                    ];

                    guild
                    .createChannel(
                        ("cast-" + team1.name + "-" + team2.name).substring(0, 32),
                        "text",
                        [
                            {
                                id: roles[0],
                                denied: ["VIEW_CHANNEL"]
                            },
                            {
                                id: roles[1],
                                allow: ["VIEW_CHANNEL"]
                            },
                            {
                                id: roles[2],
                                allow: ["VIEW_CHANNEL","SEND_MESSAGES"]
                            },
                            {
                                id: roles[3],
                                allow: ["VIEW_CHANNEL","SEND_MESSAGES"]
                            },
                            {
                                id: roles[4],
                                allow: ["VIEW_CHANNEL","SEND_MESSAGES"]
                            },
                            {
                                id: roles[5],
                                allow: ["VIEW_CHANNEL","SEND_MESSAGES"]
                            },
                            {
                                id: roles[6],
                                allow: ["VIEW_CHANNEL","SEND_MESSAGES"]
                            }
                        ]
                    )
                    .then(channel => channel.send(text))
                    .then(newmessage => newmessage.channel.setParent(cat))
                    .catch(e => console.error(e))
                    //.then(channel => {if(showmaps)channel.send(msgmaps)})
                    ;
                }
                //FIN CASTS DE PRE SAISON
                //create a channel to organise the cast of a match
                else if (m.toLowerCase().includes("!cast") && checkCmd(msg)) {
                    var team1 = msg.mentions.roles.first();
                    var team2 = msg.mentions.roles.last();
                    let obj={};
                    obj.caster=msg.author;
                      getMatch(
                      team1.name,
                      team2.name,
                      obj,
                      guild,
                      createCast
                    );
                    return;

                    var argv = msg.content.split(" ");
                    var team1 = msg.mentions.roles.first();
                    var team2 = msg.mentions.roles.last();
                    // var div = getDivNumber(team1, team1, guild);
                    // var div2 = getDivNumber(team2, team2, guild);
                    /*if (div != div2)*/if (false)
                    msg.channel.send(
                        "Erreur : les deux équipes ne sont pas dans la même division."
                    );
                    else {
                        var caster = msg.author;

                        if(msg.mentions.members.first()) caster=msg.mentions.members.first();

                        //var dcap = guild.roles.find("name","D"+div+"_Cap");

                        var pb=config.get(guild.id).guild.maps.pickban>=div;
                        var text;
                        text="Bonjour "+team1+" "+team2+" !"+
                        "\n\n"+caster+" va cast votre match";
                        if(argv[3])text+=" de "+argv[3];
                        text+=" !"
                        var fc=getFC(caster.id,msg.guild);
                        if(fc){
                            text+="\nMerci de l'ajouter en ami si ce n'est pas déjà fait : **"+fc+"**";
                        }else{
                            text+="\nMerci de l'ajouter en ami si vous ne l'avez pas.";
                        }

                        text+="\n\nAvant toute chose, nous avons besoin de connaître quelques détails :"
                        +"\nQui sont les filles/garçons dans l'équipe ? Pour éviter de dire il au lieu de elle et inversement."
                        +"\nY a-t-il des pseudos difficiles à prononcer ?";

                        if(pb){
                            text+="\n\nEnfin, guerre de territoire ou de festival ? Si les deux équipes ne sont pas d'accord, ce sera guerre de territoire."
                            text+="\n\nA tout à l'heure !";

                            /*if(m.includes("-nm") || m.includes("-no-maps"))text+="";
                            else {

                            var maps=config.get(msg.guild.id).guild.maps;
                            var msgmaps=maps.msg.split("\n");

                            for(var p=0;p<msgmaps.length;p++){
                            if(p>1)msgmaps[p]=msgmaps[p].substring(0,msgmaps[p].indexOf(' - '));
                        }
                        text+="\n\n"+msgmaps.join("\n");

                        text+="\n\n"+maps.img;
                        //}else{
                        text+="\n\n"+config.get(msg.guild.id).guild.maps.msg;
                    }*/

                }

                text+="\n\nA tout à l'heure !";

                //   getMatch(
                //   team1.name,
                //   team2.name,
                //   caster,
                //   div,
                //   guild,
                //   createCast
                // );

                var cat = guild.channels.find("name", "DIVISION " + div);
                console.dir(cat);
                var roles = [
                    guild.roles.find("name", "@everyone"),
                    guild.roles.find("name", "Staff Ligue"),
                    guild.roles.find("name","Caster"),
                    guild.roles.find("name", "Bot"),
                    team1,
                    team2
                ];

                guild
                .createChannel(
                    ("cast-" + team1.name + "-" + team2.name).substring(0, 32),
                    "text",
                    [
                        {
                            id: roles[0],
                            deny: ["VIEW_CHANNEL"]
                        },
                        {
                            id: roles[1],
                            allow: ["VIEW_CHANNEL"]
                        },
                        {
                            id: roles[2],
                            allow: ["VIEW_CHANNEL"]
                        },
                        {
                            id: roles[3],
                            allow: ["VIEW_CHANNEL"]
                        },
                        {
                            id: roles[4],
                            deny: ["VIEW_CHANNEL"]
                        },
                        {
                            id:roles[5],
                            deny:["VIEW_CHANNEL"]
                        }
                    ]
                )
                .then(channel => channel.setParent(cat))
                .then(channel => {if(text)return channel.send(text); else log(guild,"Salon créé : " + channel)})
                .then(msg => {if (msg)log(guild,"Salon créé : " + msg.channel)})
                .catch(e => console.error(e))
                //.then(channel => {if(showmaps)channel.send(msgmaps)})
                ;

            }
        }
        //schedule matches
        else if (m.toLowerCase().includes("planif") && checkCmd(msg)) {
            m = m
            .split("  ")
            .join(" ")
            .split("/")
            .join("-");
            var argv = m.split(" ");

            //match opponents
            var team1 = msg.mentions.roles.first();
            var team2 = msg.mentions.roles.last();
            //search for the division where schedule the match
            //var div = getDiv(team1, team2, guild);

            //get the date if in european format
            var datematch = argv[3];
            if(datematch.length==5){
                var d=new Date();
                datematch+="-"+d.getFullYear();
            }
            if (datematch[2] == "-") {
                datematch =
                datematch.substring(6) +
                "-" +
                datematch.substring(3, 6) +
                datematch.substring(0, 2);
            }
            if (datematch.length == 8) {
                datematch = "20" + datematch;
            }

            //schedule the match
            getMatch(
                team1.name,
                team2.name,
                datematch + "T" + argv[4] + ":00+0" + secret_conf.UTC + ":00",
                /*div,*/
                guild,
                setPlanif
            );
        }
        //cancel match planification & result
        else if (m.toLowerCase().includes("cancel") && checkCmd(msg)) {
            m = m.split("  ").join(" ");
            var argv = m.split(" ");

            //match opponents
            var team1 = msg.mentions.roles.first();
            var team2 = msg.mentions.roles.last();
            //search for the division where schedule the match
            //var div = getDiv(team1, team2, guild);

            //cancel the match
            getMatch(team1.name, team2.name, null, /*div,*/ guild, cancelMatch);
        }
        //set the result of a match
        else if (m.toLowerCase().startsWith("!result") && checkCmd(msg)) {
            m = m.split("  ").join(" ");
            var argv = m.split(" ");
            //match opponents
            var team1 = msg.mentions.roles.first();
            var team2 = msg.mentions.roles.last();
            //search for the division where schedule the match
            if (!argv[1].includes(team1.id)) {
                var t = team1;
                team1 = team2;
                team2 = t;
            }

            //var div = getDiv(team1, team2, guild);
            var score = argv[2];
            if (parseInt(score[0]) < parseInt(score[2])) {
                var t = team1;
                team1 = team2;
                team2 = t;

                t = score[0];
                score = score[2] + "-" + t;
            }

            //set the result
            getMatch(team1.name, team2.name, argv[2], /*div,*/ guild, setResult);
        }
        else if (m.toLowerCase().includes("!joueur") && checkCmd(msg)) {
            m = m
            .split("  ")
            .join(" ")
            var argv = m.split(" ");

            //get the action
            let action=argv[1].toLowerCase()[0];
            if (action=="h"){
                let help="```\n"+
                "!joueur <action> <pseudo> <@Equipe>\n"+
                "!joueur ajout <pseudo> <@Equipe> : permet d'ajouter un joueur\n"+
                "!joueur retrait <pseudo> <@Equipe> : permet de retirer un joueur\n"+
                "!joueur transfert <pseudo> <@Equipe1> <@Equipe2> : permet de transférer un joueur de Equipe1 à Equipe2\n"+
                "!joueur cap <pseudo> <@Equipe> : permet de nommer ou de retirer un capitaine\n"+
                "!joueur nom <pseudo1> <pseudo2> <@Equipe> : permet de renommer le joueur pseudo1 en pseudo2\n"+
                "```";
                return log(guild,help);
            }
            else if (!"acnrt".includes(action))return log(guild,"Erreur : cette action n'existe pas.")

            //team (current, and new in case of transfer)
            var team1;
            var team2;
            try{
                team1 = msg.mentions.roles.first().name;
                team2 = msg.mentions.roles.last().name;
            }catch(e){
                return log(guild,"Erreur : il faut mentionner l'équipe.")
            }
            if(team2==team1 && action=="t")return log(guild,"Erreur : il faut mentionner la nouvelle équipe du joueur.");

            let pseudo1=argv[2];
            let pseudo2;
            if(action=="n"){
                if(argv.length!=5)return log("Erreur : il faut donner deux pseudos (voir !joueur help pour la syntaxe).");
                pseudo2=argv[3];
            }

            if(action=="n"){
                getParticipant(guild, pseudo1, team1, action, pseudo2);
            }
            else if(action=="t"){
                getParticipant(guild, pseudo1, team1, "r");
                getParticipant(guild, pseudo1, team2, "t");
            }else{
                getParticipant(guild, pseudo1, team1, action);
            }
        }
        //creates division roles & categories
        else if (m.toLowerCase().includes("makegr") && checkCmd(msg)) {
            var struct = config.get(guild.id).toornament.struct.split(" ");
            for (var s = 0; s < struct.length; s++) {
                try {
                    if (parseInt(struct[s][1]) === parseInt(struct[s][1]) + 0) {
                        if (parseInt(struct[s][0]) < parseInt(struct[s][1])) {
                            for (
                                var g = parseInt(struct[s][0]);
                                g <= parseInt(struct[s][1]);
                                g++
                            ) {
                                createGroup(guild, g);
                            }
                        } else {
                            for (
                                var g = parseInt(struct[s][1]);
                                g <= parseInt(struct[s][0]);
                                g++
                            ) {
                                createGroup(guild, g);
                            }
                        }
                    } else if (struct[s][1] != "A" && struct[s][1] != "B") {
                        createGroup(guild, struct[s][0]);
                    }
                } catch (err) {
                    console.log(err);
                }
            }
        }
        //A REFAIRE
        else if (m.toLowerCase().includes("feedback") && checkCmd(msg)) {
            feedback(msg);
        }
        //creates specific channels for next season; in dev
        else if (m.toLowerCase().includes("enroute") && checkCmd(msg)) {
            // var channels=guild.channels.array();
            // for (var i = 0; i < channels.length; i++) {
            //	if (channels[i].name.toLowerCase().startsWith('en-route-pour-la') && channels[i].type == 'text') {
            //		channels[i].overwritePermissions(guild.roles.find('name','D'+channels[i].parent.name.substring(9)+'_Cap'), {
            //			VIEW_CHANNEL: true
            //		});
            //	}
            // }
        }
        //set division roles & permissions for team roles; also do some stuff that can't be done by !makegr
        else if (m.toLowerCase().includes("setgr") && checkCmd(msg)) {
            var channels = guild.channels.array();
            for (var i = 0; i < channels.length; i++) {
                if (
                    channels[i].name.toLowerCase().startsWith("division-") &&
                    channels[i].type == "text"
                ) {
                    // channels[i].overwritePermissions(
                    //     guild.roles.find(
                    //         "name",
                    //         "D" + channels[i].parent.name.substring(9) + "_Cap"
                    //     ).id,
                    //     {
                    //         VIEW_CHANNEL: true,
                    //         SEND_MESSAGES: false
                    //     }
                    // );
                }

                if (
                    channels[i].name.toLowerCase().startsWith("div") &&
                    channels[i].name.toLowerCase().includes("récap-manches")
                ) {
                    channels[i]
                    .send(
                        "**TUTO POUR PARTAGER ET POSTER LES RECAP DE MANCHES :** http://bit.ly/2udD5sV"
                    )
                    .then(msg => msg.pin());
                }
                // if (channels[i].name.toLowerCase().startsWith('div') && channels[i].name.toLowerCase().includes('support')) {
                //	channels[i].send('**TUTO POUR PARTAGER ET POSTER LES RECAP DE MANCHES :** http://bit.ly/2udD5sV')
                //		.then(msg => msg.pin())
                // }
            }

            for (var l = 0; l < 15; l++)
            toornamentGet(guild, "groups", "0-49", function(response) {
                var groups = [];
                groups = response;
                var struct = config.get(guild.id).toornament.struct.split(" ");
                for (var s = struct.length - 1; s >= 0; s--) {
                    var groupsId = [];
                    groupsId = getGroupsId(
                        guild,
                        stages.get(guild.id)[s].id,
                        groups
                    );
                    try {
                        if (parseInt(struct[s][1]) === parseInt(struct[s][1]) + 0) {
                            if (parseInt(struct[s][0]) < parseInt(struct[s][1])) {
                                for (
                                    var n = parseInt(struct[s][0]);
                                    n <= parseInt(struct[s][1]);
                                    n++
                                ) {
                                    setGroupParticipants(
                                        guild,
                                        groupsId[n - parseInt(struct[s][0])].split("a"),
                                        n
                                    );
                                }
                            } else {
                                for (
                                    var n = parseInt(struct[s][1]);
                                    n <= parseInt(struct[s][0]);
                                    n++
                                ) {
                                    setGroupParticipants(
                                        guild,
                                        groupsId[parseInt(struct[s][0]) - n].split("a"),
                                        n
                                    );
                                }
                            }
                        } else if (struct[s][1] != "A" && struct[s][1] != "B") {
                            setGroupParticipants(guild, groupsId, struct[s][0]);
                        }
                    } catch (err) {
                        console.log(err);
                        fs.writeFile(__dirname+"/log.txt", err, err => {
                            if (err) throw err;
                        });
                    }
                }
            });
        }
        //end of a tournament; deletes division roles & categories
        else if (m.toLowerCase().includes("endandreset") && checkCmd(msg)) {
            var channels = msg.guild.channels.array();

            for (var i = 0; i < channels.length; i++) {
                if (
                    channels[i].name.toLowerCase().startsWith("division") &&
                    channels[i].type == "category"
                ) {
                    var c = channels[i].children.array();
                    for (var j = 0; j < c.length; j++) {
                        c[j].delete();
                    }

                    channels[i].delete();
                }
                else if(channels[i].name.startsWith("div") && channels[i].type=="text"){
                    channels[i].delete();
                }
            }
            log(guild, "Group channels deleted.");

            // var roles = msg.guild.roles.array();
            // for (var i = 0; i < roles.length; i++) {
            //     if (roles[i].name.includes("_Cap")) {
            //         roles[i].delete();
            //     }
            // }
            // log(guild, "Rôles Dx_Cap supprimés.");

            log(guild, "Done.");
        } else if(m.toLowerCase().includes("!groups") && checkCmd(msg)) {
            try {
                var cat="817080598366519337";
                var nb=parseInt(m.split(" ")[1]);
                for (var i = 1; i <= nb; i++) {
                    var roles = [
                        guild.roles.find("name", "@everyone"),
                        guild.roles.find("name", "Staff Ligue"),
                        guild.roles.find("name", "Bot")
                    ];
                    let a=i;
                    guild.createRole({name:"G"+a})
                    .then(role=>
                    guild
                    .createChannel(
                        ("groupe-"+a),
                        "text",
                        [
                            {
                                id: roles[0],
                                denied: ["VIEW_CHANNEL"]
                            },
                            {
                                id: roles[1],
                                allow: ["VIEW_CHANNEL","SEND_MESSAGES"]
                            },
                            {
                                id: roles[2],
                                allow: ["VIEW_CHANNEL","SEND_MESSAGES"]
                            },
                            {
                                id: role.id,
                                allow: ["VIEW_CHANNEL","SEND_MESSAGES"]
                            }
                        ]
                    )
                    .then(chan => chan.setParent(cat))
                    );
                }
            } catch (e) {

            }

        } else if (m.toLowerCase().includes("cleargroups") && checkCmd(msg)) {
                var channels = guild.channels.array();
                for (var i = 0; i < channels.length; i++) {
                    if (channels[i].name.startsWith("groupe-")) channels[i].delete();
                }
                var roles = guild.roles.array();
                for (var i = 0; i < roles.length; i++) {
                    if (roles[i].name.startsWith("G") && roles[i].name.length<4) roles[i].delete();
                }
        } else if (m.toLowerCase().includes("!participant") && checkCmd(msg)) {
            var url = msg.attachments.first().url;
            var request = require("request");
            request.get(url, function(error, response, body) {
                if (!error && response.statusCode == 200) {
                    var participants = JSON.parse(body);
                    for (var p = 0; p < participants.length; p++) {
                        createParticipant(guild, participants[p]);
                    }
                }
            });
            //END
        }
    }
    if(m.toLowerCase()=="!coffee" || m.toLowerCase()=="!tea" || m.toLowerCase()=="!popcorn"){
        msg.channel.send(":"+m.toLowerCase().substring(1)+":");
    }
    //help command
    if (
        m.toLowerCase().includes("!help") &&
        !msg.author.bot &&
        checkCmd(msg)
    ) {
        help(msg);
    }
    if (m.toLowerCase().startsWith("!test") && !msg.author.bot) {
        msg.channel.send(
            "De nombreux tests sont en cours de réalisation sur le serveur. **ILS SONT BASÉS SUR LA SAISON 10.** Toutes les informations que vous pourriez trouver par rapport au seed **NE DOIVENT PAS ÊTRE PRISES EN COMPTE.** Merci de votre compréhension."
        );
    }
    //response-test command (dev only)
    if (
        m.toLowerCase() == "ping" &&
        msg.author.id == secret_conf.MAIN_DEV_ID
    ) {
        msg.channel.send("pong");
    }
    //get match_id (dev only)
    if (
        m.toLowerCase().startsWith("!getid") &&
        msg.member.id == secret_conf.MAIN_DEV_ID
    ) {
        var argv = m.split(" ");
        //match opponents
        var team1 = msg.mentions.roles.first();
        var team2 = msg.mentions.roles.last();
        //search for the division where schedule the match
        //var div = getDiv(team1, team2, guild);

        //schedule the match
        getMatch(team1.name, team2.name, "", /*div,*/ guild, function(
            data,
            match_id
        ) {
            msg.channel.send(match_id);
        });
    }
    //config
    if (
        msg.content.toLowerCase().includes("!config") &&
        !msg.author.bot &&
        (msg.member.id == secret_conf.MAIN_DEV_ID ||
            msg.member.hasPermission("ADMINISTRATOR"))
        ) {
            editConfig(msg);
        }

        //after messages actions

        //maps/mode saving (doesn't work)
        try{
            if(config.get(msg.guild.id).guild.maps && msg.channel.id==config.get(msg.guild.id).guild.maps.channel &&!msg.author.bot){
                var conf = config.get(msg.guild.id);
                conf.guild.maps.msg=msg.content;

                if(msg.attachments.first()) conf.guild.maps.img=msg.attachments.first().url;
                conf.guild.maps.week=parseInt(msg.content.split(' ')[4]);
                config.set(msg.guild.id,conf)
                editConfig(msg,conf);
            }
        }catch(e){
            console.log(e);
        }

    }

    //debug command (dev only)
    if (
        msg.content.toLowerCase().startsWith("tellme") &&
        msg.author.id == secret_conf.MAIN_DEV_ID
    ) {

}
} catch (error) {
    console.log(error);
    log(msg.guild, msg.member + ", an error as occured.");
}
});

client.on('error',console.error);

function login(client){
    client.login(secret_conf.TOKEN).catch((err)=>{console.error("Retrying...");login(client);});
}

login(client);

setInterval(()=>{
    for (var type = 0; type < 2; type++)
    getToornamentAuthorization(setToornamentKey, type);
},86400000);
