import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { pipeline } from "@huggingface/transformers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const guidesPath = path.join(
    __dirname,
    "../data/guides"
);

// ------------------------
// 1. Embedding Model
// ------------------------

let extractor = null;


async function getExtractor() {

    if (!extractor) {

        console.log(
            "\n[RAG] 正在加载 Embedding 模型..."
        );
        extractor = await pipeline(
            "feature-extraction",
            "Xenova/paraphrase-multilingual-MiniLM-L12-v2"
        );

        console.log(
            "[RAG] Embedding 模型加载完成"
        );
    }

    return extractor;
}


// ------------------------
// 2. 文档 Chunk
// ------------------------

function splitIntoChunks(text, source) {
  const lines = text.split("\n");

  const chunks = [];

  let currentTitle = "";
  let currentContent = [];


  function saveChunk() {
    const content =
      currentContent
        .join("\n")
        .trim();

    if (!content) {
      return;
    }

    const fullContent =
      currentTitle
        ? `${currentTitle}\n${content}`
        : content;

    chunks.push({
      id:
        `${source}-${chunks.length}`,

      source,

      content:
        fullContent,
    });
  }


  for (const line of lines) {

    const trimmed =
      line.trim();


    /*
      遇到 Markdown 标题：

      先保存上一段，
      然后开启新的 Chunk。
    */
    if (
      trimmed.startsWith("#")
    ) {

      saveChunk();

      currentTitle =
        trimmed;

      currentContent = [];

      continue;
    }


    if (trimmed) {

      currentContent.push(
        trimmed
      );
    }
  }


  // 保存最后一段
  saveChunk();


  return chunks;
}
// ------------------------
// 3. 读取所有攻略
// ------------------------

async function loadDocuments() {

  const files =
    await fs.readdir(guidesPath);

  const chunks = [];


  for (const file of files) {

    if (!file.endsWith(".md")) {
      continue;
    }


    const filePath =
      path.join(guidesPath, file);


    const text =
      await fs.readFile(
        filePath,
        "utf-8"
      );


    const fileChunks =
      splitIntoChunks(
        text,
        file
      );


    chunks.push(
      ...fileChunks
    );
  }


  return chunks;
}

// ------------------------
// 4. Embedding
// ------------------------

async function embedTexts(texts) {

  const model =
    await getExtractor();


  const output =
    await model(
      texts,
      {
        pooling: "mean",
        normalize: true,
      }
    );


  /*
    output:
    Tensor

    转换成普通 JS 数组
  */
  return output.tolist();
}

// ------------------------
// 5. Vector Index
// ------------------------

let vectorIndex = null;


async function buildVectorIndex() {

  if (vectorIndex) {
    return vectorIndex;
  }


  console.log(
    "\n[RAG] 正在建立攻略向量索引..."
  );


  const chunks =
    await loadDocuments();


  const texts =
    chunks.map(
      chunk => chunk.content
    );


  const embeddings =
    await embedTexts(texts);


  vectorIndex =
    chunks.map(
      (chunk, index) => ({
        ...chunk,

        embedding:
          embeddings[index],
      })
    );


  console.log(
    `[RAG] 向量索引建立完成，共 ${vectorIndex.length} 个 Chunk`
  );


  return vectorIndex;
}

// ------------------------
// 6. Cosine Similarity
// ------------------------

function dotProduct(a, b) {

  let result = 0;

  for (
    let i = 0;
    i < a.length;
    i++
  ) {

    result +=
      a[i] * b[i];
  }

  return result;
}

/*
  因为前面 normalize: true，

  所有向量长度都已经是 1。

  所以：

  cosine similarity
  =
  dot product
*/
function cosineSimilarity(a, b) {

  return dotProduct(a, b);
}

// ------------------------
// 7. Retrieval
// ------------------------

export async function searchGameGuides(
  query,
  topK = 3
) {

  console.log(
    `\n[RAG] Query: ${query}`
  );


  const index =
    await buildVectorIndex();


  const queryEmbeddings =
    await embedTexts([query]);


  const queryVector =
    queryEmbeddings[0];


  const results =
    index
      .map(item => ({

        source: item.source,

        content: item.content,

        score:
          cosineSimilarity(
            queryVector,
            item.embedding
          ),

      }))

      .sort(
        (a, b) =>
          b.score - a.score
      )

      .slice(0, topK);


  console.log(
    "[RAG] 检索结果："
  );


  for (const result of results) {

    console.log(
      result.source,
      result.score.toFixed(4),
      result.content.slice(0, 50)
    );
  }


  return {
    success: true,
    query,
    results,
  };
}