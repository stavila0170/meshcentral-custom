const fs = require('fs');
const path = require('path');

const root = '/opt/meshcentral/meshcentral';


//
// ============================================================
// 1. SERVER - adaugam comanda "sessiontimeline"
// ============================================================
//

const meshuserFile = path.join(root, 'meshuser.js');

let meshuser = fs.readFileSync(meshuserFile, 'utf8');

if (!meshuser.includes('function serverCommandSessionTimeline(command)')) {

    const marker = '    function serverCommandPowerTimeline(command) {';

    if (!meshuser.includes(marker)) {
        throw new Error('Nu am gasit serverCommandPowerTimeline in meshuser.js');
    }

    const sessionFunction = `
    // AMT Centru - User Session State Timeline
    function serverCommandSessionTimeline(command) {
        parent.GetNodeWithRights(domain, user, command.nodeid, function (node, rights, visible) {

            if ((visible == false) || (node == null)) return;

            // Evenimentele sunt salvate de win-session-state-tracker
            // ca Agent Logs: AMT_SESSIONSTATE|LOCKED etc.
            db.GetNodeEventsWithLimit(
                node._id,
                domain.id,
                50000,
                'agentlog',
                function (err, docs) {

                    var timeline = [];

                    if ((err == null) && (docs != null)) {

                        // GetNodeEventsWithLimit returneaza DESC.
                        // Pentru timeline avem nevoie ASC.
                        for (var i = docs.length - 1; i >= 0; i--) {

                            var doc = docs[i];

                            if (typeof doc.msg != 'string') continue;
                            if (doc.msg.indexOf('AMT_SESSIONSTATE|') !== 0) continue;

                            var state = doc.msg.substring(17);

                            if (
                                (state != 'RESET') &&
                                (state != 'LOCKED') &&
                                (state != 'UNLOCKED') &&
                                (state != 'NOUSER')
                            ) {
                                continue;
                            }

                            var t;

                            if (doc.time instanceof Date) {
                                t = doc.time.getTime();
                            } else {
                                t = Date.parse(doc.time);
                            }

                            if (isNaN(t) == false) {
                                timeline.push([t, state]);
                            }
                        }
                    }

                    obj.send({
                        action: 'sessiontimeline',
                        nodeid: node._id,
                        timeline: timeline,
                        tag: command.tag
                    });
                }
            );
        });
    }

`;

    meshuser = meshuser.replace(
        marker,
        sessionFunction + marker
    );
}


// Inregistram comanda in tabela serverCommands
if (!meshuser.includes("'sessiontimeline': serverCommandSessionTimeline")) {

    const marker =
        "'powertimeline': serverCommandPowerTimeline,";

    if (!meshuser.includes(marker)) {
        throw new Error('Nu am gasit powertimeline in serverCommands');
    }

    meshuser = meshuser.replace(
        marker,
        marker + "\n        'sessiontimeline': serverCommandSessionTimeline,"
    );
}

fs.writeFileSync(meshuserFile, meshuser);

console.log('OK: meshuser.js modificat');


//
// ============================================================
// 2. WEB UI - adaugam al doilea timeline
// ============================================================
//

const viewsDir = path.join(root, 'views');

const viewFiles = [];

function addViewFiles(dir) {
    if (!fs.existsSync(dir)) return;

    for (const name of fs.readdirSync(dir)) {
        if (name.endsWith('.handlebars') && !name.includes('-min')) {
            viewFiles.push(path.join(dir, name));
        }
    }
}

addViewFiles(viewsDir);
addViewFiles(path.join(viewsDir, 'translations'));

let patchedViews = 0;


