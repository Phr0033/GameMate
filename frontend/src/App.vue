<script setup>
import { ref } from "vue";
import {marked} from "marked"
import DOMPurify from "DOMPurify";
const input = ref("");
const loading = ref(false);

const messages = ref([
  {
    role: "assistant",
    content: "你好，我是 GameMate。你可以问我游戏路线、Boss 打法和装备建议。",
    toolsUsed: [],
    trace:[],
  },
]);


const sessionId =
  ref(
    localStorage.getItem(
      "gamemate_session_id"
    )
    ||
    crypto.randomUUID()
  );


localStorage.setItem(
  "gamemate_session_id",
  sessionId.value
);

function renderMarkdown(text) {

  if (!text) {
    return "";
  }

  const html =
    marked.parse(text);

  return DOMPurify.sanitize(
    html
  );
}

async function sendMessage() {
  const text = input.value.trim();

  if (!text || loading.value) {
    return;
  }

  // 先把用户消息显示出来
  messages.value.push({
    role: "user",
    content: text,
  });

  input.value = "";
  loading.value = true;

  try {
    const response = await fetch(
      "http://localhost:3000/api/chat",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          userId: "u001",
          sessionId:sessionId.value,
          message: text,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "请求失败"
      );
    }

    messages.value.push({
      role: "assistant",
      content: data.answer,
      toolsUsed: data.toolsUsed || [],
      trace:data.trace ||[],
      metrics:data.metrics||null,
    });

  } catch (error) {
    messages.value.push({
      role: "assistant",
      content: `请求失败：${error.message}`,
      toolsUsed: [],
    });

  } finally {
    loading.value = false;
  }
}

function handleEnter(event) {
  // Shift + Enter 换行
  if (event.shiftKey) {
    return;
  }

  event.preventDefault();
  sendMessage();
}

</script>


<template>
  <div class="app">

    <header class="header">
      <div>
        <h1>GameMate</h1>
        <p>AI Game Assistant</p>
      </div>
    </header>


    <main class="chat">

      <div
        v-for="(message, index) in messages"
        :key="index"
        class="message-row"
        :class="message.role"
      >

        <div class="message-card">

          <div class="role">
            {{
              message.role === "user"
                ? "你"
                : "GameMate"
            }}
          </div>

          <div class="content markedown-body"
          v-html="renderMarkdown(
            message.content
          )">
          </div>


          <!--
            只在 AI 使用过 Tool 时显示
          -->
          <div
  v-if="
    message.trace &&
    message.trace.length
  "
  class="trace"
>

  <div class="trace-title">
    Agent Trace
    <div
  v-if="message.metrics"
  class="metrics"
>
  <span>
    LLM 调用：
    {{ message.metrics.llmCalls }}
  </span>

  <span>
    Tool：
    {{ message.metrics.toolCalls }}
  </span>

  <span>
    总耗时：
    {{
      (
        message.metrics.totalTimeMs
        / 1000
      ).toFixed(2)
    }}s
  </span>
</div>
  </div>


  <div
    v-for="(item, traceIndex)
      in message.trace"
    :key="traceIndex"
    class="trace-item"
  >

    <div class="trace-tool">

      ✓ {{ item.name }}

    </div>


    <!-- 玩家 Tool -->
    <div
      v-if="
        item.name ===
        'get_current_player_profile'
      "
      class="trace-detail"
    >

      <div>
        等级：
        {{
          item.result
            ?.player
            ?.level
        }}
      </div>

      <div>
        武器：
        {{
          item.result
            ?.player
            ?.weapon
        }}
      </div>

      <div>
        进度：
        {{
          item.result
            ?.player
            ?.progress
        }}
      </div>

    </div>


    <!-- Boss Tool -->
    <div
      v-else-if="
        item.name ===
        'get_boss_info'
      "
      class="trace-detail"
    >

      <div>
        Boss：
        {{
          item.result
            ?.boss
            ?.name
        }}
      </div>

      <div>
        推荐等级：
        {{
          item.result
            ?.boss
            ?.recommendedLevel
        }}
      </div>

      <div>
        弱点：
        {{
          item.result
            ?.boss
            ?.weakness
        }}
      </div>

    </div>


    <!-- RAG -->
    <div
      v-else-if="
        item.name ===
        'search_game_guides'
      "
      class="rag-results"
    >

      <div
        v-for="(
          result,
          resultIndex
        ) in item.results"
        :key="resultIndex"
        class="rag-item"
      >

        <div class="rag-header">

          <span>
            📄
            {{ result.source }}
          </span>

          <span class="score">
            {{
              result.score
            }}
          </span>

        </div>


        <div class="rag-preview">

          {{
            result.preview
          }}

        </div>

      </div>

    </div>

  </div>

          </div>
        </div>

      </div>


      <div
        v-if="loading"
        class="message-row assistant"
      >
        <div class="message-card">
          <div class="role">
            GameMate
          </div>

          <div class="content loading">
            正在思考...
          </div>
        </div>
      </div>

    </main>


    <footer class="input-area">

      <textarea
        v-model="input"
        placeholder="问问 GameMate..."
        @keydown.enter="handleEnter"
      ></textarea>

      <button
        :disabled="loading || !input.trim()"
        @click="sendMessage"
      >
        发送
      </button>

    </footer>

  </div>
