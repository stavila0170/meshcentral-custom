/*
 * AMT Centru - Windows Session State Tracker
 * Stari:
 *   RESET     = tracker pornit / stare initiala necunoscuta
 *   UNLOCKED  = utilizator activ
 *   LOCKED    = sesiune blocata
 *   NOUSER    = niciun utilizator conectat
 */

if (process.platform == 'win32') {
    try {
        if (global._amtSessionStateTracker != true) {
            global._amtSessionStateTracker = true;

            var userSessions = require('user-sessions');
            var meshAgent = require('MeshAgent');

            function sendSessionState(state) {
                try {
                    meshAgent.SendCommand({
                        action: 'log',
                        msg: 'AMT_SESSIONSTATE|' + state
                    });
                } catch (e) { }
            }

            // Nu presupunem starea la pornirea MeshCore.
            sendSessionState('RESET');

            userSessions.on('locked', function () {
                sendSessionState('LOCKED');
            });

            userSessions.on('unlocked', function () {
                sendSessionState('UNLOCKED');
            });

            // Logon / logoff / schimbare sesiune.
            userSessions.on('changed', function () {
                try {
                    var sid = userSessions.consoleUid();
                    var username = userSessions.getUsername(sid);

                    if ((username != null) && (username != '')) {
                        sendSessionState('UNLOCKED');
                    } else {
                        sendSessionState('NOUSER');
                    }
                } catch (e) {
                    sendSessionState('NOUSER');
                }
            });
        }
    } catch (e) { }
}

module.exports = {};