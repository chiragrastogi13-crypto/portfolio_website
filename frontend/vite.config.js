import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server on 5173. The backend API runs on 8000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // listen on 0.0.0.0 so 127.0.0.1.nip.io also works
  },
});
