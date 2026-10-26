import {
  runAgent
} from "./agent.js";


const cases = [

  {
    name:
      "查询当前玩家状态",

    question:
      "我现在多少级，用什么武器？",

    expectedTools: [
      "get_current_player_profile"
    ],
  },


  {
    name:
      "查询 Boss 基础数据",

    question:
      "熔岩巨兽的弱点是什么，推荐多少级挑战？",

    expectedTools: [
      "get_boss_info"
    ],
  },


  {
    name:
      "攻略路线 RAG",

    question:
      "打完森林守卫以后推荐去哪里升级？",

    expectedTools: [
      "search_game_guides"
    ],
  },


  {
    name:
      "复杂个性化攻略",

    question:
      `
我刚打完森林守卫，
想挑战熔岩巨兽。

结合我的当前状态和攻略，
告诉我是否适合直接挑战，
如果不适合应该去哪，
以及太刀应该怎么准备。
`,

    expectedTools: [
      "get_current_player_profile",
      "get_boss_info",
      "search_game_guides"
    ],
  },


  {
    name:
      "Conversation Memory",

    history: [
      {
        role: "user",
        content:
          "我给这次冒险起个代号，叫月光行动。",
      },

      {
        role: "assistant",
        content:
          "好的，这次冒险就叫月光行动。",
      },
    ],

    question:
      "我刚才给这次冒险起的代号是什么？",

    expectedTools: [],

    expectedKeywords: [
      "月光行动"
    ],
  },

];


function checkTools(
  actualTools,
  expectedTools
) {

  const actual =
    new Set(actualTools);


  const missing =
    expectedTools.filter(
      tool =>
        !actual.has(tool)
    );


  return {
    passed:
      missing.length === 0,

    missing,
  };
}


function checkKeywords(
  answer,
  keywords = []
) {

  const missing =
    keywords.filter(
      keyword =>
        !answer.includes(keyword)
    );


  return {
    passed:
      missing.length === 0,

    missing,
  };
}


async function main() {

  let passed = 0;


  for (
    const testCase
    of cases
  ) {

    console.log(
      "\n=============================="
    );

    console.log(
      `测试：${testCase.name}`
    );


    try {

      const result =
        await runAgent(
          "u001",
          testCase.question,
          testCase.history || []
        );


      const actualTools =
        result.toolsUsed.map(
          item => item.name
        );


      const toolCheck =
        checkTools(
          actualTools,
          testCase.expectedTools
        );


      const keywordCheck =
        checkKeywords(
          result.answer,
          testCase.expectedKeywords
        );


      const success =
        toolCheck.passed
        &&
        keywordCheck.passed;


      if (success) {
        passed++;
      }


      console.log(
        success
          ? "✅ PASS"
          : "❌ FAIL"
      );


      console.log(
        "期望 Tools：",
        testCase.expectedTools
      );


      console.log(
        "实际 Tools：",
        actualTools
      );


      if (
        toolCheck.missing.length
      ) {

        console.log(
          "缺少 Tool：",
          toolCheck.missing
        );
      }


      if (
        keywordCheck.missing.length
      ) {

        console.log(
          "缺少关键词：",
          keywordCheck.missing
        );
      }


      console.log(
        "耗时：",
        result.metrics.totalTimeMs,
        "ms"
      );


      console.log(
        "回答：",
        result.answer.slice(
          0,
          180
        )
      );

    } catch (error) {

      console.log(
        "❌ ERROR"
      );

      console.log(
        error.message
      );
    }
  }


  console.log(
    "\n=============================="
  );

  console.log(
    `Evaluation: ${passed}/${cases.length} passed`
  );

}


main();