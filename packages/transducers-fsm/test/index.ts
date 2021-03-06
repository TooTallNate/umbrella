import * as assert from "assert";
import * as tx from "@thi.ng/transducers";
import { fsm } from "../src/index";

describe("transducers-fsm", () => {
    it("readme example", () => {
        const testFSM = fsm({
            states: {
                skip: (state, x) => {
                    if (x < 20) {
                        if (++state.count > 5) {
                            state.state = "take";
                            state.count = 1;
                            return [x];
                        }
                    } else {
                        state.state = "done";
                    }
                },
                take: (state, x) => {
                    if (x < 20) {
                        if (++state.count > 5) {
                            state.state = "skip";
                            state.count = 1;
                        } else {
                            return [x];
                        }
                    } else {
                        state.state = "done";
                    }
                },
                done: () => { },
            },
            terminate: "done",
            init: () => ({ state: "skip", count: 0 })
        });
        assert.deepEqual(
            [...tx.iterator(testFSM, tx.range(100))],
            [5, 6, 7, 8, 9, 15, 16, 17, 18, 19]
        );
        assert.deepEqual(
            [...tx.iterator(tx.comp(tx.takeNth(2), testFSM), tx.range(100))],
            [10, 12, 14, 16, 18]
        );
        assert.deepEqual(
            [...tx.iterator(tx.comp(testFSM, tx.map((x: number) => x * 10)), tx.range(100))],
            [50, 60, 70, 80, 90, 150, 160, 170, 180, 190]
        );
    });
});
