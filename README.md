# The_Scungeonmaster
A small, limited-scope text adventure discord bot that runs locally using Ollama.

Current Commands:
!scungeonQuit -- shuts down the bot
!scungeonQuitGame -- ends the current adventure
!scungeonWipe -- wipes the message memory; recommended only for use when outside of a game, will seriously disrupt flow if used during a game.
COMMANDS ARE CASE SENSITIVE.

required permissions:
- read message history
- create messages
- read usernames
- create and manage threads

After making a discord bot and creating a config.json using the txt template, run the bot with 'node .' from the main project directory.
Then, he'll behave like a normal chat bot, until someone expresses that they'd like to play a game with him. Then, he _should_ create a thread and add the player.
He currently only supports a single player at a time and won't respond to other users during a game.
During normal chatbot behavior, you have to address him with his name (scungeonmaster), a mention, or a reply. However, once the game starts, he'll respond to any message in the thread from the selected player.
The game continues until the quit command is used, or the player dies in-game. The bot does not currently detect if you die outside the game.

The bot works by specifying trigger phrases in a dynamically updated system prompt, and then parsing his responses to look for those phrases. If one is found, it triggers the associated function to update the relevant txt, which is then spliced into his system prompt.

As such, sometimes he doesn't say the phrase, and you have to ask him nicely to say it.

Stats, inventory, health, and accomplishments are recorded in text files. _Nothing else is retained between rooms._ This allows indefinite play without fear of exceeding the context limit. These txts are also spliced into the system prompt directly, so you can ask at any time what the values of these files are during the game.

_Technically,_ this bot is model agnostic; any model that generates text can be used, but only if they follow instructions well. The system works reasonably reliably with gemma3:27b, but the systemPromptRunning.txt may need to be adjusted for other models to make them play nice.

temperature and repeat penalty may also need to be adjusted in order to get good results with different models.

planned features:
- room theme requests
- backstory, race, and other character requests
- generated puzzles and solutions, with prizes
- starting stat and equipment requests
- uncensored model
