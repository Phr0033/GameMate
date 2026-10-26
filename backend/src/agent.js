import "dotenv/config";
import OpenAI from "openai";

import {
    getCurrentPlayerProfile,
    getBossInfo,
} from "./tools.js";

import {
    searchGameGuides
} from "./rag.js";
import { T5ForConditionalGeneration } from "@huggingface/transformers";

const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL,
});

const model =
    process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

/*
  tools 的作用：

  不是把 JS 函数本身传给大模型。

  而是告诉大模型：

  1. 我这里有哪些工具
  2. 每个工具是干什么的
  3. 每个工具需要什么参数
*/
const tools = [
    {
        type: "function",

        function: {
            name: "get_current_player_profile",

            description:
                "获取当前登录玩家的等级、武器、游戏进度和当前位置。当回答与玩家自身状态有关的问题时使用。",

            parameters: {
                type: "object",
                properties: {},
            },
        },
    },

    {
        type: "function",

        function: {
            name: "get_boss_info",

            description:
                "查询指定 Boss 的推荐等级、所在区域、弱点和基本攻略信息。",

            parameters: {
                type: "object",

                properties: {
                    boss_name: {
                        type: "string",
                        description: "Boss 名称",
                    },
                },

                required: ["boss_name"],
            },
        },
    },
    {
        type: "function",

        function: {
            name: "search_game_guides",

            description:
                "从游戏攻略知识库中检索相关攻略。当问题涉及游戏路线、区域推荐、Boss打法、武器使用、装备准备等攻略知识时使用。",

            parameters: {
                type: "object",

                properties: {
                    query: {
                        type: "string",
                        description:
                            "用于检索攻略知识库的问题，应尽量包含关键游戏实体和用户需求",
                    },
                },

                required: ["query"],
            },
        },
    },
];


async function executeTool(toolCall, userId) {

    const functionName =
        toolCall.function.name;

    const args =
        JSON.parse(
            toolCall.function.arguments || "{}"
        );


    switch (functionName) {

        case "get_current_player_profile":
            return getCurrentPlayerProfile(userId);

        case "get_boss_info":
            return getBossInfo(args.boss_name);

        case "search_game_guides":
            return await searchGameGuides(
                args.query,
                3
            );

        default:
            throw new Error(
                `未知 Tool: ${functionName}`
            );
    }
}


