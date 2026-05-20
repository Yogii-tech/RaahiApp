/// <reference types="node" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}
