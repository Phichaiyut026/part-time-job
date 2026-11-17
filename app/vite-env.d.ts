// Vite raw imports: `import text from "some/file?raw"` gives the file's contents as a string.
declare module "*?raw" {
  const source: string;
  export default source;
}
