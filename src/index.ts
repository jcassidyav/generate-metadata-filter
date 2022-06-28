#!/usr/bin/env node
import { AndroidGenerator } from "./androidGenerator";
import { Scanner } from "./compile";
import { ConfigX } from "./config";

export function foo(a: number, b: number): number {
    return a + b + 2;
}

export function bar(a: number, b: number): number {
    return a - b;
}

console.log("Scanning Typescript for Native Types");
const config = ConfigX.readConfig();
const compile = new Scanner(config);
const scanResult = compile.doScan();
console.log("*********** Identified IOS*************");
scanResult.ios.forEach((value, key) => {
    console.log(key, JSON.stringify(value));
});
console.log("*********** Identified Android *************");
scanResult.ios.forEach((value, key) => {
    console.log(key, JSON.stringify(value));
});
const generator = new AndroidGenerator(config);
generator.generate(scanResult.android);
