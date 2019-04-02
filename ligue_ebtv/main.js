// following lines are needed otherwise the bot will not work
// where your node app starts

// init project
var express = require('express');
var app = express();

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get('/', function(request, response) {
    response.sendFile(__dirname + '/views/index.html');
});

// listen for requests :)
var listener = app.listen(process.env.PORT, function() {
    console.log('Your app is listening on port ' + listener.address().port);
});

//START
const Discord = require("discord.js"); //Discord instance
var client = new Discord.Client(); //Discord client
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest; //XHR instance

var struct = process.env.TSTRUCT.split(' '); //stages order of a tournament; will be replaced by a map
var stages = []; //stages of a tournament
const toto = 'toto'; //debug, because I always forget ''

//help function
function help(msg) {
    //will be replaced by a RichEmbed for more readability
    msg.channel.send('Commandes :' +
        '\n```' +
        '\n!cast <team1> <team2> : créé un salon #cast dans la division des deux rôles d\'équipe mentionnés; seuls eux et le staff y ont accès' +
        '\n!clearcast : supprime tous les salons #cast' +
        '\n!endandreset : supprime les rôles Dx_Cap ainsi que les salons de division' +
        '\n!enroute : rend les salons #en-route-pour-la-sX visibles aux équipes' +
        '\n!help : affiche cette aide' +
        '\n!kill <role> [role,...] : retire les rôles mentionnés' +
        '\n!makegr : créé les salons/catégories/rôles de groupe avec les permissions correspondantes' +
        '\n!planif <team1> <team2> <AAAA-MM-JJ> <HH:MM> : planifie un match, le format des dates/horaires doit être celui indiqué; il faut mentionner team1 et team2.' +
        '\n!setgr : assigne les rôles d\'équipes à leur division' +
        '\n```'
    );

}

//toornament GET function
function toornamentGet(data, range, callback) {
    const req = new XMLHttpRequest();
    var url = 'https://api.toornament.com/viewer/v2/tournaments/' + process.env.TID + '/' + data;
    req.open("GET", url);
    req.setRequestHeader('X-Api-Key', '' + process.env.TOORNAMENT_TOKEN);
    req.setRequestHeader('Range', data + '=' + range);
    req.addEventListener("load", function() {
        if (req.status < 200 && req.status >= 400)
            console.error(req.status + " " + req.statusText + " " + url);
    });
    req.addEventListener("error", function() {
        console.error("Error with URL " + url);
    });
    req.addEventListener('readystatechange', function() {
        if (req.readyState === 4) {
            callback(JSON.parse(req.responseText));
        }
    });
    req.send(null);
}

//return groups id in group phase from a tournament (callback only); for this tournament, only used for divisions
function getGroupsId(response) {
    var groups = [];
    for (var i = 0; i < response.length; i++) {

        if (response[i].stage_id == getStage('0').id)
            groups.push(response[i].id);
    }
    return groups;
}

//return stages from a tournament (same order as struct, but will be mapped)
function getStages() {
    const req = new XMLHttpRequest();
    var url = 'https://api.toornament.com/viewer/v2/tournaments/' + process.env.TID + '/stages';
    req.open("GET", url);
    req.setRequestHeader('X-Api-Key', '' + process.env.TOORNAMENT_TOKEN);
    req.addEventListener("load", function() {
        if (req.status < 200 && req.status >= 400)
            console.error(req.status + " " + req.statusText + " " + url);
    });
    req.addEventListener("error", function() {
        console.error("Error with URL " + url);
    });
    req.addEventListener('readystatechange', function() {
        if (req.readyState === 4) {
            stages = JSON.parse(req.responseText);
        }
    });
    req.send(null);
}

//return a stage from its struct id
function getStage(struct_id) {
    return stages[struct.indexOf(struct_id)];
}

