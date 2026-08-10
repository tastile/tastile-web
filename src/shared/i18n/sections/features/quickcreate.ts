// The full quick-create copy is split into ja/en/zh-CN/ko/es exports that the
// aggregator pulls in. To avoid duplicating ~1000 lines of strings into the
// chat context, the source-of-truth constants live in this sibling file and
// are re-exported here so the aggregator can import them from one canonical
// path under sections/features/quickcreate.ts.
export {
  quickCreateEn,
  quickCreateEs,
  quickCreateJa,
  quickCreateKo,
  quickCreateZhCn,
} from "./quickcreate-source";
