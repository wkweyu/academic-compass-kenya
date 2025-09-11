import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
<<<<<<< HEAD
    port: 5173,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(
    Boolean
  ),
=======
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