for (const filename of viewFiles) {

    const name = path.relative(viewsDir, filename);

    let data = fs.readFileSync(filename, 'utf8');

    // Ne intereseaza numai template-ul care contine timeline-ul existent.
    if (!data.includes('function drawDeviceTimeline()')) {
        continue;
    }

    console.log('Patch timeline in:', name);


    //
    // Variabile pentru timeline-ul de sesiune
    //
    if (!data.includes('var sessionTimelineNode = null;')) {

        const marker = '        var powerTimeline = null;';

        if (!data.includes(marker)) {
            throw new Error(
                'Nu am gasit variabila powerTimeline in ' + name
            );
        }

        data = data.replace(
            marker,
            marker + `
        var sessionTimelineNode = null;
        var sessionTimelineReq = null;
        var sessionTimeline = null;`
        );
    }


    //
    // Primim raspunsul sessiontimeline de la server
    //
    if (!data.includes("case 'sessiontimeline':")) {

        const marker = "                case 'getsysinfo': {";

        if (!data.includes(marker)) {
            throw new Error(
                'Nu am gasit case getsysinfo in ' + name
            );
        }

        const code = `
                case 'sessiontimeline': {
                    if (message.nodeid != sessionTimelineReq) break;

                    sessionTimelineNode = message.nodeid;

                    if (Array.isArray(message.timeline)) {
                        sessionTimeline = message.timeline;
                    } else {
                        sessionTimeline = [];
                    }

                    if (
                        (currentNode != null) &&
                        (currentNode._id == message.nodeid)
                    ) {
                        drawDeviceTimeline();
                    }

                    break;
                }

`;

        data = data.replace(
            marker,
            code + marker
        );
    }


    //
    // Cand cerem Power Timeline, cerem si Session Timeline.
    // Astfel se actualizeaza si automat aproximativ la 5 minute.
    //
    if (!data.includes("sessionTimelineReq = currentNode._id;")) {

        const marker =
            "meshserver.send({ action: 'powertimeline', nodeid: currentNode._id });";

        if (!data.includes(marker)) {
            throw new Error(
                'Nu am gasit request powertimeline in ' + name
            );
        }

        const replacement =
            marker +
            "\n                    sessionTimelineReq = currentNode._id;" +
            "\n                    meshserver.send({ action: 'sessiontimeline', nodeid: currentNode._id });";

        data = data.split(marker).join(replacement);
    }


    //
    // Modificam iesirea Power Timeline astfel incat dupa ea
    // sa fie afisat si User Session State.
    //
    if (!data.includes(
        'powerTableHtml + drawSessionTimelineTable(totalWidth, now, timeline2)'
    )) {

        const start = data.indexOf(
            'function drawDeviceTimeline()'
        );

        const end = data.indexOf(
            '// Return a color for the given power state',
            start
        );

        if ((start < 0) || (end < 0)) {
            throw new Error(
                'Nu am gasit limitele drawDeviceTimeline in ' + name
            );
        }

        let section = data.substring(start, end);

        const lineRegex =
            /^(\s*)QH\('p10html2',\s*(.*<table.*)\);\s*$/m;

        const match = section.match(lineRegex);

        if (match == null) {
            throw new Error(
                'Nu am gasit randul final Power State in ' + name
            );
        }

        section = section.replace(
            lineRegex,
            function (all, indent, expression) {

                return (
                    indent +
                    'var powerTableHtml = ' +
                    expression +
                    ';\n' +

                    indent +
                    "QH('p10html2', powerTableHtml + " +
                    'drawSessionTimelineTable(totalWidth, now, timeline2));'
                );
            }
        );

        data =
            data.substring(0, start) +
            section +
            data.substring(end);
    }


    //
    // Functia care construieste al doilea timeline.
    //
    if (!data.includes(
        'function drawSessionTimelineTable('
    )) {

        const marker =
            '        // Return a color for the given power state';

        if (!data.includes(marker)) {
            throw new Error(
                'Nu am gasit marker powerColor in ' + name
            );
        }

        const helper = `
        // =====================================================
        // AMT Centru - User Session State Timeline
        // =====================================================

        function sessionStateColor(state) {
            if (state == 'UNLOCKED') return '#5cb85c';
            if (state == 'LOCKED')   return '#f0ad4e';
            if (state == 'NOUSER')   return '#8a8a8a';

            return 'transparent';
        }


        function sessionStateText(state) {
            if (state == 'UNLOCKED') return 'Utilizator activ';
            if (state == 'LOCKED')   return 'Calculator blocat';
            if (state == 'NOUSER')   return 'Fara utilizator';

            return 'Necunoscut';
        }


        function drawSessionTimelineTable(totalWidth, now, powerBlocks) {

            var events = [];

            if (
                (currentNode != null) &&
                (sessionTimelineNode == currentNode._id) &&
                Array.isArray(sessionTimeline)
            ) {
                events = sessionTimeline;
            }


            //
            // Transformam evenimentele:
            //
            // [ora, stare]
            //
            // in intervale:
            //
            // [start, end, stare]
            //
            var sessionBlocks = [];

            var currentState = 'RESET';
            var currentStart = null;


            for (var i = 0; i < events.length; i++) {

                var t = Number(events[i][0]);
                var state = events[i][1];

                if (isNaN(t)) continue;


                if (
                    (currentStart != null) &&
                    (currentState != 'RESET') &&
                    (t > currentStart)
                ) {

                    sessionBlocks.push([
                        currentStart,
                        t,
                        currentState
                    ]);
                }


                currentStart = t;
                currentState = state;
            }


            //
            // Ultimul interval continua pana acum.
            //
            if (
                (currentStart != null) &&
                (currentState != 'RESET') &&
                (currentStart < now)
            ) {

                sessionBlocks.push([
                    currentStart,
                    now,
                    currentState
                ]);
            }


            var x = '';
            var count = 1;

            var date = new Date();

            date.setHours(0, 0, 0, 0);


            for (var day = 0; day < 7; day++) {

                var dayStart = date.getTime();

                var dayEnd =
                    dayStart +
                    (1000 * 60 * 60 * 24);


                var pieces = [];


                //
                // Afisam starea utilizatorului NUMAI
                // cand Power Timeline spune ca PC-ul este Powered (1).
                //
                for (var s = 0; s < sessionBlocks.length; s++) {

                    var sb = sessionBlocks[s];


                    for (var p = 0; p < powerBlocks.length; p++) {

                        var pb = powerBlocks[p];


                        // 1 = Powered
                        if (pb[2] != 1) continue;


                        var ts = Math.max(
                            dayStart,
                            sb[0],
                            pb[0]
                        );


                        var te = Math.min(
                            dayEnd,
                            sb[1],
                            pb[1],
                            now
                        );


                        if (te <= ts) continue;


                        var left =
                            Math.round(
                                ((ts - dayStart) * totalWidth) /
                                86400000
                            );


                        var width =
                            Math.round(
                                ((te - ts) * totalWidth) /
                                86400000
                            );


                        if (width < 1) width = 1;


                        pieces.push({
                            left: left,
                            width: width,
                            state: sb[2],
                            start: ts,
                            end: te
                        });
                    }
                }


                pieces.sort(function (a, b) {
                    return a.left - b.left;
                });


                var bars = '';


                for (var j = 0; j < pieces.length; j++) {

                    var q = pieces[j];

                    var title =
                        sessionStateText(q.state) +
                        ' | ' +
                        new Date(q.start).toLocaleTimeString() +
                        ' - ' +
                        new Date(q.end).toLocaleTimeString();


                    bars +=
                        '<div title="' + title + '"' +
                        ' style="' +
                        'position:absolute;' +
                        'left:' + q.left + 'px;' +
                        'width:' + q.width + 'px;' +
                        'height:16px;' +
                        'background-color:' +
                        sessionStateColor(q.state) +
                        ';">' +
                        '</div>';
                }


                var datavalue =
                    '<div style="' +
                    'position:relative;' +
                    'height:16px;' +
                    'width:' + totalWidth + 'px;' +
                    '">' +
                    bars +
                    '</div>';


                x +=
                    '<tr style="' +
                    (((count % 2) == 0) ?
                        'background-color:#DDD' :
                        '') +
                    '">' +

                    '<td>' +
                    '<div>&nbsp;' +
                    printDate(date) +
                    '<div></div></div>' +
                    '</td>' +

                    '<td>' +
                    datavalue +
                    '</td>' +

                    '</tr>';


                count++;


                date =
                    new Date(
                        date.getFullYear(),
                        date.getMonth(),
                        date.getDate() - 1
                    );
            }


            var legend =
                '<span style="font-weight:normal;font-size:11px;">' +

                '&nbsp;&nbsp;' +

                '<span style="' +
                'display:inline-block;' +
                'width:10px;' +
                'height:10px;' +
                'background:#5cb85c;' +
                '"></span> Activ' +

                '&nbsp;&nbsp;' +

                '<span style="' +
                'display:inline-block;' +
                'width:10px;' +
                'height:10px;' +
                'background:#f0ad4e;' +
                '"></span> Blocat' +

                '&nbsp;&nbsp;' +

                '<span style="' +
                'display:inline-block;' +
                'width:10px;' +
                'height:10px;' +
                'background:#8a8a8a;' +
                '"></span> Fara utilizator' +

                '</span>';


            return (
                '<table style="' +
                'color:black;' +
                'background-color:#EEE;' +
                'border-color:#AAA;' +
                'border-width:1px;' +
                'border-style:solid;' +
                'border-collapse:collapse;' +
                'width:calc(100% - 18px);' +
                'margin:9px;' +
                'margin-top:14px;' +
                '"' +
                ' border=0 cellpadding=2 cellspacing=0>' +

                '<tbody>' +

                '<tr style="' +
                'background-color:#AAAAAA;' +
                'font-weight:bold;' +
                '">' +

                '<th scope=col ' +
                'style=text-align:center;width:90px>' +
                'Day' +
                '</th>' +

                '<th scope=col style=text-align:center>' +
                'User Session State ' +
                legend +
                '</th>' +

                '</tr>' +

                x +

                '</tbody>' +

                '</table>'
            );
        }


`;

        data = data.replace(
            marker,
            helper + marker
        );
    }


    fs.writeFileSync(filename, data);

    patchedViews++;
}


if (patchedViews == 0) {
    throw new Error(
        'Nu am gasit niciun template cu drawDeviceTimeline()'
    );
}


console.log(
    'OK: timeline UI modificat in ' +
    patchedViews +
    ' template-uri'
);

console.log('PATCH SESSION TIMELINE COMPLET');