export async function runAgent(
    userId,
    userMessage,
    history = []
) {

    const startTime = performance.now();
    const toolsUsed = [];
    const trace = [];

    const metrics = {
        llmCalls: 0,
        llmTimeMs: 0,
        toolCalls: 0,
        toolTimeMs: 0,
    }
    /*
      messages 就是整个 Agent 当前掌握的上下文。
    */
    const messages = [

        {
            role: "system",

            content: `
你是 GameMate，一个游戏攻略 AI Agent。

你需要根据玩家状态、结构化游戏数据和攻略知识库，
给玩家提供准确、个性化的游戏建议。

你有三个工具：

1. get_current_player_profile
获取当前玩家等级、武器、进度和当前位置。

2. get_boss_info
获取指定 Boss 的推荐等级、弱点、区域等结构化数据。

3. search_game_guides
从攻略知识库检索路线、打法、装备、区域等非结构化知识。

【工具使用原则】

- 只调用完成当前问题真正需要的工具。
- 如果现有对话或已有工具结果已经足够回答，不要重复调用工具。
- 不要为了“确认一下”而调用无关工具。
- 同一个问题中，除非第一次检索结果明显不足，否则不要重复调用 search_game_guides。

具体规则：

1. “我多少级 / 用什么武器 / 当前进度是什么”
   → 只需要 get_current_player_profile。

2. “某 Boss 弱点是什么 / 推荐多少级”
   → 优先只调用 get_boss_info。

3. “某路线怎么走 / 某武器怎么玩 / 打完某 Boss 去哪里”
   → 优先只调用 search_game_guides。

4. 只有当问题需要根据“玩家自身状态”进行个性化判断时，
   才调用 get_current_player_profile。

5. 只有当问题确实需要 Boss 的结构化数据时，
   才调用 get_boss_info。

6. 综合问题可以调用多个工具，但避免重复查询已经获得的信息。

7. 可以利用历史对话理解“它”“那里”“这个武器”等指代。

8. 不要编造工具和知识库没有提供的事实。

9. 用中文回答。
`,
        },

        // 之前的聊天记录
        ...history,


        {
            role: "user",
            content: userMessage,
        },
    ];


    /*
      最简单的 Agent Loop。
  
      最多跑 10 轮，
      防止模型异常情况下无限调用工具。
    */
    for (
        let step = 0;
        step < 10;
        step++
    ) {
        const llmStart = performance.now();
        const completion =
            await client.chat.completions.create({

                model,

                messages,

                tools,

                tool_choice: "auto",

                stream: false,

                /*
                  我们现在关闭 thinking，
                  先把 Tool Calling 链路跑稳定。
                */
                thinking: {
                    type: "disabled",
                },
            });
        metrics.llmCalls += 1;
        metrics.llmTimeMs += performance.now() - llmStart;

        const assistantMessage =
            completion.choices[0].message;


        /*
          这一步非常重要：
    
          要把模型刚才说的话，
          包括 tool_calls，
          放进 conversation history。
    
          因为下一轮模型需要知道：
          "刚才是我自己要求调用这些工具的"
        */
        messages.push(
            assistantMessage
        );


        /*
          如果没有 tool_calls，
    
          说明模型认为：
          "信息已经够了，我可以直接回答了。"
        */
        if (
            !assistantMessage.tool_calls ||
            assistantMessage.tool_calls.length === 0
        ) {
            const totalTimeMs = performance.now() - startTime;
            return {
                answer:
                    assistantMessage.content,

                toolsUsed,

                trace,

                metrics: {
                    llmCalls: metrics.llmCalls,
                    toolCall: metrics.toolCalls,
                    llmTimeMs:
                        Math.round(
                            metrics.llmTimeMs
                        ),

                    toolTimeMs:
                        Math.round(
                            metrics.toolTimeMs
                        ),

                    totalTimeMs:
                        Math.round(
                            totalTimeMs
                        ),
                }
            };
        }


        /*
          模型可能一次要求调用多个工具。
    
          例如：
    
          get_current_player_profile
          +
          get_boss_info
        */
        for (
            const toolCall
            of assistantMessage.tool_calls
        ) {

            console.log(
                "\nAgent 决定调用 Tool:"
            );

            console.log(
                toolCall.function.name
            );


            console.log(
                "参数:"
            );

            console.log(
                toolCall.function.arguments
            );


            /*
              注意：
      
              真正执行函数的是这里。
      
              LLM 自己并没有执行 JS。
            */

            const toolStart =
                performance.now();

            const result =
                await executeTool(
                    toolCall,
                    userId
                );

            metrics.toolCalls += 1;
            metrics.toolTimeMs += performance.now() - toolStart;
            console.log(
                "Tool 返回:"
            );

            console.log(
                result
            );

            //=========记录Tooltrace========//

            const toolName = toolCall.function.name;
            const traceItem = {
                name: toolName,

                arguments: JSON.parse(
                    toolCall.function.arguments || "{}"
                ),
            };


            // RAG 单独处理
            if (toolName === "search_game_guides") {

                traceItem.results =
                    result.results.map(item => ({

                        source: item.source,

                        score: Number(
                            item.score.toFixed(4)
                        ),

                        preview:
                            item.content.slice(0, 120),

                    }));

            } else {

                // 普通 Tool 直接记录返回结果
                traceItem.result = result;
            }


            trace.push(traceItem);






            toolsUsed.push({
                name:
                    toolCall.function.name,

                arguments:
                    JSON.parse(
                        toolCall.function.arguments
                        || "{}"
                    ),
            });


            /*
              把工具执行结果塞回 messages。
      
              tool_call_id 用来告诉模型：
      
              "这个结果，
              对应的是你刚才哪一次工具调用。"
            */
            messages.push({

                role: "tool",

                tool_call_id:
                    toolCall.id,

                content:
                    JSON.stringify(result),
            });
        }
    }


    throw new Error(
        "Agent 调用工具次数过多"
    );
}