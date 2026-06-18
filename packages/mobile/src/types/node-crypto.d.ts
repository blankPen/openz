// Node `crypto` 模块的最小类型声明,供 `@openz/shared` 在 mobile 端使用。
// 不安装 @types/node,避免拖入其他 Node 全局类型。
declare module 'crypto' {
  export function randomUUID(): string;
}
