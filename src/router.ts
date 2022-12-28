/**
 * The MIT License
 * Copyright (c) 2020 Zaiste <oh@zaiste.net>
 *
 * This file incorporates work covered by the following copyright and
 * permission notice:
 *
 * Copyright (c) 2015 fundon <cfddream@gmail.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Handler, HandlerParamsMap } from './types';

const Char = {
	SKIND: 0,
	PKIND: 1,
	AKIND: 2,
	STAR: 42,
	SLASH: 47,
	COLON: 58,
};

class Node {
	label: number;
	prefix: string;
	children: Node[];
	kind: number;
	map: HandlerParamsMap;

	constructor(
		prefix = '/',
		children = [],
		kind = Char.SKIND,
		map = Object.create(null),
	) {
		this.label = prefix.charCodeAt(0);
		this.prefix = prefix;
		this.children = children;
		this.kind = kind;
		this.map = map;
	}

	append(n: Node) {
		this.children.push(n);
	}

	find(condition: Function) {
		for (let i = 0; i < this.children.length; i++) {
			let node = this.children[i];
			if (condition(node)) return node;
		}
	}

	findChild(label: number, kind: number) {
		return this.find((node: Node) => label === node.label && kind === node.kind);
	}

	findChildByLabel(label: number) {
		return this.find((node: Node) => label === node.label);
	}

	findChildByKind(kind: number) {
		return this.find((node: Node) => kind === node.kind);
	}

	addHandler(method: string, handler, names: string[]) {
		this.map[method] = { handler, names };
	}

	findHandler(method: string) {
		return this.map[method];
	}
}

class Router {
	tree: Node;

	constructor() {
		this.tree = new Node();
	}

	add(method: string, path: string, handler: Function) {
		const pathLength = path.length;
		let params: string[] = [];

		for (let i = 0; i < pathLength; ++i) {
			let char = path.charCodeAt(i);
			if (char === Char.COLON) {
				let j = i + 1;

				this.insert(method, path.substring(0, i), Char.SKIND);
				while (i < pathLength && path.charCodeAt(i) !== Char.SLASH) {
					i++;
				}

				params.push(path.substring(j, i));
				path = path.substring(0, j) + path.substring(i);
				i = j;

				if (i === pathLength) {
					this.insert(method, path.substring(0, i), Char.PKIND, params, handler);
					return;
				}
				this.insert(method, path.substring(0, i), Char.PKIND, params);
			} else if (char === Char.STAR) {
				this.insert(method, path.substring(0, i), Char.SKIND);
				params.push('*');
				this.insert(method, path.substring(0, pathLength), Char.AKIND, params, handler);
				return;
			}
		}
		this.insert(method, path, Char.SKIND, params, handler);
	}

	insert(method: string, path: string, kind: number, names?: string[], handler?) {
		let node = this.tree;

		while (true) {
			let prefix = node.prefix;
			let pathLength = path.length;
			let prefixLength = prefix.length;

			let len = 0;
			while (len < Math.min(pathLength, prefixLength) && path.charCodeAt(len) === prefix.charCodeAt(len)) {
				len++;
			}

			if (len < prefixLength) {
				let n = new Node(prefix.substring(len), node.children, node.kind, node.map);

				node.children = [n];
				node.label = prefix.charCodeAt(0);
				node.prefix = prefix.substring(0, len);
				node.map = Object.create(null);
				node.kind = Char.SKIND;

				if (len === pathLength) {
					node.addHandler(method, handler, names);
					node.kind = kind;
				} else {
					let n = new Node(path.substring(len), [], kind);
					n.addHandler(method, handler, names);
					node.append(n);
				}
			} else if (len < pathLength) {
				path = path.substring(len);
				const child = node.findChildByLabel(path.charCodeAt(0));
				if (child !== undefined) {
					node = child;
					continue;
				}

				let n = new Node(path, [], kind);
				n.addHandler(method, handler, names);
				node.append(n);
			} else if (handler !== undefined) {
				node.addHandler(method, handler, names);
			}
			return;
		}
	}

	find(method: string, path: string, cn = this.tree, n = 0, result: [Handler, any[]] = [undefined, []]) {
		const pathLength = path.length;
		const prefix = cn.prefix;
		const prefixLength = prefix.length;
		const values = result[1];

		if (pathLength === 0 || path === prefix) {
			const r = cn.findHandler(method);
			if ((result[0] = r && r.handler) !== undefined) {
				const names = r.names;
				if (names !== undefined) {
					for (let i = 0; i < names.length; ++i) {
						const [name, value] = [names[i], values[i]];
						values[i] = { name, value };
					}
				}
			}
			return result;
		}

		let l = 0;
		while (l < Math.min(pathLength, prefixLength) && path.charCodeAt(l) === prefix.charCodeAt(l)) {
			l++;
		}

		if (l === prefixLength) {
			path = path.substring(l);
		}
		let preSearch = path;

		let child = cn.findChild(path.charCodeAt(0), Char.SKIND);
		if (child !== undefined) {
			this.find(method, path, child, n, result);
			if (result[0] !== undefined) {
				return result;
			}
			path = preSearch;
		}

		if (l !== prefixLength) {
			return result;
		}

		child = cn.findChildByKind(Char.PKIND);
		if (child !== undefined) {
			let i = 0;
			while (i < path.length && path.charCodeAt(i) !== Char.SLASH) {
				i++;
			}

			values[n] = path.substring(0, i);

			n++;
			preSearch = path;
			path = path.substring(i);

			this.find(method, path, child, n, result);
			if (result[0] !== undefined) {
				return result;
			}

			n--;
			values.pop();
			path = preSearch;
		}

		child = cn.findChildByKind(Char.AKIND);
		if (child !== undefined) {
			values[n] = path;
			this.find(method, '', child, n, result);
		}

		return result;
	}
}

export { Router };
