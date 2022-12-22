#!/usr/bin/env node
import { AndroidGenerator } from "./androidGenerator";
import { Scanner } from "./compile";
import { ConfigX } from "./config";
import { IOSGenerator } from "./iosGenerator";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const version = require("../package.json").version;

console.log("Scanning Typescript for Native Types", version);
const config = ConfigX.readConfig();
const compile = new Scanner(config);
const scanResult = compile.doScan();
console.log("*********** Identified IOS*************");
scanResult.ios.forEach((value, key) => {
    console.log(key, JSON.stringify(value));
});
console.log("*********** END Identified IOS *************");
console.log("*********** Identified Android *************");
scanResult.android.forEach((value, key) => {
    console.log(key, JSON.stringify(value));
});
console.log("*********** END Identified Android *************");
const androidGenerator = new AndroidGenerator(config);
androidGenerator.generate(scanResult.android);
const iosGenerator = new IOSGenerator(config);
iosGenerator.generate(scanResult.ios);
