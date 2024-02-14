/**
 * main.js
 * @author Tim Traver <timtraver@gmail.com>
 * @version 1.0
 * @see {@link http://github.com|GitHub}
 * @description : This code is to provide a central location for a Shot Clock repeater 
 * node script that can be placed anywhere on the internet and used to keep track of 
 * shot clock remote updating.
 * This uses the same repeater_socket class that the electron app uses
 */

import config from './config.json' assert { type: "json" };
import SocketServer from './repeater_socket.js';

// Fill in the following for the config for this repeater
const repeaterIpAddress = config.repeaterIpAddress;
const repeaterPort = config.repeaterPort;
const hasConfigServer = config.hasConfigServer;

let repeater = new SocketServer(repeaterIpAddress, repeaterPort, hasConfigServer);
repeater.startSocket();
