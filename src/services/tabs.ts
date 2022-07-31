import { MatchingTypes } from '../types';
import { assignTabToGroup, getTab } from '../utils/chrome/tabs';
import {getGroupTitleByHostname, updateGroup} from '../utils/chrome/groups';
import TabChangeInfo = chrome.tabs.TabChangeInfo;
import {
	addGroup,
	getGroupIdByTitle,
	getGroupIdFromGroupConfig,
} from './state/groupsState';
import { getGroupsConfigurations } from './state/groupsConfigurationsState';
import colors from "../utils/colors";

async function repeatUntilSuccess(
	groupId: number | undefined,
	tab: chrome.tabs.Tab
): Promise<number> {
	try {
		return await assignTabToGroup(groupId, tab);
	} catch (e) {
		return await repeatUntilSuccess(groupId, tab);
	}
}

export async function arrangeTabToGroup(tab: chrome.tabs.Tab) {
	const groupConfig = getGroupConfigForTab(tab);
	if (!groupConfig) {
		await arrangeTabToGroupByUrl(tab);
		return;
	}

	let groupId = getGroupIdFromGroupConfig(groupConfig, tab.windowId);
	const isGroupCreated = !!groupId;
	if (tab.groupId === groupId) return;
	groupId = (await repeatUntilSuccess(groupId, tab)) as number;

	if (!isGroupCreated) {
		addGroup(await updateGroup(groupId, groupConfig));
	}
}

async function arrangeTabToGroupByUrl(tab: chrome.tabs.Tab) {
	if (!tab.url) return;
	const url = new URL(tab.url);
	if (!url.protocol.includes('http')) return;
	const groupTitle = getGroupTitleByHostname(url.hostname);
	let groupId = getGroupIdByTitle(groupTitle);
	const isGroupCreated = !!groupId;
	if (tab.groupId === groupId) return;
	groupId = (await repeatUntilSuccess(groupId, tab)) as number;

	if (!isGroupCreated) {
		const color = Math.round((Math.random() * colors.length));
		addGroup(
			await updateGroup(groupId, {
				color: colors[color],
				name: groupTitle,
				rules: [],
				id: new Date().getTime(),
			})
		);
	}
}

export function getGroupConfigForTab(tab: chrome.tabs.Tab) {
	const groupsConfigs = getGroupsConfigurations();
	for (const config of groupsConfigs) {
		for (const rule of config.rules) {
			switch (rule.type) {
				case MatchingTypes.Includes: {
					if (tab.url?.includes(rule.value)) {
						return config;
					}
				}
			}
		}
	}
}

export function watchUpdatedTab(callback: (tab: chrome.tabs.Tab) => void) {
	function handler(
		tabId: number,
		changeInfo: TabChangeInfo,
		tab: chrome.tabs.Tab
	) {
		if (changeInfo.url) {
			callback(tab);
		}
	}
	chrome.tabs.onUpdated.addListener(handler);

	return {
		unsubscribe() {
			chrome.tabs.onUpdated.removeListener(handler);
		},
	};
}

export function watchTabMoved(callback: (tab: chrome.tabs.Tab) => void) {
	chrome.tabs.onMoved.addListener((tabId, detachInfo) => {
		getTab(tabId).then((tab) => {
			callback(tab);
		});
	});
}

export function watchTabAttached(callback: (tab: chrome.tabs.Tab) => void) {
	chrome.tabs.onActivated.addListener(({ tabId }) => {
		getTab(tabId).then((tab) => {
			callback(tab);
		});
	});
}