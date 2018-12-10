import path from 'path';
import { map } from './storage';
import { readFile, writeFile, exists, unlink } from 'fs-extra';
import log from 'common/log';

// TODO: support cluster mode

export const filePath = path.resolve('storage/scripts.json');

export const separator = '|';

/**
 * @export
 * @param {...string} args
 * @returns
 */
export function key(...args) {
	return args.join(separator);
}

/**
 * @export
 * @param {string} keyString
 * @returns
 */
export function unkey(keyString) {
	return keyString.split(separator);
}

export async function read() {
	// @ts-ignore
	if (!(await exists(filePath))) {
		return;
	}

	const contents = await readFile(filePath, 'utf8');

	try {
		const scriptMap = JSON.parse(contents);

		map.clear();
		for (let [scriptKey, { handler, externalDependencies }] of scriptMap) {
			await register(...unkey(scriptKey), handler, externalDependencies, false);
		}
	} catch (err) {
		if (err.type === 'SyntaxError') {
			await unlink(filePath);
		}
		log.fatal({ err });
	}
}

export async function _write() {
	const mapContent = [...map];
	for (let i = 0; i < mapContent.length; i++) {
		mapContent[i][1].handler = mapContent[i][1].handler.toString();
	}
	const contents = JSON.stringify(mapContent);

	await writeFile(filePath, contents);
}

export async function register(site, section, handler, externalDependencies, write = true) {
	for (const module of externalDependencies) {
		if (!require(module)) {
			throw new Error('scraper node is missing external dependency: ' + module);
		}
	}

	if (!(handler instanceof Function)) {
		handler = new Function('return ' + handler);
	}

	map.set(key(site, section), { handler, externalDependencies });
	write && (await _write());

	return handler;
}

/**
 * @export
 * @returns {{ handler:Function,externalDependencies:number }}
 */
export function get(site, section) {
	return map.get(key(site, section));
}