</template>


<style scoped>
* {
  box-sizing: border-box;
}

.app {
  min-height: 100vh;
  background: #0f1115;
  color: #f5f5f5;

  display: flex;
  flex-direction: column;
}

.header {
  height: 72px;
  padding: 0 32px;

  display: flex;
  align-items: center;

  border-bottom: 1px solid #262a33;
  background: #151820;
}

.header h1 {
  margin: 0;
  font-size: 22px;
}

.header p {
  margin: 3px 0 0;
  color: #8d95a5;
  font-size: 13px;
}


.chat {
  width: min(900px, 100%);
  margin: 0 auto;

  flex: 1;

  padding: 30px 20px 140px;
}

.message-row {
  display: flex;
  margin-bottom: 22px;
}

.message-row.user {
  justify-content: flex-end;
}

.message-row.assistant {
  justify-content: flex-start;
}


.message-card {
  max-width: 75%;

  padding: 15px 18px;

  border-radius: 14px;

  background: #1a1e27;

  line-height: 1.7;
}

.user .message-card {
  background: #2d64d8;
}


.role {
  margin-bottom: 6px;

  font-size: 12px;
  font-weight: bold;

  color: #99a2b4;
}

.user .role {
  color: #dbe7ff;
}


.content {
  white-space: pre-wrap;
}


.tools {
  margin-top: 14px;

  padding-top: 12px;

  border-top: 1px solid #353a46;
}

.tools-title {
  margin-bottom: 8px;

  font-size: 12px;

  color: #8992a3;
}

.tool-tag {
  display: inline-block;

  margin-right: 7px;
  margin-bottom: 5px;

  padding: 4px 8px;

  border-radius: 6px;

  background: #292f3b;

  color: #9fc1ff;

  font-size: 12px;
}


.loading {
  color: #929aaa;
}


.input-area {
  position: fixed;

  bottom: 0;
  left: 0;
  right: 0;

  padding: 20px;

  display: flex;
  justify-content: center;
  gap: 12px;

  background: rgba(15, 17, 21, 0.96);

  border-top: 1px solid #262a33;
}


textarea {
  width: min(740px, 80vw);

  height: 70px;

  resize: none;

  padding: 14px;

  border-radius: 10px;

  border: 1px solid #343945;

  background: #1a1e27;

  color: white;

  outline: none;
}

textarea:focus {
  border-color: #5b86e5;
}


button {
  width: 90px;

  border: none;

  border-radius: 10px;

  background: #3f73e0;

  color: white;

  cursor: pointer;

  font-weight: bold;
}

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Markdown */

.markdown-body {
  line-height: 1.75;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  margin-top: 18px;
  margin-bottom: 8px;
}

.markdown-body :deep(h2) {
  font-size: 18px;
}

.markdown-body :deep(h3) {
  font-size: 16px;
}

.markdown-body :deep(p) {
  margin: 8px 0;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 24px;
}

.markdown-body :deep(li) {
  margin: 5px 0;
}

.markdown-body :deep(strong) {
  color: #ffffff;
}


/* Agent Trace */

.trace {
  margin-top: 18px;

  padding-top: 14px;

  border-top:
    1px solid #353a46;
}


.trace-title {
  margin-bottom: 10px;

  color: #8faef2;

  font-size: 13px;

  font-weight: bold;
}


.trace-item {
  margin-bottom: 10px;

  padding: 10px;

  border-radius: 8px;

  background: #12151c;
}


.trace-tool {
  color: #9fc1ff;

  font-size: 13px;

  font-weight: bold;
}


.trace-detail {
  margin-top: 7px;

  color: #aab2c0;

  font-size: 12px;

  line-height: 1.6;
}


/* RAG */

.rag-results {
  margin-top: 8px;
}


.rag-item {
  margin-top: 8px;

  padding: 8px;

  border-left:
    2px solid #486fca;

  background: #181c24;
}


.rag-header {
  display: flex;

  justify-content:
    space-between;

  gap: 15px;

  font-size: 12px;

  color: #bec7d8;
}


.score {
  color: #7fa6ff;

  font-family: monospace;
}


.rag-preview {
  margin-top: 5px;

  color: #858e9f;

  font-size: 11px;

  line-height: 1.5;
}

.metrics {
  margin-top: 10px;

  display: flex;
  gap: 14px;

  flex-wrap: wrap;

  color: #778195;

  font-size: 11px;
}
</style>