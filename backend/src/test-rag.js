import {
  searchGameGuides
} from "./rag.js";


const result =
  await searchGameGuides(
    "我刚打完森林守卫，下一步应该去哪里？"
  );


console.log(
  "\n======================"
);

console.log(
  "最终 Retrieval 结果："
);

console.log(
  JSON.stringify(
    result,
    null,
    2
  )
);