import { Client, Partials, Collection, Events, GatewayIntentBits, ActivityType, SlashCommandBuilder, BaseInteraction } from 'discord.js';
import path from 'node:path';
import logger from '../utilities/structs/log.js';
import fs from 'node:fs';
import Users from '../model/user.js';
import functions from '../utilities/structs/functions.js';
import Safety from '../utilities/safety.js';

const ADMIN_IDS = [
	"" // id goes here ex: "12345678910"
];

export const client: Client = new Client({
	partials: [Partials.Channel, Partials.Message, Partials.Reaction],
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.DirectMessageTyping,
		GatewayIntentBits.GuildMessageTyping,
		GatewayIntentBits.GuildModeration
	],
	presence: {
		activities: [{
			name: process.env.NAME || 'BetterMomentum',
			type: ActivityType.Playing,
		}],
		status: 'online',
	},
});

global.discordClient = client;
global.discordApplication = await functions.FetchApplication();

client.commands = new Collection();

const basePath = process.cwd();
const foldersPath = path.join(basePath, 'build', 'bot', 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

	for (const file of commandFiles) {
		try {
			const command: Command = await import(`file://${path.join(commandsPath, file)}`);

			if (command.data && 'execute' in command) {
				client.commands.set(command.data.name, command);
			} else {
				logger.error(`[WARNING] Missing data/execute in ${file}`);
			}
		} catch (error) {
			logger.error(`[ERROR] Failed loading ${file}: ${error}`);
		}
	}
}

client.once(Events.ClientReady, async () => {
	const clientId = await client.application?.id;
	global.clientId = clientId;

	import('./deploy-commands.js');

	logger.bot(`[READY] Logged in as ${client.user?.tag}!`);
});

function isAdmin(userId: string) {
	return ADMIN_IDS.includes(userId);
}

client.on(Events.InteractionCreate, async (interaction: BaseInteraction) => {
	if (!interaction.isChatInputCommand()) return;

	const command = client.commands.get(interaction.commandName);

	if (!command) {
		return interaction.reply({
			content: 'This command does not exist',
			ephemeral: true
		});
	}

	// Checks if the user is an admin
	if ((command as any).adminOnly) {
		if (!isAdmin(interaction.user.id)) {
			return interaction.reply({
				content: "You don't have permission to use this command lil bro.",
				ephemeral: true
			});
		}
	}

	try {
		await command.execute(interaction);
	} catch (error: any) {
		console.log(error.toString());

		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({
				content: 'There was an error while executing this command!',
				ephemeral: true
			});
		} else {
			await interaction.reply({
				content: 'There was an error while executing this command!',
				ephemeral: true
			});
		}
	}
});

interface Command {
	data: SlashCommandBuilder;
	execute(interaction: any): Promise<void>;
	adminOnly?: boolean;
}

declare module 'discord.js' {
	interface Client {
		commands: Collection<string, Command>;
	}
}
