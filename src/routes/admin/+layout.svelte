<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { supabase } from '$lib/supabase';

	let { children } = $props();

	let checking = $state(true);
	let authed = $state(false);

	onMount(async () => {
		const { data } = await supabase.auth.getSession();
		const isLoginPage = page.url.pathname === '/admin/login';

		if (data.session) {
			authed = true;
			if (isLoginPage) goto('/admin');
		} else {
			authed = false;
			if (!isLoginPage) goto('/admin/login');
		}
		checking = false;

		supabase.auth.onAuthStateChange((_event, session) => {
			authed = !!session;
			if (!session && page.url.pathname.startsWith('/admin') && page.url.pathname !== '/admin/login') {
				goto('/admin/login');
			}
		});
	});
</script>

{#if checking}
	<div class="loading">Loading…</div>
{:else}
	{@render children()}
{/if}

<style>
	.loading {
		min-height: 60vh;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #888;
	}
</style>
