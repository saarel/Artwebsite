<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';

	let email = $state('');
	let password = $state('');
	let submitting = $state(false);
	let error = $state<string | null>(null);

	async function login(e: SubmitEvent) {
		e.preventDefault();
		submitting = true;
		error = null;

		const { error: err } = await supabase.auth.signInWithPassword({ email, password });

		submitting = false;
		if (err) {
			error = err.message;
		} else {
			goto('/admin');
		}
	}
</script>

<svelte:head>
	<title>Sign in · Artbygrigoryorenbakh</title>
</svelte:head>

<div class="wrap">
	<form onsubmit={login}>
		<h1>Admin sign in</h1>

		<label>
			<span>Email</span>
			<input type="email" bind:value={email} required disabled={submitting} autocomplete="email" />
		</label>

		<label>
			<span>Password</span>
			<input
				type="password"
				bind:value={password}
				required
				disabled={submitting}
				autocomplete="current-password"
			/>
		</label>

		{#if error}
			<p class="error">{error}</p>
		{/if}

		<button type="submit" disabled={submitting}>
			{submitting ? 'Signing in…' : 'Sign in'}
		</button>
	</form>
</div>

<style>
	.wrap {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
		max-width: 360px;
	}

	h1 {
		font-family: Georgia, serif;
		font-weight: 400;
		margin: 0 0 0.5rem;
		text-align: center;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.85rem;
		color: #555;
	}

	input {
		font: inherit;
		padding: 0.6rem 0.7rem;
		border: 1px solid #ccc;
		border-radius: 3px;
	}

	input:focus {
		outline: none;
		border-color: #333;
	}

	button {
		padding: 0.7rem;
		background: #111;
		color: #fff;
		border: none;
		border-radius: 3px;
		cursor: pointer;
		font: inherit;
	}

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.error {
		color: #b00;
		margin: 0;
		font-size: 0.9rem;
	}
</style>
