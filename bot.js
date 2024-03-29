#!/usr/bin/env node
const { Client, Intents, Collection }   = require('discord.js')
const Winston                           = require('winston')
const BotSettingsProvider               = require('./models/botdb/botProvider')
const XenforoSettingsProvider           = require('./models/xenforo/xenProvider')
const DiscordEventsController           = require('./controller/discordEvents')
const DiscordRolesController            = require('./controller/discordRoles')
const DiscordChannelsController         = require('./controller/discordChannels')
const DiscordNicknameController         = require('./controller/discordNickname')
const DiscordOpsecOpPosting             = require('./controller/discordOpsecOpPosting')
const API                               = require('./api/app')
const Utilities                         = require('./functions/Utilities')
const CronJob                           = require('./cron/cronjobs')
const settings                          = require('./settings.json')
const fs                                = require('fs')

if (settings.NODE_ENV !== 'production') {
    require('dotenv').config()
}

if (!process.env.TOKEN){
    console.log('You forgot to enter your Discord super secret token! You can get this token from the following page: https://discordapp.com/developers/applications/')
    process.exit(42)
}
if (!settings.owners.length){
    console.log('You have to enter at least one owner in the settings.json')
    process.exit(42)
}
if (!process.env.DB_NAME1 || !process.env.DB_USER1 || !process.env.DB_PASS1 || !process.env.DB_HOST1 || !process.env.DB_PORT1){
    console.log('[DB1] You need to enter your database credentials before starting the bot.')
    process.exit(42)
}
if (!process.env.DB_NAME2 || !process.env.DB_USER2 || !process.env.DB_PASS2 || !process.env.DB_HOST2 || !process.env.DB_PORT2){
    console.log('[DB2] You need to enter your database credentials before starting the bot.')
    process.exit(42)
}

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MEMBERS,
        Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
        Intents.FLAGS.GUILD_PRESENCES
    ],
    partials: [
        "GUILD_MEMBER",
        "MESSAGE",
        "REACTION",
        "USER"
    ],
    presence: {
        activities: [{
            name: 'OpServ',
            type: "WATCHING"
        }],
        status: 'online'
    }
})

/**
 * Logger
 */
client.logger = Winston.createLogger({
    transports: [
        new Winston.transports.File({ filename: 'DiscordIntegration.log' })
    ],
    format: Winston.format.printf((log) => `[${new Date().toLocaleString()}] - [${log.level.toUpperCase()}] - ${log.message}`)
})

/**
 * Outputs to console during Development
 */
if (process.env.NODE_ENV !== 'production') {
    client.logger.add(new Winston.transports.Console({
        format: Winston.format.simple()
    }))
}

/**
 * Creates collection of commands
 */
client.commands = new Collection();
const commandFolders = fs.readdirSync('./commands')
for (const folder of commandFolders) {
    try {
        const loadedFolder = fs.readdirSync(`./commands/${folder}`).filter(file => file.endsWith('.js'))
        for (const file of loadedFolder) {
            const command = require(`./commands/${folder}/${file}`)
            client.commands.set(command.data.name, command)

            client.logger.info(`Loaded command ${command.data.name} (${folder})`);
        }
    } catch (e) {
        client.logger.error(`Failed to load folder ${folder}. **Please report the following error:**`)
        client.logger.error(e.stack)
    }
}

/**
 * loads all of the events that we are listening to
 */
const eventFolders = fs.readdirSync('./events')
for (const folder of eventFolders) {
    if (fs.lstatSync(`./events/${folder}`).isDirectory()){
        try {
            const loadedFolder = fs.readdirSync(`./events/${folder}`).filter(file => file.endsWith('.js'))
            for (const file of loadedFolder) {
                const event = require(`./events/${folder}/${file}`)
                if (event.once) {
                    client.once(event.name, (...args) => event.execute(client, ...args))
                } else {
                    client.on(event.name, (...args) => event.execute(client, ...args))
                }

                client.logger.info(`Loaded event ${event.name} (${folder})`);
            }
        } catch (e) {
            client.logger.error(`Failed to load folder ${folder}. **Please report the following error:**`)
            client.logger.error(e.stack)
        }
    } else {
        try {
            const event = require(`./events/${folder}`)
            if (event.once) {
                client.once(event.name, (...args) => event.execute(client, ...args))
            } else {
                client.on(event.name, (...args) => event.execute(client, ...args))
            }

            client.logger.info(`Loaded event ${event.name} (${folder})`);
        } catch (e) {
            client.logger.error(`Failed to load folder ${folder}. **Please report the following error:**`)
            client.logger.error(e.stack)
        }
    }
}

/**
 * Holds the settings
 * @type {Settings}
 */
client.config = settings

client.login(process.env.TOKEN)
    .catch(err => client.logger.error(err.stack))

client.utilities                    = new Utilities()                       // Holds all Utility Functions
client.xenProvider                  = new XenforoSettingsProvider()         // Xenforo DB Provider
client.botProvider                  = new BotSettingsProvider()             // Bot DB Provider
client.discordEventsController      = new DiscordEventsController()         // Discord Events Controller for all Event interactions
client.botApi                       = new API()                             // Bot API
client.discordRolesController       = new DiscordRolesController()          // Discord Role Controller for Permissions integration
client.discordChannelsController    = new DiscordChannelsController()       // Discord Channel Controller for Channel interactions
client.discordNicknameController    = new DiscordNicknameController()       // Discord Nickname Controller for Nickname Interactions
client.discordOpsecOpPosting        = new DiscordOpsecOpPosting()           // Discord Opsec Operation Controller for Operation List Posts
client.cron                         = new CronJob()
