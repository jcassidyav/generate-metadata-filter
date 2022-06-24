import * as fs from "fs";
export class ConfigX {
    public static readConfig(): IConfig {
        if (fs.existsSync(".generate-metadata-filter.json")) {
            const configContents = fs.readFileSync("./.generate-metadata-filter.json", { encoding: "utf8" });

            return JSON.parse(configContents);
        } else {
            throw new Error("Could not find file `.generate-metadata-filter.json`");
        }
    }
}

export interface IConfig {
    typeSources: {
        ios: Array<string>;
        android: Array<string>;
    };
    mode: "app" | "plugin";
}
