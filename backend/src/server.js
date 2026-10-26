import "dotenv/config";

import express from "express";
import cors from "cors";

import { runAgent } from "./agent.js";


const app = express();

const PORT = 3000;


const sessionHistories = new Map();

// 允许 Vue 开发服务器跨域访问
app.use(cors());


// 让 Express 能读取 JSON 请求体
app.use(express.json());


// 简单健康检查
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "GameMate backend is running",
    });
});


// AI 聊天接口
app.post("/api/chat", async (req, res) => {

    try {

        const {
            userId,
            sessionId,
            message,
        } = req.body;


        // 简单参数校验
        if (!userId || !message||!sessionId) {

            return res.status(400).json({
                success: false,
                message: "userId,sessionId 和 message 不能为空",
            });
        }


        console.log("\n==========================");

        console.log("收到用户请求：");

        console.log({
            userId,
            message,
        });


        /*
          调用我们前面已经写好的 Agent。
    
          Express 并不知道 Agent 内部到底：
          - 调了 LLM
          - 调了几个 Tool
          - 有没有跑 RAG
    
          它只负责把请求交进去，
          再把结果返回前端。
        */


        let history =
        sessionHistories.get(sessionId)
        || [];

        const result =
            await runAgent(
                userId,
                message,
                history
            );

        history.push(
            {
                role: "user",
                content: message,
            },
            {
                role: "assistant",
                content: result.answer,
            }
        );

        const MAX_HISTORY_MESSAGES = 20;
        if (
            history.length >
            MAX_HISTORY_MESSAGES
        ) {

            history =
                history.slice(
                    -MAX_HISTORY_MESSAGES
                );
        }


        sessionHistories.set(
            sessionId,
            history
        );

        console.log("\nAgent 回答完成");

        console.log("\n[Agent Metrics]");

        console.log({
            userId,
            sessionId,

            tools:
                result.toolsUsed.map(
                    item => item.name
                ),

            ...result.metrics,
        });

        return res.json({

            success: true,

            answer:
                result.answer,

            toolsUsed:
                result.toolsUsed,

            trace:
                result.trace,
            metrics:
            result.metrics,
        });


    } catch (error) {

        console.error(
            "\n/api/chat 执行失败：",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "AI 服务暂时出现异常",

            error:
                error.message,
        });
    }
});

//清空会话
app.delete(
  "/api/session/:sessionId",
  (req, res) => {

    const {
      sessionId
    } = req.params;


    sessionHistories.delete(
      sessionId
    );


    res.json({
      success: true,
      message: "会话已清空",
    });
  }
);


app.listen(PORT, () => {

    console.log(
        `GameMate Backend running at http://localhost:${PORT}`
    );

});