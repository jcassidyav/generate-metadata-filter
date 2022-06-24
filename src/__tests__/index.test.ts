import test from "ava";
import { ConfigX } from "../config";
import { foo, bar } from "../index";

test("foo()", (t) => {
    t.is(foo(1, 2), 5);
});

test("bar()", (t) => {
    t.is(bar(2, 1), 1);
});

test("config", (t) => {
    t.is(ConfigX.readConfig().typeSources.android[0], "a");
});
