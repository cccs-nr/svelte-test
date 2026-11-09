<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import ConversationPanel from '#lib/components/ConversationPanel.svelte';
	import FamilyGiftConversationsPanel from '#lib/components/FamilyGiftConversationsPanel.svelte';

	let { data }: PageProps = $props();
	let secretSantaDirection = $derived(
		data.conversationId === 'secret-santa-asGiver'
			? ('asGiver' as const)
			: data.conversationId === 'secret-santa-asRecipient'
				? ('asRecipient' as const)
				: null
	);
</script>

<svelte:head>
	<title>Conversation | Secret Santa</title>
</svelte:head>

<section class="flex min-h-[calc(100dvh-9rem)] flex-col gap-3">
	<a
		class="inline-flex shrink-0 self-start rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
		href={resolve('/app/messages')}
	>
		Back to Messages
	</a>

	{#if secretSantaDirection}
		<ConversationPanel
			direction={secretSantaDirection}
			displayName={data.user.displayName}
			hasAvatar={data.hasAvatar}
			avatarVersion={data.avatarVersion}
			fullHeight
		/>
	{:else}
		<FamilyGiftConversationsPanel
			currentUserId={data.user.id}
			conversationId={data.conversationId}
			fullHeight
		/>
	{/if}
</section>
