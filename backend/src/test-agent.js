// src/test-agent.js

import { runAgent } from "./agent.js";


async function main() {

    try {

        const result = await runAgent(
            "u001",
            `
我刚刚打完森林守卫，
现在想挑战熔岩巨兽。

结合我的当前状态和攻略告诉我：
1. 我现在适不适合直接去打？
2. 如果不适合，我下一步应该去哪？
3. 太刀打熔岩巨兽应该怎么准备？
`
        );


        console.log("\n========================");

        console.log("最终回答：");

        console.log(result.answer);


        console.log("\n调用过的 Tools：");

        console.log(result.toolsUsed);

        console.log("========================");

    } catch (error) {

        console.error("\n程序运行失败：");

        console.error(error);
    }
}


main();