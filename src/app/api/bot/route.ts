export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

import { Bot, webhookCallback, Context, InlineKeyboard } from "grammy";
import { Tool } from "langchain/tools";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage } from "@langchain/core/messages";
import { MongoClient, ObjectId } from "mongodb";
import {
  Account,
  Aptos,
  AptosConfig,
  Ed25519Account,
  Ed25519PrivateKey,
  Network,
  PrivateKey,
  PrivateKeyVariants,
} from "@aptos-labs/ts-sdk";
import { AgentRuntime, LocalSigner, createAptosTools } from "move-agent-kit";
import { ChatAnthropic } from "@langchain/anthropic";

const token = process.env.TELEGRAM_BOT_TOKEN;
console.log(token);
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN environment variable not found.");
}
const bot = new Bot(token);
const memorySaver = new MemorySaver();
const userImportState = new Map<string, boolean>();

// MongoDB setup
const mongoUrl = process.env.NEXT_PUBLIC_MONGO_URL || "";
if (!mongoUrl) {
  throw new Error("NEXT_PUBLIC_MONGO_URL environment variable not found.");
}

let mongoClient: MongoClient | null = null;

async function connectToMongo() {
  if (!mongoClient) {
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
  }
  return mongoClient.db("predikto");
}

async function getOrCreateUserWallet(userId: string) {
  const db = await connectToMongo();
  const usersCollection = db.collection("users");

  const user = await usersCollection.findOne({ userId: userId });

  if (user) {
    const privateKey = new Ed25519PrivateKey(
      PrivateKey.formatPrivateKey(user.privateKey, PrivateKeyVariants.Ed25519)
    );
    const AptosAccount = Account.fromPrivateKey({
      privateKey: privateKey,
    });
    return { AptosAccount, inProgress: user.inProgress };
  }

  const AptosAccount = Account.generate();

  // you should encrypt the private key before storing it in the database
  const AccountData = {
    userId: userId,
    publicKey: AptosAccount.publicKey.toString(),
    privateKey: AptosAccount.privateKey.toString(),
    inProgress: false,
    inGame: false,
  };

  await usersCollection.insertOne(AccountData);
  return { AptosAccount, inProgress: false };
}

class AptosPrivateKeyTool extends Tool {
  name = "aptos_get_private_key";
  description = "Get the wallet private key of the agent";

  constructor(private agent: AgentRuntime, private privateKey: string) {
    super();
  }

  async _call(_input: string): Promise<string> {
    return this.privateKey;
  }
}

// New tool for creating prediction markets
class CreatePredictionMarketTool extends Tool {
  name = "create_prediction_market";
  description = "Create a prediction market on Aptos blockchain";

  constructor(
    private agent: AgentRuntime,
    private signer: LocalSigner,
    private AptosAccount: Ed25519Account
  ) {
    super();
  }

  async _call(input: string): Promise<string> {
    try {
      const params = JSON.parse(input);
      const { question, description, endTimestamp } = params;
      const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

      // Execute the function on Aptos blockchain
      const functionId = `${this.signer.getAddress()}::prediction_market::create_market`;
      const args = [
        { type: "string", value: question },
        { type: "string", value: description },
        { type: "u64", value: endTimestamp.toString() },
      ];

      console.log(`Executing: ${functionId} with args:`, args);

      const transaction = await aptos.transaction.build.simple({
        sender: this.signer.getAddress(),
        data: {
          function: `0x7b32fe02523c311724de5e267ee56b6cca31f2ee04f15bfc10dbf1b23f95c6cb::prediction_market::create_market`,
          functionArguments: [question, description, endTimestamp.toString()],
        },
      });

      // Sign and submit the transaction
      const pendingTransaction = await aptos.signAndSubmitTransaction({
        signer: this.AptosAccount,
        transaction,
      });
      // Wait for transaction hash
      while (!pendingTransaction.hash) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      console.log(pendingTransaction.hash);
      return JSON.stringify({
        success: true,
        transactionHash: pendingTransaction.hash,
        message: `Successfully created prediction market for: "${question}"`,
      });
    } catch (error: any) {
      console.error("Error creating prediction market:", error);
      return JSON.stringify({
        success: false,
        error: error.message || "Unknown error occurred",
      });
    }
  }
}

