const client = require("../bot")

client.on("ready", () => {
	client.logger.info(`Ready! Logged in as ${client.user.tag}`);
})

// module.exports = {
// 	name: 'ready',
// 	once: true,
// 	execute(client) {
// 		client.logger.info(`Ready! Logged in as ${client.user.tag}`);
// 	},
// };