import { ProjectFile } from "@/types";

/**
 * Compiles a collection of project files (HTML, CSS, JS) into a unified,
 * sandboxed HTML document string ready for iframe srcdoc injection.
 */
export function buildPreviewDoc(files: ProjectFile[]): string {
  if (!files || files.length === 0) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              background: #090d16;
              color: #64748b;
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              text-align: center;
              padding: 20px;
            }
            .spinner {
              width: 40px;
              height: 40px;
              border: 3px solid rgba(99, 102, 241, 0.2);
              border-top-color: #6366f1;
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin-bottom: 16px;
            }
            @keyframes spin { to { transform: rotate(360deg); } }
            h2 { color: #94a3b8; margin: 0 0 8px 0; font-size: 16px; }
            p { margin: 0; font-size: 13px; }
          </style>
        </head>
        <body>
          <div class="spinner"></div>
          <h2>Ready to Build</h2>
          <p>Type a prompt in the chat panel to generate your live application.</p>
        </body>
      </html>
    `;
  }

  // Find entry HTML file (index.html or first .html file)
  const htmlFile =
    files.find((f) => f.path.toLowerCase() === "index.html") ||
    files.find((f) => f.path.toLowerCase().endsWith(".html")) || {
      path: "index.html",
      content: "<div id='app'></div>",
    };

  // Find all CSS files
  const cssFiles = files.filter((f) => f.path.toLowerCase().endsWith(".css"));

  // Find all JS/TS files
  const jsFiles = files.filter(
    (f) =>
      f.path.toLowerCase().endsWith(".js") ||
      f.path.toLowerCase().endsWith(".jsx") ||
      f.path.toLowerCase().endsWith(".ts") ||
      f.path.toLowerCase().endsWith(".tsx")
  );

  let doc = htmlFile.content;

  // If the HTML does not have <html> or <head>, wrap it
  if (!doc.includes("<html") && !doc.includes("<body")) {
    doc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  ${doc}
</body>
</html>`;
  }

  // Inject console interception script to pipe logs back to parent window
  const consoleScript = `
<script>
  (function() {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;

    function sendToParent(type, args) {
      try {
        const message = Array.from(args).map(arg => {
          if (typeof arg === 'object') {
            try { return JSON.stringify(arg); } catch(e) { return String(arg); }
          }
          return String(arg);
        }).join(' ');
        window.parent.postMessage({ type: 'CONSOLE_LOG', level: type, message: message, time: new Date().toLocaleTimeString() }, '*');
      } catch(e) {}
    }

    console.log = function() { sendToParent('log', arguments); originalLog.apply(console, arguments); };
    console.error = function() { sendToParent('error', arguments); originalError.apply(console, arguments); };
    console.warn = function() { sendToParent('warn', arguments); originalWarn.apply(console, arguments); };
    console.info = function() { sendToParent('info', arguments); originalInfo.apply(console, arguments); };

    window.onerror = function(msg, url, line, col, error) {
      sendToParent('error', ['Uncaught Error: ' + msg + ' (' + line + ':' + col + ')']);
    };
  })();
</script>
`;

  // Inject CSS contents
  const cssTags = cssFiles
    .map((f) => `<style data-filename="${f.path}">\n${f.content}\n</style>`)
    .join("\n");

  // Inject JS contents
  const jsTags = jsFiles
    .map((f) => `<script data-filename="${f.path}">\ntry {\n${f.content}\n} catch(err) { console.error('Error in ${f.path}:', err); }\n</script>`)
    .join("\n");

  // Insert console script and CSS in <head> or at top
  if (doc.includes("</head>")) {
    doc = doc.replace("</head>", `${consoleScript}\n${cssTags}\n</head>`);
  } else {
    doc = `${consoleScript}\n${cssTags}\n${doc}`;
  }

  // Insert JS at bottom of <body> or at bottom of document
  if (doc.includes("</body>")) {
    doc = doc.replace("</body>", `${jsTags}\n</body>`);
  } else {
    doc = `${doc}\n${jsTags}`;
  }

  return doc;
}