async function initializeAgent(userId: string, AptosAccount: Ed25519Account) {
  try {
    const llm = new ChatAnthropic({
      modelName: "claude-3-5-sonnet-20241022",
      temperature: 0.7,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    });
    const aptosConfig = new AptosConfig({
      network: Network.TESTNET,
    });

    const aptos = new Aptos(aptosConfig);

    const signer = new LocalSigner(AptosAccount, Network.TESTNET);
    const aptosAgent = new AgentRuntime(signer, aptos, {
      PANORA_API_KEY: process.env.PANORA_API_KEY,
    });
    const tools = createAptosTools(aptosAgent);
    const config = { configurable: { thread_id: userId } };

    // Add prediction market tool to agent's tools
    const agent = createReactAgent({
      llm,
      tools: [
        ...tools,
        new AptosPrivateKeyTool(aptosAgent, AptosAccount.privateKey.toString()),
        new CreatePredictionMarketTool(aptosAgent, signer, AptosAccount),
      ],
      checkpointSaver: memorySaver,
      messageModifier: `
      You are a helpful agent that can interact onchain using the Move Agent Kit. 
      You are empowered to interact onchain using your tools.
      
      You specialize in creating prediction markets on Aptos blockchain. When users mention anything related to betting, 
      wagers, predictions, or similar concepts, you should help them create a prediction market.
      
      Extract the relevant information needed to create a prediction market:
      1. The question or prediction being made (what's being bet on)
      2. A brief description about the market
      3. When the prediction should be resolved (timestamp)
      
      Use the create_prediction_market tool to create the market with this information.
      
      If not enough information is provided, ask follow-up questions to gather what you need.
      If there is a 5XX (internal) HTTP error code, ask the user to try again later.
      If someone asks you to do something you can't do with your currently available tools, you must say so,
      and encourage them to implement it themselves using the Move Agent Kit.
      
      Be concise and helpful with your responses. Refrain from restating your tools' descriptions unless explicitly requested.
      `,
    });
    return { agent, config, signer };
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error;
  }
}

// Helper function to validate private key
function validatePrivateKey(privateKey: string): string | null {
  try {
    const cleanKey = privateKey.trim();
    if (!cleanKey.match(/^[0-9a-fA-F]{64}$/)) {
      return null;
    }
    return cleanKey;
  } catch (error) {
    return null;
  }
}

// Function to detect prediction market related phrases in messages
function isPredictionMarketRequest(message: string): boolean {
  const keywords = [
    "bet",
    "wager",
    "prediction market",
    "create a market",
    "let's bet",
    "betting",
    "odds",
    "gamble",
    "predict",
    "predikto",
    "prediction",
    "make a bet",
    "create a wager",
    "place a bet",
  ];

  const lowerMessage = message.toLowerCase();
  return keywords.some((keyword) => lowerMessage.includes(keyword));
}

// Function to extract prediction details from message using LLM
async function extractPredictionDetails(
  message: string,
  userId: string,
  AptosAccount: Ed25519Account
) {
  const { agent, config } = await initializeAgent(userId, AptosAccount);

  const prompt = `
    Extract the prediction market information from this message: "${message}"
    
    I need:
    1. The prediction question (what are people betting on)
    2. A brief description of the market
    3. When this prediction should resolve (end date)
    
    Format your response EXACTLY like this JSON, with no other text:
    {
      "question": "Will X happen by Y date?",
      "description": "Brief description here",
      "endTimestamp": 1234567890
    }

    If no end date is specified, use 3 months from now.
  `;

  const stream = await agent.stream(
    { messages: [new HumanMessage(prompt)] },
    config
  );

  let response = "";
  for await (const chunk of stream as AsyncIterable<{
    agent?: any;
    tools?: any;
  }>) {
    if (
      "agent" in chunk &&
      chunk.agent.messages &&
      chunk.agent.messages[0]?.content
    ) {
      const messageContent = chunk.agent.messages[0].content;
      if (typeof messageContent === "string") {
        response = messageContent;
      } else if (Array.isArray(messageContent)) {
        // Only take the first text content to avoid any follow-up messages
        const textContent = messageContent.find((msg) => msg.type === "text");
        if (textContent) {
          response = textContent.text;
          break; // Exit after getting first valid response
        }
      }
    }
  }

  // Clean the response to only keep JSON
  response = response.replace(/^[\s\S]*?({[\s\S]*})[\s\S]*$/, "$1");

  try {
    // Extract JSON from the response
    const jsonMatch =
      response.match(/```json\n([\s\S]*?)\n```/) ||
      response.match(/{[\s\S]*?}/);

    if (jsonMatch) {
      const jsonString = jsonMatch[1] || jsonMatch[0];
      const details = JSON.parse(jsonString);

      // Ensure we have a timestamp, generate one if needed
      if (!details.endTimestamp) {
        // Default to 3 months from now
        const threeMonthsFromNow = new Date();
        threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
        details.endTimestamp = Math.floor(threeMonthsFromNow.getTime() / 1000);
      }

      return details;
    }
    throw new Error(
      "Could not extract structured prediction market details from response"
    );
  } catch (error) {
    console.error("Error parsing prediction details:", error);
    throw error;
  }
}

