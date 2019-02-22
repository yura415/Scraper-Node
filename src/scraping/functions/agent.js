import agentPool from 'agency/agent-pool';
import resourceBrokerClient from 'resources/broker';
import { validateException as isAgentBrokenException } from 'agency/validate';
import * as plugins from 'plugins';
import log from 'common/log';
import pause from 'common/pause';

export const RESOURCES_FREE_TIMEOUT = 5000;

export default async function agentHandler({ site, section, request, agent }) {
	try {
		await authentication({ agent, site });

		return await plugins.exec(site, section, 'fetch', { agent, request, section, site });
	} catch (e) {
		if (agent && (isAgentBrokenException(e) || !(await validation({ agent, site })))) {
			try {
				agent && (await agent.destroy());
				await pause(RESOURCES_FREE_TIMEOUT);
			} catch (err) {
				log.fatal({ err });
			}
			agent = null;
		}
		throw e;
	} finally {
		agent && agentPool.returnAgent(agent);
	}
}

export async function authentication({ agent, site }) {
	const verify = plugins.resolveModuleDefault(site, 'authentication', 'verify');
	const authorize = plugins.resolveModuleDefault(site, 'authentication', 'authorize');

	if (!verify || !authorize) {
		log.debug('SKIP AUTHENTICATION FOR %s: no script', site);
		return;
	}

	const account = agent.account;

	if (!account) {
		throw new Error('Agent has no account');
	}

	if (!(await verify({ agent, account }))) {
		await authorize({ agent, account });
		if (!(await verify({ agent, account }))) {
			await agent.dumpHtml(
				`AUTH_FAIL ${account.email} ${new Date().toLocaleString('ru').replace(/:/g, '-')}`,
			);
			throw new Error('authentication failed');
		}
	}
}

export async function validation({ agent, site }) {
	const validate = plugins.resolveModuleDefault(site, 'validate');
	if (!validate) {
		log.trace('SKIP VALIDATION FOR %s: no script', site);
		return true;
	}

	const { account, proxy } = await validate({ agent });

	if (!account && !proxy) {
		return true;
	}

	for (const bannedResource of [account].filter(v => v)) {
		await resourceBrokerClient().ban(bannedResource, bannedResource.poolId);
	}

	return false;
}