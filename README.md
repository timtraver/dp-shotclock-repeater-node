##
# @author Tim Traver <timtraver@gmail.com>
# @version 1.0
# @see {@link https://github.com/timtraver/dp-shotclock-repeater-node}
# @description : This code is to provide a central location for a Shot Clock repeater
# This is the node only portion that shares the repeater_socket.js class with the dp-shotclock-repeater-electron electron app
#
 
# Getting Started with DigitalPool ShotClock Repeater

This is the node application to handle a shot clock repeater web socket.

## LetsEncrypt certificate needed for https server

This application needs an https certificate to use when serving up the websocket so as to work with secure sites making calls to this server. You will need to install letsencrypt on the local server, and use the following command to create a certificate for the domain name that points to this server.

### ```sudo snap install --classic certbot```
### ```sudo ln -s /snap/bin/certbot /usr/bin/certbot```
### ```sudo certbot certonly --standalone```

During the certbot process, you need to enter the fully qualified domain name that will be used for the cert.

### config.json

Use this file to set the coniguration for the node repeater server.
The parameters are as follows
- repeaterFQDN : the fully qualified domain name to be used for the created certificate (same as created in the certbot process)
- repeaterIpAddress : the local IP Address to bind to for the server
- repeaterPort : the local port to be used (should be 8443 or higher than the reserved ports becuase it is being run by non root user)
- hasConfigServer : flag to say whether or not it has a configuration server (only really true with electron app version),
- httpsKeyPath : path to letsencrypt key
- httpsCertPath : path to letsencrypt cert

## Additional local config

After you have done all of that setup, you need to create a user to run the node server as (shotclock), and change the permissions on all the files to be shotclock:shotclock

### ```useradd -d /home/dp-shotclock-repeater-node shotclock```
### ```chown -R shotclock:shotclock dp-shotclock-repeater-node```

You will need to create a systemd service to start the node server and run as the user

### `apt install nodejs`
### `apt install npm`
### `npm install`
### `chmod -R 755 /etc/letsencrypt/archive /etc/letsencrypt/live`
### `cd /lib/systemd/system`
### `vi shotclock.service`

and put the following into the shotclock.service file
[Unit]
Description=Digital Pool Shot Clock Repeater Service
After=network.target

[Service]
Type=simple
User=shotclock
ExecStart=/usr/bin/node /home/dp-shotclock-repeater-node/main.js
Restart=on-failure

[Install]
WantedBy=multi-user.target

### `systemctl enable shotclock`

## Available Scripts

In the project directory, you can run it manually:

### `npm start`

Runs the app manually based on the config values in config.json

Or you can start the service

### `systemctl start shotclock`

