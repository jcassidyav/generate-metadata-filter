#!/usr/bin/env node
import { AndroidGenerator } from "./androidGenerator";
import { Scanner } from "./compile";
import { ConfigX } from "./config";
import { IOSGenerator } from "./iosGenerator";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const version = require("../package.json").version;
export function foo(a: number, b: number): number {
    return a + b + 2;
}

export function bar(a: number, b: number): number {
    return a - b;
}

console.log("Scanning Typescript for Native Types", version);
const config = ConfigX.readConfig();
const compile = new Scanner(config);
const scanResult = compile.doScan();
console.log("*********** Identified IOS*************");
scanResult.ios.forEach((value, key) => {
    console.log(key, JSON.stringify(value));
});
console.log("*********** Identified Android *************");
scanResult.android.forEach((value, key) => {
    console.log(key, JSON.stringify(value));
});
const generator = new AndroidGenerator(config);
generator.generate(scanResult.android);

const iosGenerator = new IOSGenerator(config);
generator.generate(scanResult.ios);


