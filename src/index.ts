#!/usr/bin/env node
import { Scanner } from "./compile";
import { ConfigX } from "./config";

export function foo(a: number, b: number): number {
    return a + b + 2;
}

export function bar(a: number, b: number): number {
    return a - b;
}

console.log("Hello1");
const config = ConfigX.readConfig();
const compile = new Scanner(config);
compile.doScan();
