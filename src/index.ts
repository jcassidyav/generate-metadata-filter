#!/usr/bin/env node

import { ConfigX } from "./config";

export function foo(a: number, b: number): number {
  return a + b + 2;
}

export function bar(a: number, b: number): number {
  return a - b;
}

console.log("Hello1");
ConfigX.readConfig();