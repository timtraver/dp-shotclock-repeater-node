/**
 * repeater_socket.js
 * @author Tim Traver <timtraver@gmail.com>
 * @version 1.0
 * @see {@link https://github.com/timtraver/dp-shotclock-repeater-node}
 * @description : This code is to provide a central location for a Shot Clock coordinator between
 * an 'Admin' screen that is controlling the shot clock, and any overlays or screens that are
 * following a particular match.
 */

import express from 'express';
import { createServer } from 'node:https';
import { Server } from 'socket.io';
import fs from 'fs';
export default class SocketServer {
    domain;
    address;
    port;
    hasConfigServer = false;
    httpsKeyPath;
    httpsCertPath;
    app;
    server;
    io;
    rooms = [];
    configMessages = [];

    // Constructor to set the domain, ip address, and port and create the express https server
    constructor(domain, address, port, hasConfigServer, httpsKeyPath, httpsCertPath) {
        this.domain = domain;
        this.address = address;
        this.port = port;
        this.hasConfigServer = hasConfigServer;
        this.httpsKeyPath = httpsKeyPath;
        this.httpsCertPath = httpsCertPath;

        const privateKey = fs.readFileSync(this.httpsKeyPath, 'utf8');
        const certificate = fs.readFileSync(this.httpsCertPath, 'utf8');
        const credentials = { key: privateKey, cert: certificate };

        this.app = express();
        this.server = createServer(credentials, this.app);
        this.io = new Server(this.server, { cors: { origin: "*" } });
    }

    shortenSocketString(string) {
        return string.substring(string.length - 5);
    }

    // Method to start the socket services
    startSocket() {

        // Set the events for the server connections
        this.io.on('connection', (socket) => {
            if (this.hasConfigServer) this.sendConfigMessage(this.shortenSocketString(socket.id) + ' - Connected');

            // Listen for pings that are used to determine clock differences
            socket.on('ping', (data, callback) => {
                callback({
                    sentServerTime: Date.now()
                });
            });

            socket.on('join', (data, callback) => {
                let roomName = 'match' + data.match.toString();
                let type = data.type;
                let returnData = {};

                this.sendConfigMessage(this.shortenSocketString(socket.id) + ' - joining Match ' + data.match + ' as ' + type);
                if (this.rooms[roomName] == undefined) {
                    // Room does not yet exist, so lets create it
                    if (type == 'admin') data.admin = socket.id;
                    delete data.type;
                    this.rooms[roomName] = data;
                    socket.join(roomName);
                } else {
                    // Room already exists, so update the admin if it is an admin join
                    if (type == 'admin') this.rooms[roomName].admin = socket.id;
                    socket.join(roomName);
                    returnData = this.rooms[roomName];
                }
                callback(
                    returnData
                );
            });

            socket.on('update', (data, callback) => {
                let roomName = 'match' + data.match.toString();
                let room = this.rooms[roomName];
                this.rooms[roomName] = { ...room, ...data };

                // Do some calculations for the time diffs and then send an emit to the members in the room
                this.ensureEmit(socket, roomName, 'update', {
                    ...data,
                    isPlaying: data.isPlaying,
                    endTimerTime: data.endTimerTime - data.clockOffset,
                    remainingTime: data.remainingTime,
                    maxTime: data.maxTime,
                    updateKey: data.updateKey
                });
                callback('ok');
                this.sendConfigMessage(this.shortenSocketString(socket.id) + ' - Room ' + roomName + ' - Update - Remaining : ' + data.remainingTime + ', Playing : ' + data.isPlaying);
            });

            socket.on('disconnect', () => {
                this.sendConfigMessage(this.shortenSocketString(socket.id) + ' - Client disconnected');
                this.cleanRooms(socket);
            });
        });

        this.io.listen(this.server);
        this.server.listen(this.port, this.address, () => {
            this.sendConfigMessage('Server started and listening at http://' + this.address + ':' + this.port);
        });
    }

    ensureEmit(socket, roomName, event, arg) {
        this.sendConfigMessage("Sending emit to room " + roomName);
        socket.timeout(5000).to(roomName).emit(event, arg, (err) => {
            if (err) {
                this.sendConfigMessage("Got Error : ", err);
                // no ack from the client, so try and send it again
                this.ensureEmit(socket, roomName, event, arg);
            } else {
                this.sendConfigMessage('Emit Success');
            }
        })
    }

    stopSocket() {
        // Stop the socket server and clear the variables
        // make all Socket instances disconnect
        this.io.disconnectSockets();
        this.io.close();
        this.sendConfigMessage('Socket server services stopped.');
        return;
    }

    cleanRooms(socket) {
        // Check to see if we need to clear the room data, so we don't build up huge arrays of byegone match rooms
        for (const key in this.rooms) {
            if (!this.io.sockets.adapter.rooms.has(key)) {
                // The room no longer has anyone in it, so lets remove that element from the rooms array
                delete this.rooms[key];
            } else {
                //check if the disconnected client was an admin, and take the admin key out of the saved room
                if (this.rooms[key].admin == socket.id) {
                    this.rooms[key].admin = '';
                }
            }
        }
    }

    sendConfigMessage(message) {
        if (this.hasConfigServer === true) {
            this.configMessages.push(message);
        } else {
            let date = new Date;
            console.log(date.toLocaleDateString() + ' - ' + message);
        }
    }
}