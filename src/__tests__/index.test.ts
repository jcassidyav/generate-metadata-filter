import test from "ava";
import { ConfigX } from "../config";

test("config", (t) => {
    t.is(ConfigX.readConfig().typeSources.android[0], "a");
    t.is(ConfigX.readConfig().mode, "plugin");
});
