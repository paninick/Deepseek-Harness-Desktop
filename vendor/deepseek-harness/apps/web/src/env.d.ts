/**
 * The desktop's vite build loads katex display styles through the app entry;
 * the tsc client graph runs with "types": ["node"] and no bundler declarations,
 * so the side-effect css import needs an ambient module declaration here.
 */
declare module 'katex/dist/katex.min.css'
