import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';

export default defineConfig({
    integrations: [vue()],
    server: {
        allowedHosts: ['ca25b48ec807cf.lhr.life'],
    },
});