//get the match to schedule
function planif(team1, team2, match_date, div, guild) {
    const req = new XMLHttpRequest();
    var url = 'https://api.toornament.com/viewer/v2/tournaments/' + process.env.TID + '/matches?stage_numbers=' + (parseInt(div[0]) + 1);
    if (div[0] == struct.indexOf('0')) url += '&group_numbers=' + (div[1] - 2);
    console.log(url);
    req.open("GET", url);
    req.setRequestHeader('X-Api-Key', '' + process.env.TOORNAMENT_TOKEN);
    req.setRequestHeader('Range', 'matches=0-127');
    req.addEventListener("load", function() {
        if (req.status < 200 && req.status >= 400)
            console.error(req.status + " " + req.statusText + " " + url);
    });
    req.addEventListener("error", function() {
        console.error("Error with URL " + url);
    });
    req.addEventListener('readystatechange', function() {
        if (req.readyState === 4) {
            var matches = [];
            try {
                matches = JSON.parse(req.responseText);
            } catch (error) {
                console.error(error);
            }
            var match_id = 0;
            for (var i = 0; i < matches.length; i++) {
                var opp = matches[i].opponents;
                try {
                    if (matches[i].status != 'completed') //Only search for pending matches
                        //check if match participants are the searched one
                        if ((opp[0].participant.name.toLowerCase() == team1.toLowerCase() || opp[0].participant.name.toLowerCase() == team2.toLowerCase()) && (opp[1].participant.name.toLowerCase() == team1.toLowerCase() || opp[1].participant.name.toLowerCase() == team2.toLowerCase())) {
                            match_id = matches[i].id;
                            break;
                        }
                } catch (e) {
                    //console.log(matches[i]); 
                }
            }
            //look first in group phase, then in brackets for some divisions
            if (match_id == 0 && div[1] && div[1][1] && div[1][1] == 'P') {
                //winner bracket
                div[1] = div[1][0] + 'W';
                div[0] = struct.indexOf(div[1]);
                planif(team1, team2, match_date, div, guild);
                //loser bracket
                div[1] = div[1][0] + 'L';
                div[0] = struct.indexOf(div[1]);
                planif(team1, team2, match_date, div, guild);
            } else {
                //when the match is found, schedule it
                setPlanif(match_date, match_id, team1, team2, guild);
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
function setPlanif(match_date, match_id, team1, team2, guild) {
    const req = new XMLHttpRequest();
    var url = 'https://api.toornament.com/organizer/v2/tournaments/' + process.env.TID + '/matches/' + match_id;
    req.open("PATCH", url);
    req.setRequestHeader('X-Api-Key', '' + process.env.TOORNAMENT_TOKEN);
    req.setRequestHeader('Authorization', 'Bearer ' + process.env.TOORNAMENT_AUTHORIZATION);
    req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    req.addEventListener("load", function() {
        if (req.status < 200 && req.status >= 400)
            console.error(req.status + " " + req.statusText + " " + url);
    });
    req.addEventListener("error", function() {
        console.error("Error with URL " + url);
    });
    req.addEventListener('readystatechange', function() {
        if (req.readyState === 4) {
            //return JSON.parse(req.responseText);
            switch (req.status) {
                case 400:
                    log(guild, 'Requête invalide.');
                    console.log(url);
                    break;
                case 403:
                    log(guild, 'L\'application n\'est pas autorisée à accéder au tournoi.');
                    break;
                case 404:
                    log(guild, 'Match non trouvé.');
                    break;
                case 500:
                case 503:
                    log(guild, 'Erreur serveur. Veuillez réessayer plus tard.');
                    break;
                default:
                    log(guild, 'Le match entre ' + team1 + ' et ' + team2 + ' a été planifié le ' + match_date.substring(0, 10) + ' à ' + match_date.substring(11, 16));

            }
        }
    });
    req.send('{"scheduled_datetime": "' + match_date + '"}');
}

//add a division role to the captains; also set permissions for teams in their division category
function getGroupParticipants(groupid, guild, groupsId, callback) {
    var allcaptains = [];
    var friend_codes = [];
    var caprole = guild.roles.find('name', 'Capitaines');
    var captainmembers = caprole.members.array();

    for (var y = 0; y < groupsId.length; y++) {
        const req = new XMLHttpRequest();
        var url = 'https://api.toornament.com/viewer/v2/tournaments/' + process.env.TID + '/matches?group_ids=' + groupsId[y];
        req.open("GET", url);
        req.setRequestHeader('X-Api-Key', '' + process.env.TOORNAMENT_TOKEN);
        req.setRequestHeader('Range', 'matches=0-127');
        req.addEventListener("load", function() {
            if (req.status < 200 || req.status >= 400)
                console.error(req.status + " " + req.statusText + " " + url);
        });
        req.addEventListener("error", function() {
            console.error("Error with URL " + url);
        });
        req.addEventListener('readystatechange', function() {
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
                    } catch (error) {

                    }
                    try {
                        var user2 = matches[i].opponents[1].participant.name;
                        if (!captains.includes(user2)) {
                            captains.push(user2);
                        }
                    } catch (error) {

                    }
                    match = matches[i]; //needed for group_id

                }

                //role assignation
                var rolename = 'D';
                var div = 0;
                for (var z = 0; z < groupsId.length; z++) {
                    if (match)
                        if (groupsId[z] == match.group_id) {
                            rolename += (z + 3) + '_Cap';
                            div = (z + 3);
                        }
                }
                var role = guild.roles.find('name', rolename);
                //can't do better (for now) because of server structure
                for (var j = 0; j < 4; j++) {
                    try {
                        var nb = 0;
                        for (var cap_m = 0; cap_m < captainmembers.length; cap_m++) {
                            var c_roles = []
                            if (captains[j]) {
                                c_roles = captainmembers[cap_m].roles.array();
                                for (var rol = 0; rol < c_roles.length; rol++)

                                    if (c_roles[rol].name.toLowerCase().includes(captains[j].toLowerCase())) {
                                        captainmembers[cap_m].addRole(role);
                                        nb++;
                                        break;
                                    }
                            }

                        }

                    } catch (error) {
                        console.error(error);
                    }
                }

                //permmissions for team roles
                var teams = [];
                for (var i = 0; i < matches.length; i++) {
                    var user1 = matches[i].opponents[0].participant.name;
                    var user2 = matches[i].opponents[1].participant.name;
                    if (!teams.includes(user1)) {
                        teams.push(user1);
                    }
                    if (!teams.includes(user2)) {
                        teams.push(user2);
                    }
                }
                var cat = guild.channels.find('name', 'DIVISION ' + div);
                var chan = [];
                var channels = guild.channels.array();
                for (var i = 0; i < channels.length; i++) {
                    if (channels[i].type == 'text' && channels[i].parent == cat) chan.push(channels[i]);
                }
                var teamroles = [];
                for (var i = 0; i < teams.length; i++) {
                    try {
                        if (teams[i])
                            teamroles.push(guild.roles.find('name', teams[i]));
                    } catch (error) {

                    }
                }
                for (var i = 0; i < teamroles.length; i++) {
                    if (teamroles[i]) {
                        cat.overwritePermissions(teamroles[i].id, {
                            VIEW_CHANNEL: true
                        }).catch(error => console.error(error));
                        for (var a = 0; a < chan.length - 1; a++) {
                            chan[a].overwritePermissions(teamroles[i], {
                                VIEW_CHANNEL: true
                            }).catch(error => console.error(error));
                        }
                    }
                }
            }
        });
        req.send(null);
    }
}

//same as above  for 'special stages'
function getOtherDiv(guild) {
    var allcaptains = [];
    var friend_codes = [];
    var caprole = guild.roles.find('name', 'Capitaines');
    var captainmembers = caprole.members.array();
    var stage_number;

    for (var aaa = 0; aaa < 5; aaa++)
        for (var i = 0; i < 5; i++) {
            var div;
            switch (i) {
                case 0:
                    div = '1P';
                    break;
                case 1:
                    div = '2P';
                    break;
                case 2:
                    div = 'K';
                    break;
                case 3:
                    div = '7';
                    break;
                case 4:
                    div = '8';
                    break;
            }
            const req = new XMLHttpRequest();

            var url = 'https://api.toornament.com/viewer/v2/tournaments/' + process.env.TID + '/matches?stage_ids=' + stages[struct.indexOf(div)].id;
            req.open("GET", url);
            req.setRequestHeader('X-Api-Key', '' + process.env.TOORNAMENT_TOKEN);
            req.setRequestHeader('Range', 'matches=0-127');
            req.addEventListener("load", function() {
                if (req.status < 200 || req.status >= 400)
                    console.error(req.status + " " + req.statusText + " " + url);
            });
            req.addEventListener("error", function() {
                console.error("Error with URL " + url);
            });
            req.addEventListener('readystatechange', function() {
                if (req.readyState === 4) {
                    var matches = [];
                    try {
                        try {
                            matches = JSON.parse(req.responseText);
                        } catch (e) {
                            matches = [];
                        }
                        var captains = [];
                        var match;
                        for (var i = 0; i < matches.length; i++) {
                            try {
                                var user1 = matches[i].opponents[0].participant.name;
                                if (!captains.includes(user1)) {
                                    captains.push(user1);
                                }

                                var user2 = matches[i].opponents[1].participant.name;
                                if (!captains.includes(user2)) {
                                    captains.push(user2);
                                }
                            } catch (error) {

                            }
                            match = matches[i];

                        }
                        var new_div;
                        for (var str = 0; str < stages.length; str++) {
                            if (match && stages[str].id == match.stage_id) {
                                new_div = struct[str][0];
                                break;
                            }
                        }

                        var rolename = 'D' + new_div + '_Cap';
                        var role = guild.roles.find('name', rolename);
                        try {
                            for (var j = 0; j < 4; j++) {
                                try {
                                    var nb = 0;
                                    for (var cap_m = 0; cap_m < captainmembers.length; cap_m++) {
                                        var c_roles = []
                                        if (captains[j]) {
                                            c_roles = captainmembers[cap_m].roles.array();
                                            for (var rol = 0; rol < c_roles.length; rol++)

                                                if (c_roles[rol].name.toLowerCase().includes(captains[j].toLowerCase())) {
                                                    captainmembers[cap_m].addRole(role);
                                                    nb++;
                                                    break;
                                                }
                                        }

                                    }

                                } catch (error) {
                                    console.error(error);
                                }
                            }
                        } catch (e) {
                            console.error(e);
                        }

                        var teams = [];
                        for (var i = 0; i < matches.length; i++) {
                            try {
                                var user1 = matches[i].opponents[0].participant.name;
                                if (!teams.includes(user1)) {
                                    teams.push(user1);
                                }
                            } catch (e) {

                            }
                            try {
                                var user2 = matches[i].opponents[1].participant.name;
                                if (!teams.includes(user2)) {
                                    teams.push(user2);
                                }
                            } catch (e) {

                            }
                        }
                        var cat = guild.channels.find('name', 'DIVISION ' + new_div);
                        var chan = [];
                        var channels = guild.channels.array();
                        for (var i = 0; i < channels.length; i++) {
                            if (channels[i].type == 'text' && channels[i].parent == cat) chan.push(channels[i]);
                        }
                        var teamroles = [];
                        for (var i = 0; i < teams.length; i++) {
                            try {
                                if (teams[i])
                                    teamroles.push(guild.roles.find('name', teams[i]));
                            } catch (error) {

                            }
                        }
                        try {
                            for (var i = 0; i < teamroles.length; i++) {
                                if (teamroles[i]) {
                                    cat.overwritePermissions(teamroles[i].id, {
                                        VIEW_CHANNEL: true
                                    }).catch(error => console.error(error));
                                    for (var a = 0; a < chan.length - 1; a++) {
                                        chan[a].overwritePermissions(teamroles[i].id, {
                                            VIEW_CHANNEL: true
                                        }).catch(error => console.error(error));
                                    }
                                }
                            }
                        } catch (e) {
                            console.error(e);
                        }

                    } catch (error) {
                        console.error(error);
                    }
                }
            });
            req.send(null);
        }
}

//create a division channel & role associated
function createGroup(guild, j) {

    var caprole = guild.roles.find('name', 'Capitaines');
    var roles = [guild.roles.find('name', '@everyone'), guild.roles.find('name', 'Organisation'), guild.roles.find('name', 'Diffusion'), guild.roles.find('name', 'Bot')];
    //category creation
    guild.createChannel('DIVISION ' + j, 'category')
        .then(channel => channel.overwritePermissions(roles[0], {
            VIEW_CHANNEL: false
        }))
        .then(channel => channel.overwritePermissions(roles[1], {
            VIEW_CHANNEL: true
        }))
        .then(channel => channel.overwritePermissions(roles[2], {
            VIEW_CHANNEL: true
        }))
        .then(channel => channel.overwritePermissions(roles[3], {
            VIEW_CHANNEL: true
        }))

        //channels creation
        .then(channel => guild.createChannel('division-' + j, 'text', [{
                id: roles[0],
                denied: ['VIEW_CHANNEL', 'SEND_MESSAGES']
            }, {
                id: roles[1],
                allow: ['VIEW_CHANNEL']
            }, {
                id: roles[2],
                allow: ['VIEW_CHANNEL']
            }, {
                id: roles[3],
                allow: ['VIEW_CHANNEL']
            }])
            .then(chan => chan.setParent(channel)))
        .then(channel => guild.createChannel('div' + j + '-planifications', 'text', [{
                id: roles[0],
                deny: ['VIEW_CHANNEL'],
            }, {
                id: roles[1],
                allow: ['VIEW_CHANNEL']
            }, {
                id: roles[2],
                allow: ['VIEW_CHANNEL']
            }, {
                id: roles[3],
                allow: ['VIEW_CHANNEL']
            }])
            .then(chan => chan.setParent(channel.parent)))
        .then(channel => guild.createChannel('div' + j + '-support', 'text', [{
                id: roles[0],
                deny: ['VIEW_CHANNEL'],
            }, {
                id: roles[1],
                allow: ['VIEW_CHANNEL']
            }, {
                id: roles[2],
                allow: ['VIEW_CHANNEL']
            }, {
                id: roles[3],
                allow: ['VIEW_CHANNEL']
            }])
            .then(chan => chan.setParent(channel.parent)))
        .then(channel => guild.createChannel('div' + j + '-récap-manches', 'text', [{
                id: roles[0],
                deny: ['VIEW_CHANNEL'],
            }, {
                id: roles[1],
                allow: ['VIEW_CHANNEL']
            }, {
                id: roles[2],
                allow: ['VIEW_CHANNEL']
            }, {
                id: roles[3],
                allow: ['VIEW_CHANNEL']
            }])
            .then(chan => chan.setParent(channel.parent)))

        //division role
        .then(channel => guild.createRole({
                name: 'D' + j + '_Cap',
                hoist: false,
                mentionable: true,
                color: 'GOLD',
                permissions: ['VIEW_CHANNEL', 'SEND_MESSAGES']
            }).then(role => channel.parent.overwritePermissions(role, {
                VIEW_CHANNEL: true,
                SEND_MESSAGE: true
            }))
            .catch(error => console.error(error)))
        .catch(error => console.error(error));
}

//log function
function log(guild, content) {
    var logChannel = guild.channels.find('name', 'logs-ligue-ebtv');
    if (logChannel != null) {
        logChannel.send(content);
    }
}

//set Toornament authorization key in .env file (callback only)
function setToornamentKey(res) {
    process.env.TOORNAMENT_AUTHORIZATION = res.access_token;
}

//return Toornament authorization key
function getToornamentAuthorization(callback) {
    const req = new XMLHttpRequest();
    var url = 'https://api.toornament.com/oauth/v2/token';
    req.open("POST", url);
    //req.setRequestHeader('X-Api-Key', '' + process.env.TOORNAMENT_TOKEN);
    req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    req.addEventListener("load", function() {
        if (req.status < 200 && req.status >= 400)
            console.error(req.status + " " + req.statusText + " " + url);
    });
    req.addEventListener("error", function() {
        console.error("Error with URL " + url);
    });
    req.addEventListener('readystatechange', function() {
        if (req.readyState === 4) {
            var response = JSON.parse(req.responseText);
            callback(response);

        }
    });
    req.send('grant_type=client_credentials&client_id=' + process.env.TOORNAMENT_ID + '&client_secret=' + process.env.TOORNAMENT_SECRET + '&scope=organizer:result');
}

//connection event
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}.`);
    //alert that the bot has refreshed
    var guilds = client.guilds.array();
    for (var i = 0; i < guilds.length; i++) {
        if (process.env.INDEV) {
            log(guilds[i], 'Bot refreshed. (in development)');
        } else {
            log(guilds[i], 'Bot refreshed.');
        }
    }
    //get toornament authorization key
    getToornamentAuthorization(setToornamentKey);
    //get order for a global tournament
    getStages();
});

//message publication event
client.on('message', msg => {
    var guild = msg.guild;
    var m = msg.content;
    try {
        //testing that the command is write in a guild, not in a DM channel
        if (msg.channel.type == 'text') {
            //testing the command prefix
            if ((m.startsWith('!'))) {
                //command used to remove roles from all concerned members
                if (m.toLowerCase().includes('kill') && msg.channel.name == 'cmd-bot') {
                    var roles = msg.mentions.roles.array();
                    for (var j = 0; j < roles.length; j++) {
                        var members = guild.roles.find('name', roles[j].name).members.array();
                        for (var i = 0; i < members.length; i++) {
                            members[i].removeRole(roles[j]);
                        }
                        log(guild, roles[j] + ' was removed.');
                    }
                }
                //removes all cast channels
                else if (m.toLowerCase().includes('clearcast') && msg.channel.name == 'cmd-bot') {
                    var channels = guild.channels.array();
                    for (var i = 0; i < channels.length; i++) {
                        if (channels[i].name.startsWith('cast')) channels[i].delete();
                    }

                }
                //create a channel to organise the cast of a match
                else if (m.toLowerCase().includes('cast') && msg.channel.name == 'cmd-bot') {
                    var team1 = msg.mentions.roles.first();
                    var team2 = msg.mentions.roles.last();
                    var div;
                    var div_tmp;
                    var err;
                    var r;
                    var roles = [];
                    for (var j = 0; j < 20; j++) {
                        var r = guild.roles.find('name', 'D' + (j + 1) + '_Cap');
                        if (r) roles.push(r);
                    }
                    roles.push(guild.roles.find('name', 'DK_Cap'));
                    var rol = msg.mentions.roles.array();
                    var teams = [];
                    for (var i = 0; i < rol.length; i++) {
                        var mem = rol[i].members.array();
                        for (var j = 0; j < mem.length; j++) {
                            teams.push(mem[j]);
                        }
                    }
                    for (var i = 0; i < teams.length; i++) {
                        var r = teams[i].roles.array();
                        for (var j = 0; j < r.length; j++) {
                            for (var k = 0; k < roles.length; k++) {
                                if (r[j].name == roles[k].name) {
                                    div = r[j].name[1];

                                    if (!div_tmp) div_tmp = div;
                                    if (div_tmp != div) {
                                        err = 1;
                                        break;
                                    }
                                }
                            }
                            if (err) break;
                        }
                        if (err) break;
                    }

                    if (err) msg.channel.send('Erreur : les deux équipes ne sont pas dans la même division.');
                    else {
                        var cat = guild.channels.find('name', 'DIVISION ' + div);
                        var roles = [guild.roles.find('name', '@everyone'), guild.roles.find('name', 'Organisation'), guild.roles.find('name', 'Diffusion'), guild.roles.find('name', 'Bot'), team1, team2];
                        guild.createChannel(('cast-' + team1.name + '-' + team2.name).substring(0, 32), 'text', [{
                                id: roles[0],
                                denied: ['VIEW_CHANNEL']
                            }, {
                                id: roles[1],
                                allow: ['VIEW_CHANNEL']
                            }, {
                                id: roles[2],
                                allow: ['VIEW_CHANNEL']
                            }, {
                                id: roles[3],
                                allow: ['VIEW_CHANNEL']
                            }, {
                                id: roles[4],
                                allow: ['VIEW_CHANNEL']
                            }, {
                                id: roles[5],
                                allow: ['VIEW_CHANNEL']
                            }])
                            .then(channel => channel.setParent(cat));
                    }

                }
                //schedule matches
                else if (m.toLowerCase().includes('planif') && msg.channel.name == 'cmd-bot') {
                    m.replace('  ', ' '); //main cause of error atm
                    var argv = m.split(' ');
                    //match opponents
                    var team1 = msg.mentions.roles.first();
                    var team2 = msg.mentions.roles.last();
                    //search for the division where schedule the match
                    var div;
                    //get div roles
                    var roles = [];
                    for (var j = 0; j < 20; j++) {
                        var r = guild.roles.find('name', 'D' + (j + 1) + '_Cap');
                        if (r)
                            roles.push(r);
                    }
                    roles.push(guild.roles.find('name', 'DK_Cap'));
                    //get teams members
                    var teams = msg.mentions.roles.first().members.array();
                    teams.concat(msg.mentions.roles.last().members.array());
                    //get captains
                    var capitaines = [];
                    for (var i = 0; i < teams.length; i++) {
                        var c_roles = teams[i].roles.array();
                        for (var c = 0; c < c_roles.length; c++) {
                            if (c_roles[c] == guild.roles.find('name', 'Capitaines')) {
                                capitaines.push(teams[i]);

                            }
                        }
                    }
                    //get the division
                    for (var i = 0; i < capitaines.length; i++) {
                        var c_roles = capitaines[i].roles.array();
                        for (var j = 0; j < roles.length; j++) {
                            for (var c = 0; c < c_roles.length; c++) {
                                if (c_roles[c].name.toLowerCase() == roles[j].name.toLowerCase()) {
                                    div = roles[j].name[1];
                                    break;
                                }
                                if (div) break;
                            }
                        }
                        if (div) break;
                    }
                    //get struct equivalent of division & eventually put the division
                    var group_n = [];
                    switch (div) {
                        case 'K':
                            group_n.push(struct.indexOf('K'));
                            group_n.push('K');
                            break;
                        case '1':
                        case '2':
                            group_n.push(struct.indexOf(div + 'P'));
                            break;
                        case '7':
                        case '8':
                            group_n.push(struct.indexOf(div));
                            group_n.push(div);
                            break;
                        default:
                            group_n.push(struct.indexOf('0'));
                            group_n.push(div);
                    }
                    //schedule the match
                    planif(team1.name, team2.name, argv[3] + 'T' + argv[4] + ':00+02:00', group_n, guild);

                }
                //creates division roles & categories
                else if (m.toLowerCase().includes('makegr') && msg.channel.name == 'cmd-bot') {
                    toornamentGet('groups', '0-49', function(response) {
                        createGroup(guild, 'K');
                        createGroup(guild, 1);
                        createGroup(guild, 2);
                        var groupsId = [];
                        groupsId = getGroupsId(response);
                        for (var i = 0; i < groupsId.length; i++) {
                            createGroup(guild, i + 3);
                        }
                        createGroup(guild, 7);
                        createGroup(guild, 8);

                    });

                }
                //creates specific channels for next season; in dev
                else if (m.toLowerCase().includes('enroute') && msg.channel.name == 'cmd-bot') {
                    // var channels=guild.channels.array();
                    // for (var i = 0; i < channels.length; i++) {
                    //     if (channels[i].name.toLowerCase().startsWith('en-route-pour-la') && channels[i].type == 'text') {
                    //         channels[i].overwritePermissions(guild.roles.find('name','D'+channels[i].parent.name.substring(9)+'_Cap'), {
                    //             VIEW_CHANNEL: true
                    //         });
                    //     }
                    // }

                }
                //set division roles & permissions for team roles; also do some stuff that can't be done by !makegr
                else if (m.toLowerCase().includes('setgr') && msg.channel.name == 'cmd-bot') {

                    var channels = guild.channels.array();
                    for (var i = 0; i < channels.length; i++) {
                        if (channels[i].name.toLowerCase().startsWith('division-') && channels[i].type == 'text') {

                            channels[i].overwritePermissions(guild.roles.find('name', 'D' + channels[i].parent.name.substring(9) + '_Cap').id, {
                                VIEW_CHANNEL: true,
                                SEND_MESSAGES: false
                            });

                        }

                        if (channels[i].name.toLowerCase().startsWith('div') && channels[i].name.toLowerCase().includes('récap-manches')) {
                            channels[i].send('**TUTO POUR PARTAGER ET POSTER LES RECAP DE MANCHES :** http://bit.ly/2udD5sV')
                                .then(msg => msg.pin())
                        }

                    }

                    toornamentGet('groups', '0-49', function(response) {
                        var groupsId = [];
                        groupsId = getGroupsId(response);

                        for (var i = 0; i < 15; i++) {
                            getGroupParticipants(groupsId[0], guild, groupsId, function(friend_codes) {

                            });
                            getOtherDiv(guild);
                        }

                    });

                }
                //end of a tournament; deletes division roles & categories
                else if (m.toLowerCase().includes('endandreset') && msg.channel.name == 'cmd-bot') {
                    var channels = msg.guild.channels.array();

                    for (var i = 0; i < channels.length; i++) {
                        if (channels[i].name.toLowerCase().startsWith('division') && channels[i].type == 'category') {
                            var c = channels[i].children.array();
                            for (var j = 0; j < c.length; j++) {
                                c[j].delete();
                            }

                            channels[i].delete();

                        }
                    }
                    log(guild, 'Group channels deleted.');
                    var roles = msg.guild.roles.array();
                    for (var i = 0; i < roles.length; i++) {
                        if (roles[i].name.includes('_Cap')) {
                            roles[i].delete();

                        }
                    }
                    log(guild, 'Rôles Dx_Cap supprimés.');

                    log(guild, 'Done.');
                }
            }
            //help command
            if (m.toLowerCase().includes('help') && !msg.author.bot && msg.channel.name == 'cmd-bot') {
                console.log('Help command.');
                help(msg);
            }
            //response-test command (dev only)
            if (m.toLowerCase() == 'ping' && msg.member.id == process.env.MAIN_DEV_ID) {
                msg.channel.send('pong');
            }
            //debug command (dev only)
            if (msg.content.toLowerCase() == 'tellme' && msg.member.id == process.env.MAIN_DEV_ID) {
                var v = guild.roles.array();
                for (var i = 0; i < v.length; i++) {
                    try {
                        v[i].setMentionable(true);
                    } catch (e) {}
                }
            }
            //don't ask
            if (msg.content.toLowerCase() == '!coffee' || msg.content.toLowerCase() == '!popcorn') {
                msg.channel.send(':' + msg.content.substring(1) + ':');
            }

        }

    } catch (error) {
        console.log(error);
        log(msg.guild, msg.member + ', an error as occured.');
    }

});

client.login(process.env.TOKEN);
