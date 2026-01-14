import '../styles/app.css';
import App from './App.svelte';
import { mount } from 'svelte';
import { initTheme } from '$lib/stores';

// Initialize theme before mounting
initTheme();

const app = mount(App, {
  target: document.getElementById('app')!
});

export default app;
