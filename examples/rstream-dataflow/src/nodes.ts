import { IObjectOf } from "@thi.ng/api/api";
import { illegalArgs } from "@thi.ng/api/error";
import { IAtom } from "@thi.ng/atom/api";
import { isString } from "@thi.ng/checks/is-string";
import { Path, getIn } from "@thi.ng/paths";
import { resolveMap } from "@thi.ng/resolve-map";
import { ISubscribable } from "@thi.ng/rstream/api";
import { fromIterableSync } from "@thi.ng/rstream/from/iterable";
import { fromView } from "@thi.ng/rstream/from/view";
import { sync } from "@thi.ng/rstream/stream-sync";
import { map } from "@thi.ng/transducers/xform/map";
import { Transducer } from "@thi.ng/transducers/api";

import { NodeSpec } from "./api";

/**
 * Dataflow graph initialization function. Takes an object of
 * NodeSpec's, calls `nodeFromSpec` for each and then recursively
 * resolves references via `@thi.ng/resolve-map/resolveMap`. Returns
 * updated graph object (mutates in-place, original specs are replaced
 * by stream constructs).
 *
 * @param state
 * @param nodes
 */
export const initNodes = (state: IAtom<any>, nodes: IObjectOf<NodeSpec>) => {
    for (let k in nodes) {
        (<any>nodes)[k] = nodeFromSpec(state, nodes[k]);
    }
    return resolveMap(nodes);
};

/**
 * Transforms a single NodeSpec into a lookup function for `resolveMap`
 * (which is called from `initNodes`). When that called is called,
 * recursively resolves all specified input streams and calls this
 * spec's `fn` to produce a new stream from these inputs. If the spec
 * includes the optional `out` key, it also executes the provided
 * function, or if the value is a string, adds a subscription to this
 * node's result stream which then updates the provide state atom at the
 * path defined by `out`. Returns an ISubscribable.
 *
 * @param spec
 */
const nodeFromSpec = (state: IAtom<any>, spec: NodeSpec) => (resolve) => {
    const src: ISubscribable<any>[] = [];
    for (let i of spec.ins) {
        let s;
        if (i.path) {
            s = fromView(state, i.path);
        } else if (i.stream) {
            s = isString(i.stream) ? resolve(i.stream) : i.stream(resolve);
        } else if (i.const) {
            s = fromIterableSync([i.const]);
        } else {
            illegalArgs(`invalid node spec`);
        }
        if (i.xform) {
            s = s.subscribe(i.xform);
        }
        if (i.id) {
            s.id = i.id;
        }
        src.push(s);
    }
    const node = spec.fn(src);
    if (spec.out) {
        if (isString(spec.out)) {
            ((path) => node.subscribe({ next: (x) => state.resetIn(path, x) }))(spec.out);
        } else {
            spec.out(node);
        }
    }
    return node;
};

/**
 * Higher order node / stream creator. Takes a transducer and optional
 * arity (number of required input streams). The returned function takes
 * an array of input streams and returns a new
 * @thi.ng/rstream/StreamSync instance.
 *
 * @param xform
 * @param arity
 */
export const node = (xform: Transducer<IObjectOf<any>, any>, arity?: number) =>
    (src: ISubscribable<number>[]) => {
        if (arity !== undefined && src.length !== arity) {
            illegalArgs(`wrong number of inputs: got ${src.length}, but needed ${arity}`);
        }
        return sync({ src, xform, reset: false });
    };

/**
 * Addition node. Supports any number of inputs.
 */
export const add = node(
    map((ports: IObjectOf<number>) => {
        let sum = 0;
        for (let p in ports) {
            sum += ports[p];
        }
        return sum;
    }));

/**
 * Multiplication node. Supports any number of inputs.
 */
export const mul = node(
    map((ports: IObjectOf<number>) => {
        let sum = 1;
        for (let p in ports) {
            sum *= ports[p];
        }
        return sum;
    }));

/**
 * Substraction node. 2 inputs.
 */
export const sub = node(map((ports: IObjectOf<number>) => ports.a - ports.b), 2);

/**
 * Division node. 2 inputs.
 */
export const div = node(map((ports: IObjectOf<number>) => ports.a / ports.b), 2);

/**
 * Nested value extraction node. Higher order function. Only 1 input
 * allowed.
 */
export const extract = (path: Path) =>
    (src: ISubscribable<number>[]) => {
        if (src.length !== 1) {
            illegalArgs(`too many inputs, only needed 1`);
        }
        return src[0].subscribe(map((x) => getIn(x, path)));
    };