// Function to create a prediction market
async function createPredictionMarket(
  initiatorUserId: string,
  question: string,
  description: string,
  endTimestamp: number
) {
  try {
    // Get the initiator's wallet account
    const { AptosAccount, inProgress } = await getOrCreateUserWallet(
      initiatorUserId
    );

    // Initialize agent with the initiator's account
    const { agent, config, signer } = await initializeAgent(
      initiatorUserId,
      AptosAccount
    );

    const createMarketPrompt = `
      Create a new prediction market with the following details:
      {
        "question": "${question}",
        "description": "${description}",
        "endTimestamp": ${endTimestamp}
      }
      
      Use the create_prediction_market tool and get the transaction hash.
    `;

    const stream = await agent.stream(
      { messages: [new HumanMessage(createMarketPrompt)] },
      config
    );

    let result = null;

    for await (const chunk of stream as AsyncIterable<{
      agent?: any;
      tools?: any;
    }>) {
      if (chunk.tools?.messages?.[0]?.content) {
        try {
          const response = JSON.parse(chunk.tools.messages[0].content);
          if (response.success && response.transactionHash) {
            result = response;
          }
        } catch (e) {
          console.error("Error parsing JSON from tools response:", e);
        }
      }
    }

    console.log(result);
    return {
      success: true,
      initiatorAddress: signer.getAddress(),
      transactionDetails: result,
      question,
      description,
      endTimestamp,
    };
  } catch (error: any) {
    console.error("Error creating prediction market:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

bot.command("start", async (ctx) => {
  console.log("command start");
  const userId = ctx.from?.id.toString();
  if (!userId) {
    return;
  }

  const db = await connectToMongo();
  const usersCollection = db.collection("users");
  const user = await usersCollection.findOne({ userId: userId });

  if (!user) {
    const keyboard = new InlineKeyboard()
      .text("Create New Account", "create_account")
      .text("Import Existing Account", "import_account");

    await ctx.reply(
      "Welcome! Would you like to create a new account or import an existing one?",
      { reply_markup: keyboard }
    );
  } else {
    await ctx.reply(
      "Welcome back! You can use this bot to create prediction markets. Just mention betting or prediction-related keywords in your messages."
    );
  }
});

// Add a help command
bot.command("help", async (ctx) => {
  await ctx.reply(`
🎲 *Prediction Market Bot* 🎲

This bot helps you create prediction markets on Aptos blockchain.

*Commands:*
/start - Start the bot and create your account
/help - Show this help message

*Creating Markets:*
Simply mention keywords like "bet", "wager", "prediction" in your message along with what you want to bet on.

Example: "Let's bet on whether BTC will reach $200k by the end of the year"

The bot will detect your intent and help you create a prediction market.
  `);
});

// Handle button callbacks
bot.callbackQuery("create_account", async (ctx) => {
  const userId = ctx.from.id.toString();
  const { AptosAccount } = await getOrCreateUserWallet(userId);
  await ctx.reply(
    "Your new account has been created! Here's your wallet address:"
  );
  await ctx.reply(`${String(AptosAccount.publicKey)}`);
  await ctx.reply(
    "You can now start using the bot. Mention betting or prediction-related keywords in your messages to create prediction markets!"
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery("import_account", async (ctx) => {
  const userId = ctx.from.id.toString();
  await ctx.reply(
    "Please send your private key in hex format (64 characters)."
  );
  userImportState.set(userId, true);
  await ctx.answerCallbackQuery();
});

// Telegram bot handler for all messages
bot.on("message:text", async (ctx: Context) => {
  const userId = ctx.from?.id.toString();
  if (!userId) {
    return;
  }

  const messageText = ctx.message?.text || "";
  const isGroupChat =
    ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";

  const db = await connectToMongo();
  const usersCollection = db.collection("users");

  // Handle private key import
  if (userImportState.get(userId)) {
    const validatedKey = validatePrivateKey(messageText);

    if (!validatedKey) {
      await ctx.reply(
        "Invalid private key format. Please try again with a valid 64-character hex private key."
      );
      return;
    }

    try {
      const privateKeyStr = validatedKey;
      const privateKey = new Ed25519PrivateKey(
        PrivateKey.formatPrivateKey(privateKeyStr, PrivateKeyVariants.Ed25519)
      );
      // Import wallet with private key
      const AptosAccount = Account.fromPrivateKey({
        privateKey: privateKey,
      });
      const AccountData = {
        userId: userId,
        publicKey: AptosAccount.publicKey.toString(),
        privateKey: AptosAccount.privateKey.toString(),
        inProgress: false,
        inGame: false,
      };

      await usersCollection.updateOne(
        { userId: userId },
        { $set: AccountData },
        { upsert: true }
      );

      await ctx.reply("Account successfully imported! Your wallet address is:");
      await ctx.reply(`${AptosAccount.publicKey.toString()}`);
      await ctx.reply(
        "Your account is ready! You can now start using the bot to create prediction markets."
      );

      userImportState.delete(userId);
      return;
    } catch (error) {
      console.error("Error importing account:", error);
      await ctx.reply(
        "Error importing account. Please check your private key and try again."
      );
      return;
    }
  }

  // Check if user has a wallet
  const userWallet = await usersCollection.findOne({ userId: userId });
  if (!userWallet) {
    // User doesn't have a wallet, prompt them to create one
    const keyboard = new InlineKeyboard()
      .text("Create New Account", "create_account")
      .text("Import Existing Account", "import_account");

    await ctx.reply(
      "You need to create or import an account first to use this bot.",
      { reply_markup: keyboard }
    );
    return;
  }

  // Check if message is related to prediction markets
  if (isPredictionMarketRequest(messageText)) {
    // Get the user's wallet
    const { AptosAccount, inProgress } = await getOrCreateUserWallet(userId);

    if (inProgress) {
      await ctx.reply(`Hold on! I'm still processing your previous request...`);
      return;
    }

    // Update user status to in progress
    await usersCollection.updateOne(
      { userId: userId },
      { $set: { inProgress: true } }
    );

    try {
      // Notify the chat we're processing the prediction market request
      await ctx.reply(
        "I detected a prediction market request! Analyzing details..."
      );

      // Extract prediction details from message
      const marketDetails = await extractPredictionDetails(
        messageText,
        userId,
        AptosAccount
      );

      // Confirm the details with user
      const confirmationMsg = `
📊 *Creating Prediction Market*
Question: ${marketDetails.question}
Description: ${marketDetails.description}
End Date: ${new Date(marketDetails.endTimestamp * 1000).toLocaleString()}

Creating market on Aptos blockchain...`;

      await ctx.reply(confirmationMsg);

      // Create the prediction market
      const result: any = await createPredictionMarket(
        userId,
        marketDetails.question,
        marketDetails.description,
        marketDetails.endTimestamp
      );

      if (result.success) {
        // Successful market creation
        const successMsg = `
🎉 *Prediction Market Created Successfully!*
Question: ${result.question}
Creator: ${result.initiatorAddress}
Expiration: ${new Date(result.endTimestamp * 1000).toLocaleString()}

Transaction Information:
https://explorer.aptoslabs.com/txn/${
          result.transactionDetails.transactionHash
        }/changes?network=testnet

Place your bets now!`;

        await ctx.reply(successMsg);
      } else {
        // Failed market creation
        await ctx.reply(`Failed to create prediction market: ${result.error}`);
      }
    } catch (error) {
      console.error("Error in prediction market flow:", error);
      await ctx.reply(
        "Sorry, I encountered an error while creating the prediction market. Please try again with more details."
      );
    } finally {
      // Reset the inProgress flag
      await usersCollection.updateOne(
        { userId: userId },
        { $set: { inProgress: false } }
      );
    }
    return;
  }

  // Handle normal messages (non-prediction market related)
  const { AptosAccount, inProgress } = await getOrCreateUserWallet(userId);

  if (inProgress) {
    await ctx.reply(`Hold on! I'm still processing...`);
    return;
  }

  // Update user status to in progress
  await usersCollection.updateOne(
    { userId: userId },
    { $set: { inProgress: true } }
  );

  try {
    const { agent, config } = await initializeAgent(userId, AptosAccount);
    const stream = await agent.stream(
      { messages: [new HumanMessage(messageText)] },
      config
    );

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 20000)
    );

    for await (const chunk of (await Promise.race([
      stream,
      timeoutPromise,
    ])) as AsyncIterable<{ agent?: any; tools?: any }>) {
      if ("agent" in chunk) {
        if (chunk.agent.messages[0].content) {
          const messageContent = chunk.agent.messages[0].content;
          // Don't send any replies for normal messages
        }
      }
    }
  } catch (error: any) {
    if (error.message === "Timeout") {
      await ctx.reply(
        "I'm sorry, the operation took too long and timed out. Please try again."
      );
    } else {
      console.error("Error processing stream:", error);
      await ctx.reply(
        "I'm sorry, an error occurred while processing your request."
      );
    }
  } finally {
    // Reset inProgress status
    await usersCollection.updateOne(
      { userId: userId },
      { $set: { inProgress: false } }
    );
  }
});

export const POST = async (req: Request) => {
  const headers = new Headers();
  headers.set("x-vercel-background", "true");
  const handler = webhookCallback(bot, "std/http");
  return handler(req);
};

export const GET = async (req: Request) => {
  try {
    bot.start();
    console.log("Bot is running in polling mode...");
  } catch (error) {
    console.log("Error starting bot:", error);
    return new Response("Error starting bot", { status: 500 });
  }
  return new Response("Bot is running in polling mode...", {
    status: 200,
  });
};
