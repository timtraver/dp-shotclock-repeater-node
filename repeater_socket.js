/**
 * repeater_socket.js
 * @author Tim Traver <timtraver@gmail.com>
 * @version 1.0
 * @see {@link http://github.com|GitHub}
 * @description : This code is to provide a central location for a Shot Clock coordinator between
 * an 'Admin' screen that is controlling the shot clock, and any overlays or screens that are
 * following a particular match.
 */

import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

export default class SocketServer {
    address;
    port;
    hasConfigServer = false;
    app = express();
    server = createServer(this.app);
    io = new Server(this.server, {
        cors: {
            origin: "*"
        }
    });

    rooms = [];
    configMessages = [];

    // Constructor to set the ip address and port
    constructor(address, port, hasConfigServer) {
        this.address = address;
        this.port = port;
        this.hasConfigServer = hasConfigServer;
    }

    // Method to start the socket services
    startSocket() {

        // Set the events for the server connections
        this.io.on('connection', (socket) => {
            console.log('Client connected : ', socket.id);
            if (this.hasConfigServer) this.sendConfigMessage(socket.id + ' - connected');

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

                console.log(socket.id + 'joining Match ' + data.match + ' as ' + type + ' in ' + roomName);
                this.sendConfigMessage(socket.id + ' - joining Match ' + data.match + ' as ' + type);
                console.log("rooms = ", this.rooms);
                if (this.rooms[roomName] == undefined) {
                    // Room does not yet exist, so lets create it
                    console.log("Room does not exist, so creating it.");
                    if (type == 'admin') data.admin = socket.id;
                    delete data.type;
                    this.rooms[roomName] = data;
                    socket.join(roomName);
                } else {
                    // Room already exists, so update the admin if it is an admin join
                    if (type == 'admin') this.rooms[roomName].admin = socket.id;
                    socket.join(roomName);
                    returnData = this.rooms[roomName];
                    console.log("Room exists, sending back room data.", returnData);
                }
                console.log("this is the return data : ", returnData);
                callback(
                    returnData
                );
            });

            socket.on('update', (data, callback) => {
                let roomName = 'match' + data.match.toString();
                let room = this.rooms[roomName];
                this.rooms[roomName] = { ...room, ...data };
                console.log('update data sent : ', data);
                console.log('room data : ', this.rooms);

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
                this.sendConfigMessage(socket.id + ' - Room ' + roomName + ' - Update Message from ' + socket.id);
            });

            socket.on('disconnect', () => {
                console.log('Client disconnected : ', socket.id);
                this.sendConfigMessage(socket.id + ' - Client disconnected');
                this.cleanRooms(socket);
            });
        });

        this.io.listen(this.server);
        this.server.listen(this.port, this.address, () => {
            console.log('Server started and listening at http://' + this.address + ':' + this.port);
            this.sendConfigMessage('Server started and listening at http://' + this.address + ':' + this.port);
        });
    }

    ensureEmit(socket, roomName, event, arg) {
        console.log("sending emit to room " + roomName);
        socket.timeout(5000).to(roomName).emit(event, arg, (err) => {
            if (err) {
                console.log("got error", err);
                // no ack from the client, so try and send it again
                this.ensureEmit(socket, roomName, event, arg);
            } else {
                console.log('Got callback value, so ok');
            }
        })
    }

    stopSocket() {
        // Stop the socket server and clear the variables
        // make all Socket instances disconnect
        console.log('Stopping existing socket service.');
        this.io.disconnectSockets();
        this.io.close();
        this.sendConfigMessage('Socket server services stopped.');
        return;
    }

    cleanRooms(socket) {
        // Check to see if we need to clear the room data, so we don't build up huge arrays of byegone match rooms
        // console.log('IO Room Data : ', this.io.sockets.adapter.rooms);
        for (const key in this.rooms) {
            if (!this.io.sockets.adapter.rooms.has(key)) {
                // The room no longer has anyone in it, so lets remove that element from the rooms array
                // logMessage('Match ' + key + ' empty, so removing local data.');
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
        if (this.hasConfigServer) {
            this.configMessages.push(message);
        }
    }
}